"""San Francisco Open Data API integration."""

import httpx
from typing import Optional
from datetime import datetime, timedelta
from models import Coordinate, Incident, Severity

# SF Open Data API endpoints
SF_DATA_ENDPOINTS = {
    "police_incidents": "https://data.sfgov.org/resource/wg3w-h783.json",
    "311_cases": "https://data.sfgov.org/resource/vw6y-z8j6.json",
}

# App token for higher rate limits (optional)
SF_APP_TOKEN = None


async def fetch_police_incidents(
    lat: float,
    lng: float,
    radius_km: float = 2.0,
    days_back: int = 60,
    limit: int = 500
) -> list[Incident]:
    """Fetch recent police incidents near a location."""
    incidents = []

    # Calculate date range
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days_back)

    # SoQL query with location filter
    # Using a bounding box approximation (1 degree ~ 111km)
    lat_delta = radius_km / 111.0
    lng_delta = radius_km / (111.0 * abs(cos(lat * 3.14159 / 180)))

    query = f"""
        $where=incident_date >= '{start_date.strftime('%Y-%m-%d')}'
        AND latitude >= {lat - lat_delta}
        AND latitude <= {lat + lat_delta}
        AND longitude >= {lng - lng_delta}
        AND longitude <= {lng + lng_delta}
        &$limit={limit}
        &$order=incident_date DESC
    """.replace('\n', '').replace('  ', '')

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            headers = {}
            if SF_APP_TOKEN:
                headers["X-App-Token"] = SF_APP_TOKEN

            response = await client.get(
                SF_DATA_ENDPOINTS["police_incidents"],
                params={"$query": query},
                headers=headers
            )

            if response.status_code == 200:
                data = response.json()
                for item in data:
                    try:
                        incident = parse_police_incident(item)
                        if incident:
                            incidents.append(incident)
                    except Exception as e:
                        continue
    except Exception as e:
        print(f"Error fetching police incidents: {e}")

    return incidents


def parse_police_incident(item: dict) -> Optional[Incident]:
    """Parse a police incident from SF Open Data."""
    try:
        lat = float(item.get("latitude", 0))
        lng = float(item.get("longitude", 0))

        if lat == 0 or lng == 0:
            return None

        category = item.get("incident_category", "Unknown")
        description = item.get("incident_description", "")

        # Determine severity based on category
        severity = Severity.MEDIUM
        high_severity_categories = [
            "Homicide", "Robbery", "Assault", "Weapons",
            "Sex Offenses", "Kidnapping"
        ]
        low_severity_categories = [
            "Non-Criminal", "Miscellaneous", "Warrant"
        ]

        if any(cat in category for cat in high_severity_categories):
            severity = Severity.HIGH
        elif any(cat in category for cat in low_severity_categories):
            severity = Severity.LOW

        return Incident(
            id=item.get("incident_id", item.get("row_id", "")),
            category=category,
            description=description,
            date=item.get("incident_date", "")[:10],
            time=item.get("incident_time", None),
            coordinate=Coordinate(lat=lat, lng=lng),
            severity=severity,
            neighborhood=item.get("analysis_neighborhood", None)
        )
    except Exception:
        return None


async def fetch_encampment_reports(
    lat: float,
    lng: float,
    radius_km: float = 2.0,
    days_back: int = 30,
    limit: int = 200
) -> list[Incident]:
    """Fetch homeless encampment reports from 311."""
    incidents = []

    end_date = datetime.now()
    start_date = end_date - timedelta(days=days_back)

    lat_delta = radius_km / 111.0
    lng_delta = radius_km / 85.0  # Approximate for SF latitude

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                SF_DATA_ENDPOINTS["311_cases"],
                params={
                    "$where": f"service_name LIKE '%Encampment%' AND requested_datetime >= '{start_date.strftime('%Y-%m-%dT00:00:00')}' AND lat >= {lat - lat_delta} AND lat <= {lat + lat_delta} AND long >= {lng - lng_delta} AND long <= {lng + lng_delta}",
                    "$limit": limit,
                    "$order": "requested_datetime DESC"
                }
            )

            if response.status_code == 200:
                data = response.json()
                for item in data:
                    try:
                        lat_val = float(item.get("lat", 0))
                        lng_val = float(item.get("long", 0))

                        if lat_val == 0 or lng_val == 0:
                            continue

                        incidents.append(Incident(
                            id=item.get("service_request_id", ""),
                            category="Homeless Encampment",
                            description=item.get("service_details", "Encampment reported"),
                            date=item.get("requested_datetime", "")[:10],
                            coordinate=Coordinate(lat=lat_val, lng=lng_val),
                            severity=Severity.MEDIUM,
                            neighborhood=item.get("neighborhoods_sffind_boundaries", None)
                        ))
                    except Exception:
                        continue
    except Exception as e:
        print(f"Error fetching encampment reports: {e}")

    return incidents


from math import cos
