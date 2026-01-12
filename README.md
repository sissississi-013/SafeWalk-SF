<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# SafeWalk SF

AI-powered safe pedestrian routing for San Francisco. Get real-time danger alerts and safety scores for your walking routes.

## Features

- **Safe Route Planning**: Find the safest walking route between two locations
- **Danger Zone Visualization**: See high-risk areas highlighted on the map
- **AI Safety Analysis**: Gemini-powered safety scoring for each route
- **Real-time Data**: Integration with SF Open Data for current incidents
- **Detailed Safety Info**: Crime statistics, lighting, crowd levels, and more

## Real Incident Database

SafeWalk SF uses a local SQLite database with over 49,000 real incident records from San Francisco:

- **Violent Crimes**: Assault, robbery, weapons offenses (filtered to last 60 days)
- **Property Crimes**: Theft, burglary, vehicle break-ins (filtered to last 60 days)
- **Homeless Encampments**: 311 reports showing encampment locations (all records, no date filter)
- **Traffic Injuries**: Pedestrian and cyclist collision data

The database is queried in real-time when you search for routes. Each route corridor is analyzed for nearby incidents, and the results are displayed as markers on the map.

## Safety Scoring

Routes are scored on a 0-10 scale based on actual incident data:

| Score | Rating | Description |
|-------|--------|-------------|
| 7-10 | Safe | Low crime density, well-traveled area |
| 5-7 | Generally Safe | Moderate activity, stay aware |
| 3-5 | Caution | Elevated crime, stick to main streets |
| 1-3 | High Risk | High crime density, consider alternatives |

### How the Safety Score is Calculated

The safety score uses logarithmic scaling based on per-kilometer incident density:

```
Combined Crime Rate = (violent_per_km * 1.0) + (property_per_km * 0.3)
                    + (encampment_per_km * 0.4) + (traffic_per_km * 0.2)

Density Score = 10 - 2.5 * ln(1 + Combined Crime Rate / 5)

Exposure Penalty = min(1.5, total_weighted_incidents * 0.01)

Final Score = max(1.0, min(9.5, Density Score - Exposure Penalty))
```

This formula ensures:
- Areas with zero incidents score around 9.5
- Moderate crime areas (15 violent/km) score around 5
- High crime areas (50+ violent/km) score around 2
- Scores never hit exactly 0 or 10, allowing for differentiation even in extreme cases

### How Homeless Activity is Evaluated

Homeless activity level is determined by encampment density per kilometer along the route:

| Encampments per km | Level |
|-------------------|-------|
| 10 or more | High |
| 3 to 10 | Moderate |
| Less than 3 | Low |

If encampment data is unavailable, violent crime density is used as a proxy (multiplied by 0.5) since high-crime areas often correlate with encampment presence.

### How Lighting is Evaluated

Lighting conditions are estimated based on crime density, since poorly-lit areas tend to have higher crime rates:

```
Lighting Score = 100 - (violent_per_km * 4) - (property_per_km * 1.5)
```

| Lighting Score | Level |
|---------------|-------|
| 70 or higher | Well-lit |
| 40 to 70 | Moderate |
| Below 40 | Poorly-lit |

### How Police Presence is Evaluated

Police presence is estimated using a balanced formula that accounts for patrol patterns:

```
Police Score = 60 - (violent_per_km * 1.5) + (property_per_km * 0.3)
```

| Police Score | Level |
|-------------|-------|
| 55 or higher | High |
| 35 to 55 | Moderate |
| Below 35 | Low |

High-crime areas often have increased patrols, but this does not necessarily make them safer for pedestrians.

## Map Visualization

When you search for a route, the map displays:

- **Green route**: Safest option based on incident data
- **Blue routes**: Alternative routes for comparison
- **Red markers**: Violent crime locations
- **Orange markers**: Property crime locations
- **Purple markers**: Homeless encampment locations
- **Red circles**: Crime hotspots with radius proportional to incident count

Click on any marker to see details about the incident type and location.

## Architecture

```
Frontend (React + Vite)          Backend (FastAPI)
       |                               |
       +------ REST API ---------------+
       |                               |
   Google Maps API              SQLite Database
   Gemini API                   (49,000+ incidents)
```

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.10+
- Google Maps API Key
- Gemini API Key

### Installation

```bash
# Clone the repository
git clone https://github.com/sissississi-013/SafeWalk-SF.git
cd SafeWalk-SF

# Install all dependencies (frontend + backend)
npm run setup
```

### Configuration

1. **Google Maps API Key**: Open `index.html` and replace `YOUR_GOOGLE_MAPS_API_KEY` with your actual Google Maps API key:
   ```html
   <script src="https://maps.googleapis.com/maps/api/js?key=YOUR_GOOGLE_MAPS_API_KEY&libraries=places,geometry"></script>
   ```

2. Copy `.env.local.example` to `.env.local` and add your API keys:
   ```
   GEMINI_API_KEY=your_gemini_api_key
   ```

3. (Optional) Copy `backend/.env.example` to `backend/.env` for AI queries:
   ```
   ANTHROPIC_API_KEY=your_anthropic_api_key
   ```

### Running the App

```bash
# Run both frontend and backend together
npm run dev:all

# Or run them separately:
npm run dev:frontend  # Frontend on http://localhost:5173
npm run dev:backend   # Backend on http://localhost:8000
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/danger-data` | GET | Get danger zones and spots for a route |
| `/api/danger-zones` | GET | Get all danger zones |
| `/api/danger-spots` | GET | Get all danger spots |
| `/api/analyze-routes` | POST | Analyze routes using real incident database |
| `/api/incidents` | GET | Fetch real-time incidents from SF Open Data |
| `/api/safety-score` | POST | Calculate safety score for a route |
| `/api/query` | POST | Natural language safety query (requires Anthropic API) |

## Tech Stack

**Frontend:**
- React 19 + TypeScript
- Vite
- Google Maps API
- Gemini API for route safety analysis
- Tailwind CSS + Lucide Icons

**Backend:**
- FastAPI (Python)
- SQLite database with 49,000+ SF incident records
- Real-time route corridor analysis
- Hotspot detection and clustering
- SF Open Data API integration
- Optional: Anthropic Claude for NL queries

## Data Sources

- SF Police Department incident reports
- 311 encampment reports
- Traffic collision data
- Curated danger zones based on crime analysis

## Database Schema

The SQLite database (`extract_sf_data/safesf.db`) contains four tables:

- `violent_crimes`: Assault, robbery, homicide, weapons offenses
- `property_crimes`: Theft, burglary, vehicle theft
- `encampments`: Homeless encampment reports from 311
- `traffic_injuries`: Pedestrian and cyclist collisions

Each table includes latitude, longitude, datetime, category, and neighborhood fields for filtering and visualization.

## License

MIT
