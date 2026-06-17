"""
Test Action Tools

Unit tests for action tools with confirmation workflows and RBAC.
"""

import pytest
from unittest.mock import AsyncMock, patch
from datetime import datetime, timezone

from app.tools.actions import (
    CreateReorderRequestTool,
    UpdateOrderStatusTool,
    GenerateReportTool,
)
from app.tools.base import ActionStatus


class TestCreateReorderRequestTool:
    """Tests for CreateReorderRequestTool."""
    
    @pytest.mark.asyncio
    async def test_reorder_requires_admin_or_manager(self, mock_auth_user, patch_db_pool):
        """Test that regular users cannot create reorder requests."""
        mock_pool, mock_conn = patch_db_pool
        
        tool = CreateReorderRequestTool(mock_auth_user)
        result = await tool.run_action(
            product_id=1,
            warehouse_id=1,
            quantity=100
        )
        
        assert result.status == ActionStatus.CANCELLED
        assert "Permission denied" in result.error
    
    @pytest.mark.asyncio
    async def test_reorder_preview_returns_confirmation(self, mock_auth, patch_db_pool):
        """Test that preview returns pending confirmation status."""
        mock_pool, mock_conn = patch_db_pool
        
        # Mock product and warehouse lookup
        mock_conn.fetchrow.side_effect = [
            {"product_id": 1, "name": "iPhone 17 Pro", "sku": "IPH17P"},
            {"warehouse_id": 1, "name": "Main Warehouse"},
            {"qty": 5},  # Current stock
        ]
        
        tool = CreateReorderRequestTool(mock_auth)
        result = await tool.run_action(
            confirmed=False,
            product_id=1,
            warehouse_id=1,
            quantity=100
        )
        
        assert result.status == ActionStatus.PENDING_CONFIRMATION
        assert result.success is True
        assert "iPhone 17 Pro" in result.confirmation_message
        assert result.preview_data["quantity_to_order"] == 100
    
    @pytest.mark.asyncio
    async def test_reorder_validates_product_exists(self, mock_auth, patch_db_pool):
        """Test that invalid product IDs are rejected."""
        mock_pool, mock_conn = patch_db_pool
        mock_conn.fetchrow.return_value = None  # Product not found
        
        tool = CreateReorderRequestTool(mock_auth)
        result = await tool.run_action(
            product_id=999,
            warehouse_id=1,
            quantity=100
        )
        
        assert result.status == ActionStatus.CANCELLED
        assert "not found" in result.error
    
    @pytest.mark.asyncio
    async def test_reorder_missing_fields(self, mock_auth, patch_db_pool):
        """Test that missing required fields return MISSING_DATA status."""
        mock_pool, mock_conn = patch_db_pool
        
        tool = CreateReorderRequestTool(mock_auth)
        result = await tool.run_action(product_id=1)  # Missing warehouse_id and quantity
        
        assert result.status == ActionStatus.MISSING_DATA
        assert "warehouse_id" in result.missing_fields
        assert "quantity" in result.missing_fields


