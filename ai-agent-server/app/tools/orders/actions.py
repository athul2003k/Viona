"""
Orders Action Tools

Action tools for creating and modifying orders.
All actions require user confirmation before execution.
"""

import logging
from typing import Optional, List
from datetime import datetime
from decimal import Decimal

from app.tools import ActionTool, ActionResult, ActionStatus
from app.auth import AuthContext

logger = logging.getLogger(__name__)


class CreateOrderTool(ActionTool):
    """Create a new order with confirmation."""
    
    name = "create_order"
    description = "Create a new order for a customer"
    action_type = "create"
    required_roles = ["admin", "manager"]
    
    required_fields = ["customer_email", "items", "payment_method"]
    field_descriptions = {
        "customer_email": "customer's email address",
        "customer_name": "customer's full name",
        "items": "products and quantities (e.g., 'iPhone 17 Pro Max x2, Samsung Galaxy x1')",
        "payment_method": "payment method (cash, card, bank_transfer, upi, etc.)",
        "shipping_address": "shipping address (street, city, state, zip code)"
    }
    
    async def preview(
        self,
        customer_email: str,
        items: List[dict],  # [{"sku": "ABC", "quantity": 5}, ...]
        customer_name: Optional[str] = None,
        customer_phone: Optional[str] = None,
        shipping_street: Optional[str] = None,
        shipping_city: Optional[str] = None,
        shipping_state: Optional[str] = None,
        shipping_zip: Optional[str] = None,
        shipping_country: Optional[str] = "USA",
        payment_method: Optional[str] = None,
        payment_reference: Optional[str] = None,
        notes: Optional[str] = None,
        **kwargs
    ) -> ActionResult:
        """Preview the order before creation."""
        
        # Look up products and calculate totals
        skus = [item.get("sku") for item in items if item.get("sku")]
        if not skus:
            return ActionResult(
                status=ActionStatus.CANCELLED,
                success=False,
                error="No valid SKUs provided in items"
            )
        
        # Get product details
        placeholders = ",".join(f"${i+2}" for i in range(len(skus)))
        query = f'''
            SELECT product_id, name, sku, 
                   (SELECT actual_price FROM "ProductPrice" WHERE product_id = p.product_id LIMIT 1) as price
            FROM "Product" p
            WHERE org_id = $1 AND sku IN ({placeholders})
        '''
        products = await self.query(query, int(self.org_id), *skus)
        
        product_map = {p["sku"]: p for p in products}
        
        # Build order preview
        order_items = []
        total_amount = Decimal("0")
        missing_skus = []
        
        for item in items:
            sku = item.get("sku")
            qty = int(item.get("quantity", 1))
            
            if sku not in product_map:
                missing_skus.append(sku)
                continue
            
            product = product_map[sku]
            price = Decimal(str(product["price"] or 0))
            line_total = price * qty
            total_amount += line_total
            
            order_items.append({
                "product_id": product["product_id"],
                "sku": sku,
                "name": product["name"],
                "quantity": qty,
                "unit_price": float(price),
                "line_total": float(line_total)
            })
        
        if missing_skus:
            return ActionResult(
                status=ActionStatus.CANCELLED,
                success=False,
                error=f"Products not found: {', '.join(missing_skus)}"
            )
        
        if not order_items:
            return ActionResult(
                status=ActionStatus.CANCELLED,
                success=False,
                error="No valid items in order"
            )
        
        # Build preview data
        preview_data = {
            "customer": {
                "email": customer_email,
                "name": customer_name or "Not provided",
                "phone": customer_phone
            },
            "items": order_items,
            "item_count": len(order_items),
            "total_amount": float(total_amount),
            "shipping": {
                "street": shipping_street,
                "city": shipping_city,
                "state": shipping_state,
                "zip": shipping_zip,
                "country": shipping_country
            },
            "payment": {
                "method": payment_method,
                "reference": payment_reference
            },
            "notes": notes
        }
        
        # Build confirmation message
        item_lines = "\n".join(
            f"  • {i['name']} (SKU: {i['sku']}) × {i['quantity']} = ${i['line_total']:,.2f}"
            for i in order_items
        )
        
        confirmation_msg = f"""I'm ready to create this order:

**Customer:** {customer_email}{f' ({customer_name})' if customer_name else ''}
**Items:**
{item_lines}

**Total:** ${float(total_amount):,.2f}
{f'**Payment:** {payment_method}' + (f' (Ref: {payment_reference})' if payment_reference else '') if payment_method else ''}

Do you want me to proceed with this order?"""
        
        return ActionResult(
            status=ActionStatus.PENDING_CONFIRMATION,
            success=True,
            preview_data=preview_data,
            confirmation_message=confirmation_msg
        )
    
    async def confirm(
        self,
        customer_email: str,
        items: List[dict],
        customer_name: Optional[str] = None,
        customer_phone: Optional[str] = None,
        shipping_street: Optional[str] = None,
        shipping_city: Optional[str] = None,
        shipping_state: Optional[str] = None,
        shipping_zip: Optional[str] = None,
        shipping_country: Optional[str] = "USA",
        payment_method: Optional[str] = None,
        payment_reference: Optional[str] = None,
        notes: Optional[str] = None,
        **kwargs
    ) -> ActionResult:
        """Execute the order creation."""
        
        # Recalculate totals
        skus = [item.get("sku") for item in items if item.get("sku")]
        placeholders = ",".join(f"${i+2}" for i in range(len(skus)))
        query = f'''
            SELECT product_id, sku,
                   (SELECT actual_price FROM "ProductPrice" WHERE product_id = p.product_id LIMIT 1) as price
            FROM "Product" p
            WHERE org_id = $1 AND sku IN ({placeholders})
        '''
        products = await self.query(query, int(self.org_id), *skus)
        product_map = {p["sku"]: p for p in products}
        
        # Calculate total
        total_amount = Decimal("0")
        order_items_data = []
        
        for item in items:
            sku = item.get("sku")
            qty = int(item.get("quantity", 1))
            if sku in product_map:
                product = product_map[sku]
                price = Decimal(str(product["price"] or 0))
                total_amount += price * qty
                order_items_data.append({
                    "product_id": product["product_id"],
                    "quantity": qty,
                    "price": price
                })
        
        # Create order
        insert_order = '''
            INSERT INTO "Order" (
                org_id, customer_name, customer_email, customer_phone,
                shipping_street, shipping_city, shipping_state, 
                shipping_zip, shipping_country,
                total_amount, status, payment_method, notes, order_date, placed_by
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
            )
            RETURNING order_id
        '''
        
        # Add payment reference to notes if provided
        order_notes = notes or ""
        if payment_reference:
            order_notes = f"Payment ref: {payment_reference}" + (f"\n{notes}" if notes else "")
        
        try:
            result = await self.execute_write(
                insert_order,
                int(self.org_id),
                customer_name,
                customer_email,
                customer_phone,
                shipping_street,
                shipping_city,
                shipping_state,
                shipping_zip,
                shipping_country,
                float(total_amount),
                "pending",
                payment_method,
                order_notes,
                datetime.utcnow(),
                self.auth.db_user_id
            )
            
            order_id = result["order_id"]
            
            # Insert order items
            for item_data in order_items_data:
                await self.execute_write(
                    '''
                    INSERT INTO "OrderItem" (order_id, product_id, quantity, price_at_order)
                    VALUES ($1, $2, $3, $4)
                    ''',
                    order_id,
                    item_data["product_id"],
                    item_data["quantity"],
                    float(item_data["price"])
                )
            
            return ActionResult(
                status=ActionStatus.EXECUTED,
                success=True,
                created_id=str(order_id),
                result_message=f"✅ Order #{order_id} created successfully! Total: ${float(total_amount):,.2f}",
                data={"order_id": order_id, "total_amount": float(total_amount)}
            )
            
        except Exception as e:
            logger.exception("Failed to create order")
            return ActionResult(
                status=ActionStatus.CANCELLED,
                success=False,
                error=f"Failed to create order: {str(e)}"
            )


