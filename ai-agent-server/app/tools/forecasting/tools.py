"""
Forecasting & Intelligence Tools

Tools for predictive analytics, trend detection, and demand forecasting.
All queries are org-scoped and read-only.
"""

from typing import Optional
from datetime import datetime, timedelta
from decimal import Decimal
import statistics

from app.tools import BaseTool, ToolResult
from app.auth import AuthContext


class DemandForecastTool(BaseTool):
    """Predict future demand for products based on historical sales data."""
    
    name = "demand_forecast"
    description = "Predict future product demand using historical sales data and moving averages. Use product name to filter."
    
    async def _lookup_product_id(self, product_name: str) -> Optional[int]:
        """Look up product ID by name (fuzzy match)."""
        # Try exact match first
        product = await self.query_one(
            '''SELECT product_id FROM "Product" 
               WHERE org_id = $1 AND LOWER(name) = LOWER($2)''',
            int(self.org_id), product_name
        )
        if product:
            return product["product_id"]
        
        # Try ILIKE fuzzy match
        product = await self.query_one(
            '''SELECT product_id FROM "Product" 
               WHERE org_id = $1 AND name ILIKE $2
               ORDER BY LENGTH(name) ASC
               LIMIT 1''',
            int(self.org_id), f"%{product_name}%"
        )
        return product["product_id"] if product else None
    
    async def execute(
        self,
        product_name: Optional[str] = None,
        days_ahead: int = 30,
        lookback_days: int = 90
    ) -> ToolResult:
        """
        Forecast demand for products.
        
        Args:
            product_name: Specific product name to forecast (None = top products)
            days_ahead: Days to forecast ahead (default 30)
            lookback_days: Historical days to analyze (default 90)
        """
        cutoff = datetime.utcnow() - timedelta(days=lookback_days)
        
        # Look up product_id from name if provided
        product_id = None
        if product_name:
            product_id = await self._lookup_product_id(product_name)
            if not product_id:
                return ToolResult(success=False, error=f"Product '{product_name}' not found")
        
        # Get historical sales data
        base_query = '''
            SELECT 
                p.product_id,
                p.name,
                p.sku,
                DATE_TRUNC('week', o.order_date) as week_start,
                COALESCE(SUM(oi.quantity), 0) as units_sold
            FROM "Product" p
            LEFT JOIN "OrderItem" oi ON oi.product_id = p.product_id
            LEFT JOIN "Order" o ON o.order_id = oi.order_id 
                AND o.order_date >= $2
            WHERE p.org_id = $1
        '''
        args = [int(self.org_id), cutoff]
        param_idx = 3
        
        if product_id:
            base_query += f' AND p.product_id = ${param_idx}'
            args.append(product_id)
            param_idx += 1
        
        base_query += '''
            GROUP BY p.product_id, p.name, p.sku, DATE_TRUNC('week', o.order_date)
            ORDER BY p.product_id, week_start
        '''
        
        results = await self.query(base_query, *args)
        
        # Group by product and calculate forecasts
        products_data = {}
        for row in results:
            pid = str(row["product_id"])
            if pid not in products_data:
                products_data[pid] = {
                    "product_id": pid,
                    "name": row["name"],
                    "sku": row["sku"],
                    "weekly_sales": []
                }
            if row["week_start"]:
                products_data[pid]["weekly_sales"].append(row["units_sold"])
        
        forecasts = []
        for pid, data in products_data.items():
            weekly_sales = data["weekly_sales"] or [0]
            
            # Simple moving average forecast
            avg_weekly = statistics.mean(weekly_sales) if weekly_sales else 0
            std_dev = statistics.stdev(weekly_sales) if len(weekly_sales) > 1 else 0
            
            # Calculate trend (compare recent vs older)
            if len(weekly_sales) >= 4:
                recent_avg = statistics.mean(weekly_sales[-2:])
                older_avg = statistics.mean(weekly_sales[:2])
                if older_avg > 0:
                    trend_pct = ((recent_avg - older_avg) / older_avg) * 100
                else:
                    trend_pct = 100 if recent_avg > 0 else 0
            else:
                trend_pct = 0
            
            # Project forward
            weeks_ahead = days_ahead / 7
            predicted_units = round(avg_weekly * weeks_ahead)
            confidence_low = max(0, round((avg_weekly - std_dev) * weeks_ahead))
            confidence_high = round((avg_weekly + std_dev) * weeks_ahead)
            
            # Determine trend direction
            if trend_pct > 10:
                trend_direction = "increasing"
            elif trend_pct < -10:
                trend_direction = "decreasing"
            else:
                trend_direction = "stable"
            
            forecasts.append({
                "product_id": pid,
                "name": data["name"],
                "sku": data["sku"],
                "predicted_units": predicted_units,
                "confidence_range": [confidence_low, confidence_high],
                "trend_direction": trend_direction,
                "trend_percentage": round(trend_pct, 1),
                "avg_weekly_sales": round(avg_weekly, 1)
            })
        
        # Sort by predicted demand
        forecasts.sort(key=lambda x: x["predicted_units"], reverse=True)
        
        return ToolResult(success=True, data={
            "forecasts": forecasts[:20],
            "forecast_period_days": days_ahead,
            "lookback_days": lookback_days,
            "total_products_analyzed": len(forecasts)
        })


