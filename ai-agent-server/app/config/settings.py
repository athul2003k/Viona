"""
Viona AI Agent Server Configuration

All settings are loaded from environment variables with sensible defaults.
"""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings with environment variable loading."""

    # Server
    app_name: str = "Viona AI Agent Server"
    debug: bool = False

    # Clerk Authentication
    clerk_jwks_url: str = "https://api.clerk.com/.well-known/jwks.json"
    clerk_issuer: str = ""  # e.g., https://clerk.your-domain.com

    # LLM Providers
    groq_api_key: str = ""
    openrouter_api_key: str = ""
    default_provider: str = "groq"
    default_model: str = "llama-3.3-70b-versatile"

    # Token Limits
    default_org_token_limit: int = 1_000_000  # 1M tokens default
    token_reserve_buffer: float = 0.1  # Reserve 10% for overhead

    # Redis
    redis_url: str = "redis://localhost:6379"
    memory_ttl_seconds: int = 14400  # 4 hours for short-term memory

    # Rate Limiting
    ws_rate_limit_per_minute: int = 30  # Max messages per user per minute

    # LLM Retries
    llm_max_retries: int = 3
    llm_retry_wait_seconds: int = 2

    # MongoDB
    mongo_url: str = "mongodb://root:password@localhost:27017"
    mongo_db_name: str = "viona_agents"

    # Kafka
    # RabbitMQ
    rabbitmq_url: str = "amqp://guest:guest@localhost:5672"
    rabbitmq_token_queue: str = "token_usage"
    rabbitmq_client_id: str = "viona-ai-agent"

    # Database (read-only for tools)
    database_url: str = ""

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


@lru_cache
def get_settings() -> Settings:
    """Cached settings instance."""
    return Settings()
