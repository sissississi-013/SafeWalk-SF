/**
 * API route for query suggestions using Anthropic Haiku.
 * Returns 3-8 relevant query suggestions based on user input.
 */

import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { NextRequest, NextResponse } from 'next/server';

const SYSTEM_PROMPT = `You are a query suggestion assistant for SafeSF, a San Francisco safety analysis application.

## About SafeSF
SafeSF is a multi-agent system that analyzes safety data for San Francisco locations. Users can ask natural language questions about:
- Crime incidents (violent crimes, property crimes)
- Traffic safety (injuries, fatalities)
- Homeless encampments
- Fire incidents

## Available Data
| Table | Description | Key Fields |
|-------|-------------|------------|
| violent_crimes | Homicide, Assault, Robbery, Rape, Weapons | incident_category, analysis_neighborhood, incident_datetime |
| property_crimes | Burglary, Motor Vehicle Theft, Larceny | incident_category, analysis_neighborhood |
| encampments | 311 Encampment reports | address, service_subtype, police_district |
| traffic_injuries | Vehicle collision injuries | collision_severity, type_of_collision |
| traffic_fatalities | Traffic deaths | collision_type, deceased_type |
| fire_incidents | Fires with casualties | primary_situation, civilian_fatalities |

## How the System Works
1. **Location Resolver Agent**: Converts place names to GPS coordinates (e.g., "Ferry Building" → lat/lng)
2. **Data Agent**: Queries the database using Snow Leopard AI (natural language to SQL)
3. **Summary Agent**: Analyzes data and generates safety scores (0-100)

Users do NOT need to specify coordinates - the Location Resolver handles that automatically.

## Example Queries That Work Well
- "Is it safe near Ferry Building?"
- "Show me crime in Tenderloin"
- "Find robberies in Mission district"
- "What's the safety rating for Chinatown?"
- "Find encampments on Market Street"
- "Show me car break-ins near Fisherman's Wharf"
- "Are there pedestrian fatalities near Van Ness?"
- "How dangerous is Union Square at night?"
- "Count assaults by neighborhood"
- "Find traffic injuries near Golden Gate Park"

## Your Task
Given the user's partial input, suggest 3-8 relevant queries they might want to ask.

## Rules
1. Return ONLY a JSON array of query strings - no other text
2. Suggest 3-8 queries (minimum 3, maximum 8)
3. Make queries natural and conversational
4. Do NOT include coordinates or technical details - keep it simple
5. Focus on San Francisco locations and safety topics
6. If input is empty or very short, suggest popular/common queries
7. If input mentions a location, suggest queries about that location
8. If input mentions a crime type, suggest queries about that crime type
9. Vary the query types (safety checks, incident searches, neighborhood analysis)

## Response Format
Return ONLY a valid JSON array like:
["query 1", "query 2", "query 3"]

No markdown, no explanation, just the JSON array.`;

export async function POST(request: NextRequest) {
  try {
    const { input } = await request.json();

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY not configured' },
        { status: 500 }
      );
    }

    const userPrompt = input?.trim()
      ? `User is typing: "${input}"\n\nSuggest relevant queries based on their input.`
      : `User has not typed anything yet. Suggest popular/common queries to get started.`;

    const { text } = await generateText({
      model: anthropic('claude-3-5-haiku-latest'),
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
    });

    // Parse the JSON response
    let suggestions: string[] = [];
    try {
      // Clean up the response - remove any markdown or extra text
      const cleanedText = text.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '');
      suggestions = JSON.parse(cleanedText);

      // Validate it's an array of strings
      if (!Array.isArray(suggestions)) {
        throw new Error('Response is not an array');
      }

      // Filter to only strings and limit to 8
      suggestions = suggestions
        .filter((s): s is string => typeof s === 'string')
        .slice(0, 8);

      // Ensure minimum of 3 suggestions
      if (suggestions.length < 3) {
        suggestions = [
          "Is it safe near Ferry Building?",
          "Show me crime in Tenderloin",
          "Find encampments in Mission district",
          ...suggestions
        ].slice(0, 8);
      }
    } catch (parseError) {
      console.error('[Suggestions] Failed to parse response:', text);
      // Return default suggestions if parsing fails
      suggestions = [
        "Is it safe near Ferry Building?",
        "Show me crime in Tenderloin",
        "Find robberies in Mission district",
        "What's the safety rating for Chinatown?",
        "Find encampments on Market Street",
      ];
    }

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error('[Suggestions] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate suggestions' },
      { status: 500 }
    );
  }
}
