import { Coordinate, DangerZone, DangerSpot, RouteAnalysis, AnalyzeRoutesResponse, RouteData } from '../types';

// Backend API configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface SnowLeopardDangerData {
  dangerZones: DangerZone[];
  dangerSpots: DangerSpot[];
}

// Calculate distance in km between two coordinates
function getDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Check if coordinate is within radius of start or end
function isNearRoute(lat: number, lng: number, startCoord: Coordinate, endCoord: Coordinate, radiusKm: number = 2): boolean {
  const distToStart = getDistanceKm(lat, lng, startCoord.lat, startCoord.lng);
  const distToEnd = getDistanceKm(lat, lng, endCoord.lat, endCoord.lng);
  return distToStart <= radiusKm || distToEnd <= radiusKm;
}

// Fetch danger data from backend API
export const fetchDangerData = async (
  startCoord: Coordinate,
  endCoord: Coordinate
): Promise<SnowLeopardDangerData> => {
  console.log('Fetching danger data from backend API...');

  try {
    const params = new URLSearchParams({
      start_lat: startCoord.lat.toString(),
      start_lng: startCoord.lng.toString(),
      end_lat: endCoord.lat.toString(),
      end_lng: endCoord.lng.toString(),
      radius_km: '2.5',
    });

    const response = await fetch(`${API_BASE_URL}/api/danger-data?${params}`);

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    console.log(`Loaded ${data.dangerZones.length} danger zones, ${data.dangerSpots.length} danger spots from API`);

    return {
      dangerZones: data.dangerZones,
      dangerSpots: data.dangerSpots,
    };
  } catch (error) {
    console.warn('Backend API not available, falling back to local data:', error);
    // Fallback to local data if backend is not running
    return getSFDangerAreas(startCoord, endCoord);
  }
};

