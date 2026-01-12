"""SafeWalk SF Backend API Server.

This FastAPI server provides safety data for the SafeWalk SF application.
It integrates with:
- Pre-defined danger zones based on SF crime data analysis
- SF Open Data API for real-time incident data
- AI-powered safety analysis (optional, with Anthropic API key)
"""

import os
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

import time

from models import (
    Coordinate,
    DangerDataResponse,
    DangerZone,
    DangerSpot,
    Incident,
    IncidentQueryRequest,
    SafetyScoreRequest,
    SafetyScoreResponse,
    NaturalQueryRequest,
    NaturalQueryResponse,
    Severity,
    AnalyzeRoutesRequest,
    AnalyzeRoutesResponse,
    RouteAnalysisResult,
    IncidentLocation,
    Hotspot,
    IncidentCounts,
    RouteMetrics,
)
from danger_zones import (
    DANGER_ZONES,
    DANGER_SPOTS,
    get_danger_zones_for_route,
    get_danger_spots_for_route,
    get_distance_km,
)
from sf_opendata import fetch_police_incidents, fetch_encampment_reports

# Load environment variables
load_dotenv()

# Optional: Anthropic API for AI-powered queries
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    print("SafeWalk SF Backend starting...")
    print(f"  - Loaded {len(DANGER_ZONES)} danger zones")
    print(f"  - Loaded {len(DANGER_SPOTS)} danger spots")
    print(f"  - Anthropic API: {'configured' if ANTHROPIC_API_KEY else 'not configured'}")
    yield
    print("SafeWalk SF Backend shutting down...")


app = FastAPI(
    title="SafeWalk SF API",
    description="API for San Francisco pedestrian safety data",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS configuration for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite dev server
        "http://localhost:5174",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================================================================
# Health Check
# =============================================================================

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "safewalk-sf-backend",
        "danger_zones_loaded": len(DANGER_ZONES),
        "danger_spots_loaded": len(DANGER_SPOTS),
    }


# =============================================================================
# Danger Data Endpoints
# =============================================================================

@app.get("/api/danger-data", response_model=DangerDataResponse)
async def get_danger_data(
    start_lat: float = Query(..., description="Start location latitude"),
    start_lng: float = Query(..., description="Start location longitude"),
    end_lat: float = Query(..., description="End location latitude"),
    end_lng: float = Query(..., description="End location longitude"),
    radius_km: float = Query(2.5, description="Search radius in kilometers"),
):
    """
    Get danger zones and spots relevant to a route.

    Returns pre-defined danger areas based on SF crime data analysis
    that fall within the specified radius of the route corridor.
    """
    zones = get_danger_zones_for_route(start_lat, start_lng, end_lat, end_lng, radius_km)
    spots = get_danger_spots_for_route(start_lat, start_lng, end_lat, end_lng, radius_km)

    return DangerDataResponse(
        dangerZones=zones,
        dangerSpots=spots,
    )


@app.get("/api/danger-zones", response_model=list[DangerZone])
async def get_all_danger_zones():
    """Get all pre-defined danger zones in SF."""
    return DANGER_ZONES


@app.get("/api/danger-spots", response_model=list[DangerSpot])
async def get_all_danger_spots():
    """Get all pre-defined danger spots in SF."""
    return DANGER_SPOTS


# =============================================================================
# Real-time Incident Endpoints (SF Open Data)
# =============================================================================

