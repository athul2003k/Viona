"""
Action Handler Module

Handles the execution of action tools with confirmation workflow.
This module provides utilities for agents to:
1. Detect if user wants to perform an action
2. Handle the confirmation workflow
3. Execute confirmed actions
"""

import re
from typing import Optional
from dataclasses import dataclass

from app.tools import ActionTool, ActionResult, ActionStatus


@dataclass
class ActionIntent:
    """Detected action intent from user message."""
    action_type: str  # create_order, update_stock, etc.
    is_confirmation: bool  # User said "yes" to previous action
    is_cancellation: bool  # User said "no" to previous action
    extracted_params: dict  # Any parameters extracted from message


# Patterns for detecting action intents
ACTION_PATTERNS = {
    "create_order": [
        r"create\s+(?:an?\s+)?order",
        r"place\s+(?:an?\s+)?order",
        r"new\s+order\s+for",
        r"order\s+(?:for|from)",
    ],
    "update_order_status": [
        r"update\s+order\s+(?:status|#?\d+)",
        r"change\s+order\s+status",
        r"mark\s+order\s+(?:as\s+)?(?:shipped|delivered|pending)",
        r"ship\s+order",
    ],
    "cancel_order": [
        r"cancel\s+order",
        r"cancel\s+#?\d+",
    ],
    "add_product": [
        r"add\s+(?:a\s+)?(?:new\s+)?product",
        r"create\s+(?:a\s+)?(?:new\s+)?product",
        r"new\s+product",
    ],
    "update_product": [
        r"update\s+product",
        r"change\s+product",
        r"modify\s+product",
        r"edit\s+product",
    ],
    "update_stock": [
        r"update\s+stock",
        r"set\s+stock",
        r"change\s+stock",
        r"adjust\s+(?:stock|inventory)",
        r"add\s+stock",
        r"remove\s+stock",
    ],
    "transfer_stock": [
        r"transfer\s+(?:stock|inventory)",
        r"move\s+(?:stock|inventory)",
        r"transfer\s+\d+\s+(?:units|items)",
    ],
}

CONFIRMATION_PATTERNS = [
    r"^yes$",
    r"^yes[,!.]",
    r"^yeah",
    r"^yep",
    r"^sure",
    r"^confirm",
    r"^do it",
    r"^proceed",
    r"^go ahead",
    r"^ok\s*$",
    r"^okay",
]

CANCELLATION_PATTERNS = [
    r"^no$",
    r"^no[,!.]",
    r"^nope",
    r"^cancel",
    r"^don't",
    r"^never\s*mind",
    r"^stop",
]


def detect_action_intent(user_message: str, pending_action: Optional[str] = None) -> Optional[ActionIntent]:
    """
    Detect if user message indicates an action intent.
    
    Args:
        user_message: The user's message
        pending_action: If there's a pending action awaiting confirmation
        
    Returns:
        ActionIntent if action detected, None otherwise
    """
    message_lower = user_message.lower().strip()
    
    # Check for confirmation/cancellation if there's a pending action
    if pending_action:
        for pattern in CONFIRMATION_PATTERNS:
            if re.search(pattern, message_lower, re.IGNORECASE):
                return ActionIntent(
                    action_type=pending_action,
                    is_confirmation=True,
                    is_cancellation=False,
                    extracted_params={}
                )
        
        for pattern in CANCELLATION_PATTERNS:
            if re.search(pattern, message_lower, re.IGNORECASE):
                return ActionIntent(
                    action_type=pending_action,
                    is_confirmation=False,
                    is_cancellation=True,
                    extracted_params={}
                )
    
    # Check for new action intents
    for action_type, patterns in ACTION_PATTERNS.items():
        for pattern in patterns:
            if re.search(pattern, message_lower, re.IGNORECASE):
                params = extract_action_params(message_lower, action_type)
                return ActionIntent(
                    action_type=action_type,
                    is_confirmation=False,
                    is_cancellation=False,
                    extracted_params=params
                )
    
    return None


