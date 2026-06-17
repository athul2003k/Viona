"""
MongoDB-based Chat Sessions Storage

Persistent storage for chat sessions and messages.
Sessions are scoped by organization and user.
"""

import logging
from typing import Optional
from datetime import datetime
from dataclasses import dataclass, field, asdict

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from bson import ObjectId

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

_mongo_client: Optional[AsyncIOMotorClient] = None
_mongo_db: Optional[AsyncIOMotorDatabase] = None


async def get_mongo_db() -> AsyncIOMotorDatabase:
    """Get or create MongoDB database connection."""
    global _mongo_client, _mongo_db
    if _mongo_db is None:
        _mongo_client = AsyncIOMotorClient(settings.mongo_url)
        _mongo_db = _mongo_client[settings.mongo_db_name]
    return _mongo_db


@dataclass
class ChatMessageDoc:
    """A single message in a chat session."""
    role: str  # "user" | "assistant"
    content: str
    timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    agent_output: Optional[dict] = None


@dataclass
class ChatSessionDoc:
    """A chat session document."""
    org_id: str
    user_id: str
    title: str = "New Chat"
    messages: list[dict] = field(default_factory=list)
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    _id: Optional[str] = None


class ChatSessionStore:
    """
    MongoDB-backed chat session storage.
    
    Collection: chat_sessions
    Document structure:
    {
        _id: ObjectId,
        org_id: str,
        user_id: str,
        title: str,
        messages: [
            {role: str, content: str, timestamp: str, agent_output?: dict}
        ],
        created_at: str,
        updated_at: str
    }
    """
    
    COLLECTION = "chat_sessions"
    
    def __init__(self, org_id: str, user_id: str):
        self.org_id = org_id
        self.user_id = user_id
    
    async def _get_collection(self):
        """Get the chat_sessions collection."""
        db = await get_mongo_db()
        return db[self.COLLECTION]
    
    async def create_session(self, title: str = "New Chat") -> str:
        """
        Create a new chat session.
        
        Returns the session ID.
        """
        collection = await self._get_collection()
        
        session = {
            "org_id": self.org_id,
            "user_id": self.user_id,
            "title": title,
            "messages": [],
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        }
        
        result = await collection.insert_one(session)
        session_id = str(result.inserted_id)
        
        logger.info(f"Created chat session: {session_id}")
        return session_id
    
    async def list_sessions(self, limit: int = 50) -> list[dict]:
        """
        List all chat sessions for this org/user.
        
        Returns sessions sorted by updated_at descending.
        """
        collection = await self._get_collection()
        
        cursor = collection.find(
            {"org_id": self.org_id, "user_id": self.user_id},
            {"_id": 1, "title": 1, "created_at": 1, "updated_at": 1, "messages": {"$slice": 1}}
        ).sort("updated_at", -1).limit(limit)
        
        sessions = []
        async for doc in cursor:
            # Get message count
            message_count = len(doc.get("messages", []))
            
            # Get first message preview
            first_message = None
            if doc.get("messages"):
                first_message = doc["messages"][0].get("content", "")[:100]
            
            sessions.append({
                "id": str(doc["_id"]),
                "title": doc.get("title", "New Chat"),
                "created_at": doc.get("created_at"),
                "updated_at": doc.get("updated_at"),
                "preview": first_message,
            })
        
        # Get actual message counts
        for session in sessions:
            full_doc = await collection.find_one(
                {"_id": ObjectId(session["id"])},
                {"messages": 1}
            )
            session["message_count"] = len(full_doc.get("messages", [])) if full_doc else 0
        
        return sessions
    
    async def get_session(self, session_id: str) -> Optional[dict]:
        """Get a single session with all messages."""
        collection = await self._get_collection()
        
        try:
            doc = await collection.find_one({
                "_id": ObjectId(session_id),
                "org_id": self.org_id,
                "user_id": self.user_id,
            })
            
            if not doc:
                return None
            
            return {
                "id": str(doc["_id"]),
                "title": doc.get("title", "New Chat"),
                "messages": doc.get("messages", []),
                "created_at": doc.get("created_at"),
                "updated_at": doc.get("updated_at"),
            }
        except Exception as e:
            logger.error(f"Error fetching session {session_id}: {e}")
            return None
    
    async def add_message(
        self, 
        session_id: str, 
        role: str, 
        content: str,
        agent_output: Optional[dict] = None
    ) -> bool:
        """Add a message to a session."""
        collection = await self._get_collection()
        
        message = {
            "role": role,
            "content": content,
            "timestamp": datetime.utcnow().isoformat(),
        }
        
        if agent_output:
            message["agent_output"] = agent_output
        
        try:
            result = await collection.update_one(
                {
                    "_id": ObjectId(session_id),
                    "org_id": self.org_id,
                    "user_id": self.user_id,
                },
                {
                    "$push": {"messages": message},
                    "$set": {"updated_at": datetime.utcnow().isoformat()}
                }
            )
            return result.modified_count > 0
        except Exception as e:
            logger.error(f"Error adding message to session {session_id}: {e}")
            return False
    
    async def update_title(self, session_id: str, title: str) -> bool:
        """Update session title."""
        collection = await self._get_collection()
        
        try:
            result = await collection.update_one(
                {
                    "_id": ObjectId(session_id),
                    "org_id": self.org_id,
                    "user_id": self.user_id,
                },
                {"$set": {"title": title, "updated_at": datetime.utcnow().isoformat()}}
            )
            return result.modified_count > 0
        except Exception as e:
            logger.error(f"Error updating session title {session_id}: {e}")
            return False
    
    async def delete_session(self, session_id: str) -> bool:
        """Delete a session."""
        collection = await self._get_collection()
        
        try:
            result = await collection.delete_one({
                "_id": ObjectId(session_id),
                "org_id": self.org_id,
                "user_id": self.user_id,
            })
            return result.deleted_count > 0
        except Exception as e:
            logger.error(f"Error deleting session {session_id}: {e}")
            return False
