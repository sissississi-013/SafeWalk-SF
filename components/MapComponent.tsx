import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { LocationInfo, RouteData } from '../types';

// Fix for default Leaflet marker icons in React
const iconRetinaUrl = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png';
const iconUrl = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png';
const shadowUrl = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png';

L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
});

const startIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const endIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

interface MapComponentProps {
  startLocation: LocationInfo | null;
  endLocation: LocationInfo | null;
  routes: RouteData[];
  selectedRouteId: string | null;
  onSelectRoute: (id: string) => void;
}

// Helper component to auto-fit bounds
const BoundsController = ({ start, end, routes, selectedRouteId }: any) => {
  const map = useMap();

  useEffect(() => {
    if (!start && !end) {
      // Default view SF
      map.setView([37.7749, -122.4194], 13);
      return;
    }

    const bounds = L.latLngBounds([]);

    if (start) bounds.extend([start.coordinate.lat, start.coordinate.lng]);
    if (end) bounds.extend([end.coordinate.lat, end.coordinate.lng]);

    // If we have a selected route, include its waypoints in bounds
    if (selectedRouteId && routes.length > 0) {
        const route = routes.find((r: any) => r.id === selectedRouteId);
        if (route) {
            route.waypoints.forEach((wp: any) => bounds.extend(wp));
        }
    } else if (routes.length > 0) {
        // If no specific route selected but we have routes, include all
        routes.forEach((r: any) => {
             r.waypoints.forEach((wp: any) => bounds.extend(wp));
        });
    }

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [start, end, routes, selectedRouteId, map]);

  return null;
};

const MapComponent: React.FC<MapComponentProps> = ({ 
  startLocation, 
  endLocation, 
  routes, 
  selectedRouteId,
  onSelectRoute
}) => {
  
  const getRouteColor = (type: string, isSelected: boolean) => {
    if (!isSelected) return '#94a3b8'; // gray for inactive
    switch (type) {
      case 'SAFE': return '#10b981'; // emerald
      case 'FAST': return '#3b82f6'; // blue
      case 'SCENIC': return '#8b5cf6'; // violet
      default: return '#3b82f6';
    }
  };

  const getRouteWeight = (isSelected: boolean) => isSelected ? 6 : 4;
  const getRouteOpacity = (isSelected: boolean) => isSelected ? 1 : 0.5;

  return (
    <MapContainer 
      center={[37.7749, -122.4194]} 
      zoom={13} 
      style={{ height: '100%', width: '100%', background: '#f8fafc' }}
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      />
      
      <BoundsController 
        start={startLocation} 
        end={endLocation} 
        routes={routes} 
        selectedRouteId={selectedRouteId} 
      />

      {startLocation && (
        <Marker position={[startLocation.coordinate.lat, startLocation.coordinate.lng]} icon={startIcon}>
          <Popup>
            <div className="font-semibold">Start: {startLocation.name}</div>
          </Popup>
        </Marker>
      )}

      {endLocation && (
        <Marker position={[endLocation.coordinate.lat, endLocation.coordinate.lng]} icon={endIcon}>
          <Popup>
            <div className="font-semibold">End: {endLocation.name}</div>
          </Popup>
        </Marker>
      )}

      {routes.map((route) => {
        const isSelected = selectedRouteId === route.id;
        return (
          <Polyline
            key={route.id}
            positions={route.waypoints}
            pathOptions={{
              color: getRouteColor(route.type, isSelected),
              weight: getRouteWeight(isSelected),
              opacity: getRouteOpacity(isSelected),
              lineJoin: 'round',
              lineCap: 'round'
            }}
            eventHandlers={{
              click: () => onSelectRoute(route.id)
            }}
          >
             <Popup>
                <div className="p-2">
                    <h3 className="font-bold text-gray-800">{route.name}</h3>
                    <p className="text-sm text-gray-600">{route.description}</p>
                    <div className="mt-2 text-xs flex gap-2">
                        <span className="font-semibold">{route.distance}</span>
                        <span>•</span>
                        <span className="font-semibold">{route.estimatedTime}</span>
                    </div>
                </div>
            </Popup>
          </Polyline>
        );
      })}
    </MapContainer>
  );
};

export default MapComponent;
