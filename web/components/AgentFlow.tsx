/**
 * ReactFlow canvas for visualizing SafeSF agent execution.
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  useNodesState,
  useEdgesState,
  MarkerType,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useAgentStore } from '@/store/agentStore';
import { SafetyAgentNode } from './nodes/SafetyAgentNode';
import { SidePanel } from './SidePanel';
import type { Agent } from '@/types/agent';

// Custom node types
const nodeTypes = {
  agent: SafetyAgentNode,
};

// Column assignments by agent type for visual flow
const AGENT_COLUMNS: Record<string, number> = {
  orchestrator: 0,
  'location-resolver': 1,
  'data-agent': 2,
  'summary-agent': 3,
};

// Layout constants
const COLUMN_SPACING = 400;
const ROW_SPACING = 220;
const START_X = 50;
const START_Y = 100;

// Get edge color based on status
function getEdgeColor(status: string): string {
  switch (status) {
    case 'complete':
      return '#22c55e';
    case 'error':
      return '#ef4444';
    case 'running':
      return '#f97316';
    default:
      return '#9ca3af';
  }
}

// Calculate positions using column-based layout
function calculatePositions(agents: Agent[]): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {};

  // Group agents by column
  const columns: Record<number, Agent[]> = {};

  agents.forEach(agent => {
    const col = AGENT_COLUMNS[agent.type] ?? 2;
    if (!columns[col]) columns[col] = [];
    columns[col].push(agent);
  });

  // Position each agent within its column
  Object.entries(columns).forEach(([colStr, colAgents]) => {
    const col = parseInt(colStr);
    const x = START_X + col * COLUMN_SPACING;

    // Center agents vertically
    const totalHeight = (colAgents.length - 1) * ROW_SPACING;
    const startY = START_Y + Math.max(0, (2 * ROW_SPACING - totalHeight) / 2);

    colAgents.forEach((agent, idx) => {
      positions[agent.id] = {
        x,
        y: startY + idx * ROW_SPACING,
      };
    });
  });

  return positions;
}

// Build edges based on input_id relationships
function buildEdges(agents: Agent[]): Edge[] {
  const edges: Edge[] = [];
  const edgeSet = new Set<string>();

  // Create edges based on inputId
  agents.forEach(agent => {
    if (agent.inputId) {
      const edgeId = `edge-${agent.inputId}-${agent.id}`;
      if (!edgeSet.has(edgeId)) {
        edgeSet.add(edgeId);
        const sourceAgent = agents.find(a => a.id === agent.inputId);
        edges.push({
          id: edgeId,
          source: agent.inputId,
          target: agent.id,
          animated: agent.status === 'running',
          markerEnd: { type: MarkerType.ArrowClosed },
          style: {
            stroke: getEdgeColor(sourceAgent?.status || agent.status),
            strokeWidth: 2,
          },
        });
      }
    }
  });

  // Connect orchestrator to first-level agents without explicit inputId
  const orchestrator = agents.find(a => a.type === 'orchestrator');
  if (orchestrator) {
    agents.forEach(agent => {
      if (agent.type !== 'orchestrator' && !agent.inputId) {
        const edgeId = `edge-${orchestrator.id}-${agent.id}`;
        if (!edgeSet.has(edgeId)) {
          edgeSet.add(edgeId);
          edges.push({
            id: edgeId,
            source: orchestrator.id,
            target: agent.id,
            animated: agent.status === 'running',
            markerEnd: { type: MarkerType.ArrowClosed },
            style: {
              stroke: getEdgeColor(agent.status),
              strokeWidth: 2,
            },
          });
        }
      }
    });
  }

  return edges;
}

export function AgentFlow() {
  const { agents, sessionStatus } = useAgentStore();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Calculate positions for all agents
  const positions = useMemo(() => calculatePositions(agents), [agents]);

  // Convert agents to React Flow nodes
  useEffect(() => {
    const newNodes = agents.map((agent) => ({
      id: agent.id,
      type: 'agent' as const,
      position: positions[agent.id] || { x: 400, y: 200 },
      data: agent as unknown as Record<string, unknown>,
      draggable: true,
    }));

    setNodes(newNodes);

    const newEdges = buildEdges(agents);
    setEdges(newEdges);
  }, [agents, positions, setNodes, setEdges]);

  // Find selected agent data
  const selectedAgent = useMemo(() => {
    if (!selectedNodeId) return null;
    return agents.find(a => a.id === selectedNodeId) || null;
  }, [selectedNodeId, agents]);

  return (
    <div className="w-full h-full bg-[#f0f0f0] relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.5 }}
        minZoom={0.2}
        maxZoom={1.5}
        defaultViewport={{ x: 0, y: 0, zoom: 0.6 }}
        proOptions={{ hideAttribution: true }}
        onNodeClick={(_, node) => setSelectedNodeId(node.id)}
        onPaneClick={() => setSelectedNodeId(null)}
      >
        <Background variant={BackgroundVariant.Dots} color="#c0c0c0" gap={16} size={2} />
        <Controls />
      </ReactFlow>

      {/* Side Panel */}
      {selectedAgent && (
        <SidePanel
          agent={selectedAgent}
          onClose={() => setSelectedNodeId(null)}
        />
      )}

      {/* Empty state */}
      {sessionStatus === 'idle' && agents.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center px-8 py-6">
            <svg
              className="w-16 h-16 text-gray-400/50 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
            <h3 className="text-lg font-medium text-gray-500 mb-2">SafeSF Agent</h3>
            <p className="text-gray-400 text-sm max-w-xs">
              Ask about safety in San Francisco neighborhoods
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