class TrendAnalysisTool(BaseTool):
    """Analyze revenue, order, and unit trends over time."""
    
    name = "trend_analysis"
    description = "Identify sales/revenue trends and compare periods"
    
    async def execute(
        self,
        metric: str = "revenue",
        period: str = "week",
        comparison_periods: int = 4
    ) -> ToolResult:
        """
        Analyze trends for a metric.
        
        Args:
            metric: 'revenue', 'orders', or 'units'
            period: 'day', 'week', or 'month'
            comparison_periods: Number of periods to compare
        """
        # Calculate date ranges
        period_days = {"day": 1, "week": 7, "month": 30}
        days_per_period = period_days.get(period, 7)
        total_days = days_per_period * comparison_periods * 2  # Double for comparison
        
        cutoff = datetime.utcnow() - timedelta(days=total_days)
        
        # Validate metric and period via safe allowlists
        SAFE_METRICS = {
            "revenue": ("COALESCE(SUM(total_amount), 0)", "Revenue"),
            "orders": ("COUNT(*)", "Orders"),
            "units": ("COALESCE(SUM(oi.quantity), 0)", "Units Sold"),
        }
        SAFE_DATE_TRUNCS = {"day": "day", "week": "week", "month": "month"}
        
        metric_entry = SAFE_METRICS.get(metric)
        if not metric_entry:
            return ToolResult(success=False, error=f"Invalid metric: {metric}. Use 'revenue', 'orders', or 'units'.")
        metric_sql, metric_label = metric_entry
        
        date_trunc = SAFE_DATE_TRUNCS.get(period)
        if not date_trunc:
            return ToolResult(success=False, error=f"Invalid period: {period}. Use 'day', 'week', or 'month'.")
        
        if metric == "units":
            query = f'''
                SELECT 
                    DATE_TRUNC('{date_trunc}', o.order_date) as period_start,
                    {metric_sql} as value
                FROM "Order" o
                LEFT JOIN "OrderItem" oi ON oi.order_id = o.order_id
                WHERE o.org_id = $1 AND o.order_date >= $2
                GROUP BY DATE_TRUNC('{date_trunc}', o.order_date)
                ORDER BY period_start
            '''
        else:
            query = f'''
                SELECT 
                    DATE_TRUNC('{date_trunc}', order_date) as period_start,
                    {metric_sql} as value
                FROM "Order"
                WHERE org_id = $1 AND order_date >= $2
                GROUP BY DATE_TRUNC('{date_trunc}', order_date)
                ORDER BY period_start
            '''
        
        results = await self.query(query, int(self.org_id), cutoff)
        
        values = [float(r["value"]) for r in results if r["period_start"]]
        
        if len(values) < 2:
            return ToolResult(success=True, data={
                "trend_direction": "insufficient_data",
                "message": "Not enough historical data to determine trend",
                "periods_analyzed": len(values)
            })
        
        # Split into recent vs older periods
        mid = len(values) // 2
        older_values = values[:mid] or [0]
        recent_values = values[mid:] or [0]
        
        older_avg = statistics.mean(older_values)
        recent_avg = statistics.mean(recent_values)
        
        # Calculate percentage change
        if older_avg > 0:
            pct_change = ((recent_avg - older_avg) / older_avg) * 100
        else:
            pct_change = 100 if recent_avg > 0 else 0
        
        # Determine trend
        if pct_change > 15:
            trend_direction = "strong_uptrend"
        elif pct_change > 5:
            trend_direction = "uptrend"
        elif pct_change < -15:
            trend_direction = "strong_downtrend"
        elif pct_change < -5:
            trend_direction = "downtrend"
        else:
            trend_direction = "stable"
        
        # Build period data
        period_data = [
            {
                "period": r["period_start"].isoformat()[:10] if r["period_start"] else None,
                "value": float(r["value"])
            }
            for r in results[-comparison_periods:]
        ]
        
        return ToolResult(success=True, data={
            "metric": metric_label,
            "period_type": period,
            "trend_direction": trend_direction,
            "percentage_change": round(pct_change, 1),
            "recent_average": round(recent_avg, 2),
            "previous_average": round(older_avg, 2),
            "recent_periods": period_data,
            "periods_analyzed": len(values)
        })


