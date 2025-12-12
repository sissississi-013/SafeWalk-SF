/**
 * TypeScript types for SafeSF agent system.
 */

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  status: 'running' | 'complete' | 'error';
  result?: unknown;
  rowCount?: number;
  error?: string;
}

export interface Agent {
  id: string;
  type: 'location-resolver' | 'data-agent' | 'summary-agent' | 'orchestrator';
  description?: string;
  status: 'pending' | 'running' | 'complete' | 'error';
  inputId?: string;
  toolCalls: ToolCall[];
  startedAt: string;
  completedAt?: string;
  error?: string;
}

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface IncidentRecord {
  incident_category?: string;
  collision_severity?: string;
  incident_datetime?: string;
  collision_datetime?: string;
  analysis_neighborhood?: string;
  latitude?: number;
  longitude?: number;
  lat?: number;
  long?: number;
  [key: string]: unknown;
}

export interface SafetyResult {
  safetyScore?: number;
  safety_score?: number;
  rating?: string;
  analysis?: string;
  summary?: string;
  recommendations?: string[];
  coordinates: Coordinate[];
  data: IncidentRecord[];
  sql?: string;
  incident_breakdown?: Record<string, number>;
}

export type SessionStatus = 'idle' | 'running' | 'complete' | 'error';

export interface WebSocketMessage {
  type: string;
  timestamp?: number;
  request_id?: string;
  agent_id?: string;
  agent_type?: string;
  input_id?: string;
  description?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  success?: boolean;
  row_count?: number;
  coordinates?: Coordinate[];
  status?: string;
  output_summary?: Record<string, unknown>;
  flow_trace?: string[];
  duration_ms?: number;
  agent_count?: number;
  final_response?: SafetyResult;
  error?: string;
  query?: string;
}

export interface StartSessionMessage {
  action: 'query';
  query: string;
}
