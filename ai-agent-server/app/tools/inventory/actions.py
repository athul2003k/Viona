"""
Inventory Action Tools

Action tools for managing products and stock.
All actions require user confirmation before execution.
"""

import logging
from typing import Optional
from datetime import datetime
from decimal import Decimal

from app.tools import ActionTool, ActionResult, ActionStatus
from app.auth import AuthContext

logger = logging.getLogger(__name__)


class AddProductTool(ActionTool):
    """Add a new product to the catalog."""
    
    name = "add_product"
    description = "Add a new product to the inventory catalog"
    action_type = "create"
    required_roles = ["admin", "manager"]
    
    required_fields = ["name", "sku"]
    field_descriptions = {
        "name": "product name",
        "sku": "unique SKU code",
        "description": "product description",
        "retail_price": "retail price",
        "actual_price": "selling price"
    }
    
    async def preview(
        self,
        name: str,
        sku: str,
        description: Optional[str] = None,
        retail_price: Optional[float] = None,
        actual_price: Optional[float] = None,
        status: str = "active",
        **kwargs
    ) -> ActionResult:
        """Preview the product creation."""
        
        # Check if SKU already exists
        existing = await self.query_one(
            'SELECT product_id FROM "Product" WHERE org_id = $1 AND sku = $2',
            int(self.org_id),
            sku
        )
        
        if existing:
            return ActionResult(
                status=ActionStatus.CANCELLED,
                success=False,
                error=f"A product with SKU '{sku}' already exists"
            )
        
        preview_data = {
            "name": name,
            "sku": sku,
            "description": description,
            "retail_price": retail_price,
            "actual_price": actual_price,
            "status": status
        }
        
        price_info = ""
        if actual_price:
            price_info = f"\n**Price:** ${actual_price:,.2f}"
            if retail_price and retail_price != actual_price:
                price_info += f" (Retail: ${retail_price:,.2f})"
        
        confirmation_msg = f"""I'll add this new product:

**Name:** {name}
**SKU:** {sku}{price_info}
{f'**Description:** {description[:100]}...' if description and len(description) > 100 else f'**Description:** {description}' if description else ''}

Do you want me to proceed?"""
        
        return ActionResult(
            status=ActionStatus.PENDING_CONFIRMATION,
            success=True,
            preview_data=preview_data,
            confirmation_message=confirmation_msg
        )
    
    async def confirm(
        self,
        name: str,
        sku: str,
        description: Optional[str] = None,
        retail_price: Optional[float] = None,
        actual_price: Optional[float] = None,
        status: str = "active",
        **kwargs
    ) -> ActionResult:
        """Execute the product creation."""
        
        try:
            # Create product
            result = await self.execute_write(
                '''
                INSERT INTO "Product" (org_id, name, sku, description, status, created_at)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING product_id
                ''',
                int(self.org_id),
                name,
                sku,
                description,
                status,
                datetime.utcnow()
            )
            
            product_id = result["product_id"]
            
            # Create price record if provided
            if retail_price is not None or actual_price is not None:
                await self.execute_write(
                    '''
                    INSERT INTO "ProductPrice" (product_id, retail_price, actual_price)
                    VALUES ($1, $2, $3)
                    ''',
                    product_id,
                    retail_price,
                    actual_price
                )
            
            return ActionResult(
                status=ActionStatus.EXECUTED,
                success=True,
                created_id=str(product_id),
                result_message=f"✅ Product '{name}' (SKU: {sku}) created successfully!",
                data={"product_id": product_id, "sku": sku}
            )
            
        except Exception as e:
            logger.exception("Failed to create product")
            return ActionResult(
                status=ActionStatus.CANCELLED,
                success=False,
                error=f"Failed to create product: {str(e)}"
            )


