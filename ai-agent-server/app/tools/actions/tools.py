"""
Action Tools (with User Confirmation)

Tools that modify data and require explicit user confirmation.
All actions are org-scoped and role-restricted (admin/manager only).
"""

from typing import Optional
from datetime import datetime, timezone
import json

from app.tools.base import ActionTool, ActionResult, ActionStatus
from app.auth import AuthContext


class CreateReorderRequestTool(ActionTool):
    """Create a stock reorder request for a product."""
    
    name = "create_reorder_request"
    description = "Create a stock reorder request for products running low. Use product name and warehouse name."
    action_type = "create"
    
    # Admin and manager only
    required_roles = ["admin", "manager"]
    
    # Required fields - now using names instead of IDs
    required_fields = ["product_name", "warehouse_name", "quantity"]
    
    field_descriptions = {
        "product_name": "name of the product to reorder",
        "warehouse_name": "name of the destination warehouse",
        "quantity": "quantity to order",
        "priority": "priority level (normal or urgent)"
    }
    
    async def _lookup_product(self, product_name: str) -> Optional[dict]:
        """Look up product by name (fuzzy match)."""
        # Try exact match first
        product = await self.query_one(
            '''SELECT product_id, name, sku FROM "Product" 
               WHERE org_id = $1 AND LOWER(name) = LOWER($2)''',
            int(self.org_id), product_name
        )
        if product:
            return product
        
        # Try ILIKE fuzzy match
        product = await self.query_one(
            '''SELECT product_id, name, sku FROM "Product" 
               WHERE org_id = $1 AND name ILIKE $2
               ORDER BY LENGTH(name) ASC
               LIMIT 1''',
            int(self.org_id), f"%{product_name}%"
        )
        return product
    
    async def _lookup_warehouse(self, warehouse_name: str) -> Optional[dict]:
        """Look up warehouse by name (fuzzy match)."""
        # Try exact match first
        warehouse = await self.query_one(
            '''SELECT warehouse_id, name FROM "Warehouse" 
               WHERE org_id = $1 AND LOWER(name) = LOWER($2)''',
            int(self.org_id), warehouse_name
        )
        if warehouse:
            return warehouse
        
        # Try ILIKE fuzzy match
        warehouse = await self.query_one(
            '''SELECT warehouse_id, name FROM "Warehouse" 
               WHERE org_id = $1 AND name ILIKE $2
               ORDER BY LENGTH(name) ASC
               LIMIT 1''',
            int(self.org_id), f"%{warehouse_name}%"
        )
        return warehouse
    
    async def preview(
        self,
        product_name: str,
        warehouse_name: str,
        quantity: int,
        priority: str = "normal",
        notes: Optional[str] = None
    ) -> ActionResult:
        """Preview the reorder request before creation."""
        
        # Look up product by name
        product = await self._lookup_product(product_name)
        
        if not product:
            # Get suggestions for valid products
            suggestions = await self.query(
                '''SELECT name FROM "Product" WHERE org_id = $1 ORDER BY name LIMIT 5''',
                int(self.org_id)
            )
            suggestion_names = [s["name"] for s in suggestions] if suggestions else []
            error_msg = f"Product '{product_name}' not found."
            if suggestion_names:
                error_msg += f" Did you mean: {', '.join(suggestion_names[:3])}?"
            
            return ActionResult(
                status=ActionStatus.CANCELLED,
                success=False,
                error=error_msg
            )
        
        # Look up warehouse by name
        warehouse = await self._lookup_warehouse(warehouse_name)
        
        if not warehouse:
            # Get suggestions for valid warehouses
            suggestions = await self.query(
                '''SELECT name FROM "Warehouse" WHERE org_id = $1 ORDER BY name''',
                int(self.org_id)
            )
            suggestion_names = [s["name"] for s in suggestions] if suggestions else []
            error_msg = f"Warehouse '{warehouse_name}' not found."
            if suggestion_names:
                error_msg += f" Available warehouses: {', '.join(suggestion_names)}"
            
            return ActionResult(
                status=ActionStatus.CANCELLED,
                success=False,
                error=error_msg
            )
        
        product_id = product["product_id"]
        warehouse_id = warehouse["warehouse_id"]
        
        # Get current stock for context
        current_stock = await self.query_one(
            '''SELECT COALESCE(quantity, 0) as qty FROM "ProductStock"
               WHERE product_id = $1 AND warehouse_id = $2''',
            product_id, warehouse_id
        )
        current_qty = current_stock["qty"] if current_stock else 0
        
        preview_data = {
            "product_id": str(product_id),
            "product_name": product["name"],
            "product_sku": product["sku"],
            "warehouse_id": str(warehouse_id),
            "warehouse_name": warehouse["name"],
            "current_stock": current_qty,
            "quantity_to_order": quantity,
            "priority": priority,
            "notes": notes
        }
        
        confirmation_msg = (
            f"Create reorder request for **{quantity} units** of "
            f"**{product['name']}** ({product['sku']}) "
            f"to be delivered to **{warehouse['name']}**?\n\n"
            f"Current stock: {current_qty} units\n"
            f"Priority: {priority.upper()}"
        )
        
        return ActionResult(
            status=ActionStatus.PENDING_CONFIRMATION,
            success=True,
            preview_data=preview_data,
            confirmation_message=confirmation_msg
        )
    
    async def confirm(
        self,
        product_name: str,
        warehouse_name: str,
        quantity: int,
        priority: str = "normal",
        notes: Optional[str] = None
    ) -> ActionResult:
        """Create the reorder request."""
        
        # Look up IDs again (in case of direct confirm call)
        product = await self._lookup_product(product_name)
        warehouse = await self._lookup_warehouse(warehouse_name)
        
        if not product or not warehouse:
            return ActionResult(
                status=ActionStatus.CANCELLED,
                success=False,
                error="Product or warehouse not found"
            )
        
        product_id = product["product_id"]
        warehouse_id = warehouse["warehouse_id"]
        
        # Insert reorder request
        try:
            result = await self.execute_write(
                '''INSERT INTO "ReorderRequest" 
                   (org_id, product_id, warehouse_id, quantity, priority, 
                    status, notes, requested_by, created_at)
                   VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, $8)
                   RETURNING reorder_request_id''',
                int(self.org_id),
                product_id,
                warehouse_id,
                quantity,
                priority,
                notes,
                self.auth.db_user_id,
                datetime.utcnow()
            )
            
            request_id = result["reorder_request_id"] if result else None
            
            return ActionResult(
                status=ActionStatus.EXECUTED,
                success=True,
                created_id=str(request_id) if request_id else None,
                result_message=f"Reorder request #{request_id} created for {product['name']} → {warehouse['name']}",
                data={
                    "reorder_request_id": str(request_id) if request_id else None,
                    "product_name": product["name"],
                    "warehouse_name": warehouse["name"],
                    "quantity": quantity,
                    "priority": priority,
                    "status": "pending"
                }
            )
            
        except Exception as e:
            # If ReorderRequest table doesn't exist, provide helpful error
            if "ReorderRequest" in str(e) and "does not exist" in str(e):
                return ActionResult(
                    status=ActionStatus.CANCELLED,
                    success=False,
                    error="Reorder request functionality requires database migration. Please create the ReorderRequest table first."
                )
            raise