@app.get("/api/incidents", response_model=list[Incident])
async def get_incidents(
    lat: float = Query(..., description="Center latitude"),
    lng: float = Query(..., description="Center longitude"),
    radius_km: float = Query(2.0, description="Search radius in kilometers"),
    days_back: int = Query(30, description="Number of days to look back"),
    include_encampments: bool = Query(True, description="Include 311 encampment reports"),
):
    """
    Fetch real-time incidents from SF Open Data.

    Returns police incidents and optionally 311 encampment reports
    near the specified location.
    """
    incidents = []

    # Fetch police incidents
    police_incidents = await fetch_police_incidents(
        lat=lat,
        lng=lng,
        radius_km=radius_km,
        days_back=days_back,
    )
    incidents.extend(police_incidents)

    # Optionally fetch encampment reports
    if include_encampments:
        encampment_reports = await fetch_encampment_reports(
            lat=lat,
            lng=lng,
            radius_km=radius_km,
            days_back=min(days_back, 30),  # 311 data usually more recent
        )
        incidents.extend(encampment_reports)

    # Sort by date descending
    incidents.sort(key=lambda x: x.date, reverse=True)

    return incidents


@app.post("/api/incidents/query", response_model=list[Incident])
async def query_incidents(request: IncidentQueryRequest):
    """
    Query incidents within a route corridor.

    Fetches incidents along the route from start to end location.
    """
    # Calculate route midpoint for broader search
    mid_lat = (request.start_lat + request.end_lat) / 2
    mid_lng = (request.start_lng + request.end_lng) / 2

    incidents = await fetch_police_incidents(
        lat=mid_lat,
        lng=mid_lng,
        radius_km=request.radius_km * 1.5,  # Expand search area
        days_back=request.days_back,
    )

    # Filter to only include incidents near the route
    filtered = []
    for incident in incidents:
        if is_near_route_corridor(
            incident.coordinate.lat,
            incident.coordinate.lng,
            request.start_lat,
            request.start_lng,
            request.end_lat,
            request.end_lng,
            request.radius_km,
        ):
            if request.categories is None or incident.category in request.categories:
                filtered.append(incident)

    return filtered


def is_near_route_corridor(
    lat: float, lng: float,
    start_lat: float, start_lng: float,
    end_lat: float, end_lng: float,
    radius_km: float,
) -> bool:
    """Check if a point is within the route corridor."""
    # Check distance to start, end, and midpoint
    d1 = get_distance_km(lat, lng, start_lat, start_lng)
    d2 = get_distance_km(lat, lng, end_lat, end_lng)
    mid_lat = (start_lat + end_lat) / 2
    mid_lng = (start_lng + end_lng) / 2
    d3 = get_distance_km(lat, lng, mid_lat, mid_lng)

    return min(d1, d2, d3) <= radius_km


# =============================================================================
# Safety Score Endpoint
# =============================================================================

@app.post("/api/safety-score", response_model=SafetyScoreResponse)
async def calculate_safety_score(request: SafetyScoreRequest):
    """
    Calculate a safety score for a route based on nearby incidents and danger zones.

    Returns a score from 0-10 (10 being safest) along with incident breakdown.
    """
    if not request.waypoints:
        raise HTTPException(status_code=400, detail="Waypoints required")

    # Calculate route bounds
    lats = [wp.lat for wp in request.waypoints]
    lngs = [wp.lng for wp in request.waypoints]
    center_lat = sum(lats) / len(lats)
    center_lng = sum(lngs) / len(lngs)

    # Count danger zones along route
    zone_penalties = 0
    zones_crossed = []

    for zone in DANGER_ZONES:
        zone_center_lat = sum(c.lat for c in zone.coordinates) / len(zone.coordinates)
        zone_center_lng = sum(c.lng for c in zone.coordinates) / len(zone.coordinates)

        for wp in request.waypoints:
            if get_distance_km(wp.lat, wp.lng, zone_center_lat, zone_center_lng) < 0.5:
                if zone.severity == Severity.HIGH:
                    zone_penalties += 3
                elif zone.severity == Severity.MEDIUM:
                    zone_penalties += 1.5
                else:
                    zone_penalties += 0.5
                zones_crossed.append(zone.name)
                break

    # Count danger spots along route
    spot_penalties = 0
    spots_near = []

    for spot in DANGER_SPOTS:
        for wp in request.waypoints:
            if get_distance_km(wp.lat, wp.lng, spot.coordinate.lat, spot.coordinate.lng) < 0.3:
                if spot.severity == Severity.HIGH:
                    spot_penalties += 1.5
                elif spot.severity == Severity.MEDIUM:
                    spot_penalties += 0.75
                else:
                    spot_penalties += 0.25
                spots_near.append(spot.name)
                break

    # Calculate base score
    total_penalty = zone_penalties + spot_penalties
    base_score = max(0, 10 - total_penalty)

    # Generate recommendations
    recommendations = []
    if zone_penalties > 0:
        recommendations.append(f"Route passes through {len(set(zones_crossed))} high-risk area(s)")
    if spot_penalties > 0:
        recommendations.append(f"Be cautious near: {', '.join(list(set(spots_near))[:3])}")
    if base_score >= 8:
        recommendations.append("This route avoids major danger zones")
    if base_score < 5:
        recommendations.append("Consider an alternative route if possible")

    return SafetyScoreResponse(
        score=round(base_score, 1),
        incident_count=len(zones_crossed) + len(spots_near),
        breakdown={
            "danger_zones_crossed": len(set(zones_crossed)),
            "danger_spots_nearby": len(set(spots_near)),
        },
        recommendations=recommendations,
    )


