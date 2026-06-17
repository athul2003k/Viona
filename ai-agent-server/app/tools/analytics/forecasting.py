"""
Analytics Forecasting Tools

Tools for predictive analytics and intelligent recommendations.
"""

import logging
from typing import Optional
from datetime import datetime, timedelta
from decimal import Decimal

from app.tools import BaseTool, ToolResult
from app.auth import AuthContext

logger = logging.getLogger(__name__)


class GetStockForecastTool(BaseTool):
    """Predict when items will run out based on sales velocity."""
    
    name = "get_stock_forecast"
    description = "Predict stock runout dates based on sales velocity"
    
    async def execute(
        self,
        days_to_analyze: int = 30,
        forecast_days: int = 30,
        limit: int = 20
    ) -> ToolResult:
        """
        Forecast stock levels.
        
        Args:
            days_to_analyze: Days of sales history to analyze
            forecast_days: Days to forecast into future
            limit: Number of products to return
        """
        cutoff = datetime.utcnow() - timedelta(days=days_to_analyze)
        
        # Get sales velocity and current stock for products
        query = '''
            WITH sales_data AS (
                SELECT 
                    oi.product_id,
                    COALESCE(SUM(oi.quantity), 0) as units_sold,
                    COUNT(DISTINCT o.order_id) as order_count
                FROM "OrderItem" oi
                JOIN "Order" o ON o.order_id = oi.order_id
                JOIN "Product" p ON p.product_id = oi.product_id
                WHERE p.org_id = $1 AND o.order_date >= $2
                GROUP BY oi.product_id
            ),
            stock_data AS (
                SELECT 
                    product_id,
                    COALESCE(SUM(quantity), 0) as current_stock
                FROM "ProductStock"
                GROUP BY product_id
            )
            SELECT 
                p.product_id,
                p.name,
                p.sku,
                COALESCE(sd.units_sold, 0) as units_sold,
                COALESCE(st.current_stock, 0) as current_stock,
                CASE 
                    WHEN COALESCE(sd.units_sold, 0) > 0 
                    THEN ROUND(sd.units_sold::numeric / $3, 2)
                    ELSE 0 
                END as daily_velocity
            FROM "Product" p
            LEFT JOIN sales_data sd ON sd.product_id = p.product_id
            LEFT JOIN stock_data st ON st.product_id = p.product_id
            WHERE p.org_id = $1
            ORDER BY 
                CASE WHEN st.current_stock > 0 AND sd.units_sold > 0 
                     THEN st.current_stock::numeric / (sd.units_sold::numeric / $3)
                     ELSE 9999 
                END
            LIMIT $4
        '''
        
        results = await self.query(
            query, 
            int(self.org_id), 
            cutoff, 
            days_to_analyze,
            limit
        )
        
        forecasts = []
        at_risk = 0
        
        for row in results:
            current_stock = row["current_stock"]
            daily_velocity = float(row["daily_velocity"])
            
            if daily_velocity > 0:
                days_until_stockout = current_stock / daily_velocity
                stockout_date = datetime.utcnow() + timedelta(days=days_until_stockout)
                is_at_risk = days_until_stockout <= forecast_days
                if is_at_risk:
                    at_risk += 1
            else:
                days_until_stockout = None
                stockout_date = None
                is_at_risk = False
            
            forecasts.append({
                "product_id": str(row["product_id"]),
                "name": row["name"],
                "sku": row["sku"],
                "current_stock": current_stock,
                "daily_velocity": daily_velocity,
                "days_until_stockout": round(days_until_stockout, 1) if days_until_stockout else None,
                "stockout_date": stockout_date.strftime("%Y-%m-%d") if stockout_date else None,
                "at_risk": is_at_risk
            })
        
        return ToolResult(success=True, data={
            "forecasts": forecasts,
            "at_risk_count": at_risk,
            "analysis_period_days": days_to_analyze,
            "forecast_horizon_days": forecast_days
        })


