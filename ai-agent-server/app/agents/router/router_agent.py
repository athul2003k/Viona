"""
Router Agent - LangGraph Implementation

Central orchestration agent that:
1. Classifies user intent
2. Selects optimal model via model_selector
3. Allocates token budget
4. Routes to specialist agent
"""

import logging
from typing import Literal

from langgraph.graph import StateGraph, END
from langchain_core.messages import HumanMessage, SystemMessage

from app.agents.base import AgentState, ExecutionContext, AgentOutput
from app.agents.router.intent_classifier import classify_intent, get_agent_for_intent
from app.agents.router.model_selector import select_model
from app.agents.router.budget_allocator import allocate_budget

logger = logging.getLogger(__name__)


async def classify_node(state: AgentState) -> AgentState:
    """Classify user intent."""
    from app.memory.redis_memory import RedisMemoryStore
    
    context = state["context"]
    user_input = state["input"].lower().strip()
    
    # === CHECK FOR PENDING ACTION CONFIRMATION FIRST ===
    confirmation_words = ['yes', 'yeah', 'yep', 'sure', 'confirm', 'ok', 'okay', 
                         'proceed', 'do it', 'go ahead', 'no', 'nope', 'cancel', 
                         'stop', 'never mind', 'nevermind', 'y', 'n']
    
    if user_input in confirmation_words:
        memory = RedisMemoryStore(
            org_id=context.auth.org_id,
            user_id=context.auth.user_id,
            session_id=context.session_id
        )
        pending_action = await memory.get_pending_action()
        
        if pending_action:
            action_type = pending_action.get("action_type", "")
            # Route to the appropriate agent based on action type
            if action_type in ["create_order", "update_order_status"]:
                state["intent"] = "orders"
                state["agent"] = "orders_agent"
            elif action_type in ["create_reorder_request", "update_stock", "transfer_stock"]:
                state["intent"] = "inventory"
                state["agent"] = "inventory_agent"
            else:
                state["intent"] = "orders"
                state["agent"] = "orders_agent"
            
            logger.info(f"Pending action confirmation detected, routing to {state['agent']}")
            return state
    
    # === NORMAL INTENT CLASSIFICATION ===
    try:
        classification = await classify_intent(state["input"])
        state["intent"] = classification.intent
        state["agent"] = get_agent_for_intent(classification.intent)
        
        logger.info(
            f"Intent classified: {classification.intent} "
            f"(confidence={classification.confidence})"
        )
    except Exception as e:
        logger.exception("Intent classification failed")
        state["intent"] = "general"
        state["agent"] = "general_agent"
    
    return state


async def allocate_budget_node(state: AgentState) -> AgentState:
    """Allocate token budget and select model for execution."""
    context = state["context"]
    intent = state["intent"] or "general"
    
    # === MODEL SELECTION (now integrated) ===
    try:
        model_selection = select_model(
            task_type=intent,
            org_plan="pro",  # Default; could be looked up from DB
            complexity="medium",
        )
        
        # Store model selection in state metadata for agents to use
        state["model_selection"] = {
            "provider": model_selection.provider,
            "model": model_selection.model,
            "max_tokens": model_selection.max_tokens,
            "rationale": model_selection.rationale,
        }
        
        logger.info(f"Model selected: {model_selection.model} ({model_selection.rationale})")
    except Exception as e:
        logger.warning(f"Model selection failed, using defaults: {e}")
    
    # === BUDGET ALLOCATION ===
    budget = await allocate_budget(
        org_id=context.auth.org_id,
        task_type=intent
    )
    
    context.token_budget = budget.agent_budget
    
    if budget.warning:
        logger.warning(budget.warning)
    
    return state


async def route_to_analytics(state: AgentState) -> AgentState:
    """Execute analytics agent."""
    from app.agents.domains.analytics.agent import AnalyticsAgent
    
    agent = AnalyticsAgent()
    return await agent.run(state)


async def route_to_inventory(state: AgentState) -> AgentState:
    """Execute inventory agent."""
    from app.agents.domains.inventory.agent import InventoryAgent
    
    agent = InventoryAgent()
    return await agent.run(state)


