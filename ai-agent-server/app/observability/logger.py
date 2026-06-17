"""
Observability - MongoDB Agent Logger

Stores detailed agent execution logs for debugging and replay.
"""

import logging
from datetime import datetime, timezone
from typing import Any, Optional
from dataclasses import dataclass, field, asdict

from motor.motor_asyncio import AsyncIOMotorClient

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

_mongo_client: Optional[AsyncIOMotorClient] = None


def setup_logging(debug: bool = False) -> None:
    """Configure application logging."""
    level = logging.DEBUG if debug else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )
    
    # Reduce noise from libraries
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("aiokafka").setLevel(logging.WARNING)


async def get_mongo_client() -> AsyncIOMotorClient:
    """Get or create MongoDB client."""
    global _mongo_client
    
    if _mongo_client is None:
        _mongo_client = AsyncIOMotorClient(settings.mongo_url)
        logger.info("MongoDB client connected")
    
    return _mongo_client


@dataclass
class ToolCall:
    """Record of a tool invocation."""
    name: str
    input: dict
    output: Any
    duration_ms: int
    error: Optional[str] = None


@dataclass
class AgentLog:
    """Complete execution log for an agent run."""
    # Identifiers
    org_id: str
    user_id: str
    session_id: str
    message_id: str
    
    # Execution details
    agent_name: str
    model: str
    provider: str
    
    # Timing
    started_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    completed_at: Optional[str] = None
    duration_ms: Optional[int] = None
    
    # Token usage
    input_tokens: int = 0
    output_tokens: int = 0
    
    # I/O
    input_message: str = ""
    output: Optional[dict] = None
    
    # Tool calls
    tools_used: list[ToolCall] = field(default_factory=list)
    
    # Errors
    error: Optional[str] = None
    
    # Metadata
    metadata: dict = field(default_factory=dict)


class AgentLogger:
    """
    MongoDB-backed agent execution logger.
    
    Collection: agent_logs
    Indexes: org_id, user_id, session_id, started_at
    """
    
    COLLECTION = "agent_logs"
    
    def __init__(self, org_id: str, user_id: str, session_id: str):
        self.org_id = org_id
        self.user_id = user_id
        self.session_id = session_id
    
    async def _get_collection(self):
        """Get MongoDB collection."""
        client = await get_mongo_client()
        db = client[settings.mongo_db_name]
        return db[self.COLLECTION]
    
    async def log_execution(self, agent_log: AgentLog) -> str:
        """
        Store agent execution log.
        
        Returns:
            Inserted document ID
        """
        collection = await self._get_collection()
        
        doc = asdict(agent_log)
        doc["tools_used"] = [asdict(t) for t in agent_log.tools_used]
        
        result = await collection.insert_one(doc)
        
        logger.debug(f"Agent log stored: {result.inserted_id}")
        return str(result.inserted_id)
    
    async def get_session_logs(self, limit: int = 50) -> list[dict]:
        """Get all logs for this session (for replay)."""
        collection = await self._get_collection()
        
        cursor = collection.find({
            "org_id": self.org_id,
            "user_id": self.user_id,
            "session_id": self.session_id
        }).sort("started_at", 1).limit(limit)
        
        return await cursor.to_list(length=limit)
    
    async def get_org_usage_summary(self, days: int = 30) -> dict:
        """Get aggregated usage for organization."""
        collection = await self._get_collection()
        
        from datetime import timedelta
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        
        pipeline = [
            {"$match": {
                "org_id": self.org_id,
                "started_at": {"$gte": cutoff.isoformat()}
            }},
            {"$group": {
                "_id": "$agent_name",
                "total_calls": {"$sum": 1},
                "total_input_tokens": {"$sum": "$input_tokens"},
                "total_output_tokens": {"$sum": "$output_tokens"},
                "avg_duration_ms": {"$avg": "$duration_ms"},
                "error_count": {"$sum": {"$cond": [{"$ne": ["$error", None]}, 1, 0]}}
            }}
        ]
        
        cursor = collection.aggregate(pipeline)
        results = await cursor.to_list(length=100)
        
        return {
            "org_id": self.org_id,
            "period_days": days,
            "by_agent": results
        }