class UpdateOrderStatusTool(ActionTool):
    """Update the status of an order."""
    
    name = "update_order_status"
    description = "Update order status with optional notes"
    action_type = "update"
    
    required_roles = ["admin", "manager"]
    required_fields = ["order_id", "new_status"]
    
    field_descriptions = {
        "order_id": "order to update",
        "new_status": "new status (pending, processing, shipped, delivered, cancelled)",
        "notes": "optional notes about the status change"
    }
    
    VALID_STATUSES = ["pending", "processing", "shipped", "delivered", "cancelled"]
    
    async def preview(
        self,
        order_id: int,
        new_status: str,
        notes: Optional[str] = None
    ) -> ActionResult:
        """Preview the status update."""
        
        # Validate status
        if new_status.lower() not in self.VALID_STATUSES:
            return ActionResult(
                status=ActionStatus.CANCELLED,
                success=False,
                error=f"Invalid status. Must be one of: {', '.join(self.VALID_STATUSES)}"
            )
        
        # Get order details
        order = await self.query_one(
            '''SELECT order_id, customer_name, customer_email, status, 
                      total_amount, order_date
               FROM "Order" 
               WHERE order_id = $1 AND org_id = $2''',
            order_id, int(self.org_id)
        )
        
        if not order:
            return ActionResult(
                status=ActionStatus.CANCELLED,
                success=False,
                error=f"Order #{order_id} not found"
            )
        
        current_status = order["status"]
        
        # Check if status change is logical
        status_warnings = []
        if current_status == new_status.lower():
            return ActionResult(
                status=ActionStatus.CANCELLED,
                success=False,
                error=f"Order is already '{current_status}'"
            )
        
        if current_status == "cancelled":
            status_warnings.append("⚠️ Updating a cancelled order")
        
        if current_status == "delivered" and new_status != "cancelled":
            status_warnings.append("⚠️ Order already delivered")
        
        preview_data = {
            "order_id": str(order_id),
            "customer_name": order["customer_name"],
            "customer_email": order["customer_email"],
            "current_status": current_status,
            "new_status": new_status.lower(),
            "total_amount": float(order["total_amount"]) if order["total_amount"] else 0,
            "order_date": order["order_date"].isoformat() if order["order_date"] else None,
            "notes": notes,
            "warnings": status_warnings
        }
        
        warning_text = "\n".join(status_warnings) + "\n\n" if status_warnings else ""
        
        confirmation_msg = (
            f"{warning_text}"
            f"Update order **#{order_id}** for **{order['customer_name']}**?\n\n"
            f"Status change: **{current_status}** → **{new_status.lower()}**\n"
            f"Order total: ${float(order['total_amount'] or 0):,.2f}"
        )
        
        if notes:
            confirmation_msg += f"\nNotes: {notes}"
        
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
        notes: Optional[str] = None
    ) -> ActionResult:
        """Execute the status update."""
        
        updated_at = datetime.now(timezone.utc)
        
        await self.execute_write(
            '''UPDATE "Order" 
               SET status = $1, notes = COALESCE($2, notes), updated_at = $3
               WHERE order_id = $4 AND org_id = $5''',
            new_status.lower(),
            notes,
            updated_at,
            order_id,
            int(self.org_id)
        )
        
        return ActionResult(
            status=ActionStatus.EXECUTED,
            success=True,
            result_message=f"Order #{order_id} status updated to '{new_status.lower()}'",
            data={
                "order_id": str(order_id),
                "new_status": new_status.lower(),
                "updated_at": updated_at.isoformat()
            }
        )


