'use client';

import { useState } from 'react';
import { Shield, AlertTriangle, CheckCircle, XCircle, X, ChevronRight } from 'lucide-react';

interface SafetyScoreCardProps {
  score: number;
  rating?: string;
  analysis?: string;
  recommendations?: string[];
  incidentBreakdown?: Record<string, number>;
}

function getScoreColor(score: number): { bg: string; text: string; border: string; lightBg: string } {
  if (score >= 70) return { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300', lightBg: 'bg-green-50' };
  if (score >= 50) return { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-300', lightBg: 'bg-yellow-50' };
  if (score >= 30) return { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300', lightBg: 'bg-orange-50' };
  return { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300', lightBg: 'bg-red-50' };
}

function getScoreIcon(score: number) {
  if (score >= 70) return CheckCircle;
  if (score >= 50) return Shield;
  if (score >= 30) return AlertTriangle;
  return XCircle;
}

export function SafetyScoreCard({
  score,
  rating,
  analysis,
  recommendations,
  incidentBreakdown,
}: SafetyScoreCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const colors = getScoreColor(score);
  const Icon = getScoreIcon(score);

  const hasMoreContent = (recommendations && recommendations.length > 0) || (incidentBreakdown && Object.keys(incidentBreakdown).length > 0);

  const sortedIncidents = incidentBreakdown
    ? Object.entries(incidentBreakdown).sort((a, b) => b[1] - a[1])
    : [];

  return (
    <>
      <div
        onClick={() => hasMoreContent && setIsExpanded(true)}
        className={`rounded-xl border-2 ${colors.border} ${colors.bg} p-4 ${hasMoreContent ? 'cursor-pointer hover:shadow-md transition-shadow' : ''} h-full`}
      >
        <div className="flex items-center gap-3 mb-3">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center ${colors.lightBg} border-4 ${colors.border} flex-shrink-0`}>
            <span className={`text-xl font-bold ${colors.text}`}>{score}</span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Icon className={`w-4 h-4 ${colors.text}`} />
              <h2 className={`text-lg font-bold ${colors.text}`}>
                {rating || (score >= 70 ? 'Safe' : score >= 50 ? 'Generally Safe' : score >= 30 ? 'Caution' : 'High Risk')}
              </h2>
            </div>
            <p className="text-xs text-gray-500">Safety Score (0-100)</p>
          </div>

          {hasMoreContent && (
            <ChevronRight className={`w-5 h-5 ${colors.text} flex-shrink-0`} />
          )}
        </div>

        {analysis && (
          <p className="text-gray-600 text-sm leading-relaxed line-clamp-2 mb-3">{analysis}</p>
        )}

        {recommendations && recommendations.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-gray-700 mb-2">Recommendations</h3>
            <ul className="space-y-1">
              {recommendations.slice(0, 3).map((rec, index) => (
                <li
                  key={index}
                  className="flex items-start gap-2 text-xs text-gray-600"
                >
                  <span className="text-orange-500 font-bold mt-0.5">•</span>
                  <span className="line-clamp-1">{rec}</span>
                </li>
              ))}
              {recommendations.length > 3 && (
                <li className="text-xs text-gray-400 pl-4">
                  +{recommendations.length - 3} more...
                </li>
              )}
            </ul>
          </div>
        )}
      </div>

      {isExpanded && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setIsExpanded(false)}
        >
          <div
            className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`${colors.bg} p-4 border-b ${colors.border}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center ${colors.lightBg} border-4 ${colors.border}`}>
                    <span className={`text-2xl font-bold ${colors.text}`}>{score}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Icon className={`w-5 h-5 ${colors.text}`} />
                      <h2 className={`text-xl font-bold ${colors.text}`}>
                        {rating || (score >= 70 ? 'Safe' : score >= 50 ? 'Generally Safe' : score >= 30 ? 'Caution' : 'High Risk')}
                      </h2>
                    </div>
                    <p className="text-sm text-gray-600">Safety Score (0-100)</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsExpanded(false)}
                  className="p-2 hover:bg-white/50 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>
            </div>

            <div className="p-4 overflow-y-auto max-h-[60vh]">
              {analysis && (
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Analysis</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{analysis}</p>
                </div>
              )}

              {sortedIncidents.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">
                    Incident Breakdown ({sortedIncidents.length} categories)
                  </h3>
                  <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto">
                    {sortedIncidents.map(([category, count]) => (
                      <div
                        key={category}
                        className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2"
                      >
                        <span className="text-xs text-gray-600 capitalize truncate pr-2">
                          {category.replace(/_/g, ' ')}
                        </span>
                        <span className="text-sm font-semibold text-gray-800 flex-shrink-0">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {recommendations && recommendations.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Recommendations</h3>
                  <ul className="space-y-2">
                    {recommendations.map((rec, index) => (
                      <li
                        key={index}
                        className="flex items-start gap-2 text-sm text-gray-600"
                      >
                        <span className="text-orange-500 font-bold">•</span>
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-200">
              <button
                onClick={() => setIsExpanded(false)}
                className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