class UpdateOrderStatusTool(ActionTool):
    """Update the status of an existing order."""
    
    name = "update_order_status"
    description = "Update the status of an order (e.g., pending → shipped → delivered)"
    action_type = "update"
    required_roles = ["admin", "manager"]
    
    required_fields = ["order_id", "new_status"]
    field_descriptions = {
        "order_id": "order ID number",
        "new_status": "new status (pending, processing, shipped, delivered, cancelled)"
    }
    
    VALID_STATUSES = ["pending", "processing", "shipped", "delivered", "cancelled"]
    
    async def preview(
        self,
        order_id: int,
        new_status: str,
        **kwargs
    ) -> ActionResult:
        """Preview the status change."""
        
        new_status = new_status.lower().strip()
        if new_status not in self.VALID_STATUSES:
            return ActionResult(
                status=ActionStatus.CANCELLED,
                success=False,
                error=f"Invalid status. Must be one of: {', '.join(self.VALID_STATUSES)}"
            )
        
        # Get current order
        order = await self.query_one(
            '''
            SELECT order_id, customer_email, customer_name, status, total_amount
            FROM "Order"
            WHERE order_id = $1 AND org_id = $2
            ''',
            int(order_id),
            int(self.org_id)
        )
        
        if not order:
            return ActionResult(
                status=ActionStatus.CANCELLED,
                success=False,
                error=f"Order #{order_id} not found"
            )
        
        current_status = order["status"]
        
        preview_data = {
            "order_id": order_id,
            "customer": order["customer_email"] or order["customer_name"],
            "current_status": current_status,
            "new_status": new_status,
            "total_amount": float(order["total_amount"] or 0)
        }
        
        confirmation_msg = f"""I'll update Order #{order_id}:

**Current Status:** {current_status}
**New Status:** {new_status}
**Customer:** {order['customer_email'] or order['customer_name']}

Do you want me to proceed?"""
        
        return ActionResult(
            status=ActionStatus.PENDING_CONFIRMATION,
            success=True,
            preview_data=preview_data,
            confirmation_message=confirmation_msg
        )
    
    async def confirm(
        self,
        order_id: int,
        new_status: str,
        **kwargs
    ) -> ActionResult:
        """Execute the status update."""
        
        new_status = new_status.lower().strip()
        
        try:
            result = await self.execute_write(
                '''
                UPDATE "Order"
                SET status = $1, updated_at = $2
                WHERE order_id = $3 AND org_id = $4
                RETURNING order_id, status
                ''',
                new_status,
                datetime.utcnow(),
                int(order_id),
                int(self.org_id)
            )
            
            if not result:
                return ActionResult(
                    status=ActionStatus.CANCELLED,
                    success=False,
                    error=f"Order #{order_id} not found or update failed"
                )
            
            return ActionResult(
                status=ActionStatus.EXECUTED,
                success=True,
                result_message=f"✅ Order #{order_id} status updated to '{new_status}'",
                data={"order_id": order_id, "status": new_status}
            )
            
        except Exception as e:
            logger.exception("Failed to update order status")
            return ActionResult(
                status=ActionStatus.CANCELLED,
                success=False,
                error=f"Failed to update status: {str(e)}"
            )


