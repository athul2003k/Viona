"""
Pytest Configuration and Fixtures

Provides common test fixtures for AI agent tools testing.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone
from dataclasses import dataclass


@dataclass
class MockAuthContext:
    """Mock authentication context for testing."""
    org_id: str = "1"
    user_id: str = "test-user-123"
    role: str = "admin"
    email: str = "test@example.com"


@pytest.fixture
def mock_auth():
    """Provide a mock AuthContext for testing."""
    return MockAuthContext()


@pytest.fixture
def mock_auth_manager():
    """Provide a mock AuthContext with manager role."""
    return MockAuthContext(role="manager")


@pytest.fixture
def mock_auth_user():
    """Provide a mock AuthContext with regular user role."""
    return MockAuthContext(role="user")


@pytest.fixture
def mock_db_pool():
    """
    Mock database pool that returns configurable test data.
    Usage: configure the returned data via fixture parameter.
    """
    mock_pool = AsyncMock()
    mock_conn = AsyncMock()
    
    # Default empty results
    mock_conn.fetch = AsyncMock(return_value=[])
    mock_conn.fetchrow = AsyncMock(return_value=None)
    mock_conn.execute = AsyncMock(return_value=None)
    
    # Context manager for connection
    mock_pool.acquire.return_value.__aenter__ = AsyncMock(return_value=mock_conn)
    mock_pool.acquire.return_value.__aexit__ = AsyncMock(return_value=None)
    
    # Transaction context manager
    mock_conn.transaction.return_value.__aenter__ = AsyncMock(return_value=None)
    mock_conn.transaction.return_value.__aexit__ = AsyncMock(return_value=None)
    
    return mock_pool, mock_conn


@pytest.fixture
def sample_order_data():
    """Sample order data for testing."""
    return [
        {
            "order_id": 1,
            "customer_name": "John Doe",
            "customer_email": "john@example.com",
            "status": "completed",
            "total_amount": 150.00,
            "order_date": datetime(2026, 1, 15, 10, 0, 0, tzinfo=timezone.utc),
        },
        {
            "order_id": 2,
            "customer_name": "Jane Smith",
            "customer_email": "jane@example.com",
            "status": "pending",
            "total_amount": 75.50,
            "order_date": datetime(2026, 1, 18, 14, 30, 0, tzinfo=timezone.utc),
        },
    ]


@pytest.fixture
def sample_product_data():
    """Sample product data for testing."""
    return [
        {
            "product_id": 1,
            "name": "iPhone 17 Pro",
            "sku": "IPH17P",
            "quantity": 25,
            "daily_sales": 2.5,
        },
        {
            "product_id": 2,
            "name": "Samsung Galaxy S26",
            "sku": "SGS26",
            "quantity": 50,
            "daily_sales": 1.8,
        },
        {
            "product_id": 3,
            "name": "Pixel 10",
            "sku": "PX10",
            "quantity": 3,  # Low stock
            "daily_sales": 0.5,
        },
    ]


@pytest.fixture
def sample_weekly_sales():
    """Sample weekly sales data for forecasting tests."""
    return [
        {"week_start": datetime(2025, 12, 23), "units_sold": 10},
        {"week_start": datetime(2025, 12, 30), "units_sold": 15},
        {"week_start": datetime(2026, 1, 6), "units_sold": 12},
        {"week_start": datetime(2026, 1, 13), "units_sold": 18},
    ]


@pytest.fixture
def sample_daily_revenue():
    """Sample daily revenue data for anomaly detection tests."""
    return [
        {"day": datetime(2026, 1, 10), "order_count": 5, "revenue": 500.0},
        {"day": datetime(2026, 1, 11), "order_count": 4, "revenue": 450.0},
        {"day": datetime(2026, 1, 12), "order_count": 6, "revenue": 600.0},
        {"day": datetime(2026, 1, 13), "order_count": 5, "revenue": 520.0},
        {"day": datetime(2026, 1, 14), "order_count": 15, "revenue": 1500.0},  # Spike
        {"day": datetime(2026, 1, 15), "order_count": 4, "revenue": 480.0},
        {"day": datetime(2026, 1, 16), "order_count": 1, "revenue": 100.0},  # Drop
    ]


@pytest.fixture
def patch_db_pool(mock_db_pool):
    """Patch the database pool for all tool tests."""
    mock_pool, mock_conn = mock_db_pool
    with patch('app.tools.base.get_db_pool', return_value=mock_pool):
        yield mock_pool, mock_conn
