"""Snow Leopard API tools for SafeSF database queries."""

import logging
import os
import json
from typing import Any

from snowleopard import SnowLeopardPlaygroundClient

logger = logging.getLogger(__name__)

# Global client instance
_client = None


def get_client() -> SnowLeopardPlaygroundClient:
    """Get or create Snow Leopard client."""
    global _client

    if _client is None:
        api_key = os.getenv("SNOWLEOPARD_API_KEY")
        if not api_key:
            raise ValueError("SNOWLEOPARD_API_KEY not set")

        _client = SnowLeopardPlaygroundClient(api_key=api_key)
        logger.info("[Snow Leopard] Client initialized")

    return _client


async def retrieve_data(user_query: str) -> dict[str, Any]:
    """
    Query SafeSF database via Snow Leopard retrieve endpoint.

    Args:
        user_query: Natural language query for safety data

    Returns:
        Dict with keys: success, rows, sql, message/error
    """
    try:
        client = get_client()
        datafile_id = os.getenv("SNOWLEOPARD_DATAFILE_ID")

        if not datafile_id:
            raise ValueError("SNOWLEOPARD_DATAFILE_ID not set")

        logger.info(f"[Snow Leopard] Retrieve query: {user_query[:100]}...")

        # Call Snow Leopard API
        result = client.retrieve(datafile_id=datafile_id, user_query=user_query)

        # Extract data from response
        response_status = getattr(result, "responseStatus", "")
        data = getattr(result, "data", [])

        if not data:
            return {
                "success": False,
                "error": "No data returned",
                "rows": [],
                "sql": "",
            }

        # Get first data item
        data_item = data[0]
        rows = getattr(data_item, "rows", [])
        sql = getattr(data_item, "query", "")
        summary = getattr(data_item, "querySummary", None)

        logger.info(f"[Snow Leopard] Retrieved {len(rows)} rows")

        return {
            "success": True,
            "rows": rows,
            "sql": sql,
            "row_count": len(rows),
            "summary": summary,
            "response_status": response_status,
        }

    except Exception as e:
        logger.error(f"[Snow Leopard] Retrieve failed: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "rows": [],
            "sql": "",
        }


async def get_response(user_query: str) -> dict[str, Any]:
    """
    Query SafeSF database via Snow Leopard response endpoint.

    Args:
        user_query: Natural language query for safety data

    Returns:
        Dict with keys: success, response, message/error
    """
    try:
        client = get_client()
        datafile_id = os.getenv("SNOWLEOPARD_DATAFILE_ID")

        if not datafile_id:
            raise ValueError("SNOWLEOPARD_DATAFILE_ID not set")

        logger.info(f"[Snow Leopard] Response query: {user_query[:100]}...")

        # Call Snow Leopard API response endpoint
        result = client.response(datafile_id=datafile_id, user_query=user_query)

        response_status = getattr(result, "responseStatus", "")
        response_text = getattr(result, "response", "")

        logger.info(f"[Snow Leopard] Got response: {response_text[:100]}...")

        return {
            "success": True,
            "response": response_text,
            "response_status": response_status,
        }

    except Exception as e:
        logger.error(f"[Snow Leopard] Response failed: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "response": "",
        }


# Tool definitions for MCP server
def snowleopard_retrieve_tool_handler(user_query: str) -> str:
    """Handler for retrieve tool - returns JSON string."""
    import asyncio

    result = asyncio.get_event_loop().run_until_complete(retrieve_data(user_query))
    return json.dumps(result, default=str)


def snowleopard_response_tool_handler(user_query: str) -> str:
    """Handler for response tool - returns JSON string."""
    import asyncio

    result = asyncio.get_event_loop().run_until_complete(get_response(user_query))
    return json.dumps(result, default=str)


# Tool definitions for SDK
snowleopard_retrieve_tool = {
    "name": "retrieve",
    "description": """Query SafeSF database with natural language and get raw data rows.

AVAILABLE TABLES:
- violent_crimes: Homicide, Assault, Robbery, Rape, Weapons (columns: latitude, longitude, incident_datetime, incident_category, analysis_neighborhood, police_district)
- property_crimes: Burglary, Motor Vehicle Theft (columns: latitude, longitude, incident_datetime, incident_category, analysis_neighborhood)
- encampments: 311 reports (columns: latitude, longitude, requested_datetime, address, analysis_neighborhood, status_description)
- traffic_injuries: Crash injuries (columns: latitude, longitude, collision_datetime, collision_severity, type_of_collision, number_injured)
- traffic_fatalities: Traffic deaths (columns: latitude, longitude, collision_datetime, collision_type, deceased_type, age)
- fire_incidents: Fires with casualties (columns: latitude, longitude, alarm_datetime, primary_situation, civilian_fatalities)
- neighborhoods: SF neighborhood names and police districts
- incident_categories: Severity weights (0-100) for safety scoring

For proximity queries, include coordinates and distance (e.g., "within 1km of latitude 37.78, longitude -122.40").

Returns: SQL query executed + data rows with coordinates.""",
    "input_schema": {
        "type": "object",
        "properties": {
            "user_query": {
                "type": "string",
                "description": "Natural language query for safety data",
            }
        },
        "required": ["user_query"],
    },
    "handler": snowleopard_retrieve_tool_handler,
}

snowleopard_response_tool = {
    "name": "response",
    "description": """Query SafeSF database and get a natural language summary.

Same tables as retrieve tool, but returns human-readable summary instead of raw data rows.
Use this when you need a quick summary rather than detailed data.""",
    "input_schema": {
        "type": "object",
        "properties": {
            "user_query": {
                "type": "string",
                "description": "Natural language query for safety data",
            }
        },
        "required": ["user_query"],
    },
    "handler": snowleopard_response_tool_handler,
}