class CancelOrderTool(ActionTool):
    """Cancel an existing order."""
    
    name = "cancel_order"
    description = "Cancel an order with an optional reason"
    action_type = "update"
    required_roles = ["admin", "manager"]
    
    required_fields = ["order_id"]
    field_descriptions = {
        "order_id": "order ID to cancel",
        "reason": "reason for cancellation"
    }
    
    async def preview(
        self,
        order_id: int,
        reason: Optional[str] = None,
        **kwargs
    ) -> ActionResult:
        """Preview the cancellation."""
        
        order = await self.query_one(
            '''
            SELECT order_id, customer_email, customer_name, status, total_amount
            FROM "Order"
            WHERE order_id = $1 AND org_id = $2
            ''',
            int(order_id),
            int(self.org_id)
        )
        
        if not order:
            return ActionResult(
                status=ActionStatus.CANCELLED,
                success=False,
                error=f"Order #{order_id} not found"
            )
        
        if order["status"] == "cancelled":
            return ActionResult(
                status=ActionStatus.CANCELLED,
                success=False,
                error=f"Order #{order_id} is already cancelled"
            )
        
        if order["status"] == "delivered":
            return ActionResult(
                status=ActionStatus.CANCELLED,
                success=False,
                error=f"Cannot cancel Order #{order_id} - it's already delivered"
            )
        
        preview_data = {
            "order_id": order_id,
            "customer": order["customer_email"] or order["customer_name"],
            "current_status": order["status"],
            "total_amount": float(order["total_amount"] or 0),
            "reason": reason
        }
        
        confirmation_msg = f"""⚠️ I'll cancel Order #{order_id}:

**Customer:** {order['customer_email'] or order['customer_name']}
**Current Status:** {order['status']}
**Amount:** ${float(order['total_amount'] or 0):,.2f}
{f'**Reason:** {reason}' if reason else ''}

This action cannot be undone. Do you want to proceed?"""
        
        return ActionResult(
            status=ActionStatus.PENDING_CONFIRMATION,
            success=True,
            preview_data=preview_data,
            confirmation_message=confirmation_msg
        )
    
    async def confirm(
        self,
        order_id: int,
        reason: Optional[str] = None,
        **kwargs
    ) -> ActionResult:
        """Execute the cancellation."""
        
        try:
            notes_update = f"Cancelled: {reason}" if reason else "Cancelled by user"
            
            result = await self.execute_write(
                '''
                UPDATE "Order"
                SET status = 'cancelled', 
                    notes = COALESCE(notes || E'\\n', '') || $1,
                    updated_at = $2
                WHERE order_id = $3 AND org_id = $4
                RETURNING order_id
                ''',
                notes_update,
                datetime.utcnow(),
                int(order_id),
                int(self.org_id)
            )
            
            if not result:
                return ActionResult(
                    status=ActionStatus.CANCELLED,
                    success=False,
                    error=f"Order #{order_id} not found or cancellation failed"
                )
            
            return ActionResult(
                status=ActionStatus.EXECUTED,
                success=True,
                result_message=f"✅ Order #{order_id} has been cancelled.",
                data={"order_id": order_id, "status": "cancelled"}
            )
            
        except Exception as e:
            logger.exception("Failed to cancel order")
            return ActionResult(
                status=ActionStatus.CANCELLED,
                success=False,
                error=f"Failed to cancel order: {str(e)}"
            )


# Export all action tools
ORDERS_ACTION_TOOLS = [
    CreateOrderTool,
    UpdateOrderStatusTool,
    CancelOrderTool,
]


def get_orders_action_tools(auth: AuthContext) -> list[ActionTool]:
    """Get instantiated orders action tools for user."""
    return [ToolClass(auth) for ToolClass in ORDERS_ACTION_TOOLS]
