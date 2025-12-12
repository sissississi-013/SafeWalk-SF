/**
 * Safety score visualization card.
 */

'use client';

import { Shield, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

interface SafetyScoreCardProps {
  score: number;
  rating?: string;
  analysis?: string;
  recommendations?: string[];
  incidentBreakdown?: Record<string, number>;
}

// Get color based on score
function getScoreColor(score: number): { bg: string; text: string; border: string } {
  if (score >= 70) return { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300' };
  if (score >= 50) return { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-300' };
  if (score >= 30) return { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300' };
  return { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' };
}

// Get icon based on score
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
  const colors = getScoreColor(score);
  const Icon = getScoreIcon(score);

  return (
    <div className={`rounded-xl border-2 ${colors.border} ${colors.bg} p-6`}>
      {/* Score Header */}
      <div className="flex items-center gap-4 mb-4">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center ${colors.bg} border-4 ${colors.border}`}>
          <span className={`text-3xl font-bold ${colors.text}`}>{score}</span>
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

      {/* Analysis */}
      {analysis && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Analysis</h3>
          <p className="text-gray-600 text-sm leading-relaxed">{analysis}</p>
        </div>
      )}

      {/* Incident Breakdown */}
      {incidentBreakdown && Object.keys(incidentBreakdown).length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Incident Breakdown</h3>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(incidentBreakdown).map(([category, count]) => (
              <div
                key={category}
                className="flex items-center justify-between bg-white/50 rounded-lg px-3 py-2"
              >
                <span className="text-xs text-gray-600 capitalize">
                  {category.replace(/_/g, ' ')}
                </span>
                <span className="text-sm font-semibold text-gray-800">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
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
  );
}
