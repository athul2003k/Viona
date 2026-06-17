"""
Clerk JWT Authentication

Validates Clerk JWTs and resolves organization membership server-side.
"""

import logging
from dataclasses import dataclass
from typing import Optional

import httpx
import jwt
from jwt import PyJWKClient
from fastapi import WebSocket, HTTPException, status, Header

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# JWKS client for Clerk public keys
_jwks_client: Optional[PyJWKClient] = None


def get_jwks_client() -> PyJWKClient:
    """Get cached JWKS client."""
    global _jwks_client
    if _jwks_client is None:
        _jwks_client = PyJWKClient(settings.clerk_jwks_url, cache_keys=True)
    return _jwks_client


@dataclass
class AuthContext:
    """Authenticated user context."""
    user_id: str          # Clerk user ID (string like 'user_31C6...')
    db_user_id: int       # Database user_id (numeric BigInt)
    org_id: str           # Organization ID (resolved server-side)
    role: str             # User role in organization
    email: Optional[str] = None


async def validate_clerk_token(token: str) -> dict:
    """
    Validate Clerk JWT and return claims.
    
    Raises:
        HTTPException: If token is invalid or expired
    """
    try:
        jwks_client = get_jwks_client()
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            audience=None,  # Clerk doesn't use audience
            options={"verify_aud": False},
            leeway=30,  # 30s leeway for clock skew / Docker network delay
        )
        
        return claims
    except jwt.ExpiredSignatureError:
        logger.warning("JWT token expired")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired"
        )
    except jwt.InvalidTokenError as e:
        logger.warning(f"Invalid JWT token: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )


async def resolve_org_membership(user_id: str, requested_org_id: str) -> tuple[int, str, str]:
    """
    Resolve and verify organization membership from database.
    
    NEVER trust frontend-provided org_id - always verify server-side.
    
    Returns:
        Tuple of (db_user_id, org_id, role)
        
    Raises:
        HTTPException: If user is not a member of the organization
    """
    import asyncpg
    from app.tools.base import get_db_pool
    
    try:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            # Get user's internal ID from clerk_id
            user_row = await conn.fetchrow(
                'SELECT user_id FROM "User" WHERE clerk_id = $1',
                user_id
            )
            
            if not user_row:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="User not found"
                )
            
            internal_user_id = user_row["user_id"]
            
            # Check organization membership
            membership = await conn.fetchrow(
                '''
                SELECT om.role, o.org_id, o.created_by
                FROM "OrganizationMember" om
                JOIN "Organization" o ON o.org_id = om.org_id
                WHERE om.user_id = $1 AND om.org_id = $2
                ''',
                internal_user_id,
                int(requested_org_id)
            )
            
            # Also check if user is the creator (admin by default)
            if not membership:
                org_row = await conn.fetchrow(
                    'SELECT org_id, created_by FROM "Organization" WHERE org_id = $1',
                    int(requested_org_id)
                )
                if org_row and org_row["created_by"] == internal_user_id:
                    membership = {"role": "admin", "org_id": org_row["org_id"]}
        
        if not membership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not a member of this organization"
            )
        
        return int(internal_user_id), str(membership["org_id"]), membership["role"]
        
    except asyncpg.PostgresError as e:
        logger.error(f"Database error during org resolution: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to verify organization membership"
        )


async def authenticate_websocket(websocket: WebSocket) -> AuthContext:
    """
    Authenticate WebSocket connection using Clerk JWT.
    
    Expects token in query params: ws://host/ws/chat?token=xxx&org_id=123
    """
    token = websocket.query_params.get("token")
    org_id = websocket.query_params.get("org_id")
    
    if not token:
        await websocket.close(code=4001, reason="Missing authentication token")
        raise HTTPException(status_code=401, detail="Missing token")
    
    if not org_id:
        await websocket.close(code=4002, reason="Missing organization ID")
        raise HTTPException(status_code=400, detail="Missing org_id")
    
    # Validate JWT
    claims = await validate_clerk_token(token)
    user_id = claims.get("sub")  # Clerk stores user ID in 'sub' claim
    email = claims.get("email")
    
    if not user_id:
        await websocket.close(code=4003, reason="Invalid token claims")
        raise HTTPException(status_code=401, detail="Invalid token")
    
    # Resolve organization membership (NEVER trust frontend org_id)
    db_user_id, verified_org_id, role = await resolve_org_membership(user_id, org_id)
    
    return AuthContext(
        user_id=user_id,
        db_user_id=db_user_id,
        org_id=verified_org_id,
        role=role,
        email=email
    )


async def get_current_user(
    authorization: str = Header(..., alias="Authorization"),
    x_org_id: str = Header(..., alias="X-Org-Id"),
) -> AuthContext:
    """
    FastAPI dependency for HTTP request authentication.
    
    Expects:
    - Authorization: Bearer <token>
    - X-Org-Id: <org_id>
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header"
        )
    
    token = authorization.replace("Bearer ", "")
    
    if not x_org_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing X-Org-Id header"
        )
    
    # Validate JWT
    claims = await validate_clerk_token(token)
    user_id = claims.get("sub")
    email = claims.get("email")
    
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token claims"
        )
    
    # Resolve organization membership
    db_user_id, verified_org_id, role = await resolve_org_membership(user_id, x_org_id)
    
    return AuthContext(
        user_id=user_id,
        db_user_id=db_user_id,
        org_id=verified_org_id,
        role=role,
        email=email
    )
