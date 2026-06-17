"""
WebSocket Chat Endpoint

Production WebSocket handler for real-time AI chat.
Supports token-by-token streaming, rate limiting, cancellation, and error propagation.
"""

import logging
import json
import uuid
import time
from typing import Optional
from enum import Enum

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.auth import authenticate_websocket, AuthContext
from app.agents import execute_router, AgentState, ExecutionContext
from app.agents.base import create_initial_state
from app.memory import RedisMemoryStore
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()
router = APIRouter()


class MessageType(str, Enum):
    """WebSocket message types."""
    # Client -> Server
    MESSAGE = "message"
    CANCEL = "cancel"
    
    # Server -> Client
    STREAM = "stream"
    COMPLETE = "complete"
    TOOL_UPDATE = "tool_update"
    ERROR = "error"
    CONNECTED = "connected"


class ConnectionManager:
    """Manages active WebSocket connections with rate limiting."""
    
    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}
        self.cancelled: set[str] = set()
        # Rate limiting: user_id -> list of timestamps
        self._rate_limits: dict[str, list[float]] = {}
    
    async def connect(self, connection_id: str, websocket: WebSocket) -> None:
        """Accept and register connection."""
        await websocket.accept()
        self.active_connections[connection_id] = websocket
    
    def disconnect(self, connection_id: str) -> None:
        """Remove connection."""
        self.active_connections.pop(connection_id, None)
        self.cancelled.discard(connection_id)
    
    async def send_json(self, connection_id: str, data: dict) -> None:
        """Send JSON message."""
        if ws := self.active_connections.get(connection_id):
            await ws.send_json(data)
    
    def cancel(self, connection_id: str) -> None:
        """Mark connection as cancelled."""
        self.cancelled.add(connection_id)
    
    def is_cancelled(self, connection_id: str) -> bool:
        """Check if connection is cancelled."""
        return connection_id in self.cancelled
    
    def check_rate_limit(self, user_id: str) -> bool:
        """
        Check if user is within rate limit.
        
        Uses a sliding window of timestamps.
        Returns True if request is allowed, False if rate limited.
        """
        now = time.time()
        window = 60.0  # 1 minute window
        max_requests = settings.ws_rate_limit_per_minute
        
        if user_id not in self._rate_limits:
            self._rate_limits[user_id] = []
        
        # Remove timestamps outside the window
        self._rate_limits[user_id] = [
            ts for ts in self._rate_limits[user_id] 
            if now - ts < window
        ]
        
        if len(self._rate_limits[user_id]) >= max_requests:
            return False
        
        self._rate_limits[user_id].append(now)
        return True


manager = ConnectionManager()


@router.websocket("/chat")
async def websocket_chat(websocket: WebSocket):
    """
    WebSocket endpoint for AI chat.
    
    Connection: ws://host/ws/chat?token=xxx&org_id=123&session_id=optional
    
    Client -> Server messages:
    - {"type": "message", "content": "Hello", "session_id": "optional"}
    - {"type": "cancel"}
    
    Server -> Client messages:
    - {"type": "connected", "session_id": "xxx"}
    - {"type": "stream", "delta": "text chunk"}
    - {"type": "tool_update", "tool": "name", "status": "running|complete"}
    - {"type": "complete", "output": {...structured output...}}
    - {"type": "error", "message": "error text"}
    """
    connection_id = str(uuid.uuid4())
    session_id: Optional[str] = None
    auth: Optional[AuthContext] = None
    
    try:
        # Authenticate
        auth = await authenticate_websocket(websocket)
        
        # Get session_id from query params if provided
        session_id = websocket.query_params.get("session_id")
        
        # Create or validate session
        from app.memory import ChatSessionStore
        session_store = ChatSessionStore(org_id=auth.org_id, user_id=auth.user_id)
        
        if session_id:
            # Validate existing session
            existing = await session_store.get_session(session_id)
            if not existing:
                # Invalid session_id, create new one
                session_id = await session_store.create_session()
        else:
            # Create new session
            session_id = await session_store.create_session()
        
        # Register connection
        await manager.connect(connection_id, websocket)
        
        # Send connected confirmation
        await manager.send_json(connection_id, {
            "type": MessageType.CONNECTED,
            "session_id": session_id,
            "org_id": auth.org_id,
            "user_id": auth.user_id,
        })
        
        logger.info(f"WebSocket connected: {connection_id}, user={auth.user_id}, session={session_id}")
        
        # Message loop
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")
            
            # Allow client to switch session mid-connection
            incoming_session_id = data.get("session_id")
            if incoming_session_id and incoming_session_id != session_id:
                # Validate and switch
                existing = await session_store.get_session(incoming_session_id)
                if existing:
                    session_id = incoming_session_id
            
            # Handle ping for keepalive
            if msg_type == "ping":
                await manager.send_json(connection_id, {"type": "pong"})
                continue
            
            if msg_type == MessageType.CANCEL:
                manager.cancel(connection_id)
                await manager.send_json(connection_id, {
                    "type": MessageType.ERROR,
                    "message": "Request cancelled"
                })
                continue
            
            if msg_type == MessageType.MESSAGE:
                content = data.get("content", "").strip()
                
                if not content:
                    await manager.send_json(connection_id, {
                        "type": MessageType.ERROR,
                        "message": "Empty message"
                    })
                    continue
                
                # Rate limit check
                if not manager.check_rate_limit(auth.user_id):
                    await manager.send_json(connection_id, {
                        "type": MessageType.ERROR,
                        "message": "Rate limit exceeded. Please wait a moment before sending another message."
                    })
                    continue
                
                # Process message
                await process_message(
                    connection_id=connection_id,
                    session_id=session_id,
                    auth=auth,
                    content=content,
                )
    
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected: {connection_id}")
    except Exception as e:
        logger.exception(f"WebSocket error: {connection_id}")
        try:
            await manager.send_json(connection_id, {
                "type": MessageType.ERROR,
                "message": str(e)
            })
        except:
            pass
    finally:
        manager.disconnect(connection_id)


