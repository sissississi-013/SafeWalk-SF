'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useAgentStore } from '@/store/agentStore';
import { SafetyScoreCard } from './SafetyScoreCard';
import {
  MapPin, Database, Clock, Route, Copy, Check, Download,
  ChevronLeft, ChevronRight, List, LayoutGrid, Loader2,
  ChevronDown, Snowflake, MessageSquare
} from 'lucide-react';

const SafetyMap = dynamic(() => import('./SafetyMap').then(mod => ({ default: mod.SafetyMap })), {
  ssr: false,
  loading: () => (
    <div className="h-[400px] bg-gray-100 rounded-lg flex items-center justify-center">
      <div className="text-gray-500">Loading map...</div>
    </div>
  ),
});

const CategoryHeatMaps = dynamic(() => import('./CategoryHeatMaps').then(mod => ({ default: mod.CategoryHeatMaps })), {
  ssr: false,
  loading: () => (
    <div className="h-32 bg-gray-100 rounded-lg flex items-center justify-center">
      <div className="text-gray-500">Loading categories...</div>
    </div>
  ),
});

function CopyButton({ text, className = '' }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={`p-1.5 rounded hover:bg-gray-200 transition-colors cursor-pointer ${className}`}
      title="Copy to clipboard"
    >
      {copied ? (
        <Check className="w-4 h-4 text-green-600" />
      ) : (
        <Copy className="w-4 h-4 text-gray-500" />
      )}
    </button>
  );
}

function DownloadButton({ content, filename, className = '' }: { content: string; filename: string; className?: string }) {
  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <button
      onClick={handleDownload}
      className={`p-1.5 rounded hover:bg-gray-200 transition-colors cursor-pointer ${className}`}
      title="Download"
    >
      <Download className="w-4 h-4 text-gray-500" />
    </button>
  );
}

