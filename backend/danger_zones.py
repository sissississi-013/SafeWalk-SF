"""Pre-defined danger zones based on SF crime data analysis."""

from models import DangerZone, DangerSpot, Coordinate, Severity

# San Francisco dangerous neighborhoods (polygons) based on crime statistics
DANGER_ZONES: list[DangerZone] = [
    DangerZone(
        id="tenderloin",
        name="Tenderloin District",
        category="High Crime Area",
        severity=Severity.HIGH,
        description="Highest crime rate in SF. Drug activity, homeless encampments, violent crime. Avoid walking alone, especially at night.",
        coordinates=[
            Coordinate(lat=37.7875, lng=-122.4185),
            Coordinate(lat=37.7875, lng=-122.4080),
            Coordinate(lat=37.7800, lng=-122.4080),
            Coordinate(lat=37.7800, lng=-122.4185),
        ]
    ),
    DangerZone(
        id="civic-center",
        name="Civic Center / UN Plaza",
        category="Homeless Encampment",
        severity=Severity.HIGH,
        description="Large homeless population, open drug use, property crimes. City Hall area has heavy police presence during day.",
        coordinates=[
            Coordinate(lat=37.7810, lng=-122.4200),
            Coordinate(lat=37.7810, lng=-122.4130),
            Coordinate(lat=37.7770, lng=-122.4130),
            Coordinate(lat=37.7770, lng=-122.4200),
        ]
    ),
    DangerZone(
        id="soma-6th-street",
        name="6th Street Corridor (SoMa)",
        category="Drug Activity",
        severity=Severity.HIGH,
        description="Heavy drug activity, SRO hotels, frequent assaults. One of the most dangerous streets in SF.",
        coordinates=[
            Coordinate(lat=37.7830, lng=-122.4100),
            Coordinate(lat=37.7830, lng=-122.4060),
            Coordinate(lat=37.7740, lng=-122.4060),
            Coordinate(lat=37.7740, lng=-122.4100),
        ]
    ),
    DangerZone(
        id="mid-market",
        name="Mid-Market",
        category="Mixed Safety",
        severity=Severity.MEDIUM,
        description="Transitional area. Tech offices nearby but still has homeless camps and occasional crime.",
        coordinates=[
            Coordinate(lat=37.7830, lng=-122.4150),
            Coordinate(lat=37.7830, lng=-122.4100),
            Coordinate(lat=37.7790, lng=-122.4100),
            Coordinate(lat=37.7790, lng=-122.4150),
        ]
    ),
    DangerZone(
        id="mission-16th",
        name="16th Street Mission",
        category="Theft Hotspot",
        severity=Severity.HIGH,
        description="BART station area with high theft, drug activity. Be alert with phones and valuables.",
        coordinates=[
            Coordinate(lat=37.7660, lng=-122.4210),
            Coordinate(lat=37.7660, lng=-122.4170),
            Coordinate(lat=37.7630, lng=-122.4170),
            Coordinate(lat=37.7630, lng=-122.4210),
        ]
    ),
    DangerZone(
        id="bayview-hunters-point",
        name="Bayview-Hunters Point",
        category="Violent Crime",
        severity=Severity.HIGH,
        description="Higher rates of violent crime including shootings. Avoid at night.",
        coordinates=[
            Coordinate(lat=37.7350, lng=-122.3900),
            Coordinate(lat=37.7350, lng=-122.3700),
            Coordinate(lat=37.7150, lng=-122.3700),
            Coordinate(lat=37.7150, lng=-122.3900),
        ]
    ),
    DangerZone(
        id="western-addition",
        name="Western Addition / Fillmore",
        category="Mixed Safety",
        severity=Severity.MEDIUM,
        description="Some blocks have crime issues. Main streets generally safe, avoid side streets at night.",
        coordinates=[
            Coordinate(lat=37.7850, lng=-122.4350),
            Coordinate(lat=37.7850, lng=-122.4250),
            Coordinate(lat=37.7750, lng=-122.4250),
            Coordinate(lat=37.7750, lng=-122.4350),
        ]
    ),
    DangerZone(
        id="soma-south",
        name="South of Market (South)",
        category="Property Crime",
        severity=Severity.MEDIUM,
        description="Vehicle break-ins and theft common. Keep valuables hidden, don't leave items in cars.",
        coordinates=[
            Coordinate(lat=37.7750, lng=-122.4050),
            Coordinate(lat=37.7750, lng=-122.3950),
            Coordinate(lat=37.7700, lng=-122.3950),
            Coordinate(lat=37.7700, lng=-122.4050),
        ]
    ),
]

