"""
Test Forecasting Tools

Unit tests for demand forecasting, trend analysis, and seasonality detection.
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from datetime import datetime

# Import the tools (use relative import in actual test)
from app.tools.forecasting import (
    DemandForecastTool,
    TrendAnalysisTool,
    SeasonalityDetectionTool,
    ReorderPointCalculatorTool,
)


class TestDemandForecastTool:
    """Tests for DemandForecastTool."""
    
    @pytest.mark.asyncio
    async def test_demand_forecast_returns_predictions(self, mock_auth, patch_db_pool):
        """Test that demand forecast returns prediction data."""
        mock_pool, mock_conn = patch_db_pool
        
        # Configure mock to return sample product sales
        mock_conn.fetch.return_value = [
            {
                "product_id": 1,
                "name": "iPhone 17 Pro",
                "sku": "IPH17P",
                "week_start": datetime(2025, 12, 30),
                "units_sold": 10,
            },
            {
                "product_id": 1,
                "name": "iPhone 17 Pro",
                "sku": "IPH17P",
                "week_start": datetime(2026, 1, 6),
                "units_sold": 15,
            },
            {
                "product_id": 1,
                "name": "iPhone 17 Pro",
                "sku": "IPH17P",
                "week_start": datetime(2026, 1, 13),
                "units_sold": 12,
            },
        ]
        
        tool = DemandForecastTool(mock_auth)
        result = await tool.run(days_ahead=30)
        
        assert result.success is True
        assert "forecasts" in result.data
        assert len(result.data["forecasts"]) > 0
        
        forecast = result.data["forecasts"][0]
        assert "predicted_units" in forecast
        assert "trend_direction" in forecast
        assert "confidence_range" in forecast
    
    @pytest.mark.asyncio
    async def test_demand_forecast_handles_empty_data(self, mock_auth, patch_db_pool):
        """Test that forecast handles no sales data gracefully."""
        mock_pool, mock_conn = patch_db_pool
        mock_conn.fetch.return_value = []
        
        tool = DemandForecastTool(mock_auth)
        result = await tool.run()
        
        assert result.success is True
        assert result.data["forecasts"] == []
        assert result.data["total_products_analyzed"] == 0


class TestTrendAnalysisTool:
    """Tests for TrendAnalysisTool."""
    
    @pytest.mark.asyncio
    async def test_trend_identifies_uptrend(self, mock_auth, patch_db_pool):
        """Test that tool correctly identifies an upward trend."""
        mock_pool, mock_conn = patch_db_pool
        
        # Revenue increasing over time
        mock_conn.fetch.return_value = [
            {"period_start": datetime(2025, 12, 16), "value": 100},
            {"period_start": datetime(2025, 12, 23), "value": 120},
            {"period_start": datetime(2025, 12, 30), "value": 150},
            {"period_start": datetime(2026, 1, 6), "value": 180},
            {"period_start": datetime(2026, 1, 13), "value": 220},
        ]
        
        tool = TrendAnalysisTool(mock_auth)
        result = await tool.run(metric="revenue", period="week")
        
        assert result.success is True
        assert "uptrend" in result.data["trend_direction"]
        assert result.data["percentage_change"] > 0
    
    @pytest.mark.asyncio
    async def test_trend_identifies_downtrend(self, mock_auth, patch_db_pool):
        """Test that tool correctly identifies a downward trend."""
        mock_pool, mock_conn = patch_db_pool
        
        # Revenue decreasing over time
        mock_conn.fetch.return_value = [
            {"period_start": datetime(2025, 12, 16), "value": 200},
            {"period_start": datetime(2025, 12, 23), "value": 180},
            {"period_start": datetime(2025, 12, 30), "value": 150},
            {"period_start": datetime(2026, 1, 6), "value": 120},
            {"period_start": datetime(2026, 1, 13), "value": 100},
        ]
        
        tool = TrendAnalysisTool(mock_auth)
        result = await tool.run(metric="revenue", period="week")
        
        assert result.success is True
        assert "downtrend" in result.data["trend_direction"]
        assert result.data["percentage_change"] < 0
    
    @pytest.mark.asyncio
    async def test_trend_handles_insufficient_data(self, mock_auth, patch_db_pool):
        """Test that tool handles insufficient data gracefully."""
        mock_pool, mock_conn = patch_db_pool
        mock_conn.fetch.return_value = [
            {"period_start": datetime(2026, 1, 13), "value": 100},
        ]
        
        tool = TrendAnalysisTool(mock_auth)
        result = await tool.run()
        
        assert result.success is True
        assert result.data["trend_direction"] == "insufficient_data"


class TestSeasonalityDetectionTool:
    """Tests for SeasonalityDetectionTool."""
    
    @pytest.mark.asyncio
    async def test_seasonality_detects_patterns(self, mock_auth, patch_db_pool):
        """Test that tool detects day-of-week patterns."""
        mock_pool, mock_conn = patch_db_pool
        
        # Day of week results (0=Sunday, 6=Saturday)
        mock_conn.fetch.side_effect = [
            # DOW query results
            [
                {"day_of_week": 0, "order_count": 5, "revenue": 500},  # Sunday
                {"day_of_week": 1, "order_count": 10, "revenue": 1000},  # Monday
                {"day_of_week": 5, "order_count": 15, "revenue": 1500},  # Friday - best
                {"day_of_week": 6, "order_count": 8, "revenue": 800},  # Saturday
            ],
            # Weekly query results
            [],
        ]
        
        tool = SeasonalityDetectionTool(mock_auth)
        result = await tool.run(days=90)
        
        assert result.success is True
        assert "daily_patterns" in result.data
        assert result.data["best_day"]["day"] == "Friday"


class TestReorderPointCalculatorTool:
    """Tests for ReorderPointCalculatorTool."""
    
    @pytest.mark.asyncio
    async def test_reorder_point_calculation(self, mock_auth, patch_db_pool):
        """Test that reorder points are calculated correctly."""
        mock_pool, mock_conn = patch_db_pool
        
        mock_conn.fetch.return_value = [
            {
                "product_id": 1,
                "name": "iPhone 17 Pro",
                "sku": "IPH17P",
                "avg_daily_units": 5.0,
                "current_stock": 10,  # Low - less than reorder point
            },
            {
                "product_id": 2,
                "name": "Samsung Galaxy",
                "sku": "SGS26",
                "avg_daily_units": 2.0,
                "current_stock": 100,  # Healthy
            },
        ]
        
        tool = ReorderPointCalculatorTool(mock_auth)
        result = await tool.run(lead_time_days=7, safety_stock_days=3)
        
        assert result.success is True
        assert "products" in result.data
        assert "urgency_summary" in result.data
        
        # iPhone should be critical (stock below reorder point)
        iphone = next(p for p in result.data["products"] if "iPhone" in p["name"])
        assert iphone["urgency"] in ["critical", "reorder_now"]
    
    @pytest.mark.asyncio
    async def test_reorder_respects_rbac(self, mock_auth_user, patch_db_pool):
        """Test that tool works for any authenticated user (read-only)."""
        mock_pool, mock_conn = patch_db_pool
        mock_conn.fetch.return_value = []
        
        # Regular user should still be able to use read-only tool
        tool = ReorderPointCalculatorTool(mock_auth_user)
        result = await tool.run()
        
        assert result.success is True
