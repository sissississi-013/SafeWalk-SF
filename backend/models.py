"""Pydantic models for SafeWalk SF API."""

from pydantic import BaseModel
from typing import Optional
from enum import Enum


class Severity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class Coordinate(BaseModel):
    lat: float
    lng: float


class DangerZone(BaseModel):
    id: str
    name: str
    category: str
    severity: Severity
    description: str
    coordinates: list[Coordinate]


class DangerSpot(BaseModel):
    id: str
    name: str
    category: str
    severity: Severity
    description: str
    coordinate: Coordinate


class DangerDataResponse(BaseModel):
    dangerZones: list[DangerZone]
    dangerSpots: list[DangerSpot]


class Incident(BaseModel):
    id: str
    category: str
    description: str
    date: str
    time: Optional[str] = None
    coordinate: Coordinate
    severity: Severity
    neighborhood: Optional[str] = None


class IncidentQueryRequest(BaseModel):
    start_lat: float
    start_lng: float
    end_lat: float
    end_lng: float
    radius_km: float = 2.0
    categories: Optional[list[str]] = None
    days_back: int = 60


class SafetyScoreRequest(BaseModel):
    waypoints: list[Coordinate]
    buffer_meters: float = 200


class SafetyScoreResponse(BaseModel):
    score: float  # 0-10
    incident_count: int
    breakdown: dict[str, int]
    recommendations: list[str]


class NaturalQueryRequest(BaseModel):
    query: str
    user_lat: Optional[float] = None
    user_lng: Optional[float] = None


class NaturalQueryResponse(BaseModel):
    answer: str
    incidents: list[Incident]
    safety_score: Optional[float] = None
    coordinates: list[Coordinate]


# =============================================================================
# Route Analysis Models (Snow Leopard Integration)
# =============================================================================

class RouteInput(BaseModel):
    """Single route to analyze."""
    id: str
    name: str
    waypoints: list[list[float]]  # [[lat, lng], [lat, lng], ...]


class AnalyzeRoutesRequest(BaseModel):
    """Request to analyze multiple routes."""
    routes: list[RouteInput]
    days_back: int = 60
    radius_meters: float = 200


class IncidentLocation(BaseModel):
    """A single incident location for map display."""
    lat: float
    lng: float
    category: str
    description: str = ""
    date: str = ""
    neighborhood: str = ""


class Hotspot(BaseModel):
    """A cluster of incidents forming a hotspot."""
    lat: float
    lng: float
    count: int
    category: str
    name: str
    radius_m: float = 100  # Radius in meters, proportional to incident count


class IncidentCounts(BaseModel):
    """Incident counts by type."""
    violent_crimes: int = 0
    property_crimes: int = 0
    encampments: int = 0
    traffic_injuries: int = 0


class RouteMetrics(BaseModel):
    """Detailed safety metrics for a route (per-km normalized)."""
    violent_per_km: float = 0
    property_per_km: float = 0
    encampment_per_km: float = 0
    traffic_per_km: float = 0
    route_length_km: float = 0
    lighting_score: float = 50
    crowd_score: float = 50
    police_presence_score: float = 50


class RouteAnalysisResult(BaseModel):
    """Analysis result for a single route."""
    id: str
    name: str
    safetyScore: float
    rating: str
    ratingColor: str
    incidents: IncidentCounts
    incidentLocations: list[IncidentLocation]
    hotspots: list[Hotspot]
    pros: list[str]
    cons: list[str]
    recommendations: list[str]
    metrics: RouteMetrics = None


class AnalyzeRoutesResponse(BaseModel):
    """Response containing analysis for all routes."""
    routes: list[RouteAnalysisResult]
    queryTimeMs: int = 0
