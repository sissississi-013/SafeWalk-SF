"""WebSocket event emitter for real-time updates."""

import json
import logging
import asyncio
from enum import Enum
from typing import Optional, Any
from dataclasses import dataclass

logger = logging.getLogger(__name__)


class EventType(Enum):
    """Event types emitted during agent execution."""
    SESSION_STARTED = "session_started"
    AGENT_SPAWNED = "agent_spawned"
    AGENT_PROGRESS = "agent_progress"
    TOOL_CALLED = "tool_called"
    TOOL_RESULT = "tool_result"
    AGENT_COMPLETE = "agent_complete"
    DATA_RECEIVED = "data_received"
    SESSION_COMPLETE = "session_complete"
    SESSION_ERROR = "session_error"


@dataclass
class Event:
    """An event to be emitted."""
    type: EventType
    data: dict
    timestamp: float


class EventEmitter:
    """
    Emits events for WebSocket streaming.

    Provides real-time updates on agent execution progress
    for frontend visualization.
    """

    def __init__(self, websocket=None):
        """
        Initialize the event emitter.

        Args:
            websocket: Optional WebSocket connection for real-time streaming
        """
        self.websocket = websocket
        self.event_history: list[Event] = []
        self.listeners: list[callable] = []
        logger.info("[EventEmitter] Initialized")

    def add_listener(self, callback: callable):
        """Add a listener callback for events."""
        self.listeners.append(callback)

    async def emit(self, event_type: EventType, data: dict):
        """
        Emit an event.

        Args:
            event_type: Type of event
            data: Event payload
        """
        import time

        event = Event(
            type=event_type,
            data=data,
            timestamp=time.time(),
        )
        self.event_history.append(event)

        payload = {
            "type": event_type.value,
            "timestamp": event.timestamp,
            **data,
        }

        # Send to WebSocket if connected
        if self.websocket:
            try:
                await self.websocket.send(json.dumps(payload, default=str))
                logger.debug(f"[EventEmitter] Sent: {event_type.value}")
            except Exception as e:
                logger.error(f"[EventEmitter] WebSocket send failed: {e}")

        # Call listeners
        for listener in self.listeners:
            try:
                if asyncio.iscoroutinefunction(listener):
                    await listener(event)
                else:
                    listener(event)
            except Exception as e:
                logger.error(f"[EventEmitter] Listener error: {e}")

        # Also log to console
        logger.info(f"[Event] {event_type.value}: {data.get('description', '')}")

    async def session_started(self, request_id: str, query: str):
        """Emit session started event."""
        await self.emit(EventType.SESSION_STARTED, {
            "request_id": request_id,
            "query": query[:200],  # Truncate long queries
            "description": f"Processing request: {query[:50]}...",
        })

    async def agent_spawned(
        self,
        agent_id: str,
        agent_type: str,
        input_id: str,
        description: str,
    ):
        """Emit agent spawned event."""
        await self.emit(EventType.AGENT_SPAWNED, {
            "agent_id": agent_id,
            "agent_type": agent_type,
            "input_id": input_id,
            "description": description,
        })

    async def agent_progress(self, agent_id: str, message: str, progress: float = 0):
        """Emit agent progress event."""
        await self.emit(EventType.AGENT_PROGRESS, {
            "agent_id": agent_id,
            "message": message,
            "progress": progress,
        })

    async def tool_called(
        self,
        agent_id: str,
        tool_name: str,
        tool_input: dict,
    ):
        """Emit tool called event."""
        await self.emit(EventType.TOOL_CALLED, {
            "agent_id": agent_id,
            "tool_name": tool_name,
            "tool_input": tool_input,
            "description": f"Calling {tool_name}",
        })

    async def tool_result(
        self,
        agent_id: str,
        tool_name: str,
        success: bool,
        row_count: int = 0,
    ):
        """Emit tool result event."""
        await self.emit(EventType.TOOL_RESULT, {
            "agent_id": agent_id,
            "tool_name": tool_name,
            "success": success,
            "row_count": row_count,
            "description": f"{tool_name} returned {row_count} rows",
        })

    async def data_received(
        self,
        agent_id: str,
        coordinates: list[dict],
        row_count: int,
    ):
        """Emit data received event with coordinates for mapping."""
        await self.emit(EventType.DATA_RECEIVED, {
            "agent_id": agent_id,
            "coordinates": coordinates[:100],  # Limit to first 100 for streaming
            "row_count": row_count,
            "description": f"Received {row_count} data points",
        })

    async def agent_complete(
        self,
        agent_id: str,
        status: str,
        output_summary: Optional[dict] = None,
    ):
        """Emit agent complete event."""
        await self.emit(EventType.AGENT_COMPLETE, {
            "agent_id": agent_id,
            "status": status,
            "output_summary": output_summary or {},
            "description": f"Agent {agent_id} completed ({status})",
        })

    async def session_complete(
        self,
        request_id: str,
        flow_trace: list[str],
        duration_ms: int,
        final_response: Optional[dict] = None,
    ):
        """Emit session complete event."""
        await self.emit(EventType.SESSION_COMPLETE, {
            "request_id": request_id,
            "flow_trace": flow_trace,
            "duration_ms": duration_ms,
            "agent_count": len(flow_trace) - 1,  # Exclude request node
            "final_response": final_response,
            "description": f"Session completed in {duration_ms}ms",
        })

    async def session_error(self, request_id: str, error: str):
        """Emit session error event."""
        await self.emit(EventType.SESSION_ERROR, {
            "request_id": request_id,
            "error": error,
            "description": f"Error: {error[:100]}",
        })

    def get_history(self) -> list[dict]:
        """Get event history as list of dicts."""
        return [
            {
                "type": e.type.value,
                "timestamp": e.timestamp,
                **e.data,
            }
            for e in self.event_history
        ]
