# SafeSF - San Francisco Safety Analysis

Multi-agent system for querying San Francisco safety data using natural language. Powered by Claude Agent SDK and Snow Leopard AI.

## Setup

### 1. Upload Database to Snow Leopard

Upload the SQLite database located at:
```
extract_sf_data/safesf.db
```

Get your Snow Leopard API key and Datafile ID from [snowleopard.ai](https://snowleopard.ai)

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your API keys:
```
ANTHROPIC_API_KEY=your_anthropic_key
SNOWLEOPARD_API_KEY=your_snowleopard_key
SNOWLEOPARD_DATAFILE_ID=your_datafile_id
```

### 3. Install & Run

**WebSocket Server:**
```bash
python3 -m venv venv && source venv/bin/activate && pip install -e . && python main.py --server
```

**Web App** (in separate terminal):
```bash
cd web && pnpm install && pnpm dev
```

## Database Schema

| Table | Records | Description |
|-------|---------|-------------|
| violent_crimes | 18,000 | Homicide, Assault, Robbery, Rape, Weapons |
| property_crimes | 13,247 | Burglary, Motor Vehicle Theft |
| encampments | 9,582 | 311 Encampment reports |
| traffic_injuries | 8,011 | Collision injuries |
| traffic_fatalities | 345 | Traffic deaths since 2014 |
| fire_incidents | 117 | Fires with casualties |

## Example Queries

Try these in the SafeSF app:

### Location-Based Safety
```
Is it safe near Ferry Building?
How dangerous is Union Square at night?
Can I walk safely near Dolores Park?
```

### Neighborhood Analysis
```
Show me crime in Tenderloin
Find robberies in Mission district
What's the safety rating for Chinatown?
```

### Specific Incidents
```
Find encampments on Market Street
Show me car break-ins near Fisherman's Wharf
Are there pedestrian fatalities near Van Ness?
```

### Data Queries (via Snow Leopard)
```
Find violent crimes within 0.005 degrees of latitude 37.7880, longitude -122.4075
Count Assault by neighborhood
Find encampments where address contains Market
Top 5 neighborhoods by violent crime count
Find pedestrian fatalities from traffic_fatalities
Find Homicide incidents in 2024
Count encampments by police_district ORDER BY count DESC
Find traffic injuries where collision_severity = 'Injury (Severe)'
Find violent crimes with resolution containing Arrest
Find Burglary and Motor Vehicle Theft in Mission LIMIT 50
```

## Query Tips

- **Radius**: Use `0.005 degrees` (~500m) for city center, `0.01 degrees` (~1km) for wider areas
- **Neighborhoods**: Use exact names like "Tenderloin", "Mission", "Financial District/South Beach"
- **Streets**: Query encampments by address: `where address contains Market`
- **Categories**: "Assault", "Robbery", "Homicide", "Burglary", "Motor Vehicle Theft"
- **Police Districts**: TENDERLOIN, SOUTHERN, MISSION, NORTHERN, CENTRAL, BAYVIEW

## Architecture

```
User Query → Orchestrator Agent
                    ↓
            Location Resolver (WebSearch)
                    ↓
            Data Agent (Snow Leopard API)
                    ↓
            Summary Agent (Safety Score)
                    ↓
            JSON Response + Heat Map
```

## License

MIT
