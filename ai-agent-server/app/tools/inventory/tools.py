"""
Inventory Domain Tools

Tools for querying inventory and warehouse data.
All queries are org-scoped and read-only.
"""

from typing import Optional
from datetime import datetime

from app.tools import BaseTool, ToolResult
from app.auth import AuthContext


class GetProductStockTool(BaseTool):
    """Get stock levels for products across warehouses."""
    
    name = "get_product_stock"
    description = "Get current stock levels for products, optionally filtered by warehouse"
    
    async def execute(
        self,
        product_id: Optional[int] = None,
        warehouse_id: Optional[int] = None,
        low_stock_only: bool = False,
        low_stock_threshold: int = 10,
        limit: int = 50
    ) -> ToolResult:
        """
        Get product stock levels.
        
        Args:
            product_id: Filter by specific product
            warehouse_id: Filter by specific warehouse
            low_stock_only: Only return items below threshold
            low_stock_threshold: Threshold for low stock
            limit: Max results
        """
        query = '''
            SELECT 
                p.product_id,
                p.name as product_name,
                p.sku,
                w.warehouse_id,
                w.name as warehouse_name,
                COALESCE(ps.quantity, 0) as quantity
            FROM "Product" p
            LEFT JOIN "ProductStock" ps ON ps.product_id = p.product_id
            LEFT JOIN "Warehouse" w ON w.warehouse_id = ps.warehouse_id
            WHERE p.org_id = $1
        '''
        args = [int(self.org_id)]
        param_idx = 2
        
        if product_id:
            query += f' AND p.product_id = ${param_idx}'
            args.append(product_id)
            param_idx += 1
        
        if warehouse_id:
            query += f' AND w.warehouse_id = ${param_idx}'
            args.append(warehouse_id)
            param_idx += 1
        
        if low_stock_only:
            query += f' AND COALESCE(ps.quantity, 0) <= ${param_idx}'
            args.append(low_stock_threshold)
            param_idx += 1
        
        query += f' ORDER BY ps.quantity ASC LIMIT ${param_idx}'
        args.append(limit)
        
        results = await self.query(query, *args)
        
        stock_items = []
        for row in results:
            stock_items.append({
                "product_id": str(row["product_id"]),
                "product_name": row["product_name"],
                "sku": row["sku"],
                "warehouse_id": str(row["warehouse_id"]) if row["warehouse_id"] else None,
                "warehouse_name": row["warehouse_name"],
                "quantity": row["quantity"],
                "is_low_stock": row["quantity"] <= low_stock_threshold
            })
        
        return ToolResult(success=True, data={
            "items": stock_items,
            "total_count": len(stock_items),
            "low_stock_threshold": low_stock_threshold
        })


class GetWarehouseListTool(BaseTool):
    """Get list of warehouses with summary stats."""
    
    name = "get_warehouse_list"
    description = "Get all warehouses with product counts and total stock"
    
    async def execute(self) -> ToolResult:
        """Get warehouse list with statistics."""
        query = '''
            SELECT 
                w.warehouse_id,
                w.name,
                w.address,
                COUNT(DISTINCT ps.product_id) as product_count,
                COALESCE(SUM(ps.quantity), 0) as total_stock
            FROM "Warehouse" w
            LEFT JOIN "ProductStock" ps ON ps.warehouse_id = w.warehouse_id
            WHERE w.org_id = $1
            GROUP BY w.warehouse_id, w.name, w.address
            ORDER BY w.name
        '''
        
        results = await self.query(query, int(self.org_id))
        
        warehouses = []
        for row in results:
            warehouses.append({
                "warehouse_id": str(row["warehouse_id"]),
                "name": row["name"],
                "address": row["address"],
                "product_count": row["product_count"],
                "total_stock": row["total_stock"]
            })
        
        return ToolResult(success=True, data={
            "warehouses": warehouses,
            "total_warehouses": len(warehouses)
        })


