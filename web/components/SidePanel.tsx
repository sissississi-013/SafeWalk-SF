'use client';

import { useState } from 'react';
import { X, ChevronDown, ChevronRight, CheckCircle, Loader2, AlertCircle, MapPin, Database, FileText, Brain, Copy, Check } from 'lucide-react';
import type { Agent, ToolCall } from '@/types/agent';

const AGENT_CONFIG: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  'orchestrator': { icon: Brain, label: 'Orchestrator', color: 'purple' },
  'location-resolver': { icon: MapPin, label: 'Location Resolver', color: 'blue' },
  'data-agent': { icon: Database, label: 'Data Agent', color: 'green' },
  'summary-agent': { icon: FileText, label: 'Summary Agent', color: 'orange' },
};

function CopyButton({ text, className = '' }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
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
      className={`p-1.5 rounded hover:bg-gray-200 transition-colors ${className}`}
      title="Copy to clipboard"
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-green-600" />
      ) : (
        <Copy className="w-3.5 h-3.5 text-gray-500" />
      )}
    </button>
  );
}

interface ToolCallItemProps {
  toolCall: ToolCall;
  defaultExpanded?: boolean;
}

function ToolCallItem({ toolCall, defaultExpanded = false }: ToolCallItemProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const queryInput = toolCall.input?.query as string | undefined;

  const formatResult = (result: unknown): string => {
    if (result === null || result === undefined) {
      return 'No data returned';
    }
    if (typeof result === 'string') {
      return result;
    }
    return JSON.stringify(result, null, 2);
  };

  const resultText = formatResult(toolCall.result);
  const hasResult = toolCall.result !== null && toolCall.result !== undefined;
  const isDataTool = toolCall.rowCount !== undefined;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-3 w-full p-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-500 shrink-0" />
        )}
        <span className="font-medium text-gray-800 flex-1">{toolCall.name}</span>
        {toolCall.status === 'running' && (
          <Loader2 className="w-4 h-4 text-orange-500 animate-spin" />
        )}
        {toolCall.status === 'complete' && (
          <CheckCircle className="w-4 h-4 text-green-500" />
        )}
        {toolCall.status === 'error' && (
          <AlertCircle className="w-4 h-4 text-red-500" />
        )}
        {toolCall.rowCount !== undefined && (
          <span className="text-sm text-gray-500 bg-gray-200 px-2 py-0.5 rounded">
            {toolCall.rowCount} rows
          </span>
        )}
      </button>

      {isExpanded && (
        <div className="p-4 space-y-4 bg-white">
          {toolCall.input && Object.keys(toolCall.input).length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-gray-500 uppercase">Input</h4>
                {queryInput && (
                  <CopyButton text={queryInput} />
                )}
              </div>
              <pre className="text-xs bg-gray-100 p-3 rounded-lg overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap break-words">
                {JSON.stringify(toolCall.input, null, 2)}
              </pre>
            </div>
          )}

          {hasResult && !isDataTool && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-gray-500 uppercase">Result</h4>
                <CopyButton text={resultText} />
              </div>
              <pre className="text-xs bg-gray-100 p-3 rounded-lg overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap break-words">
                {resultText}
              </pre>
            </div>
          )}

          {isDataTool && toolCall.status === 'complete' && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Result</h4>
              <div className="text-sm text-gray-600 bg-gray-100 p-3 rounded-lg">
                Retrieved <span className="font-semibold">{toolCall.rowCount}</span> rows (data available in Results tab)
              </div>
            </div>
          )}

          {!hasResult && !isDataTool && toolCall.status === 'complete' && !toolCall.error && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Result</h4>
              <div className="text-sm text-gray-500 bg-gray-100 p-3 rounded-lg">
                Completed successfully
              </div>
            </div>
          )}

          {toolCall.error && (
            <div>
              <h4 className="text-xs font-semibold text-red-500 uppercase mb-2">Error</h4>
              <pre className="text-xs bg-red-50 p-3 rounded-lg overflow-x-auto text-red-700">
                {toolCall.error}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface SidePanelProps {
  agent: Agent;
  onClose: () => void;
}

export function SidePanel({ agent, onClose }: SidePanelProps) {
  const config = AGENT_CONFIG[agent.type] || AGENT_CONFIG['data-agent'];
  const Icon = config.icon;

  return (
    <div className="absolute top-0 right-0 h-full w-[500px] bg-white shadow-xl border-l border-gray-200 flex flex-col z-50">
      <div className="p-4 border-b border-gray-200 flex items-center gap-3">
        <div className={`p-2 rounded-lg bg-${config.color}-100`}>
          <Icon className={`w-5 h-5 text-${config.color}-600`} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-gray-900">{config.label}</h2>
          <p className="text-sm text-gray-500 truncate">{agent.id}</p>
        </div>
        <div className={`px-2 py-1 rounded text-xs font-medium ${
          agent.status === 'complete' ? 'bg-green-100 text-green-700' :
          agent.status === 'running' ? 'bg-orange-100 text-orange-700' :
          agent.status === 'error' ? 'bg-red-100 text-red-700' :
          'bg-gray-100 text-gray-700'
        }`}>
          {agent.status}
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Close panel"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {agent.description && (
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
            <h3 className="text-xs font-semibold text-blue-600 uppercase mb-1">Description</h3>
            <p className="text-sm text-blue-800">{agent.description}</p>
          </div>
        )}

        {agent.inputId && (
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Input From</h3>
            <div className="text-sm text-gray-700 bg-gray-100 px-3 py-2 rounded-lg font-mono">
              {agent.inputId}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-1">Started</h3>
            <p className="text-sm text-gray-700">
              {new Date(agent.startedAt).toLocaleTimeString()}
            </p>
          </div>
          {agent.completedAt && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase mb-1">Completed</h3>
              <p className="text-sm text-gray-700">
                {new Date(agent.completedAt).toLocaleTimeString()}
              </p>
            </div>
          )}
        </div>

        {agent.toolCalls.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">
              Tool Activity ({agent.toolCalls.filter(tc => tc.status === 'complete').length}/{agent.toolCalls.length})
            </h3>
            <div className="space-y-3">
              {agent.toolCalls.map((tc, idx) => (
                <ToolCallItem
                  key={tc.id}
                  toolCall={tc}
                  defaultExpanded={idx === agent.toolCalls.length - 1}
                />
              ))}
            </div>
          </div>
        )}

        {agent.output && Object.keys(agent.output).length > 0 && (
          <div className="p-4 bg-green-50 rounded-lg border border-green-100">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-green-600 uppercase">Output</h3>
              <CopyButton text={JSON.stringify(agent.output, null, 2)} />
            </div>
            <pre className="text-xs bg-white p-3 rounded-lg overflow-x-auto h-64 overflow-y-auto whitespace-pre-wrap break-words">
              {JSON.stringify(agent.output, null, 2)}
            </pre>
          </div>
        )}

        {agent.error && (
          <div className="p-4 bg-red-50 rounded-lg border border-red-100">
            <h3 className="text-xs font-semibold text-red-600 uppercase mb-1">Error</h3>
            <p className="text-sm text-red-800">{agent.error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
