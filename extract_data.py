#!/usr/bin/env python3
"""
SafeSF Data Extraction Script
Extracts safety-relevant data from SF Open Data API into SQLite database
Target: <10MB database with multiple tables for route safety assessment
"""

import os
import sqlite3
import requests
from dotenv import load_dotenv
from typing import Generator, Dict, Any, List
import json

# Load environment variables
load_dotenv()

# Configuration
API_KEY_ID = os.getenv('API_KEY_ID')
API_KEY_SECRET = os.getenv('API_KEY_SECRET')
BASE_URL = "https://data.sfgov.org/resource"
DB_PATH = "safesf.db"

# Dataset IDs
DATASETS = {
    'police_incidents': 'wg3w-h783',
    'traffic_injuries': 'ubvf-ztfx',
    'traffic_fatalities': 'dau3-4s8f',
    'fire_incidents': 'wr8u-xric',
    '311_cases': 'vw6y-z8j6'
}

# SQL Schema
SCHEMA = '''
-- Violent crimes (Homicide, Assault, Robbery, Rape, Weapons)
CREATE TABLE IF NOT EXISTS violent_crimes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    incident_datetime TEXT NOT NULL,
    incident_category TEXT NOT NULL,
    incident_subcategory TEXT,
    incident_description TEXT,
    resolution TEXT,
    analysis_neighborhood TEXT,
    police_district TEXT
);

-- Property crimes (Burglary, Motor Vehicle Theft)
CREATE TABLE IF NOT EXISTS property_crimes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    incident_datetime TEXT NOT NULL,
    incident_category TEXT NOT NULL,
    incident_subcategory TEXT,
    analysis_neighborhood TEXT,
    police_district TEXT
);

-- Encampments from 311 reports
CREATE TABLE IF NOT EXISTS encampments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    requested_datetime TEXT NOT NULL,
    service_subtype TEXT,
    address TEXT,
    analysis_neighborhood TEXT,
    police_district TEXT,
    status_description TEXT
);

-- Traffic fatalities (all records)
CREATE TABLE IF NOT EXISTS traffic_fatalities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    collision_datetime TEXT NOT NULL,
    collision_type TEXT,
    deceased_type TEXT,
    age INTEGER,
    sex TEXT,
    analysis_neighborhood TEXT,
    police_district TEXT
);

-- Traffic injuries (2023+)
CREATE TABLE IF NOT EXISTS traffic_injuries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    collision_datetime TEXT NOT NULL,
    collision_severity TEXT,
    type_of_collision TEXT,
    number_killed INTEGER DEFAULT 0,
    number_injured INTEGER DEFAULT 0,
    analysis_neighborhood TEXT,
    police_district TEXT
);

-- Fire incidents with casualties
CREATE TABLE IF NOT EXISTS fire_incidents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    latitude REAL,
    longitude REAL,
    alarm_datetime TEXT NOT NULL,
    primary_situation TEXT,
    address TEXT,
    neighborhood_district TEXT,
    fire_fatalities INTEGER DEFAULT 0,
    fire_injuries INTEGER DEFAULT 0,
    civilian_fatalities INTEGER DEFAULT 0,
    civilian_injuries INTEGER DEFAULT 0
);

-- Reference: Neighborhoods
CREATE TABLE IF NOT EXISTS neighborhoods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    police_district TEXT
);

-- Reference: Incident categories with severity weights
CREATE TABLE IF NOT EXISTS incident_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT UNIQUE NOT NULL,
    severity_weight INTEGER NOT NULL,
    category_type TEXT NOT NULL
);
'''

# Severity weights for safety scoring
INCIDENT_CATEGORIES = [
    ('Homicide', 100, 'violent'),
    ('Rape', 95, 'violent'),
    ('Robbery', 90, 'violent'),
    ('Assault', 85, 'violent'),
    ('Weapons Offense', 80, 'violent'),
    ('Weapons Carrying Etc', 80, 'violent'),
    ('Burglary', 60, 'property'),
    ('Motor Vehicle Theft', 55, 'property'),
    ('Larceny Theft', 40, 'property'),
    ('Encampment', 30, 'environmental'),
    ('Traffic Fatality', 100, 'traffic'),
    ('Traffic Injury - Severe', 70, 'traffic'),
    ('Traffic Injury - Other Visible', 50, 'traffic'),
    ('Traffic Injury - Complaint of Pain', 30, 'traffic'),
    ('Fire - Casualty', 80, 'fire'),
]


