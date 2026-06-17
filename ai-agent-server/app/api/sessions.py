"""
Chat Sessions REST API

REST endpoints for managing chat sessions.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.auth import get_current_user, AuthContext
from app.memory import ChatSessionStore

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/sessions", tags=["sessions"])


class CreateSessionRequest(BaseModel):
    """Request to create a new session."""
    title: Optional[str] = "New Chat"


class CreateSessionResponse(BaseModel):
    """Response with created session ID."""
    id: str
    title: str


class SessionSummary(BaseModel):
    """Summary of a session for list view."""
    id: str
    title: str
    created_at: str
    updated_at: str
    message_count: int
    preview: Optional[str] = None


class SessionListResponse(BaseModel):
    """List of sessions."""
    sessions: list[SessionSummary]


class MessageResponse(BaseModel):
    """A single message."""
    role: str
    content: str
    timestamp: str
    agent_output: Optional[dict] = None


class SessionDetailResponse(BaseModel):
    """Full session with messages."""
    id: str
    title: str
    messages: list[MessageResponse]
    created_at: str
    updated_at: str


class UpdateTitleRequest(BaseModel):
    """Request to update session title."""
    title: str


@router.get("", response_model=SessionListResponse)
async def list_sessions(
    auth: AuthContext = Depends(get_current_user),
    limit: int = Query(50, ge=1, le=100),
):
    """List all chat sessions for the current user/org."""
    store = ChatSessionStore(org_id=auth.org_id, user_id=auth.user_id)
    sessions = await store.list_sessions(limit=limit)
    
    return SessionListResponse(
        sessions=[SessionSummary(**s) for s in sessions]
    )


@router.post("", response_model=CreateSessionResponse)
async def create_session(
    request: CreateSessionRequest,
    auth: AuthContext = Depends(get_current_user),
):
    """Create a new chat session."""
    store = ChatSessionStore(org_id=auth.org_id, user_id=auth.user_id)
    session_id = await store.create_session(title=request.title or "New Chat")
    
    return CreateSessionResponse(id=session_id, title=request.title or "New Chat")


@router.get("/{session_id}", response_model=SessionDetailResponse)
async def get_session(
    session_id: str,
    auth: AuthContext = Depends(get_current_user),
):
    """Get a session with all messages."""
    store = ChatSessionStore(org_id=auth.org_id, user_id=auth.user_id)
    session = await store.get_session(session_id)
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return SessionDetailResponse(
        id=session["id"],
        title=session["title"],
        messages=[MessageResponse(**m) for m in session["messages"]],
        created_at=session["created_at"],
        updated_at=session["updated_at"],
    )


@router.patch("/{session_id}")
async def update_session_title(
    session_id: str,
    request: UpdateTitleRequest,
    auth: AuthContext = Depends(get_current_user),
):
    """Update session title."""
    store = ChatSessionStore(org_id=auth.org_id, user_id=auth.user_id)
    success = await store.update_title(session_id, request.title)
    
    if not success:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return {"success": True}


@router.delete("/{session_id}")
async def delete_session(
    session_id: str,
    auth: AuthContext = Depends(get_current_user),
):
    """Delete a session."""
    store = ChatSessionStore(org_id=auth.org_id, user_id=auth.user_id)
    success = await store.delete_session(session_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return {"success": True}
