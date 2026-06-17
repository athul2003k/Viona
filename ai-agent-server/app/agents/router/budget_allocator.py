"""
Budget Allocator

Allocates token budgets for agent execution based on task type,
organization quota, and complexity.
"""

from dataclasses import dataclass

from app.tokens import TokenLimiter, TokenQuota
from app.config import get_settings

settings = get_settings()


@dataclass
class BudgetAllocation:
    """Token budget allocation for an agent execution."""
    total_budget: int
    routing_budget: int
    agent_budget: int
    reserve: int
    warning: str | None = None


# Default budgets by task type  
TASK_BUDGETS = {
    "routing": 500,
    "analytics": 8000,
    "orders": 6000,
    "inventory": 5000,
    "general": 3000,
    "complex": 15000,
}


async def allocate_budget(
    org_id: str,
    task_type: str,
    complexity: str = "medium"
) -> BudgetAllocation:
    """
    Allocate token budget for agent execution.
    
    Considers:
    - Organization remaining quota
    - Task type requirements
    - Complexity multiplier
    """
    limiter = TokenLimiter(org_id)
    quota = await limiter.get_quota()
    
    # Base budget for task type
    base_budget = TASK_BUDGETS.get(task_type, TASK_BUDGETS["general"])
    
    # Complexity multiplier
    multipliers = {"low": 0.7, "medium": 1.0, "high": 1.5}
    multiplier = multipliers.get(complexity, 1.0)
    
    requested_budget = int(base_budget * multiplier)
    
    # Ensure we don't exceed remaining quota
    available = quota.remaining
    warning = None
    
    if requested_budget > available:
        warning = f"Budget reduced from {requested_budget} to {available} due to quota limits"
        requested_budget = available
    
    if quota.percentage_used > 80:
        warning = f"Warning: {quota.percentage_used:.1f}% of token quota used"
    
    # Allocate between routing and agent
    routing_budget = min(500, requested_budget // 10)
    agent_budget = requested_budget - routing_budget
    reserve = int(requested_budget * 0.1)  # 10% reserve for overhead
    
    return BudgetAllocation(
        total_budget=requested_budget,
        routing_budget=routing_budget,
        agent_budget=agent_budget - reserve,
        reserve=reserve,
        warning=warning
    )
