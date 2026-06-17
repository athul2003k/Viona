"""
LLM Provider Factory

Creates LangChain chat models for different providers with token tracking callbacks.
Supports both synchronous invocation and async streaming.
"""

import logging
from typing import Optional, AsyncIterator
from dataclasses import dataclass

from langchain_core.callbacks import AsyncCallbackHandler
from langchain_core.outputs import LLMResult
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_groq import ChatGroq
from langchain_openai import ChatOpenAI

from app.config import get_settings
from app.tokens import TokenUsage

logger = logging.getLogger(__name__)
settings = get_settings()


@dataclass
class ModelConfig:
    """Configuration for a specific model."""
    provider: str
    model: str
    max_tokens: int = 4096
    temperature: float = 0.1


class TokenTrackingCallback(AsyncCallbackHandler):
    """Callback to track token usage from LLM responses."""
    
    def __init__(self):
        self.input_tokens = 0
        self.output_tokens = 0
        self.model = ""
    
    async def on_llm_end(self, response: LLMResult, **kwargs) -> None:
        """Called when LLM completes."""
        if response.llm_output:
            usage = response.llm_output.get("token_usage", {})
            self.input_tokens = usage.get("prompt_tokens", 0)
            self.output_tokens = usage.get("completion_tokens", 0)
            self.model = response.llm_output.get("model_name", "")
    
    def get_usage(self, provider: str) -> TokenUsage:
        """Get token usage as TokenUsage object."""
        return TokenUsage(
            input_tokens=self.input_tokens,
            output_tokens=self.output_tokens,
            model=self.model,
            provider=provider
        )


class StreamingTokenCounter(AsyncCallbackHandler):
    """Callback to track token usage during streaming responses."""
    
    def __init__(self):
        self.input_tokens = 0
        self.output_tokens = 0
        self.model = ""
        self._chunk_count = 0
    
    async def on_llm_new_token(self, token: str, **kwargs) -> None:
        """Called for each new token during streaming."""
        self._chunk_count += 1
    
    async def on_llm_end(self, response: LLMResult, **kwargs) -> None:
        """Called when streaming completes — capture final usage stats."""
        if response.llm_output:
            usage = response.llm_output.get("token_usage", {})
            self.input_tokens = usage.get("prompt_tokens", 0)
            self.output_tokens = usage.get("completion_tokens", 0)
            self.model = response.llm_output.get("model_name", "")
        else:
            # Estimate if provider doesn't report usage during streaming
            self.output_tokens = self._chunk_count
    
    def get_usage(self, provider: str) -> TokenUsage:
        """Get token usage as TokenUsage object."""
        return TokenUsage(
            input_tokens=self.input_tokens,
            output_tokens=self.output_tokens,
            model=self.model,
            provider=provider
        )


def _create_provider_model(
    provider: str,
    model: str,
    callbacks: list,
    temperature: float,
    max_tokens: int,
    streaming: bool = False,
) -> BaseChatModel:
    """Internal helper to create a model for a given provider."""
    if provider == "groq":
        if not settings.groq_api_key:
            raise ValueError("GROQ_API_KEY not configured")
        
        return ChatGroq(
            model=model,
            api_key=settings.groq_api_key,
            temperature=temperature,
            max_tokens=max_tokens,
            callbacks=callbacks,
            streaming=streaming,
        )
    
    elif provider == "openrouter":
        if not settings.openrouter_api_key:
            raise ValueError("OPENROUTER_API_KEY not configured")
        
        return ChatOpenAI(
            model=model,
            api_key=settings.openrouter_api_key,
            base_url="https://openrouter.ai/api/v1",
            temperature=temperature,
            max_tokens=max_tokens,
            callbacks=callbacks,
            streaming=streaming,
            default_headers={
                "HTTP-Referer": "https://viona.app",
                "X-Title": "Viona AI Agent"
            }
        )
    
    else:
        raise ValueError(f"Unknown provider: {provider}")


def create_model(
    provider: str,
    model: str,
    callbacks: Optional[list] = None,
    temperature: float = 0.1,
    max_tokens: int = 4096,
) -> BaseChatModel:
    """
    Create a LangChain chat model for the specified provider.
    
    Supported providers:
    - groq: ChatGroq (fast, cost-effective)
    - openrouter: ChatOpenAI with OpenRouter base URL
    """
    return _create_provider_model(
        provider=provider,
        model=model,
        callbacks=callbacks or [],
        temperature=temperature,
        max_tokens=max_tokens,
        streaming=False,
    )


def create_streaming_model(
    provider: str,
    model: str,
    callbacks: Optional[list] = None,
    temperature: float = 0.1,
    max_tokens: int = 4096,
) -> BaseChatModel:
    """
    Create a streaming-enabled LangChain chat model.
    
    Use with `model.astream(messages)` to get an async iterator of token chunks.
    """
    return _create_provider_model(
        provider=provider,
        model=model,
        callbacks=callbacks or [],
        temperature=temperature,
        max_tokens=max_tokens,
        streaming=True,
    )


def get_default_model(callbacks: Optional[list] = None) -> BaseChatModel:
    """Get the default model based on settings."""
    return create_model(
        provider=settings.default_provider,
        model=settings.default_model,
        callbacks=callbacks
    )


# Model recommendations by task type
MODEL_RECOMMENDATIONS = {
    "routing": ModelConfig(provider="groq", model="llama-3.1-8b-instant", max_tokens=256),
    "tool_selection": ModelConfig(provider="groq", model="llama-3.1-8b-instant", max_tokens=512),
    "analytics": ModelConfig(provider="groq", model="llama-3.3-70b-versatile", max_tokens=4096),
    "summarization": ModelConfig(provider="groq", model="llama-3.1-8b-instant", max_tokens=1024),
    "complex": ModelConfig(provider="openrouter", model="anthropic/claude-3-5-sonnet", max_tokens=8192),
}


def get_model_for_task(
    task_type: str,
    callbacks: Optional[list] = None
) -> tuple[BaseChatModel, ModelConfig]:
    """
    Get the recommended model for a specific task type.
    
    Returns:
        Tuple of (model, config)
    """
    config = MODEL_RECOMMENDATIONS.get(task_type, MODEL_RECOMMENDATIONS["analytics"])
    
    model = create_model(
        provider=config.provider,
        model=config.model,
        callbacks=callbacks,
        max_tokens=config.max_tokens
    )
    
    return model, config
