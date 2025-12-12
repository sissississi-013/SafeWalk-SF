"""WebSocket server for SafeSF agent."""

import asyncio
import json
import logging
from datetime import datetime
from typing import Optional

import websockets
from websockets.server import WebSocketServerProtocol

from safesf_agent.config import WEBSOCKET_HOST, WEBSOCKET_PORT, validate_config
from safesf_agent.agent import SafeSFAgent
from safesf_agent.utils.event_emitter import EventEmitter

logger = logging.getLogger(__name__)


class SafeSFWebSocketServer:
    """WebSocket server for real-time agent interaction."""

    def __init__(self, host: str = WEBSOCKET_HOST, port: int = WEBSOCKET_PORT):
        """
        Initialize the WebSocket server.

        Args:
            host: Host address to bind to
            port: Port number to listen on
        """
        self.host = host
        self.port = port
        self.clients: set[WebSocketServerProtocol] = set()
        logger.info(f"[WebSocketServer] Initialized for {host}:{port}")

    async def handle_client(self, websocket: WebSocketServerProtocol):
        """Handle a WebSocket client connection."""
        self.clients.add(websocket)
        client_id = id(websocket)
        logger.info(f"[WebSocketServer] Client connected: {client_id}")

        try:
            async for message in websocket:
                await self._process_message(websocket, message)
        except websockets.exceptions.ConnectionClosed:
            logger.info(f"[WebSocketServer] Client disconnected: {client_id}")
        finally:
            self.clients.discard(websocket)

    async def _process_message(
        self,
        websocket: WebSocketServerProtocol,
        message: str,
    ):
        """Process an incoming WebSocket message."""
        try:
            data = json.loads(message)
            action = data.get("action")

            if action == "query":
                await self._handle_query(websocket, data)
            elif action == "ping":
                await websocket.send(json.dumps({"type": "pong"}))
            else:
                await websocket.send(json.dumps({
                    "type": "error",
                    "error": f"Unknown action: {action}",
                }))

        except json.JSONDecodeError:
            await websocket.send(json.dumps({
                "type": "error",
                "error": "Invalid JSON",
            }))
        except Exception as e:
            logger.error(f"[WebSocketServer] Error processing message: {e}")
            await websocket.send(json.dumps({
                "type": "error",
                "error": str(e),
            }))

    async def _handle_query(
        self,
        websocket: WebSocketServerProtocol,
        data: dict,
    ):
        """Handle a safety query request."""
        user_query = data.get("query", "")

        if not user_query:
            await websocket.send(json.dumps({
                "type": "error",
                "error": "Missing 'query' field",
            }))
            return

        logger.info(f"[WebSocketServer] Processing query: {user_query[:100]}")

        # Create event emitter connected to this websocket
        event_emitter = EventEmitter(websocket=websocket)

        # Process the request
        try:
            agent = SafeSFAgent(event_emitter=event_emitter)
            result = await agent.process_request(user_query)

            # Send final result
            await websocket.send(json.dumps({
                "type": "final_result",
                **result,
            }, default=str))

        except Exception as e:
            logger.error(f"[WebSocketServer] Query error: {e}")
            await websocket.send(json.dumps({
                "type": "error",
                "error": str(e),
            }))

    async def start(self):
        """Start the WebSocket server."""
        validate_config()

        logger.info(f"[WebSocketServer] Starting on ws://{self.host}:{self.port}")

        async with websockets.serve(
            self.handle_client,
            self.host,
            self.port,
        ):
            logger.info(f"[WebSocketServer] Listening on ws://{self.host}:{self.port}")
            await asyncio.Future()  # Run forever


async def run_server(host: str = WEBSOCKET_HOST, port: int = WEBSOCKET_PORT):
    """Run the WebSocket server."""
    server = SafeSFWebSocketServer(host=host, port=port)
    await server.start()


def main():
    """Entry point for running the server."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )

    print(f"""
    ╔═══════════════════════════════════════════════════════╗
    ║           SafeSF WebSocket Server                     ║
    ╠═══════════════════════════════════════════════════════╣
    ║  Listening on: ws://{WEBSOCKET_HOST}:{WEBSOCKET_PORT:<5}                   ║
    ║                                                       ║
    ║  Send JSON messages:                                  ║
    ║  {{"action": "query", "query": "your question"}}       ║
    ║                                                       ║
    ║  Press Ctrl+C to stop                                 ║
    ╚═══════════════════════════════════════════════════════╝
    """)

    try:
        asyncio.run(run_server())
    except KeyboardInterrupt:
        print("\nServer stopped.")


if __name__ == "__main__":
    main()
