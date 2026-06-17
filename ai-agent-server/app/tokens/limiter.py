"""
Token Accounting and Rate Limiting

Redis-based organization-level token tracking with hard limits.
"""

import logging
from dataclasses import dataclass
from typing import Optional
from datetime import datetime

from app.config import get_settings
from app.memory.redis_memory import get_redis_client

logger = logging.getLogger(__name__)
settings = get_settings()


@dataclass
class TokenUsage:
    """Token usage for a single LLM call."""
    input_tokens: int
    output_tokens: int
    model: str
    provider: str
    estimated_cost: float = 0.0


@dataclass
class TokenQuota:
    """Organization token quota status."""
    org_id: str
    used: int
    limit: int
    remaining: int
    percentage_used: float


class TokenLimiter:
    """
    Organization-level token accounting with HARD limits.
    
    Key structure:
    - tokens:{org_id}:used -> Total tokens consumed (INCRBY atomic)
    - tokens:{org_id}:limit -> Organization limit (cached)
    
    Flow:
    1. Before LLM call: check_quota() -> raises if exceeded
    2. After LLM call: record_usage() -> updates counter + emits event
    """
    
    # Cost per 1M tokens by provider/model (approximate)
    COST_TABLE = {
        "groq": {
            "llama-3.3-70b-versatile": {"input": 0.59, "output": 0.79},
            "llama-3.1-8b-instant": {"input": 0.05, "output": 0.08},
            "mixtral-8x7b-32768": {"input": 0.24, "output": 0.24},
        },
        "openrouter": {
            "anthropic/claude-3-5-sonnet": {"input": 3.0, "output": 15.0},
            "openai/gpt-4o": {"input": 2.5, "output": 10.0},
            "google/gemini-pro-1.5": {"input": 1.25, "output": 5.0},
        }
    }
    
    def __init__(self, org_id: str):
        self.org_id = org_id
        self._used_key = f"tokens:{org_id}:used"
        self._limit_key = f"tokens:{org_id}:limit"
    
    async def get_quota(self) -> TokenQuota:
        """Get current token quota status."""
        redis_client = await get_redis_client()
        
        pipe = redis_client.pipeline()
        pipe.get(self._used_key)
        pipe.get(self._limit_key)
        results = await pipe.execute()
        
        used = int(results[0] or 0)
        limit = int(results[1] or settings.default_org_token_limit)
        remaining = max(0, limit - used)
        percentage = (used / limit * 100) if limit > 0 else 100
        
        return TokenQuota(
            org_id=self.org_id,
            used=used,
            limit=limit,
            remaining=remaining,
            percentage_used=round(percentage, 2)
        )
    
    async def check_quota(self, estimated_tokens: int) -> bool:
        """
        Check if organization has quota for estimated tokens.
        
        Raises:
            QuotaExceededError: If quota would be exceeded
            
        Returns:
            True if quota available
        """
        quota = await self.get_quota()
        
        # Add buffer for safety
        required = int(estimated_tokens * (1 + settings.token_reserve_buffer))
        
        if quota.remaining < required:
            logger.warning(
                f"Token quota exceeded for org {self.org_id}: "
                f"remaining={quota.remaining}, required={required}"
            )
            raise QuotaExceededError(
                f"Token quota exceeded. Used: {quota.used}/{quota.limit}. "
                f"Remaining: {quota.remaining}"
            )
        
        return True
    
    async def record_usage(
        self, 
        usage: TokenUsage,
        user_id: str,
        emit_event: bool = True
    ) -> int:
        """
        Record token usage after LLM call.
        
        1. Atomically increment Redis counter
        2. Emit RabbitMQ event for billing/observability
        
        Returns:
            New total usage
        """
        redis_client = await get_redis_client()
        
        total_tokens = usage.input_tokens + usage.output_tokens
        new_total = await redis_client.incrby(self._used_key, total_tokens)
        
        logger.info(
            f"Token usage recorded: org={self.org_id}, tokens={total_tokens}, "
            f"total={new_total}, model={usage.model}"
        )
        
        # Emit RabbitMQ event
        if emit_event:
            from app.tokens.publisher import emit_token_event
            await emit_token_event(
                org_id=self.org_id,
                user_id=user_id,
                model=usage.model,
                provider=usage.provider,
                input_tokens=usage.input_tokens,
                output_tokens=usage.output_tokens,
                estimated_cost=usage.estimated_cost or self._estimate_cost(usage)
            )
        
        return new_total
    
    async def set_limit(self, limit: int) -> None:
        """Set organization token limit."""
        redis_client = await get_redis_client()
        await redis_client.set(self._limit_key, limit)
    
    async def reset_usage(self) -> None:
        """Reset usage counter (for billing cycle resets)."""
        redis_client = await get_redis_client()
        await redis_client.set(self._used_key, 0)
    
    def _estimate_cost(self, usage: TokenUsage) -> float:
        """Estimate cost based on provider/model."""
        provider_costs = self.COST_TABLE.get(usage.provider, {})
        model_costs = provider_costs.get(usage.model, {"input": 1.0, "output": 1.0})
        
        input_cost = (usage.input_tokens / 1_000_000) * model_costs["input"]
        output_cost = (usage.output_tokens / 1_000_000) * model_costs["output"]
        
        return round(input_cost + output_cost, 6)


class QuotaExceededError(Exception):
    """Raised when organization token quota is exceeded."""
    pass
