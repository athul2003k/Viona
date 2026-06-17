"""
Orders Domain Agent

Handles order management, customer insights, and sales actions.
Uses LLM-based tool selection, action confirmation workflow,
and token-by-token streaming.
"""

import logging
import json
from typing import Optional

from langchain_core.messages import HumanMessage, SystemMessage

from app.agents.base import BaseAgent
from app.agents.base.context import AgentState
from app.agents.base.output import AgentOutput, AnalyticsSection, TableData
from app.agents.prompts import ORDERS_AGENT_PROMPT, TOOL_SELECTION_PROMPT
from app.memory import RedisMemoryStore
from app.tools.base import ActionStatus

logger = logging.getLogger(__name__)


class OrdersAgent(BaseAgent):
    """Sales, orders, and customer specialist agent."""
    
    name = "orders_agent"
    description = "Handles orders and customer questions"
    system_prompt = ORDERS_AGENT_PROMPT
    
    async def execute(self, state: AgentState) -> AgentState:
        """Execute orders agent with action handling, LLM tool selection, and streaming."""
        context = state["context"]
        user_input = state["input"]
        stream_callback = getattr(context, 'stream_callback', None)
        
        # Initialize memory
        memory = RedisMemoryStore(
            org_id=context.auth.org_id,
            user_id=context.auth.user_id,
            session_id=context.session_id
        )
        
        # === CHECK FOR PENDING ACTION CONFIRMATION ===
        pending_action = await memory.get_pending_action()
        if pending_action:
            result = await self._handle_pending_action(
                state, memory, pending_action, user_input
            )
            if result is not None:
                return result
        
        # Get conversation history
        memory_messages = await memory.get_context_messages(max_messages=10)
        
        # Load all available tools
        from app.tools.orders import get_orders_tools
        from app.tools.alerts import get_alerts_tools
        from app.tools.actions import get_action_tools
        
        order_tools = get_orders_tools(context.auth)
        alert_tools = get_alerts_tools(context.auth)
        action_tools = get_action_tools(context.auth)
        all_tools = order_tools + alert_tools + action_tools
        
        # === LLM-BASED TOOL SELECTION ===
        tools_to_run = await self._select_tools(state, all_tools, user_input)
        
        # Check if any selected tools are ActionTools
        action_tool_names = {t.name for t in action_tools}
        selected_action_tools = [t for t in tools_to_run if t in action_tool_names]
        
        # === HANDLE ACTION TOOLS (with confirmation workflow) ===
        if selected_action_tools:
            result = await self._handle_action_tools(
                state, memory, action_tools, selected_action_tools, user_input
            )
            if result is not None:
                return result
        
        # === HANDLE ANALYTICS TOOLS (read-only) ===
        analytics_tool_names = [t for t in tools_to_run if t not in action_tool_names]
        if not analytics_tool_names:
            analytics_tool_names = ["get_order_list", "get_order_status_breakdown"]
        
        tool_results = await self.execute_tools(state, all_tools, analytics_tool_names)
        
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
            f"Analyze this order/customer data and provide insights. "
            f"Highlight important patterns (pending orders, revenue, top customers). "
            f"Suggest one actionable next step.\n\n"
            f"Order Data:\n{tool_context}\n\n"
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
    
    async def _handle_pending_action(
        self, state: AgentState, memory: RedisMemoryStore,
        pending_action: dict, user_input: str
    ) -> Optional[AgentState]:
        """Handle user confirmation/cancellation of a pending action."""
        user_lower = user_input.lower().strip()
        
        confirm_words = {'yes', 'yeah', 'yep', 'sure', 'confirm', 'ok', 'okay', 
                        'proceed', 'do it', 'go ahead', 'y'}
        cancel_words = {'no', 'nope', 'cancel', 'stop', 'never mind', 'nevermind', 'n'}
        
        if user_lower in confirm_words:
            # Execute the pending action
            return await self._confirm_action(state, memory, pending_action)
        elif user_lower in cancel_words:
            # Cancel the pending action
            await memory.clear_pending_action()
            output = AgentOutput.text_response(
                summary="Got it — I've cancelled that action. What else can I help you with?",
                confidence=0.95
            )
            state["output"] = output.model_dump()
            await memory.add_message("user", user_input)
            await memory.add_message("assistant", output.summary)
            return state
        
        # User said something else while action is pending — clear and process normally
        await memory.clear_pending_action()
        return None
    
    async def _confirm_action(
        self, state: AgentState, memory: RedisMemoryStore, pending_action: dict
    ) -> AgentState:
        """Execute a confirmed action."""
        context = state["context"]
        action_type = pending_action["action_type"]
        params = pending_action["params"]
        
        from app.tools.actions import get_action_tools
        action_tools = get_action_tools(context.auth)
        
        tool = next((t for t in action_tools if t.name == action_type), None)
        if not tool:
            output = AgentOutput.text_response(
                summary="I couldn't find that action anymore. Please try again.",
                confidence=0.5
            )
            state["output"] = output.model_dump()
            await memory.clear_pending_action()
            return state
        
        # Execute with confirmed=True
        result = await tool.run_action(confirmed=True, **params)
        await memory.clear_pending_action()
        
        if result.success:
            summary = (
                f"Done! {result.data.get('message', 'Action completed successfully.')} "
                f"Is there anything else you'd like me to do?"
            )
        else:
            summary = f"Something went wrong: {result.error}"
        
        output = AgentOutput.text_response(summary=summary, confidence=0.9)
        state["output"] = output.model_dump()
        await memory.add_message("user", "yes")
        await memory.add_message("assistant", summary)
        return state
    
    async def _handle_action_tools(
        self, state: AgentState, memory: RedisMemoryStore,
        action_tools: list, selected_actions: list[str], user_input: str
    ) -> Optional[AgentState]:
        """Handle action tool execution with LLM-based parameter extraction."""
        context = state["context"]
        action_name = selected_actions[0]  # Process one action at a time
        
        tool = next((t for t in action_tools if t.name == action_name), None)
        if not tool:
            return None
        
        # Use LLM to extract parameters from user input
        params = await self._extract_action_params(tool, user_input)
        
        # Run the action (validate → preview → await confirmation)
        result = await tool.run_action(confirmed=False, **params)
        
        if result.status == ActionStatus.MISSING_DATA:
            # Need more info from the user
            output = AgentOutput.text_response(
                summary=result.data.get("prompt", "I need some more details to proceed."),
                confidence=0.8
            )
            state["output"] = output.model_dump()
            await memory.add_message("user", user_input)
            await memory.add_message("assistant", output.summary)
            return state
        
        elif result.status == ActionStatus.PENDING_CONFIRMATION:
            # Store action and ask for confirmation
            await memory.set_pending_action(
                action_type=action_name,
                params=params,
                preview_data=result.preview_data
            )
            
            summary = result.confirmation_message or "Please confirm this action (yes/no)."
            output = AgentOutput.text_response(summary=summary, confidence=0.9)
            state["output"] = output.model_dump()
            await memory.add_message("user", user_input)
            await memory.add_message("assistant", summary)
            return state
        
        elif result.status == ActionStatus.CANCELLED:
            output = AgentOutput.text_response(
                summary=result.error or "Action cancelled.",
                confidence=0.8
            )
            state["output"] = output.model_dump()
            return state
        
        return None
    
    async def _extract_action_params(self, tool, user_input: str) -> dict:
        """Use LLM to extract structured parameters from natural language input."""
        field_descriptions = getattr(tool, 'field_descriptions', {})
        required_fields = getattr(tool, 'required_fields', [])
        
        if not required_fields:
            return {}
        
        fields_desc = "\n".join([
            f"- {field}: {field_descriptions.get(field, 'required')}" 
            for field in required_fields
        ])
        
        prompt = (
            f"Extract the following parameters from the user's message. "
            f"Return a JSON object with the extracted values. "
            f"If a value isn't mentioned, omit it from the JSON.\n\n"
            f"Required fields:\n{fields_desc}\n\n"
            f"User message: {user_input}\n\n"
            f"Return ONLY a JSON object, nothing else."
        )
        
        try:
            from app.llms import get_model_for_task
            model, _ = get_model_for_task("tool_selection")
            
            response = await model.ainvoke([
                SystemMessage(content="You are a parameter extraction assistant. Return only a JSON object."),
                HumanMessage(content=prompt)
            ])
            
            text = response.content if hasattr(response, 'content') else str(response)
            text = text.strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
            
            params = json.loads(text)
            if isinstance(params, dict):
                return params
        except Exception as e:
            logger.warning(f"LLM parameter extraction failed: {e}")
        
        return {}
    
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
        return ["get_order_list", "get_order_status_breakdown"]
    
    def _parse_response(self, response_text: str, tool_results: dict) -> AgentOutput:
        """Parse LLM response into structured output with tables."""
        # Build key metrics from tool results
        key_metrics = []
        
        status_data = tool_results.get("get_order_status_breakdown", {})
        if status_data and isinstance(status_data.get("statuses"), list):
            for s in status_data["statuses"]:
                key_metrics.append({"name": s.get("status", ""), "value": s.get("count", 0)})
        
        order_data = tool_results.get("get_order_list", {})
        if order_data:
            if "total_count" in order_data:
                key_metrics.append({"name": "Total Orders", "value": order_data["total_count"]})
        
        customer_data = tool_results.get("get_top_customers", {})
        if customer_data and isinstance(customer_data.get("customers"), list):
            key_metrics.append({"name": "Top Customers", "value": len(customer_data["customers"])})
        
        # If no metrics, return simple text response
        if not key_metrics:
            return AgentOutput.text_response(summary=response_text, confidence=0.85)
        
        analytics = AnalyticsSection(
            overview=response_text,
            key_metrics=key_metrics,
        )
        
        # Add orders table if available
        if order_data and isinstance(order_data.get("orders"), list):
            orders = order_data["orders"]
            if len(orders) > 0:
                analytics.detailed_breakdown = TableData(
                    title="Recent Orders",
                    columns=["Order ID", "Customer", "Status", "Amount"],
                    rows=[
                        [
                            str(o.get("order_id", "")),
                            o.get("customer_name", ""),
                            o.get("status", ""),
                            f"${o.get('total_amount', 0):,.2f}"
                        ]
                        for o in orders[:8]
                    ]
                )
        
        # If no orders table, try top customers
        if not analytics.detailed_breakdown and customer_data and isinstance(customer_data.get("customers"), list):
            customers = customer_data["customers"]
            if len(customers) > 0:
                analytics.detailed_breakdown = TableData(
                    title="Top Customers",
                    columns=["Customer", "Orders", "Total Spent"],
                    rows=[
                        [
                            c.get("customer_name", ""),
                            str(c.get("order_count", 0)),
                            f"${c.get('total_spent', 0):,.2f}"
                        ]
                        for c in customers[:8]
                    ]
                )
        
        return AgentOutput.analytics_response(analytics=analytics, confidence=0.85)
