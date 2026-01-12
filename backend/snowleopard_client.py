"""Snow Leopard API client for querying SafeSF incident database."""

import os
import asyncio
import sqlite3
from typing import Optional
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

# Snow Leopard client
_client = None
_executor = ThreadPoolExecutor(max_workers=4)

# Path to local SQLite database (fallback)
DB_PATH = Path(__file__).parent.parent / "extract_sf_data" / "safesf.db"


def get_client():
    """Get or create Snow Leopard client instance."""
    global _client
    if _client is None:
        try:
            from snowleopard import SnowLeopardClient
            api_key = os.getenv("SNOWLEOPARD_API_KEY")
            if not api_key:
                raise ValueError("SNOWLEOPARD_API_KEY not set")
            _client = SnowLeopardClient(api_key=api_key)
        except ImportError:
            raise ImportError(
                "snowleopard package not installed. "
                "Install with: pip install snowleopard"
            )
    return _client


async def query_database(query: str, datafile_id: Optional[str] = None) -> dict:
    """
    Execute a natural language query against the SafeSF database.

    Args:
        query: Natural language query (e.g., "Show all violent crimes near lat 37.78, lng -122.41")
        datafile_id: Snow Leopard datafile ID (defaults to env var)

    Returns:
        dict with keys: sql, data, row_count, summary
    """
    client = get_client()
    datafile_id = datafile_id or os.getenv("SNOWLEOPARD_DATAFILE_ID")

    if not datafile_id:
        raise ValueError("SNOWLEOPARD_DATAFILE_ID not set")

    # Run blocking API call in executor
    loop = asyncio.get_event_loop()

    def _query():
        response = client.retrieve(
            user_query=query,
            datafile_id=datafile_id
        )
        return response

    response = await loop.run_in_executor(_executor, _query)

    # Parse response - handle both success and error responses
    if hasattr(response, 'data'):
        # Success response
        data = response.data if response.data else []
        result = {
            "sql": getattr(response, 'sql', ''),
            "data": data,
            "row_count": len(data),
            "summary": getattr(response, 'summary', ''),
        }
    else:
        # Error or empty response
        result = {
            "sql": "",
            "data": [],
            "row_count": 0,
            "summary": str(response) if response else "",
        }

    return result


def query_local_db(table: str, min_lat: float, max_lat: float, min_lng: float, max_lng: float, days_back: int = 60, limit: int = 1000) -> list[dict]:
    """
    Query local SQLite database directly.

    Args:
        table: Table name (violent_crimes, property_crimes, encampments, traffic_injuries)
        min_lat, max_lat, min_lng, max_lng: Bounding box coordinates
        days_back: Only include incidents from the last N days (ignored for encampments)
        limit: Max rows to return

    Returns:
        List of incident dicts with _source_table field added
    """
    if not DB_PATH.exists():
        print(f"Local database not found at {DB_PATH}")
        return []

    try:
        conn = sqlite3.connect(str(DB_PATH))
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # Encampments should always be shown regardless of date
        # They tend to persist and the data may be older but still relevant
        if table == "encampments":
            query = f"""
                SELECT * FROM {table}
                WHERE latitude >= ? AND latitude <= ?
                AND longitude >= ? AND longitude <= ?
                ORDER BY requested_datetime DESC
                LIMIT {limit}
            """
            cursor.execute(query, (min_lat, max_lat, min_lng, max_lng))
        else:
            # Calculate cutoff date for other incident types
            from datetime import datetime, timedelta
            cutoff_date = (datetime.now() - timedelta(days=days_back)).strftime("%Y-%m-%d")

            # Different tables have different datetime column names
            datetime_cols = {
                "violent_crimes": "incident_datetime",
                "property_crimes": "incident_datetime",
                "traffic_injuries": "collision_datetime",
            }
            datetime_col = datetime_cols.get(table, "incident_datetime")

            # Query with bounding box AND date filter
            query = f"""
                SELECT * FROM {table}
                WHERE latitude >= ? AND latitude <= ?
                AND longitude >= ? AND longitude <= ?
                AND {datetime_col} >= ?
                ORDER BY {datetime_col} DESC
                LIMIT {limit}
            """
            cursor.execute(query, (min_lat, max_lat, min_lng, max_lng, cutoff_date))

        rows = cursor.fetchall()
        conn.close()

        # Convert to list of dicts and add source table info
        results = []
        for row in rows:
            row_dict = dict(row)
            row_dict["_source_table"] = table
            results.append(row_dict)

        return results

    except Exception as e:
        print(f"Local DB query error for {table}: {e}")
        return []