class GenerateReportTool(ActionTool):
    """Generate an exportable report."""
    
    name = "generate_report"
    description = "Generate sales, inventory, or orders report"
    action_type = "create"
    
    required_roles = ["admin", "manager", "analyst"]
    required_fields = ["report_type", "period"]
    
    field_descriptions = {
        "report_type": "report type (sales, inventory, or orders)",
        "period": "time period (day, week, month, quarter)",
        "format": "output format (json or csv)"
    }
    
    VALID_REPORT_TYPES = ["sales", "inventory", "orders"]
    VALID_PERIODS = ["day", "week", "month", "quarter"]
    
    async def preview(
        self,
        report_type: str,
        period: str,
        format: str = "json"
    ) -> ActionResult:
        """Preview report generation."""
        
        if report_type.lower() not in self.VALID_REPORT_TYPES:
            return ActionResult(
                status=ActionStatus.CANCELLED,
                success=False,
                error=f"Invalid report type. Must be one of: {', '.join(self.VALID_REPORT_TYPES)}"
            )
        
        if period.lower() not in self.VALID_PERIODS:
            return ActionResult(
                status=ActionStatus.CANCELLED,
                success=False,
                error=f"Invalid period. Must be one of: {', '.join(self.VALID_PERIODS)}"
            )
        
        # Estimate report size
        period_days = {"day": 1, "week": 7, "month": 30, "quarter": 90}
        days = period_days.get(period.lower(), 30)
        
        if report_type.lower() == "sales":
            count_query = '''SELECT COUNT(*) as cnt FROM "Order" 
                            WHERE org_id = $1 AND order_date >= NOW() - $2::interval'''
        elif report_type.lower() == "inventory":
            count_query = '''SELECT COUNT(DISTINCT product_id) as cnt FROM "ProductStock" ps
                            JOIN "Product" p ON p.product_id = ps.product_id
                            WHERE p.org_id = $1'''
        else:  # orders
            count_query = '''SELECT COUNT(*) as cnt FROM "Order" 
                            WHERE org_id = $1 AND order_date >= NOW() - $2::interval'''
        
        count_result = await self.query_one(
            count_query, int(self.org_id), f"{days} days"
        )
        estimated_rows = count_result["cnt"] if count_result else 0
        
        preview_data = {
            "report_type": report_type.lower(),
            "period": period.lower(),
            "period_days": days,
            "format": format.lower(),
            "estimated_rows": estimated_rows
        }
        
        confirmation_msg = (
            f"Generate **{report_type.capitalize()} Report** for the last **{period}**?\n\n"
            f"Format: {format.upper()}\n"
            f"Estimated data points: ~{estimated_rows}"
        )
        
        return ActionResult(
            status=ActionStatus.PENDING_CONFIRMATION,
            success=True,
            preview_data=preview_data,
            confirmation_message=confirmation_msg
        )
    
    async def confirm(
        self,
        report_type: str,
        period: str,
        format: str = "json"
    ) -> ActionResult:
        """Generate the report."""
        
        period_days = {"day": 1, "week": 7, "month": 30, "quarter": 90}
        days = period_days.get(period.lower(), 30)
        
        from datetime import timedelta
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        
        if report_type.lower() == "sales":
            data = await self._generate_sales_report(cutoff)
        elif report_type.lower() == "inventory":
            data = await self._generate_inventory_report()
        else:
            data = await self._generate_orders_report(cutoff)
        
        report_data = {
            "report_type": report_type.lower(),
            "period": period.lower(),
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "org_id": str(self.org_id),
            "data": data
        }
        
        if format.lower() == "csv":
            csv_content = self._to_csv(data)
            report_data["csv_content"] = csv_content
        
        return ActionResult(
            status=ActionStatus.EXECUTED,
            success=True,
            result_message=f"{report_type.capitalize()} report generated with {len(data)} records",
            data=report_data
        )
    
    async def _generate_sales_report(self, cutoff: datetime) -> list[dict]:
        """Generate sales report data."""
        results = await self.query(
            '''SELECT 
                DATE(order_date) as date,
                COUNT(*) as orders,
                COALESCE(SUM(total_amount), 0) as revenue,
                COUNT(DISTINCT customer_email) as customers
               FROM "Order"
               WHERE org_id = $1 AND order_date >= $2
               GROUP BY DATE(order_date)
               ORDER BY date''',
            int(self.org_id), cutoff
        )
        
        return [
            {
                "date": r["date"].isoformat() if r["date"] else None,
                "orders": r["orders"],
                "revenue": float(r["revenue"]),
                "customers": r["customers"]
            }
            for r in results
        ]
    
    async def _generate_inventory_report(self) -> list[dict]:
        """Generate inventory report data."""
        results = await self.query(
            '''SELECT 
                p.name as product,
                p.sku,
                w.name as warehouse,
                COALESCE(ps.quantity, 0) as quantity,
                pp.actual_price as price
               FROM "Product" p
               LEFT JOIN "ProductStock" ps ON ps.product_id = p.product_id
               LEFT JOIN "Warehouse" w ON w.warehouse_id = ps.warehouse_id
               LEFT JOIN "ProductPrice" pp ON pp.product_id = p.product_id
               WHERE p.org_id = $1
               ORDER BY p.name, w.name''',
            int(self.org_id)
        )
        
        return [
            {
                "product": r["product"],
                "sku": r["sku"],
                "warehouse": r["warehouse"],
                "quantity": r["quantity"],
                "price": float(r["price"]) if r["price"] else None
            }
            for r in results
        ]
    
    async def _generate_orders_report(self, cutoff: datetime) -> list[dict]:
        """Generate orders report data."""
        results = await self.query(
            '''SELECT 
                order_id,
                customer_name,
                customer_email,
                status,
                total_amount,
                order_date
               FROM "Order"
               WHERE org_id = $1 AND order_date >= $2
               ORDER BY order_date DESC''',
            int(self.org_id), cutoff
        )
        
        return [
            {
                "order_id": str(r["order_id"]),
                "customer": r["customer_name"],
                "email": r["customer_email"],
                "status": r["status"],
                "total": float(r["total_amount"]) if r["total_amount"] else 0,
                "date": r["order_date"].isoformat() if r["order_date"] else None
            }
            for r in results
        ]
    
    def _to_csv(self, data: list[dict]) -> str:
        """Convert data to CSV string."""
        if not data:
            return ""
        
        headers = list(data[0].keys())
        lines = [",".join(headers)]
        
        for row in data:
            values = [str(row.get(h, "")) for h in headers]
            lines.append(",".join(values))
        
        return "\n".join(lines)


