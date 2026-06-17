"""
Analytics Domain Tools

Tools for querying business analytics data.
All queries are org-scoped and read-only.
"""

from typing import Optional
from decimal import Decimal
from datetime import datetime, timedelta

from app.tools import BaseTool, ToolResult
from app.auth import AuthContext


class GetOrderSummaryTool(BaseTool):
    """Get order summary statistics for the organization."""
    
    name = "get_order_summary"
    description = "Get summary statistics for orders including total count, revenue, and average order value"
    
    async def execute(
        self,
        days: int = 30,
        status: Optional[str] = None
    ) -> ToolResult:
        """
        Get order summary for the organization.
        
        Args:
            days: Number of days to look back (default 30)
            status: Optional status filter
        """
        cutoff = datetime.utcnow() - timedelta(days=days)
        
        base_query = '''
            SELECT 
                COUNT(*) as total_orders,
                COALESCE(SUM(total_amount), 0) as total_revenue,
                COALESCE(AVG(total_amount), 0) as avg_order_value,
                COUNT(DISTINCT customer_email) as unique_customers
            FROM "Order"
            WHERE org_id = $1 AND order_date >= $2
        '''
        
        args = [int(self.org_id), cutoff]
        
        if status:
            base_query += ' AND status = $3'
            args.append(status)
        
        result = await self.query_one(base_query, *args)
        
        if not result:
            return ToolResult(success=True, data={
                "total_orders": 0,
                "total_revenue": 0,
                "avg_order_value": 0,
                "unique_customers": 0,
                "period_days": days
            })
        
        return ToolResult(success=True, data={
            "total_orders": result["total_orders"],
            "total_revenue": float(result["total_revenue"] or 0),
            "avg_order_value": float(result["avg_order_value"] or 0),
            "unique_customers": result["unique_customers"],
            "period_days": days
        })


class GetProductPerformanceTool(BaseTool):
    """Get product performance metrics."""
    
    name = "get_product_performance"
    description = "Get top performing products by revenue or quantity sold"
    
    async def execute(
        self,
        limit: int = 10,
        days: int = 30,
        sort_by: str = "revenue"
    ) -> ToolResult:
        """
        Get product performance metrics.
        
        Args:
            limit: Number of products to return
            days: Period in days
            sort_by: 'revenue' or 'quantity'
        """
        cutoff = datetime.utcnow() - timedelta(days=days)
        
        order_by = "total_revenue DESC" if sort_by == "revenue" else "total_quantity DESC"
        
        query = f'''
            SELECT 
                p.product_id,
                p.name,
                p.sku,
                COALESCE(SUM(oi.quantity), 0) as total_quantity,
                COALESCE(SUM(oi.quantity * oi.price_at_order), 0) as total_revenue
            FROM "Product" p
            INNER JOIN "OrderItem" oi ON oi.product_id = p.product_id
            INNER JOIN "Order" o ON o.order_id = oi.order_id
            WHERE p.org_id = $1 AND o.order_date >= $2
            GROUP BY p.product_id, p.name, p.sku
            ORDER BY {order_by}
            LIMIT $3
        '''
        
        results = await self.query(query, int(self.org_id), cutoff, limit)
        
        products = []
        for row in results:
            products.append({
                "product_id": str(row["product_id"]),
                "name": row["name"],
                "sku": row["sku"],
                "total_quantity": row["total_quantity"],
                "total_revenue": float(row["total_revenue"] or 0)
            })
        
        return ToolResult(success=True, data={
            "products": products,
            "period_days": days,
            "sort_by": sort_by
        })


