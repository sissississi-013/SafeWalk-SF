"""Main SafeSF agent implementation using Claude Agent SDK pattern."""

import asyncio
import json
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Optional

from anthropic import Anthropic

from safesf_agent.config import (
    ANTHROPIC_API_KEY,
    SNOWLEOPARD_API_KEY,
    SNOWLEOPARD_DATAFILE_ID,
    PROMPTS_DIR,
    LOGS_DIR,
    validate_config,
)
from safesf_agent.tools.snowleopard_tool import retrieve_data, get_response
from safesf_agent.utils.flow_tracker import FlowTracker, AgentType
from safesf_agent.utils.event_emitter import EventEmitter

logger = logging.getLogger(__name__)


def load_prompt(filename: str) -> str:
    """Load a prompt from the prompts directory."""
    prompt_path = PROMPTS_DIR / filename
    with open(prompt_path, "r", encoding="utf-8") as f:
        return f.read().strip()


def ensure_directories():
    """Ensure log directories exist."""
    LOGS_DIR.mkdir(parents=True, exist_ok=True)


class SafeSFAgent:
    """
    Multi-agent system for San Francisco safety data queries.

    Uses an orchestrator pattern where the main agent coordinates
    specialized subagents for different tasks.
    """

    def __init__(self, event_emitter: Optional[EventEmitter] = None):
        """
        Initialize the SafeSF agent.

        Args:
            event_emitter: Optional EventEmitter for WebSocket streaming
        """
        validate_config()
        ensure_directories()

        self.client = Anthropic(api_key=ANTHROPIC_API_KEY)
        self.event_emitter = event_emitter or EventEmitter()
        self.flow_tracker = FlowTracker()

        # Load prompts
        self.orchestrator_prompt = load_prompt("orchestrator.txt")
        self.data_agent_prompt = load_prompt("data_agent.txt")
        self.summary_agent_prompt = load_prompt("summary_agent.txt")
        self.location_resolver_prompt = load_prompt("location_resolver.txt")

        logger.info("[SafeSFAgent] Initialized")

    async def process_request(self, user_query: str) -> dict:
        """
        Process a user safety query.

        Args:
            user_query: Natural language query about SF safety

        Returns:
            Dict containing response data, coordinates, and flow trace
        """
        # Start session
        self.flow_tracker.reset_counters()
        request_id = self.flow_tracker.start_session(user_query[:100])
        await self.event_emitter.session_started(request_id, user_query)

        try:
            # Run orchestrator
            result = await self._run_orchestrator(user_query, request_id)

            # End session
            flow_trace = self.flow_tracker.get_flow_trace()
            summary = self.flow_tracker.end_session("completed")

            await self.event_emitter.session_complete(
                request_id=request_id,
                flow_trace=flow_trace,
                duration_ms=summary.get("duration_ms", 0),
                final_response=result,
            )

            return {
                "success": True,
                "request_id": request_id,
                "flow_trace": flow_trace,
                "duration_ms": summary.get("duration_ms", 0),
                **result,
            }

        except Exception as e:
            logger.error(f"[SafeSFAgent] Error: {e}")
            await self.event_emitter.session_error(request_id, str(e))
            self.flow_tracker.end_session("failed")
            return {
                "success": False,
                "request_id": request_id,
                "error": str(e),
            }

    async def _run_orchestrator(self, user_query: str, request_id: str) -> dict:
        """
        Run the orchestrator to handle the user query.

        The orchestrator analyzes the query and delegates to appropriate subagents.
        """
        logger.info(f"[Orchestrator] Processing: {user_query[:100]}")

        # Analyze query to determine which agents to use
        analysis = self._analyze_query(user_query)

        result = {
            "data": [],
            "coordinates": [],
            "analysis": None,
            "summary": None,
        }

        # Step 1: Resolve location if needed
        if analysis["needs_location_resolution"]:
            location_data = await self._run_location_resolver(
                analysis["location_query"],
                request_id,
            )
            if location_data.get("success"):
                analysis["latitude"] = location_data.get("latitude")
                analysis["longitude"] = location_data.get("longitude")
                analysis["location_name"] = location_data.get("location_name")

        # Step 2: Query data
        data_input_id = request_id
        if "latitude" in analysis:
            # Use coordinates in query
            data_query = self._build_data_query(user_query, analysis)
        else:
            data_query = user_query

        data_result = await self._run_data_agent(data_query, data_input_id)
        result["data"] = data_result.get("rows", [])
        result["coordinates"] = data_result.get("coordinates", [])
        result["sql"] = data_result.get("sql", "")

        # Step 3: Generate summary if needed
        if analysis["needs_summary"] and result["data"]:
            summary_result = await self._run_summary_agent(
                result["data"],
                data_result.get("flow_id", "DATA-001"),
            )
            result["analysis"] = summary_result.get("analysis")
            result["summary"] = summary_result.get("summary")
            result["safety_score"] = summary_result.get("safety_score")
            result["recommendations"] = summary_result.get("recommendations")

        return result

    def _analyze_query(self, query: str) -> dict:
        """Analyze the query to determine processing strategy."""
        query_lower = query.lower()

        # Check for coordinates in query
        has_coords = any(x in query_lower for x in ["lat", "longitude", "coordinates", "37."])

        # Check for place names
        place_indicators = ["near", "around", "in", "at", "by", "close to"]
        has_place = any(x in query_lower for x in place_indicators)

        # Common SF landmarks
        landmarks = [
            "ferry building", "fisherman", "wharf", "union square",
            "golden gate", "coit tower", "mission", "castro",
            "tenderloin", "soma", "chinatown", "north beach",
            "marina", "richmond", "sunset", "haight", "civic center",
            "embarcadero", "financial district", "noe valley",
        ]
        has_landmark = any(x in query_lower for x in landmarks)

        # Check if summary/analysis is requested
        summary_indicators = ["safe", "dangerous", "risk", "recommend", "should", "analysis", "score"]
        needs_summary = any(x in query_lower for x in summary_indicators)

        return {
            "needs_location_resolution": (has_place or has_landmark) and not has_coords,
            "location_query": self._extract_location(query) if (has_place or has_landmark) else None,
            "needs_summary": needs_summary,
            "query_type": self._determine_query_type(query),
        }

    def _extract_location(self, query: str) -> str:
        """Extract the location portion from a query."""
        # Simple extraction - take everything after location indicators
        query_lower = query.lower()
        indicators = ["near", "around", "in", "at", "by", "close to"]

        for indicator in indicators:
            if indicator in query_lower:
                idx = query_lower.find(indicator)
                return query[idx + len(indicator):].strip().rstrip("?.,!")

        return query

    def _determine_query_type(self, query: str) -> str:
        """Determine what type of data the query is asking for."""
        query_lower = query.lower()

        if any(x in query_lower for x in ["crime", "assault", "robbery", "theft", "homicide"]):
            return "crime"
        elif any(x in query_lower for x in ["traffic", "accident", "collision", "crash"]):
            return "traffic"
        elif any(x in query_lower for x in ["encampment", "homeless", "tent"]):
            return "encampment"
        elif any(x in query_lower for x in ["fire"]):
            return "fire"
        elif any(x in query_lower for x in ["safe", "dangerous", "all"]):
            return "all"
        else:
            return "all"

    def _build_data_query(self, original_query: str, analysis: dict) -> str:
        """Build a data query with coordinates if available."""
        if "latitude" in analysis and "longitude" in analysis:
            lat = analysis["latitude"]
            lng = analysis["longitude"]
            location_name = analysis.get("location_name", "specified location")
            query_type = analysis.get("query_type", "all")

            # Build a clear query for Snow Leopard based on what was asked
            if query_type == "crime":
                return f"Get all violent crimes and property crimes within 1 kilometer of latitude {lat}, longitude {lng}"
            elif query_type == "traffic":
                return f"Get all traffic injuries and traffic fatalities within 1 kilometer of latitude {lat}, longitude {lng}"
            elif query_type == "encampment":
                return f"Get all encampments within 1 kilometer of latitude {lat}, longitude {lng}"
            elif query_type == "fire":
                return f"Get all fire incidents within 1 kilometer of latitude {lat}, longitude {lng}"
            else:
                # For safety queries, get comprehensive data
                return f"Get all violent crimes within 1 kilometer of latitude {lat}, longitude {lng}"

        return original_query

    async def _run_location_resolver(self, location_query: str, input_id: str) -> dict:
        """Run the location resolver subagent."""
        flow_id = self.flow_tracker.register_agent(
            AgentType.LOCATION,
            input_id,
            f"Resolving location: {location_query}",
        )

        await self.event_emitter.agent_spawned(
            agent_id=flow_id,
            agent_type="location-resolver",
            input_id=input_id,
            description=f"Resolving location: {location_query}",
        )

        try:
            # Use Claude to resolve location
            messages = [
                {
                    "role": "user",
                    "content": f"""Resolve the GPS coordinates for this San Francisco location: "{location_query}"

Return ONLY a JSON object with this exact format:
{{
    "success": true,
    "latitude": <number>,
    "longitude": <number>,
    "location_name": "<full name>",
    "neighborhood": "<SF neighborhood>"
}}

If you cannot resolve the location, return:
{{
    "success": false,
    "error": "Could not resolve location"
}}"""
                }
            ]

            response = self.client.messages.create(
                model="claude-3-5-haiku-20241022",
                max_tokens=500,
                system=self.location_resolver_prompt,
                messages=messages,
            )

            # Parse response
            response_text = response.content[0].text
            # Extract JSON from response
            try:
                # Try to find JSON in response
                import re
                json_match = re.search(r'\{[^{}]*\}', response_text, re.DOTALL)
                if json_match:
                    result = json.loads(json_match.group())
                else:
                    result = json.loads(response_text)
            except json.JSONDecodeError:
                result = {"success": False, "error": "Could not parse location response"}

            result["flow_id"] = flow_id
            result["input_id"] = input_id

            self.flow_tracker.complete_agent(flow_id, result)
            await self.event_emitter.agent_complete(flow_id, "completed", result)

            return result

        except Exception as e:
            logger.error(f"[LocationResolver] Error: {e}")
            self.flow_tracker.complete_agent(flow_id, status="failed")
            await self.event_emitter.agent_complete(flow_id, "failed")
            return {"success": False, "error": str(e)}

    async def _run_data_agent(self, data_query: str, input_id: str) -> dict:
        """Run the data agent to query Snow Leopard."""
        flow_id = self.flow_tracker.register_agent(
            AgentType.DATA,
            input_id,
            f"Querying: {data_query[:50]}...",
        )

        await self.event_emitter.agent_spawned(
            agent_id=flow_id,
            agent_type="data-agent",
            input_id=input_id,
            description=f"Querying SafeSF database",
        )

        try:
            await self.event_emitter.tool_called(flow_id, "retrieve", {"query": data_query[:100]})

            # Call Snow Leopard
            result = await retrieve_data(data_query)

            rows = result.get("rows", [])
            sql = result.get("sql", "")

            # Extract coordinates from rows
            coordinates = []
            for row in rows:
                if isinstance(row, dict):
                    lat = row.get("latitude") or row.get("lat")
                    lng = row.get("longitude") or row.get("long") or row.get("lng")
                    if lat and lng:
                        coordinates.append({"latitude": lat, "longitude": lng})

            await self.event_emitter.tool_result(flow_id, "retrieve", True, len(rows))
            await self.event_emitter.data_received(flow_id, coordinates, len(rows))

            output = {
                "flow_id": flow_id,
                "input_id": input_id,
                "rows": rows,
                "sql": sql,
                "row_count": len(rows),
                "coordinates": coordinates,
            }

            self.flow_tracker.complete_agent(flow_id, output)
            await self.event_emitter.agent_complete(flow_id, "completed", {"row_count": len(rows)})

            return output

        except Exception as e:
            logger.error(f"[DataAgent] Error: {e}")
            self.flow_tracker.complete_agent(flow_id, status="failed")
            await self.event_emitter.agent_complete(flow_id, "failed")
            return {"success": False, "error": str(e), "rows": [], "coordinates": []}

    async def _run_summary_agent(self, data: list, input_id: str) -> dict:
        """Run the summary agent to analyze data."""
        flow_id = self.flow_tracker.register_agent(
            AgentType.SUMMARY,
            input_id,
            "Analyzing safety data",
        )

        await self.event_emitter.agent_spawned(
            agent_id=flow_id,
            agent_type="summary-agent",
            input_id=input_id,
            description="Analyzing safety data and generating recommendations",
        )

        try:
            # Prepare data summary for analysis
            data_summary = self._prepare_data_for_analysis(data)

            messages = [
                {
                    "role": "user",
                    "content": f"""Analyze this San Francisco safety data and provide insights:

Data Summary:
{json.dumps(data_summary, indent=2, default=str)}

Total incidents: {len(data)}

Provide your analysis as a JSON object with:
- safety_score (0-100, 100 is safest)
- rating (Safe/Generally Safe/Caution/High Risk)
- analysis (brief text analysis)
- recommendations (list of 3-5 actionable tips)
- incident_breakdown (counts by category)"""
                }
            ]

            response = self.client.messages.create(
                model="claude-3-5-haiku-20241022",
                max_tokens=1500,
                system=self.summary_agent_prompt,
                messages=messages,
            )

            response_text = response.content[0].text

            # Parse response
            try:
                import re
                json_match = re.search(r'\{[\s\S]*\}', response_text)
                if json_match:
                    result = json.loads(json_match.group())
                else:
                    result = {"analysis": response_text, "safety_score": 50}
            except json.JSONDecodeError:
                result = {"analysis": response_text, "safety_score": 50}

            result["flow_id"] = flow_id
            result["input_id"] = input_id
            result["summary"] = result.get("analysis", "")

            self.flow_tracker.complete_agent(flow_id, result)
            await self.event_emitter.agent_complete(
                flow_id, "completed",
                {"safety_score": result.get("safety_score")}
            )

            return result

        except Exception as e:
            logger.error(f"[SummaryAgent] Error: {e}")
            self.flow_tracker.complete_agent(flow_id, status="failed")
            await self.event_emitter.agent_complete(flow_id, "failed")
            return {"success": False, "error": str(e)}

    def _prepare_data_for_analysis(self, data: list) -> dict:
        """Prepare data summary for the summary agent."""
        if not data:
            return {"total": 0, "categories": {}}

        # Count by category
        categories = {}
        for row in data:
            if isinstance(row, dict):
                cat = row.get("incident_category") or row.get("collision_severity") or "unknown"
                categories[cat] = categories.get(cat, 0) + 1

        # Get sample records
        sample = data[:5] if len(data) > 5 else data

        return {
            "total_incidents": len(data),
            "categories": categories,
            "sample_records": sample,
        }


# Convenience functions
async def process_request(user_query: str) -> dict:
    """Process a user query without event streaming."""
    agent = SafeSFAgent()
    return await agent.process_request(user_query)


async def process_request_with_events(
    user_query: str,
    event_emitter: EventEmitter,
) -> dict:
    """Process a user query with event streaming."""
    agent = SafeSFAgent(event_emitter=event_emitter)
    return await agent.process_request(user_query)
