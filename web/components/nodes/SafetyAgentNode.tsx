/**
 * Custom ReactFlow node for SafeSF agents.
 */

'use client';

import { memo, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { MapPin, Database, FileText, Brain, ChevronDown, ChevronRight, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import type { Agent, ToolCall } from '@/types/agent';

// Agent type configuration
const AGENT_CONFIG: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  'orchestrator': { icon: Brain, label: 'Orchestrator', color: 'purple' },
  'location-resolver': { icon: MapPin, label: 'Location Resolver', color: 'blue' },
  'data-agent': { icon: Database, label: 'Data Agent', color: 'green' },
  'summary-agent': { icon: FileText, label: 'Summary Agent', color: 'orange' },
};

// Status styles
const STATUS_STYLES: Record<string, string> = {
  pending: 'border-gray-400 bg-gray-50',
  running: 'border-orange-400 bg-orange-50',
  complete: 'border-green-500 bg-green-50',
  error: 'border-red-400 bg-red-50',
};

const STATUS_ICONS: Record<string, React.ElementType> = {
  pending: Loader2,
  running: Loader2,
  complete: CheckCircle,
  error: AlertCircle,
};

function ToolCallItem({ toolCall }: { toolCall: ToolCall }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="border-t border-gray-200 pt-2 mt-2">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsExpanded(!isExpanded);
        }}
        className="flex items-center gap-2 w-full text-left text-xs"
      >
        {isExpanded ? (
          <ChevronDown className="w-3 h-3 text-gray-500" />
        ) : (
          <ChevronRight className="w-3 h-3 text-gray-500" />
        )}
        <span className="font-medium text-gray-700">{toolCall.name}</span>
        {toolCall.status === 'running' && (
          <Loader2 className="w-3 h-3 text-orange-500 animate-spin ml-auto" />
        )}
        {toolCall.status === 'complete' && (
          <CheckCircle className="w-3 h-3 text-green-500 ml-auto" />
        )}
        {toolCall.rowCount !== undefined && (
          <span className="text-gray-500 ml-1">({toolCall.rowCount} rows)</span>
        )}
      </button>

      {isExpanded && (
        <div className="mt-2 space-y-2">
          {Object.keys(toolCall.input).length > 0 && (
            <div>
              <div className="text-[10px] font-semibold text-gray-500 uppercase">Input</div>
              <pre className="text-[10px] bg-gray-100 p-2 rounded overflow-x-auto max-h-24">
                {JSON.stringify(toolCall.input, null, 2)}
              </pre>
            </div>
          )}
          {toolCall.result !== undefined && (
            <div>
              <div className="text-[10px] font-semibold text-gray-500 uppercase">Result</div>
              <pre className="text-[10px] bg-gray-100 p-2 rounded overflow-x-auto max-h-24">
                {typeof toolCall.result === 'string'
                  ? (toolCall.result as string).slice(0, 500)
                  : JSON.stringify(toolCall.result, null, 2).slice(0, 500)}
                {(typeof toolCall.result === 'string' ? (toolCall.result as string).length : JSON.stringify(toolCall.result).length) > 500 && '...'}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface SafetyAgentNodeProps {
  data: Record<string, unknown>;
}

function SafetyAgentNodeComponent({ data }: SafetyAgentNodeProps) {
  const agent = data as unknown as Agent;
  const config = AGENT_CONFIG[agent.type] || AGENT_CONFIG['data-agent'];
  const Icon = config.icon;
  const StatusIcon = STATUS_ICONS[agent.status] || Loader2;

  const completedTools = agent.toolCalls.filter(tc => tc.status === 'complete').length;
  const totalTools = agent.toolCalls.length;

  return (
    <div className={`min-w-[280px] max-w-[320px] rounded-lg border-2 shadow-lg ${STATUS_STYLES[agent.status]}`}>
      {/* Header */}
      <div className="p-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-md bg-${config.color}-100`}>
            <Icon className={`w-4 h-4 text-${config.color}-600`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-gray-800 truncate">
              {config.label}
            </div>
            <div className="text-xs text-gray-500 truncate">{agent.id}</div>
          </div>
          <StatusIcon
            className={`w-4 h-4 ${
              agent.status === 'running' ? 'text-orange-500 animate-spin' :
              agent.status === 'complete' ? 'text-green-500' :
              agent.status === 'error' ? 'text-red-500' :
              'text-gray-400'
            }`}
          />
        </div>
      </div>

      {/* Description */}
      {agent.description && (
        <div className="px-3 py-2 bg-blue-50 border-b border-blue-100">
          <p className="text-xs text-blue-700">{agent.description}</p>
        </div>
      )}

      {/* Tool Calls */}
      {agent.toolCalls.length > 0 && (
        <div className="p-3">
          <div className="text-xs text-gray-500 mb-1">
            Tools: {completedTools}/{totalTools} completed
          </div>
          {agent.toolCalls.slice(-3).map((tc) => (
            <ToolCallItem key={tc.id} toolCall={tc} />
          ))}
          {agent.toolCalls.length > 3 && (
            <div className="text-xs text-gray-400 mt-2">
              +{agent.toolCalls.length - 3} more tools
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {agent.error && (
        <div className="px-3 py-2 bg-red-50 border-t border-red-100">
          <p className="text-xs text-red-600">{agent.error}</p>
        </div>
      )}

      {/* Handles */}
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-gray-400 border-2 border-white"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-gray-400 border-2 border-white"
      />
    </div>
  );
}

export const SafetyAgentNode = memo(SafetyAgentNodeComponent);
