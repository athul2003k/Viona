"""
Intent Classification

Fast, lightweight intent classification for routing.
Uses small model for speed and cost efficiency.
Supports broad business question categories.
"""

from typing import Optional
from pydantic import BaseModel, Field

from langchain_core.messages import HumanMessage, SystemMessage

from app.llms import get_model_for_task


class IntentClassification(BaseModel):
    """Structured output for intent classification."""
    intent: str = Field(description="The classified intent category")
    confidence: float = Field(ge=0.0, le=1.0, description="Confidence score")
    reasoning: str = Field(description="Brief explanation of classification")


INTENT_CLASSIFICATION_PROMPT = """You are an intent classifier for Viona, a business agent.

Classify the user's message into ONE of these categories:

- analytics: Questions about business performance, trends, metrics, revenue, growth, forecasts, predictions, alerts, anomalies, how business is doing
- inventory: Questions about products, stock, warehouses, SKUs, low stock, overstock, items, supply chain. Also: ADD product, UPDATE product, UPDATE stock, TRANSFER stock
- orders: Questions about orders, sales, customers, order status, purchases, fulfilment. Also: CREATE order, UPDATE order, CANCEL order, SEARCH orders, customer history
- planning: Requests for business advice, strategy, planning, recommendations, how to grow, improvements, opportunities, goals, budget, next steps, what to focus on
- general: ONLY for greetings like "hi" or "hello" with no question, or questions about what you can do, or questions completely unrelated to business

IMPORTANT ACTION DETECTION:
- "Create an order for..." → orders
- "Add a new product..." → inventory
- "Update stock for..." → inventory
- "Transfer stock..." → inventory  
- "Cancel order #..." → orders
- "Update order status..." → orders

ANALYTICS DETECTION:
- "How's my business?" → analytics
- "What's the status?" → analytics
- "Give me an overview" → analytics
- "Show me alerts" → analytics
- "When will SKU run out?" → analytics
- "What should I reorder?" → analytics
- "Generate report" → analytics

PLANNING DETECTION:
- "How can I grow my business?" → planning
- "What should I focus on?" → planning
- "Give me advice" → planning
- "Help me plan" → planning
- "What's my best strategy?" → planning
- "Set a revenue goal" → planning
- "How do I increase sales?" → planning

GENERAL DETECTION:
- "What can you do?" → general
- "Hello" → general
- "How to cook pasta" → general (not business-related)

If the user asks ANYTHING about their business data OR wants to perform an action, always classify as analytics, inventory, orders, or planning.
Only use 'general' for pure greetings, meta questions about Viona itself, or completely non-business topics.
"""


async def classify_intent(user_message: str) -> IntentClassification:
    """
    Classify user intent using fast model.
    
    Uses small model (llama-3.1-8b-instant) for speed and cost efficiency.
    """
    model, config = get_model_for_task("routing")
    model = model.with_structured_output(IntentClassification)
    
    messages = [
        SystemMessage(content=INTENT_CLASSIFICATION_PROMPT),
        HumanMessage(content=f"User message: {user_message}")
    ]
    
    result = await model.ainvoke(messages)
    return result


# Intent to agent mapping
INTENT_AGENT_MAP = {
    "analytics": "analytics_agent",
    "inventory": "inventory_agent",
    "orders": "orders_agent",
    "planning": "analytics_agent",   # Planning uses analytics agent with enhanced prompts
    "insights": "analytics_agent",   # Legacy compatibility
    "general": "general_agent",
}


def get_agent_for_intent(intent: str) -> str:
    """Get the agent name for a given intent."""
    return INTENT_AGENT_MAP.get(intent, "general_agent")
