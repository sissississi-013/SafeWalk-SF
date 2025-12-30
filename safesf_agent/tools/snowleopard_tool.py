"""Snow Leopard API tools for SafeSF database queries using Claude Agent SDK."""

import logging
import os
import json
import asyncio
from typing import Any

from snowleopard import SnowLeopardPlaygroundClient
from claude_agent_sdk import tool

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


# ============================================================================
# SDK Tool Wrapper using @tool decorator
# ============================================================================

RETRIEVE_DESCRIPTION = """Query SafeSF database with natural language and get raw data rows with coordinates.

AVAILABLE TABLES:
- violent_crimes: Homicide, Assault, Robbery, Rape, Weapons
  Columns: latitude, longitude, incident_datetime, incident_category, analysis_neighborhood, police_district

- property_crimes: Burglary, Motor Vehicle Theft, Larceny Theft
  Columns: latitude, longitude, incident_datetime, incident_category, analysis_neighborhood

- encampments: 311 homeless encampment reports
  Columns: latitude, longitude, requested_datetime, address, analysis_neighborhood, status_description

- traffic_injuries: Vehicle collision injuries
  Columns: latitude, longitude, collision_datetime, collision_severity, type_of_collision, number_injured

- traffic_fatalities: Traffic deaths
  Columns: latitude, longitude, collision_datetime, collision_type, deceased_type, age

- fire_incidents: Fires with casualties
  Columns: latitude, longitude, alarm_datetime, primary_situation, civilian_fatalities

- neighborhoods: SF neighborhood names and police districts
- incident_categories: Severity weights (0-100) for safety scoring

QUERY TIPS:
- For proximity queries: "within 1km of latitude 37.78, longitude -122.40"
- For neighborhood queries: "crimes in Mission district"
- For time filters: "incidents in the last 30 days"
- For category filters: "robbery and assault incidents"

Returns: SQL query executed + data rows with latitude/longitude coordinates."""


@tool("retrieve", RETRIEVE_DESCRIPTION, {"query": str})
async def retrieve_tool(args: dict) -> dict:
    """
    Query SafeSF database and get raw data rows.

    Args:
        args: Dictionary with 'query' key containing the natural language query

    Returns:
        MCP-formatted response with data or error
    """
    try:
        query = args.get("query", "")
        result = await retrieve_data(query)

        if result.get("success"):
            all_rows = result.get("rows", [])
            row_count = len(all_rows)

            # Extract coordinates with category for mapping
            coordinates = []
            for row in all_rows:
                if isinstance(row, dict):
                    lat = row.get("latitude") or row.get("lat")
                    lng = row.get("longitude") or row.get("long") or row.get("lng")
                    if lat and lng:
                        # Get category from various possible fields
                        category = (
                            row.get("incident_category")
                            or row.get("collision_severity")
                            or row.get("service_subtype")
                            or "Other"
                        )
                        coordinates.append({
                            "latitude": lat,
                            "longitude": lng,
                            "category": category
                        })

            # Format successful response - return ALL data
            response_data = {
                "success": True,
                "row_count": row_count,
                "sql": result.get("sql", ""),
                "rows": all_rows,  # Return ALL rows
                "coordinates": coordinates,  # Return ALL coordinates with category
                "total_rows": row_count,
            }

            logger.info(f"[retrieve_tool] Returning {row_count} rows, {len(coordinates)} coordinates")

            return {
                "content": [{"type": "text", "text": json.dumps(response_data, default=str)}]
            }
        else:
            return {
                "content": [{"type": "text", "text": json.dumps({
                    "success": False,
                    "error": result.get("error", "Unknown error")
                })}],
                "is_error": True
            }

    except Exception as e:
        logger.error(f"[retrieve_tool] Error: {e}")
        return {
            "content": [{"type": "text", "text": json.dumps({
                "success": False,
                "error": str(e)
            })}],
            "is_error": True
        }