class SFDataExtractor:
    def __init__(self, db_path: str = DB_PATH):
        self.db_path = db_path
        self.session = requests.Session()
        self.session.auth = (API_KEY_ID, API_KEY_SECRET)
        self.conn = None

    def create_database(self):
        """Create SQLite database with all tables"""
        # Remove existing database
        if os.path.exists(self.db_path):
            os.remove(self.db_path)

        self.conn = sqlite3.connect(self.db_path)
        cursor = self.conn.cursor()
        cursor.executescript(SCHEMA)

        # Populate incident categories
        cursor.executemany(
            'INSERT INTO incident_categories (category, severity_weight, category_type) VALUES (?, ?, ?)',
            INCIDENT_CATEGORIES
        )
        self.conn.commit()
        print("Database schema created")

    def fetch_data(self, dataset_id: str, params: Dict[str, str],
                   limit: int = 50000) -> List[Dict]:
        """Fetch data from API with pagination"""
        all_data = []
        offset = 0
        batch_size = 10000

        while offset < limit:
            current_limit = min(batch_size, limit - offset)
            params['$limit'] = str(current_limit)
            params['$offset'] = str(offset)

            url = f"{BASE_URL}/{dataset_id}.json"
            response = self.session.get(url, params=params)
            response.raise_for_status()

            data = response.json()
            if not data:
                break

            all_data.extend(data)
            print(f"  Fetched {len(all_data)} records...")

            if len(data) < current_limit:
                break
            offset += batch_size

        return all_data

    def extract_violent_crimes(self):
        """Extract violent crime data from police incidents (2024)"""
        print("\nExtracting violent crimes...")

        params = {
            '$where': "incident_datetime > '2024-01-01' AND latitude IS NOT NULL "
                      "AND incident_category in ('Homicide', 'Assault', 'Robbery', "
                      "'Rape', 'Weapons Offense', 'Weapons Carrying Etc')",
            '$select': 'latitude,longitude,incident_datetime,incident_category,'
                       'incident_subcategory,incident_description,resolution,'
                       'analysis_neighborhood,police_district',
            '$order': 'incident_datetime DESC'
        }

        data = self.fetch_data(DATASETS['police_incidents'], params, limit=18000)

        cursor = self.conn.cursor()
        inserted = 0
        for r in data:
            try:
                lat = float(r.get('latitude', 0))
                lon = float(r.get('longitude', 0))
                if lat == 0 or lon == 0:
                    continue
                cursor.execute('''
                    INSERT INTO violent_crimes
                    (latitude, longitude, incident_datetime, incident_category,
                     incident_subcategory, incident_description, resolution,
                     analysis_neighborhood, police_district)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    lat, lon,
                    r.get('incident_datetime'),
                    r.get('incident_category'),
                    r.get('incident_subcategory'),
                    r.get('incident_description'),
                    r.get('resolution'),
                    r.get('analysis_neighborhood'),
                    r.get('police_district')
                ))
                inserted += 1
            except Exception as e:
                pass

        self.conn.commit()
        print(f"  Inserted {inserted} violent crime records")
        return inserted

    def extract_property_crimes(self):
        """Extract property crime data (last 4 months to fit size limit)"""
        print("\nExtracting property crimes...")

        params = {
            '$where': "incident_datetime > '2024-08-01' AND latitude IS NOT NULL "
                      "AND incident_category in ('Burglary', 'Motor Vehicle Theft')",
            '$select': 'latitude,longitude,incident_datetime,incident_category,'
                       'incident_subcategory,analysis_neighborhood,police_district',
            '$order': 'incident_datetime DESC'
        }

        data = self.fetch_data(DATASETS['police_incidents'], params, limit=15000)

        cursor = self.conn.cursor()
        inserted = 0
        for r in data:
            try:
                lat = float(r.get('latitude', 0))
                lon = float(r.get('longitude', 0))
                if lat == 0 or lon == 0:
                    continue
                cursor.execute('''
                    INSERT INTO property_crimes
                    (latitude, longitude, incident_datetime, incident_category,
                     incident_subcategory, analysis_neighborhood, police_district)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ''', (
                    lat, lon,
                    r.get('incident_datetime'),
                    r.get('incident_category'),
                    r.get('incident_subcategory'),
                    r.get('analysis_neighborhood'),
                    r.get('police_district')
                ))
                inserted += 1
            except Exception as e:
                pass

        self.conn.commit()
        print(f"  Inserted {inserted} property crime records")
        return inserted

    def extract_encampments(self):
        """Extract encampment reports from 311 data (2024)"""
        print("\nExtracting encampments...")

        params = {
            '$where': "requested_datetime > '2024-01-01' AND lat IS NOT NULL "
                      "AND service_name='Encampments'",
            '$select': 'lat,long,requested_datetime,service_subtype,address,'
                       'police_district,status_description',
            '$order': 'requested_datetime DESC'
        }

        data = self.fetch_data(DATASETS['311_cases'], params, limit=12000)

        cursor = self.conn.cursor()
        inserted = 0
        for r in data:
            try:
                lat = float(r.get('lat', 0))
                lon = float(r.get('long', 0))
                if lat == 0 or lon == 0:
                    continue
                cursor.execute('''
                    INSERT INTO encampments
                    (latitude, longitude, requested_datetime, service_subtype,
                     address, analysis_neighborhood, police_district, status_description)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    lat, lon,
                    r.get('requested_datetime'),
                    r.get('service_subtype'),
                    r.get('address'),
                    None,  # analysis_neighborhood not in 311 data
                    r.get('police_district'),
                    r.get('status_description')
                ))
                inserted += 1
            except Exception as e:
                pass

        self.conn.commit()
        print(f"  Inserted {inserted} encampment records")
        return inserted

    def extract_traffic_fatalities(self):
        """Extract all traffic fatalities"""
        print("\nExtracting traffic fatalities...")

        params = {
            '$where': 'latitude IS NOT NULL',
            '$select': 'latitude,longitude,collision_datetime,collision_type,'
                       'deceased,age,sex,analysis_neighborhood,police_district',
            '$order': 'collision_datetime DESC'
        }

        data = self.fetch_data(DATASETS['traffic_fatalities'], params, limit=1000)

        cursor = self.conn.cursor()
        inserted = 0
        for r in data:
            try:
                lat = float(r.get('latitude', 0))
                lon = float(r.get('longitude', 0))
                if lat == 0 or lon == 0:
                    continue
                cursor.execute('''
                    INSERT INTO traffic_fatalities
                    (latitude, longitude, collision_datetime, collision_type,
                     deceased_type, age, sex, analysis_neighborhood, police_district)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    lat, lon,
                    r.get('collision_datetime'),
                    r.get('collision_type'),
                    r.get('deceased'),
                    int(r.get('age', 0)) if r.get('age') else None,
                    r.get('sex'),
                    r.get('analysis_neighborhood'),
                    r.get('police_district')
                ))
                inserted += 1
            except Exception as e:
                pass

        self.conn.commit()
        print(f"  Inserted {inserted} traffic fatality records")
        return inserted

    def extract_traffic_injuries(self):
        """Extract traffic injuries from 2023+"""
        print("\nExtracting traffic injuries...")

        params = {
            '$where': "tb_latitude IS NOT NULL AND collision_datetime > '2023-01-01'",
            '$select': 'tb_latitude,tb_longitude,collision_datetime,collision_severity,'
                       'type_of_collision,number_killed,number_injured,'
                       'analysis_neighborhood,police_district',
            '$order': 'collision_datetime DESC'
        }

        data = self.fetch_data(DATASETS['traffic_injuries'], params, limit=15000)

        cursor = self.conn.cursor()
        inserted = 0
        for r in data:
            try:
                lat = float(r.get('tb_latitude', 0))
                lon = float(r.get('tb_longitude', 0))
                if lat == 0 or lon == 0:
                    continue
                cursor.execute('''
                    INSERT INTO traffic_injuries
                    (latitude, longitude, collision_datetime, collision_severity,
                     type_of_collision, number_killed, number_injured,
                     analysis_neighborhood, police_district)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    lat, lon,
                    r.get('collision_datetime'),
                    r.get('collision_severity'),
                    r.get('type_of_collision'),
                    int(r.get('number_killed', 0)) if r.get('number_killed') else 0,
                    int(r.get('number_injured', 0)) if r.get('number_injured') else 0,
                    r.get('analysis_neighborhood'),
                    r.get('police_district')
                ))
                inserted += 1
            except Exception as e:
                pass

        self.conn.commit()
        print(f"  Inserted {inserted} traffic injury records")
        return inserted

    def extract_fire_incidents(self):
        """Extract fire incidents with casualties (2020+)"""
        print("\nExtracting fire incidents...")

        params = {
            '$where': "point IS NOT NULL AND alarm_dttm > '2020-01-01' "
                      "AND (civilian_fatalities > 0 OR civilian_injuries > 0 "
                      "OR fire_fatalities > 0 OR fire_injuries > 0)",
            '$select': 'point,alarm_dttm,primary_situation,address,'
                       'neighborhood_district,fire_fatalities,fire_injuries,'
                       'civilian_fatalities,civilian_injuries',
            '$order': 'alarm_dttm DESC'
        }

        data = self.fetch_data(DATASETS['fire_incidents'], params, limit=500)

        cursor = self.conn.cursor()
        inserted = 0
        for r in data:
            try:
                point = r.get('point')
                if not point or 'coordinates' not in point:
                    continue
                lon, lat = point['coordinates']
                if lat == 0 or lon == 0:
                    continue
                cursor.execute('''
                    INSERT INTO fire_incidents
                    (latitude, longitude, alarm_datetime, primary_situation,
                     address, neighborhood_district, fire_fatalities, fire_injuries,
                     civilian_fatalities, civilian_injuries)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    lat, lon,
                    r.get('alarm_dttm'),
                    r.get('primary_situation'),
                    r.get('address'),
                    r.get('neighborhood_district'),
                    int(r.get('fire_fatalities', 0)) if r.get('fire_fatalities') else 0,
                    int(r.get('fire_injuries', 0)) if r.get('fire_injuries') else 0,
                    int(r.get('civilian_fatalities', 0)) if r.get('civilian_fatalities') else 0,
                    int(r.get('civilian_injuries', 0)) if r.get('civilian_injuries') else 0
                ))
                inserted += 1
            except Exception as e:
                pass

        self.conn.commit()
        print(f"  Inserted {inserted} fire incident records")
        return inserted

    def populate_neighborhoods(self):
        """Populate neighborhoods reference table from extracted data"""
        print("\nPopulating neighborhoods...")

        cursor = self.conn.cursor()
        cursor.execute('''
            INSERT OR IGNORE INTO neighborhoods (name, police_district)
            SELECT DISTINCT analysis_neighborhood, police_district
            FROM violent_crimes
            WHERE analysis_neighborhood IS NOT NULL
            UNION
            SELECT DISTINCT analysis_neighborhood, police_district
            FROM property_crimes
            WHERE analysis_neighborhood IS NOT NULL
            UNION
            SELECT DISTINCT analysis_neighborhood, police_district
            FROM traffic_fatalities
            WHERE analysis_neighborhood IS NOT NULL
            UNION
            SELECT DISTINCT analysis_neighborhood, police_district
            FROM traffic_injuries
            WHERE analysis_neighborhood IS NOT NULL
        ''')
        self.conn.commit()

        cursor.execute('SELECT COUNT(*) FROM neighborhoods')
        count = cursor.fetchone()[0]
        print(f"  Populated {count} neighborhoods")

    def create_indexes(self):
        """Create all indexes after data load for better performance"""
        print("\nCreating indexes...")

        cursor = self.conn.cursor()
        cursor.executescript('''
            CREATE INDEX IF NOT EXISTS idx_violent_crimes_coords
                ON violent_crimes(latitude, longitude);
            CREATE INDEX IF NOT EXISTS idx_violent_crimes_datetime
                ON violent_crimes(incident_datetime);
            CREATE INDEX IF NOT EXISTS idx_violent_crimes_category
                ON violent_crimes(incident_category);
            CREATE INDEX IF NOT EXISTS idx_violent_crimes_neighborhood
                ON violent_crimes(analysis_neighborhood);

            CREATE INDEX IF NOT EXISTS idx_property_crimes_coords
                ON property_crimes(latitude, longitude);
            CREATE INDEX IF NOT EXISTS idx_property_crimes_datetime
                ON property_crimes(incident_datetime);
            CREATE INDEX IF NOT EXISTS idx_property_crimes_category
                ON property_crimes(incident_category);

            CREATE INDEX IF NOT EXISTS idx_encampments_coords
                ON encampments(latitude, longitude);
            CREATE INDEX IF NOT EXISTS idx_encampments_datetime
                ON encampments(requested_datetime);

            CREATE INDEX IF NOT EXISTS idx_traffic_fatalities_coords
                ON traffic_fatalities(latitude, longitude);
            CREATE INDEX IF NOT EXISTS idx_traffic_fatalities_datetime
                ON traffic_fatalities(collision_datetime);

            CREATE INDEX IF NOT EXISTS idx_traffic_injuries_coords
                ON traffic_injuries(latitude, longitude);
            CREATE INDEX IF NOT EXISTS idx_traffic_injuries_datetime
                ON traffic_injuries(collision_datetime);
            CREATE INDEX IF NOT EXISTS idx_traffic_injuries_severity
                ON traffic_injuries(collision_severity);

            CREATE INDEX IF NOT EXISTS idx_fire_incidents_coords
                ON fire_incidents(latitude, longitude);
            CREATE INDEX IF NOT EXISTS idx_fire_incidents_datetime
                ON fire_incidents(alarm_datetime);

            CREATE INDEX IF NOT EXISTS idx_neighborhoods_name
                ON neighborhoods(name);
        ''')
        self.conn.commit()
        print("  Indexes created")

    def vacuum_database(self):
        """Compact database to minimize size"""
        print("\nCompacting database...")
        self.conn.execute('VACUUM')
        print("  Database compacted")

    def get_database_size(self) -> float:
        """Return database file size in MB"""
        return os.path.getsize(self.db_path) / (1024 * 1024)

    def print_summary(self):
        """Print summary of extracted data"""
        print("\n" + "="*50)
        print("DATABASE SUMMARY")
        print("="*50)

        cursor = self.conn.cursor()
        tables = [
            'violent_crimes', 'property_crimes', 'encampments',
            'traffic_fatalities', 'traffic_injuries', 'fire_incidents',
            'neighborhoods', 'incident_categories'
        ]

        for table in tables:
            cursor.execute(f'SELECT COUNT(*) FROM {table}')
            count = cursor.fetchone()[0]
            print(f"  {table}: {count:,} records")

        size_mb = self.get_database_size()
        print(f"\nDatabase size: {size_mb:.2f} MB")

        if size_mb > 10:
            print("WARNING: Database exceeds 10MB limit!")
        else:
            print("SUCCESS: Database is within 10MB limit")

    def run_extraction(self):
        """Main extraction workflow"""
        print("="*50)
        print("SafeSF Data Extraction")
        print("="*50)

        print("\nCreating database schema...")
        self.create_database()

        self.extract_violent_crimes()
        self.extract_property_crimes()
        self.extract_encampments()
        self.extract_traffic_fatalities()
        self.extract_traffic_injuries()
        self.extract_fire_incidents()
        self.populate_neighborhoods()
        self.create_indexes()
        self.vacuum_database()

        self.print_summary()
        self.conn.close()

        return self.db_path


if __name__ == '__main__':
    extractor = SFDataExtractor()
    extractor.run_extraction()