class TestUpdateOrderStatusTool:
    """Tests for UpdateOrderStatusTool."""
    
    @pytest.mark.asyncio
    async def test_status_update_preview(self, mock_auth, patch_db_pool):
        """Test that status update shows preview."""
        mock_pool, mock_conn = patch_db_pool
        
        mock_conn.fetchrow.return_value = {
            "order_id": 1,
            "customer_name": "John Doe",
            "customer_email": "john@example.com",
            "status": "pending",
            "total_amount": 150.00,
            "order_date": datetime(2026, 1, 15, tzinfo=timezone.utc),
        }
        
        tool = UpdateOrderStatusTool(mock_auth)
        result = await tool.run_action(
            confirmed=False,
            order_id=1,
            new_status="shipped"
        )
        
        assert result.status == ActionStatus.PENDING_CONFIRMATION
        assert "pending" in result.confirmation_message
        assert "shipped" in result.confirmation_message
    
    @pytest.mark.asyncio
    async def test_status_update_validates_status(self, mock_auth, patch_db_pool):
        """Test that invalid statuses are rejected."""
        mock_pool, mock_conn = patch_db_pool
        
        tool = UpdateOrderStatusTool(mock_auth)
        result = await tool.run_action(
            order_id=1,
            new_status="invalid_status"
        )
        
        assert result.status == ActionStatus.CANCELLED
        assert "Invalid status" in result.error
    
    @pytest.mark.asyncio
    async def test_status_update_prevents_same_status(self, mock_auth, patch_db_pool):
        """Test that updating to same status is rejected."""
        mock_pool, mock_conn = patch_db_pool
        
        mock_conn.fetchrow.return_value = {
            "order_id": 1,
            "customer_name": "John Doe",
            "customer_email": "john@example.com",
            "status": "shipped",  # Already shipped
            "total_amount": 150.00,
            "order_date": datetime(2026, 1, 15, tzinfo=timezone.utc),
        }
        
        tool = UpdateOrderStatusTool(mock_auth)
        result = await tool.run_action(
            order_id=1,
            new_status="shipped"  # Same as current
        )
        
        assert result.status == ActionStatus.CANCELLED
        assert "already" in result.error.lower()


class TestGenerateReportTool:
    """Tests for GenerateReportTool."""
    
    @pytest.mark.asyncio
    async def test_report_preview(self, mock_auth, patch_db_pool):
        """Test that report generation shows preview."""
        mock_pool, mock_conn = patch_db_pool
        mock_conn.fetchrow.return_value = {"cnt": 25}
        
        tool = GenerateReportTool(mock_auth)
        result = await tool.run_action(
            confirmed=False,
            report_type="sales",
            period="week"
        )
        
        assert result.status == ActionStatus.PENDING_CONFIRMATION
        assert "Sales Report" in result.confirmation_message
        assert result.preview_data["estimated_rows"] == 25
    
    @pytest.mark.asyncio
    async def test_report_validates_type(self, mock_auth, patch_db_pool):
        """Test that invalid report types are rejected."""
        mock_pool, mock_conn = patch_db_pool
        
        tool = GenerateReportTool(mock_auth)
        result = await tool.run_action(
            report_type="invalid_type",
            period="week"
        )
        
        assert result.status == ActionStatus.CANCELLED
        assert "Invalid report type" in result.error
    
    @pytest.mark.asyncio
    async def test_report_generates_csv(self, mock_auth, patch_db_pool):
        """Test that CSV format generates csv_content."""
        mock_pool, mock_conn = patch_db_pool
        
        mock_conn.fetchrow.return_value = {"cnt": 2}
        mock_conn.fetch.return_value = [
            {
                "date": datetime(2026, 1, 15),
                "orders": 5,
                "revenue": 500.0,
                "customers": 4,
            },
            {
                "date": datetime(2026, 1, 16),
                "orders": 6,
                "revenue": 600.0,
                "customers": 5,
            },
        ]
        
        tool = GenerateReportTool(mock_auth)
        result = await tool.run_action(
            confirmed=True,
            report_type="sales",
            period="week",
            format="csv"
        )
        
        assert result.status == ActionStatus.EXECUTED
        assert "csv_content" in result.data
        assert "date,orders,revenue,customers" in result.data["csv_content"]
    
    @pytest.mark.asyncio
    async def test_report_manager_can_generate(self, mock_auth_manager, patch_db_pool):
        """Test that managers can generate reports."""
        mock_pool, mock_conn = patch_db_pool
        mock_conn.fetchrow.return_value = {"cnt": 0}
        
        tool = GenerateReportTool(mock_auth_manager)
        result = await tool.run_action(
            confirmed=False,
            report_type="inventory",
            period="month"
        )
        
        # Manager should have permission (in required_roles)
        assert result.status == ActionStatus.PENDING_CONFIRMATION
