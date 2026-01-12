"""Route safety analyzer using Snow Leopard incident data."""

import asyncio
from typing import Optional
from dataclasses import dataclass
from collections import defaultdict
import math

from snowleopard_client import query_route_corridor, extract_coordinates


# Severity weights for safety score calculation
SEVERITY_WEIGHTS = {
    # Violent crimes (highest weight)
    "homicide": 100,
    "rape": 90,
    "robbery": 70,
    "assault": 60,
    "aggravated assault": 60,
    "weapons": 50,
    "weapons offense": 50,

    # Property crimes (medium weight)
    "burglary": 40,
    "motor vehicle theft": 35,
    "vehicle theft": 35,
    "larceny theft": 25,
    "theft": 25,

    # Other (lower weight)
    "encampment": 20,
    "homeless encampment": 20,
    "traffic injury": 15,
    "traffic_injury": 15,
}

# Rating thresholds (0-10 scale)
RATING_THRESHOLDS = [
    (7.0, "Safe", "green"),
    (5.0, "Generally Safe", "yellow"),
    (3.0, "Caution", "orange"),
    (0, "High Risk", "red"),
]


@dataclass
class RouteAnalysis:
    """Analysis result for a single route."""
    route_id: str
    route_name: str
    safety_score: float
    rating: str
    rating_color: str
    incidents: dict
    incident_locations: list
    hotspots: list
    pros: list
    cons: list
    recommendations: list
    metrics: dict = None  # Detailed metrics for UI