class GetProductCatalogTool(BaseTool):
    """Get product catalog with pricing."""
    
    name = "get_product_catalog"
    description = "Get product catalog with current prices and stock status"
    
    async def execute(
        self,
        search: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 50
    ) -> ToolResult:
        """
        Get product catalog.
        
        Args:
            search: Search by name or SKU
            status: Filter by status (active, draft, etc)
            limit: Max results
        """
        query = '''
            SELECT 
                p.product_id,
                p.name,
                p.sku,
                p.description,
                p.status,
                pp.retail_price,
                pp.actual_price,
                COALESCE(SUM(ps.quantity), 0) as total_stock
            FROM "Product" p
            LEFT JOIN "ProductPrice" pp ON pp.product_id = p.product_id
            LEFT JOIN "ProductStock" ps ON ps.product_id = p.product_id
            WHERE p.org_id = $1
        '''
        args = [int(self.org_id)]
        param_idx = 2
        
        if search:
            query += f''' AND (
                p.name ILIKE ${param_idx} OR 
                p.sku ILIKE ${param_idx}
            )'''
            args.append(f'%{search}%')
            param_idx += 1
        
        if status:
            query += f' AND p.status = ${param_idx}'
            args.append(status)
            param_idx += 1
        
        query += f''' 
            GROUP BY p.product_id, p.name, p.sku, p.description, 
                     p.status, pp.retail_price, pp.actual_price
            ORDER BY p.name
            LIMIT ${param_idx}
        '''
        args.append(limit)
        
        results = await self.query(query, *args)
        
        products = []
        for row in results:
            products.append({
                "product_id": str(row["product_id"]),
                "name": row["name"],
                "sku": row["sku"],
                "description": row["description"],
                "status": row["status"],
                "retail_price": float(row["retail_price"]) if row["retail_price"] else None,
                "actual_price": float(row["actual_price"]) if row["actual_price"] else None,
                "total_stock": row["total_stock"]
            })
        
        return ToolResult(success=True, data={
            "products": products,
            "total_count": len(products)
        })


class GetStockMovementTool(BaseTool):
    """Analyze stock changes over time."""
    
    name = "get_stock_movement"
    description = "Get stock movement analysis based on order history"
    required_roles = ["admin", "manager"]  # Requires elevated access
    
    async def execute(
        self,
        days: int = 30,
        limit: int = 20
    ) -> ToolResult:
        """
        Get stock movement (products sold) over time.
        
        Args:
            days: Period to analyze
            limit: Top N products
        """
        from datetime import timedelta
        cutoff = datetime.utcnow() - timedelta(days=days)
        
        query = '''
            SELECT 
                p.product_id,
                p.name,
                p.sku,
                COALESCE(SUM(oi.quantity), 0) as units_sold,
                COUNT(DISTINCT o.order_id) as order_count
            FROM "Product" p
            LEFT JOIN "OrderItem" oi ON oi.product_id = p.product_id
            LEFT JOIN "Order" o ON o.order_id = oi.order_id 
                AND o.order_date >= $2
            WHERE p.org_id = $1
            GROUP BY p.product_id, p.name, p.sku
            ORDER BY units_sold DESC
            LIMIT $3
        '''
        
        results = await self.query(query, int(self.org_id), cutoff, limit)
        
        movements = []
        for row in results:
            movements.append({
                "product_id": str(row["product_id"]),
                "name": row["name"],
                "sku": row["sku"],
                "units_sold": row["units_sold"],
                "order_count": row["order_count"]
            })
        
        return ToolResult(success=True, data={
            "movements": movements,
            "period_days": days
        })