// San Francisco danger areas based on real crime data and reports
function getSFDangerAreas(startCoord: Coordinate, endCoord: Coordinate): SnowLeopardDangerData {

  // Dangerous neighborhoods (polygons)
  const allDangerZones: DangerZone[] = [
    {
      id: 'tenderloin',
      name: 'Tenderloin District',
      category: 'High Crime Area',
      severity: 'high',
      description: 'Highest crime rate in SF. Drug activity, homeless encampments, violent crime. Avoid walking alone, especially at night.',
      coordinates: [
        { lat: 37.7875, lng: -122.4185 },
        { lat: 37.7875, lng: -122.4080 },
        { lat: 37.7800, lng: -122.4080 },
        { lat: 37.7800, lng: -122.4185 }
      ]
    },
    {
      id: 'civic-center',
      name: 'Civic Center / UN Plaza',
      category: 'Homeless Encampment',
      severity: 'high',
      description: 'Large homeless population, open drug use, property crimes. City Hall area has heavy police presence during day.',
      coordinates: [
        { lat: 37.7810, lng: -122.4200 },
        { lat: 37.7810, lng: -122.4130 },
        { lat: 37.7770, lng: -122.4130 },
        { lat: 37.7770, lng: -122.4200 }
      ]
    },
    {
      id: 'soma-6th-street',
      name: '6th Street Corridor (SoMa)',
      category: 'Drug Activity',
      severity: 'high',
      description: 'Heavy drug activity, SRO hotels, frequent assaults. One of the most dangerous streets in SF.',
      coordinates: [
        { lat: 37.7830, lng: -122.4100 },
        { lat: 37.7830, lng: -122.4060 },
        { lat: 37.7740, lng: -122.4060 },
        { lat: 37.7740, lng: -122.4100 }
      ]
    },
    {
      id: 'mid-market',
      name: 'Mid-Market',
      category: 'Mixed Safety',
      severity: 'medium',
      description: 'Transitional area. Tech offices nearby but still has homeless camps and occasional crime.',
      coordinates: [
        { lat: 37.7830, lng: -122.4150 },
        { lat: 37.7830, lng: -122.4100 },
        { lat: 37.7790, lng: -122.4100 },
        { lat: 37.7790, lng: -122.4150 }
      ]
    },
    {
      id: 'mission-16th',
      name: '16th Street Mission',
      category: 'Theft Hotspot',
      severity: 'high',
      description: 'BART station area with high theft, drug activity. Be alert with phones and valuables.',
      coordinates: [
        { lat: 37.7660, lng: -122.4210 },
        { lat: 37.7660, lng: -122.4170 },
        { lat: 37.7630, lng: -122.4170 },
        { lat: 37.7630, lng: -122.4210 }
      ]
    },
    {
      id: 'bayview-hunters-point',
      name: 'Bayview-Hunters Point',
      category: 'Violent Crime',
      severity: 'high',
      description: 'Higher rates of violent crime including shootings. Avoid at night.',
      coordinates: [
        { lat: 37.7350, lng: -122.3900 },
        { lat: 37.7350, lng: -122.3700 },
        { lat: 37.7150, lng: -122.3700 },
        { lat: 37.7150, lng: -122.3900 }
      ]
    },
    {
      id: 'western-addition',
      name: 'Western Addition / Fillmore',
      category: 'Mixed Safety',
      severity: 'medium',
      description: 'Some blocks have crime issues. Main streets generally safe, avoid side streets at night.',
      coordinates: [
        { lat: 37.7850, lng: -122.4350 },
        { lat: 37.7850, lng: -122.4250 },
        { lat: 37.7750, lng: -122.4250 },
        { lat: 37.7750, lng: -122.4350 }
      ]
    }
  ];

  // Specific danger spots (markers)
  const allDangerSpots: DangerSpot[] = [
    // Tenderloin hotspots
    {
      id: 'turk-taylor',
      name: 'Turk & Taylor',
      category: 'Drug Activity',
      severity: 'high',
      description: 'Known drug dealing corner. Frequent police activity.',
      coordinate: { lat: 37.7831, lng: -122.4112 }
    },
    {
      id: 'turk-hyde',
      name: 'Turk & Hyde',
      category: 'Violent Crime',
      severity: 'high',
      description: 'Multiple stabbings and assaults reported.',
      coordinate: { lat: 37.7828, lng: -122.4155 }
    },
    {
      id: 'eddy-jones',
      name: 'Eddy & Jones',
      category: 'Drug Activity',
      severity: 'high',
      description: 'Open air drug market. Avoid this intersection.',
      coordinate: { lat: 37.7838, lng: -122.4125 }
    },
    {
      id: 'golden-gate-leavenworth',
      name: 'Golden Gate & Leavenworth',
      category: 'Homeless Encampment',
      severity: 'high',
      description: 'Large encampment area, drug use, harassment reported.',
      coordinate: { lat: 37.7815, lng: -122.4140 }
    },

    // Civic Center hotspots
    {
      id: 'un-plaza',
      name: 'UN Plaza',
      category: 'Homeless Encampment',
      severity: 'high',
      description: 'Major homeless gathering. Drug use, harassment common.',
      coordinate: { lat: 37.7795, lng: -122.4138 }
    },
    {
      id: 'mcallister-hyde',
      name: 'McAllister & Hyde',
      category: 'Violent Crime',
      severity: 'high',
      description: 'Assault and robbery hotspot.',
      coordinate: { lat: 37.7808, lng: -122.4164 }
    },

    // SoMa hotspots
    {
      id: '6th-market',
      name: '6th & Market',
      category: 'Drug Activity',
      severity: 'high',
      description: 'Dangerous intersection. Drug activity, theft, assaults.',
      coordinate: { lat: 37.7820, lng: -122.4095 }
    },
    {
      id: '6th-mission',
      name: '6th & Mission',
      category: 'Violent Crime',
      severity: 'high',
      description: 'High crime corner. Multiple incidents daily.',
      coordinate: { lat: 37.7805, lng: -122.4085 }
    },

    // Transit hotspots
    {
      id: 'powell-station',
      name: 'Powell Street BART',
      category: 'Pickpocket Zone',
      severity: 'medium',
      description: 'Tourist area. High pickpocket and phone theft activity.',
      coordinate: { lat: 37.7844, lng: -122.4079 }
    },
    {
      id: '16th-mission-bart',
      name: '16th Street Mission BART',
      category: 'Theft Hotspot',
      severity: 'high',
      description: 'Phone snatching, pickpockets. Stay alert with valuables.',
      coordinate: { lat: 37.7650, lng: -122.4195 }
    },
    {
      id: '24th-mission-bart',
      name: '24th Street Mission BART',
      category: 'Theft Hotspot',
      severity: 'medium',
      description: 'Some theft activity. Generally safer than 16th St.',
      coordinate: { lat: 37.7522, lng: -122.4181 }
    },
    {
      id: 'civic-center-bart',
      name: 'Civic Center BART',
      category: 'Drug Activity',
      severity: 'high',
      description: 'Underground drug activity. Use Market St entrance.',
      coordinate: { lat: 37.7789, lng: -122.4140 }
    },

    // Other hotspots
    {
      id: 'haight-homeless',
      name: 'Haight & Stanyan',
      category: 'Homeless Encampment',
      severity: 'medium',
      description: 'Homeless gathering near Golden Gate Park entrance.',
      coordinate: { lat: 37.7690, lng: -122.4530 }
    },
    {
      id: 'ocean-beach-night',
      name: 'Ocean Beach (Night)',
      category: 'Robbery Risk',
      severity: 'medium',
      description: 'Vehicle break-ins common. Avoid after dark.',
      coordinate: { lat: 37.7600, lng: -122.5100 }
    }
  ];

  // Filter to only include zones/spots within radius of route
  const filteredZones = allDangerZones.filter(zone => {
    const centerLat = zone.coordinates.reduce((sum, c) => sum + c.lat, 0) / zone.coordinates.length;
    const centerLng = zone.coordinates.reduce((sum, c) => sum + c.lng, 0) / zone.coordinates.length;
    return isNearRoute(centerLat, centerLng, startCoord, endCoord, 2.5);
  });

  const filteredSpots = allDangerSpots.filter(spot =>
    isNearRoute(spot.coordinate.lat, spot.coordinate.lng, startCoord, endCoord, 2.5)
  );

  return {
    dangerZones: filteredZones,
    dangerSpots: filteredSpots
  };
}