def get_distance_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate distance between two coordinates in km."""
    R = 6371  # Earth's radius in km
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lng = math.radians(lng2 - lng1)

    a = math.sin(delta_lat / 2) ** 2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lng / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c


def is_near_route(
    lat: float,
    lng: float,
    waypoints: list[tuple[float, float]],
    max_distance_km: float = 0.3
) -> bool:
    """Check if a point is within max_distance_km of any waypoint."""
    for wp_lat, wp_lng in waypoints:
        if get_distance_km(lat, lng, wp_lat, wp_lng) <= max_distance_km:
            return True
    return False


def calculate_safety_score(incidents_by_type: dict, route_length_km: float = 1.0) -> tuple[float, dict]:
    """
    Calculate safety score on a 0-10 scale based on incident density and total exposure.

    The score considers:
    1. Per-km density: How dangerous is each step you take?
    2. Total exposure: How many incidents will you walk past in total?

    10.0 = safest, 0.0 = most dangerous
    """
    import math

    # Count incidents by severity category
    violent_count = 0
    property_count = 0
    encampment_count = 0
    traffic_count = 0

    for incident_type, data in incidents_by_type.items():
        count = data.get("count", 0)
        if incident_type == "violent_crimes":
            violent_count = count
        elif incident_type == "property_crimes":
            property_count = count
        elif incident_type == "encampments":
            encampment_count = count
        elif incident_type == "traffic_injuries":
            traffic_count = count

    total_count = violent_count + property_count + encampment_count + traffic_count

    # Normalize per kilometer (minimum 0.3km to avoid division issues)
    effective_length = max(0.3, route_length_km)

    # Calculate incidents per kilometer for each type
    violent_per_km = violent_count / effective_length
    property_per_km = property_count / effective_length
    encampment_per_km = encampment_count / effective_length
    traffic_per_km = traffic_count / effective_length

    # === SCORE CALCULATION (0-10 scale) ===
    # Use logarithmic decay for better differentiation at all crime levels
    # This ensures we don't hit the floor even in high-crime areas
    #
    # Target scoring:
    # - 0 violent/km = ~9.5
    # - 5 violent/km = ~7
    # - 15 violent/km = ~5
    # - 30 violent/km = ~3
    # - 50+ violent/km = ~2

    # Calculate a combined crime score using weighted incidents
    # Higher weight = more impact on score
    combined_crime = (
        violent_per_km * 1.0 +       # Violent crime has full weight
        property_per_km * 0.3 +      # Property crime has 30% weight
        encampment_per_km * 0.4 +    # Encampments have 40% weight
        traffic_per_km * 0.2         # Traffic has 20% weight
    )

    # Use logarithmic scaling for smoother differentiation
    # Formula: score = 10 - k * log(1 + crime_rate)
    # This gives us good spread across all crime levels
    if combined_crime <= 0:
        density_score = 9.5
    else:
        # Log scaling: gentle slope that never hits zero
        density_score = max(1.0, 10.0 - 2.5 * math.log(1 + combined_crime / 5))

    # === TOTAL EXPOSURE PENALTY ===
    # Small penalty for high total incidents (caps at 1.5 points)
    total_weighted = (
        violent_count * 0.03 +
        property_count * 0.01 +
        encampment_count * 0.02 +
        traffic_count * 0.005
    )
    exposure_penalty = min(1.5, total_weighted * 0.01)

    # === FINAL SCORE ===
    final_score = density_score - exposure_penalty

    # Clamp to 1.0 - 9.5 range (keep differentiation even in worst areas)
    final_score = max(1.0, min(9.5, final_score))

    # Calculate detailed metrics for UI
    # Use violent crime as proxy for area danger (since encampment data may be old)
    # High violent crime areas typically have: poor lighting, fewer crowds, variable police presence

    # Lighting: high crime = poor lighting (inverse relationship, steeper decay)
    lighting_score = max(0, min(100, 100 - violent_per_km * 4 - property_per_km * 1.5))

    # Crowd level: high crime = isolated areas (inverse relationship)
    # Also factor in encampments if available
    crowd_score = max(0, min(100, 100 - violent_per_km * 3 - encampment_per_km * 5))

    # Police presence: mixed - more police in high crime areas but still risky
    # High crime areas have more patrols but that doesn't make them safe
    police_score = max(20, min(80, 60 - violent_per_km * 1.5 + property_per_km * 0.3))

    metrics = {
        "violent_per_km": round(violent_per_km, 1),
        "property_per_km": round(property_per_km, 1),
        "encampment_per_km": round(encampment_per_km, 1),
        "traffic_per_km": round(traffic_per_km, 1),
        "route_length_km": round(route_length_km, 2),
        "lighting_score": round(lighting_score, 1),
        "crowd_score": round(crowd_score, 1),
        "police_presence_score": round(police_score, 1),
    }

    return round(final_score, 1), metrics


def get_rating(score: float) -> tuple[str, str]:
    """Get rating name and color from score."""
    for threshold, name, color in RATING_THRESHOLDS:
        if score >= threshold:
            return name, color
    return "High Risk", "red"


def identify_hotspots(
    incidents: list[dict],
    min_incidents: int = 5,
    base_radius_m: float = 30,
    max_radius_m: float = 150,
) -> list[dict]:
    """
    Identify incident hotspots using density-based clustering.
    Hotspots don't overlap and radius is proportional to incident count.

    Args:
        incidents: List of incident dicts with lat/lng
        min_incidents: Minimum incidents to qualify as hotspot
        base_radius_m: Base radius in meters for smallest hotspot
        max_radius_m: Maximum radius in meters

    Returns:
        List of non-overlapping hotspots with coordinates, counts, and radius.
    """
    # First, collect all valid coordinates
    points = []
    for incident in incidents:
        # Handle different field names from different tables
        lat = incident.get("latitude") or incident.get("lat")
        lng = incident.get("longitude") or incident.get("lng")

        if lat and lng:
            try:
                lat = float(lat)
                lng = float(lng)
                # Get category from various possible field names
                category = (
                    incident.get("incident_category") or
                    incident.get("service_subtype") or
                    incident.get("_source_table", "").replace("_", " ").title() or
                    "Incident"
                )
                neighborhood = incident.get("analysis_neighborhood") or ""
                points.append({"lat": lat, "lng": lng, "category": category, "neighborhood": neighborhood})
            except (ValueError, TypeError):
                continue

    if len(points) < min_incidents:
        return []

    # Grid-based density estimation
    grid_size = 0.0015  # ~150m grid for finer clustering
    grid = defaultdict(list)

    for point in points:
        grid_lat = round(point["lat"] / grid_size) * grid_size
        grid_lng = round(point["lng"] / grid_size) * grid_size
        grid[(grid_lat, grid_lng)].append(point)

    # Create candidate hotspots from dense grid cells
    candidates = []
    for (lat, lng), cell_points in grid.items():
        if len(cell_points) >= min_incidents:
            # Calculate centroid of points in cell
            avg_lat = sum(p["lat"] for p in cell_points) / len(cell_points)
            avg_lng = sum(p["lng"] for p in cell_points) / len(cell_points)

            # Get most common category and neighborhood
            categories = defaultdict(int)
            neighborhoods = defaultdict(int)
            for p in cell_points:
                categories[p["category"]] += 1
                if p["neighborhood"]:
                    neighborhoods[p["neighborhood"]] += 1
            top_category = max(categories, key=categories.get)
            top_neighborhood = max(neighborhoods, key=neighborhoods.get) if neighborhoods else ""

            candidates.append({
                "lat": avg_lat,
                "lng": avg_lng,
                "count": len(cell_points),
                "category": top_category,
                "neighborhood": top_neighborhood,
            })

    # Sort by count descending (prioritize bigger hotspots)
    candidates.sort(key=lambda x: x["count"], reverse=True)

    # Find max count for proportional scaling
    max_count = max(c["count"] for c in candidates) if candidates else 1

    # Remove overlapping hotspots (greedy approach)
    import math

    final_hotspots = []

    for candidate in candidates:
        count = candidate["count"]

        # Calculate radius proportional to count
        # Use linear scaling: min_count -> base_radius, max_count -> max_radius
        if max_count > min_incidents:
            ratio = (count - min_incidents) / (max_count - min_incidents)
        else:
            ratio = 0
        radius_m = base_radius_m + ratio * (max_radius_m - base_radius_m)

        # Check if this hotspot overlaps with existing ones
        overlaps = False
        for existing in final_hotspots:
            dist = get_distance_km(
                candidate["lat"], candidate["lng"],
                existing["lat"], existing["lng"]
            ) * 1000  # Convert to meters

            # Check if circles overlap (sum of radii + small buffer)
            if dist < (radius_m + existing["radius_m"] + 20):
                overlaps = True
                break

        if not overlaps:
            # Generate descriptive name
            neighborhood = candidate["neighborhood"]
            category = candidate["category"]
            if neighborhood:
                hotspot_name = f"{neighborhood}: {category}"
            else:
                hotspot_name = f"{category} ({count} incidents)"

            final_hotspots.append({
                "lat": round(candidate["lat"], 6),
                "lng": round(candidate["lng"], 6),
                "count": count,
                "category": category,
                "name": hotspot_name,
                "radius_m": round(radius_m, 1),
            })

        # Limit to reasonable number
        if len(final_hotspots) >= 10:
            break

    return final_hotspots


def generate_pros_cons(
    incidents_by_type: dict,
    safety_score: float,
    hotspots: list[dict],
    metrics: dict = None
) -> tuple[list[str], list[str]]:
    """Generate pros and cons based on incident data and per-km metrics."""
    pros = []
    cons = []

    violent_count = incidents_by_type.get("violent_crimes", {}).get("count", 0)
    property_count = incidents_by_type.get("property_crimes", {}).get("count", 0)
    encampment_count = incidents_by_type.get("encampments", {}).get("count", 0)
    traffic_count = incidents_by_type.get("traffic_injuries", {}).get("count", 0)

    # Use per-km metrics if available (more meaningful for comparing routes)
    if metrics:
        violent_per_km = metrics.get("violent_per_km", 0)
        encampment_per_km = metrics.get("encampment_per_km", 0)
        route_km = metrics.get("route_length_km", 1)

        # Generate pros based on per-km rates
        if violent_per_km < 5:
            pros.append(f"Low crime density ({violent_per_km:.1f} violent incidents/km)")
        elif violent_per_km < 15:
            pros.append(f"Moderate crime density ({violent_per_km:.1f} violent/km)")

        if encampment_per_km < 5:
            pros.append("Few encampments along route")

        if safety_score >= 6:
            pros.append(f"Above-average safety score ({safety_score:.1f}/10)")

        # Generate cons based on per-km rates
        if violent_per_km >= 30:
            cons.append(f"High crime area ({violent_per_km:.0f} violent incidents/km)")
        elif violent_per_km >= 15:
            cons.append(f"Elevated crime density ({violent_per_km:.0f} violent/km)")

        if encampment_per_km >= 20:
            cons.append(f"Many encampments ({encampment_per_km:.0f}/km)")
        elif encampment_per_km >= 10:
            cons.append(f"Some encampments ({encampment_per_km:.0f}/km)")

    else:
        # Fallback to raw counts
        if violent_count == 0:
            pros.append("No violent crimes reported in past 60 days")
        elif violent_count < 5:
            pros.append(f"Low violent crime rate ({violent_count} incidents)")

        if encampment_count == 0:
            pros.append("No homeless encampments reported nearby")

        if safety_score >= 6:
            pros.append("Above-average safety rating")

        if violent_count >= 10:
            cons.append(f"{violent_count} violent crimes reported")

        if encampment_count >= 5:
            cons.append(f"{encampment_count} homeless encampments reported")

    # Hotspot warning
    if len(hotspots) > 0:
        top_hotspot = hotspots[0]
        cons.append(f"Hotspot: {top_hotspot['name']} ({top_hotspot['count']} incidents)")

    # Ensure at least one pro/con
    if not pros:
        pros.append("Standard urban environment")
    if not cons:
        cons.append("Stay aware of surroundings as in any city")

    return pros[:4], cons[:4]


def generate_recommendations(
    incidents_by_type: dict,
    safety_score: float,
    hotspots: list[dict]
) -> list[str]:
    """Generate safety recommendations based on analysis."""
    recommendations = []

    violent_count = incidents_by_type.get("violent_crimes", {}).get("count", 0)
    encampment_count = incidents_by_type.get("encampments", {}).get("count", 0)

    if safety_score < 4:
        recommendations.append("Consider an alternative route if possible")
        recommendations.append("Avoid walking alone, especially after dark")
    elif safety_score < 6:
        recommendations.append("Stay alert and aware of surroundings")
        recommendations.append("Stick to well-lit, busy streets")

    if violent_count >= 5:
        recommendations.append("Keep valuables hidden and stay in groups")

    if encampment_count >= 3:
        recommendations.append("Be prepared to cross streets to avoid encampments")

    if len(hotspots) > 0:
        recommendations.append("Identified hotspots are marked on map - stay alert near those areas")

    if not recommendations:
        recommendations.append("Standard urban safety awareness recommended")

    return recommendations[:5]


def calculate_route_length_km(waypoints: list[tuple[float, float]]) -> float:
    """Calculate total route length in kilometers."""
    if len(waypoints) < 2:
        return 0.0

    total_length = 0.0
    for i in range(len(waypoints) - 1):
        total_length += get_distance_km(
            waypoints[i][0], waypoints[i][1],
            waypoints[i + 1][0], waypoints[i + 1][1]
        )
    return total_length


def filter_incidents_near_route(
    incidents: list[dict],
    waypoints: list[tuple[float, float]],
    max_distance_km: float = 0.2
) -> list[dict]:
    """Filter incidents to only those within max_distance_km of route waypoints."""
    filtered = []
    for incident in incidents:
        lat = incident.get("latitude") or incident.get("lat")
        lng = incident.get("longitude") or incident.get("lng")
        if lat and lng:
            try:
                lat = float(lat)
                lng = float(lng)
                if is_near_route(lat, lng, waypoints, max_distance_km):
                    filtered.append(incident)
            except (ValueError, TypeError):
                continue
    return filtered


def count_incidents_by_type(incidents: list[dict]) -> dict:
    """Count incidents grouped by their source table."""
    counts = {
        "violent_crimes": {"count": 0, "data": []},
        "property_crimes": {"count": 0, "data": []},
        "encampments": {"count": 0, "data": []},
        "traffic_injuries": {"count": 0, "data": []},
    }

    for incident in incidents:
        source = incident.get("_source_table", "")
        if source in counts:
            counts[source]["count"] += 1
            counts[source]["data"].append(incident)

    return counts


async def analyze_route(
    route_id: str,
    route_name: str,
    waypoints: list[tuple[float, float]],
    days_back: int = 60,
    radius_degrees: float = 0.002
) -> RouteAnalysis:
    """
    Analyze safety of a single route.

    Args:
        route_id: Unique route identifier
        route_name: Display name of the route
        waypoints: List of (lat, lng) tuples defining the route
        days_back: Number of days to look back for incidents
        radius_degrees: Search radius around route

    Returns:
        RouteAnalysis with safety score, incidents, and recommendations
    """
    # Calculate route length for normalized scoring
    route_length_km = calculate_route_length_km(waypoints)
    print(f"Analyzing route '{route_name}': {route_length_km:.2f} km, {len(waypoints)} waypoints")

    # Query incidents along route corridor (uses bounding box)
    corridor_data = await query_route_corridor(
        waypoints=waypoints,
        radius_degrees=radius_degrees,
        days_back=days_back
    )

    all_incidents = corridor_data.get("all_incidents", [])

    # IMPORTANT: Filter to only incidents actually near THIS route's waypoints
    # This ensures different routes get different incident counts
    max_dist_km = radius_degrees * 111  # Convert degrees to km (~111 km per degree)
    route_incidents = filter_incidents_near_route(all_incidents, waypoints, max_dist_km)

    print(f"  Total in bounding box: {len(all_incidents)}, near route: {len(route_incidents)}")

    # Recount by type using only filtered incidents
    incidents_by_type = count_incidents_by_type(route_incidents)

    # Extract coordinates for mapping
    incident_locations = extract_coordinates(route_incidents)

    # Calculate safety score (normalized by route length) and get detailed metrics
    safety_score, metrics = calculate_safety_score(incidents_by_type, route_length_km)
    rating, rating_color = get_rating(safety_score)

    print(f"  Safety score: {safety_score}, Rating: {rating}")
    print(f"  Metrics: {metrics['violent_per_km']:.1f} violent/km, {metrics['encampment_per_km']:.1f} encampments/km")

    # Identify hotspots from filtered incidents
    hotspots = identify_hotspots(route_incidents)

    # Generate pros, cons, and recommendations (pass metrics for better text)
    pros, cons = generate_pros_cons(incidents_by_type, safety_score, hotspots, metrics)
    recommendations = generate_recommendations(incidents_by_type, safety_score, hotspots)

    # Build incident counts dict
    incident_counts = {
        "violent_crimes": incidents_by_type.get("violent_crimes", {}).get("count", 0),
        "property_crimes": incidents_by_type.get("property_crimes", {}).get("count", 0),
        "encampments": incidents_by_type.get("encampments", {}).get("count", 0),
        "traffic_injuries": incidents_by_type.get("traffic_injuries", {}).get("count", 0),
    }

    return RouteAnalysis(
        route_id=route_id,
        route_name=route_name,
        safety_score=round(safety_score, 1),
        rating=rating,
        rating_color=rating_color,
        incidents=incident_counts,
        incident_locations=incident_locations,
        hotspots=hotspots,
        pros=pros,
        cons=cons,
        recommendations=recommendations,
        metrics=metrics,
    )


async def analyze_multiple_routes(
    routes: list[dict],
    days_back: int = 60,
    radius_degrees: float = 0.002
) -> list[RouteAnalysis]:
    """
    Analyze multiple routes in parallel.

    Args:
        routes: List of route dicts with id, name, waypoints
        days_back: Number of days to look back
        radius_degrees: Search radius

    Returns:
        List of RouteAnalysis objects
    """
    tasks = [
        analyze_route(
            route_id=route["id"],
            route_name=route["name"],
            waypoints=[(wp[0], wp[1]) for wp in route["waypoints"]],
            days_back=days_back,
            radius_degrees=radius_degrees
        )
        for route in routes
    ]

    results = await asyncio.gather(*tasks, return_exceptions=True)

    # Filter out exceptions
    analyses = []
    for result in results:
        if isinstance(result, Exception):
            print(f"Route analysis error: {result}")
        else:
            analyses.append(result)

    return analyses
