"""Flow tracking system for agent data lineage."""

import time
import logging
from dataclasses import dataclass, field
from typing import Optional
from collections import defaultdict
from enum import Enum

logger = logging.getLogger(__name__)


class AgentType(Enum):
    """Types of agents in the system."""
    REQUEST = "REQ"
    LOCATION = "LOC"
    DATA = "DATA"
    SUMMARY = "SUM"
    SEARCH = "SEARCH"


@dataclass
class FlowNode:
    """A node in the flow graph representing an agent execution."""
    flow_id: str
    agent_type: AgentType
    input_id: Optional[str]
    timestamp: float
    description: str = ""
    status: str = "pending"  # pending, running, completed, failed
    output: Optional[dict] = None


@dataclass
class FlowSession:
    """A complete flow session tracking all agent executions."""
    request_id: str
    start_time: float
    nodes: dict = field(default_factory=dict)
    flow_order: list = field(default_factory=list)
    status: str = "active"


class FlowTracker:
    """
    Tracks data flow through the multi-agent system.

    Generates unique IDs for each agent execution and tracks
    the lineage of data as it flows from request to response.
    """

    def __init__(self):
        self.sessions: dict[str, FlowSession] = {}
        self.counters: dict[str, int] = defaultdict(int)
        self.current_session: Optional[str] = None
        logger.info("[FlowTracker] Initialized")

    def start_session(self, description: str = "") -> str:
        """
        Start a new flow session.

        Returns:
            The request ID for this session (e.g., REQ-1702345678)
        """
        request_id = self._generate_id(AgentType.REQUEST)
        session = FlowSession(
            request_id=request_id,
            start_time=time.time(),
        )

        # Add initial request node
        node = FlowNode(
            flow_id=request_id,
            agent_type=AgentType.REQUEST,
            input_id=None,
            timestamp=time.time(),
            description=description,
            status="completed",
        )
        session.nodes[request_id] = node
        session.flow_order.append(request_id)

        self.sessions[request_id] = session
        self.current_session = request_id

        logger.info(f"[FlowTracker] Session started: {request_id}")
        return request_id

    def register_agent(
        self,
        agent_type: AgentType,
        input_id: str,
        description: str = "",
    ) -> str:
        """
        Register a new agent execution in the current session.

        Args:
            agent_type: Type of agent being executed
            input_id: The flow_id of the input data source
            description: Description of what this agent is doing

        Returns:
            The flow_id for this agent execution
        """
        if not self.current_session:
            raise ValueError("No active session. Call start_session first.")

        session = self.sessions[self.current_session]
        flow_id = self._generate_id(agent_type)

        node = FlowNode(
            flow_id=flow_id,
            agent_type=agent_type,
            input_id=input_id,
            timestamp=time.time(),
            description=description,
            status="running",
        )

        session.nodes[flow_id] = node
        session.flow_order.append(flow_id)

        logger.info(f"[FlowTracker] Agent registered: {flow_id} (input: {input_id})")
        return flow_id

    def complete_agent(
        self,
        flow_id: str,
        output: Optional[dict] = None,
        status: str = "completed",
    ):
        """
        Mark an agent execution as complete.

        Args:
            flow_id: The flow_id of the agent
            output: Optional output data from the agent
            status: Final status (completed, failed)
        """
        if not self.current_session:
            return

        session = self.sessions[self.current_session]
        if flow_id in session.nodes:
            session.nodes[flow_id].status = status
            session.nodes[flow_id].output = output
            logger.info(f"[FlowTracker] Agent completed: {flow_id} ({status})")

    def end_session(self, status: str = "completed") -> dict:
        """
        End the current session and return summary.

        Returns:
            Summary of the flow session
        """
        if not self.current_session:
            return {}

        session = self.sessions[self.current_session]
        session.status = status

        summary = {
            "request_id": session.request_id,
            "duration_ms": int((time.time() - session.start_time) * 1000),
            "agent_count": len(session.nodes) - 1,  # Exclude request node
            "flow_order": session.flow_order,
            "status": status,
        }

        logger.info(f"[FlowTracker] Session ended: {session.request_id}")
        self.current_session = None
        return summary

    def get_flow_trace(self) -> list[str]:
        """Get the ordered list of flow IDs in current session."""
        if not self.current_session:
            return []
        return self.sessions[self.current_session].flow_order.copy()

    def get_node(self, flow_id: str) -> Optional[FlowNode]:
        """Get a specific node by flow_id."""
        if not self.current_session:
            return None
        return self.sessions[self.current_session].nodes.get(flow_id)

    def _generate_id(self, agent_type: AgentType) -> str:
        """Generate a unique ID for an agent type."""
        if agent_type == AgentType.REQUEST:
            # Use timestamp for request IDs
            return f"{agent_type.value}-{int(time.time())}"
        else:
            # Use counter for other agent types
            self.counters[agent_type.value] += 1
            return f"{agent_type.value}-{self.counters[agent_type.value]:03d}"

    def reset_counters(self):
        """Reset counters for a new session."""
        self.counters = defaultdict(int)
