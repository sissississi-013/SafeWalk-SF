/**
 * Results view displaying safety analysis, map, and incident grid.
 */

'use client';

import { useAgentStore } from '@/store/agentStore';
import { SafetyScoreCard } from './SafetyScoreCard';
import { MapPin, Database, Clock, Route } from 'lucide-react';

export function ResultsView() {
  const { finalResult, flowTrace, duration } = useAgentStore();

  if (!finalResult) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-gray-500">
          <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No results yet. Run a query to see safety analysis.</p>
        </div>
      </div>
    );
  }

  const score = finalResult.safetyScore || finalResult.safety_score || 50;

  // Handle analysis that might be an object
  const getAnalysisText = () => {
    const analysis = finalResult.analysis || finalResult.summary;
    if (!analysis) return undefined;
    if (typeof analysis === 'string') return analysis;
    if (typeof analysis === 'object') {
      // If it's an object with overview, use that
      const obj = analysis as Record<string, unknown>;
      if (obj.overview) return String(obj.overview);
      // Otherwise stringify the whole thing
      return JSON.stringify(analysis, null, 2);
    }
    return String(analysis);
  };

  return (
    <div className="h-full overflow-y-auto p-6 bg-gray-50">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
              <MapPin className="w-4 h-4" />
              Data Points
            </div>
            <div className="text-2xl font-bold text-gray-800">
              {finalResult.coordinates?.length || 0}
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
              <Database className="w-4 h-4" />
              Records
            </div>
            <div className="text-2xl font-bold text-gray-800">
              {finalResult.data?.length || 0}
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
              <Clock className="w-4 h-4" />
              Duration
            </div>
            <div className="text-2xl font-bold text-gray-800">
              {duration ? `${(duration / 1000).toFixed(1)}s` : '-'}
            </div>
          </div>
        </div>

        {/* Flow Trace */}
        {flowTrace.length > 0 && (
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center gap-2 text-gray-700 font-medium mb-3">
              <Route className="w-4 h-4" />
              Agent Flow
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {flowTrace.map((step, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-sm font-mono">
                    {step}
                  </span>
                  {index < flowTrace.length - 1 && (
                    <span className="text-gray-400">→</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Safety Score Card */}
        <SafetyScoreCard
          score={score}
          rating={finalResult.rating}
          analysis={getAnalysisText()}
          recommendations={finalResult.recommendations}
          incidentBreakdown={finalResult.incident_breakdown}
        />

        {/* Coordinates Preview (Simple Map Placeholder) */}
        {finalResult.coordinates && finalResult.coordinates.length > 0 && (
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <h3 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Incident Locations ({finalResult.coordinates.length} points)
            </h3>
            <div className="h-[300px] bg-gray-100 rounded-lg flex items-center justify-center relative overflow-hidden">
              {/* Simple scatter visualization */}
              <div className="absolute inset-4">
                {finalResult.coordinates.slice(0, 100).map((coord, index) => {
                  // Normalize coordinates to fit in the container
                  // SF coordinates: lat ~37.7-37.8, lng ~-122.5 to -122.35
                  const x = ((coord.longitude + 122.5) / 0.15) * 100;
                  const y = ((37.82 - coord.latitude) / 0.12) * 100;
                  return (
                    <div
                      key={index}
                      className="absolute w-2 h-2 bg-red-500 rounded-full opacity-60"
                      style={{
                        left: `${Math.max(0, Math.min(100, x))}%`,
                        top: `${Math.max(0, Math.min(100, y))}%`,
                      }}
                      title={`${coord.latitude}, ${coord.longitude}`}
                    />
                  );
                })}
              </div>
              <div className="absolute bottom-2 right-2 bg-white/80 px-2 py-1 rounded text-xs text-gray-500">
                San Francisco, CA
              </div>
            </div>
            {finalResult.coordinates.length > 100 && (
              <p className="text-xs text-gray-500 mt-2">
                Showing first 100 of {finalResult.coordinates.length} points
              </p>
            )}
          </div>
        )}

        {/* Data Table Preview */}
        {finalResult.data && finalResult.data.length > 0 && (
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <h3 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
              <Database className="w-4 h-4" />
              Sample Records ({Math.min(10, finalResult.data.length)} of {finalResult.data.length})
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-3 py-2 text-left text-gray-600 font-medium">Category</th>
                    <th className="px-3 py-2 text-left text-gray-600 font-medium">Neighborhood</th>
                    <th className="px-3 py-2 text-left text-gray-600 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {finalResult.data.slice(0, 10).map((record, index) => (
                    <tr key={index} className="border-t border-gray-100">
                      <td className="px-3 py-2 text-gray-800">
                        {record.incident_category || record.collision_severity || '-'}
                      </td>
                      <td className="px-3 py-2 text-gray-600">
                        {record.analysis_neighborhood || '-'}
                      </td>
                      <td className="px-3 py-2 text-gray-500 text-xs">
                        {record.incident_datetime || record.collision_datetime || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SQL Query */}
        {finalResult.sql && (
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <h3 className="font-medium text-gray-800 mb-3">Generated SQL</h3>
            <pre className="text-xs bg-gray-100 p-3 rounded-lg overflow-x-auto">
              {finalResult.sql}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
