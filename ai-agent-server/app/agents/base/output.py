"""
Structured Agent Outputs

All agent responses must conform to these schemas.
Frontend renders based on the `type` field.
"""

from typing import Literal, Any, Optional
from pydantic import BaseModel, Field


class ChartData(BaseModel):
    """Data for rendering charts."""
    chart_type: Literal["bar", "line", "pie", "area", "scatter"]
    title: str
    x_axis: Optional[str] = None
    y_axis: Optional[str] = None
    data: list[dict[str, Any]]
    colors: Optional[list[str]] = None


class TableData(BaseModel):
    """Data for rendering tables."""
    columns: list[str]
    rows: list[list[Any]]
    title: Optional[str] = None


class ActionData(BaseModel):
    """Data for triggering actions (gated, requires confirmation)."""
    action_type: str
    target: str
    parameters: dict[str, Any]
    requires_confirmation: bool = True
    warning: Optional[str] = None


class ChartBlock(BaseModel):
    """Chart-ready data block for frontend rendering."""
    chart_type: Literal["line", "bar", "pie", "area"]
    title: str
    x: list[str]  # Labels/categories
    y: list[float]  # Values
    x_label: Optional[str] = None
    y_label: Optional[str] = None


class AnalyticsSection(BaseModel):
    """Structured analytics response section."""
    overview: str  # 📌 Brief business summary
    key_metrics: list[dict[str, Any]]  # 📊 KPIs as list of {name, value, change?}
    detailed_breakdown: Optional[TableData] = None  # 📋 Drill-down table
    charts: list[ChartBlock] = []  # 📈 Visual insights
    observations: list[str] = []  # 🧠 Insights & risks
    follow_ups: list[str] = []  # 👉 What to ask next


class AgentOutput(BaseModel):
    """
    Standard structured output from all agents.
    
    The frontend renders different components based on `type`:
    - text: Simple markdown text response
    - chart: Renders a chart using ChartData
    - table: Renders a data table using TableData
    - action: Shows action confirmation dialog
    """
    type: Literal["text", "chart", "table", "action"]
    payload: dict[str, Any] = Field(default_factory=dict)
    summary: str = Field(description="Human-readable explanation")
    confidence: float = Field(ge=0.0, le=1.0, description="Confidence score 0-1")
    
    # Optional metadata
    sources: Optional[list[str]] = None
    suggestions: Optional[list[str]] = None
    
    @classmethod
    def text_response(cls, summary: str, confidence: float = 0.9) -> "AgentOutput":
        """Create a simple text response."""
        return cls(
            type="text",
            payload={"content": summary},
            summary=summary,
            confidence=confidence
        )
    
    @classmethod
    def chart_response(
        cls, 
        chart: ChartData, 
        summary: str, 
        confidence: float = 0.85
    ) -> "AgentOutput":
        """Create a chart response."""
        return cls(
            type="chart",
            payload=chart.model_dump(),
            summary=summary,
            confidence=confidence
        )
    
    @classmethod
    def table_response(
        cls,
        table: TableData,
        summary: str,
        confidence: float = 0.9
    ) -> "AgentOutput":
        """Create a table response."""
        return cls(
            type="table",
            payload=table.model_dump(),
            summary=summary,
            confidence=confidence
        )
    
    @classmethod
    def action_response(
        cls,
        action: ActionData,
        summary: str,
        confidence: float = 0.8
    ) -> "AgentOutput":
        """Create an action response."""
        return cls(
            type="action",
            payload=action.model_dump(),
            summary=summary,
            confidence=confidence
        )
    
    @classmethod
    def error_response(cls, error: str) -> "AgentOutput":
        """Create an error response."""
        return cls(
            type="text",
            payload={"error": True, "content": error},
            summary=error,
            confidence=0.0
        )
    
    @classmethod
    def analytics_response(
        cls,
        analytics: "AnalyticsSection",
        confidence: float = 0.9
    ) -> "AgentOutput":
        """Create a structured analytics response with all sections."""
        # Build markdown summary with chart blocks
        sections = []
        
        # 📌 Overview
        sections.append(f"📌 **Overview**\n\n{analytics.overview}")
        
        # 📊 Key Metrics
        if analytics.key_metrics:
            metrics_md = "📊 **Key Metrics**\n\n"
            for m in analytics.key_metrics:
                value = m.get("value", "N/A")
                name = m.get("name", "Metric")
                change = m.get("change")
                if change:
                    metrics_md += f"- **{name}**: {value} ({change})\n"
                else:
                    metrics_md += f"- **{name}**: {value}\n"
            sections.append(metrics_md)
        
        # 📋 Detailed Breakdown
        if analytics.detailed_breakdown:
            table = analytics.detailed_breakdown
            table_md = f"📋 **{table.title or 'Detailed Breakdown'}**\n\n"
            table_md += "| " + " | ".join(table.columns) + " |\n"
            table_md += "| " + " | ".join(["---"] * len(table.columns)) + " |\n"
            for row in table.rows:
                table_md += "| " + " | ".join(str(c) for c in row) + " |\n"
            sections.append(table_md)
        
        # 📈 Visual Insights (chart blocks)
        if analytics.charts:
            charts_md = "📈 **Visual Insights**\n\n"
            for chart in analytics.charts:
                charts_md += f"```chart\ntype: {chart.chart_type}\n"
                charts_md += f"title: {chart.title}\n"
                charts_md += f"x: {chart.x}\n"
                charts_md += f"y: {chart.y}\n```\n\n"
            sections.append(charts_md)
        
        # 🧠 Insights & Observations
        if analytics.observations:
            obs_md = "🧠 **Insights & Observations**\n\n"
            for obs in analytics.observations:
                obs_md += f"- {obs}\n"
            sections.append(obs_md)
        
        # 👉 What You Can Ask Next
        if analytics.follow_ups:
            follow_md = "👉 **What You Can Ask Next**\n\n"
            for f in analytics.follow_ups:
                follow_md += f"- {f}\n"
            sections.append(follow_md)
        
        summary = "\n\n".join(sections)
        
        return cls(
            type="text",
            payload={
                "analytics": analytics.model_dump(),
                "content": summary
            },
            summary=summary,
            confidence=confidence,
            suggestions=analytics.follow_ups
        )

