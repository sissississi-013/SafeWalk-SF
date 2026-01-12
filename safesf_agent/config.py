"""Configuration for SafeSF Agent."""

import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# API Keys
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
SNOWLEOPARD_API_KEY = os.getenv("SNOWLEOPARD_API_KEY")
SNOWLEOPARD_DATAFILE_ID = os.getenv("SNOWLEOPARD_DATAFILE_ID")

# Paths
PROJECT_ROOT = Path(__file__).parent.parent
PROMPTS_DIR = Path(__file__).parent / "prompts"
LOGS_DIR = PROJECT_ROOT / "logs"

# WebSocket Configuration
WEBSOCKET_HOST = os.getenv("WEBSOCKET_HOST", "localhost")
WEBSOCKET_PORT = int(os.getenv("WEBSOCKET_PORT", "8765"))

# Database Schema Reference (for prompts)
DATABASE_SCHEMA = """
AVAILABLE TABLES IN SAFESF DATABASE:

1. violent_crimes (18,000 records)
   - Columns: latitude, longitude, incident_datetime, incident_category, incident_subcategory, incident_description, resolution, analysis_neighborhood, police_district
   - Categories: Homicide, Assault, Robbery, Rape, Weapons

2. property_crimes (13,247 records)
   - Columns: latitude, longitude, incident_datetime, incident_category, incident_subcategory, analysis_neighborhood, police_district
   - Categories: Burglary, Motor Vehicle Theft

3. encampments (9,582 records)
   - Columns: latitude, longitude, requested_datetime, service_subtype, address, analysis_neighborhood, police_district, status_description
   - 311 Encampment reports

4. traffic_injuries (8,011 records)
   - Columns: latitude, longitude, collision_datetime, collision_severity, type_of_collision, number_killed, number_injured, analysis_neighborhood, police_district
   - Severity levels: Complaint of Pain, Other Visible, Severe

5. traffic_fatalities (345 records)
   - Columns: latitude, longitude, collision_datetime, collision_type, deceased_type, age, sex, analysis_neighborhood, police_district
   - Deceased types: Pedestrian, Driver, Bicyclist

6. fire_incidents (117 records)
   - Columns: latitude, longitude, alarm_datetime, primary_situation, address, neighborhood_district, fire_fatalities, fire_injuries, civilian_fatalities, civilian_injuries

7. neighborhoods (41 records)
   - Columns: name, police_district
   - Reference table for SF neighborhoods

8. incident_categories (15 records)
   - Columns: category, severity_weight (0-100), category_type
   - Used for safety scoring
"""

def validate_config():
    """Validate required configuration is present."""
    missing = []
    if not ANTHROPIC_API_KEY:
        missing.append("ANTHROPIC_API_KEY")
    if not SNOWLEOPARD_API_KEY:
        missing.append("SNOWLEOPARD_API_KEY")
    if not SNOWLEOPARD_DATAFILE_ID:
        missing.append("SNOWLEOPARD_DATAFILE_ID")

    if missing:
        raise ValueError(f"Missing required environment variables: {', '.join(missing)}")

    return True