class CreateOrderTool(ActionTool):
    """Create a new order for a customer."""
    
    name = "create_order"
    description = "Create a new customer order with products. Use product names and quantities."
    action_type = "create"
    
    required_roles = ["admin", "manager"]
    required_fields = ["customer_name", "customer_email", "items", "payment_method", "shipping_address"]
    
    field_descriptions = {
        "customer_name": "customer's full name",
        "customer_email": "customer's email address",
        "items": "products and quantities (e.g., 'iPhone 17 Pro Max x2, Samsung Galaxy x1')",
        "payment_method": "payment method (cash, card, bank_transfer, upi, etc.)",
        "shipping_address": "shipping address (street, city, state, zip code)",
        "customer_phone": "customer's phone number (optional)",
        "notes": "any special instructions or notes (optional)"
    }
    
    async def _lookup_product(self, product_name: str) -> Optional[dict]:
        """Look up product by name with pricing."""
        # Try exact match first
        product = await self.query_one(
            '''SELECT p.product_id, p.name, p.sku, 
                      COALESCE(pp.actual_price, 0) as price
               FROM "Product" p
               LEFT JOIN "ProductPrice" pp ON pp.product_id = p.product_id
               WHERE p.org_id = $1 AND LOWER(p.name) = LOWER($2)''',
            int(self.org_id), product_name
        )
        if product:
            return product
        
        # Try ILIKE fuzzy match
        product = await self.query_one(
            '''SELECT p.product_id, p.name, p.sku,
                      COALESCE(pp.actual_price, 0) as price
               FROM "Product" p
               LEFT JOIN "ProductPrice" pp ON pp.product_id = p.product_id
               WHERE p.org_id = $1 AND p.name ILIKE $2
               ORDER BY LENGTH(p.name) ASC
               LIMIT 1''',
            int(self.org_id), f"%{product_name}%"
        )
        return product
    
    def _parse_items(self, items_input) -> list[dict]:
        """Parse items from various input formats."""
        parsed = []
        
        # Handle list of dicts directly
        if isinstance(items_input, list):
            for item in items_input:
                if isinstance(item, dict):
                    parsed.append({
                        "product_name": item.get("product_name") or item.get("name") or item.get("product"),
                        "quantity": int(item.get("quantity", 1))
                    })
                elif isinstance(item, str):
                    # Parse "Product Name x3" format
                    if " x" in item.lower():
                        parts = item.lower().rsplit(" x", 1)
                        name = parts[0].strip()
                        qty = int(parts[1].strip()) if parts[1].strip().isdigit() else 1
                    else:
                        name = item.strip()
                        qty = 1
                    parsed.append({"product_name": name, "quantity": qty})
        
        # Handle comma-separated string
        elif isinstance(items_input, str):
            for item in items_input.split(","):
                item = item.strip()
                if not item:
                    continue
                if " x" in item.lower():
                    parts = item.lower().rsplit(" x", 1)
                    name = parts[0].strip()
                    qty = int(parts[1].strip()) if parts[1].strip().isdigit() else 1
                else:
                    name = item
                    qty = 1
                parsed.append({"product_name": name, "quantity": qty})
        
        return parsed
    
    async def preview(
        self,
        customer_name: str,
        customer_email: str,
        items: any,
        customer_phone: Optional[str] = None,
        shipping_address: Optional[str] = None,
        notes: Optional[str] = None,
        payment_method: Optional[str] = None
    ) -> ActionResult:
        """Preview order before creation."""
        
        # Parse items
        parsed_items = self._parse_items(items)
        
        if not parsed_items:
            return ActionResult(
                status=ActionStatus.CANCELLED,
                success=False,
                error="No valid items provided. Use format: 'Product Name x2, Another Product x1'"
            )
        
        # Look up each product and calculate totals
        order_items = []
        total_amount = 0
        errors = []
        
        for item in parsed_items:
            product = await self._lookup_product(item["product_name"])
            
            if not product:
                errors.append(f"Product '{item['product_name']}' not found")
                continue
            
            item_total = float(product["price"] or 0) * item["quantity"]
            total_amount += item_total
            
            order_items.append({
                "product_id": product["product_id"],
                "product_name": product["name"],
                "sku": product["sku"],
                "quantity": item["quantity"],
                "unit_price": float(product["price"] or 0),
                "item_total": item_total
            })
        
        if errors:
            # Get product suggestions
            suggestions = await self.query(
                '''SELECT name FROM "Product" WHERE org_id = $1 ORDER BY name LIMIT 5''',
                int(self.org_id)
            )
            suggestion_names = [s["name"] for s in suggestions] if suggestions else []
            error_msg = ". ".join(errors)
            if suggestion_names:
                error_msg += f". Available products: {', '.join(suggestion_names[:3])}"
            
            return ActionResult(
                status=ActionStatus.CANCELLED,
                success=False,
                error=error_msg
            )
        
        preview_data = {
            "customer_name": customer_name,
            "customer_email": customer_email,
            "customer_phone": customer_phone,
            "items": order_items,
            "item_count": len(order_items),
            "total_units": sum(i["quantity"] for i in order_items),
            "total_amount": total_amount,
            "shipping_address": shipping_address,
            "payment_method": payment_method,
            "notes": notes
        }
        
        # Build confirmation message
        items_summary = "\n".join([
            f"  • {i['product_name']} x{i['quantity']} @ ${i['unit_price']:,.2f} = ${i['item_total']:,.2f}"
            for i in order_items
        ])
        
        confirmation_msg = (
            f"Create order for **{customer_name}** ({customer_email})?\n\n"
            f"**Order Items:**\n{items_summary}\n\n"
            f"**Total: ${total_amount:,.2f}**"
        )
        
        if payment_method:
            confirmation_msg += f"\nPayment: {payment_method}"
        if shipping_address:
            confirmation_msg += f"\nShipping: {shipping_address}"
        
        return ActionResult(
            status=ActionStatus.PENDING_CONFIRMATION,
            success=True,
            preview_data=preview_data,
            confirmation_message=confirmation_msg
        )
    
    async def confirm(
        self,
        customer_name: str,
        customer_email: str,
        items: any,
        customer_phone: Optional[str] = None,
        shipping_address: Optional[str] = None,
        notes: Optional[str] = None,
        payment_method: Optional[str] = None
    ) -> ActionResult:
        """Create the order."""
        
        # Re-parse and lookup items
        parsed_items = self._parse_items(items)
        
        order_items = []
        total_amount = 0
        
        for item in parsed_items:
            product = await self._lookup_product(item["product_name"])
            if not product:
                return ActionResult(
                    status=ActionStatus.CANCELLED,
                    success=False,
                    error=f"Product '{item['product_name']}' not found"
                )
            
            item_total = float(product["price"] or 0) * item["quantity"]
            total_amount += item_total
            
            order_items.append({
                "product_id": product["product_id"],
                "price": float(product["price"] or 0),
                "quantity": item["quantity"]
            })
        
        # Parse shipping address if provided
        shipping_parts = {}
        if shipping_address:
            # Simple split by comma
            parts = [p.strip() for p in shipping_address.split(",")]
            if len(parts) >= 1:
                shipping_parts["street"] = parts[0]
            if len(parts) >= 2:
                shipping_parts["city"] = parts[1]
            if len(parts) >= 3:
                shipping_parts["state"] = parts[2]
            if len(parts) >= 4:
                shipping_parts["zip"] = parts[3]
        
        try:
            # Create order
            order_result = await self.execute_write(
                '''INSERT INTO "Order" 
                   (org_id, placed_by, order_date, status, total_amount,
                    customer_name, customer_email, customer_phone,
                    shipping_street, shipping_city, shipping_state, shipping_zip,
                    notes, payment_method, created_at)
                   VALUES ($1, $2, $3, 'pending', $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                   RETURNING order_id''',
                int(self.org_id),
                self.auth.db_user_id,
                datetime.utcnow(),
                total_amount,
                customer_name,
                customer_email,
                customer_phone,
                shipping_parts.get("street"),
                shipping_parts.get("city"),
                shipping_parts.get("state"),
                shipping_parts.get("zip"),
                notes,
                payment_method,
                datetime.utcnow()
            )
            
            order_id = order_result["order_id"] if order_result else None
            
            if not order_id:
                return ActionResult(
                    status=ActionStatus.CANCELLED,
                    success=False,
                    error="Failed to create order"
                )
            
            # Create order items
            for item in order_items:
                await self.execute_write(
                    '''INSERT INTO "OrderItem" 
                       (order_id, product_id, quantity, price_at_order)
                       VALUES ($1, $2, $3, $4)''',
                    order_id,
                    item["product_id"],
                    item["quantity"],
                    item["price"]
                )
            
            return ActionResult(
                status=ActionStatus.EXECUTED,
                success=True,
                created_id=str(order_id),
                result_message=f"Order #{order_id} created for {customer_name} - ${total_amount:,.2f}",
                data={
                    "order_id": str(order_id),
                    "customer_name": customer_name,
                    "customer_email": customer_email,
                    "total_amount": total_amount,
                    "item_count": len(order_items),
                    "status": "pending"
                }
            )
            
        except Exception as e:
            return ActionResult(
                status=ActionStatus.CANCELLED,
                success=False,
                error=f"Failed to create order: {str(e)}"
            )


# Export all action tools
ACTION_TOOLS = [
    CreateReorderRequestTool,
    UpdateOrderStatusTool,
    GenerateReportTool,
    CreateOrderTool,
]


def get_action_tools(auth: AuthContext) -> list[ActionTool]:
    """Get instantiated action tools for user."""
    return [ToolClass(auth) for ToolClass in ACTION_TOOLS]

