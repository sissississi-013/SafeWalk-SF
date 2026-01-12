export interface Coordinate {
  lat: number;
  lng: number;
}

export interface LocationInfo {
  name: string;
  coordinate: Coordinate;
  formattedAddress?: string;
}

export interface SafetyDetails {
  homelessActivity: 'Low' | 'Moderate' | 'High';
  crimeIncidents: {
    robbery: number;
    assault: number;
    theft: number;
  };
  encampments: number;
  trafficIncidents: number;
  lighting: 'Well-lit' | 'Moderate' | 'Poorly-lit';
  crowdLevel: 'Busy' | 'Moderate' | 'Isolated';
  policePresence: 'High' | 'Moderate' | 'Low';
  safetyScore: number;
  pros: string[];
  cons: string[];
  recommendation: string;
  avoidAreas: string[];
}

export interface RouteData {
  id: string;
  name: string;
  type: 'SAFE' | 'FAST';
  description: string;
  riskLevel: 'Low' | 'Medium' | 'High';
  estimatedTime: string;
  distance: string;
  waypoints: [number, number][];
  safetyDetails?: SafetyDetails;
}

// Danger Zone - represents a dangerous neighborhood/area (highlighted polygon)
export interface DangerZone {
  id: string;
  name: string;
  category: string; // 'crime', 'homeless', 'drug activity', etc.
  severity: 'low' | 'medium' | 'high';
  description: string;
  coordinates: Coordinate[]; // Polygon points
}

// Danger Spot - represents a specific dangerous location (marker)
export interface DangerSpot {
  id: string;
  name: string;
  category: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  coordinate: Coordinate;
}

export interface DangerData {
  dangerZones: DangerZone[];
  dangerSpots: DangerSpot[];
}

export interface AppState {
  startLocation: LocationInfo | null;
  endLocation: LocationInfo | null;
  routes: RouteData[];
  selectedRouteId: string | null;
  isLoading: boolean;
  error: string | null;
  userLocation: Coordinate | null;
  dangerData: DangerData | null;
}

// =============================================================================
// Route Analysis Types (Snow Leopard Integration)
// =============================================================================

export interface IncidentLocation {
  lat: number;
  lng: number;
  category: string;
  description?: string;
  date?: string;
  neighborhood?: string;
}

export interface Hotspot {
  lat: number;
  lng: number;
  count: number;
  category: string;
  name: string;
  radius_m: number;  // Radius in meters, proportional to incident count
}

export interface IncidentCounts {
  violent_crimes: number;
  property_crimes: number;
  encampments: number;
  traffic_injuries: number;
}

export interface RouteMetrics {
  violent_per_km: number;
  property_per_km: number;
  encampment_per_km: number;
  traffic_per_km: number;
  route_length_km: number;
  lighting_score: number;
  crowd_score: number;
  police_presence_score: number;
}

export interface RouteAnalysis {
  id: string;
  name: string;
  safetyScore: number;
  rating: string;
  ratingColor: string;
  incidents: IncidentCounts;
  incidentLocations: IncidentLocation[];
  hotspots: Hotspot[];
  pros: string[];
  cons: string[];
  recommendations: string[];
  metrics?: RouteMetrics;
}

export interface AnalyzeRoutesResponse {
  routes: RouteAnalysis[];
  queryTimeMs: number;
}