class UpdateProductTool(ActionTool):
    """Update an existing product."""
    
    name = "update_product"
    description = "Update product details (name, description, price, status)"
    action_type = "update"
    required_roles = ["admin", "manager"]
    
    required_fields = ["product_id"]
    field_descriptions = {
        "product_id": "product ID or SKU",
        "name": "new product name",
        "description": "new description",
        "actual_price": "new selling price",
        "status": "new status (active/inactive)"
    }
    
    async def preview(
        self,
        product_id: int = None,
        sku: str = None,
        name: Optional[str] = None,
        description: Optional[str] = None,
        retail_price: Optional[float] = None,
        actual_price: Optional[float] = None,
        status: Optional[str] = None,
        **kwargs
    ) -> ActionResult:
        """Preview the product update."""
        
        # Find product by ID or SKU
        if product_id:
            product = await self.query_one(
                '''
                SELECT p.*, pp.retail_price, pp.actual_price
                FROM "Product" p
                LEFT JOIN "ProductPrice" pp ON pp.product_id = p.product_id
                WHERE p.product_id = $1 AND p.org_id = $2
                ''',
                int(product_id),
                int(self.org_id)
            )
        elif sku:
            product = await self.query_one(
                '''
                SELECT p.*, pp.retail_price, pp.actual_price
                FROM "Product" p
                LEFT JOIN "ProductPrice" pp ON pp.product_id = p.product_id
                WHERE p.sku = $1 AND p.org_id = $2
                ''',
                sku,
                int(self.org_id)
            )
            if product:
                product_id = product["product_id"]
        else:
            return ActionResult(
                status=ActionStatus.MISSING_DATA,
                success=True,
                missing_fields=["product_id"],
                prompt_message="I need the product ID or SKU to update. Which product do you want to update?"
            )
        
        if not product:
            return ActionResult(
                status=ActionStatus.CANCELLED,
                success=False,
                error=f"Product not found"
            )
        
        # Build changes list
        changes = []
        if name and name != product["name"]:
            changes.append(f"Name: {product['name']} → {name}")
        if status and status != product["status"]:
            changes.append(f"Status: {product['status']} → {status}")
        if actual_price is not None and actual_price != product.get("actual_price"):
            old_price = product.get("actual_price") or 0
            changes.append(f"Price: ${old_price:,.2f} → ${actual_price:,.2f}")
        
        if not changes:
            return ActionResult(
                status=ActionStatus.CANCELLED,
                success=False,
                error="No changes specified"
            )
        
        preview_data = {
            "product_id": product_id,
            "current": {
                "name": product["name"],
                "sku": product["sku"],
                "status": product["status"],
                "price": float(product.get("actual_price") or 0)
            },
            "changes": {
                "name": name,
                "status": status,
                "actual_price": actual_price
            }
        }
        
        changes_text = "\n".join(f"  • {c}" for c in changes)
        confirmation_msg = f"""I'll update product '{product['name']}' (SKU: {product['sku']}):

**Changes:**
{changes_text}

Do you want me to proceed?"""
        
        return ActionResult(
            status=ActionStatus.PENDING_CONFIRMATION,
            success=True,
            preview_data=preview_data,
            confirmation_message=confirmation_msg
        )
    
    async def confirm(
        self,
        product_id: int = None,
        sku: str = None,
        name: Optional[str] = None,
        description: Optional[str] = None,
        retail_price: Optional[float] = None,
        actual_price: Optional[float] = None,
        status: Optional[str] = None,
        **kwargs
    ) -> ActionResult:
        """Execute the product update."""
        
        # Resolve product_id from SKU if needed
        if not product_id and sku:
            product = await self.query_one(
                'SELECT product_id FROM "Product" WHERE sku = $1 AND org_id = $2',
                sku,
                int(self.org_id)
            )
            if product:
                product_id = product["product_id"]
        
        if not product_id:
            return ActionResult(
                status=ActionStatus.CANCELLED,
                success=False,
                error="Product not found"
            )
        
        try:
            # Build dynamic update
            updates = []
            args = []
            param_idx = 1
            
            if name:
                updates.append(f"name = ${param_idx}")
                args.append(name)
                param_idx += 1
            if description:
                updates.append(f"description = ${param_idx}")
                args.append(description)
                param_idx += 1
            if status:
                updates.append(f"status = ${param_idx}")
                args.append(status)
                param_idx += 1
            
            updates.append(f"updated_at = ${param_idx}")
            args.append(datetime.utcnow())
            param_idx += 1
            
            args.append(int(product_id))
            args.append(int(self.org_id))
            
            if updates:
                update_sql = f'''
                    UPDATE "Product"
                    SET {", ".join(updates)}
                    WHERE product_id = ${param_idx} AND org_id = ${param_idx + 1}
                    RETURNING product_id, name, sku
                '''
                result = await self.execute_write(update_sql, *args)
            
            # Update price if provided
            if actual_price is not None or retail_price is not None:
                # Check if price record exists
                existing_price = await self.query_one(
                    'SELECT price_id FROM "ProductPrice" WHERE product_id = $1',
                    int(product_id)
                )
                
                if existing_price:
                    price_updates = []
                    price_args = []
                    p_idx = 1
                    if actual_price is not None:
                        price_updates.append(f"actual_price = ${p_idx}")
                        price_args.append(actual_price)
                        p_idx += 1
                    if retail_price is not None:
                        price_updates.append(f"retail_price = ${p_idx}")
                        price_args.append(retail_price)
                        p_idx += 1
                    price_args.append(int(product_id))
                    
                    await self.execute_write(
                        f'UPDATE "ProductPrice" SET {", ".join(price_updates)} WHERE product_id = ${p_idx}',
                        *price_args
                    )
                else:
                    await self.execute_write(
                        'INSERT INTO "ProductPrice" (product_id, retail_price, actual_price) VALUES ($1, $2, $3)',
                        int(product_id),
                        retail_price,
                        actual_price
                    )
            
            return ActionResult(
                status=ActionStatus.EXECUTED,
                success=True,
                result_message=f"✅ Product updated successfully!",
                data={"product_id": product_id}
            )
            
        except Exception as e:
            logger.exception("Failed to update product")
            return ActionResult(
                status=ActionStatus.CANCELLED,
                success=False,
                error=f"Failed to update product: {str(e)}"
            )


