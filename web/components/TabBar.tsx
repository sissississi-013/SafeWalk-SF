/**
 * Tab bar for switching between Agent Flow and Results views.
 */

'use client';

import { Activity, BarChart3 } from 'lucide-react';

interface TabBarProps {
  activeTab: 'flow' | 'results';
  onTabChange: (tab: 'flow' | 'results') => void;
  hasResults: boolean;
}

export function TabBar({ activeTab, onTabChange, hasResults }: TabBarProps) {
  return (
    <div className="flex items-center gap-2 p-2 bg-white border-b border-gray-200">
      <button
        onClick={() => onTabChange('flow')}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
          activeTab === 'flow'
            ? 'bg-orange-100 text-orange-700'
            : 'text-gray-600 hover:bg-gray-100'
        }`}
      >
        <Activity className="w-4 h-4" />
        Agent Flow
      </button>

      <button
        onClick={() => onTabChange('results')}
        disabled={!hasResults}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
          activeTab === 'results'
            ? 'bg-orange-100 text-orange-700'
            : hasResults
              ? 'text-gray-600 hover:bg-gray-100'
              : 'text-gray-300 cursor-not-allowed'
        }`}
      >
        <BarChart3 className="w-4 h-4" />
        Results
        {hasResults && (
          <span className="bg-green-100 text-green-700 text-xs px-1.5 py-0.5 rounded">
            New
          </span>
        )}
      </button>
    </div>
  );
}
