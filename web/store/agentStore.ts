/**
 * Zustand store for SafeSF agent state management.
 */

import { create } from 'zustand';
import type { Agent, ToolCall, SessionStatus, SafetyResult, Coordinate } from '@/types/agent';

interface AgentStore {
  // Session state
  sessionId: string | null;
  sessionStatus: SessionStatus;
  sessionError: string | null;
  startTime: number | null;
  duration: number | null;

  // Agents
  agents: Agent[];

  // Final result
  finalResult: SafetyResult | null;
  flowTrace: string[];

  // Actions
  setSessionStatus: (status: SessionStatus, sessionId?: string, error?: string) => void;
  setStartTime: (time: number) => void;
  setDuration: (duration: number) => void;
  addAgent: (agent: Agent) => void;
  updateAgent: (agentId: string, updates: Partial<Agent>) => void;
  addToolCall: (agentId: string, toolCall: ToolCall) => void;
  completeToolCall: (agentId: string, toolCallId: string, result: Partial<ToolCall>) => void;
  setFinalResult: (result: SafetyResult) => void;
  setFlowTrace: (trace: string[]) => void;
  reset: () => void;
}

const initialState = {
  sessionId: null,
  sessionStatus: 'idle' as SessionStatus,
  sessionError: null,
  startTime: null,
  duration: null,
  agents: [],
  finalResult: null,
  flowTrace: [],
};

export const useAgentStore = create<AgentStore>((set, get) => ({
  ...initialState,

  setSessionStatus: (status, sessionId, error) =>
    set({
      sessionStatus: status,
      sessionId: sessionId ?? get().sessionId,
      sessionError: error ?? null,
    }),

  setStartTime: (time) => set({ startTime: time }),

  setDuration: (duration) => set({ duration }),

  addAgent: (agent) =>
    set((state) => ({
      agents: [...state.agents, agent],
    })),

  updateAgent: (agentId, updates) =>
    set((state) => ({
      agents: state.agents.map((a) =>
        a.id === agentId ? { ...a, ...updates } : a
      ),
    })),

  addToolCall: (agentId, toolCall) =>
    set((state) => ({
      agents: state.agents.map((a) =>
        a.id === agentId
          ? { ...a, toolCalls: [...a.toolCalls, toolCall] }
          : a
      ),
    })),

  completeToolCall: (agentId, toolCallId, result) =>
    set((state) => ({
      agents: state.agents.map((a) =>
        a.id === agentId
          ? {
              ...a,
              toolCalls: a.toolCalls.map((tc) =>
                tc.id === toolCallId ? { ...tc, ...result, status: 'complete' as const } : tc
              ),
            }
          : a
      ),
    })),

  setFinalResult: (result) => set({ finalResult: result }),

  setFlowTrace: (trace) => set({ flowTrace: trace }),

  reset: () => set(initialState),
}));