# =============================================================================
# Natural Language Query Endpoint (requires Anthropic API)
# =============================================================================

@app.post("/api/query", response_model=NaturalQueryResponse)
async def natural_language_query(request: NaturalQueryRequest):
    """
    Process a natural language safety query.

    Uses AI to understand the query and return relevant safety information.
    Requires ANTHROPIC_API_KEY to be configured.
    """
    if not ANTHROPIC_API_KEY:
        # Fallback: simple keyword matching
        return await simple_query_handler(request)

    try:
        import anthropic

        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

        # Build context about SF danger zones
        zone_context = "\n".join([
            f"- {z.name}: {z.category} ({z.severity.value} severity) - {z.description}"
            for z in DANGER_ZONES
        ])

        prompt = f"""You are a San Francisco safety expert. Answer the user's question about safety in SF.

Known danger areas:
{zone_context}

User question: {request.query}
User location: {f"lat={request.user_lat}, lng={request.user_lng}" if request.user_lat else "not provided"}

Provide a helpful, concise answer about safety. Include specific locations and recommendations."""

        response = client.messages.create(
            model="claude-3-haiku-20240307",
            max_tokens=500,
            messages=[{"role": "user", "content": prompt}],
        )

        answer = response.content[0].text

        # Extract relevant coordinates from the answer
        relevant_coords = []
        relevant_incidents = []

        # Check if any danger zones are mentioned
        for zone in DANGER_ZONES:
            if zone.name.lower() in answer.lower():
                center_lat = sum(c.lat for c in zone.coordinates) / len(zone.coordinates)
                center_lng = sum(c.lng for c in zone.coordinates) / len(zone.coordinates)
                relevant_coords.append(Coordinate(lat=center_lat, lng=center_lng))

        return NaturalQueryResponse(
            answer=answer,
            incidents=relevant_incidents,
            safety_score=None,
            coordinates=relevant_coords,
        )

    except Exception as e:
        print(f"AI query error: {e}")
        return await simple_query_handler(request)


