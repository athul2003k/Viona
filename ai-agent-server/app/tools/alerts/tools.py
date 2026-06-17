"""
Alerts & Reporting Tools

Tools for proactive alerts, anomaly detection, and health reporting.
All queries are org-scoped and read-only.
"""

from typing import Optional
from datetime import datetime, timedelta
import statistics

from app.tools import BaseTool, ToolResult
from app.auth import AuthContext


class LowStockAlertsTool(BaseTool):
    """Get critical and warning low stock alerts."""
    
    name = "low_stock_alerts"
    description = "Get low stock alerts with severity levels and stockout estimates"
    
    async def execute(
        self,
        critical_threshold: int = 5,
        warning_threshold: int = 15
    ) -> ToolResult:
        """
        Get low stock alerts.
        
        Args:
            critical_threshold: Stock level for critical alert (default 5)
            warning_threshold: Stock level for warning alert (default 15)
        """
        # Get products with low stock and their sales velocity
        query = '''
            WITH stock_velocity AS (
                SELECT 
                    p.product_id,
                    COALESCE(SUM(oi.quantity), 0) / 30.0 as daily_sales
                FROM "Product" p
                LEFT JOIN "OrderItem" oi ON oi.product_id = p.product_id
                LEFT JOIN "Order" o ON o.order_id = oi.order_id 
                    AND o.order_date >= NOW() - INTERVAL '30 days'
                WHERE p.org_id = $1
                GROUP BY p.product_id
            )
            SELECT 
                p.product_id,
                p.name,
                p.sku,
                w.name as warehouse_name,
                COALESCE(ps.quantity, 0) as quantity,
                COALESCE(sv.daily_sales, 0) as daily_sales
            FROM "Product" p
            LEFT JOIN "ProductStock" ps ON ps.product_id = p.product_id
            LEFT JOIN "Warehouse" w ON w.warehouse_id = ps.warehouse_id
            LEFT JOIN stock_velocity sv ON sv.product_id = p.product_id
            WHERE p.org_id = $1 AND COALESCE(ps.quantity, 0) <= $2
            ORDER BY ps.quantity ASC
        '''
        
        results = await self.query(query, int(self.org_id), warning_threshold)
        
        critical_alerts = []
        warning_alerts = []
        
        for row in results:
            qty = int(row["quantity"])
            daily_sales = float(row["daily_sales"] or 0)
            
            # Calculate days until stockout
            if daily_sales > 0:
                days_until_stockout = round(qty / daily_sales, 1)
            else:
                days_until_stockout = None
            
            alert = {
                "product_id": str(row["product_id"]),
                "name": row["name"],
                "sku": row["sku"],
                "warehouse": row["warehouse_name"],
                "quantity": qty,
                "daily_sales": round(daily_sales, 2),
                "days_until_stockout": days_until_stockout
            }
            
            if qty <= critical_threshold:
                alert["severity"] = "critical"
                critical_alerts.append(alert)
            else:
                alert["severity"] = "warning"
                warning_alerts.append(alert)
        
        return ToolResult(success=True, data={
            "critical_alerts": critical_alerts,
            "warning_alerts": warning_alerts,
            "critical_count": len(critical_alerts),
            "warning_count": len(warning_alerts),
            "critical_threshold": critical_threshold,
            "warning_threshold": warning_threshold
        })


class SalesAnomalyDetectionTool(BaseTool):
    """Detect unusual sales patterns - spikes or drops."""
    
    name = "sales_anomaly_detection"
    description = "Detect unusual sales patterns like sudden spikes or drops"
    
    async def execute(
        self,
        sensitivity: str = "medium",
        days: int = 30
    ) -> ToolResult:
        """
        Detect sales anomalies.
        
        Args:
            sensitivity: 'low', 'medium', or 'high' (default medium)
            days: Days to analyze (default 30)
        """
        # Sensitivity thresholds (standard deviations)
        thresholds = {"low": 2.5, "medium": 2.0, "high": 1.5}
        threshold = thresholds.get(sensitivity, 2.0)
        
        cutoff = datetime.utcnow() - timedelta(days=days)
        
        # Get daily sales
        query = '''
            SELECT 
                DATE_TRUNC('day', order_date) as day,
                COUNT(*) as order_count,
                COALESCE(SUM(total_amount), 0) as revenue
            FROM "Order"
            WHERE org_id = $1 AND order_date >= $2
            GROUP BY DATE_TRUNC('day', order_date)
            ORDER BY day
        '''
        
        results = await self.query(query, int(self.org_id), cutoff)
        
        if len(results) < 5:
            return ToolResult(success=True, data={
                "anomalies": [],
                "message": "Insufficient data for anomaly detection (need at least 5 days)",
                "days_analyzed": len(results)
            })
        
        revenues = [float(r["revenue"]) for r in results]
        mean_revenue = statistics.mean(revenues)
        std_dev = statistics.stdev(revenues) if len(revenues) > 1 else 0
        
        anomalies = []
        for row in results:
            revenue = float(row["revenue"])
            
            if std_dev > 0:
                z_score = (revenue - mean_revenue) / std_dev
            else:
                z_score = 0
            
            if abs(z_score) >= threshold:
                anomaly_type = "spike" if z_score > 0 else "drop"
                deviation_pct = ((revenue - mean_revenue) / mean_revenue * 100) if mean_revenue > 0 else 0
                
                anomalies.append({
                    "date": row["day"].isoformat()[:10] if row["day"] else None,
                    "type": anomaly_type,
                    "revenue": revenue,
                    "expected_revenue": round(mean_revenue, 2),
                    "deviation_percentage": round(deviation_pct, 1),
                    "order_count": row["order_count"],
                    "z_score": round(z_score, 2)
                })
        
        # Sort by deviation
        anomalies.sort(key=lambda x: abs(x["deviation_percentage"]), reverse=True)
        
        return ToolResult(success=True, data={
            "anomalies": anomalies,
            "anomaly_count": len(anomalies),
            "sensitivity": sensitivity,
            "average_daily_revenue": round(mean_revenue, 2),
            "std_deviation": round(std_dev, 2),
            "days_analyzed": len(results)
        })


