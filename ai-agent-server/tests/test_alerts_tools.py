"""
Test Alerts Tools

Unit tests for low stock alerts, anomaly detection, and inventory health.
"""

import pytest
from unittest.mock import AsyncMock, patch
from datetime import datetime, timezone

from app.tools.alerts import (
    LowStockAlertsTool,
    SalesAnomalyDetectionTool,
    RevenueGoalTrackingTool,
    InventoryHealthReportTool,
)


class TestLowStockAlertsTool:
    """Tests for LowStockAlertsTool."""
    
    @pytest.mark.asyncio
    async def test_low_stock_returns_critical_items(self, mock_auth, patch_db_pool):
        """Test that tool returns critical and warning items."""
        mock_pool, mock_conn = patch_db_pool
        
        mock_conn.fetch.return_value = [
            {
                "product_id": 1,
                "name": "iPhone 17 Pro",
                "sku": "IPH17P",
                "warehouse_name": "Main",
                "quantity": 3,  # Critical (<= 5)
                "daily_sales": 1.5,
            },
            {
                "product_id": 2,
                "name": "Samsung Galaxy",
                "sku": "SGS26",
                "warehouse_name": "Main",
                "quantity": 10,  # Warning (<= 15)
                "daily_sales": 0.8,
            },
        ]
        
        tool = LowStockAlertsTool(mock_auth)
        result = await tool.run(critical_threshold=5, warning_threshold=15)
        
        assert result.success is True
        assert result.data["critical_count"] == 1
        assert result.data["warning_count"] == 1
        assert result.data["critical_alerts"][0]["name"] == "iPhone 17 Pro"
    
    @pytest.mark.asyncio
    async def test_low_stock_calculates_stockout_days(self, mock_auth, patch_db_pool):
        """Test that days until stockout is calculated."""
        mock_pool, mock_conn = patch_db_pool
        
        mock_conn.fetch.return_value = [
            {
                "product_id": 1,
                "name": "Test Product",
                "sku": "TP01",
                "warehouse_name": "Main",
                "quantity": 10,
                "daily_sales": 2.0,  # 5 days until stockout
            },
        ]
        
        tool = LowStockAlertsTool(mock_auth)
        result = await tool.run()
        
        assert result.success is True
        alert = result.data["warning_alerts"][0]
        assert alert["days_until_stockout"] == 5.0


class TestSalesAnomalyDetectionTool:
    """Tests for SalesAnomalyDetectionTool."""
    
    @pytest.mark.asyncio
    async def test_anomaly_detects_spike(self, mock_auth, patch_db_pool, sample_daily_revenue):
        """Test that tool detects revenue spikes."""
        mock_pool, mock_conn = patch_db_pool
        mock_conn.fetch.return_value = sample_daily_revenue
        
        tool = SalesAnomalyDetectionTool(mock_auth)
        result = await tool.run(sensitivity="medium", days=7)
        
        assert result.success is True
        assert result.data["anomaly_count"] > 0
        
        # Should detect the spike on Jan 14
        spike = next((a for a in result.data["anomalies"] if a["type"] == "spike"), None)
        assert spike is not None
        assert spike["deviation_percentage"] > 100  # Significant spike
    
    @pytest.mark.asyncio
    async def test_anomaly_handles_insufficient_data(self, mock_auth, patch_db_pool):
        """Test that tool handles insufficient data."""
        mock_pool, mock_conn = patch_db_pool
        mock_conn.fetch.return_value = [
            {"day": datetime(2026, 1, 10), "order_count": 5, "revenue": 500.0},
        ]
        
        tool = SalesAnomalyDetectionTool(mock_auth)
        result = await tool.run()
        
        assert result.success is True
        assert "Insufficient data" in result.data.get("message", "")


class TestRevenueGoalTrackingTool:
    """Tests for RevenueGoalTrackingTool."""
    
    @pytest.mark.asyncio
    async def test_goal_tracking_with_target(self, mock_auth, patch_db_pool):
        """Test tracking against explicit target."""
        mock_pool, mock_conn = patch_db_pool
        
        # Current period: $800, Previous: $500
        mock_conn.fetchrow.side_effect = [
            {"revenue": 800.0, "order_count": 10},
            {"revenue": 500.0, "order_count": 8},
        ]
        
        tool = RevenueGoalTrackingTool(mock_auth)
        result = await tool.run(period="week", target=1000.0)
        
        assert result.success is True
        assert result.data["current_revenue"] == 800.0
        assert result.data["progress_percentage"] == 80.0
        assert result.data["remaining_to_goal"] == 200.0
    
    @pytest.mark.asyncio
    async def test_goal_tracking_period_comparison(self, mock_auth, patch_db_pool):
        """Test tracking against previous period."""
        mock_pool, mock_conn = patch_db_pool
        
        # Current period: $800, Previous: $500 (60% increase)
        mock_conn.fetchrow.side_effect = [
            {"revenue": 800.0, "order_count": 10},
            {"revenue": 500.0, "order_count": 8},
        ]
        
        tool = RevenueGoalTrackingTool(mock_auth)
        result = await tool.run(period="week")
        
        assert result.success is True
        assert result.data["period_over_period_change"] == 60.0
        assert result.data["status"] == "exceeding"


class TestInventoryHealthReportTool:
    """Tests for InventoryHealthReportTool."""
    
    @pytest.mark.asyncio
    async def test_health_report_categorizes_products(self, mock_auth, patch_db_pool):
        """Test that products are categorized correctly."""
        mock_pool, mock_conn = patch_db_pool
        
        mock_conn.fetch.return_value = [
            # Critical low stock
            {"product_id": 1, "name": "Product A", "sku": "PA", "total_stock": 3, "units_sold_90d": 30},
            # Healthy
            {"product_id": 2, "name": "Product B", "sku": "PB", "total_stock": 50, "units_sold_90d": 45},
            # Dead stock (no sales)
            {"product_id": 3, "name": "Product C", "sku": "PC", "total_stock": 100, "units_sold_90d": 0},
        ]
        
        tool = InventoryHealthReportTool(mock_auth)
        result = await tool.run()
        
        assert result.success is True
        assert result.data["total_products"] == 3
        assert result.data["category_counts"]["critical_low"] == 1
        assert result.data["category_counts"]["dead_stock"] == 1
    
    @pytest.mark.asyncio
    async def test_health_score_calculation(self, mock_auth, patch_db_pool):
        """Test that health score is calculated."""
        mock_pool, mock_conn = patch_db_pool
        
        # All healthy products
        mock_conn.fetch.return_value = [
            {"product_id": 1, "name": "Product A", "sku": "PA", "total_stock": 50, "units_sold_90d": 30},
            {"product_id": 2, "name": "Product B", "sku": "PB", "total_stock": 40, "units_sold_90d": 25},
        ]
        
        tool = InventoryHealthReportTool(mock_auth)
        result = await tool.run()
        
        assert result.success is True
        assert result.data["health_score"] >= 80
        assert result.data["health_grade"] in ["A", "B"]
