/**
 * WebSocket hook for SafeSF agent communication.
 */

'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useAgentStore } from '@/store/agentStore';
import type { WebSocketMessage, Agent, ToolCall } from '@/types/agent';
import {
  isCacheEnabled,
  getCache,
  createRecorder,
  recordEvent,
  finalizeRecording,
  replayCache,
  type CacheRecorder,
  type CacheEventType,
} from '@/lib/cache';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8765';

export function useSafeSFWebSocket() {
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
  const recorderRef = useRef<CacheRecorder | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isReplaying, setIsReplaying] = useState(false);

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
    reset,
  } = useAgentStore();

  const handleEvent = useCallback((message: WebSocketMessage, shouldRecord = true) => {
    const eventType = message.type;

    // Record event if we have an active recorder
    if (shouldRecord && recorderRef.current && !recorderRef.current.isFinalized) {
      const recordableTypes: CacheEventType[] = [
        'session_started', 'agent_spawned', 'tool_called', 'tool_result',
        'data_received', 'agent_complete', 'session_complete', 'session_error', 'final_result'
      ];
      if (recordableTypes.includes(eventType as CacheEventType)) {
        recordEvent(recorderRef.current, eventType as CacheEventType, message as unknown as Record<string, unknown>);
      }
    }

    switch (eventType) {
      case 'session_started':
        setSessionStatus('running', message.request_id);
        setStartTime(Date.now());
        console.log('[WS] Session started:', message.request_id);

        // Add orchestrator as root agent
        addAgent({
          id: message.request_id || 'orchestrator',
          type: 'orchestrator',
          description: message.description || 'Processing query',
          status: 'running',
          toolCalls: [],
          startedAt: new Date().toISOString(),
        });
        break;

      case 'agent_spawned': {
        const agentType = message.agent_type as Agent['type'];
        const agent: Agent = {
          id: message.agent_id || `agent-${Date.now()}`,
          type: agentType || 'data-agent',
          description: message.description,
          status: 'running',
          inputId: message.input_id,
          toolCalls: [],
          startedAt: new Date().toISOString(),
        };
        addAgent(agent);
        console.log('[WS] Agent spawned:', agent.id, agent.type);
        break;
      }

      case 'tool_called': {
        const toolCall: ToolCall = {
          id: `tool-${Date.now()}`,
          name: message.tool_name || 'unknown',
          input: message.tool_input || {},
          status: 'running',
        };
        if (message.agent_id) {
          addToolCall(message.agent_id, toolCall);
        }
        console.log('[WS] Tool called:', message.agent_id, toolCall.name);
        break;
      }

      case 'tool_result':
        if (message.agent_id) {
          // Find the last running tool call for this agent
          const agents = useAgentStore.getState().agents;
          const agent = agents.find(a => a.id === message.agent_id);
          const runningTool = agent?.toolCalls.find(tc => tc.status === 'running');
          if (runningTool) {
            // Capture the full result data from tool_result, data, or coordinates
            const resultData = message.tool_result || message.data || message.coordinates || null;
            completeToolCall(message.agent_id, runningTool.id, {
              status: 'complete',
              rowCount: message.row_count,
              result: resultData,
            });
          }
        }
        console.log('[WS] Tool result:', message.agent_id, message.row_count);
        break;

      case 'data_received':
        console.log('[WS] Data received:', message.row_count, 'rows');
        break;

      case 'agent_complete':
        if (message.agent_id) {
          updateAgent(message.agent_id, {
            status: message.status === 'completed' ? 'complete' : (message.status as Agent['status']),
            completedAt: new Date().toISOString(),
            output: message.output_summary,
          });
        }
        console.log('[WS] Agent complete:', message.agent_id);
        break;

      case 'session_complete':
        setSessionStatus('complete');
        if (message.duration_ms) {
          setDuration(message.duration_ms);
        }
        if (message.flow_trace) {
          setFlowTrace(message.flow_trace);
        }
        if (message.final_response) {
          setFinalResult({
            safetyScore: message.final_response.safety_score,
            rating: message.final_response.rating,
            analysis: message.final_response.analysis || message.final_response.summary,
            summary: message.final_response.summary,
            recommendations: message.final_response.recommendations || [],
            coordinates: message.final_response.coordinates || [],
            data: message.final_response.data || [],
            sql: message.final_response.sql,
            incident_breakdown: message.final_response.incident_breakdown,
          });
        }
        // Finalize recording if active
        if (recorderRef.current && !recorderRef.current.isFinalized) {
          finalizeRecording(recorderRef.current);
          recorderRef.current = null;
        }
        console.log('[WS] Session complete:', message.duration_ms, 'ms');
        break;

      case 'session_error':
        setSessionStatus('error', undefined, message.error);
        console.error('[WS] Session error:', message.error);
        break;

      case 'final_result': {
        // Handle final_result from SafeSF server
        setSessionStatus('complete');
        if (message.duration_ms) {
          setDuration(message.duration_ms);
        }
        if (message.flow_trace) {
          setFlowTrace(message.flow_trace);
        }
        // Extract data from the message itself
        const result = message as unknown as Record<string, unknown>;
        setFinalResult({
          safetyScore: result.safety_score as number | undefined,
          rating: result.rating as string | undefined,
          analysis: result.analysis as string | undefined || result.summary as string | undefined,
          summary: result.summary as string | undefined,
          recommendations: result.recommendations as string[] || [],
          coordinates: result.coordinates as Array<{latitude: number; longitude: number}> || [],
          data: result.data as Array<Record<string, unknown>> || [],
          sql: result.sql as string | undefined,
          incident_breakdown: result.incident_breakdown as Record<string, number> | undefined,
        });
        // Finalize recording if active
        if (recorderRef.current && !recorderRef.current.isFinalized) {
          finalizeRecording(recorderRef.current);
          recorderRef.current = null;
        }
        console.log('[WS] Final result received');
        break;
      }

      case 'error':
        setSessionStatus('error', undefined, message.error);
        console.error('[WS] Error:', message.error);
        break;

      case 'pong':
        // Heartbeat response
        break;

      default:
        console.log('[WS] Unknown event:', eventType, message);
    }
  }, [
    setSessionStatus,
    setStartTime,
    setDuration,
    addAgent,
    updateAgent,
    addToolCall,
    completeToolCall,
    setFinalResult,
    setFlowTrace,
  ]);

  const connect = useCallback(() => {
    if (ws.current) {
      ws.current.close();
    }

    console.log('[WS] Connecting to:', WS_URL);
    ws.current = new WebSocket(WS_URL);

    ws.current.onopen = () => {
      console.log('[WS] Connected');
      setIsConnected(true);

      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
        reconnectTimeout.current = null;
      }
    };

    ws.current.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        handleEvent(message);
      } catch (error) {
        console.error('[WS] Failed to parse message:', error);
      }
    };

    ws.current.onclose = () => {
      console.log('[WS] Disconnected');
      setIsConnected(false);

      // Reconnect after 3 seconds
      reconnectTimeout.current = setTimeout(() => {
        console.log('[WS] Attempting reconnect...');
        connect();
      }, 3000);
    };

    ws.current.onerror = (error) => {
      console.error('[WS] Error:', error);
    };
  }, [handleEvent]);

  const sendMessage = useCallback((message: Record<string, unknown>) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
    } else {
      console.warn('[WS] Cannot send - not connected');
    }
  }, []);

  const startSession = useCallback(async (query: string) => {
    console.log('[WS] Resetting session state for new query');
    reset();

    // Check cache first
    if (isCacheEnabled()) {
      const cached = getCache(query);
      if (cached) {
        console.log('[Cache] Hit! Replaying cached session...');
        setIsReplaying(true);
        try {
          await replayCache(cached);
        } finally {
          setIsReplaying(false);
        }
        return;
      }
      console.log('[Cache] Miss. Starting live session with recording...');
      recorderRef.current = createRecorder(query);
    }

    // No cache or cache disabled - send to WebSocket
    sendMessage({
      action: 'query',
      query,
    });

    console.log('[WS] Starting session:', query.slice(0, 50));
  }, [sendMessage, reset]);

  // Connect on mount
  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [connect]);

  return {
    isConnected,
    isReplaying,
    startSession,
    sendMessage,
  };
}
