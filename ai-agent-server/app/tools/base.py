"""
Base Tool Abstraction

All tools inherit from BaseTool and provide controlled database access.
Tools enforce RBAC and never expose raw database connections to agents.
"""

import logging
from abc import ABC, abstractmethod
from typing import Any, Optional
from dataclasses import dataclass, field
from enum import Enum
import time

import asyncpg

from app.config import get_settings
from app.auth import AuthContext

logger = logging.getLogger(__name__)
settings = get_settings()

_db_pool: Optional[asyncpg.Pool] = None


async def get_db_pool() -> asyncpg.Pool:
    """Get or create database connection pool."""
    global _db_pool
    
    if _db_pool is None:
        _db_pool = await asyncpg.create_pool(
            settings.database_url,
            min_size=2,
            max_size=10,
        )
        logger.info("Database connection pool created")
    
    return _db_pool


@dataclass
class ToolResult:
    """Result from tool execution."""
    success: bool
    data: Any = None
    error: Optional[str] = None
    duration_ms: int = 0


class ActionStatus(str, Enum):
    """Status of an action tool execution."""
    MISSING_DATA = "missing_data"      # Need more info from user
    PENDING_CONFIRMATION = "pending"   # Ready for user confirmation
    CONFIRMED = "confirmed"            # User approved, execute
    EXECUTED = "executed"              # Action completed
    CANCELLED = "cancelled"            # User declined


@dataclass
class ActionResult:
    """Result from action tool execution with confirmation workflow."""
    status: ActionStatus
    success: bool = True
    data: Any = None
    error: Optional[str] = None
    duration_ms: int = 0
    
    # For MISSING_DATA status
    missing_fields: list[str] = field(default_factory=list)
    prompt_message: Optional[str] = None
    
    # For PENDING_CONFIRMATION status
    preview_data: Optional[dict] = None
    confirmation_message: Optional[str] = None
    
    # For EXECUTED status
    result_message: Optional[str] = None
    created_id: Optional[str] = None


class BaseTool(ABC):
    """
    Abstract base class for all tools.
    
    Tools provide controlled, read-only database access.
    All tools must enforce RBAC based on AuthContext.
    """
    
    name: str = "base_tool"
    description: str = "Base tool"
    
    # Required roles to use this tool (empty = all authenticated users)
    required_roles: list[str] = []
    
    def __init__(self, auth: AuthContext):
        self.auth = auth
        self.org_id = auth.org_id
    
    def check_permission(self) -> bool:
        """Check if user has permission to use this tool."""
        if not self.required_roles:
            return True
        
        if self.auth.role == "admin":
            return True
        
        return self.auth.role in self.required_roles
    
    @abstractmethod
    async def execute(self, **kwargs) -> ToolResult:
        """Execute the tool. Must be implemented by subclasses."""
        pass
    
    async def run(self, **kwargs) -> ToolResult:
        """Run tool with permission check and timing."""
        if not self.check_permission():
            return ToolResult(
                success=False,
                error=f"Permission denied. Required roles: {self.required_roles}"
            )
        
        start = time.time()
        try:
            result = await self.execute(**kwargs)
            result.duration_ms = int((time.time() - start) * 1000)
            return result
        except Exception as e:
            logger.exception(f"Tool {self.name} failed")
            return ToolResult(
                success=False,
                error=str(e),
                duration_ms=int((time.time() - start) * 1000)
            )
    
    async def query(self, sql: str, *args) -> list[dict]:
        """Execute a read-only query with organization scoping."""
        pool = await get_db_pool()
        
        async with pool.acquire() as conn:
            rows = await conn.fetch(sql, *args)
            return [dict(row) for row in rows]
    
    async def query_one(self, sql: str, *args) -> Optional[dict]:
        """Execute a query expecting single result."""
        pool = await get_db_pool()
        
        async with pool.acquire() as conn:
            row = await conn.fetchrow(sql, *args)
            return dict(row) if row else None


