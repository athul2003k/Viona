"""
Analytics Domain Agent

Business analyst, planner, and strategist. Handles analytics queries,
business planning, forecasting, and strategic advice using LLM-based tool
selection and token-by-token streaming.
"""

import logging
import json
from typing import Optional
from datetime import datetime

from langchain_core.messages import HumanMessage, SystemMessage

from app.agents.base import BaseAgent
from app.agents.base.context import AgentState
from app.agents.base.output import AgentOutput, AnalyticsSection, ChartBlock, TableData
from app.agents.prompts import ANALYTICS_AGENT_PROMPT, TOOL_SELECTION_PROMPT
from app.memory import RedisMemoryStore

logger = logging.getLogger(__name__)


class AnalyticsAgent(BaseAgent):
    """Analytics, strategy, and business planning specialist agent."""
    
    name = "analytics_agent"
    description = "Handles business analytics, strategy, and planning questions"
    system_prompt = ANALYTICS_AGENT_PROMPT
    
    async def execute(self, state: AgentState) -> AgentState:
        """Execute analytics agent with LLM-based tool selection and streaming."""
        context = state["context"]
        user_input = state["input"]
        stream_callback = getattr(context, 'stream_callback', None)
        
        # Initialize memory
        memory = RedisMemoryStore(
            org_id=context.auth.org_id,
            user_id=context.auth.user_id,
            session_id=context.session_id
        )
        
        # Get conversation history
        memory_messages = await memory.get_context_messages(max_messages=10)
        
        # Load all available tools
        from app.tools.analytics import get_analytics_tools
        from app.tools.forecasting import get_forecasting_tools
        from app.tools.alerts import get_alerts_tools
        
        all_tools = (
            get_analytics_tools(context.auth) +
            get_forecasting_tools(context.auth) +
            get_alerts_tools(context.auth)
        )
        
        # === LLM-BASED TOOL SELECTION ===
        tools_to_run = await self._select_tools(state, all_tools, user_input)
        
        # Execute selected tools
        tool_results = await self.execute_tools(state, all_tools, tools_to_run)
        
        # Check for empty data
        if self.is_empty_data(tool_results):
            output = self.create_empty_data_response()
            state["output"] = output.model_dump()
            await memory.add_message("user", user_input)
            await memory.add_message("assistant", output.summary)
            return state
        
        # Build LLM prompt with tool results
        tool_context = "\n\n".join([
            f"**{name}**:\n{json.dumps(data, default=str, indent=2)}"
            for name, data in tool_results.items()
        ])
        
        # Detect query type for tailored prompting
        is_advice_query = any(word in user_input.lower() for word in [
            'advice', 'recommend', 'suggest', 'should', 'improve',
            'grow', 'strategy', 'plan', 'goal', 'focus', 'priority',
            'how to', 'what to do', 'help me', 'next step',
        ])
        
        if is_advice_query:
            analysis_prompt = (
                f"Based on this business data, give strategic advice and actionable "
                f"recommendations. Focus 80% on what they should DO, 20% on supporting data.\n\n"
                f"Business Data:\n{tool_context}\n\n"
                f"User Question: {user_input}"
            )
        else:
            analysis_prompt = (
                f"Analyze this data and provide insights. Lead with the most important "
                f"finding, be conversational, and suggest one next step.\n\n"
                f"Business Data:\n{tool_context}\n\n"
                f"User Question: {user_input}"
            )
        
        messages = self.format_messages(state, memory_messages)
        messages.append(HumanMessage(content=analysis_prompt))
        
        # === STREAMING OR STANDARD RESPONSE ===
        if stream_callback:
            response_text, usage = await self.stream_llm(state, messages, stream_callback)
        else:
            response_obj, usage = await self.invoke_llm(state, messages)
            response_text = response_obj.content if hasattr(response_obj, 'content') else str(response_obj)
        
        # Parse and structure output
        output = self._parse_response(response_text, tool_results)
        state["output"] = output.model_dump()
        
        # Update memory
        await memory.add_message("user", user_input)
        await memory.add_message("assistant", output.summary)
        
        return state
    
    async def _select_tools(self, state: AgentState, tools: list, user_input: str) -> list[str]:
        """Use LLM to intelligently select which tools to run."""
        tool_descriptions = "\n".join([
            f"- {tool.name}: {tool.description}" for tool in tools
        ])
        
        prompt = TOOL_SELECTION_PROMPT.format(
            tool_descriptions=tool_descriptions,
            user_question=user_input
        )
        
        try:
            from app.llms import get_model_for_task
            model, _ = get_model_for_task("tool_selection")
            
            response = await model.ainvoke([
                SystemMessage(content="You are a tool selection assistant. Return only a JSON array of tool names."),
                HumanMessage(content=prompt)
            ])
            
            text = response.content if hasattr(response, 'content') else str(response)
            # Extract JSON array from response
            text = text.strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
            
            selected = json.loads(text)
            if isinstance(selected, list) and len(selected) > 0:
                logger.info(f"LLM selected tools: {selected}")
                return selected[:4]  # Max 4 tools
        except Exception as e:
            logger.warning(f"LLM tool selection failed, using defaults: {e}")
        
        # Fallback: default tools if LLM selection fails
        return ["get_order_summary", "get_inventory_summary"]
    
    def _parse_response(self, response_text: str, tool_results: dict) -> AgentOutput:
        """Parse LLM response into structured output with charts/tables."""
        # Build key metrics from tool results
        key_metrics = []
        
        order_summary = tool_results.get("get_order_summary", {})
        if order_summary:
            if "total_orders" in order_summary:
                key_metrics.append({"name": "Total Orders", "value": order_summary["total_orders"]})
            if "total_revenue" in order_summary:
                key_metrics.append({"name": "Revenue", "value": f"${order_summary['total_revenue']:,.2f}"})
            if "unique_customers" in order_summary:
                key_metrics.append({"name": "Customers", "value": order_summary["unique_customers"]})
        
        inv_summary = tool_results.get("get_inventory_summary", {})
        if inv_summary:
            if "total_products" in inv_summary:
                key_metrics.append({"name": "Products", "value": inv_summary["total_products"]})
            if "total_units" in inv_summary:
                key_metrics.append({"name": "Total Units", "value": inv_summary["total_units"]})
        
        # If no metrics extracted, return simple text response
        if not key_metrics:
            return AgentOutput.text_response(summary=response_text, confidence=0.85)
        
        # Build AnalyticsSection
        analytics = AnalyticsSection(
            overview=response_text,
            key_metrics=key_metrics,
        )
        
        # Add revenue chart if time-series data available
        revenue_data = tool_results.get("get_revenue_by_period", {})
        if revenue_data and isinstance(revenue_data.get("data"), list):
            data_points = revenue_data["data"]
            if len(data_points) >= 3:
                period_type = revenue_data.get('period_type', 'day')
                analytics.charts.append(ChartBlock(
                    chart_type="line",
                    title=f"Revenue Trend ({period_type.capitalize()}ly)",
                    x=[_format_period_label(d.get("period", ""), period_type) for d in data_points],
                    y=[float(d.get("revenue", 0)) for d in data_points],
                    x_label="Period",
                    y_label="Revenue ($)",
                ))
        
        # Add AOV chart if available
        aov_data = tool_results.get("get_aov_trend", {})
        if aov_data and isinstance(aov_data.get("data"), list):
            data_points = aov_data["data"]
            if len(data_points) >= 3:
                period_type = aov_data.get('period_type', 'week')
                analytics.charts.append(ChartBlock(
                    chart_type="line",
                    title="Average Order Value Trend",
                    x=[_format_period_label(d.get("period", ""), period_type) for d in data_points],
                    y=[float(d.get("aov", 0)) for d in data_points],
                    x_label="Period",
                    y_label="AOV ($)",
                ))
        
        # Add bar chart for top products by revenue
        rev_by_product = tool_results.get("get_revenue_by_product", {})
        if rev_by_product and isinstance(rev_by_product.get("products"), list):
            prods = [p for p in rev_by_product["products"] if p.get("revenue", 0) > 0][:8]
            if len(prods) >= 2:
                analytics.charts.append(ChartBlock(
                    chart_type="bar",
                    title="Revenue by Product",
                    x=[p["name"] for p in prods],
                    y=[float(p["revenue"]) for p in prods],
                    y_label="Revenue ($)",
                ))

        # Add table for top products if available
        perf_data = tool_results.get("get_product_performance", {})
        if perf_data and isinstance(perf_data.get("products"), list):
            products = perf_data["products"]
            if len(products) > 0:
                analytics.detailed_breakdown = TableData(
                    title="Top Performing Products",
                    columns=["Product", "Units Sold", "Revenue"],
                    rows=[
                        [p["name"], str(p["total_quantity"]), f"${p['total_revenue']:,.2f}"]
                        for p in products[:8]
                    ]
                )
        
        # Add observations from alerts if available
        alerts_data = tool_results.get("low_stock_alerts", {})
        if alerts_data and isinstance(alerts_data.get("alerts"), list):
            for alert in alerts_data["alerts"][:3]:
                analytics.observations.append(
                    f"⚠️ {alert.get('product_name', 'Product')}: {alert.get('message', 'Low stock')}"
                )
        
        return AgentOutput.analytics_response(analytics=analytics, confidence=0.85)


def _format_period_label(period_str: str, period_type: str) -> str:
    """Convert ISO timestamp to a short, readable chart label."""
    if not period_str:
        return ""
    try:
        # Parse ISO format — truncate to date part if needed
        dt = datetime.fromisoformat(str(period_str)[:19].replace("Z", ""))
        if period_type == "day":
            return dt.strftime("%b %-d")      # e.g. "Jan 1"
        elif period_type == "week":
            return dt.strftime("%-d %b")     # e.g. "1 Jan"
        elif period_type == "month":
            return dt.strftime("%b %Y")       # e.g. "Jan 2024"
        else:
            return dt.strftime("%b %-d")      # fallback
    except Exception:
        return str(period_str)[:10]           # fallback to raw string
