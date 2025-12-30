"""SafeSF Agent implementation using Claude Agent SDK."""

import asyncio
import os
import re
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any, List, TYPE_CHECKING

from dotenv import load_dotenv
from claude_agent_sdk import (
    ClaudeSDKClient,
    ClaudeAgentOptions,
    AgentDefinition,
    HookMatcher,
    create_sdk_mcp_server
)

from safesf_agent.tools.snowleopard_tool import retrieve_tool, retrieve_data
from safesf_agent.utils.flow_tracker import FlowTracker, AgentType
from safesf_agent.config import (
    ANTHROPIC_API_KEY,
    PROMPTS_DIR,
    LOGS_DIR,
    validate_config,
)

if TYPE_CHECKING:
    from safesf_agent.utils.event_emitter import EventEmitter

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)


def load_prompt(filename: str) -> str:
    """Load a prompt from the prompts directory."""
    prompt_path = PROMPTS_DIR / filename
    with open(prompt_path, "r", encoding="utf-8") as f:
        return f.read().strip()


def ensure_directories():
    """Ensure all required directories exist."""
    LOGS_DIR.mkdir(parents=True, exist_ok=True)


class SubagentTracker:
    """Track subagent activity for event streaming."""

    def __init__(self, event_emitter: Optional["EventEmitter"] = None, request_id: str = ""):
        self.event_emitter = event_emitter
        self.request_id = request_id
        self.sessions: Dict[str, Dict] = {}
        self.tool_call_records: list = []
        self.flow_tracker = FlowTracker()
        self.current_agent_id = None
        self.spawned_agents: Dict[str, str] = {}  # agent_type -> flow_id

        # Collected data from tool calls
        self.all_coordinates: List[Dict] = []
        self.all_data: List[Dict] = []
        self.all_sql: List[str] = []
        self.sql_queries: List[Dict] = []  # Track query + SQL + row count

    async def pre_tool_use_hook(self, hook_input: dict, tool_use_id: str, context: Any) -> dict:
        """Called before a tool is used."""
        tool_name = hook_input.get('tool_name', '')
        tool_input = hook_input.get('tool_input', {})

        logger.info(f"[PreToolUse] {tool_name}: {str(tool_input)[:100]}")

        # Detect Task tool calls (agent spawning)
        if tool_name == 'Task' and self.event_emitter:
            description = tool_input.get('description', '')
            subagent_type = tool_input.get('subagent_type', '')

            # Map subagent type to AgentType
            agent_type_map = {
                'location-resolver': AgentType.LOCATION,
                'data-agent': AgentType.DATA,
                'summary-agent': AgentType.SUMMARY,
            }

            if subagent_type in agent_type_map and subagent_type not in self.spawned_agents:
                agent_type = agent_type_map[subagent_type]
                flow_id = self.flow_tracker.register_agent(
                    agent_type, self.request_id, description
                )
                self.spawned_agents[subagent_type] = flow_id
                self.current_agent_id = flow_id

                await self.event_emitter.agent_spawned(
                    flow_id, subagent_type, self.request_id, description
                )
                logger.info(f"[AgentSpawned] {subagent_type} -> {flow_id}")

        # Emit tool called event
        if self.event_emitter and self.current_agent_id:
            await self.event_emitter.tool_called(
                self.current_agent_id,
                tool_name,
                tool_input
            )

        return {"continue_": True}

    async def post_tool_use_hook(self, hook_input: dict, tool_use_id: str, context: Any) -> dict:
        """Called after a tool is used."""
        tool_name = hook_input.get('tool_name', '')
        tool_input = hook_input.get('tool_input', {})
        tool_response = hook_input.get('tool_response')

        logger.info(f"[PostToolUse] {tool_name}: completed")
        logger.debug(f"[PostToolUse] Response type: {type(tool_response)}, value: {str(tool_response)[:500]}")

        # Extract data from retrieve tool responses
        row_count = 0
        coordinates = []
        rows = []
        sql = None

        if tool_name == 'mcp__snowleopard-tools__retrieve':
            # Parse the tool response
            response_data = self._parse_tool_response(tool_response)
            logger.debug(f"[PostToolUse] Parsed response: {str(response_data)[:300] if response_data else 'None'}")
            if response_data:
                row_count = response_data.get("row_count", 0)
                sql = response_data.get("sql")
                rows = response_data.get("rows", [])

                # Extract coordinates from rows
                for row in rows:
                    lat = row.get("latitude") or row.get("lat")
                    lng = row.get("longitude") or row.get("long") or row.get("lng")
                    if lat and lng:
                        try:
                            # Get category from various possible fields
                            category = (
                                row.get("incident_category")
                                or row.get("collision_severity")
                                or row.get("service_subtype")
                                or "Other"
                            )
                            coordinates.append({
                                "latitude": float(lat),
                                "longitude": float(lng),
                                "category": category
                            })
                        except (ValueError, TypeError):
                            pass

                # Store for final result
                self.all_coordinates.extend(coordinates)
                self.all_data.extend(rows)
                if sql:
                    self.all_sql.append(sql)
                    # Track full query details with rows for result display
                    query_text = tool_input.get('query', 'Unknown query')
                    self.sql_queries.append({
                        "query": query_text,
                        "sql": sql,
                        "rowCount": row_count,
                        "rows": rows  # Include rows for result table display
                    })

                logger.info(f"[DataExtracted] {row_count} rows, {len(coordinates)} coordinates")

        # Record tool call
        self.tool_call_records.append({
            "tool_name": tool_name,
            "tool_use_id": tool_use_id,
            "input": tool_input,
            "row_count": row_count,
            "timestamp": datetime.now().isoformat()
        })

        # Emit tool result event
        if self.event_emitter and self.current_agent_id:
            await self.event_emitter.tool_result(
                self.current_agent_id,
                tool_name,
                True,
                row_count
            )

            # Emit data received event if we have coordinates
            if coordinates:
                await self.event_emitter.data_received(
                    self.current_agent_id,
                    coordinates[:100],  # Limit for streaming
                    row_count
                )

        return {"continue_": True}

    def _parse_tool_response(self, tool_response: Any) -> Optional[Dict]:
        """Parse tool response to extract data."""
        if not tool_response:
            return None

        # Handle string response (JSON string)
        if isinstance(tool_response, str):
            try:
                parsed = json.loads(tool_response)
                # If parsed result has MCP content format, extract text
                if isinstance(parsed, dict) and 'content' in parsed:
                    return self._extract_from_mcp_content(parsed)
                return parsed
            except json.JSONDecodeError:
                pass
            return None

        # Handle list response (SDK might return list of content blocks)
        if isinstance(tool_response, list):
            for item in tool_response:
                if isinstance(item, dict):
                    if item.get('type') == 'text':
                        try:
                            return json.loads(item.get('text', '{}'))
                        except json.JSONDecodeError:
                            pass
                    elif 'text' in item:
                        try:
                            return json.loads(item.get('text', '{}'))
                        except json.JSONDecodeError:
                            pass
            return None

        # Handle dict response
        if isinstance(tool_response, dict):
            # Check for MCP content format
            if 'content' in tool_response:
                return self._extract_from_mcp_content(tool_response)
            # Check if it already has the data we need
            if 'row_count' in tool_response or 'rows' in tool_response:
                return tool_response
            # Check for text field directly
            if 'text' in tool_response:
                try:
                    return json.loads(tool_response.get('text', '{}'))
                except json.JSONDecodeError:
                    pass
            return tool_response

        # Handle object with attributes (SDK response objects)
        if hasattr(tool_response, 'content'):
            content = getattr(tool_response, 'content', None)
            if content:
                return self._parse_tool_response(content)

        return None

    def _extract_from_mcp_content(self, response: dict) -> Optional[Dict]:
        """Extract data from MCP content format."""
        content = response.get('content', [])
        if isinstance(content, list):
            for item in content:
                if isinstance(item, dict) and item.get('type') == 'text':
                    try:
                        return json.loads(item.get('text', '{}'))
                    except json.JSONDecodeError:
                        pass
        return None

    def set_current_agent(self, agent_id: str):
        """Set the current agent being tracked."""
        self.current_agent_id = agent_id

    def get_collected_data(self) -> Dict:
        """Get all collected data from tool calls."""
        return {
            "coordinates": self.all_coordinates,
            "data": self.all_data,
            "sql": self.all_sql[-1] if self.all_sql else None,
            "sqlQueries": self.sql_queries
        }