# Specific danger spots (markers) based on crime hotspots
DANGER_SPOTS: list[DangerSpot] = [
    # Tenderloin hotspots
    DangerSpot(
        id="turk-taylor",
        name="Turk & Taylor",
        category="Drug Activity",
        severity=Severity.HIGH,
        description="Known drug dealing corner. Frequent police activity.",
        coordinate=Coordinate(lat=37.7831, lng=-122.4112)
    ),
    DangerSpot(
        id="turk-hyde",
        name="Turk & Hyde",
        category="Violent Crime",
        severity=Severity.HIGH,
        description="Multiple stabbings and assaults reported.",
        coordinate=Coordinate(lat=37.7828, lng=-122.4155)
    ),
    DangerSpot(
        id="eddy-jones",
        name="Eddy & Jones",
        category="Drug Activity",
        severity=Severity.HIGH,
        description="Open air drug market. Avoid this intersection.",
        coordinate=Coordinate(lat=37.7838, lng=-122.4125)
    ),
    DangerSpot(
        id="golden-gate-leavenworth",
        name="Golden Gate & Leavenworth",
        category="Homeless Encampment",
        severity=Severity.HIGH,
        description="Large encampment area, drug use, harassment reported.",
        coordinate=Coordinate(lat=37.7815, lng=-122.4140)
    ),

    # Civic Center hotspots
    DangerSpot(
        id="un-plaza",
        name="UN Plaza",
        category="Homeless Encampment",
        severity=Severity.HIGH,
        description="Major homeless gathering. Drug use, harassment common.",
        coordinate=Coordinate(lat=37.7795, lng=-122.4138)
    ),
    DangerSpot(
        id="mcallister-hyde",
        name="McAllister & Hyde",
        category="Violent Crime",
        severity=Severity.HIGH,
        description="Assault and robbery hotspot.",
        coordinate=Coordinate(lat=37.7808, lng=-122.4164)
    ),

    # SoMa hotspots
    DangerSpot(
        id="6th-market",
        name="6th & Market",
        category="Drug Activity",
        severity=Severity.HIGH,
        description="Dangerous intersection. Drug activity, theft, assaults.",
        coordinate=Coordinate(lat=37.7820, lng=-122.4095)
    ),
    DangerSpot(
        id="6th-mission",
        name="6th & Mission",
        category="Violent Crime",
        severity=Severity.HIGH,
        description="High crime corner. Multiple incidents daily.",
        coordinate=Coordinate(lat=37.7805, lng=-122.4085)
    ),

    # Transit hotspots
    DangerSpot(
        id="powell-station",
        name="Powell Street BART",
        category="Pickpocket Zone",
        severity=Severity.MEDIUM,
        description="Tourist area. High pickpocket and phone theft activity.",
        coordinate=Coordinate(lat=37.7844, lng=-122.4079)
    ),
    DangerSpot(
        id="16th-mission-bart",
        name="16th Street Mission BART",
        category="Theft Hotspot",
        severity=Severity.HIGH,
        description="Phone snatching, pickpockets. Stay alert with valuables.",
        coordinate=Coordinate(lat=37.7650, lng=-122.4195)
    ),
    DangerSpot(
        id="24th-mission-bart",
        name="24th Street Mission BART",
        category="Theft Hotspot",
        severity=Severity.MEDIUM,
        description="Some theft activity. Generally safer than 16th St.",
        coordinate=Coordinate(lat=37.7522, lng=-122.4181)
    ),
    DangerSpot(
        id="civic-center-bart",
        name="Civic Center BART",
        category="Drug Activity",
        severity=Severity.HIGH,
        description="Underground drug activity. Use Market St entrance.",
        coordinate=Coordinate(lat=37.7789, lng=-122.4140)
    ),

    # Other hotspots
    DangerSpot(
        id="haight-homeless",
        name="Haight & Stanyan",
        category="Homeless Encampment",
        severity=Severity.MEDIUM,
        description="Homeless gathering near Golden Gate Park entrance.",
        coordinate=Coordinate(lat=37.7690, lng=-122.4530)
    ),
    DangerSpot(
        id="ocean-beach-night",
        name="Ocean Beach (Night)",
        category="Robbery Risk",
        severity=Severity.MEDIUM,
        description="Vehicle break-ins common. Avoid after dark.",
        coordinate=Coordinate(lat=37.7600, lng=-122.5100)
    ),
    DangerSpot(
        id="fishermans-wharf-theft",
        name="Fisherman's Wharf",
        category="Pickpocket Zone",
        severity=Severity.LOW,
        description="Tourist area with pickpockets. Keep valuables secure.",
        coordinate=Coordinate(lat=37.8080, lng=-122.4177)
    ),
    DangerSpot(
        id="union-square-theft",
        name="Union Square (Garages)",
        category="Vehicle Break-ins",
        severity=Severity.MEDIUM,
        description="Parking garage break-ins. Don't leave valuables visible.",
        coordinate=Coordinate(lat=37.7879, lng=-122.4074)
    ),
]