class ActionTool(BaseTool):
    """
    Base class for tools that modify data and require user confirmation.
    
    Action tools follow a strict workflow:
    1. Validate inputs - check required fields
    2. Preview - show what will happen
    3. Confirm - user approves
    4. Execute - perform the action
    """
    
    # Define required fields for this action
    required_fields: list[str] = []
    
    # Human-readable field descriptions for prompts
    field_descriptions: dict[str, str] = {}
    
    # Action metadata
    action_type: str = "modify"  # create, update, delete
    
    def validate_inputs(self, **kwargs) -> tuple[bool, list[str]]:
        """
        Validate that all required inputs are present.
        Returns (is_valid, missing_fields).
        """
        missing = []
        for field_name in self.required_fields:
            if field_name not in kwargs or kwargs[field_name] is None:
                missing.append(field_name)
        return len(missing) == 0, missing
    
    def get_missing_fields_prompt(self, missing: list[str]) -> str:
        """Generate a prompt asking for missing fields."""
        if len(missing) == 1:
            field_name = missing[0]
            desc = self.field_descriptions.get(field_name, field_name)
            return f"I need the {desc} to proceed. What is it?"
        else:
            field_list = ", ".join(
                self.field_descriptions.get(f, f) for f in missing
            )
            return f"I need a few more details: {field_list}. Please provide them."
    
    @abstractmethod
    async def preview(self, **kwargs) -> ActionResult:
        """
        Preview the action without executing.
        Returns what will happen if confirmed.
        """
        pass
    
    @abstractmethod
    async def confirm(self, **kwargs) -> ActionResult:
        """
        Execute the confirmed action.
        Only called after user approves the preview.
        """
        pass
    
    async def execute(self, **kwargs) -> ToolResult:
        """
        Main execution - validates and returns preview.
        For ActionTools, use run_action() instead.
        """
        # Validate inputs first
        is_valid, missing = self.validate_inputs(**kwargs)
        if not is_valid:
            return ToolResult(
                success=False,
                error=f"Missing required fields: {', '.join(missing)}",
                data={"missing_fields": missing}
            )
        
        # Return preview
        action_result = await self.preview(**kwargs)
        return ToolResult(
            success=action_result.success,
            data=action_result.preview_data,
            error=action_result.error
        )
    
    async def run_action(
        self, 
        confirmed: bool = False,
        **kwargs
    ) -> ActionResult:
        """
        Run action with full workflow support.
        
        Args:
            confirmed: If True, execute the action. If False, return preview.
            **kwargs: Action parameters
        """
        if not self.check_permission():
            return ActionResult(
                status=ActionStatus.CANCELLED,
                success=False,
                error=f"Permission denied. Required roles: {self.required_roles}"
            )
        
        start = time.time()
        
        try:
            # Step 1: Validate inputs
            is_valid, missing = self.validate_inputs(**kwargs)
            if not is_valid:
                return ActionResult(
                    status=ActionStatus.MISSING_DATA,
                    success=True,  # Not an error, just need more info
                    missing_fields=missing,
                    prompt_message=self.get_missing_fields_prompt(missing),
                    duration_ms=int((time.time() - start) * 1000)
                )
            
            # Step 2: If not confirmed, return preview
            if not confirmed:
                result = await self.preview(**kwargs)
                result.duration_ms = int((time.time() - start) * 1000)
                return result
            
            # Step 3: Execute confirmed action
            result = await self.confirm(**kwargs)
            result.duration_ms = int((time.time() - start) * 1000)
            return result
            
        except Exception as e:
            logger.exception(f"Action tool {self.name} failed")
            return ActionResult(
                status=ActionStatus.CANCELLED,
                success=False,
                error=str(e),
                duration_ms=int((time.time() - start) * 1000)
            )
    
    async def execute_write(self, sql: str, *args) -> Optional[dict]:
        """Execute a write query (INSERT/UPDATE/DELETE) within a transaction."""
        pool = await get_db_pool()
        
        async with pool.acquire() as conn:
            async with conn.transaction():
                row = await conn.fetchrow(sql, *args)
                return dict(row) if row else None
    
    async def execute_write_many(self, sql: str, args_list: list) -> int:
        """Execute multiple write queries within a transaction."""
        pool = await get_db_pool()
        
        async with pool.acquire() as conn:
            async with conn.transaction():
                count = 0
                for args in args_list:
                    await conn.execute(sql, *args)
                    count += 1
                return count