def extract_action_params(message: str, action_type: str) -> dict:
    """
    Extract parameters from message for a specific action type.
    
    IMPORTANT: Only extract parameters that the specific action_type accepts!
    Different tools have different signatures.
    """
    params = {}
    message_lower = message.lower()
    
    # Define which params each action type accepts
    ALLOWED_PARAMS = {
        "create_order": ["customer_name", "customer_email", "items", "customer_phone", 
                        "shipping_address", "notes", "payment_method"],
        "update_order_status": ["order_id", "new_status", "notes"],
        "create_reorder_request": ["product_name", "warehouse_name", "quantity", "priority", "notes"],
        "generate_report": ["report_type", "period", "format"],
    }
    
    allowed = ALLOWED_PARAMS.get(action_type, [])
    
    # === Extract email ===
    if "customer_email" in allowed:
        email_match = re.search(r'[\w\.-]+@[\w\.-]+\.\w+', message)
        if email_match:
            params['customer_email'] = email_match.group()
    
    # === Extract customer name ===
    if "customer_name" in allowed:
        name_patterns = [
            r'(?:for|customer)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+?)(?:\s+with|\s+email|\s+at\s+|\s*,|\s*$)',
            r'(?:customer[:\s]+)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)',
            r'(?:name[:\s]+)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)',
        ]
        for pattern in name_patterns:
            name_match = re.search(pattern, message)
            if name_match:
                params['customer_name'] = name_match.group(1).strip()
                break
    
    # === Extract order ID ===
    if "order_id" in allowed:
        order_id_match = re.search(r'(?:order\s*#?\s*|#)(\d+)', message, re.IGNORECASE)
        if order_id_match:
            params['order_id'] = int(order_id_match.group(1))
    
    # === Extract items for create_order ===
    if "items" in allowed:
        items = []
        # Try "X unit(s) of [product]"
        simple_match = re.search(
            r'(\d+)\s*(?:units?|pcs?|items?)\s+(?:of\s+)?([^,\.\n]+?)(?:\s*,|\s*$|\s+shipping|\s+payment)',
            message, re.IGNORECASE
        )
        if simple_match:
            qty = int(simple_match.group(1))
            product = simple_match.group(2).strip()
            # Clean up the product name - remove quotes and "sku" prefix
            product = re.sub(r'^sku\s*[:\s]*', '', product, flags=re.IGNORECASE)
            product = product.strip('"\'')
            items.append({"product_name": product, "quantity": qty})
        
        if items:
            params['items'] = items
    
    # === Extract order status ===
    if "new_status" in allowed:
        for status in ['pending', 'processing', 'shipped', 'delivered', 'cancelled']:
            if status in message_lower:
                params['new_status'] = status
                break
    
    # === Extract shipping address (combined string) ===
    if "shipping_address" in allowed:
        shipping_match = re.search(
            r'shipping\s+to\s+([^,]+),\s*([^,]+),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?),?\s*([A-Za-z]+)?',
            message, re.IGNORECASE
        )
        if shipping_match:
            street = shipping_match.group(1).strip()
            city = shipping_match.group(2).strip()
            state = shipping_match.group(3).upper()
            zip_code = shipping_match.group(4)
            country = shipping_match.group(5).strip() if shipping_match.group(5) else None
            
            combined = f"{street}, {city}, {state} {zip_code}"
            if country:
                combined += f", {country}"
            params['shipping_address'] = combined
    
    # === Extract payment method ===
    if "payment_method" in allowed:
        payment_match = re.search(
            r'payment\s*(?:method)?[:\s]+([a-zA-Z_]+(?:\s+transfer)?)',
            message, re.IGNORECASE
        )
        if payment_match:
            method = payment_match.group(1).strip().lower()
            method_map = {
                'upi': 'upi', 'card': 'card', 'cash': 'cash', 'cod': 'cash',
                'bank': 'bank_transfer', 'bank transfer': 'bank_transfer',
            }
            params['payment_method'] = method_map.get(method, method)
    
    # === Extract quantity (for reorder requests) ===
    if "quantity" in allowed:
        qty_match = re.search(r'(\d+)\s*(?:units?|items?|pcs?)', message, re.IGNORECASE)
        if qty_match:
            params['quantity'] = int(qty_match.group(1))
    
    # === Extract warehouse/product names (for reorder requests) ===
    if "warehouse_name" in allowed:
        wh_match = re.search(r'(?:to|at|in)\s+warehouse\s+["\']?([^"\']+)["\']?', message, re.IGNORECASE)
        if wh_match:
            params['warehouse_name'] = wh_match.group(1).strip()
    
    if "product_name" in allowed:
        prod_match = re.search(r'(?:for|of)\s+["\']?([^"\']+)["\']?\s+(?:to|at)', message, re.IGNORECASE)
        if prod_match:
            params['product_name'] = prod_match.group(1).strip()
    
    # === Extract report params ===
    if "report_type" in allowed:
        for rt in ['sales', 'inventory', 'orders']:
            if rt in message_lower:
                params['report_type'] = rt
                break
    
    if "period" in allowed:
        for p in ['day', 'week', 'month', 'quarter']:
            if p in message_lower:
                params['period'] = p
                break
    
    return params


def format_action_response(result: ActionResult) -> str:
    """Format action result for display to user."""
    if result.status == ActionStatus.MISSING_DATA:
        return result.prompt_message or f"I need more information: {', '.join(result.missing_fields)}"
    
    elif result.status == ActionStatus.PENDING_CONFIRMATION:
        return result.confirmation_message or "Do you want me to proceed with this action?"
    
    elif result.status == ActionStatus.EXECUTED:
        return result.result_message or "Action completed successfully!"
    
    elif result.status == ActionStatus.CANCELLED:
        if result.error:
            return f"Action cancelled: {result.error}"
        return "Okay, I've cancelled that action."
    
    return str(result.data or result.error or "Action result unknown")


def get_action_tool(action_type: str, auth) -> Optional[ActionTool]:
    """Get the appropriate action tool for an action type."""
    from app.tools.actions import get_action_tools
    
    # Get all action tools
    tools = get_action_tools(auth)
    
    for tool in tools:
        if tool.name == action_type:
            return tool
    
    return None

