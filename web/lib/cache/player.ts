/**
 * Cache player - replays cached events with scaled timing.
 */

import type { SessionCache, CacheEvent } from './types';
import { useAgentStore } from '@/store/agentStore';
import type { Agent, ToolCall } from '@/types/agent';

// Speed multiplier - lower = faster replay
// 0.1 = 10x faster, 0.2 = 5x faster, 0.5 = 2x faster
const REPLAY_SPEED = 0.15;

// Minimum delay between events (ms)
const MIN_DELAY = 50;

// Maximum delay between events (ms)
const MAX_DELAY = 800;

/**
 * Scale delay for replay.
 */
function scaleDelay(originalDelay: number): number {
  const scaled = Math.round(originalDelay * REPLAY_SPEED);
  return Math.max(MIN_DELAY, Math.min(MAX_DELAY, scaled));
}

/**
 * Sleep for specified milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Replay a cached session with scaled timing.
 */
export async function replayCache(cache: SessionCache): Promise<void> {
  const {
    setSessionStatus,
    setStartTime,
    setDuration,
    addAgent,
    updateAgent,
    addToolCall,
    completeToolCall,
    setFinalResult,
    setFlowTrace,
  } = useAgentStore.getState();

  console.log(`[CachePlayer] Replaying ${cache.events.length} events...`);
  setStartTime(Date.now());

  for (let i = 0; i < cache.events.length; i++) {
    const event = cache.events[i];

    // Wait scaled delay (skip first event)
    if (i > 0) {
      const delay = scaleDelay(event.delay);
      await sleep(delay);
    }

    // Process event
    await processEvent(event, {
      setSessionStatus,
      addAgent,
      updateAgent,
      addToolCall,
      completeToolCall,
      setFinalResult,
      setFlowTrace,
      setDuration,
    });
  }

  console.log('[CachePlayer] Replay complete');
}

interface StoreActions {
  setSessionStatus: (status: 'idle' | 'running' | 'complete' | 'error', sessionId?: string, error?: string) => void;
  addAgent: (agent: Agent) => void;
  updateAgent: (agentId: string, updates: Partial<Agent>) => void;
  addToolCall: (agentId: string, toolCall: ToolCall) => void;
  completeToolCall: (agentId: string, toolCallId: string, result: Partial<ToolCall>) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setFinalResult: (result: any) => void;
  setFlowTrace: (trace: string[]) => void;
  setDuration: (duration: number) => void;
}

/**
 * Process a single cached event.
 */
async function processEvent(event: CacheEvent, actions: StoreActions): Promise<void> {
  const { type, data } = event;

  switch (type) {
    case 'session_started':
      actions.setSessionStatus('running', data.request_id as string);
      actions.addAgent({
        id: (data.request_id as string) || 'orchestrator',
        type: 'orchestrator',
        description: data.description as string || 'Processing query',
        status: 'running',
        toolCalls: [],
        startedAt: new Date().toISOString(),
      });
      break;

    case 'agent_spawned':
      actions.addAgent({
        id: data.agent_id as string,
        type: (data.agent_type as Agent['type']) || 'data-agent',
        description: data.description as string,
        status: 'running',
        inputId: data.input_id as string,
        toolCalls: [],
        startedAt: new Date().toISOString(),
      });
      break;

    case 'tool_called':
      if (data.agent_id) {
        actions.addToolCall(data.agent_id as string, {
          id: `tool-${Date.now()}`,
          name: data.tool_name as string || 'unknown',
          input: (data.tool_input as Record<string, unknown>) || {},
          status: 'running',
        });
      }
      break;

    case 'tool_result':
      if (data.agent_id) {
        const agents = useAgentStore.getState().agents;
        const agent = agents.find(a => a.id === data.agent_id);
        const runningTool = agent?.toolCalls.find(tc => tc.status === 'running');
        if (runningTool) {
          actions.completeToolCall(data.agent_id as string, runningTool.id, {
            status: 'complete',
            rowCount: data.row_count as number,
          });
        }
      }
      break;

    case 'agent_complete':
      if (data.agent_id) {
        actions.updateAgent(data.agent_id as string, {
          status: 'complete',
          completedAt: new Date().toISOString(),
          output: data.output_summary as Record<string, unknown> | undefined,
        });
      }
      break;

    case 'session_complete':
      actions.setSessionStatus('complete');
      if (data.duration_ms) {
        actions.setDuration(data.duration_ms as number);
      }
      if (data.flow_trace) {
        actions.setFlowTrace(data.flow_trace as string[]);
      }
      if (data.final_response) {
        const response = data.final_response as Record<string, unknown>;
        actions.setFinalResult({
          safetyScore: response.safety_score,
          rating: response.rating,
          analysis: response.analysis || response.summary,
          summary: response.summary,
          recommendations: response.recommendations || [],
          coordinates: response.coordinates || [],
          data: response.data || [],
          sql: response.sql,
          incident_breakdown: response.incident_breakdown,
        });
      }
      break;

    case 'final_result':
      actions.setSessionStatus('complete');
      if (data.duration_ms) {
        actions.setDuration(data.duration_ms as number);
      }
      if (data.flow_trace) {
        actions.setFlowTrace(data.flow_trace as string[]);
      }
      actions.setFinalResult({
        safetyScore: data.safety_score as number,
        rating: data.rating as string,
        analysis: data.analysis || data.summary,
        summary: data.summary as string,
        recommendations: (data.recommendations as string[]) || [],
        coordinates: (data.coordinates as Array<{latitude: number; longitude: number}>) || [],
        data: (data.data as Array<Record<string, unknown>>) || [],
        sql: data.sql as string,
        incident_breakdown: data.incident_breakdown as Record<string, number>,
      });
      break;

    case 'session_error':
      actions.setSessionStatus('error', undefined, data.error as string);
      break;
  }
}
