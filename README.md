# SafeSF - Stay Safe in San Francisco!
<p align="center">
  <img src="https://github.com/user-attachments/assets/a312a514-3c23-462c-9bd7-bcbb6549e41e" alt="Safe SF" width="400" />

Multi-agent system for querying San Francisco safety data using natural language. Powered by Claude Agent SDK and Snow Leopard AI.

<img width="3584" height="2158" alt="New Results page" src="https://github.com/user-attachments/assets/02cb46fa-7100-4f77-aa0b-117e1bc244f6" />

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

---
<p align="center">
  <img src="public/logo.png" alt="SafeWalk SF" width="400" />
  
<p align="center">
  <strong>Pedestrian Route Safety</strong><br>
  Interactive web app for finding safe walking routes in San Francisco.<br>
  Uses real incident data to score and visualize route safety.
</p>
  
</p>
<img width="1470" height="799" alt="image" src="https://github.com/user-attachments/assets/e0845ce6-09f6-40d6-87d6-490346ab36ce" />

## Features

- **Safe Route Planning**: Find the safest walking route between two locations
- **Custom Route Drawing**: Draw your own route on the map with automatic road snapping
- **Real-time Database**: 49,000+ incident records queried in real-time
- **Map Visualization**: See incidents and hotspots along your route
- **Safety Scoring**: Routes scored on a 0-10 scale based on actual crime data
- **Resizable Sidebar**: Drag to resize the sidebar panel to your preference
- **Collapsible Search**: Search header collapses when scrolling for more map visibility

## Custom Route Drawing

Draw your own walking route and get instant safety analysis:

<img width="1470" height="798" alt="image" src="https://github.com/user-attachments/assets/ca3186ff-2245-43eb-929b-31ca31853b0e" />

1. Click **"Draw Route"** to enter drawing mode
2. Click points on the map to create your path
3. Double-click or click **"Finish"** to complete
4. Your route automatically snaps to actual roads using Google Directions API
5. View safety analysis with the same metrics as generated routes:
   - Safety score (0-10)
   - Time and distance estimates
   - Homeless activity, lighting, and police presence indicators
   - Incident breakdown (violent crimes, property crimes, encampments, traffic)
   - Pros, cons, and recommendations

## Running SafeWalk SF

### Prerequisites

- Node.js 18+
- Python 3.10+
- Google Maps API Key
- Gemini API Key

### Configuration

1. **Google Maps API Key**: Open `index.html` and replace `YOUR_GOOGLE_MAPS_API_KEY` with your actual Google Maps API key

2. Copy `.env.local.example` to `.env.local` and add your Gemini API key

### Start the App

```bash
# Install dependencies
npm run setup

# Run frontend and backend together
npm run dev:all
```

Frontend runs on http://localhost:5173, backend on http://localhost:8000

## Safety Scoring

Routes are scored on a 0-10 scale:

| Score | Rating | Description |
|-------|--------|-------------|
| 7-10 | Safe | Low crime density, well-traveled area |
| 5-7 | Generally Safe | Moderate activity, stay aware |
| 3-5 | Caution | Elevated crime, stick to main streets |
| 1-3 | High Risk | High crime density, consider alternatives |

### How the Safety Score is Calculated

The score uses logarithmic scaling based on per-kilometer incident density:

```
Combined Crime Rate = (violent_per_km * 1.0) + (property_per_km * 0.3)
                    + (encampment_per_km * 0.4) + (traffic_per_km * 0.2)

Density Score = 10 - 2.5 * ln(1 + Combined Crime Rate / 5)

Exposure Penalty = min(1.5, total_weighted_incidents * 0.01)

Final Score = max(1.0, min(9.5, Density Score - Exposure Penalty))
```

### How Homeless Activity is Evaluated

| Encampments per km | Level |
|-------------------|-------|
| 10 or more | High |
| 3 to 10 | Moderate |
| Less than 3 | Low |

If encampment data is unavailable, violent crime density is used as a proxy (multiplied by 0.5).

### How Lighting is Evaluated

Lighting is estimated based on crime density:

```
Lighting Score = 100 - (violent_per_km * 4) - (property_per_km * 1.5)
```

| Lighting Score | Level |
|---------------|-------|
| 70 or higher | Well-lit |
| 40 to 70 | Moderate |
| Below 40 | Poorly-lit |

### How Police Presence is Evaluated

```
Police Score = 60 - (violent_per_km * 1.5) + (property_per_km * 0.3)
```

| Police Score | Level |
|-------------|-------|
| 55 or higher | High |
| 35 to 55 | Moderate |
| Below 35 | Low |

## Map Visualization

When you search for a route, the map displays:

- **Green route**: Safest option based on incident data
- **Blue routes**: Alternative routes for comparison
- **Red markers**: Violent crime locations
- **Orange markers**: Property crime locations
- **Purple markers**: Homeless encampment locations
- **Red circles**: Crime hotspots with radius proportional to incident count

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/analyze-routes` | POST | Analyze routes using real incident database |
| `/api/danger-data` | GET | Get danger zones and spots for a route |
| `/api/safety-score` | POST | Calculate safety score for a route |

## License

MIT