async def simple_query_handler(request: NaturalQueryRequest) -> NaturalQueryResponse:
    """Simple keyword-based query handler as fallback."""
    query_lower = request.query.lower()

    # Find relevant danger zones based on keywords
    relevant_zones = []
    for zone in DANGER_ZONES:
        if (zone.name.lower() in query_lower or
            zone.category.lower() in query_lower or
            any(word in query_lower for word in zone.name.lower().split())):
            relevant_zones.append(zone)

    if relevant_zones:
        answer = f"Based on your query about '{request.query}':\n\n"
        for zone in relevant_zones[:3]:
            answer += f"**{zone.name}** ({zone.severity.value} risk): {zone.description}\n\n"
    else:
        answer = f"I found information about {len(DANGER_ZONES)} danger areas in SF. "
        answer += "The highest risk areas include the Tenderloin, Civic Center, and 6th Street Corridor. "
        answer += "Please specify a location or area for more detailed information."

    coords = []
    for zone in relevant_zones[:3]:
        center_lat = sum(c.lat for c in zone.coordinates) / len(zone.coordinates)
        center_lng = sum(c.lng for c in zone.coordinates) / len(zone.coordinates)
        coords.append(Coordinate(lat=center_lat, lng=center_lng))

    return NaturalQueryResponse(
        answer=answer,
        incidents=[],
        safety_score=None,
        coordinates=coords,
    )


# =============================================================================
# Snow Leopard Route Analysis Endpoint
# =============================================================================

# Snow Leopard configuration
SNOWLEOPARD_API_KEY = os.getenv("SNOWLEOPARD_API_KEY")
SNOWLEOPARD_DATAFILE_ID = os.getenv("SNOWLEOPARD_DATAFILE_ID")