class UpdateStockTool(ActionTool):
    """Update stock quantity for a product."""
    
    name = "update_stock"
    description = "Adjust stock quantity for a product in a warehouse"
    action_type = "update"
    required_roles = ["admin", "manager"]
    
    required_fields = ["sku", "quantity"]
    field_descriptions = {
        "sku": "product SKU",
        "quantity": "new quantity or adjustment (+10, -5, or absolute: 100)",
        "warehouse_id": "warehouse ID (optional, uses default if not specified)"
    }
    
    async def preview(
        self,
        sku: str,
        quantity: int,
        warehouse_id: Optional[int] = None,
        adjustment: bool = False,  # If True, quantity is +/- adjustment
        **kwargs
    ) -> ActionResult:
        """Preview the stock update."""
        
        # Find product
        product = await self.query_one(
            'SELECT product_id, name, sku FROM "Product" WHERE sku = $1 AND org_id = $2',
            sku,
            int(self.org_id)
        )
        
        if not product:
            return ActionResult(
                status=ActionStatus.CANCELLED,
                success=False,
                error=f"Product with SKU '{sku}' not found"
            )
        
        # Get warehouse
        if warehouse_id:
            warehouse = await self.query_one(
                'SELECT warehouse_id, name FROM "Warehouse" WHERE warehouse_id = $1 AND org_id = $2',
                int(warehouse_id),
                int(self.org_id)
            )
        else:
            warehouse = await self.query_one(
                'SELECT warehouse_id, name FROM "Warehouse" WHERE org_id = $1 LIMIT 1',
                int(self.org_id)
            )
        
        if not warehouse:
            return ActionResult(
                status=ActionStatus.CANCELLED,
                success=False,
                error="No warehouse found. Please create a warehouse first."
            )
        
        warehouse_id = warehouse["warehouse_id"]
        
        # Get current stock
        current_stock = await self.query_one(
            'SELECT quantity FROM "ProductStock" WHERE product_id = $1 AND warehouse_id = $2',
            product["product_id"],
            warehouse_id
        )
        current_qty = current_stock["quantity"] if current_stock else 0
        
        if adjustment:
            new_qty = current_qty + quantity
        else:
            new_qty = quantity
        
        if new_qty < 0:
            return ActionResult(
                status=ActionStatus.CANCELLED,
                success=False,
                error=f"Cannot set negative stock. Current: {current_qty}, would become: {new_qty}"
            )
        
        preview_data = {
            "product": product["name"],
            "sku": sku,
            "warehouse": warehouse["name"],
            "warehouse_id": warehouse_id,
            "current_quantity": current_qty,
            "new_quantity": new_qty,
            "change": new_qty - current_qty
        }
        
        change_text = f"+{new_qty - current_qty}" if new_qty > current_qty else str(new_qty - current_qty)
        
        confirmation_msg = f"""I'll update stock for '{product['name']}' (SKU: {sku}):

**Warehouse:** {warehouse['name']}
**Current Stock:** {current_qty} units
**New Stock:** {new_qty} units ({change_text})

Do you want me to proceed?"""
        
        return ActionResult(
            status=ActionStatus.PENDING_CONFIRMATION,
            success=True,
            preview_data=preview_data,
            confirmation_message=confirmation_msg
        )
    
    async def confirm(
        self,
        sku: str,
        quantity: int,
        warehouse_id: Optional[int] = None,
        adjustment: bool = False,
        **kwargs
    ) -> ActionResult:
        """Execute the stock update."""
        
        product = await self.query_one(
            'SELECT product_id FROM "Product" WHERE sku = $1 AND org_id = $2',
            sku,
            int(self.org_id)
        )
        
        if not product:
            return ActionResult(
                status=ActionStatus.CANCELLED,
                success=False,
                error=f"Product with SKU '{sku}' not found"
            )
        
        if not warehouse_id:
            warehouse = await self.query_one(
                'SELECT warehouse_id FROM "Warehouse" WHERE org_id = $1 LIMIT 1',
                int(self.org_id)
            )
            warehouse_id = warehouse["warehouse_id"] if warehouse else None
        
        if not warehouse_id:
            return ActionResult(
                status=ActionStatus.CANCELLED,
                success=False,
                error="No warehouse found"
            )
        
        try:
            # Check if stock record exists
            existing = await self.query_one(
                'SELECT stock_id, quantity FROM "ProductStock" WHERE product_id = $1 AND warehouse_id = $2',
                product["product_id"],
                warehouse_id
            )
            
            if existing:
                if adjustment:
                    new_qty = existing["quantity"] + quantity
                else:
                    new_qty = quantity
                
                await self.execute_write(
                    'UPDATE "ProductStock" SET quantity = $1, updated_at = $2 WHERE stock_id = $3',
                    new_qty,
                    datetime.utcnow(),
                    existing["stock_id"]
                )
            else:
                new_qty = quantity
                await self.execute_write(
                    'INSERT INTO "ProductStock" (product_id, warehouse_id, quantity) VALUES ($1, $2, $3)',
                    product["product_id"],
                    warehouse_id,
                    new_qty
                )
            
            return ActionResult(
                status=ActionStatus.EXECUTED,
                success=True,
                result_message=f"✅ Stock updated! SKU {sku} now has {new_qty} units.",
                data={"sku": sku, "quantity": new_qty, "warehouse_id": warehouse_id}
            )
            
        except Exception as e:
            logger.exception("Failed to update stock")
            return ActionResult(
                status=ActionStatus.CANCELLED,
                success=False,
                error=f"Failed to update stock: {str(e)}"
            )


