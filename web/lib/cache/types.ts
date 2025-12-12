/**
 * Cache types for SafeSF session recording/replay.
 */

export type CacheEventType =
  | 'session_started'
  | 'agent_spawned'
  | 'tool_called'
  | 'tool_result'
  | 'data_received'
  | 'agent_complete'
  | 'session_complete'
  | 'session_error'
  | 'final_result';

export interface CacheEvent {
  type: CacheEventType;
  data: Record<string, unknown>;
  timestamp: number;
  delay: number; // ms since previous event
}

export interface SessionCache {
  promptHash: string;
  prompt: string;
  events: CacheEvent[];
  recordedAt: string;
  totalDuration: number;
  isComplete: boolean;
}

export interface CacheRecorder {
  promptHash: string;
  prompt: string;
  events: CacheEvent[];
  startTime: number;
  lastEventTime: number;
  isFinalized: boolean;
}
