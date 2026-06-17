"""
Analytics Alerts and Reporting Tools

Tools for generating alerts and summary reports.
"""

import logging
from typing import Optional
from datetime import datetime, timedelta

from app.tools import BaseTool, ToolResult
from app.auth import AuthContext

logger = logging.getLogger(__name__)


class GetAlertsTool(BaseTool):
    """Get all active business alerts."""
    
    name = "get_alerts"
    description = "Get active alerts for low stock, overdue orders, and anomalies"
    
    async def execute(
        self,
        low_stock_threshold: int = 10,
        overdue_days: int = 7
    ) -> ToolResult:
        """
        Get business alerts.
        
        Args:
            low_stock_threshold: Stock level to trigger low stock alert
            overdue_days: Days for order to be considered overdue
        """
        alerts = []
        
        # Low stock alerts
        low_stock_query = '''
            SELECT 
                p.product_id,
                p.name,
                p.sku,
                COALESCE(SUM(ps.quantity), 0) as total_stock
            FROM "Product" p
            LEFT JOIN "ProductStock" ps ON ps.product_id = p.product_id
            WHERE p.org_id = $1 AND p.status = 'active'
            GROUP BY p.product_id, p.name, p.sku
            HAVING COALESCE(SUM(ps.quantity), 0) <= $2
            ORDER BY total_stock ASC
            LIMIT 20
        '''
        
        low_stock = await self.query(low_stock_query, int(self.org_id), low_stock_threshold)
        
        for item in low_stock:
            severity = "critical" if item["total_stock"] == 0 else "warning"
            alerts.append({
                "type": "low_stock",
                "severity": severity,
                "title": f"Low Stock: {item['name']}",
                "message": f"SKU {item['sku']} has only {item['total_stock']} units remaining",
                "data": {
                    "product_id": str(item["product_id"]),
                    "sku": item["sku"],
                    "stock": item["total_stock"]
                }
            })
        
        # Overdue pending orders
        overdue_cutoff = datetime.utcnow() - timedelta(days=overdue_days)
        
        overdue_query = '''
            SELECT 
                order_id,
                customer_email,
                total_amount,
                order_date,
                status
            FROM "Order"
            WHERE org_id = $1 
              AND status = 'pending'
              AND order_date < $2
            ORDER BY order_date ASC
            LIMIT 20
        '''
        
        overdue_orders = await self.query(overdue_query, int(self.org_id), overdue_cutoff)
        
        for order in overdue_orders:
            days_old = (datetime.utcnow() - order["order_date"]).days
            alerts.append({
                "type": "overdue_order",
                "severity": "warning" if days_old < 14 else "critical",
                "title": f"Order #{order['order_id']} pending for {days_old} days",
                "message": f"Customer: {order['customer_email']}, Amount: ${float(order['total_amount']):,.2f}",
                "data": {
                    "order_id": str(order["order_id"]),
                    "days_pending": days_old,
                    "amount": float(order["total_amount"])
                }
            })
        
        # Out of stock items with recent sales (missed sales opportunity)
        missed_sales_query = '''
            WITH recent_sales AS (
                SELECT DISTINCT oi.product_id
                FROM "OrderItem" oi
                JOIN "Order" o ON o.order_id = oi.order_id
                WHERE o.org_id = $1 AND o.order_date >= $2
            ),
            zero_stock AS (
                SELECT p.product_id, p.name, p.sku
                FROM "Product" p
                LEFT JOIN "ProductStock" ps ON ps.product_id = p.product_id
                WHERE p.org_id = $1 AND p.status = 'active'
                GROUP BY p.product_id
                HAVING COALESCE(SUM(ps.quantity), 0) = 0
            )
            SELECT zs.* FROM zero_stock zs
            JOIN recent_sales rs ON rs.product_id = zs.product_id
            LIMIT 10
        '''
        
        cutoff_30_days = datetime.utcnow() - timedelta(days=30)
        missed_sales = await self.query(missed_sales_query, int(self.org_id), cutoff_30_days)
        
        for item in missed_sales:
            alerts.append({
                "type": "missed_sales",
                "severity": "warning",
                "title": f"Popular product out of stock: {item['name']}",
                "message": f"SKU {item['sku']} has recent sales but zero stock",
                "data": {
                    "product_id": str(item["product_id"]),
                    "sku": item["sku"]
                }
            })
        
        # Sort by severity
        severity_order = {"critical": 0, "warning": 1, "info": 2}
        alerts.sort(key=lambda x: severity_order.get(x["severity"], 3))
        
        return ToolResult(success=True, data={
            "alerts": alerts,
            "total_count": len(alerts),
            "critical_count": len([a for a in alerts if a["severity"] == "critical"]),
            "warning_count": len([a for a in alerts if a["severity"] == "warning"])
        })