class RevenueGoalTrackingTool(BaseTool):
    """Track revenue against targets or previous periods."""
    
    name = "revenue_goal_tracking"
    description = "Track revenue progress against goals or compare to previous periods"
    
    async def execute(
        self,
        period: str = "month",
        target: Optional[float] = None
    ) -> ToolResult:
        """
        Track revenue against goals.
        
        Args:
            period: 'day', 'week', 'month', or 'quarter' (default month)
            target: Optional revenue target (if not set, compares to previous period)
        """
        now = datetime.utcnow()
        
        # Calculate period boundaries
        period_days = {
            "day": 1,
            "week": 7,
            "month": 30,
            "quarter": 90
        }
        days = period_days.get(period, 30)
        
        current_start = now - timedelta(days=days)
        previous_start = current_start - timedelta(days=days)
        
        # Get current period revenue
        current_query = '''
            SELECT 
                COALESCE(SUM(total_amount), 0) as revenue,
                COUNT(*) as order_count
            FROM "Order"
            WHERE org_id = $1 AND order_date >= $2 AND order_date < $3
        '''
        
        current_result = await self.query_one(
            current_query, int(self.org_id), current_start, now
        )
        
        current_revenue = float(current_result["revenue"]) if current_result else 0
        current_orders = current_result["order_count"] if current_result else 0
        
        # Get previous period for comparison
        previous_result = await self.query_one(
            current_query, int(self.org_id), previous_start, current_start
        )
        
        previous_revenue = float(previous_result["revenue"]) if previous_result else 0
        
        # Calculate progress
        if target:
            progress_pct = (current_revenue / target * 100) if target > 0 else 0
            remaining = max(0, target - current_revenue)
            comparison_base = target
            comparison_label = "target"
        else:
            progress_pct = ((current_revenue / previous_revenue * 100) 
                          if previous_revenue > 0 else 100)
            remaining = None
            comparison_base = previous_revenue
            comparison_label = "previous_period"
        
        # Determine status
        if target:
            days_elapsed = days  # Simplified - assume full period
            daily_rate_needed = remaining / max(1, days - days_elapsed) if remaining else 0
            current_daily_rate = current_revenue / max(1, days_elapsed)
            
            if progress_pct >= 100:
                status = "achieved"
            elif current_daily_rate >= daily_rate_needed * 0.9:
                status = "on_track"
            elif current_daily_rate >= daily_rate_needed * 0.7:
                status = "at_risk"
            else:
                status = "behind"
        else:
            if progress_pct >= 110:
                status = "exceeding"
            elif progress_pct >= 90:
                status = "on_par"
            else:
                status = "below"
        
        # Calculate period-over-period change
        if previous_revenue > 0:
            pop_change = ((current_revenue - previous_revenue) / previous_revenue) * 100
        else:
            pop_change = 100 if current_revenue > 0 else 0
        
        return ToolResult(success=True, data={
            "period": period,
            "current_revenue": round(current_revenue, 2),
            "current_orders": current_orders,
            "comparison_base": round(comparison_base, 2),
            "comparison_type": comparison_label,
            "progress_percentage": round(progress_pct, 1),
            "remaining_to_goal": round(remaining, 2) if remaining is not None else None,
            "status": status,
            "period_over_period_change": round(pop_change, 1),
            "previous_period_revenue": round(previous_revenue, 2)
        })