class SeasonalityDetectionTool(BaseTool):
    """Detect day-of-week and monthly sales patterns."""
    
    name = "seasonality_detection"
    description = "Detect day-of-week and monthly patterns in sales"
    
    async def execute(self, days: int = 90) -> ToolResult:
        """
        Detect seasonal patterns.
        
        Args:
            days: Historical days to analyze (default 90)
        """
        cutoff = datetime.utcnow() - timedelta(days=days)
        
        # Day of week analysis
        dow_query = '''
            SELECT 
                EXTRACT(DOW FROM order_date) as day_of_week,
                COUNT(*) as order_count,
                COALESCE(SUM(total_amount), 0) as revenue
            FROM "Order"
            WHERE org_id = $1 AND order_date >= $2
            GROUP BY EXTRACT(DOW FROM order_date)
            ORDER BY day_of_week
        '''
        
        dow_results = await self.query(dow_query, int(self.org_id), cutoff)
        
        day_names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
        daily_patterns = []
        
        for row in dow_results:
            dow = int(row["day_of_week"])
            daily_patterns.append({
                "day": day_names[dow],
                "day_index": dow,
                "orders": row["order_count"],
                "revenue": float(row["revenue"])
            })
        
        # Find best and worst days
        if daily_patterns:
            best_day = max(daily_patterns, key=lambda x: x["revenue"])
            worst_day = min(daily_patterns, key=lambda x: x["revenue"])
        else:
            best_day = worst_day = None
        
        # Monthly/weekly pattern (for longer periods)
        weekly_query = '''
            SELECT 
                DATE_TRUNC('week', order_date) as week_start,
                COUNT(*) as order_count,
                COALESCE(SUM(total_amount), 0) as revenue
            FROM "Order"
            WHERE org_id = $1 AND order_date >= $2
            GROUP BY DATE_TRUNC('week', order_date)
            ORDER BY week_start
        '''
        
        weekly_results = await self.query(weekly_query, int(self.org_id), cutoff)
        
        weekly_revenues = [float(r["revenue"]) for r in weekly_results if r["week_start"]]
        
        # Detect if there are peaks
        if len(weekly_revenues) >= 3:
            avg_revenue = statistics.mean(weekly_revenues)
            peak_weeks = [i for i, r in enumerate(weekly_revenues) if r > avg_revenue * 1.5]
            has_peaks = len(peak_weeks) > 0
        else:
            has_peaks = False
            peak_weeks = []
        
        return ToolResult(success=True, data={
            "daily_patterns": daily_patterns,
            "best_day": best_day,
            "worst_day": worst_day,
            "has_weekly_peaks": has_peaks,
            "peak_week_indices": peak_weeks,
            "analysis_period_days": days,
            "insights": self._generate_insights(daily_patterns, best_day, worst_day)
        })
    
    def _generate_insights(self, patterns, best, worst) -> list[str]:
        """Generate human-readable insights."""
        insights = []
        if best and worst:
            if best["revenue"] > worst["revenue"] * 2:
                insights.append(
                    f"{best['day']} generates significantly more revenue than {worst['day']}"
                )
            insights.append(
                f"Peak sales day: {best['day']} (${best['revenue']:,.2f})"
            )
        return insights


