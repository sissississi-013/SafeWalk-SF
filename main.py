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

from safesf_agent.agent import process_request
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


def print_result(result: dict):
    """Print the final result."""
    print("\n" + "=" * 65)
    print("RESULTS")
    print("=" * 65)

    if not result.get("success"):
        print(f"\nError: {result.get('error')}")
        return

    # Print safety score
    if result.get("safety_score") is not None:
        score = result.get("safety_score")
        rating = result.get("rating", "Unknown")
        color = result.get("rating_color", "")
        print(f"\nSafety Score: {score}/100 ({rating})")

    # Print location
    location = result.get("location")
    if location:
        print(f"\nLocation: {location.get('name')}")
        print(f"  Neighborhood: {location.get('neighborhood')}")
        print(f"  Coordinates: {location.get('latitude')}, {location.get('longitude')}")

    # Print analysis
    analysis = result.get("analysis")
    if analysis:
        print(f"\nAnalysis:")
        if isinstance(analysis, dict):
            print(f"  Overview: {analysis.get('overview', '')}")
            concerns = analysis.get('primary_concerns', [])
            if concerns:
                print(f"  Primary Concerns: {', '.join(concerns)}")
            breakdown = analysis.get('incident_breakdown', {})
            if breakdown:
                print(f"  Incident Breakdown:")
                for key, val in breakdown.items():
                    print(f"    - {key}: {val}")
        else:
            print(f"  {analysis}")

    # Print recommendations
    recommendations = result.get("recommendations", [])
    if recommendations:
        print("\nRecommendations:")
        for i, rec in enumerate(recommendations, 1):
            print(f"  {i}. {rec}")

    # Print data summary
    data = result.get("data", [])
    coordinates = result.get("coordinates", [])
    if data or coordinates:
        print(f"\nData Retrieved: {len(data)} records, {len(coordinates)} coordinates")

    # Print SQL if available
    if result.get("sql"):
        print(f"\nGenerated SQL:")
        sql = result.get("sql")
        print(f"  {sql[:200]}..." if len(sql) > 200 else f"  {sql}")

    # Print duration
    if result.get("duration_ms"):
        print(f"\nCompleted in {result.get('duration_ms')}ms")

    print("\n" + "=" * 65)


async def run_query(query: str):
    """Run a single query."""
    print(f"\nProcessing: {query}")
    print("-" * 65)

    result = await process_request({"query": query})
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
  - "Is it safe near Ferry Building?"
  - "How dangerous is the Mission District?"
  - "What crimes happened near Union Square?"
  - "Show me incidents in Tenderloin"
  - "Is it safe to walk in SOMA at night?"
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
        asyncio.run(run_query(args.query))
    else:
        # Interactive mode
        asyncio.run(interactive_mode())


if __name__ == "__main__":
    main()