class InventoryHealthReportTool(BaseTool):
    """Generate comprehensive inventory health score and report."""
    
    name = "inventory_health_report"
    description = "Get comprehensive inventory health score with category breakdown"
    
    async def execute(self) -> ToolResult:
        """Generate inventory health report for the organization."""
        
        # Get comprehensive inventory data
        query = '''
            WITH product_sales AS (
                SELECT 
                    p.product_id,
                    COALESCE(SUM(oi.quantity), 0) as units_sold_90d
                FROM "Product" p
                LEFT JOIN "OrderItem" oi ON oi.product_id = p.product_id
                LEFT JOIN "Order" o ON o.order_id = oi.order_id 
                    AND o.order_date >= NOW() - INTERVAL '90 days'
                WHERE p.org_id = $1
                GROUP BY p.product_id
            )
            SELECT 
                p.product_id,
                p.name,
                p.sku,
                COALESCE(SUM(ps.quantity), 0) as total_stock,
                COALESCE(psl.units_sold_90d, 0) as units_sold_90d
            FROM "Product" p
            LEFT JOIN "ProductStock" ps ON ps.product_id = p.product_id
            LEFT JOIN product_sales psl ON psl.product_id = p.product_id
            WHERE p.org_id = $1
            GROUP BY p.product_id, p.name, p.sku, psl.units_sold_90d
        '''
        
        results = await self.query(query, int(self.org_id))
        
        # Categorize products
        categories = {
            "critical_low": [],    # Stock <= 5 and selling
            "low_stock": [],       # Stock 6-15 and selling  
            "healthy": [],         # Adequate stock with turnover
            "overstock": [],       # High stock, low turnover
            "dead_stock": []       # No sales in 90 days
        }
        
        total_products = 0
        total_stock_value = 0
        
        for row in results:
            stock = int(row["total_stock"] or 0)
            sales_90d = int(row["units_sold_90d"] or 0)
            daily_velocity = sales_90d / 90.0
            
            # Calculate days of stock
            days_of_stock = stock / daily_velocity if daily_velocity > 0 else float('inf')
            
            product_info = {
                "product_id": str(row["product_id"]),
                "name": row["name"],
                "sku": row["sku"],
                "stock": stock,
                "sales_90d": sales_90d,
                "days_of_stock": round(days_of_stock, 1) if days_of_stock != float('inf') else None
            }
            
            total_products += 1
            
            # Categorize
            if sales_90d == 0 and stock > 0:
                categories["dead_stock"].append(product_info)
            elif stock <= 5 and sales_90d > 0:
                categories["critical_low"].append(product_info)
            elif stock <= 15 and sales_90d > 0:
                categories["low_stock"].append(product_info)
            elif days_of_stock > 180:  # >6 months of stock
                categories["overstock"].append(product_info)
            else:
                categories["healthy"].append(product_info)
        
        # Calculate health score (0-100)
        if total_products > 0:
            healthy_pct = len(categories["healthy"]) / total_products
            low_stock_penalty = len(categories["critical_low"]) * 3 + len(categories["low_stock"]) * 1
            dead_stock_penalty = len(categories["dead_stock"]) * 2
            overstock_penalty = len(categories["overstock"]) * 1
            
            base_score = healthy_pct * 100
            penalties = min(50, low_stock_penalty + dead_stock_penalty + overstock_penalty)
            health_score = max(0, round(base_score - penalties))
        else:
            health_score = 0
        
        # Generate recommendations
        recommendations = []
        if categories["critical_low"]:
            recommendations.append(
                f"URGENT: {len(categories['critical_low'])} products critically low on stock"
            )
        if categories["dead_stock"]:
            recommendations.append(
                f"Consider promotions for {len(categories['dead_stock'])} dead stock items"
            )
        if categories["overstock"]:
            recommendations.append(
                f"Review {len(categories['overstock'])} overstocked items - consider reducing orders"
            )
        if health_score >= 80:
            recommendations.append("Overall inventory health is good!")
        
        return ToolResult(success=True, data={
            "health_score": health_score,
            "health_grade": self._score_to_grade(health_score),
            "total_products": total_products,
            "category_counts": {
                "critical_low": len(categories["critical_low"]),
                "low_stock": len(categories["low_stock"]),
                "healthy": len(categories["healthy"]),
                "overstock": len(categories["overstock"]),
                "dead_stock": len(categories["dead_stock"])
            },
            "critical_items": categories["critical_low"][:5],
            "dead_stock_items": categories["dead_stock"][:5],
            "recommendations": recommendations
        })
    
    def _score_to_grade(self, score: int) -> str:
        """Convert score to letter grade."""
        if score >= 90:
            return "A"
        elif score >= 80:
            return "B"
        elif score >= 70:
            return "C"
        elif score >= 60:
            return "D"
        else:
            return "F"


# Export all tools
ALERTS_TOOLS = [
    LowStockAlertsTool,
    SalesAnomalyDetectionTool,
    RevenueGoalTrackingTool,
    InventoryHealthReportTool,
]


def get_alerts_tools(auth: AuthContext) -> list[BaseTool]:
    """Get instantiated alerts tools for user."""
    return [ToolClass(auth) for ToolClass in ALERTS_TOOLS]
