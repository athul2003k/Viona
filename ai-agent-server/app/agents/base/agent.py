"""
Base Agent Abstraction

All domain agents inherit from BaseAgent.
Provides common functionality for tool execution, token tracking,
streaming, retries, and output formatting.
"""

import logging
from abc import ABC, abstractmethod
from typing import Optional, Any, Callable, Awaitable
from datetime import datetime, timezone
import time

from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage

from app.agents.base.context import AgentState, ExecutionContext
from app.agents.base.output import AgentOutput
from app.llms import (
    TokenTrackingCallback, StreamingTokenCounter,
    create_model, create_streaming_model,
)
from app.tokens import TokenLimiter, TokenUsage, QuotaExceededError
from app.observability import AgentLogger, AgentLog, ToolCall
from app.memory import RedisMemoryStore
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Type alias for the streaming callback
StreamCallback = Callable[[str], Awaitable[None]]


class BaseAgent(ABC):
    """
    Abstract base class for all domain agents.
    
    Provides:
    - Token quota checking and tracking
    - Tool execution with logging (shared, not duplicated)
    - Memory integration
    - Structured output formatting
    - LLM retry logic
    - Token-by-token streaming
    """
    
    # Override in subclasses
    name: str = "base_agent"
    description: str = "Base agent"
    system_prompt: str = ""
    
    # Default model config
    default_provider: str = "groq"
    default_model: str = "llama-3.3-70b-versatile"
    
    def __init__(
        self,
        provider: Optional[str] = None,
        model: Optional[str] = None,
    ):
        self.provider = provider or self.default_provider
        self.model_name = model or self.default_model
        self.tools: list = []
    
    @abstractmethod
    async def execute(self, state: AgentState) -> AgentState:
        """
        Execute agent logic and return updated state.
        
        Must be implemented by subclasses.
        """
        pass
    
    async def run(self, state: AgentState) -> AgentState:
        """
        Main entry point with quota checking and logging.
        
        Wraps execute() with:
        1. Token quota pre-check
        2. Execution timing
        3. Token usage recording
        4. Observability logging
        """
        context = state["context"]
        start_time = time.time()
        
        # Initialize components
        limiter = TokenLimiter(context.auth.org_id)
        agent_logger = AgentLogger(
            org_id=context.auth.org_id,
            user_id=context.auth.user_id,
            session_id=context.session_id
        )
        
        # Pre-check quota
        try:
            await limiter.check_quota(context.token_budget)
        except QuotaExceededError as e:
            state["error"] = str(e)
            state["output"] = AgentOutput.error_response(str(e)).model_dump()
            return state
        
        # Execute agent
        log = AgentLog(
            org_id=context.auth.org_id,
            user_id=context.auth.user_id,
            session_id=context.session_id,
            message_id=context.message_id,
            agent_name=self.name,
            model=self.model_name,
            provider=self.provider,
            input_message=state["input"]
        )
        
        try:
            state = await self.execute(state)
            log.output = state.get("output")
            
        except Exception as e:
            logger.exception(f"Agent {self.name} execution failed")
            state["error"] = str(e)
            state["output"] = AgentOutput.error_response(
                f"An error occurred: {str(e)}"
            ).model_dump()
            log.error = str(e)
        
        # Finalize timing
        duration_ms = int((time.time() - start_time) * 1000)
        log.completed_at = datetime.now(timezone.utc).isoformat()
        log.duration_ms = duration_ms
        log.tools_used = [
            ToolCall(**t) for t in state.get("tools_called", [])
        ]
        
        # Store log
        await agent_logger.log_execution(log)
        
        return state
    
    async def invoke_llm(
        self,
        state: AgentState,
        messages: list,
        structured_output: Optional[type] = None,
    ) -> tuple[Any, TokenUsage]:
        """
        Invoke LLM with token tracking and automatic retries.
        
        Retries on transient errors (connection issues, rate limits).
        
        Returns:
            Tuple of (response, token_usage)
        """
        context = state["context"]
        
        @retry(
            stop=stop_after_attempt(settings.llm_max_retries),
            wait=wait_exponential(
                multiplier=settings.llm_retry_wait_seconds,
                min=1,
                max=10
            ),
            retry=retry_if_exception_type((ConnectionError, TimeoutError, OSError)),
            reraise=True,
        )
        async def _invoke():
            callback = TokenTrackingCallback()
            model = create_model(
                provider=self.provider,
                model=self.model_name,
                callbacks=[callback]
            )
            
            if structured_output:
                model = model.with_structured_output(structured_output)
            
            response = await model.ainvoke(messages)
            usage = callback.get_usage(self.provider)
            return response, usage
        
        response, usage = await _invoke()
        
        # Record usage
        limiter = TokenLimiter(context.auth.org_id)
        await limiter.record_usage(usage, context.auth.user_id)
        
        # Update context
        context.tokens_used += usage.input_tokens + usage.output_tokens
        
        return response, usage
    
    async def stream_llm(
        self,
        state: AgentState,
        messages: list,
        stream_callback: Optional[StreamCallback] = None,
    ) -> tuple[str, TokenUsage]:
        """
        Stream LLM response token-by-token.
        
        Calls stream_callback(delta) for each token chunk, then returns
        the full accumulated response and usage stats.
        
        Args:
            state: Current agent state
            messages: LLM messages
            stream_callback: Async callback called with each token chunk
            
        Returns:
            Tuple of (full_response_text, token_usage)
        """
        context = state["context"]
        counter = StreamingTokenCounter()
        
        model = create_streaming_model(
            provider=self.provider,
            model=self.model_name,
            callbacks=[counter]
        )
        
        full_response = []
        async for chunk in model.astream(messages):
            token = chunk.content if hasattr(chunk, 'content') else str(chunk)
            if token:
                full_response.append(token)
                if stream_callback:
                    await stream_callback(token)
        
        response_text = "".join(full_response)
        usage = counter.get_usage(self.provider)
        
        # Record usage
        limiter = TokenLimiter(context.auth.org_id)
        await limiter.record_usage(usage, context.auth.user_id)
        context.tokens_used += usage.input_tokens + usage.output_tokens
        
        return response_text, usage
    
    # ─── Shared Methods (eliminate duplication across domain agents) ──────
    
    async def execute_tools(
        self,
        state: AgentState,
        tools: list,
        tools_to_run: list[str],
        **extra_kwargs,
    ) -> dict:
        """
        Execute a list of tools by name and return results.
        
        Shared across all domain agents to avoid code duplication.
        
        Args:
            state: Current agent state
            tools: List of tool instances
            tools_to_run: Names of tools to execute
            **extra_kwargs: Per-tool keyword args as {tool_name: {kwarg: value}}
            
        Returns:
            Dict mapping tool_name -> result data
        """
        results = {}
        tools_called = state.get("tools_called", [])
        
        for tool in tools:
            if tool.name in tools_to_run:
                try:
                    kwargs = extra_kwargs.get(tool.name, {})
                    start = time.time()
                    result = await tool.run(**kwargs)
                    duration_ms = int((time.time() - start) * 1000)
                    
                    if result.success:
                        results[tool.name] = result.data
                    
                    tools_called.append({
                        "name": tool.name,
                        "input": kwargs,
                        "output": result.data if result.success else None,
                        "duration_ms": duration_ms,
                        "error": result.error if not result.success else None,
                    })
                except Exception as e:
                    logger.error(f"Tool {tool.name} failed: {e}")
                    tools_called.append({
                        "name": tool.name,
                        "input": {},
                        "output": None,
                        "duration_ms": 0,
                        "error": str(e),
                    })
        
        state["tools_called"] = tools_called
        return results
    
    def is_empty_data(self, tool_results: dict) -> bool:
        """
        Check if all tool results contain empty or zero data.
        
        Shared across all domain agents to avoid code duplication.
        """
        if not tool_results:
            return True
        
        for key, data in tool_results.items():
            if not data:
                continue
            if isinstance(data, dict):
                # Check for meaningful content
                for k, v in data.items():
                    if isinstance(v, (list, dict)) and len(v) > 0:
                        return False
                    if isinstance(v, (int, float)) and v > 0:
                        return False
            elif isinstance(data, list) and len(data) > 0:
                return False
        
        return True
    
    def create_empty_data_response(self) -> AgentOutput:
        """Create a response for when no meaningful data is found."""
        return AgentOutput.text_response(
            summary=(
                "I looked through your data but couldn't find any meaningful information "
                "to report on right now. This could mean you're just getting started, or "
                "the data for this time period is still coming in. "
                "Feel free to ask me something else, or try a different time range!"
            ),
            confidence=0.8
        )
    
    def get_system_message(self) -> SystemMessage:
        """Get system message for this agent."""
        return SystemMessage(content=self.system_prompt)
    
    def format_messages(
        self,
        state: AgentState,
        memory_messages: Optional[list[dict]] = None
    ) -> list:
        """Format messages for LLM call."""
        messages = [self.get_system_message()]
        
        # Add memory context
        if memory_messages:
            for msg in memory_messages:
                if msg["role"] == "user":
                    messages.append(HumanMessage(content=msg["content"]))
                elif msg["role"] == "assistant":
                    messages.append(AIMessage(content=msg["content"]))
                elif msg["role"] == "system":
                    messages.append(SystemMessage(content=msg["content"]))
        
        # Add current input
        messages.append(HumanMessage(content=state["input"]))
        
        return messages