async def process_request(request: dict) -> Dict[str, Any]:
    """
    Process a SafeSF safety query.

    Args:
        request: Dictionary containing:
            - query: The safety query (e.g., "Is it safe near Ferry Building?")

    Returns:
        Dictionary with safety analysis, coordinates, and recommendations
    """
    validate_config()
    ensure_directories()

    # Load prompts
    orchestrator_prompt = load_prompt("orchestrator.txt")
    location_resolver_prompt = load_prompt("location_resolver.txt")
    data_agent_prompt = load_prompt("data_agent.txt")
    summary_agent_prompt = load_prompt("summary_agent.txt")

    # Initialize tracker
    tracker = SubagentTracker()

    # Create MCP server for Snow Leopard tools
    snowleopard_server = create_sdk_mcp_server(
        name="snowleopard-tools",
        version="1.0.0",
        tools=[retrieve_tool]
    )

    # Define specialized subagents
    agents = {
        "location-resolver": AgentDefinition(
            description=(
                "Resolve San Francisco location names to GPS coordinates. "
                "Use for place names like 'Ferry Building', 'Mission District', 'near Golden Gate Park'. "
                "Returns latitude, longitude, location name, and neighborhood."
            ),
            tools=["WebSearch"],
            prompt=location_resolver_prompt,
            model="haiku"
        ),
        "data-agent": AgentDefinition(
            description=(
                "Query SafeSF database via Snow Leopard API. "
                "Retrieves crime, traffic, fire, and encampment data. "
                "Requires coordinates for proximity queries. "
                "Returns raw data rows with coordinates for mapping."
            ),
            tools=["mcp__snowleopard-tools__retrieve"],
            prompt=data_agent_prompt,
            model="haiku"
        ),
        "summary-agent": AgentDefinition(
            description=(
                "Analyze safety data and generate insights. "
                "Computes safety scores (0-100), ratings, and actionable recommendations. "
                "Requires incident data from data-agent."
            ),
            tools=[],  # No tools - pure analysis
            prompt=summary_agent_prompt,
            model="haiku"
        )
    }

    # Set up hooks for tracking
    hooks = {
        'PreToolUse': [
            HookMatcher(
                matcher=None,
                hooks=[tracker.pre_tool_use_hook]
            )
        ],
        'PostToolUse': [
            HookMatcher(
                matcher=None,
                hooks=[tracker.post_tool_use_hook]
            )
        ]
    }

    # Configure the orchestrator agent
    options = ClaudeAgentOptions(
        permission_mode="bypassPermissions",
        system_prompt=orchestrator_prompt,
        allowed_tools=["Task"],
        agents=agents,
        hooks=hooks,
        mcp_servers={
            "snowleopard-tools": snowleopard_server
        },
        model="sonnet"
    )

    # Format the request
    query = request.get("query", "")

    result = {
        "success": False,
        "data": [],
        "coordinates": [],
        "analysis": None,
        "safety_score": None,
        "recommendations": [],
        "sql": None
    }

    start_time = datetime.now()

    try:
        async with ClaudeSDKClient(options=options) as client:
            await client.query(prompt=query)

            async for msg in client.receive_response():
                if type(msg).__name__ == 'AssistantMessage':
                    # Process message content
                    for block in msg.content:
                        if type(block).__name__ == 'TextBlock':
                            text = block.text
                            logger.info(f"[Agent Response] {text[:200]}...")

                            # Extract JSON from response
                            try:
                                json_match = re.search(r'\{[\s\S]*\}', text)
                                if json_match:
                                    parsed = json.loads(json_match.group())
                                    # Final orchestrator response (has safety_score at top level)
                                    if "safety_score" in parsed:
                                        result["safety_score"] = parsed.get("safety_score")
                                        result["rating"] = parsed.get("rating")
                                        result["rating_color"] = parsed.get("rating_color")
                                        result["analysis"] = parsed.get("analysis")
                                        result["recommendations"] = parsed.get("recommendations", [])
                                        result["location"] = parsed.get("location")
                                        result["data_period"] = parsed.get("data_period")
                            except (json.JSONDecodeError, AttributeError) as e:
                                logger.debug(f"JSON parse error: {e}")

        # Get collected data from tool calls
        collected = tracker.get_collected_data()
        result["coordinates"] = collected["coordinates"]
        result["data"] = collected["data"]
        if collected["sql"]:
            result["sql"] = collected["sql"]
        if collected["sqlQueries"]:
            result["sqlQueries"] = collected["sqlQueries"]

        duration_ms = int((datetime.now() - start_time).total_seconds() * 1000)
        result["success"] = True
        result["duration_ms"] = duration_ms
        result["tool_calls"] = len(tracker.tool_call_records)

    except Exception as e:
        logger.error(f"[SafeSF Agent] Error: {e}")
        result["error"] = str(e)

    return result


