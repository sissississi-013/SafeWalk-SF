#!/usr/bin/env python3
"""
SafeSF Agent - CLI Entry Point

A multi-agent system for San Francisco safety data queries.
Uses Snow Leopard API to query safety databases with natural language.
"""

import asyncio
import json
import logging
import sys
from datetime import datetime

from safesf_agent.agent import SafeSFAgent
from safesf_agent.utils.event_emitter import EventEmitter, Event
from safesf_agent.config import validate_config


def setup_logging(debug: bool = False):
    """Setup logging configuration."""
    level = logging.DEBUG if debug else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )


def print_header():
    """Print application header."""
    print("""
    ╔═══════════════════════════════════════════════════════════════╗
    ║                     SafeSF Agent                              ║
    ║        San Francisco Safety Data Query System                 ║
    ╠═══════════════════════════════════════════════════════════════╣
    ║  Powered by Snow Leopard + Claude Agent SDK                   ║
    ╚═══════════════════════════════════════════════════════════════╝
    """)


def print_event(event: Event):
    """Print event to console."""
    event_type = event.type.value
    data = event.data

    # Format based on event type
    if event_type == "session_started":
        print(f"\n[Session] Started: {data.get('request_id')}")
    elif event_type == "agent_spawned":
        print(f"  [+] Agent: {data.get('agent_id')} ({data.get('agent_type')})")
        print(f"      Input: {data.get('input_id')}")
        print(f"      Task: {data.get('description')}")
    elif event_type == "tool_called":
        print(f"      Tool: {data.get('tool_name')} called")
    elif event_type == "tool_result":
        print(f"      Result: {data.get('row_count')} rows returned")
    elif event_type == "data_received":
        print(f"      Data: {data.get('row_count')} points with {len(data.get('coordinates', []))} coordinates")
    elif event_type == "agent_complete":
        print(f"  [-] Agent {data.get('agent_id')} completed ({data.get('status')})")
    elif event_type == "session_complete":
        print(f"\n[Session] Completed in {data.get('duration_ms')}ms")
        print(f"  Flow: {' -> '.join(data.get('flow_trace', []))}")


def print_result(result: dict):
    """Print the final result."""
    print("\n" + "=" * 65)
    print("RESULTS")
    print("=" * 65)

    if not result.get("success"):
        print(f"\nError: {result.get('error')}")
        return

    # Print flow trace
    flow_trace = result.get("flow_trace", [])
    print(f"\nFlow Trace: {' -> '.join(flow_trace)}")
    print(f"Duration: {result.get('duration_ms', 0)}ms")

    # Print data summary
    data = result.get("data", [])
    coordinates = result.get("coordinates", [])
    print(f"\nData Retrieved: {len(data)} records")
    print(f"Coordinates: {len(coordinates)} points")

    if data:
        print("\Data (first 3 records):")
        for i, record in enumerate(data[:3], 1):
            print(f"  {i}. {json.dumps(record, default=str)[:500]}...")

    # Print coordinates (first 10)
    if coordinates:
        print(f"\nCoordinates (first 10):")
        for coord in coordinates[:10]:
            print(f"  - lat: {coord.get('latitude')}, long: {coord.get('longitude')}")

    # Print analysis
    if result.get("analysis"):
        print(f"\nAnalysis:")
        print(f"  {result.get('analysis')}")

    if result.get("safety_score"):
        print(f"\nSafety Score: {result.get('safety_score')}/100")

    if result.get("recommendations"):
        print("\nRecommendations:")
        for i, rec in enumerate(result.get("recommendations", []), 1):
            print(f"  {i}. {rec}")

    # Print SQL
    if result.get("sql"):
        print(f"\nGenerated SQL:")
        print(f"  {result.get('sql')[:200]}...")

    print("\n" + "=" * 65)


async def run_query(query: str, show_events: bool = True):
    """Run a single query."""
    # Create event emitter with console output
    event_emitter = EventEmitter()
    if show_events:
        event_emitter.add_listener(print_event)

    # Create agent and process query
    agent = SafeSFAgent(event_emitter=event_emitter)
    result = await agent.process_request(query)

    # Print result
    print_result(result)

    return result


async def interactive_mode():
    """Run in interactive mode."""
    print("\nInteractive Mode - Enter your safety questions")
    print("Type 'quit' or 'exit' to stop")
    print("Type 'help' for example queries")
    print("-" * 65)

    while True:
        try:
            query = input("\nYou: ").strip()

            if not query:
                continue

            if query.lower() in ["quit", "exit"]:
                print("\nGoodbye!")
                break

            if query.lower() == "help":
                print("""
Example queries:
  - "What crimes happened near lat 37.78, long -122.40?"
  - "Is it safe near Ferry Building?"
  - "Show me dangerous areas in the Mission"
  - "What are the safest neighborhoods in SF?"
  - "Traffic accidents in Tenderloin this month"
  - "Encampments near Union Square"
                """)
                continue

            await run_query(query)

        except KeyboardInterrupt:
            print("\n\nGoodbye!")
            break
        except EOFError:
            break


def main():
    """Main entry point."""
    import argparse

    parser = argparse.ArgumentParser(
        description="SafeSF Agent - San Francisco Safety Data Query System"
    )
    parser.add_argument(
        "query",
        nargs="?",
        help="Query to run (interactive mode if not provided)",
    )
    parser.add_argument(
        "--server",
        action="store_true",
        help="Run WebSocket server instead of CLI",
    )
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Enable debug logging",
    )
    parser.add_argument(
        "--no-events",
        action="store_true",
        help="Suppress event output",
    )

    args = parser.parse_args()

    setup_logging(args.debug)

    # Validate configuration
    try:
        validate_config()
    except ValueError as e:
        print(f"\nConfiguration Error: {e}")
        print("\nPlease set the following environment variables:")
        print("  - ANTHROPIC_API_KEY")
        print("  - SNOWLEOPARD_API_KEY")
        print("  - SNOWLEOPARD_DATAFILE_ID")
        print("\nOr copy .env.example to .env and fill in the values.")
        sys.exit(1)

    print_header()

    if args.server:
        # Run WebSocket server
        from safesf_agent.server import main as server_main
        server_main()
    elif args.query:
        # Run single query
        asyncio.run(run_query(args.query, show_events=not args.no_events))
    else:
        # Interactive mode
        asyncio.run(interactive_mode())


if __name__ == "__main__":
    main()
