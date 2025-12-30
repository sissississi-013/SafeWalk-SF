'use client';

import { useState, useMemo } from 'react';
import { X, MapPin, ChevronDown, AlertTriangle, Shield, Flame, Car, Home, Users } from 'lucide-react';
import { SafetyMap } from './SafetyMap';

interface Coordinate {
  latitude: number;
  longitude: number;
  category?: string;
}

interface DataRecord {
  incident_category?: string;
  collision_severity?: string;
  service_subtype?: string;
  analysis_neighborhood?: string;
  latitude?: number;
  longitude?: number;
  lat?: number;
  long?: number;
  lng?: number;
  [key: string]: unknown;
}

interface CategoryHeatMapsProps {
  coordinates: Coordinate[];
  data: DataRecord[];
  incidentBreakdown?: Record<string, number>;
}

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'Assault': AlertTriangle,
  'Robbery': Shield,
  'Burglary': Home,
  'Motor Vehicle Theft': Car,
  'Homicide': AlertTriangle,
  'Rape': AlertTriangle,
  'Weapons Carrying Etc': Shield,
  'Weapons Offense': Shield,
  'Encampment Reports': Users,
  'Injury (Severe)': Car,
  'Injury (Other Visible)': Car,
  'Injury (Complaint of Pain)': Car,
  'Fatal': AlertTriangle,
  'default': MapPin,
};

const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  'Assault': { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700' },
  'Robbery': { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700' },
  'Homicide': { bg: 'bg-red-100', border: 'border-red-300', text: 'text-red-800' },
  'Rape': { bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-700' },
  'Burglary': { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700' },
  'Motor Vehicle Theft': { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
  'Weapons Carrying Etc': { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700' },
  'Weapons Offense': { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700' },
  'Encampment Reports': { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
  'Injury (Severe)': { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700' },
  'Injury (Other Visible)': { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700' },
  'Injury (Complaint of Pain)': { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700' },
  'Fatal': { bg: 'bg-red-100', border: 'border-red-300', text: 'text-red-800' },
  'default': { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700' },
};

export function CategoryHeatMaps({ coordinates, data }: CategoryHeatMapsProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categorizedData = useMemo(() => {
    const categories: Record<string, { coordinates: Coordinate[]; count: number }> = {};

    coordinates.forEach(coord => {
      const category = coord.category || 'Other';
      if (coord.latitude && coord.longitude) {
        if (!categories[category]) {
          categories[category] = { coordinates: [], count: 0 };
        }
        categories[category].coordinates.push({
          latitude: coord.latitude,
          longitude: coord.longitude,
          category,
        });
        categories[category].count++;
      }
    });

    data.forEach(record => {
      const category = record.incident_category
        || record.collision_severity
        || record.service_subtype
        || 'Other';

      const lat = record.latitude ?? record.lat;
      const lng = record.longitude ?? record.long ?? record.lng;

      if (lat !== undefined && lng !== undefined && lat !== null && lng !== null) {
        const latNum = Number(lat);
        const lngNum = Number(lng);

        if (latNum >= 37.6 && latNum <= 37.9 && lngNum >= -122.6 && lngNum <= -122.3) {
          if (!categories[category]) {
            categories[category] = { coordinates: [], count: 0 };
          }

          const exists = categories[category].coordinates.some(
            c => Math.abs(c.latitude - latNum) < 0.0001 && Math.abs(c.longitude - lngNum) < 0.0001
          );

          if (!exists) {
            categories[category].coordinates.push({
              latitude: latNum,
              longitude: lngNum,
              category,
            });
            categories[category].count++;
          }
        }
      }
    });

    return categories;
  }, [coordinates, data]);

  const sortedCategories = useMemo(() => {
    return Object.entries(categorizedData)
      .sort((a, b) => b[1].count - a[1].count)
      .filter(([, catData]) => catData.count > 0);
  }, [categorizedData]);

  const selectedData = selectedCategory ? categorizedData[selectedCategory] : null;

  if (sortedCategories.length === 0) {
    return (
      <div className="bg-white rounded-lg p-4 border border-gray-200">
        <h3 className="font-medium text-gray-800 mb-4 flex items-center gap-2">
          <Flame className="w-4 h-4" />
          Incident Heat Maps by Category
        </h3>
        <p className="text-sm text-gray-500">No categorized data available</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg p-4 border border-gray-200">
      <h3 className="font-medium text-gray-800 mb-4 flex items-center gap-2">
        <Flame className="w-4 h-4" />
        Incident Heat Maps by Category
      </h3>
      <p className="text-sm text-gray-500 mb-4">
        Click on a category to view its heat map distribution
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {sortedCategories.slice(0, 9).map(([category, { count, coordinates: catCoords }]) => {
          const colors = CATEGORY_COLORS[category] || CATEGORY_COLORS.default;
          const Icon = CATEGORY_ICONS[category] || CATEGORY_ICONS.default;

          return (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`
                p-3 rounded-lg border-2 transition-all
                hover:shadow-md hover:scale-[1.02]
                ${colors.bg} ${colors.border}
                flex flex-col items-center text-center
              `}
            >
              <Icon className={`w-5 h-5 mb-1 ${colors.text}`} />
              <span className={`text-sm font-medium ${colors.text} truncate w-full`}>
                {category}
              </span>
              <span className="text-xs text-gray-500 mt-1">
                {count.toLocaleString()} incidents
              </span>
              <span className="text-xs text-gray-400">
                {catCoords.length} mapped
              </span>
              <ChevronDown className="w-3 h-3 mt-1 text-gray-400" />
            </button>
          );
        })}
      </div>

      {sortedCategories.length > 9 && (
        <p className="text-xs text-gray-400 mt-2 text-center">
          +{sortedCategories.length - 9} more categories
        </p>
      )}

      {selectedCategory && selectedData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                {(() => {
                  const Icon = CATEGORY_ICONS[selectedCategory] || CATEGORY_ICONS.default;
                  const colors = CATEGORY_COLORS[selectedCategory] || CATEGORY_COLORS.default;
                  return (
                    <>
                      <div className={`p-2 rounded-lg ${colors.bg}`}>
                        <Icon className={`w-5 h-5 ${colors.text}`} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-800">{selectedCategory}</h3>
                        <p className="text-sm text-gray-500">
                          {selectedData.count.toLocaleString()} incidents, {selectedData.coordinates.length} mapped
                        </p>
                      </div>
                    </>
                  );
                })()}
              </div>
              <button
                onClick={() => setSelectedCategory(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-4">
              {selectedData.coordinates.length > 0 ? (
                <SafetyMap
                  coordinates={selectedData.coordinates}
                  height="500px"
                  showHeatMap={true}
                  title={`${selectedCategory} Heat Map`}
                />
              ) : (
                <div className="h-[500px] bg-gray-100 rounded-lg flex items-center justify-center">
                  <div className="text-center text-gray-500">
                    <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No coordinate data available for this category</p>
                    <p className="text-sm mt-1">
                      {selectedData.count} incidents reported (locations not specified)
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-200">
              <div className="flex justify-between items-center text-sm text-gray-500">
                <span>
                  Showing {selectedData.coordinates.length.toLocaleString()} mapped locations
                </span>
                <button
                  onClick={() => setSelectedCategory(null)}
                  className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
