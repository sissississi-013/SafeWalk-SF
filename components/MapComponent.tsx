import React, { useEffect, useRef, useState } from 'react';
import { LocationInfo, RouteData, DangerZone, DangerSpot, IncidentLocation, Hotspot } from '../types';

interface MapComponentProps {
  startLocation: LocationInfo | null;
  endLocation: LocationInfo | null;
  routes: RouteData[];
  selectedRouteId: string | null;
  onSelectRoute: (id: string) => void;
  dangerZones: DangerZone[];
  dangerSpots: DangerSpot[];
  incidentLocations?: IncidentLocation[];
  hotspots?: Hotspot[];
  drawingMode?: boolean;
  onDrawingComplete?: (waypoints: [number, number][]) => void;
  customRouteWaypoints?: [number, number][] | null;
}

const MapComponent: React.FC<MapComponentProps> = ({
  startLocation,
  endLocation,
  routes,
  selectedRouteId,
  onSelectRoute,
  dangerZones,
  dangerSpots,
  incidentLocations = [],
  hotspots = [],
  drawingMode = false,
  onDrawingComplete,
  customRouteWaypoints = null,
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [markers, setMarkers] = useState<google.maps.Marker[]>([]);
  const [polylines, setPolylines] = useState<google.maps.Polyline[]>([]);
  const [dangerPolygons, setDangerPolygons] = useState<google.maps.Polygon[]>([]);
  const [dangerMarkers, setDangerMarkers] = useState<google.maps.Marker[]>([]);
  const [incidentMarkers, setIncidentMarkers] = useState<google.maps.Marker[]>([]);
  const [hotspotCircles, setHotspotCircles] = useState<google.maps.Circle[]>([]);
  const [drawingManager, setDrawingManager] = useState<google.maps.drawing.DrawingManager | null>(null);
  const [drawnPolyline, setDrawnPolyline] = useState<google.maps.Polyline | null>(null);
  const [customRoutePolyline, setCustomRoutePolyline] = useState<google.maps.Polyline | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || map) return;

    const googleMap = new google.maps.Map(mapRef.current, {
      center: { lat: 37.7749, lng: -122.4194 },
      zoom: 13,
      styles: [
        {
          featureType: "poi",
          elementType: "labels",
          stylers: [{ visibility: "off" }]
        }
      ],
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    });

    setMap(googleMap);
  }, []);

  // Initialize Drawing Manager
  useEffect(() => {
    if (!map || drawingManager) return;

    const manager = new google.maps.drawing.DrawingManager({
      drawingMode: null,
      drawingControl: false, // We'll control this ourselves
      polylineOptions: {
        strokeColor: '#8b5cf6', // Purple for custom route
        strokeOpacity: 1.0,
        strokeWeight: 5,
        editable: false,
        draggable: false,
        clickable: true,
      },
    });

    manager.setMap(map);

    // Listen for polyline completion
    google.maps.event.addListener(manager, 'polylinecomplete', (polyline: google.maps.Polyline) => {
      console.log('Polyline complete event fired');

      // Clear any previous drawn polyline
      if (drawnPolyline) {
        drawnPolyline.setMap(null);
      }
      setDrawnPolyline(polyline);

      // Extract waypoints from the polyline
      const path = polyline.getPath();
      const waypoints: [number, number][] = [];
      for (let i = 0; i < path.getLength(); i++) {
        const point = path.getAt(i);
        waypoints.push([point.lat(), point.lng()]);
      }

      console.log('Extracted waypoints:', waypoints.length);

      // Stop drawing mode after completion
      manager.setDrawingMode(null);

      // Notify parent of the drawn route
      if (onDrawingComplete && waypoints.length >= 2) {
        onDrawingComplete(waypoints);
      }

      // Remove the drawn polyline from map (it will be redrawn as customRoutePolyline)
      polyline.setMap(null);
    });

    setDrawingManager(manager);
  }, [map]);

  // Toggle drawing mode
  useEffect(() => {
    if (!drawingManager) return;

    if (drawingMode) {
      // Clear previous drawn polyline when entering drawing mode
      if (drawnPolyline) {
        drawnPolyline.setMap(null);
        setDrawnPolyline(null);
      }
      // Clear the analyzed custom route polyline when starting new drawing
      if (customRoutePolyline) {
        customRoutePolyline.setMap(null);
        setCustomRoutePolyline(null);
      }
      // Keep existing generated routes visible - don't clear them
      drawingManager.setDrawingMode(google.maps.drawing.OverlayType.POLYLINE);
      console.log('Drawing mode enabled');
    } else {
      drawingManager.setDrawingMode(null);
      console.log('Drawing mode disabled');
    }
  }, [drawingMode, drawingManager]);

  // Display custom route after analysis
  useEffect(() => {
    if (!map) return;

    // Clear previous custom route polyline
    if (customRoutePolyline) {
      customRoutePolyline.setMap(null);
    }

    if (customRouteWaypoints && customRouteWaypoints.length > 0) {
      const path = customRouteWaypoints.map(wp => ({ lat: wp[0], lng: wp[1] }));
      const polyline = new google.maps.Polyline({
        path: path,
        geodesic: true,
        strokeColor: '#8b5cf6', // Purple
        strokeOpacity: 1.0,
        strokeWeight: 6,
        map: map,
        zIndex: 15,
      });
      setCustomRoutePolyline(polyline);

      // Fit bounds to show the custom route
      const bounds = new google.maps.LatLngBounds();
      customRouteWaypoints.forEach(wp => {
        bounds.extend({ lat: wp[0], lng: wp[1] });
      });
      map.fitBounds(bounds, { top: 50, bottom: 50, left: 50, right: 50 });
    } else {
      setCustomRoutePolyline(null);
    }
  }, [map, customRouteWaypoints]);

  // Update start/end markers
  useEffect(() => {
    if (!map) return;

    markers.forEach(marker => marker.setMap(null));
    const newMarkers: google.maps.Marker[] = [];

    if (startLocation) {
      const startMarker = new google.maps.Marker({
        position: { lat: startLocation.coordinate.lat, lng: startLocation.coordinate.lng },
        map: map,
        title: 'Start: ' + startLocation.name,
        icon: {
          url: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png',
          scaledSize: new google.maps.Size(40, 40)
        },
        zIndex: 1000
      });
      newMarkers.push(startMarker);
    }

    if (endLocation) {
      const endMarker = new google.maps.Marker({
        position: { lat: endLocation.coordinate.lat, lng: endLocation.coordinate.lng },
        map: map,
        title: 'End: ' + endLocation.name,
        icon: {
          url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
          scaledSize: new google.maps.Size(40, 40)
        },
        zIndex: 1000
      });
      newMarkers.push(endMarker);
    }

    setMarkers(newMarkers);

    if (startLocation || endLocation) {
      const bounds = new google.maps.LatLngBounds();
      if (startLocation) {
        bounds.extend({ lat: startLocation.coordinate.lat, lng: startLocation.coordinate.lng });
      }
      if (endLocation) {
        bounds.extend({ lat: endLocation.coordinate.lat, lng: endLocation.coordinate.lng });
      }
      map.fitBounds(bounds, { top: 50, bottom: 50, left: 50, right: 50 });
    }
  }, [map, startLocation, endLocation]);

  // Update danger zones (polygons) and danger spots (markers)
  useEffect(() => {
    if (!map) return;

    // Clear existing danger visualizations
    dangerPolygons.forEach(polygon => polygon.setMap(null));
    dangerMarkers.forEach(marker => marker.setMap(null));

    const newPolygons: google.maps.Polygon[] = [];
    const newDangerMarkers: google.maps.Marker[] = [];

    // Get severity color
    const getSeverityColor = (severity: string) => {
      switch (severity) {
        case 'high': return { fill: '#ef4444', stroke: '#dc2626' }; // Red
        case 'medium': return { fill: '#f97316', stroke: '#ea580c' }; // Orange
        case 'low': return { fill: '#eab308', stroke: '#ca8a04' }; // Yellow
        default: return { fill: '#f97316', stroke: '#ea580c' };
      }
    };

    // Draw danger zones as highlighted polygons
    dangerZones.forEach(zone => {
      const colors = getSeverityColor(zone.severity);
      const path = zone.coordinates.map(c => ({ lat: c.lat, lng: c.lng }));

      const polygon = new google.maps.Polygon({
        paths: path,
        strokeColor: colors.stroke,
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: colors.fill,
        fillOpacity: 0.35,
        map: map,
        zIndex: 1
      });

      // Add info window on click
      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="padding: 12px; font-family: Inter, sans-serif; max-width: 280px;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
              <span style="background: ${colors.fill}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; text-transform: uppercase;">
                ${zone.severity} risk
              </span>
            </div>
            <h3 style="font-weight: bold; color: #1e293b; margin: 0 0 4px 0; font-size: 16px;">
              ⚠️ ${zone.name}
            </h3>
            <p style="color: #64748b; font-size: 12px; margin: 0 0 8px 0; font-weight: 500;">
              ${zone.category}
            </p>
            <p style="color: #475569; font-size: 13px; line-height: 1.5; margin: 0;">
              ${zone.description}
            </p>
          </div>
        `
      });

      polygon.addListener('click', (e: any) => {
        infoWindow.setPosition(e.latLng);
        infoWindow.open(map);
      });

      newPolygons.push(polygon);
    });

    // Draw danger spots as markers
    dangerSpots.forEach(spot => {
      const colors = getSeverityColor(spot.severity);

      // Create custom marker icon based on severity
      const markerIcon = {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: colors.fill,
        fillOpacity: 1,
        strokeColor: colors.stroke,
        strokeWeight: 2,
        scale: 10
      };

      const marker = new google.maps.Marker({
        position: { lat: spot.coordinate.lat, lng: spot.coordinate.lng },
        map: map,
        icon: markerIcon,
        title: spot.name,
        zIndex: 100
      });

      // Add warning icon overlay
      const warningLabel = new google.maps.Marker({
        position: { lat: spot.coordinate.lat, lng: spot.coordinate.lng },
        map: map,
        icon: {
          url: 'data:image/svg+xml,' + encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
              <path d="M12 9v4"/>
              <path d="M12 17h.01"/>
            </svg>
          `),
          scaledSize: new google.maps.Size(16, 16),
          anchor: new google.maps.Point(8, 8)
        },
        zIndex: 101
      });

      // Info window for spot
      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="padding: 12px; font-family: Inter, sans-serif; max-width: 250px;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
              <span style="background: ${colors.fill}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; text-transform: uppercase;">
                ${spot.severity} risk
              </span>
              <span style="background: #f1f5f9; color: #475569; padding: 2px 8px; border-radius: 12px; font-size: 11px;">
                ${spot.category}
              </span>
            </div>
            <h3 style="font-weight: bold; color: #1e293b; margin: 0 0 8px 0; font-size: 15px;">
              📍 ${spot.name}
            </h3>
            <p style="color: #475569; font-size: 13px; line-height: 1.5; margin: 0;">
              ${spot.description}
            </p>
          </div>
        `
      });

      marker.addListener('click', () => {
        infoWindow.open(map, marker);
      });

      newDangerMarkers.push(marker, warningLabel);
    });

    setDangerPolygons(newPolygons);
    setDangerMarkers(newDangerMarkers);

  }, [map, dangerZones, dangerSpots]);

  // Update real incident locations from Snow Leopard
  useEffect(() => {
    if (!map) return;

    // Clear existing incident markers
    incidentMarkers.forEach(marker => marker.setMap(null));
    hotspotCircles.forEach(circle => circle.setMap(null));

    const newIncidentMarkers: google.maps.Marker[] = [];
    const newHotspotCircles: google.maps.Circle[] = [];

    // Get color based on incident category
    const getIncidentColor = (category: string) => {
      const cat = category.toLowerCase();
      if (cat.includes('homicide') || cat.includes('assault') || cat.includes('robbery') || cat.includes('rape') || cat.includes('weapon')) {
        return '#dc2626'; // Red for violent crimes
      }
      if (cat.includes('burglary') || cat.includes('theft') || cat.includes('vehicle')) {
        return '#f97316'; // Orange for property crimes
      }
      if (cat.includes('encampment') || cat.includes('homeless')) {
        return '#8b5cf6'; // Purple for encampments
      }
      if (cat.includes('traffic')) {
        return '#eab308'; // Yellow for traffic
      }
      return '#6b7280'; // Gray for unknown
    };

    // Draw incident markers
    incidentLocations.forEach((incident, index) => {
      const color = getIncidentColor(incident.category);

      const marker = new google.maps.Marker({
        position: { lat: incident.lat, lng: incident.lng },
        map: map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: color,
          fillOpacity: 0.8,
          strokeColor: '#ffffff',
          strokeWeight: 1,
          scale: 6,
        },
        title: incident.category,
        zIndex: 50,
      });

      // Info window for incident
      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="padding: 10px; font-family: Inter, sans-serif; max-width: 220px;">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
              <span style="background: ${color}; color: white; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 600;">
                ${incident.category}
              </span>
            </div>
            ${incident.date ? `<p style="color: #64748b; font-size: 11px; margin: 4px 0;">Date: ${incident.date}</p>` : ''}
            ${incident.neighborhood ? `<p style="color: #64748b; font-size: 11px; margin: 4px 0;">Area: ${incident.neighborhood}</p>` : ''}
            ${incident.description ? `<p style="color: #475569; font-size: 12px; margin-top: 6px;">${incident.description.substring(0, 100)}${incident.description.length > 100 ? '...' : ''}</p>` : ''}
          </div>
        `,
      });

      marker.addListener('click', () => {
        infoWindow.open(map, marker);
      });

      newIncidentMarkers.push(marker);
    });

    // Draw hotspot circles with radius proportional to incident count
    hotspots.forEach(hotspot => {
      const radius = hotspot.radius_m || 100; // Use radius from backend, default 100m

      const circle = new google.maps.Circle({
        center: { lat: hotspot.lat, lng: hotspot.lng },
        radius: radius,
        strokeColor: '#dc2626',
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: '#dc2626',
        fillOpacity: 0.25,
        map: map,
        zIndex: 40,
      });

      // Info window for hotspot
      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="padding: 12px; font-family: Inter, sans-serif; max-width: 200px;">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px;">
              <span style="background: #dc2626; color: white; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600;">
                HOTSPOT
              </span>
            </div>
            <h3 style="font-weight: bold; color: #1e293b; margin: 0 0 4px 0; font-size: 14px;">
              ${hotspot.count} Incidents
            </h3>
            <p style="color: #64748b; font-size: 12px; margin: 0;">
              Primary type: ${hotspot.category}
            </p>
            <p style="color: #ef4444; font-size: 11px; margin-top: 6px; font-weight: 500;">
              High concentration of incidents detected
            </p>
          </div>
        `,
      });

      circle.addListener('click', (e: any) => {
        infoWindow.setPosition(e.latLng);
        infoWindow.open(map);
      });

      newHotspotCircles.push(circle);
    });

    setIncidentMarkers(newIncidentMarkers);
    setHotspotCircles(newHotspotCircles);

  }, [map, incidentLocations, hotspots]);

  // Update routes/polylines
  useEffect(() => {
    if (!map) return;

    polylines.forEach(polyline => polyline.setMap(null));
    const newPolylines: google.maps.Polyline[] = [];

    const getRouteColor = (type: string, isSelected: boolean) => {
      if (!isSelected) return '#94a3b8';
      switch (type) {
        case 'SAFE': return '#10b981';
        case 'FAST':
        default: return '#3b82f6';
      }
    };

    const sortedRoutes = [...routes].sort((a, b) => {
      if (a.id === selectedRouteId) return 1;
      if (b.id === selectedRouteId) return -1;
      return 0;
    });

    sortedRoutes.forEach((route) => {
      const isSelected = selectedRouteId === route.id;
      const path = route.waypoints.map(wp => ({ lat: wp[0], lng: wp[1] }));

      const polyline = new google.maps.Polyline({
        path: path,
        geodesic: true,
        strokeColor: getRouteColor(route.type, isSelected),
        strokeOpacity: isSelected ? 1.0 : 0.5,
        strokeWeight: isSelected ? 6 : 4,
        map: map,
        zIndex: isSelected ? 10 : 5
      });

      polyline.addListener('click', () => {
        onSelectRoute(route.id);
      });

      if (isSelected) {
        const infoWindow = new google.maps.InfoWindow({
          content: `
            <div style="padding: 8px; font-family: Inter, sans-serif;">
              <h3 style="font-weight: bold; color: #1e293b; margin: 0 0 4px 0;">${route.name}</h3>
              <p style="color: #64748b; font-size: 12px; margin: 0 0 8px 0;">${route.description}</p>
              <div style="font-size: 11px; color: #475569;">
                <span style="font-weight: 600;">${route.distance}</span> ·
                <span style="font-weight: 600;">${route.estimatedTime}</span>
              </div>
            </div>
          `
        });

        polyline.addListener('mouseover', (e: any) => {
          infoWindow.setPosition(e.latLng);
          infoWindow.open(map);
        });

        polyline.addListener('mouseout', () => {
          infoWindow.close();
        });
      }

      newPolylines.push(polyline);
    });

    setPolylines(newPolylines);

    if (routes.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      routes.forEach(route => {
        route.waypoints.forEach(wp => {
          bounds.extend({ lat: wp[0], lng: wp[1] });
        });
      });
      // Also include danger zones in bounds
      dangerZones.forEach(zone => {
        zone.coordinates.forEach(c => {
          bounds.extend({ lat: c.lat, lng: c.lng });
        });
      });
      map.fitBounds(bounds, { top: 50, bottom: 50, left: 50, right: 50 });
    }
  }, [map, routes, selectedRouteId, onSelectRoute, dangerZones]);

  return (
    <div
      ref={mapRef}
      style={{ width: '100%', height: '100%' }}
    />
  );
};

export default MapComponent;