async def process_request_with_events(
    request: dict,
    event_emitter: "EventEmitter"
) -> Dict[str, Any]:
    """
    Process a SafeSF safety query with WebSocket event streaming.

    Args:
        request: Dictionary containing:
            - query: The safety query
        event_emitter: EventEmitter for WebSocket broadcasting

    Returns:
        Dictionary with safety analysis results
    """
    validate_config()
    ensure_directories()

    start_time = datetime.now()
    query = request.get("query", "")

    # Generate request ID
    request_id = f"REQ-{int(start_time.timestamp())}"
    await event_emitter.session_started(request_id, query)

    # Load prompts
    orchestrator_prompt = load_prompt("orchestrator.txt")
    location_resolver_prompt = load_prompt("location_resolver.txt")
    data_agent_prompt = load_prompt("data_agent.txt")
    summary_agent_prompt = load_prompt("summary_agent.txt")

    # Initialize tracker with event emitter
    tracker = SubagentTracker(event_emitter=event_emitter, request_id=request_id)
    tracker.flow_tracker.start_session(query[:100])

    # Create MCP server for Snow Leopard tools
    snowleopard_server = create_sdk_mcp_server(
        name="snowleopard-tools",
        version="1.0.0",
        tools=[retrieve_tool]
    )

    # Define specialized subagents
    agents = {
        "location-resolver": AgentDefinition(
            description=(
                "Resolve San Francisco location names to GPS coordinates. "
                "Use for place names like 'Ferry Building', 'Mission District', 'near Golden Gate Park'. "
                "Returns latitude, longitude, location name, and neighborhood."
            ),
            tools=["WebSearch"],
            prompt=location_resolver_prompt,
            model="haiku"
        ),
        "data-agent": AgentDefinition(
            description=(
                "Query SafeSF database via Snow Leopard API. "
                "Retrieves crime, traffic, fire, and encampment data. "
                "Requires coordinates for proximity queries. "
                "Returns raw data rows with coordinates for mapping."
            ),
            tools=["mcp__snowleopard-tools__retrieve"],
            prompt=data_agent_prompt,
            model="haiku"
        ),
        "summary-agent": AgentDefinition(
            description=(
                "Analyze safety data and generate insights. "
                "Computes safety scores (0-100), ratings, and actionable recommendations. "
                "Requires incident data from data-agent."
            ),
            tools=[],
            prompt=summary_agent_prompt,
            model="haiku"
        )
    }

    # Set up hooks for tracking with events
    async def pre_tool_hook(hook_input: dict, tool_use_id: str, context: Any) -> dict:
        return await tracker.pre_tool_use_hook(hook_input, tool_use_id, context)

    async def post_tool_hook(hook_input: dict, tool_use_id: str, context: Any) -> dict:
        return await tracker.post_tool_use_hook(hook_input, tool_use_id, context)

    hooks = {
        'PreToolUse': [
            HookMatcher(matcher=None, hooks=[pre_tool_hook])
        ],
        'PostToolUse': [
            HookMatcher(matcher=None, hooks=[post_tool_hook])
        ]
    }

    # Configure the orchestrator agent
    options = ClaudeAgentOptions(
        permission_mode="bypassPermissions",
        system_prompt=orchestrator_prompt,
        allowed_tools=["Task"],
        agents=agents,
        hooks=hooks,
        mcp_servers={
            "snowleopard-tools": snowleopard_server
        },
        model="sonnet"
    )

    result = {
        "success": False,
        "data": [],
        "coordinates": [],
        "analysis": None,
        "safety_score": None,
        "recommendations": [],
        "sql": None,
        "flow_trace": []
    }

    try:
        async with ClaudeSDKClient(options=options) as client:
            await client.query(prompt=query)

            async for msg in client.receive_response():
                if type(msg).__name__ == 'AssistantMessage':
                    for block in msg.content:
                        if type(block).__name__ == 'TextBlock':
                            text = block.text
                            logger.info(f"[Agent] {text[:200]}...")

                            # Extract JSON from response
                            try:
                                json_match = re.search(r'\{[\s\S]*\}', text)
                                if json_match:
                                    parsed = json.loads(json_match.group())
                                    # Final orchestrator response (has safety_score at top level)
                                    if "safety_score" in parsed:
                                        result["safety_score"] = parsed.get("safety_score")
                                        result["rating"] = parsed.get("rating")
                                        result["rating_color"] = parsed.get("rating_color")
                                        result["analysis"] = parsed.get("analysis")
                                        result["recommendations"] = parsed.get("recommendations", [])
                                        result["location"] = parsed.get("location")
                                        result["data_period"] = parsed.get("data_period")

                                        # Extract incident breakdown from analysis if present
                                        if isinstance(parsed.get("analysis"), dict):
                                            result["incident_breakdown"] = parsed["analysis"].get("incident_breakdown")

                            except (json.JSONDecodeError, AttributeError) as e:
                                logger.debug(f"JSON parse error: {e}")

        duration_ms = int((datetime.now() - start_time).total_seconds() * 1000)

        # Get collected data from tool calls
        collected = tracker.get_collected_data()
        result["coordinates"] = collected["coordinates"]
        result["data"] = collected["data"]
        if collected["sql"]:
            result["sql"] = collected["sql"]
        if collected["sqlQueries"]:
            result["sqlQueries"] = collected["sqlQueries"]

        # Complete agents and get flow trace
        for agent_type, flow_id in tracker.spawned_agents.items():
            tracker.flow_tracker.complete_agent(flow_id)
            if tracker.event_emitter:
                await tracker.event_emitter.agent_complete(flow_id, "completed")

        result["success"] = True
        result["duration_ms"] = duration_ms
        result["flow_trace"] = tracker.flow_tracker.get_flow_trace()

        # Emit session complete
        await event_emitter.session_complete(
            request_id=request_id,
            flow_trace=result["flow_trace"],
            duration_ms=duration_ms,
            final_response={
                "safety_score": result.get("safety_score"),
                "rating": result.get("rating"),
                "rating_color": result.get("rating_color"),
                "analysis": result.get("analysis"),
                "recommendations": result.get("recommendations"),
                "coordinates": result.get("coordinates"),
                "data": result.get("data"),
                "sql": result.get("sql"),
                "sqlQueries": result.get("sqlQueries"),
                "incident_breakdown": result.get("incident_breakdown"),
                "location": result.get("location"),
            }
        )

    except Exception as e:
        logger.error(f"[SafeSF Agent] Error: {e}")
        result["error"] = str(e)
        await event_emitter.session_error(request_id, str(e))

    return result