function downloadRecordsAsCSV(records: Record<string, unknown>[]) {
  if (!records || records.length === 0) return;

  const allKeys = new Set<string>();
  records.forEach(record => {
    Object.keys(record).forEach(key => allKeys.add(key));
  });
  const headers = Array.from(allKeys);

  const csvRows: string[] = [];
  csvRows.push(headers.map(h => `"${h}"`).join(','));

  records.forEach(record => {
    const row = headers.map(header => {
      const value = record[header];
      if (value === null || value === undefined) return '""';
      if (typeof value === 'object') return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
      return `"${String(value).replace(/"/g, '""')}"`;
    });
    csvRows.push(row.join(','));
  });

  const csvContent = csvRows.join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `safesf_records_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function RecordsPanel({ data }: { data: Record<string, unknown>[] }) {
  const [displayedCount, setDisplayedCount] = useState(10);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const columns = useMemo(() => {
    const columnSet = new Set<string>();
    data.forEach(record => {
      Object.keys(record).forEach(key => columnSet.add(key));
    });
    const priorityColumns = [
      'incident_category', 'collision_severity', 'service_subtype',
      'analysis_neighborhood', 'intersection_street_1', 'intersection_street_2',
      'incident_datetime', 'collision_datetime', 'incident_date',
      'latitude', 'longitude', 'lat', 'long', 'lng'
    ];
    const sortedColumns = Array.from(columnSet).sort((a, b) => {
      const aIndex = priorityColumns.indexOf(a);
      const bIndex = priorityColumns.indexOf(b);
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return a.localeCompare(b);
    });
    return sortedColumns;
  }, [data]);

  const formatColumnHeader = (col: string) => {
    return col
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  };

  const formatCellValue = (value: unknown): string => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    if (typeof value === 'number') {
      if (Math.abs(value) < 180 && Math.abs(value) > 30) {
        return value.toFixed(6);
      }
      return value.toLocaleString();
    }
    return String(value);
  };

  const loadMore = useCallback(() => {
    if (isLoading || displayedCount >= data.length) return;
    setIsLoading(true);
    setTimeout(() => {
      setDisplayedCount(prev => Math.min(prev + 10, data.length));
      setIsLoading(false);
    }, 100);
  }, [isLoading, displayedCount, data.length]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const scrollBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
    if (scrollBottom < 50) {
      loadMore();
    }
  }, [loadMore]);

  return (
    <div className="bg-white rounded-lg p-4 border border-gray-200">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-gray-800 flex items-center gap-2">
          <Database className="w-4 h-4" />
          Records ({displayedCount} of {data.length})
          <span className="text-xs text-gray-400 font-normal">
            ({columns.length} columns)
          </span>
        </h3>
        <button
          onClick={() => downloadRecordsAsCSV(data)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors cursor-pointer"
          title="Download all records as CSV"
        >
          <Download className="w-4 h-4" />
          Download CSV
        </button>
      </div>
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="overflow-x-auto max-h-[400px] overflow-y-auto border border-gray-100 rounded"
      >
        <table className="text-sm min-w-full">
          <thead className="sticky top-0 bg-gray-50 z-10">
            <tr>
              {columns.map((col) => (
                <th
                  key={col}
                  className="px-3 py-2 text-left text-gray-600 font-medium whitespace-nowrap border-b border-gray-200"
                  title={col}
                >
                  {formatColumnHeader(col)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.slice(0, displayedCount).map((record, rowIndex) => (
              <tr key={rowIndex} className="border-t border-gray-100 hover:bg-gray-50">
                {columns.map((col) => (
                  <td
                    key={col}
                    className="px-3 py-2 text-gray-700 whitespace-nowrap max-w-[200px] overflow-hidden text-ellipsis"
                    title={formatCellValue(record[col])}
                  >
                    {formatCellValue(record[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {isLoading && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        )}
        {displayedCount < data.length && !isLoading && (
          <div className="text-center py-3 text-sm text-gray-500">
            Scroll to load more...
          </div>
        )}
      </div>
    </div>
  );
}

interface SQLQuery {
  query: string;
  sql: string;
  rowCount?: number;
  rows?: Record<string, unknown>[];
}

function QueryResultTable({ rows, maxRows = 10 }: { rows: Record<string, unknown>[]; maxRows?: number }) {
  if (!rows || rows.length === 0) return null;

  const columns = Object.keys(rows[0]);
  const displayRows = rows.slice(0, maxRows);

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'object') return JSON.stringify(value);
    if (typeof value === 'number') {
      if (Math.abs(value) < 180 && Math.abs(value) > 30) return value.toFixed(6);
      return value.toLocaleString();
    }
    return String(value);
  };

  const formatColumn = (col: string) => col.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="overflow-x-auto max-h-[200px] overflow-y-auto">
        <table className="text-xs min-w-full">
          <thead className="sticky top-0 bg-gray-100 z-10">
            <tr>
              {columns.map((col) => (
                <th key={col} className="px-2 py-1.5 text-left text-gray-600 font-medium whitespace-nowrap border-b border-gray-200">
                  {formatColumn(col)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, idx) => (
              <tr key={idx} className="border-t border-gray-100 hover:bg-gray-50">
                {columns.map((col) => (
                  <td key={col} className="px-2 py-1.5 text-gray-700 whitespace-nowrap max-w-[150px] overflow-hidden text-ellipsis" title={formatValue(row[col])}>
                    {formatValue(row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > maxRows && (
        <div className="px-3 py-1.5 bg-gray-50 text-xs text-gray-500 border-t border-gray-200">
          Showing {maxRows} of {rows.length} rows
        </div>
      )}
    </div>
  );
}

function downloadQueryAsCSV(query: SQLQuery, index: number) {
  if (!query.rows || query.rows.length === 0) return;

  const columns = Object.keys(query.rows[0]);
  const csvRows: string[] = [];
  csvRows.push(columns.map(c => `"${c}"`).join(','));

  query.rows.forEach(row => {
    const values = columns.map(col => {
      const value = row[col];
      if (value === null || value === undefined) return '""';
      if (typeof value === 'object') return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
      return `"${String(value).replace(/"/g, '""')}"`;
    });
    csvRows.push(values.join(','));
  });

  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `query_${index + 1}_results.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function SnowLeopardPanel({ sql, sqlQueries }: { sql?: string; sqlQueries?: SQLQuery[] }) {
  const [viewMode, setViewMode] = useState<'list' | 'card'>('list');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const queries: SQLQuery[] = sqlQueries?.length
    ? sqlQueries
    : sql
      ? [{ query: 'Generated Query', sql, rowCount: undefined, rows: [] }]
      : [];

  if (queries.length === 0) return null;

  const currentQuery = queries[currentIndex];

  return (
    <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <Snowflake className="w-5 h-5 text-blue-500" />
          Snow Leopard Retrieve Data
          <span className="text-sm font-normal text-gray-500">({queries.length} {queries.length === 1 ? 'query' : 'queries'})</span>
        </h3>

        <div className="flex rounded-lg border border-gray-300 overflow-hidden bg-gray-100 p-0.5">
          <button
            onClick={() => setViewMode('list')}
            className={`
              flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md cursor-pointer transition-all
              ${viewMode === 'list'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }
            `}
          >
            <List className="w-4 h-4" />
            List
          </button>
          <button
            onClick={() => setViewMode('card')}
            className={`
              flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md cursor-pointer transition-all
              ${viewMode === 'card'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }
            `}
          >
            <LayoutGrid className="w-4 h-4" />
            Card
          </button>
        </div>
      </div>

      {viewMode === 'card' && queries.length > 1 && (
        <div className="flex items-center justify-center gap-4 mb-4 pb-4 border-b border-gray-100">
          <button
            onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
            disabled={currentIndex === 0}
            className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>
          <span className="text-sm text-gray-600 font-medium">
            {currentIndex + 1} / {queries.length}
          </span>
          <button
            onClick={() => setCurrentIndex(prev => Math.min(queries.length - 1, prev + 1))}
            disabled={currentIndex === queries.length - 1}
            className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {viewMode === 'list' && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          {queries.map((query, idx) => {
            const isExpanded = expandedIndex === idx;
            const isFirst = idx === 0;
            const isLast = idx === queries.length - 1;
            return (
              <div key={idx} className={`${!isLast ? 'border-b border-gray-200' : ''}`}>
                <button
                  onClick={() => setExpandedIndex(isExpanded ? null : idx)}
                  className={`w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors text-left ${isFirst ? 'rounded-t-lg' : ''} ${isLast && !isExpanded ? 'rounded-b-lg' : ''}`}
                >
                  <div className="flex-1 min-w-0 pr-4">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {query.query}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {query.rowCount !== undefined ? `${query.rowCount.toLocaleString()} rows returned` : 'No data'}
                    </p>
                  </div>
                  <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </button>

                {isExpanded && (
                  <div className={`p-4 border-t border-gray-200 space-y-4 bg-white ${isLast ? 'rounded-b-lg' : ''}`}>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Query</h4>
                      </div>
                      <p className="text-sm text-gray-700 bg-gray-50 px-3 py-2 rounded-lg">{query.query}</p>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Generated SQL</h4>
                        <CopyButton text={query.sql} className="cursor-pointer" />
                      </div>
                      <pre className="text-xs bg-gray-900 text-green-400 p-3 rounded-lg overflow-x-auto max-h-32 overflow-y-auto whitespace-pre-wrap break-words font-mono">
                        {query.sql}
                      </pre>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          Retrieved Data ({query.rowCount?.toLocaleString() || 0} rows)
                        </h4>
                        {query.rows && query.rows.length > 0 && (
                          <button
                            onClick={() => downloadQueryAsCSV(query, idx)}
                            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded cursor-pointer transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Download CSV
                          </button>
                        )}
                      </div>
                      {query.rows && query.rows.length > 0 ? (
                        <QueryResultTable rows={query.rows} maxRows={10} />
                      ) : (
                        <p className="text-sm text-gray-500 italic">No data available</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {viewMode === 'card' && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="p-4 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Query</h4>
              </div>
              <p className="text-sm text-gray-700 bg-gray-50 px-3 py-2 rounded-lg">{currentQuery.query}</p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Generated SQL</h4>
                <CopyButton text={currentQuery.sql} className="cursor-pointer" />
              </div>
              <pre className="text-xs bg-gray-900 text-green-400 p-3 rounded-lg overflow-x-auto max-h-32 overflow-y-auto whitespace-pre-wrap break-words font-mono">
                {currentQuery.sql}
              </pre>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Retrieved Data ({currentQuery.rowCount?.toLocaleString() || 0} rows)
                </h4>
                {currentQuery.rows && currentQuery.rows.length > 0 && (
                  <button
                    onClick={() => downloadQueryAsCSV(currentQuery, currentIndex)}
                    className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded cursor-pointer transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download CSV
                  </button>
                )}
              </div>
              {currentQuery.rows && currentQuery.rows.length > 0 ? (
                <QueryResultTable rows={currentQuery.rows} maxRows={10} />
              ) : (
                <p className="text-sm text-gray-500 italic">No data available</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ResultsView() {
  const { finalResult, flowTrace, duration, currentQuery } = useAgentStore();

  const computedIncidentBreakdown = useMemo(() => {
    if (!finalResult?.data || finalResult.data.length === 0) {
      return finalResult?.incident_breakdown || {};
    }

    const breakdown: Record<string, number> = {};
    finalResult.data.forEach((record: Record<string, unknown>) => {
      const category = (
        record.incident_category ||
        record.collision_severity ||
        record.service_subtype ||
        'Other'
      ) as string;
      breakdown[category] = (breakdown[category] || 0) + 1;
    });

    return breakdown;
  }, [finalResult?.data, finalResult?.incident_breakdown]);

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

  const getAnalysisText = () => {
    const analysis = finalResult.analysis || finalResult.summary;
    if (!analysis) return undefined;
    if (typeof analysis === 'string') return analysis;
    if (typeof analysis === 'object') {
      const obj = analysis as Record<string, unknown>;
      if (obj.overview) return String(obj.overview);
      return JSON.stringify(analysis, null, 2);
    }
    return String(analysis);
  };

  return (
    <div className="h-full overflow-y-auto p-6 pb-32 bg-gray-50">
      <div className="max-w-6xl mx-auto space-y-6">
        {currentQuery && (
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center gap-2 text-gray-700 font-medium mb-2">
              <MessageSquare className="w-4 h-4" />
              Query
            </div>
            <p className="text-gray-800 text-lg">{currentQuery}</p>
          </div>
        )}

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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SafetyScoreCard
            score={score}
            rating={finalResult.rating}
            analysis={getAnalysisText()}
            recommendations={finalResult.recommendations}
            incidentBreakdown={computedIncidentBreakdown}
          />

          {finalResult.coordinates && finalResult.coordinates.length > 0 && (
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <h3 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Incident Locations ({finalResult.coordinates.length} points)
              </h3>
              <SafetyMap
                coordinates={finalResult.coordinates}
                height="280px"
                showHeatMap={true}
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {(computedIncidentBreakdown && Object.keys(computedIncidentBreakdown).length > 0 || (finalResult.data && finalResult.data.length > 0)) && (
            <CategoryHeatMaps
              coordinates={finalResult.coordinates || []}
              data={finalResult.data || []}
              incidentBreakdown={computedIncidentBreakdown}
            />
          )}

          {finalResult.data && finalResult.data.length > 0 && (
            <RecordsPanel data={finalResult.data} />
          )}
        </div>

        <SnowLeopardPanel sql={finalResult.sql} sqlQueries={finalResult.sqlQueries} />
      </div>
    </div>
  );
}
