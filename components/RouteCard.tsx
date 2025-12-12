import React from 'react';
import { RouteData } from '../types';
import { Shield, Zap, Mountain, Clock, Navigation } from 'lucide-react';
import clsx from 'clsx';

interface RouteCardProps {
  route: RouteData;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

const RouteCard: React.FC<RouteCardProps> = ({ route, isSelected, onSelect }) => {
  const getIcon = () => {
    switch (route.type) {
      case 'SAFE': return <Shield className="w-5 h-5 text-emerald-500" />;
      case 'FAST': return <Zap className="w-5 h-5 text-blue-500" />;
      case 'SCENIC': return <Mountain className="w-5 h-5 text-violet-500" />;
    }
  };

  const getColorClass = () => {
     switch (route.type) {
      case 'SAFE': return 'border-emerald-500 bg-emerald-50';
      case 'FAST': return 'border-blue-500 bg-blue-50';
      case 'SCENIC': return 'border-violet-500 bg-violet-50';
    }
  };

  return (
    <div 
      onClick={() => onSelect(route.id)}
      className={clsx(
        "cursor-pointer rounded-xl p-4 border-2 transition-all duration-300 mb-3 hover:shadow-md",
        isSelected 
          ? getColorClass()
          : "border-gray-100 bg-white hover:border-gray-200"
      )}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-2">
          {getIcon()}
          <h3 className={clsx("font-bold text-lg", isSelected ? "text-gray-900" : "text-gray-700")}>
            {route.name}
          </h3>
        </div>
        {route.riskLevel === 'Low' && (
          <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-full">
            Safest
          </span>
        )}
      </div>
      
      <p className="text-sm text-gray-600 mb-3 leading-relaxed">
        {route.description}
      </p>

      <div className="flex items-center gap-4 text-sm text-gray-500">
        <div className="flex items-center gap-1">
          <Clock className="w-4 h-4" />
          <span>{route.estimatedTime}</span>
        </div>
        <div className="flex items-center gap-1">
          <Navigation className="w-4 h-4" />
          <span>{route.distance}</span>
        </div>
      </div>
    </div>
  );
};

export default RouteCard;
