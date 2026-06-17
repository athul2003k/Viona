"""
RabbitMQ Token Usage Publisher

Emits token usage events for billing and observability.
"""

import json
import logging
import asyncio
from typing import Optional
from datetime import datetime, timezone

import aio_pika
from aio_pika.abc import AbstractConnection, AbstractChannel

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

_connection: Optional[AbstractConnection] = None
_channel: Optional[AbstractChannel] = None


async def get_rabbitmq_connection() -> Optional[AbstractChannel]:
    """Get or create RabbitMQ channel."""
    global _connection, _channel
    
    if _connection and not _connection.is_closed and _channel and not _channel.is_closed:
        return _channel

    try:
        logger.info(f"Connecting to RabbitMQ at {settings.rabbitmq_url}...")
        _connection = await aio_pika.connect_robust(
            settings.rabbitmq_url, 
            client_properties={"connection_name": settings.rabbitmq_client_id}
        )
        
        _channel = await _connection.channel()
        
        # Declare queue to ensure it exists
        await _channel.declare_queue(
            settings.rabbitmq_token_queue, 
            durable=True
        )
        
        logger.info("✅ RabbitMQ Publisher Connected")
        return _channel
    except Exception as e:
        logger.error(f"Failed to connect to RabbitMQ: {e}")
        return None


async def emit_token_event(
    org_id: str,
    user_id: str,
    model: str,
    provider: str,
    input_tokens: int,
    output_tokens: int,
    estimated_cost: float,
) -> bool:
    """
    Emit token usage event to RabbitMQ.
    """
    channel = await get_rabbitmq_connection()
    
    if channel is None:
        logger.warning("RabbitMQ unavailable, token event dropped")
        return False
    
    event = {
        "org_id": org_id,
        "user_id": user_id,
        "model": model,
        "provider": provider,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "total_tokens": input_tokens + output_tokens,
        "estimated_cost": estimated_cost,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    
    try:
        await channel.default_exchange.publish(
            aio_pika.Message(
                body=json.dumps(event).encode(),
                delivery_mode=aio_pika.DeliveryMode.PERSISTENT
            ),
            routing_key=settings.rabbitmq_token_queue
        )
        logger.debug(f"Token event emitted: {event}")
        return True
    except Exception as e:
        logger.error(f"Failed to emit token event: {e}")
        return False


async def close_rabbitmq_connection():
    """Close RabbitMQ connection."""
    global _connection, _channel
    
    if _channel and not _channel.is_closed:
        await _channel.close()
    
    if _connection and not _connection.is_closed:
        await _connection.close()
        
    logger.info("✅ RabbitMQ Connection Closed")

