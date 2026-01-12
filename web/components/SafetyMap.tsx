'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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

    if (!mapInstanceRef.current) {
      const center: [number, number] = [37.7749, -122.4194];

      mapInstanceRef.current = L.map(mapRef.current, {
        center,
        zoom: 12,
        scrollWheelZoom: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(mapInstanceRef.current);

      markersLayerRef.current = L.layerGroup().addTo(mapInstanceRef.current);
    }

    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current!;

    markersLayer.clearLayers();

    if (heatLayerRef.current) {
      map.removeLayer(heatLayerRef.current);
      heatLayerRef.current = null;
    }

    const validCoords = coordinates.filter(
      c => c.latitude && c.longitude &&
      c.latitude >= -90 && c.latitude <= 90 &&
      c.longitude >= -180 && c.longitude <= 180
    );

    if (validCoords.length === 0) return;

    if (!showHeatMap) {
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
    }

    if (showHeatMap && validCoords.length > 0) {
      import('leaflet.heat').then(() => {
        if (!mapInstanceRef.current || !mapRef.current) {
          return;
        }

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

        if (mapInstanceRef.current) {
          heat.addTo(mapInstanceRef.current);
          heatLayerRef.current = heat;
        }
      }).catch(err => {
        console.error('Failed to load heat layer:', err);
      });
    }

    if (validCoords.length > 0 && mapInstanceRef.current) {
      try {
        const bounds = L.latLngBounds(validCoords.map(c => [c.latitude, c.longitude]));
        mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
      } catch (err) {
        console.error('Failed to fit bounds:', err);
      }
    }

    return () => {};
  }, [coordinates, showHeatMap]);

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
