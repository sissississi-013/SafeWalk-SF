/**
 * Category Heat Maps - Shows expandable heat maps for each incident category.
 */

'use client';

import { useState, useMemo } from 'react';
import { X, MapPin, ChevronDown, AlertTriangle, Shield, Flame } from 'lucide-react';
import { SafetyMap } from './SafetyMap';

interface Coordinate {
  latitude: number;
  longitude: number;
  category?: string;
}

interface DataRecord {
  incident_category?: string;
  analysis_neighborhood?: string;
  latitude?: number;
  longitude?: number;
  [key: string]: unknown;
}

interface CategoryHeatMapsProps {
  coordinates: Coordinate[];
  data: DataRecord[];
  incidentBreakdown?: Record<string, number>;
}

// Icon mapping for categories
const CATEGORY_ICONS: Record<string, typeof AlertTriangle> = {
  'Assault': AlertTriangle,
  'Robbery': Shield,
  'Burglary': Shield,
  'Theft': Shield,
  'Vehicle Theft': Shield,
  'Drug/Narcotic': Flame,
  'Weapons': AlertTriangle,
};

// Color mapping for categories
const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  'Assault': { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700' },
  'Robbery': { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700' },
  'Burglary': { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700' },
  'Theft': { bg: 'bg-lime-50', border: 'border-lime-200', text: 'text-lime-700' },
  'Vehicle Theft': { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700' },
  'Vandalism': { bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-700' },
  'Drug/Narcotic': { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-700' },
  'Fraud': { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
  'Weapons': { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700' },
  'default': { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700' },
};

export function CategoryHeatMaps({ coordinates, data, incidentBreakdown }: CategoryHeatMapsProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Group coordinates by category
  const categorizedData = useMemo(() => {
    const categories: Record<string, { coordinates: Coordinate[]; count: number }> = {};

    // Use incident breakdown if available
    if (incidentBreakdown) {
      Object.entries(incidentBreakdown).forEach(([category, count]) => {
        categories[category] = { coordinates: [], count };
      });
    }

    // Add coordinates from data records
    data.forEach(record => {
      const category = record.incident_category || 'Other';
      const lat = record.latitude || (record as Record<string, number>).lat;
      const lng = record.longitude || (record as Record<string, number>).lng;

      if (lat && lng) {
        if (!categories[category]) {
          categories[category] = { coordinates: [], count: 0 };
        }
        categories[category].coordinates.push({
          latitude: Number(lat),
          longitude: Number(lng),
          category,
        });
        if (!incidentBreakdown) {
          categories[category].count++;
        }
      }
    });

    // Also add coordinates that have category info
    coordinates.forEach(coord => {
      if (coord.category) {
        if (!categories[coord.category]) {
          categories[coord.category] = { coordinates: [], count: 0 };
        }
        categories[coord.category].coordinates.push(coord);
      }
    });

    return categories;
  }, [coordinates, data, incidentBreakdown]);

  const sortedCategories = useMemo(() => {
    return Object.entries(categorizedData)
      .sort((a, b) => b[1].count - a[1].count)
      .filter(([, data]) => data.count > 0);
  }, [categorizedData]);

  const selectedData = selectedCategory ? categorizedData[selectedCategory] : null;

  if (sortedCategories.length === 0) {
    return null;
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

      {/* Category Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {sortedCategories.map(([category, { count }]) => {
          const colors = CATEGORY_COLORS[category] || CATEGORY_COLORS.default;
          const Icon = CATEGORY_ICONS[category] || MapPin;

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
              <ChevronDown className="w-3 h-3 mt-1 text-gray-400" />
            </button>
          );
        })}
      </div>

      {/* Modal Dialog for Heat Map */}
      {selectedCategory && selectedData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                {(() => {
                  const Icon = CATEGORY_ICONS[selectedCategory] || MapPin;
                  const colors = CATEGORY_COLORS[selectedCategory] || CATEGORY_COLORS.default;
                  return (
                    <>
                      <div className={`p-2 rounded-lg ${colors.bg}`}>
                        <Icon className={`w-5 h-5 ${colors.text}`} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-800">{selectedCategory}</h3>
                        <p className="text-sm text-gray-500">
                          {selectedData.count.toLocaleString()} incidents
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

            {/* Map Content */}
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

            {/* Footer */}
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