class ReorderPointCalculatorTool(BaseTool):
    """Calculate optimal reorder points based on demand and lead time."""
    
    name = "reorder_point_calculator"
    description = "Calculate optimal reorder points for products. Use product name to filter."
    
    async def _lookup_product_id(self, product_name: str) -> Optional[int]:
        """Look up product ID by name (fuzzy match)."""
        # Try exact match first
        product = await self.query_one(
            '''SELECT product_id FROM "Product" 
               WHERE org_id = $1 AND LOWER(name) = LOWER($2)''',
            int(self.org_id), product_name
        )
        if product:
            return product["product_id"]
        
        # Try ILIKE fuzzy match
        product = await self.query_one(
            '''SELECT product_id FROM "Product" 
               WHERE org_id = $1 AND name ILIKE $2
               ORDER BY LENGTH(name) ASC
               LIMIT 1''',
            int(self.org_id), f"%{product_name}%"
        )
        return product["product_id"] if product else None
    
    async def execute(
        self,
        product_name: Optional[str] = None,
        lead_time_days: int = 7,
        safety_stock_days: int = 3,
        limit: int = 20
    ) -> ToolResult:
        """
        Calculate reorder points.
        
        Args:
            product_name: Specific product name (None = all products)
            lead_time_days: Supplier lead time (default 7)
            safety_stock_days: Buffer stock days (default 3)
            limit: Max products to return
        """
        # Look up product_id from name if provided
        product_id = None
        if product_name:
            product_id = await self._lookup_product_id(product_name)
            if not product_id:
                return ToolResult(success=False, error=f"Product '{product_name}' not found")
        
        # Get average daily sales and current stock
        days_for_avg = 30
        cutoff = datetime.utcnow() - timedelta(days=days_for_avg)
        
        query = '''
            WITH daily_sales AS (
                SELECT 
                    p.product_id,
                    p.name,
                    p.sku,
                    COALESCE(SUM(oi.quantity), 0) / $2::float as avg_daily_units
                FROM "Product" p
                LEFT JOIN "OrderItem" oi ON oi.product_id = p.product_id
                LEFT JOIN "Order" o ON o.order_id = oi.order_id 
                    AND o.order_date >= $3
                WHERE p.org_id = $1
                GROUP BY p.product_id, p.name, p.sku
            )
            SELECT 
                ds.product_id,
                ds.name,
                ds.sku,
                ds.avg_daily_units,
                COALESCE(SUM(ps.quantity), 0) as current_stock
            FROM daily_sales ds
            LEFT JOIN "ProductStock" ps ON ps.product_id = ds.product_id
            GROUP BY ds.product_id, ds.name, ds.sku, ds.avg_daily_units
        '''
        
        args = [int(self.org_id), days_for_avg, cutoff]
        
        if product_id:
            query += f' HAVING ds.product_id = ${len(args) + 1}'
            args.append(product_id)
        
        results = await self.query(query, *args)
        
        reorder_analysis = []
        for row in results:
            avg_daily = float(row["avg_daily_units"] or 0)
            current_stock = int(row["current_stock"] or 0)
            
            # Calculate reorder point
            demand_during_lead = avg_daily * lead_time_days
            safety_stock = avg_daily * safety_stock_days
            reorder_point = round(demand_during_lead + safety_stock)
            
            # Calculate days until stockout
            days_until_stockout = round(current_stock / avg_daily) if avg_daily > 0 else float('inf')
            if days_until_stockout == float('inf'):
                days_until_stockout = None
            
            # Determine urgency
            if current_stock <= reorder_point * 0.5:
                urgency = "critical"
            elif current_stock <= reorder_point:
                urgency = "reorder_now"
            elif current_stock <= reorder_point * 1.5:
                urgency = "monitor"
            else:
                urgency = "healthy"
            
            reorder_analysis.append({
                "product_id": str(row["product_id"]),
                "name": row["name"],
                "sku": row["sku"],
                "current_stock": current_stock,
                "reorder_point": reorder_point,
                "avg_daily_demand": round(avg_daily, 2),
                "days_until_stockout": days_until_stockout,
                "urgency": urgency,
                "recommended_order_qty": max(0, reorder_point * 2 - current_stock)
            })
        
        # Sort by urgency
        urgency_order = {"critical": 0, "reorder_now": 1, "monitor": 2, "healthy": 3}
        reorder_analysis.sort(key=lambda x: urgency_order.get(x["urgency"], 99))
        
        # Count by urgency
        urgency_counts = {
            "critical": sum(1 for x in reorder_analysis if x["urgency"] == "critical"),
            "reorder_now": sum(1 for x in reorder_analysis if x["urgency"] == "reorder_now"),
            "monitor": sum(1 for x in reorder_analysis if x["urgency"] == "monitor"),
            "healthy": sum(1 for x in reorder_analysis if x["urgency"] == "healthy")
        }
        
        return ToolResult(success=True, data={
            "products": reorder_analysis[:limit],
            "urgency_summary": urgency_counts,
            "lead_time_days": lead_time_days,
            "safety_stock_days": safety_stock_days,
            "total_analyzed": len(reorder_analysis)
        })


# Export all tools
FORECASTING_TOOLS = [
    DemandForecastTool,
    TrendAnalysisTool,
    SeasonalityDetectionTool,
    ReorderPointCalculatorTool,
]


def get_forecasting_tools(auth: AuthContext) -> list[BaseTool]:
    """Get instantiated forecasting tools for user."""
    return [ToolClass(auth) for ToolClass in FORECASTING_TOOLS]
