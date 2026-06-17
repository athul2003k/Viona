"""
Model Selector

Dynamically selects the best model based on task complexity,
organization plan, and cost considerations.
"""

from typing import Optional
from dataclasses import dataclass

from app.llms import ModelConfig, MODEL_RECOMMENDATIONS
from app.config import get_settings

settings = get_settings()


@dataclass
class ModelSelection:
    """Result of model selection."""
    provider: str
    model: str
    max_tokens: int
    estimated_input_cost_per_1k: float
    estimated_output_cost_per_1k: float
    rationale: str


# Organization plan tiers with model access
PLAN_MODEL_ACCESS = {
    "free": {
        "providers": ["groq"],
        "max_tokens": 2000,
        "models": ["llama-3.1-8b-instant"]
    },
    "pro": {
        "providers": ["groq"],
        "max_tokens": 4096,
        "models": ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"]
    },
    "enterprise": {
        "providers": ["groq", "openrouter"],
        "max_tokens": 8192,
        "models": ["*"]  # All models
    }
}


def select_model(
    task_type: str,
    org_plan: str = "pro",
    complexity: str = "medium",
    prefer_speed: bool = False,
) -> ModelSelection:
    """
    Select optimal model based on task and constraints.
    
    Args:
        task_type: Type of task (analytics, routing, summarization, complex)
        org_plan: Organization subscription tier
        complexity: Task complexity (low, medium, high)
        prefer_speed: Prefer faster models over more capable ones
    
    Returns:
        ModelSelection with chosen provider/model and rationale
    """
    plan_limits = PLAN_MODEL_ACCESS.get(org_plan, PLAN_MODEL_ACCESS["pro"])
    
    # Get base recommendation
    base_config = MODEL_RECOMMENDATIONS.get(task_type, MODEL_RECOMMENDATIONS["analytics"])
    
    # Check if plan allows this model
    if base_config.provider not in plan_limits["providers"]:
        # Fall back to groq
        base_config = ModelConfig(
            provider="groq",
            model="llama-3.3-70b-versatile",
            max_tokens=min(base_config.max_tokens, plan_limits["max_tokens"])
        )
    
    # Adjust for speed preference
    if prefer_speed and base_config.provider == "groq":
        base_config = ModelConfig(
            provider="groq",
            model="llama-3.1-8b-instant",
            max_tokens=min(2000, plan_limits["max_tokens"])
        )
    
    # Adjust for complexity
    if complexity == "high" and org_plan == "enterprise":
        base_config = ModelConfig(
            provider="openrouter",
            model="anthropic/claude-3-5-sonnet",
            max_tokens=8192
        )
    
    # Cap tokens at plan limit
    max_tokens = min(base_config.max_tokens, plan_limits["max_tokens"])
    
    return ModelSelection(
        provider=base_config.provider,
        model=base_config.model,
        max_tokens=max_tokens,
        estimated_input_cost_per_1k=0.0006 if base_config.provider == "groq" else 0.003,
        estimated_output_cost_per_1k=0.0008 if base_config.provider == "groq" else 0.015,
        rationale=f"Selected {base_config.model} for {task_type} task (plan={org_plan}, complexity={complexity})"
    )