class GenerateReportTool(BaseTool):
    """Generate a comprehensive business report."""
    
    name = "generate_report"
    description = "Generate a summary business report for a time period"
    
    async def execute(
        self,
        period_days: int = 30,
        report_type: str = "summary"  # summary, orders, inventory, revenue
    ) -> ToolResult:
        """
        Generate business report.
        
        Args:
            period_days: Report period in days
            report_type: Type of report (summary, orders, inventory, revenue)
        """
        cutoff = datetime.utcnow() - timedelta(days=period_days)
        
        report = {
            "period": {
                "days": period_days,
                "start_date": cutoff.strftime("%Y-%m-%d"),
                "end_date": datetime.utcnow().strftime("%Y-%m-%d")
            }
        }
        
        # Orders summary
        orders_query = '''
            SELECT 
                COUNT(*) as total_orders,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
                COUNT(CASE WHEN status = 'shipped' THEN 1 END) as shipped,
                COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled,
                COALESCE(SUM(total_amount), 0) as total_revenue,
                COALESCE(AVG(total_amount), 0) as avg_order_value,
                COUNT(DISTINCT customer_email) as unique_customers
            FROM "Order"
            WHERE org_id = $1 AND order_date >= $2
        '''
        
        orders = await self.query_one(orders_query, int(self.org_id), cutoff)
        
        report["orders"] = {
            "total": orders["total_orders"],
            "by_status": {
                "pending": orders["pending"],
                "completed": orders["completed"],
                "shipped": orders["shipped"],
                "cancelled": orders["cancelled"]
            },
            "unique_customers": orders["unique_customers"]
        }
        
        report["revenue"] = {
            "total": float(orders["total_revenue"]),
            "average_order": round(float(orders["avg_order_value"]), 2),
            "daily_average": round(float(orders["total_revenue"]) / period_days, 2)
        }
        
        # Top products
        top_products_query = '''
            SELECT 
                p.name,
                p.sku,
                SUM(oi.quantity) as units_sold,
                SUM(oi.quantity * oi.price_at_order) as revenue
            FROM "OrderItem" oi
            JOIN "Order" o ON o.order_id = oi.order_id
            JOIN "Product" p ON p.product_id = oi.product_id
            WHERE p.org_id = $1 AND o.order_date >= $2
            GROUP BY p.product_id, p.name, p.sku
            ORDER BY revenue DESC
            LIMIT 5
        '''
        
        top_products = await self.query(top_products_query, int(self.org_id), cutoff)
        
        report["top_products"] = [
            {
                "name": p["name"],
                "sku": p["sku"],
                "units_sold": p["units_sold"],
                "revenue": float(p["revenue"])
            }
            for p in top_products
        ]
        
        # Inventory summary
        inventory_query = '''
            SELECT 
                COUNT(DISTINCT p.product_id) as total_products,
                COALESCE(SUM(ps.quantity), 0) as total_stock,
                COUNT(CASE WHEN COALESCE(ps.quantity, 0) = 0 THEN 1 END) as out_of_stock,
                COUNT(CASE WHEN COALESCE(ps.quantity, 0) > 0 AND COALESCE(ps.quantity, 0) <= 10 THEN 1 END) as low_stock
            FROM "Product" p
            LEFT JOIN "ProductStock" ps ON ps.product_id = p.product_id
            WHERE p.org_id = $1 AND p.status = 'active'
        '''
        
        inventory = await self.query_one(inventory_query, int(self.org_id))
        
        report["inventory"] = {
            "total_products": inventory["total_products"],
            "total_units": inventory["total_stock"],
            "out_of_stock": inventory["out_of_stock"],
            "low_stock": inventory["low_stock"]
        }
        
        # Top customers
        customers_query = '''
            SELECT 
                customer_email,
                customer_name,
                COUNT(*) as order_count,
                SUM(total_amount) as total_spent
            FROM "Order"
            WHERE org_id = $1 AND order_date >= $2
            GROUP BY customer_email, customer_name
            ORDER BY total_spent DESC
            LIMIT 5
        '''
        
        top_customers = await self.query(customers_query, int(self.org_id), cutoff)
        
        report["top_customers"] = [
            {
                "email": c["customer_email"],
                "name": c["customer_name"],
                "orders": c["order_count"],
                "total_spent": float(c["total_spent"])
            }
            for c in top_customers
        ]
        
        return ToolResult(success=True, data=report)


# Export alerts tools
ALERTS_TOOLS = [
    GetAlertsTool,
    GenerateReportTool,
]


def get_alerts_tools(auth: AuthContext) -> list[BaseTool]:
    """Get instantiated alerts tools for user."""
    return [ToolClass(auth) for ToolClass in ALERTS_TOOLS]