class GetLeastSellingProductsTool(BaseTool):
    """Get least selling products - useful for identifying underperformers."""
    
    name = "get_least_selling_products"
    description = "Get products with the lowest sales by revenue or quantity - helps identify underperforming products"
    
    async def execute(
        self,
        limit: int = 10,
        days: int = 30,
        sort_by: str = "revenue"
    ) -> ToolResult:
        """
        Get least selling products.
        
        Args:
            limit: Number of products to return
            days: Period in days
            sort_by: 'revenue' or 'quantity'
        """
        cutoff = datetime.utcnow() - timedelta(days=days)
        
        SAFE_ORDER_BY = {
            "revenue": "total_revenue ASC",
            "quantity": "total_quantity ASC",
        }
        order_by = SAFE_ORDER_BY.get(sort_by, "total_revenue ASC")
        
        query = f'''
            SELECT 
                p.product_id,
                p.name,
                p.sku,
                COALESCE(SUM(oi.quantity), 0) as total_quantity,
                COALESCE(SUM(oi.quantity * oi.price_at_order), 0) as total_revenue
            FROM "Product" p
            LEFT JOIN "OrderItem" oi ON oi.product_id = p.product_id
            LEFT JOIN "Order" o ON o.order_id = oi.order_id 
                AND o.order_date >= $2
            WHERE p.org_id = $1
            GROUP BY p.product_id, p.name, p.sku
            ORDER BY {order_by}
            LIMIT $3
        '''
        
        results = await self.query(query, int(self.org_id), cutoff, limit)
        
        products = []
        for row in results:
            products.append({
                "product_id": str(row["product_id"]),
                "name": row["name"],
                "sku": row["sku"],
                "total_quantity": row["total_quantity"],
                "total_revenue": float(row["total_revenue"] or 0)
            })
        
        return ToolResult(success=True, data={
            "products": products,
            "period_days": days,
            "sort_by": sort_by,
            "note": "Products with zero or low sales in this period"
        })


class GetRevenueByPeriodTool(BaseTool):
    """Get revenue breakdown by time period."""
    
    name = "get_revenue_by_period"
    description = "Get revenue breakdown by day, week, or month"
    
    async def execute(
        self,
        period: str = "day",
        days: int = 30
    ) -> ToolResult:
        """
        Get revenue breakdown by period.
        
        Args:
            period: 'day', 'week', or 'month'
            days: Number of days to look back
        """
        cutoff = datetime.utcnow() - timedelta(days=days)
        
        SAFE_DATE_TRUNCS = {"day": "day", "week": "week", "month": "month"}
        date_trunc = SAFE_DATE_TRUNCS.get(period)
        if not date_trunc:
            return ToolResult(success=False, error=f"Invalid period: {period}. Use 'day', 'week', or 'month'.")
        
        query = f'''
            SELECT 
                DATE_TRUNC('{date_trunc}', order_date) as period_start,
                COUNT(*) as order_count,
                COALESCE(SUM(total_amount), 0) as revenue
            FROM "Order"
            WHERE org_id = $1 AND order_date >= $2
            GROUP BY DATE_TRUNC('{date_trunc}', order_date)
            ORDER BY period_start
        '''
        
        results = await self.query(query, int(self.org_id), cutoff)
        
        data_points = []
        for row in results:
            data_points.append({
                "period": row["period_start"].isoformat() if row["period_start"] else None,
                "order_count": row["order_count"],
                "revenue": float(row["revenue"] or 0)
            })
        
        return ToolResult(success=True, data={
            "data": data_points,
            "period_type": period,
            "days": days
        })


class GetInventorySummaryTool(BaseTool):
    """Get inventory summary across warehouses."""
    
    name = "get_inventory_summary"
    description = "Get inventory summary with stock levels and warehouse distribution"
    
    async def execute(self, low_stock_threshold: int = 10) -> ToolResult:
        """
        Get inventory summary.
        
        Args:
            low_stock_threshold: Threshold for low stock warning
        """
        query = '''
            SELECT 
                COUNT(DISTINCT p.product_id) as total_products,
                COALESCE(SUM(ps.quantity), 0) as total_stock,
                COUNT(DISTINCT w.warehouse_id) as warehouse_count,
                COUNT(CASE WHEN ps.quantity <= $2 THEN 1 END) as low_stock_items
            FROM "Product" p
            LEFT JOIN "ProductStock" ps ON ps.product_id = p.product_id
            LEFT JOIN "Warehouse" w ON w.warehouse_id = ps.warehouse_id
            WHERE p.org_id = $1
        '''
        
        result = await self.query_one(query, int(self.org_id), low_stock_threshold)
        
        return ToolResult(success=True, data={
            "total_products": result["total_products"] if result else 0,
            "total_stock": result["total_stock"] if result else 0,
            "warehouse_count": result["warehouse_count"] if result else 0,
            "low_stock_items": result["low_stock_items"] if result else 0,
            "low_stock_threshold": low_stock_threshold
        })