class TransferStockTool(ActionTool):
    """Transfer stock between warehouses."""
    
    name = "transfer_stock"
    description = "Transfer stock from one warehouse to another"
    action_type = "update"
    required_roles = ["admin", "manager"]
    
    required_fields = ["sku", "quantity", "from_warehouse_id", "to_warehouse_id"]
    field_descriptions = {
        "sku": "product SKU to transfer",
        "quantity": "quantity to transfer",
        "from_warehouse_id": "source warehouse ID",
        "to_warehouse_id": "destination warehouse ID"
    }
    
    async def preview(
        self,
        sku: str,
        quantity: int,
        from_warehouse_id: int,
        to_warehouse_id: int,
        **kwargs
    ) -> ActionResult:
        """Preview the stock transfer."""
        
        if quantity <= 0:
            return ActionResult(
                status=ActionStatus.CANCELLED,
                success=False,
                error="Transfer quantity must be positive"
            )
        
        if from_warehouse_id == to_warehouse_id:
            return ActionResult(
                status=ActionStatus.CANCELLED,
                success=False,
                error="Source and destination warehouses must be different"
            )
        
        # Get product
        product = await self.query_one(
            'SELECT product_id, name FROM "Product" WHERE sku = $1 AND org_id = $2',
            sku,
            int(self.org_id)
        )
        
        if not product:
            return ActionResult(
                status=ActionStatus.CANCELLED,
                success=False,
                error=f"Product with SKU '{sku}' not found"
            )
        
        # Get warehouses
        from_wh = await self.query_one(
            'SELECT warehouse_id, name FROM "Warehouse" WHERE warehouse_id = $1 AND org_id = $2',
            int(from_warehouse_id),
            int(self.org_id)
        )
        to_wh = await self.query_one(
            'SELECT warehouse_id, name FROM "Warehouse" WHERE warehouse_id = $1 AND org_id = $2',
            int(to_warehouse_id),
            int(self.org_id)
        )
        
        if not from_wh:
            return ActionResult(
                status=ActionStatus.CANCELLED,
                success=False,
                error=f"Source warehouse #{from_warehouse_id} not found"
            )
        
        if not to_wh:
            return ActionResult(
                status=ActionStatus.CANCELLED,
                success=False,
                error=f"Destination warehouse #{to_warehouse_id} not found"
            )
        
        # Check source stock
        source_stock = await self.query_one(
            'SELECT quantity FROM "ProductStock" WHERE product_id = $1 AND warehouse_id = $2',
            product["product_id"],
            int(from_warehouse_id)
        )
        source_qty = source_stock["quantity"] if source_stock else 0
        
        if source_qty < quantity:
            return ActionResult(
                status=ActionStatus.CANCELLED,
                success=False,
                error=f"Insufficient stock. {from_wh['name']} only has {source_qty} units of {sku}"
            )
        
        # Get destination stock
        dest_stock = await self.query_one(
            'SELECT quantity FROM "ProductStock" WHERE product_id = $1 AND warehouse_id = $2',
            product["product_id"],
            int(to_warehouse_id)
        )
        dest_qty = dest_stock["quantity"] if dest_stock else 0
        
        preview_data = {
            "product": product["name"],
            "sku": sku,
            "quantity": quantity,
            "from_warehouse": {
                "id": from_warehouse_id,
                "name": from_wh["name"],
                "current_stock": source_qty,
                "after_transfer": source_qty - quantity
            },
            "to_warehouse": {
                "id": to_warehouse_id,
                "name": to_wh["name"],
                "current_stock": dest_qty,
                "after_transfer": dest_qty + quantity
            }
        }
        
        confirmation_msg = f"""I'll transfer stock for '{product['name']}' (SKU: {sku}):

**Transfer:** {quantity} units
**From:** {from_wh['name']} ({source_qty} → {source_qty - quantity})
**To:** {to_wh['name']} ({dest_qty} → {dest_qty + quantity})

Do you want me to proceed?"""
        
        return ActionResult(
            status=ActionStatus.PENDING_CONFIRMATION,
            success=True,
            preview_data=preview_data,
            confirmation_message=confirmation_msg
        )
    
    async def confirm(
        self,
        sku: str,
        quantity: int,
        from_warehouse_id: int,
        to_warehouse_id: int,
        **kwargs
    ) -> ActionResult:
        """Execute the stock transfer."""
        
        product = await self.query_one(
            'SELECT product_id FROM "Product" WHERE sku = $1 AND org_id = $2',
            sku,
            int(self.org_id)
        )
        
        if not product:
            return ActionResult(
                status=ActionStatus.CANCELLED,
                success=False,
                error=f"Product with SKU '{sku}' not found"
            )
        
        try:
            from app.tools.base import get_db_pool
            pool = await get_db_pool()
            
            async with pool.acquire() as conn:
                async with conn.transaction():
                    # Deduct from source
                    await conn.execute(
                        '''
                        UPDATE "ProductStock" 
                        SET quantity = quantity - $1, updated_at = $2
                        WHERE product_id = $3 AND warehouse_id = $4
                        ''',
                        quantity,
                        datetime.utcnow(),
                        product["product_id"],
                        int(from_warehouse_id)
                    )
                    
                    # Add to destination (upsert)
                    existing = await conn.fetchrow(
                        'SELECT stock_id FROM "ProductStock" WHERE product_id = $1 AND warehouse_id = $2',
                        product["product_id"],
                        int(to_warehouse_id)
                    )
                    
                    if existing:
                        await conn.execute(
                            '''
                            UPDATE "ProductStock" 
                            SET quantity = quantity + $1, updated_at = $2
                            WHERE product_id = $3 AND warehouse_id = $4
                            ''',
                            quantity,
                            datetime.utcnow(),
                            product["product_id"],
                            int(to_warehouse_id)
                        )
                    else:
                        await conn.execute(
                            'INSERT INTO "ProductStock" (product_id, warehouse_id, quantity) VALUES ($1, $2, $3)',
                            product["product_id"],
                            int(to_warehouse_id),
                            quantity
                        )
            
            return ActionResult(
                status=ActionStatus.EXECUTED,
                success=True,
                result_message=f"✅ Transferred {quantity} units of {sku} successfully!",
                data={"sku": sku, "quantity": quantity}
            )
            
        except Exception as e:
            logger.exception("Failed to transfer stock")
            return ActionResult(
                status=ActionStatus.CANCELLED,
                success=False,
                error=f"Failed to transfer stock: {str(e)}"
            )


# Export all action tools
INVENTORY_ACTION_TOOLS = [
    AddProductTool,
    UpdateProductTool,
    UpdateStockTool,
    TransferStockTool,
]


def get_inventory_action_tools(auth: AuthContext) -> list[ActionTool]:
    """Get instantiated inventory action tools for user."""
    return [ToolClass(auth) for ToolClass in INVENTORY_ACTION_TOOLS]
