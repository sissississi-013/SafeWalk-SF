export interface Coordinate {
  lat: number;
  lng: number;
}

export interface LocationInfo {
  name: string;
  coordinate: Coordinate;
  formattedAddress?: string;
}

export interface RouteData {
  id: string;
  name: string;
  type: 'SAFE' | 'FAST' | 'SCENIC';
  description: string;
  riskLevel: 'Low' | 'Medium' | 'High';
  estimatedTime: string;
  distance: string;
  waypoints: [number, number][]; // [lat, lng] array
}

export interface AppState {
  startLocation: LocationInfo | null;
  endLocation: LocationInfo | null;
  routes: RouteData[];
  selectedRouteId: string | null;
  isLoading: boolean;
  error: string | null;
  userLocation: Coordinate | null;
}