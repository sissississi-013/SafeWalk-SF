/**
 * Safety Map component using Leaflet with heat map overlay.
 */

'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default marker icons for Leaflet
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface Coordinate {
  latitude: number;
  longitude: number;
  category?: string;
}

interface SafetyMapProps {
  coordinates: Coordinate[];
  height?: string;
  showHeatMap?: boolean;
  title?: string;
}

// Color mapping for incident categories
const CATEGORY_COLORS: Record<string, string> = {
  'Assault': '#ef4444',
  'Robbery': '#f97316',
  'Burglary': '#eab308',
  'Theft': '#84cc16',
  'Vehicle Theft': '#22c55e',
  'Vandalism': '#14b8a6',
  'Drug/Narcotic': '#06b6d4',
  'Fraud': '#3b82f6',
  'Weapons': '#8b5cf6',
  'default': '#6366f1',
};

export function SafetyMap({ coordinates, height = '400px', showHeatMap = true, title }: SafetyMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const heatLayerRef = useRef<L.Layer | null>(null);

  useEffect(() => {
    if (!mapRef.current || coordinates.length === 0) return;

    // Initialize map if not exists
    if (!mapInstanceRef.current) {
      // Center on San Francisco
      const center: [number, number] = [37.7749, -122.4194];

      mapInstanceRef.current = L.map(mapRef.current, {
        center,
        zoom: 12,
        scrollWheelZoom: true,
      });

      // Add tile layer (OpenStreetMap)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(mapInstanceRef.current);

      // Create markers layer group
      markersLayerRef.current = L.layerGroup().addTo(mapInstanceRef.current);
    }

    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current!;

    // Clear existing markers
    markersLayer.clearLayers();

    // Remove existing heat layer
    if (heatLayerRef.current) {
      map.removeLayer(heatLayerRef.current);
      heatLayerRef.current = null;
    }

    // Add markers for each coordinate
    const validCoords = coordinates.filter(
      c => c.latitude && c.longitude &&
      c.latitude >= -90 && c.latitude <= 90 &&
      c.longitude >= -180 && c.longitude <= 180
    );

    if (validCoords.length === 0) return;

    // Add circle markers (faster than icons for many points)
    validCoords.slice(0, 500).forEach(coord => {
      const color = CATEGORY_COLORS[coord.category || ''] || CATEGORY_COLORS.default;

      L.circleMarker([coord.latitude, coord.longitude], {
        radius: 5,
        fillColor: color,
        color: '#fff',
        weight: 1,
        opacity: 1,
        fillOpacity: 0.7,
      })
        .bindPopup(`
          <div class="text-sm">
            <strong>${coord.category || 'Incident'}</strong><br/>
            <span class="text-gray-500">${coord.latitude.toFixed(4)}, ${coord.longitude.toFixed(4)}</span>
          </div>
        `)
        .addTo(markersLayer);
    });

    // Add heat map layer if enabled
    if (showHeatMap && validCoords.length > 10) {
      // Dynamic import for heat map (client-side only)
      import('leaflet.heat').then(() => {
        const heatData = validCoords.map(c => [c.latitude, c.longitude, 1]);
        // @ts-expect-error - leaflet.heat adds this method
        const heat = L.heatLayer(heatData, {
          radius: 25,
          blur: 15,
          maxZoom: 15,
          max: 1.0,
          gradient: {
            0.0: '#00f',
            0.3: '#0ff',
            0.5: '#0f0',
            0.7: '#ff0',
            1.0: '#f00',
          },
        });
        heat.addTo(map);
        heatLayerRef.current = heat;
      });
    }

    // Fit bounds to show all markers
    if (validCoords.length > 0) {
      const bounds = L.latLngBounds(validCoords.map(c => [c.latitude, c.longitude]));
      map.fitBounds(bounds, { padding: [50, 50] });
    }

    // Cleanup
    return () => {
      // Don't destroy the map on cleanup, just clear layers
    };
  }, [coordinates, showHeatMap]);

  // Cleanup map on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  if (coordinates.length === 0) {
    return (
      <div
        className="bg-gray-100 rounded-lg flex items-center justify-center text-gray-500"
        style={{ height }}
      >
        No location data available
      </div>
    );
  }

  return (
    <div className="relative">
      {title && (
        <div className="absolute top-2 left-2 z-[1000] bg-white/90 px-3 py-1 rounded-lg shadow text-sm font-medium">
          {title}
        </div>
      )}
      <div
        ref={mapRef}
        className="rounded-lg overflow-hidden z-0"
        style={{ height }}
      />
      <div className="absolute bottom-2 right-2 z-[1000] bg-white/90 px-2 py-1 rounded text-xs text-gray-600">
        {coordinates.length} incidents
      </div>
    </div>
  );
}