// =============================================================================
// Snow Leopard Route Analysis (Real Database Queries)
// =============================================================================

/**
 * Analyze multiple routes using Snow Leopard's real incident database.
 * Returns safety scores, actual incident counts, hotspots, and recommendations.
 */
export const analyzeRoutes = async (
  routes: RouteData[],
  daysBack: number = 60,
  radiusMeters: number = 200
): Promise<AnalyzeRoutesResponse> => {
  console.log('Analyzing routes with Snow Leopard...', routes.length, 'routes');

  try {
    const response = await fetch(`${API_BASE_URL}/api/analyze-routes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        routes: routes.map(route => ({
          id: route.id,
          name: route.name,
          waypoints: route.waypoints,
        })),
        days_back: daysBack,
        radius_meters: radiusMeters,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data: AnalyzeRoutesResponse = await response.json();
    console.log(`Route analysis complete in ${data.queryTimeMs}ms`);
    console.log(`Results:`, data.routes.map(r => ({
      name: r.name,
      score: r.safetyScore,
      incidents: r.incidents,
    })));

    return data;
  } catch (error) {
    console.warn('Route analysis failed, using fallback:', error);
    // Return empty analysis as fallback (using 0-10 scale)
    return {
      routes: routes.map(route => ({
        id: route.id,
        name: route.name,
        safetyScore: 5.0,
        rating: 'Generally Safe',
        ratingColor: 'yellow',
        incidents: {
          violent_crimes: 0,
          property_crimes: 0,
          encampments: 0,
          traffic_injuries: 0,
        },
        incidentLocations: [],
        hotspots: [],
        pros: ['Unable to fetch real-time data'],
        cons: ['Analysis unavailable - using default values'],
        recommendations: ['Start backend server for real analysis'],
      })),
      queryTimeMs: 0,
    };
  }
};

/**
 * Merge route analysis data back into RouteData objects.
 * Updates route types and risk levels based on real safety scores.
 * Returns routes sorted by safety score (safest first).
 */
export const mergeRouteAnalysis = (
  routes: RouteData[],
  analysis: AnalyzeRoutesResponse
): RouteData[] => {
  // First merge analysis into routes
  const mergedRoutes = routes.map(route => {
    const routeAnalysis = analysis.routes.find(a => a.id === route.id);
    if (!routeAnalysis) return route;

    // Use metrics for more accurate lighting/crowd/police calculations
    const metrics = routeAnalysis.metrics;
    const lightingScore = metrics?.lighting_score ?? 50;
    const crowdScore = metrics?.crowd_score ?? 50;
    const policeScore = metrics?.police_presence_score ?? 50;
    const encampmentPerKm = metrics?.encampment_per_km ?? 0;
    const violentPerKm = metrics?.violent_per_km ?? 0;

    // Use violent crime as proxy for homeless activity when encampment data is unavailable
    // High crime areas typically have more homeless activity
    const effectiveHomelessIndicator = encampmentPerKm > 0 ? encampmentPerKm : violentPerKm * 0.5;

    return {
      ...route,
      _safetyScore: routeAnalysis.safetyScore,
      safetyDetails: {
        // Use per-km metrics for homeless activity
        // If no encampment data, use violent crime as proxy (high crime = typically more homeless)
        homelessActivity: effectiveHomelessIndicator >= 10 ? 'High' as const :
                         effectiveHomelessIndicator >= 3 ? 'Moderate' as const : 'Low' as const,
        crimeIncidents: {
          robbery: Math.round(routeAnalysis.incidents.violent_crimes * 0.3),
          assault: Math.round(routeAnalysis.incidents.violent_crimes * 0.5),
          theft: routeAnalysis.incidents.property_crimes,
        },
        // More conservative thresholds for lighting/crowd/police
        lighting: lightingScore >= 70 ? 'Well-lit' as const :
                 lightingScore >= 40 ? 'Moderate' as const : 'Poorly-lit' as const,
        crowdLevel: crowdScore >= 70 ? 'Busy' as const :
                   crowdScore >= 40 ? 'Moderate' as const : 'Isolated' as const,
        policePresence: policeScore >= 55 ? 'High' as const :
                       policeScore >= 35 ? 'Moderate' as const : 'Low' as const,
        safetyScore: routeAnalysis.safetyScore,
        pros: routeAnalysis.pros,
        cons: routeAnalysis.cons,
        recommendation: routeAnalysis.recommendations[0] || '',
        avoidAreas: routeAnalysis.hotspots.map(h => h.name),
      },
    };
  });

  // Sort routes by safety score (highest/safest first)
  const sortedRoutes = mergedRoutes.sort((a, b) => {
    const scoreA = (a as any)._safetyScore || a.safetyDetails?.safetyScore || 0;
    const scoreB = (b as any)._safetyScore || b.safetyDetails?.safetyScore || 0;
    return scoreB - scoreA;
  });

  // Assign route types based on relative ranking (not absolute scores)
  // This ensures we always have visual differentiation
  return sortedRoutes.map((route, index) => {
    const score = (route as any)._safetyScore || route.safetyDetails?.safetyScore || 0;

    // First route (highest score) = SAFE (green)
    // Last route (lowest score) = SCENIC (purple) - indicates caution
    // Middle routes = FAST (blue)
    let routeType: 'SAFE' | 'FAST';
    let riskLevel: 'Low' | 'Medium' | 'High';
    let nameLabel: string;

    if (sortedRoutes.length === 1) {
      // Only one route - base on absolute score (0-10 scale)
      if (score >= 5) {
        routeType = 'SAFE';
        riskLevel = score >= 7 ? 'Low' : 'Medium';
        nameLabel = '(Recommended)';
      } else {
        routeType = 'FAST';
        riskLevel = score >= 3 ? 'Medium' : 'High';
        nameLabel = '(Use Caution)';
      }
    } else {
      // Multiple routes - first is SAFE (green), rest are FAST (blue)
      if (index === 0) {
        // Safest route gets green
        routeType = 'SAFE';
        riskLevel = score >= 5 ? 'Low' : 'Medium';
        nameLabel = '(Safest)';
      } else {
        // All other routes are blue (alternatives)
        routeType = 'FAST';
        riskLevel = score >= 5 ? 'Low' : score >= 3 ? 'Medium' : 'High';
        nameLabel = '';
      }
    }

    // Clean up temp property and update name
    const { _safetyScore, ...cleanRoute } = route as any;
    const updatedName = route.name + (nameLabel ? ` ${nameLabel}` : '');

    return {
      ...cleanRoute,
      name: updatedName,
      type: routeType,
      riskLevel,
    };
  });
};