async def route_to_orders(state: AgentState) -> AgentState:
    """Execute orders agent."""
    from app.agents.domains.orders.agent import OrdersAgent
    
    agent = OrdersAgent()
    return await agent.run(state)


async def route_to_general(state: AgentState) -> AgentState:
    """Handle general queries with LLM-powered conversational response."""
    from app.agents.prompts import GENERAL_AGENT_PROMPT, GENERAL_RESPONSE_TEMPLATE
    from app.llms import create_model, create_streaming_model
    
    context = state["context"]
    user_input = state["input"].strip().lower()
    stream_callback = getattr(context, 'stream_callback', None)
    
    # Quick greetings don't need LLM
    greetings = {'hi', 'hello', 'hey', 'sup', 'yo', 'hola', 'howdy'}
    if user_input in greetings:
        state["output"] = AgentOutput.text_response(
            summary=GENERAL_RESPONSE_TEMPLATE,
            confidence=0.95
        ).model_dump()
        return state
    
    # For actual questions, use LLM to generate a helpful response
    try:
        messages = [
            SystemMessage(content=GENERAL_AGENT_PROMPT),
            HumanMessage(content=state["input"]),
        ]
        
        if stream_callback:
            model = create_streaming_model(provider="groq", model="llama-3.3-70b-versatile")
            full_response = []
            async for chunk in model.astream(messages):
                token = chunk.content if hasattr(chunk, 'content') else str(chunk)
                if token:
                    full_response.append(token)
                    await stream_callback(token)
            response_text = "".join(full_response)
        else:
            model = create_model(provider="groq", model="llama-3.3-70b-versatile")
            response = await model.ainvoke(messages)
            response_text = response.content if hasattr(response, 'content') else str(response)
        
        state["output"] = AgentOutput.text_response(
            summary=response_text,
            confidence=0.9
        ).model_dump()
    except Exception as e:
        logger.warning(f"General LLM response failed, using template: {e}")
        state["output"] = AgentOutput.text_response(
            summary=GENERAL_RESPONSE_TEMPLATE,
            confidence=0.95
        ).model_dump()
    
    return state


def route_decision(state: AgentState) -> Literal["analytics", "inventory", "orders", "general", "end"]:
    """Decide which agent to route to."""
    agent = state.get("agent", "general_agent")
    
    if state.get("error"):
        return "end"
    
    if agent == "analytics_agent":
        return "analytics"
    elif agent == "inventory_agent":
        return "inventory"
    elif agent == "orders_agent":
        return "orders"
    
    return "general"


def create_router_graph() -> StateGraph:
    """Create the router LangGraph."""
    graph = StateGraph(AgentState)
    
    # Add nodes
    graph.add_node("classify", classify_node)
    graph.add_node("allocate_budget", allocate_budget_node)
    graph.add_node("analytics", route_to_analytics)
    graph.add_node("inventory", route_to_inventory)
    graph.add_node("orders", route_to_orders)
    graph.add_node("general", route_to_general)
    
    # Set entry point
    graph.set_entry_point("classify")
    
    # Add edges
    graph.add_edge("classify", "allocate_budget")
    
    # Conditional routing after budget allocation
    graph.add_conditional_edges(
        "allocate_budget",
        route_decision,
        {
            "analytics": "analytics",
            "inventory": "inventory",
            "orders": "orders",
            "general": "general",
            "end": END
        }
    )
    
    # All agents lead to end
    graph.add_edge("analytics", END)
    graph.add_edge("inventory", END)
    graph.add_edge("orders", END)
    graph.add_edge("general", END)
    
    return graph


# Compiled graph for reuse
_router_graph = None


def get_router_graph():
    """Get compiled router graph."""
    global _router_graph
    if _router_graph is None:
        _router_graph = create_router_graph().compile()
    return _router_graph


async def execute_router(state: AgentState) -> AgentState:
    """Execute the full router pipeline."""
    graph = get_router_graph()
    result = await graph.ainvoke(state)
    return result