async def chat():
    """Interactive chat mode for testing the agent."""
    validate_config()
    ensure_directories()

    print("\n" + "=" * 60)
    print("SafeSF Agent - San Francisco Safety Query System")
    print("=" * 60)
    print("\nPowered by Claude Agent SDK + Snow Leopard")
    print("\nExample queries:")
    print('  "Is it safe near Ferry Building?"')
    print('  "What crimes happened in Mission District?"')
    print('  "Show me incidents near Golden Gate Park"')
    print("\nType 'exit' to quit.\n")

    while True:
        try:
            user_input = input("\nYou: ").strip()
        except (EOFError, KeyboardInterrupt):
            break

        if not user_input or user_input.lower() in ["exit", "quit", "q"]:
            break

        print("\nAgent: Processing...", flush=True)

        result = await process_request({"query": user_input})

        if result.get("success"):
            if result.get("safety_score"):
                print(f"\nSafety Score: {result['safety_score']}/100")
            if result.get("rating"):
                print(f"Rating: {result['rating']}")
            if result.get("analysis"):
                print(f"\nAnalysis: {result['analysis']}")
            if result.get("recommendations"):
                print("\nRecommendations:")
                for rec in result['recommendations'][:3]:
                    print(f"  • {rec}")
            if result.get("coordinates"):
                print(f"\nCoordinates: {len(result['coordinates'])} points")
            if result.get("data"):
                print(f"Data: {len(result['data'])} records")
            if result.get("duration_ms"):
                print(f"\n(Completed in {result['duration_ms']}ms)")
        else:
            print(f"\nError: {result.get('error', 'Unknown error')}")

    print("\nGoodbye!")


def main():
    """Entry point for CLI."""
    asyncio.run(chat())


if __name__ == "__main__":
    main()