class GetReorderSuggestionsTool(BaseTool):
    """Suggest what to reorder based on stock levels and sales."""
    
    name = "get_reorder_suggestions"
    description = "Get intelligent reorder suggestions based on stock and sales velocity"
    
    async def execute(
        self,
        days_to_analyze: int = 30,
        safety_stock_days: int = 14,
        limit: int = 20
    ) -> ToolResult:
        """
        Get reorder suggestions.
        
        Args:
            days_to_analyze: Days of sales history to analyze
            safety_stock_days: Days of safety stock to maintain
            limit: Number of suggestions
        """
        cutoff = datetime.utcnow() - timedelta(days=days_to_analyze)
        
        query = '''
            WITH sales_data AS (
                SELECT 
                    oi.product_id,
                    COALESCE(SUM(oi.quantity), 0) as units_sold
                FROM "OrderItem" oi
                JOIN "Order" o ON o.order_id = oi.order_id
                JOIN "Product" p ON p.product_id = oi.product_id
                WHERE p.org_id = $1 AND o.order_date >= $2
                GROUP BY oi.product_id
            ),
            stock_data AS (
                SELECT 
                    product_id,
                    COALESCE(SUM(quantity), 0) as current_stock
                FROM "ProductStock"
                GROUP BY product_id
            )
            SELECT 
                p.product_id,
                p.name,
                p.sku,
                COALESCE(sd.units_sold, 0) as units_sold,
                COALESCE(st.current_stock, 0) as current_stock,
                ROUND(COALESCE(sd.units_sold, 0)::numeric / $3, 2) as daily_velocity,
                pp.actual_price
            FROM "Product" p
            LEFT JOIN sales_data sd ON sd.product_id = p.product_id
            LEFT JOIN stock_data st ON st.product_id = p.product_id
            LEFT JOIN "ProductPrice" pp ON pp.product_id = p.product_id
            WHERE p.org_id = $1 
              AND p.status = 'active'
              AND COALESCE(sd.units_sold, 0) > 0
            ORDER BY 
                CASE WHEN st.current_stock > 0 AND sd.units_sold > 0 
                     THEN st.current_stock::numeric / (sd.units_sold::numeric / $3)
                     ELSE 9999 
                END
            LIMIT $4
        '''
        
        results = await self.query(
            query, 
            int(self.org_id), 
            cutoff, 
            days_to_analyze,
            limit
        )
        
        suggestions = []
        total_reorder_value = 0
        
        for row in results:
            current_stock = row["current_stock"]
            daily_velocity = float(row["daily_velocity"])
            price = float(row["actual_price"] or 0)
            
            if daily_velocity > 0:
                days_of_stock = current_stock / daily_velocity
                # Suggest ordering enough for 30 days + safety stock
                target_stock = int(daily_velocity * (30 + safety_stock_days))
                reorder_qty = max(0, target_stock - current_stock)
                reorder_value = reorder_qty * price
                
                if reorder_qty > 0:
                    urgency = "critical" if days_of_stock < 7 else "high" if days_of_stock < 14 else "normal"
                    
                    suggestions.append({
                        "product_id": str(row["product_id"]),
                        "name": row["name"],
                        "sku": row["sku"],
                        "current_stock": current_stock,
                        "daily_velocity": daily_velocity,
                        "days_of_stock": round(days_of_stock, 1),
                        "suggested_reorder_qty": reorder_qty,
                        "estimated_value": round(reorder_value, 2),
                        "urgency": urgency
                    })
                    total_reorder_value += reorder_value
        
        return ToolResult(success=True, data={
            "suggestions": suggestions,
            "total_items": len(suggestions),
            "total_reorder_value": round(total_reorder_value, 2),
            "safety_stock_days": safety_stock_days
        })


class GetSalesForecastTool(BaseTool):
    """Predict future sales based on historical trends."""
    
    name = "get_sales_forecast"
    description = "Forecast future sales based on historical trends"
    
    async def execute(
        self,
        days_to_analyze: int = 90,
        forecast_days: int = 30
    ) -> ToolResult:
        """
        Forecast sales.
        
        Args:
            days_to_analyze: Days of history to analyze
            forecast_days: Days to forecast
        """
        cutoff = datetime.utcnow() - timedelta(days=days_to_analyze)
        
        # Get daily sales data
        query = '''
            SELECT 
                DATE_TRUNC('day', order_date) as date,
                COUNT(*) as order_count,
                COALESCE(SUM(total_amount), 0) as revenue
            FROM "Order"
            WHERE org_id = $1 AND order_date >= $2
            GROUP BY DATE_TRUNC('day', order_date)
            ORDER BY date
        '''
        
        results = await self.query(query, int(self.org_id), cutoff)
        
        if not results:
            return ToolResult(success=True, data={
                "message": "Not enough historical data for forecasting",
                "days_analyzed": 0
            })
        
        # Calculate averages
        total_revenue = sum(float(r["revenue"]) for r in results)
        total_orders = sum(r["order_count"] for r in results)
        days_with_data = len(results)
        
        avg_daily_revenue = total_revenue / days_with_data if days_with_data > 0 else 0
        avg_daily_orders = total_orders / days_with_data if days_with_data > 0 else 0
        
        # Simple linear trend (last 30 days vs previous 30 days)
        if days_to_analyze >= 60:
            mid_point = len(results) // 2
            first_half = results[:mid_point]
            second_half = results[mid_point:]
            
            first_avg = sum(float(r["revenue"]) for r in first_half) / len(first_half) if first_half else 0
            second_avg = sum(float(r["revenue"]) for r in second_half) / len(second_half) if second_half else 0
            
            if first_avg > 0:
                trend_pct = ((second_avg - first_avg) / first_avg) * 100
            else:
                trend_pct = 0
        else:
            trend_pct = 0
        
        # Forecast
        forecasted_revenue = avg_daily_revenue * forecast_days
        forecasted_orders = int(avg_daily_orders * forecast_days)
        
        # Apply trend adjustment
        if trend_pct != 0:
            adjustment = 1 + (trend_pct / 100) * 0.5  # Dampen the trend
            forecasted_revenue *= adjustment
            forecasted_orders = int(forecasted_orders * adjustment)
        
        return ToolResult(success=True, data={
            "historical": {
                "days_analyzed": days_with_data,
                "total_revenue": round(total_revenue, 2),
                "total_orders": total_orders,
                "avg_daily_revenue": round(avg_daily_revenue, 2),
                "avg_daily_orders": round(avg_daily_orders, 1)
            },
            "trend": {
                "direction": "up" if trend_pct > 5 else "down" if trend_pct < -5 else "stable",
                "change_percent": round(trend_pct, 1)
            },
            "forecast": {
                "period_days": forecast_days,
                "expected_revenue": round(forecasted_revenue, 2),
                "expected_orders": forecasted_orders,
                "confidence": "medium" if days_with_data >= 30 else "low"
            }
        })


# Export forecasting tools
FORECASTING_TOOLS = [
    GetStockForecastTool,
    GetReorderSuggestionsTool,
    GetSalesForecastTool,
]


def get_forecasting_tools(auth: AuthContext) -> list[BaseTool]:
    """Get instantiated forecasting tools for user."""
    return [ToolClass(auth) for ToolClass in FORECASTING_TOOLS]