@app.post("/api/analyze-routes", response_model=AnalyzeRoutesResponse)
async def analyze_routes(request: AnalyzeRoutesRequest):
    """
    Analyze safety of multiple routes using real incident data from Snow Leopard.

    This endpoint queries the SafeSF database for actual crime, encampment,
    and traffic incident data along each route corridor.

    Returns safety scores, incident counts, hotspots, and recommendations
    based on real data.
    """
    start_time = time.time()

    # Check if Snow Leopard is configured
    if not SNOWLEOPARD_API_KEY or not SNOWLEOPARD_DATAFILE_ID:
        # Fall back to static analysis if Snow Leopard not configured
        return await fallback_route_analysis(request)

    try:
        from route_analyzer import analyze_multiple_routes

        # Convert radius from meters to degrees (approx)
        radius_degrees = request.radius_meters / 111000  # 1 degree ~ 111km

        # Analyze all routes
        analyses = await analyze_multiple_routes(
            routes=[
                {
                    "id": route.id,
                    "name": route.name,
                    "waypoints": route.waypoints,
                }
                for route in request.routes
            ],
            days_back=request.days_back,
            radius_degrees=radius_degrees,
        )

        # Convert to response format
        route_results = []
        for analysis in analyses:
            route_results.append(RouteAnalysisResult(
                id=analysis.route_id,
                name=analysis.route_name,
                safetyScore=analysis.safety_score,
                rating=analysis.rating,
                ratingColor=analysis.rating_color,
                incidents=IncidentCounts(
                    violent_crimes=analysis.incidents.get("violent_crimes", 0),
                    property_crimes=analysis.incidents.get("property_crimes", 0),
                    encampments=analysis.incidents.get("encampments", 0),
                    traffic_injuries=analysis.incidents.get("traffic_injuries", 0),
                ),
                incidentLocations=[
                    IncidentLocation(
                        lat=loc["lat"],
                        lng=loc["lng"],
                        category=loc.get("category", "Unknown"),
                        description=loc.get("description", ""),
                        date=loc.get("date", ""),
                        neighborhood=loc.get("neighborhood", ""),
                    )
                    for loc in analysis.incident_locations
                ],
                hotspots=[
                    Hotspot(
                        lat=h["lat"],
                        lng=h["lng"],
                        count=h["count"],
                        category=h.get("category", "Unknown"),
                        name=h.get("name", "Hotspot"),
                        radius_m=h.get("radius_m", 50),  # Use calculated radius
                    )
                    for h in analysis.hotspots
                ],
                pros=analysis.pros,
                cons=analysis.cons,
                recommendations=analysis.recommendations,
                metrics=RouteMetrics(
                    violent_per_km=analysis.metrics.get("violent_per_km", 0) if analysis.metrics else 0,
                    property_per_km=analysis.metrics.get("property_per_km", 0) if analysis.metrics else 0,
                    encampment_per_km=analysis.metrics.get("encampment_per_km", 0) if analysis.metrics else 0,
                    traffic_per_km=analysis.metrics.get("traffic_per_km", 0) if analysis.metrics else 0,
                    route_length_km=analysis.metrics.get("route_length_km", 0) if analysis.metrics else 0,
                    lighting_score=analysis.metrics.get("lighting_score", 50) if analysis.metrics else 50,
                    crowd_score=analysis.metrics.get("crowd_score", 50) if analysis.metrics else 50,
                    police_presence_score=analysis.metrics.get("police_presence_score", 50) if analysis.metrics else 50,
                ) if analysis.metrics else None,
            ))

        elapsed_ms = int((time.time() - start_time) * 1000)

        return AnalyzeRoutesResponse(
            routes=route_results,
            queryTimeMs=elapsed_ms,
        )

    except ImportError as e:
        print(f"Snow Leopard import error: {e}")
        return await fallback_route_analysis(request)
    except Exception as e:
        print(f"Route analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


async def fallback_route_analysis(request: AnalyzeRoutesRequest) -> AnalyzeRoutesResponse:
    """
    Fallback route analysis using static danger zone data.
    Used when Snow Leopard is not configured.
    """
    start_time = time.time()
    route_results = []

    for route in request.routes:
        # Calculate route bounds
        lats = [wp[0] for wp in route.waypoints]
        lngs = [wp[1] for wp in route.waypoints]
        center_lat = sum(lats) / len(lats)
        center_lng = sum(lngs) / len(lngs)

        # Count danger zones crossed
        zones_crossed = []
        zone_penalty = 0

        for zone in DANGER_ZONES:
            zone_center_lat = sum(c.lat for c in zone.coordinates) / len(zone.coordinates)
            zone_center_lng = sum(c.lng for c in zone.coordinates) / len(zone.coordinates)

            for wp in route.waypoints:
                if get_distance_km(wp[0], wp[1], zone_center_lat, zone_center_lng) < 0.5:
                    zones_crossed.append(zone)
                    if zone.severity == Severity.HIGH:
                        zone_penalty += 15
                    elif zone.severity == Severity.MEDIUM:
                        zone_penalty += 8
                    else:
                        zone_penalty += 3
                    break

        # Calculate safety score
        safety_score = max(0, min(100, 100 - zone_penalty))

        # Determine rating
        if safety_score >= 80:
            rating, color = "Safe", "green"
        elif safety_score >= 60:
            rating, color = "Generally Safe", "yellow"
        elif safety_score >= 40:
            rating, color = "Caution", "orange"
        else:
            rating, color = "High Risk", "red"

        # Generate pros/cons
        pros = ["Route analyzed using cached safety data"]
        cons = []

        if len(zones_crossed) > 0:
            cons.append(f"Passes through {len(zones_crossed)} known danger zone(s)")
            for zone in zones_crossed[:2]:
                cons.append(f"{zone.name}: {zone.description[:50]}...")
        else:
            pros.append("Avoids known high-crime areas")

        route_results.append(RouteAnalysisResult(
            id=route.id,
            name=route.name,
            safetyScore=safety_score,
            rating=rating,
            ratingColor=color,
            incidents=IncidentCounts(),
            incidentLocations=[],
            hotspots=[],
            pros=pros,
            cons=cons if cons else ["Standard urban environment"],
            recommendations=["Connect Snow Leopard API for real-time data"],
        ))

    elapsed_ms = int((time.time() - start_time) * 1000)

    return AnalyzeRoutesResponse(
        routes=route_results,
        queryTimeMs=elapsed_ms,
    )


# =============================================================================
# Run with: uvicorn main:app --reload --port 8000
# =============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
