import React, { useState } from 'react';
import { RouteData } from '../types';
import {
  Shield, Zap, Mountain, Clock, Navigation,
  AlertTriangle, Check, X, Users, Lightbulb,
  BadgeAlert, ChevronDown, ChevronUp, MapPin
} from 'lucide-react';
import clsx from 'clsx';

interface RouteCardProps {
  route: RouteData;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

const RouteCard: React.FC<RouteCardProps> = ({ route, isSelected, onSelect }) => {
  const [expanded, setExpanded] = useState(false);
  const safety = route.safetyDetails;

  const getIcon = () => {
    switch (route.type) {
      case 'SAFE': return <Shield className="w-5 h-5" />;
      case 'FAST': return <Zap className="w-5 h-5" />;
    }
  };

  const getColorClasses = () => {
    switch (route.type) {
      case 'SAFE': return {
        border: 'border-emerald-500',
        bg: 'bg-emerald-50',
        icon: 'text-emerald-600 bg-emerald-100',
        badge: 'bg-emerald-100 text-emerald-700',
        bar: 'bg-emerald-500'
      };
      case 'FAST':
      default:
        return {
          border: 'border-blue-500',
          bg: 'bg-blue-50',
          icon: 'text-blue-600 bg-blue-100',
          badge: 'bg-blue-100 text-blue-700',
          bar: 'bg-blue-500'
        };
    }
  };

  const colors = getColorClasses();

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'Low': return 'text-emerald-600 bg-emerald-100';
      case 'Moderate': return 'text-amber-600 bg-amber-100';
      case 'High': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getSafetyScoreColor = (score: number) => {
    if (score >= 7) return 'text-emerald-600';
    if (score >= 4) return 'text-amber-600';
    return 'text-red-600';
  };

  const getSafetyScoreBg = (score: number) => {
    if (score >= 7) return 'bg-emerald-500';
    if (score >= 4) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <div
      onClick={() => onSelect(route.id)}
      className={clsx(
        "cursor-pointer rounded-2xl border-2 transition-all duration-300 overflow-hidden",
        isSelected
          ? `${colors.border} ${colors.bg} shadow-lg`
          : "border-gray-100 bg-white hover:border-gray-200 hover:shadow-md"
      )}
    >
      {/* Header */}
      <div className="p-4">
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-3">
            <div className={clsx("p-2 rounded-xl", colors.icon)}>
              {getIcon()}
            </div>
            <div>
              <h3 className="font-bold text-lg text-gray-900">{route.name}</h3>
              <p className="text-sm text-gray-500">{route.description}</p>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="flex items-center gap-4 text-sm mb-3">
          <div className="flex items-center gap-1.5 text-gray-600">
            <Clock className="w-4 h-4" />
            <span className="font-medium">{route.estimatedTime}</span>
          </div>
          <div className="flex items-center gap-1.5 text-gray-600">
            <Navigation className="w-4 h-4" />
            <span className="font-medium">{route.distance}</span>
          </div>
          {safety && (
            <div className={clsx("flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold", getRiskColor(route.riskLevel))}>
              <Shield className="w-3 h-3" />
              {route.riskLevel} Risk
            </div>
          )}
        </div>

        {/* Safety Score Bar */}
        {safety && (
          <div className="mb-3">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-medium text-gray-500">Safety Score</span>
              <span className={clsx("text-lg font-bold", getSafetyScoreColor(safety.safetyScore))}>
                {safety.safetyScore.toFixed(1)}/10
              </span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={clsx("h-full rounded-full transition-all duration-500", getSafetyScoreBg(safety.safetyScore))}
                style={{ width: `${Math.min(100, safety.safetyScore * 10)}%` }}
              />
            </div>
          </div>
        )}

        {/* Quick Safety Indicators */}
        {safety && (
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className={clsx("text-center p-2 rounded-lg", getRiskColor(safety.homelessActivity))}>
              <Users className="w-4 h-4 mx-auto mb-1" />
              <div className="text-xs font-medium">{safety.homelessActivity}</div>
              <div className="text-[10px] opacity-75">Homeless</div>
            </div>
            <div className={clsx("text-center p-2 rounded-lg", getRiskColor(safety.lighting === 'Well-lit' ? 'Low' : safety.lighting === 'Moderate' ? 'Moderate' : 'High'))}>
              <Lightbulb className="w-4 h-4 mx-auto mb-1" />
              <div className="text-xs font-medium">{safety.lighting}</div>
              <div className="text-[10px] opacity-75">Lighting</div>
            </div>
            <div className={clsx("text-center p-2 rounded-lg", getRiskColor(safety.crowdLevel === 'Busy' ? 'Low' : safety.crowdLevel === 'Moderate' ? 'Moderate' : 'High'))}>
              <BadgeAlert className="w-4 h-4 mx-auto mb-1" />
              <div className="text-xs font-medium">{safety.policePresence}</div>
              <div className="text-[10px] opacity-75">Police</div>
            </div>
          </div>
        )}

        {/* Expand/Collapse Button */}
        {safety && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="w-full flex items-center justify-center gap-1 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
          >
            {expanded ? (
              <>Less Details <ChevronUp className="w-4 h-4" /></>
            ) : (
              <>More Details <ChevronDown className="w-4 h-4" /></>
            )}
          </button>
        )}
      </div>

      {/* Expanded Details */}
      {safety && expanded && (
        <div className="px-4 pb-4 border-t border-gray-100">
          {/* Crime Statistics */}
          <div className="mt-4 mb-4">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Incidents Along Route (60 days)
            </h4>
            <div className="grid grid-cols-4 gap-2">
              <div className="bg-red-50 rounded-lg p-2 text-center">
                <div className="text-lg font-bold text-red-600">{safety.crimeIncidents.robbery}</div>
                <div className="text-[10px] text-red-600">Robberies</div>
              </div>
              <div className="bg-orange-50 rounded-lg p-2 text-center">
                <div className="text-lg font-bold text-orange-600">{safety.crimeIncidents.assault}</div>
                <div className="text-[10px] text-orange-600">Assaults</div>
              </div>
              <div className="bg-amber-50 rounded-lg p-2 text-center">
                <div className="text-lg font-bold text-amber-600">{safety.crimeIncidents.theft}</div>
                <div className="text-[10px] text-amber-600">Thefts</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-2 text-center">
                <div className="text-lg font-bold text-purple-600">{safety.encampments || 0}</div>
                <div className="text-[10px] text-purple-600">Encampments</div>
              </div>
            </div>
          </div>

          {/* Pros */}
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-2 flex items-center gap-1">
              <Check className="w-3 h-3" /> Why Choose This Route
            </h4>
            <ul className="space-y-1.5">
              {safety.pros.map((pro, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>{pro}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Cons */}
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-2 flex items-center gap-1">
              <X className="w-3 h-3" /> Why Avoid This Route
            </h4>
            <ul className="space-y-1.5">
              {safety.cons.map((con, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <X className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <span>{con}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Areas to Avoid */}
          {safety.avoidAreas.length > 0 && (
            <div className="mb-4">
              <h4 className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-2 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Areas to Be Cautious
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {safety.avoidAreas.map((area, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 text-xs rounded-full">
                    <MapPin className="w-3 h-3" />
                    {area}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Recommendation */}
          <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Recommendation
            </h4>
            <p className="text-sm text-gray-700 leading-relaxed">
              {safety.recommendation}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default RouteCard;