class GetOverstockDetectionTool(BaseTool):
    """Detect overstock and inventory imbalance across warehouses."""
    
    name = "get_overstock_detection"
    description = "Identify overstocked items and inventory imbalances across warehouses"
    
    async def execute(
        self,
        overstock_threshold: int = 500,
        limit: int = 20
    ) -> ToolResult:
        """
        Detect overstock and imbalances.
        
        Args:
            overstock_threshold: Units above which is considered overstocked
            limit: Max results
        """
        # Get products with high stock
        overstock_query = '''
            SELECT 
                p.product_id,
                p.name,
                p.sku,
                w.name as warehouse_name,
                ps.quantity
            FROM "Product" p
            JOIN "ProductStock" ps ON ps.product_id = p.product_id
            JOIN "Warehouse" w ON w.warehouse_id = ps.warehouse_id
            WHERE p.org_id = $1 AND ps.quantity >= $2
            ORDER BY ps.quantity DESC
            LIMIT $3
        '''
        
        overstock_results = await self.query(
            overstock_query, 
            int(self.org_id), 
            overstock_threshold,
            limit
        )
        
        overstocked = [
            {
                "product_id": str(row["product_id"]),
                "name": row["name"],
                "sku": row["sku"],
                "warehouse": row["warehouse_name"],
                "quantity": row["quantity"]
            }
            for row in overstock_results
        ]
        
        # Get warehouse imbalance (products with very uneven distribution)
        imbalance_query = '''
            SELECT 
                p.product_id,
                p.name,
                p.sku,
                MAX(ps.quantity) as max_qty,
                MIN(ps.quantity) as min_qty,
                MAX(ps.quantity) - MIN(ps.quantity) as imbalance
            FROM "Product" p
            JOIN "ProductStock" ps ON ps.product_id = p.product_id
            WHERE p.org_id = $1
            GROUP BY p.product_id, p.name, p.sku
            HAVING COUNT(DISTINCT ps.warehouse_id) > 1
            ORDER BY imbalance DESC
            LIMIT $2
        '''
        
        imbalance_results = await self.query(imbalance_query, int(self.org_id), limit)
        
        imbalances = [
            {
                "product_id": str(row["product_id"]),
                "name": row["name"],
                "sku": row["sku"],
                "max_quantity": row["max_qty"],
                "min_quantity": row["min_qty"],
                "imbalance": row["imbalance"]
            }
            for row in imbalance_results
            if row["imbalance"] and row["imbalance"] > 50  # Only significant imbalances
        ]
        
        return ToolResult(success=True, data={
            "overstocked_items": overstocked,
            "overstock_count": len(overstocked),
            "overstock_threshold": overstock_threshold,
            "imbalanced_products": imbalances,
            "imbalance_count": len(imbalances)
        })


class SearchProductsTool(BaseTool):
    """Search products by name, SKU, or description."""
    
    name = "search_products"
    description = "Search for products by name, SKU, or description text"
    
    async def execute(
        self,
        query: str,
        limit: int = 20
    ) -> ToolResult:
        """
        Search products.
        
        Args:
            query: Search text (matches name, SKU, or description)
            limit: Maximum results to return
        """
        search_pattern = f"%{query}%"
        
        sql = '''
            SELECT 
                p.product_id,
                p.name,
                p.sku,
                p.description,
                p.status,
                pp.retail_price,
                pp.actual_price,
                COALESCE(SUM(ps.quantity), 0) as total_stock
            FROM "Product" p
            LEFT JOIN "ProductPrice" pp ON pp.product_id = p.product_id
            LEFT JOIN "ProductStock" ps ON ps.product_id = p.product_id
            WHERE p.org_id = $1 
              AND (
                  p.name ILIKE $2 
                  OR p.sku ILIKE $2 
                  OR p.description ILIKE $2
              )
            GROUP BY p.product_id, p.name, p.sku, p.description, 
                     p.status, pp.retail_price, pp.actual_price
            ORDER BY 
                CASE WHEN p.name ILIKE $2 THEN 0 ELSE 1 END,
                p.name
            LIMIT $3
        '''
        
        results = await self.query(sql, int(self.org_id), search_pattern, limit)
        
        products = []
        for row in results:
            products.append({
                "product_id": str(row["product_id"]),
                "name": row["name"],
                "sku": row["sku"],
                "description": row["description"][:100] + "..." if row["description"] and len(row["description"]) > 100 else row["description"],
                "status": row["status"],
                "retail_price": float(row["retail_price"]) if row["retail_price"] else None,
                "actual_price": float(row["actual_price"]) if row["actual_price"] else None,
                "total_stock": row["total_stock"]
            })
        
        return ToolResult(success=True, data={
            "products": products,
            "count": len(products),
            "query": query
        })


# Export all tools
INVENTORY_TOOLS = [
    GetProductStockTool,
    GetWarehouseListTool,
    GetProductCatalogTool,
    GetStockMovementTool,
    GetOverstockDetectionTool,
    SearchProductsTool,
]


def get_inventory_tools(auth: AuthContext) -> list[BaseTool]:
    """Get instantiated inventory tools for user."""
    return [ToolClass(auth) for ToolClass in INVENTORY_TOOLS]