class GetRevenueByProductTool(BaseTool):
    """Get revenue breakdown by product."""
    
    name = "get_revenue_by_product"
    description = "Get revenue breakdown by product using price_at_order"
    
    async def execute(
        self,
        days: int = 30,
        limit: int = 20
    ) -> ToolResult:
        """
        Get revenue per product.
        
        Args:
            days: Period in days
            limit: Number of products to return
        """
        cutoff = datetime.utcnow() - timedelta(days=days)
        
        query = '''
            SELECT 
                p.product_id,
                p.name,
                p.sku,
                COALESCE(SUM(oi.quantity), 0) as units_sold,
                COALESCE(SUM(oi.quantity * oi.price_at_order), 0) as revenue
            FROM "Product" p
            INNER JOIN "OrderItem" oi ON oi.product_id = p.product_id
            INNER JOIN "Order" o ON o.order_id = oi.order_id
            WHERE p.org_id = $1 AND o.order_date >= $2
            GROUP BY p.product_id, p.name, p.sku
            HAVING COALESCE(SUM(oi.quantity * oi.price_at_order), 0) > 0
            ORDER BY revenue DESC
            LIMIT $3
        '''
        
        results = await self.query(query, int(self.org_id), cutoff, limit)
        
        products = []
        total_revenue = 0
        for row in results:
            rev = float(row["revenue"] or 0)
            total_revenue += rev
            products.append({
                "product_id": str(row["product_id"]),
                "name": row["name"],
                "sku": row["sku"],
                "units_sold": row["units_sold"],
                "revenue": rev
            })
        
        # Add percentage
        for p in products:
            p["revenue_share"] = round(p["revenue"] / total_revenue * 100, 1) if total_revenue > 0 else 0
        
        return ToolResult(success=True, data={
            "products": products,
            "total_revenue": total_revenue,
            "period_days": days
        })


class GetAverageOrderValueTrendTool(BaseTool):
    """Get average order value trend over time."""
    
    name = "get_aov_trend"
    description = "Get average order value trend by period"
    
    async def execute(
        self,
        period: str = "week",
        days: int = 90
    ) -> ToolResult:
        """
        Get AOV trend.
        
        Args:
            period: 'day', 'week', or 'month'
            days: Number of days to look back
        """
        cutoff = datetime.utcnow() - timedelta(days=days)
        
        SAFE_DATE_TRUNCS = {"day": "day", "week": "week", "month": "month"}
        date_trunc = SAFE_DATE_TRUNCS.get(period)
        if not date_trunc:
            return ToolResult(success=False, error=f"Invalid period: {period}. Use 'day', 'week', or 'month'.")
        
        query = f'''
            SELECT 
                DATE_TRUNC('{date_trunc}', order_date) as period_start,
                COUNT(*) as order_count,
                COALESCE(SUM(total_amount), 0) as revenue,
                COALESCE(AVG(total_amount), 0) as aov
            FROM "Order"
            WHERE org_id = $1 AND order_date >= $2
            GROUP BY DATE_TRUNC('{date_trunc}', order_date)
            ORDER BY period_start
        '''
        
        results = await self.query(query, int(self.org_id), cutoff)
        
        data_points = []
        for row in results:
            data_points.append({
                "period": row["period_start"].isoformat() if row["period_start"] else None,
                "order_count": row["order_count"],
                "revenue": float(row["revenue"] or 0),
                "aov": float(row["aov"] or 0)
            })
        
        return ToolResult(success=True, data={
            "data": data_points,
            "period_type": period,
            "days": days
        })


# Export all tools
ANALYTICS_TOOLS = [
    GetOrderSummaryTool,
    GetProductPerformanceTool,
    GetLeastSellingProductsTool,
    GetRevenueByPeriodTool,
    GetInventorySummaryTool,
    GetRevenueByProductTool,
    GetAverageOrderValueTrendTool,
]


def get_analytics_tools(auth: AuthContext) -> list[BaseTool]:
    """Get instantiated analytics tools for user."""
    from app.tools.analytics.forecasting import get_forecasting_tools
    from app.tools.analytics.alerts import get_alerts_tools
    
    tools = [ToolClass(auth) for ToolClass in ANALYTICS_TOOLS]
    tools.extend(get_forecasting_tools(auth))
    tools.extend(get_alerts_tools(auth))
    return tools


