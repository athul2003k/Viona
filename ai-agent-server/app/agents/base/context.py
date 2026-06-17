"""
Agent Execution Context

Carries all execution state through agent graph.
"""

from typing import TypedDict, Optional, Any, Annotated, Callable, Awaitable
from dataclasses import dataclass, field
from operator import add

from langchain_core.messages import BaseMessage

from app.auth import AuthContext


@dataclass
class ExecutionContext:
    """
    Execution context passed through agent chain.
    
    Contains auth info, session details, and execution metadata.
    """
    # Authentication
    auth: AuthContext
    
    # Session
    session_id: str
    message_id: str
    
    # Execution metadata
    token_budget: int = 10000
    max_tool_calls: int = 10
    timeout_seconds: int = 60
    
    # Accumulated during execution
    tokens_used: int = 0
    tool_calls_made: int = 0
    
    # Streaming callback — set by chat API when WebSocket streaming is active
    stream_callback: Optional[Callable[[str], Awaitable[None]]] = None


class AgentState(TypedDict):
    """
    LangGraph state for agent execution.
    
    Uses TypedDict for LangGraph compatibility.
    Annotated fields with `add` operator enable accumulation.
    """
    # Input
    input: str
    
    # Messages (LangChain format for LLM calls)
    messages: Annotated[list[BaseMessage], add]
    
    # Routing
    intent: Optional[str]
    agent: Optional[str]
    model_selection: Optional[dict]
    
    # Execution context
    context: Optional[ExecutionContext]
    
    # Tool tracking
    tools_called: Annotated[list[dict], add]
    
    # Output
    output: Optional[dict]
    error: Optional[str]
    
    # Streaming
    partial_response: Optional[str]


def create_initial_state(
    input_message: str,
    context: ExecutionContext
) -> AgentState:
    """Create initial state for agent execution."""
    return AgentState(
        input=input_message,
        messages=[],
        intent=None,
        agent=None,
        model_selection=None,
        context=context,
        tools_called=[],
        output=None,
        error=None,
        partial_response=None
    )