async def query_incidents_near_point(
    lat: float,
    lng: float,
    radius_degrees: float = 0.002,  # ~200m
    days_back: int = 60,
    table: str = "violent_crimes"
) -> dict:
    """
    Query incidents near a specific coordinate.

    Args:
        lat: Latitude
        lng: Longitude
        radius_degrees: Search radius in degrees (0.001 ~ 100m, 0.01 ~ 1km)
        days_back: Number of days to look back
        table: Table to query (violent_crimes, property_crimes, encampments, traffic_injuries)

    Returns:
        dict with incident data
    """
    query = f"""
    Show all {table} within {radius_degrees} degrees of
    latitude {lat} and longitude {lng}
    from the last {days_back} days
    """

    return await query_database(query.strip())


async def query_route_corridor(
    waypoints: list[tuple[float, float]],
    radius_degrees: float = 0.002,
    days_back: int = 60
) -> dict:
    """
    Query all incident types along a route corridor.
    Uses local SQLite database directly (faster and more reliable).

    Args:
        waypoints: List of (lat, lng) tuples defining the route
        radius_degrees: Search radius around route
        days_back: Number of days to look back

    Returns:
        dict with aggregated incident data for the route
    """
    # Sample waypoints to reduce queries (every 3rd point or so)
    sampled = waypoints[::3] if len(waypoints) > 10 else waypoints

    # Build coordinate bounds for the route
    lats = [w[0] for w in sampled]
    lngs = [w[1] for w in sampled]

    min_lat = min(lats) - radius_degrees
    max_lat = max(lats) + radius_degrees
    min_lng = min(lngs) - radius_degrees
    max_lng = max(lngs) + radius_degrees

    # Query each incident type
    tables = ["violent_crimes", "property_crimes", "encampments", "traffic_injuries"]

    results = {
        "incidents_by_type": {},
        "all_incidents": [],
        "total_count": 0,
    }

    # First try local SQLite database (faster and more reliable)
    if DB_PATH.exists():
        print(f"Using local database: {DB_PATH} (last {days_back} days)")
        loop = asyncio.get_event_loop()

        for table in tables:
            try:
                # Run SQLite query in executor to not block
                # Use lambda to pass days_back parameter
                incidents = await loop.run_in_executor(
                    _executor,
                    lambda t=table: query_local_db(t, min_lat, max_lat, min_lng, max_lng, days_back)
                )

                results["incidents_by_type"][table] = {
                    "count": len(incidents),
                    "data": incidents,
                }
                results["all_incidents"].extend(incidents)
                results["total_count"] += len(incidents)
                print(f"  {table}: {len(incidents)} incidents found")

            except Exception as e:
                print(f"Local query error for {table}: {e}")
                results["incidents_by_type"][table] = {"count": 0, "data": []}

        return results

    # Fallback to Snow Leopard API if local DB not available
    print("Local database not found, trying Snow Leopard API...")

    async def query_table(table: str):
        query = f"""
        Show all {table} where
        latitude >= {min_lat} AND latitude <= {max_lat} AND
        longitude >= {min_lng} AND longitude <= {max_lng}
        from the last {days_back} days
        """
        return table, await query_database(query.strip())

    # Run queries in parallel
    tasks = [query_table(table) for table in tables]
    query_results = await asyncio.gather(*tasks, return_exceptions=True)

    for result in query_results:
        if isinstance(result, Exception):
            print(f"Query error: {result}")
            continue

        table, data = result
        incidents = data.get("data", [])
        results["incidents_by_type"][table] = {
            "count": len(incidents),
            "data": incidents,
        }
        results["all_incidents"].extend(incidents)
        results["total_count"] += len(incidents)

    return results


def extract_coordinates(incidents: list[dict]) -> list[dict]:
    """
    Extract coordinates from incident data.

    Args:
        incidents: List of incident records

    Returns:
        List of dicts with lat, lng, and incident info
    """
    coords = []
    for incident in incidents:
        lat = incident.get("latitude") or incident.get("lat")
        lng = incident.get("longitude") or incident.get("lng") or incident.get("long")

        if lat and lng:
            try:
                # Handle different field names across tables
                # violent_crimes/property_crimes use: incident_category, incident_description
                # encampments use: service_subtype
                category = (
                    incident.get("incident_category") or
                    incident.get("service_subtype") or
                    incident.get("category") or
                    incident.get("_source_table", "Unknown")
                )

                description = (
                    incident.get("incident_description") or
                    incident.get("incident_subcategory") or
                    incident.get("status_description") or
                    incident.get("description", "")
                )

                coords.append({
                    "lat": float(lat),
                    "lng": float(lng),
                    "category": category,
                    "description": description,
                    "date": incident.get("incident_datetime") or incident.get("requested_datetime") or "",
                    "neighborhood": incident.get("analysis_neighborhood") or "",
                })
            except (ValueError, TypeError):
                continue

    return coords