def get_distance_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate distance between two coordinates in km."""
    from math import sin, cos, sqrt, atan2, radians

    R = 6371  # Earth's radius in km

    lat1_rad = radians(lat1)
    lat2_rad = radians(lat2)
    delta_lat = radians(lat2 - lat1)
    delta_lng = radians(lng2 - lng1)

    a = sin(delta_lat / 2) ** 2 + cos(lat1_rad) * cos(lat2_rad) * sin(delta_lng / 2) ** 2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))

    return R * c


def is_near_route(
    lat: float,
    lng: float,
    start_lat: float,
    start_lng: float,
    end_lat: float,
    end_lng: float,
    radius_km: float = 2.5
) -> bool:
    """Check if a coordinate is within radius of the route corridor."""
    dist_to_start = get_distance_km(lat, lng, start_lat, start_lng)
    dist_to_end = get_distance_km(lat, lng, end_lat, end_lng)

    # Also check midpoint
    mid_lat = (start_lat + end_lat) / 2
    mid_lng = (start_lng + end_lng) / 2
    dist_to_mid = get_distance_km(lat, lng, mid_lat, mid_lng)

    return min(dist_to_start, dist_to_end, dist_to_mid) <= radius_km


def get_danger_zones_for_route(
    start_lat: float,
    start_lng: float,
    end_lat: float,
    end_lng: float,
    radius_km: float = 2.5
) -> list[DangerZone]:
    """Get danger zones relevant to a route."""
    filtered = []

    for zone in DANGER_ZONES:
        # Calculate zone center
        center_lat = sum(c.lat for c in zone.coordinates) / len(zone.coordinates)
        center_lng = sum(c.lng for c in zone.coordinates) / len(zone.coordinates)

        if is_near_route(center_lat, center_lng, start_lat, start_lng, end_lat, end_lng, radius_km):
            filtered.append(zone)

    return filtered


def get_danger_spots_for_route(
    start_lat: float,
    start_lng: float,
    end_lat: float,
    end_lng: float,
    radius_km: float = 2.5
) -> list[DangerSpot]:
    """Get danger spots relevant to a route."""
    filtered = []

    for spot in DANGER_SPOTS:
        if is_near_route(
            spot.coordinate.lat,
            spot.coordinate.lng,
            start_lat, start_lng, end_lat, end_lng,
            radius_km
        ):
            filtered.append(spot)

    return filtered
