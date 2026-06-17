"""
Viona AI Agent Server - Main Entry Point

Production-grade FastAPI application with WebSocket support for AI chat.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.api.chat import router as chat_router
from app.api.sessions import router as sessions_router
from app.observability.logger import setup_logging

logger = logging.getLogger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle manager."""
    # Startup
    setup_logging(debug=settings.debug)
    logger.info(f"Starting {settings.app_name}")

    # Initialize connections
    from app.tokens.publisher import get_rabbitmq_connection, close_rabbitmq_connection
    from app.memory.redis_memory import get_redis_client
    from app.observability.logger import get_mongo_client

    # Connect to services
    redis = await get_redis_client()
    mongo = await get_mongo_client()
    # Pre-connect to RabbitMQ
    await get_rabbitmq_connection()

    logger.info("All services connected")

    yield

    # Shutdown
    logger.info("Shutting down...")
    await close_rabbitmq_connection()
    if redis:
        await redis.close()
    if mongo:
        mongo.close()


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="Production AI Agent Server for Viona SaaS",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(chat_router, prefix="/ws", tags=["chat"])
app.include_router(sessions_router, prefix="/api", tags=["sessions"])


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": settings.app_name}


@app.get("/ready")
async def readiness_check():
    """Readiness check - verifies all dependencies."""
    from app.memory.redis_memory import get_redis_client
    
    try:
        redis = await get_redis_client()
        await redis.ping()
        return {"status": "ready"}
    except Exception as e:
        logger.error(f"Readiness check failed: {e}")
        return {"status": "not_ready", "error": str(e)}
