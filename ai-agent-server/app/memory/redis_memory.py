"""
Redis-based Short-term Memory

Per-user conversation memory with TTL-based expiration.
Implements summarization to avoid bloating context windows.
"""

import json
import logging
from typing import Optional
from dataclasses import dataclass, field
from datetime import datetime

import redis.asyncio as redis

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

_redis_client: Optional[redis.Redis] = None


async def get_redis_client() -> redis.Redis:
    """Get or create Redis client."""
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True
        )
    return _redis_client


@dataclass
class ConversationMessage:
    """Single message in conversation history."""
    role: str  # "user" | "assistant" | "system"
    content: str
    timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat())


@dataclass
class ConversationMemory:
    """Short-term memory for a conversation session."""
    messages: list[ConversationMessage] = field(default_factory=list)
    summary: Optional[str] = None
    total_tokens_estimate: int = 0


class RedisMemoryStore:
    """
    Redis-backed conversation memory.
    
    Key structure:
    - memory:{org_id}:{user_id}:{session_id}:messages -> List of messages
    - memory:{org_id}:{user_id}:{session_id}:summary -> Conversation summary
    """
    
    def __init__(self, org_id: str, user_id: str, session_id: str):
        self.org_id = org_id
        self.user_id = user_id
        self.session_id = session_id
        self._prefix = f"memory:{org_id}:{user_id}:{session_id}"
    
    @property
    def messages_key(self) -> str:
        return f"{self._prefix}:messages"
    
    @property
    def summary_key(self) -> str:
        return f"{self._prefix}:summary"
    
    async def add_message(self, role: str, content: str) -> None:
        """Add a message to conversation history."""
        redis_client = await get_redis_client()
        
        message = ConversationMessage(role=role, content=content)
        message_json = json.dumps({
            "role": message.role,
            "content": message.content,
            "timestamp": message.timestamp
        })
        
        pipe = redis_client.pipeline()
        pipe.rpush(self.messages_key, message_json)
        pipe.expire(self.messages_key, settings.memory_ttl_seconds)
        await pipe.execute()
    
    async def get_messages(self, limit: int = 20) -> list[ConversationMessage]:
        """Get recent messages from history."""
        redis_client = await get_redis_client()
        
        # Get last N messages
        messages_json = await redis_client.lrange(self.messages_key, -limit, -1)
        
        messages = []
        for msg_json in messages_json:
            data = json.loads(msg_json)
            messages.append(ConversationMessage(
                role=data["role"],
                content=data["content"],
                timestamp=data.get("timestamp", "")
            ))
        
        return messages
    
    async def get_summary(self) -> Optional[str]:
        """Get conversation summary if exists."""
        redis_client = await get_redis_client()
        return await redis_client.get(self.summary_key)
    
    async def set_summary(self, summary: str) -> None:
        """Store conversation summary."""
        redis_client = await get_redis_client()
        await redis_client.set(
            self.summary_key, 
            summary, 
            ex=settings.memory_ttl_seconds
        )
    
    async def get_context_messages(self, max_messages: int = 10) -> list[dict]:
        """
        Get messages formatted for LLM context.
        
        Uses summary + recent messages to stay within context limits.
        """
        messages = []
        
        # Add summary as system context if available
        summary = await self.get_summary()
        if summary:
            messages.append({
                "role": "system",
                "content": f"Previous conversation summary: {summary}"
            })
        
        # Add recent messages
        recent = await self.get_messages(limit=max_messages)
        for msg in recent:
            messages.append({
                "role": msg.role,
                "content": msg.content
            })
        
        return messages
    
    async def clear(self) -> None:
        """Clear all memory for this session."""
        redis_client = await get_redis_client()
        await redis_client.delete(self.messages_key, self.summary_key, self.pending_action_key)
    
    async def get_message_count(self) -> int:
        """Get total message count."""
        redis_client = await get_redis_client()
        return await redis_client.llen(self.messages_key)
    
    # === Pending Action Storage ===
    
    @property
    def pending_action_key(self) -> str:
        return f"{self._prefix}:pending_action"
    
    async def set_pending_action(self, action_type: str, params: dict, preview_data: dict = None) -> None:
        """
        Store pending action awaiting user confirmation.
        
        Args:
            action_type: The action tool name (e.g., 'create_order')
            params: The extracted parameters for the action
            preview_data: Optional preview data from the action tool
        """
        redis_client = await get_redis_client()
        
        action_data = json.dumps({
            "action_type": action_type,
            "params": params,
            "preview_data": preview_data,
            "created_at": datetime.utcnow().isoformat()
        })
        
        # Store with 10 minute expiry (user should confirm within this time)
        await redis_client.set(self.pending_action_key, action_data, ex=600)
    
    async def get_pending_action(self) -> Optional[dict]:
        """
        Get pending action if exists.
        
        Returns:
            Dict with action_type, params, preview_data, or None if no pending action
        """
        redis_client = await get_redis_client()
        action_json = await redis_client.get(self.pending_action_key)
        
        if action_json:
            return json.loads(action_json)
        return None
    
    async def clear_pending_action(self) -> None:
        """Clear pending action after execution or cancellation."""
        redis_client = await get_redis_client()
        await redis_client.delete(self.pending_action_key)