async def process_message(
    connection_id: str,
    session_id: str,
    auth: AuthContext,
    content: str,
) -> None:
    """Process a chat message through the agent pipeline with streaming."""
    message_id = str(uuid.uuid4())
    
    # Initialize session store for persistence
    from app.memory import ChatSessionStore
    session_store = ChatSessionStore(org_id=auth.org_id, user_id=auth.user_id)
    
    try:
        # Check for cancellation
        if manager.is_cancelled(connection_id):
            return
        
        # Store user message in MongoDB
        await session_store.add_message(session_id, "user", content)
        
        # Auto-generate title from first message
        session = await session_store.get_session(session_id)
        if session and len(session.get("messages", [])) == 1:
            # First message - generate title
            title = content[:50] + ("..." if len(content) > 50 else "")
            await session_store.update_title(session_id, title)
        
        # Create stream callback for token-by-token streaming
        async def stream_callback(delta: str) -> None:
            """Send each token chunk to the client via WebSocket."""
            if not manager.is_cancelled(connection_id):
                await manager.send_json(connection_id, {
                    "type": MessageType.STREAM,
                    "delta": delta,
                    "message_id": message_id,
                })
        
        # Create execution context with stream callback
        context = ExecutionContext(
            auth=auth,
            session_id=session_id,
            message_id=message_id,
        )
        
        # Attach stream callback to context for agents to use
        context.stream_callback = stream_callback
        
        # Create initial state
        state = create_initial_state(content, context)
        
        # Send tool update
        await manager.send_json(connection_id, {
            "type": MessageType.TOOL_UPDATE,
            "tool": "router",
            "status": "classifying intent"
        })
        
        # Execute router
        result = await execute_router(state)
        
        # Check for cancellation
        if manager.is_cancelled(connection_id):
            return
        
        # Check for errors
        if result.get("error"):
            await manager.send_json(connection_id, {
                "type": MessageType.ERROR,
                "message": result["error"]
            })
            return
        
        # Get output
        output = result.get("output", {})
        
        # Store assistant message in MongoDB
        await session_store.add_message(
            session_id, 
            "assistant", 
            output.get("summary", ""),
            agent_output=output
        )
        
        # Send complete response (always sent, even after streaming)
        await manager.send_json(connection_id, {
            "type": MessageType.COMPLETE,
            "message_id": message_id,
            "session_id": session_id,
            "output": output
        })
        
        logger.info(f"Message processed: {message_id}, session={session_id}")
    
    except Exception as e:
        logger.exception(f"Error processing message: {message_id}")
        await manager.send_json(connection_id, {
            "type": MessageType.ERROR,
            "message": f"Processing error: {str(e)}"
        })
