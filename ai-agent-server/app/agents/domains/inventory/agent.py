"""
Inventory Domain Agent

Handles inventory, warehouse management, and supply chain queries.
Uses LLM-based tool selection and token-by-token streaming.
"""

import logging
import json
from typing import Optional

from langchain_core.messages import HumanMessage, SystemMessage

from app.agents.base import BaseAgent
from app.agents.base.context import AgentState
from app.agents.base.output import AgentOutput, AnalyticsSection, TableData
from app.agents.prompts import INVENTORY_AGENT_PROMPT, TOOL_SELECTION_PROMPT
from app.memory import RedisMemoryStore

logger = logging.getLogger(__name__)


class InventoryAgent(BaseAgent):
    """Inventory, warehouse, and supply chain specialist agent."""
    
    name = "inventory_agent"
    description = "Handles inventory and warehouse questions"
    system_prompt = INVENTORY_AGENT_PROMPT
    
    async def execute(self, state: AgentState) -> AgentState:
        """Execute inventory agent with LLM-based tool selection and streaming."""
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
        from app.tools.inventory import get_inventory_tools
        from app.tools.alerts import get_alerts_tools
        from app.tools.forecasting import get_forecasting_tools
        
        all_tools = (
            get_inventory_tools(context.auth) +
            get_alerts_tools(context.auth) +
            get_forecasting_tools(context.auth)
        )
        
        # === LLM-BASED TOOL SELECTION ===
        tools_to_run = await self._select_tools(state, all_tools, user_input)
        
        # Build extra kwargs for specific tools
        extra_kwargs = {}
        user_lower = user_input.lower()
        if "get_product_stock" in tools_to_run and "low" in user_lower:
            extra_kwargs["get_product_stock"] = {"low_stock_only": True}
        
        # Execute selected tools
        tool_results = await self.execute_tools(state, all_tools, tools_to_run, **extra_kwargs)
        
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
        
        analysis_prompt = (
            f"Analyze this inventory data and provide insights. Focus on issues that "
            f"need attention (low stock, overstock, reorder needs). Suggest concrete actions.\n\n"
            f"Inventory Data:\n{tool_context}\n\n"
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
            text = text.strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
            
            selected = json.loads(text)
            if isinstance(selected, list) and len(selected) > 0:
                logger.info(f"LLM selected tools: {selected}")
                return selected[:4]
        except Exception as e:
            logger.warning(f"LLM tool selection failed, using defaults: {e}")
        
        # Fallback defaults
        return ["get_product_stock", "get_warehouse_list"]
    
    def _parse_response(self, response_text: str, tool_results: dict) -> AgentOutput:
        """Parse LLM response into structured output with tables."""
        # Build key metrics from tool results
        key_metrics = []
        
        stock_data = tool_results.get("get_product_stock", {})
        if stock_data:
            if "total_products" in stock_data:
                key_metrics.append({"name": "Products Tracked", "value": stock_data["total_products"]})
            if "low_stock_count" in stock_data:
                key_metrics.append({"name": "Low Stock Items", "value": stock_data["low_stock_count"]})
        
        wh_data = tool_results.get("get_warehouse_list", {})
        if wh_data and isinstance(wh_data.get("warehouses"), list):
            key_metrics.append({"name": "Warehouses", "value": len(wh_data["warehouses"])})
        
        health_data = tool_results.get("inventory_health_report", {})
        if health_data:
            if "health_score" in health_data:
                key_metrics.append({"name": "Health Score", "value": f"{health_data['health_score']}%"})
        
        # If no metrics, return simple text response
        if not key_metrics:
            return AgentOutput.text_response(summary=response_text, confidence=0.85)
        
        analytics = AnalyticsSection(
            overview=response_text,
            key_metrics=key_metrics,
        )
        
        # Add stock table if available
        if stock_data and isinstance(stock_data.get("products"), list):
            products = stock_data["products"]
            if len(products) > 0:
                analytics.detailed_breakdown = TableData(
                    title="Stock Levels",
                    columns=["Product", "Warehouse", "Quantity", "Status"],
                    rows=[
                        [
                            p.get("name", ""),
                            p.get("warehouse_name", ""),
                            str(p.get("quantity", 0)),
                            "⚠️ Low" if p.get("quantity", 0) < 10 else "✓ OK"
                        ]
                        for p in products[:10]
                    ]
                )
        
        # If no stock table, check warehouse list
        if not analytics.detailed_breakdown and wh_data and isinstance(wh_data.get("warehouses"), list):
            warehouses = wh_data["warehouses"]
            if len(warehouses) > 0:
                analytics.detailed_breakdown = TableData(
                    title="Warehouses",
                    columns=["Warehouse", "Products", "Total Units"],
                    rows=[
                        [
                            w.get("name", ""),
                            str(w.get("product_count", 0)),
                            str(w.get("total_units", 0)),
                        ]
                        for w in warehouses[:8]
                    ]
                )
        
        return AgentOutput.analytics_response(analytics=analytics, confidence=0.85)
