import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, Navigation, Search, AlertCircle, Loader2, AlertTriangle, Pencil, X, Shield, Users, Lightbulb, BadgeAlert, Check, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import MapComponent from './components/MapComponent';
import RouteCard from './components/RouteCard';
import { getGeocode, generateRoutes } from './services/geminiService';
import { analyzeRoutes, mergeRouteAnalysis, analyzeCustomRoute } from './services/snowleopardService';
import { LocationInfo, RouteData, Coordinate, DangerZone, DangerSpot, RouteAnalysis, IncidentLocation, Hotspot } from './types';
import clsx from 'clsx';

const MIN_SIDEBAR_WIDTH = 320;
const MAX_SIDEBAR_WIDTH = 600;
const DEFAULT_SIDEBAR_WIDTH = 420;

// Custom Route Card Component - matches RouteCard style
interface CustomRouteCardProps {
  analysis: RouteAnalysis;
  onClear: () => void;
}

const CustomRouteCard: React.FC<CustomRouteCardProps> = ({ analysis, onClear }) => {
  const [expanded, setExpanded] = useState(false);

  const getSafetyScoreColor = (score: number) => {
    if (score >= 7) return 'text-emerald-600';
    if (score >= 4) return 'text-amber-600';
    return 'text-red-600';
  };

  const getSafetyScoreBg = (score: number) => {
    if (score >= 7) return 'bg-emerald-500';
    if (score >= 4) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const getRiskLevel = (score: number) => {
    if (score >= 7) return 'Low';
    if (score >= 4) return 'Moderate';
    return 'High';
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'Low': return 'text-emerald-600 bg-emerald-100';
      case 'Moderate': return 'text-amber-600 bg-amber-100';
      case 'High': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const riskLevel = getRiskLevel(analysis.safetyScore);

  // Calculate distance and time from metrics if available
  const distanceKm = analysis.metrics?.route_length_km || 0;
  const distanceStr = distanceKm > 0 ? `${distanceKm.toFixed(1)} km` : 'N/A';
  const walkingSpeedKmH = 5; // Average walking speed
  const timeMinutes = distanceKm > 0 ? Math.round((distanceKm / walkingSpeedKmH) * 60) : 0;
  const timeStr = timeMinutes > 0 ? `${timeMinutes} min` : 'N/A';

  // Derive safety indicators from metrics or incidents
  const getHomelessLevel = () => {
    const count = analysis.incidents.encampments;
    if (count >= 10) return 'High';
    if (count >= 3) return 'Moderate';
    return 'Low';
  };

  const getLightingLevel = () => {
    if (analysis.metrics?.lighting_score !== undefined) {
      const score = analysis.metrics.lighting_score;
      if (score >= 70) return 'Well-lit';
      if (score >= 40) return 'Moderate';
      return 'Poorly-lit';
    }
    // Fallback: estimate from violent crime density
    const violent = analysis.incidents.violent_crimes;
    if (violent <= 2) return 'Well-lit';
    if (violent <= 5) return 'Moderate';
    return 'Poorly-lit';
  };

  const getPoliceLevel = () => {
    if (analysis.metrics?.police_presence_score !== undefined) {
      const score = analysis.metrics.police_presence_score;
      if (score >= 55) return 'High';
      if (score >= 35) return 'Moderate';
      return 'Low';
    }
    // Fallback: estimate inversely from crime
    const total = analysis.incidents.violent_crimes + analysis.incidents.property_crimes;
    if (total <= 5) return 'High';
    if (total <= 15) return 'Moderate';
    return 'Low';
  };

  const homelessLevel = getHomelessLevel();
  const lightingLevel = getLightingLevel();
  const policeLevel = getPoliceLevel();

  return (
    <div className="cursor-pointer rounded-2xl border-2 border-purple-500 bg-purple-50 shadow-lg transition-all duration-300 overflow-hidden">
      {/* Header */}
      <div className="p-4">
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl text-purple-600 bg-purple-100">
              <Pencil className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-gray-900">Your Custom Route</h3>
              <p className="text-sm text-gray-500">Hand-drawn path analysis</p>
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Stats - Time, Distance, Risk */}
        <div className="flex items-center gap-4 text-sm mb-3">
          <div className="flex items-center gap-1.5 text-gray-600">
            <Clock className="w-4 h-4" />
            <span className="font-medium">{timeStr}</span>
          </div>
          <div className="flex items-center gap-1.5 text-gray-600">
            <Navigation className="w-4 h-4" />
            <span className="font-medium">{distanceStr}</span>
          </div>
          <div className={clsx("flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold", getRiskColor(riskLevel))}>
            <Shield className="w-3 h-3" />
            {riskLevel} Risk
          </div>
        </div>

        {/* Safety Score Bar */}
        <div className="mb-3">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-medium text-gray-500">Safety Score</span>
            <span className={clsx("text-lg font-bold", getSafetyScoreColor(analysis.safetyScore))}>
              {analysis.safetyScore.toFixed(1)}/10
            </span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={clsx("h-full rounded-full transition-all duration-500", getSafetyScoreBg(analysis.safetyScore))}
              style={{ width: `${Math.min(100, analysis.safetyScore * 10)}%` }}
            />
          </div>
        </div>

        {/* Quick Safety Indicators - Homeless, Lighting, Police (matches RouteCard) */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className={clsx("text-center p-2 rounded-lg", getRiskColor(homelessLevel))}>
            <Users className="w-4 h-4 mx-auto mb-1" />
            <div className="text-xs font-medium">{homelessLevel}</div>
            <div className="text-[10px] opacity-75">Homeless</div>
          </div>
          <div className={clsx("text-center p-2 rounded-lg", getRiskColor(lightingLevel === 'Well-lit' ? 'Low' : lightingLevel === 'Moderate' ? 'Moderate' : 'High'))}>
            <Lightbulb className="w-4 h-4 mx-auto mb-1" />
            <div className="text-xs font-medium">{lightingLevel}</div>
            <div className="text-[10px] opacity-75">Lighting</div>
          </div>
          <div className={clsx("text-center p-2 rounded-lg", getRiskColor(policeLevel === 'High' ? 'Low' : policeLevel === 'Moderate' ? 'Moderate' : 'High'))}>
            <BadgeAlert className="w-4 h-4 mx-auto mb-1" />
            <div className="text-xs font-medium">{policeLevel}</div>
            <div className="text-[10px] opacity-75">Police</div>
          </div>
        </div>

        {/* Expand/Collapse Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
          className="w-full flex items-center justify-center gap-1 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
        >
          {expanded ? (
            <>Less Details <ChevronUp className="w-4 h-4" /></>
          ) : (
            <>More Details <ChevronDown className="w-4 h-4" /></>
          )}
        </button>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100">
          {/* Crime Statistics */}
          <div className="mt-4 mb-4">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Incidents Along Route (60 days)
            </h4>
            <div className="grid grid-cols-4 gap-2">
              <div className="bg-red-50 rounded-lg p-2 text-center">
                <div className="text-lg font-bold text-red-600">{analysis.incidents.violent_crimes}</div>
                <div className="text-[10px] text-red-600">Violent</div>
              </div>
              <div className="bg-orange-50 rounded-lg p-2 text-center">
                <div className="text-lg font-bold text-orange-600">{analysis.incidents.property_crimes}</div>
                <div className="text-[10px] text-orange-600">Property</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-2 text-center">
                <div className="text-lg font-bold text-purple-600">{analysis.incidents.encampments}</div>
                <div className="text-[10px] text-purple-600">Encampments</div>
              </div>
              <div className="bg-amber-50 rounded-lg p-2 text-center">
                <div className="text-lg font-bold text-amber-600">{analysis.incidents.traffic_injuries}</div>
                <div className="text-[10px] text-amber-600">Traffic</div>
              </div>
            </div>
          </div>

          {/* Pros */}
          {analysis.pros.length > 0 && (
            <div className="mb-4">
              <h4 className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-2 flex items-center gap-1">
                <Check className="w-3 h-3" /> Why This Route Works
              </h4>
              <ul className="space-y-1.5">
                {analysis.pros.map((pro, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{pro}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Cons */}
          {analysis.cons.length > 0 && (
            <div className="mb-4">
              <h4 className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-2 flex items-center gap-1">
                <X className="w-3 h-3" /> Concerns to Consider
              </h4>
              <ul className="space-y-1.5">
                {analysis.cons.map((con, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <X className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <span>{con}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommendation */}
          {analysis.recommendations.length > 0 && (
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Recommendation
              </h4>
              <p className="text-sm text-gray-700 leading-relaxed">
                {analysis.recommendations[0]}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const App: React.FC = () => {
  const [startInput, setStartInput] = useState('');
  const [endInput, setEndInput] = useState('');

  // Sidebar resize state
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const [startLocation, setStartLocation] = useState<LocationInfo | null>(null);
  const [endLocation, setEndLocation] = useState<LocationInfo | null>(null);
  const [routes, setRoutes] = useState<RouteData[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);

  const [dangerZones, setDangerZones] = useState<DangerZone[]>([]);
  const [dangerSpots, setDangerSpots] = useState<DangerSpot[]>([]);

  // Route analysis data from Snow Leopard
  const [routeAnalyses, setRouteAnalyses] = useState<RouteAnalysis[]>([]);
  const [incidentLocations, setIncidentLocations] = useState<IncidentLocation[]>([]);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);

  const [loadingStep, setLoadingStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userCoords, setUserCoords] = useState<Coordinate | null>(null);

  // Custom drawing mode state
  const [drawingMode, setDrawingMode] = useState(false);
  const [customRouteWaypoints, setCustomRouteWaypoints] = useState<[number, number][] | null>(null);
  const [customRouteAnalysis, setCustomRouteAnalysis] = useState<RouteAnalysis | null>(null);
  const [analyzingCustomRoute, setAnalyzingCustomRoute] = useState(false);
  const [snappingToRoads, setSnappingToRoads] = useState(false);

  // Collapsible header state
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastScrollTop = useRef(0);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserCoords({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (err) => console.log('Geolocation denied or failed', err)
      );
    }
  }, []);

  // Track window size for responsive sidebar
  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Sidebar resize handlers
  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback((e: MouseEvent) => {
    if (isResizing && sidebarRef.current) {
      const newWidth = e.clientX;
      if (newWidth >= MIN_SIDEBAR_WIDTH && newWidth <= MAX_SIDEBAR_WIDTH) {
        setSidebarWidth(newWidth);
      }
    }
  }, [isResizing]);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResizing);
    }
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [isResizing, resize, stopResizing]);

  // Handle sidebar scroll for collapsible header with debounce for smoother animation
  const scrollTimeout = useRef<NodeJS.Timeout | null>(null);

  const handleSidebarScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop;
    const scrollingDown = scrollTop > lastScrollTop.current;
    const scrollDelta = Math.abs(scrollTop - lastScrollTop.current);

    // Clear any pending timeout
    if (scrollTimeout.current) {
      clearTimeout(scrollTimeout.current);
    }

    // Only trigger collapse/expand after a brief pause for smoother feel
    scrollTimeout.current = setTimeout(() => {
      // Collapse when scrolling down past threshold with sufficient scroll distance
      if (scrollingDown && scrollTop > 80 && scrollDelta > 10) {
        setHeaderCollapsed(true);
      } else if (scrollTop < 30) {
        setHeaderCollapsed(false);
      }
    }, 50);

    lastScrollTop.current = scrollTop;
  }, []);

  // Expand header when clicking on collapsed version
  const expandHeader = () => {
    setHeaderCollapsed(false);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSearch = async () => {
    if (!startInput || !endInput) {
      setError("Please enter both start and end locations.");
      return;
    }

    setRoutes([]);
    setSelectedRouteId(null);
    setDangerZones([]);
    setDangerSpots([]);
    setRouteAnalyses([]);
    setIncidentLocations([]);
    setHotspots([]);
    setError(null);
    setLoadingStep("Locating start point...");

    try {
      // 1. Geocode Start
      const startLoc = await getGeocode(startInput, userCoords?.lat, userCoords?.lng);
      setStartLocation(startLoc);

      // 2. Geocode End
      setLoadingStep("Locating destination...");
      const endLoc = await getGeocode(endInput, userCoords?.lat, userCoords?.lng);
      setEndLocation(endLoc);

      // 3. Generate Routes
      setLoadingStep("Calculating safe routes...");
      const generatedRoutes = await generateRoutes(startLoc, endLoc);

      // 4. Analyze routes with real database queries
      setLoadingStep("Analyzing safety from real incident data...");
      const analysisResult = await analyzeRoutes(generatedRoutes, 60, 300);
      setRouteAnalyses(analysisResult.routes);

      // 5. Merge analysis data into routes and collect all incidents
      const enhancedRoutes = mergeRouteAnalysis(generatedRoutes, analysisResult);

      // Collect all incident locations and hotspots for map display
      const allIncidents: IncidentLocation[] = [];
      const allHotspots: Hotspot[] = [];
      for (const analysis of analysisResult.routes) {
        allIncidents.push(...analysis.incidentLocations);
        allHotspots.push(...analysis.hotspots);
      }
      setIncidentLocations(allIncidents);
      setHotspots(allHotspots);

      setRoutes(enhancedRoutes);
      if (enhancedRoutes.length > 0) {
        setSelectedRouteId(enhancedRoutes[0].id);
      }
      setLoadingStep(null);

    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred.");
      setLoadingStep(null);
    }
  };

  const useCurrentLocation = () => {
    if (userCoords) {
      setStartInput("Current Location");
    } else {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserCoords({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
          setStartInput("Current Location");
        },
        () => setError("Could not access current location. Please type it manually.")
      );
    }
  };

  const openInGoogleMaps = () => {
    if (!startLocation || !endLocation) return;
    const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(startLocation.formattedAddress || startLocation.name)}&destination=${encodeURIComponent(endLocation.formattedAddress || endLocation.name)}&travelmode=walking`;
    window.open(url, '_blank');
  };

  // Handle custom route drawing completion
  const handleDrawingComplete = async (waypoints: [number, number][]) => {
    console.log('Drawing complete, waypoints:', waypoints.length);
    setDrawingMode(false);

    if (waypoints.length < 2) {
      setError('Please draw a route with at least 2 points.');
      return;
    }

    setCustomRouteWaypoints(waypoints);
    setAnalyzingCustomRoute(true);
    setCustomRouteAnalysis(null);

    try {
      const analysis = await analyzeCustomRoute(waypoints, 60, 300);
      console.log('Analysis result:', analysis);
      if (analysis) {
        setCustomRouteAnalysis(analysis);
        // Add custom route incidents to existing ones
        const existingIncidents = [...incidentLocations];
        const existingHotspots = [...hotspots];
        // Merge without duplicates (simple approach - add all from custom)
        setIncidentLocations([...existingIncidents, ...analysis.incidentLocations]);
        setHotspots([...existingHotspots, ...analysis.hotspots]);
      } else {
        setError('Could not analyze the route. Make sure the backend server is running.');
      }
    } catch (err) {
      console.error('Failed to analyze custom route:', err);
      setError('Failed to analyze your custom route. Please try again.');
    } finally {
      setAnalyzingCustomRoute(false);
    }
  };

  // Clear custom route
  const clearCustomRoute = () => {
    setCustomRouteWaypoints(null);
    setCustomRouteAnalysis(null);
    // Don't clear all incidents - only clear if no routes exist
    if (routes.length === 0) {
      setIncidentLocations([]);
      setHotspots([]);
    }
  };

  // Toggle drawing mode
  const toggleDrawingMode = () => {
    if (drawingMode) {
      setDrawingMode(false);
    } else {
      // Clear only the previous custom route, keep generated routes
      setCustomRouteWaypoints(null);
      setCustomRouteAnalysis(null);
      setDrawingMode(true);
    }
  };

  const totalDangerAreas = dangerZones.length + dangerSpots.length;
  const totalIncidents = incidentLocations.length;

  return (
    <div className={clsx(
      "h-screen w-full flex flex-col md:flex-row bg-slate-50 overflow-hidden relative",
      isResizing && "cursor-col-resize select-none"
    )}>
      {/* Resize overlay to capture mouse events during drag */}
      {isResizing && (
        <div className="fixed inset-0 z-50 cursor-col-resize" />
      )}

      {/* Sidebar / Floating Panel */}
      <div
        ref={sidebarRef}
        style={isDesktop ? { width: `${sidebarWidth}px` } : undefined}
        className={clsx(
          "z-20 w-full h-auto md:h-full bg-white/95 backdrop-blur-md shadow-xl flex flex-col border-r border-slate-200 absolute md:relative top-0 left-0 max-h-[55vh] md:max-h-full",
          isResizing && "select-none"
        )}
      >
        {/* Collapsible Header Section */}
        <div className="bg-white border-b border-slate-100 shrink-0 sticky top-0 z-20">
          {/* Collapsed Header - Compact View */}
          <div
            onClick={headerCollapsed ? expandHeader : undefined}
            className={clsx(
              "overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]",
              headerCollapsed
                ? "max-h-16 opacity-100 cursor-pointer hover:bg-slate-50"
                : "max-h-0 opacity-0 pointer-events-none"
            )}
          >
            <div className="p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <img src="/logo.png" alt="SafeWalk SF" className="h-6" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs text-slate-500 truncate">
                      <MapPin className="w-3 h-3 shrink-0 text-emerald-500" />
                      <span className="truncate">{startInput || 'Start'}</span>
                      <span className="text-slate-300">→</span>
                      <span className="truncate">{endInput || 'End'}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {totalIncidents > 0 && (
                    <span className="px-2 py-0.5 bg-red-100 text-red-600 text-xs font-semibold rounded-full">
                      {totalIncidents} incidents
                    </span>
                  )}
                  <div className="text-slate-400 text-xs">Tap to expand</div>
                </div>
              </div>
            </div>
          </div>

          {/* Expanded Header - Full View */}
          <div className={clsx(
            "overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]",
            headerCollapsed
              ? "max-h-0 opacity-0"
              : "max-h-[500px] opacity-100"
          )}>
            {/* Logo Header */}
            <div className="p-4 pb-3">
              <div className="flex items-center justify-center mb-1">
                <img src="/logo.png" alt="SafeWalk SF" className="h-10" />
              </div>
              <p className="text-slate-500 text-xs text-center">AI-powered safe pedestrian routing</p>
            </div>

            {/* Inputs */}
            <div className="px-4 pb-4 space-y-3">
                <div className="relative">
                  <MapPin className="absolute left-3 top-2.5 text-slate-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Start Location"
                    className="w-full pl-9 pr-16 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all text-slate-700 text-sm font-medium"
                    value={startInput}
                    onChange={(e) => setStartInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  />
                  <button
                    onClick={useCurrentLocation}
                    className="absolute right-2 top-1.5 px-2 py-1 text-blue-500 hover:bg-blue-50 rounded-md text-xs font-semibold"
                  >
                    Current
                  </button>
                </div>

                <div className="relative">
                  <MapPin className="absolute left-3 top-2.5 text-slate-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Destination"
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all text-slate-700 text-sm font-medium"
                    value={endInput}
                    onChange={(e) => setEndInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  />
                </div>

                {/* Action Buttons - Side by Side */}
                <div className="flex gap-2">
                  <button
                    onClick={handleSearch}
                    disabled={!!loadingStep}
                    className={clsx(
                      "flex-1 py-2 rounded-xl font-semibold text-white flex items-center justify-center gap-1.5 transition-all text-sm",
                      loadingStep ? "bg-blue-400 cursor-wait" : "bg-blue-600 hover:bg-blue-700 active:scale-[0.98]"
                    )}
                  >
                    {loadingStep ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Search className="w-4 h-4" />
                        Find Routes
                      </>
                    )}
                  </button>

                  <button
                    onClick={toggleDrawingMode}
                    disabled={!!loadingStep || analyzingCustomRoute || snappingToRoads}
                    className={clsx(
                      "flex-1 py-2 rounded-xl font-semibold flex items-center justify-center gap-1.5 transition-all border-2 text-sm",
                      drawingMode
                        ? "bg-purple-600 text-white border-purple-600"
                        : "bg-white text-purple-600 border-purple-300 hover:border-purple-500 hover:bg-purple-50"
                    )}
                  >
                    {drawingMode ? (
                      <>
                        <X className="w-4 h-4" />
                        Cancel
                      </>
                    ) : (
                      <>
                        <Pencil className="w-4 h-4" />
                        Draw Route
                      </>
                    )}
                  </button>
                </div>

                {/* Loading Step Indicator */}
                {loadingStep && (
                  <div className="p-2 bg-blue-50 text-blue-600 text-xs rounded-lg flex items-center justify-center gap-2 border border-blue-200">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    {loadingStep}
                  </div>
                )}

                {/* Drawing Mode Instructions */}
                {drawingMode && (
                  <div className="p-2 bg-purple-50 text-purple-700 text-xs rounded-lg border border-purple-200">
                    <p className="font-semibold mb-1">Drawing Mode</p>
                    <p>Click to add points, double-click to finish</p>
                  </div>
                )}

                {/* Snapping to Roads */}
                {snappingToRoads && (
                  <div className="p-2 bg-purple-50 text-purple-600 text-xs rounded-lg flex items-center gap-2 border border-purple-200">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Snapping route to roads...
                  </div>
                )}

                {/* Analyzing Custom Route */}
                {analyzingCustomRoute && !snappingToRoads && (
                  <div className="p-2 bg-purple-50 text-purple-600 text-xs rounded-lg flex items-center gap-2 border border-purple-200">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Analyzing your custom route...
                  </div>
                )}

                {error && (
                  <div className="p-2 bg-red-50 text-red-600 text-xs rounded-lg flex items-center gap-2 border border-red-100">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    {error}
                  </div>
                )}

                {/* Danger Alert Banner - Compact */}
                {(totalDangerAreas > 0 || totalIncidents > 0) && (
                  <div className="p-2 bg-red-50 border border-red-200 rounded-xl">
                    <div className="flex items-center gap-2 text-red-700">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="font-semibold text-sm">
                        {totalIncidents > 0
                          ? `${totalIncidents} Incident${totalIncidents > 1 ? 's' : ''} Found`
                          : `${totalDangerAreas} Danger Area${totalDangerAreas > 1 ? 's' : ''}`
                        }
                      </span>
                    </div>
                  </div>
                )}
              </div>
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div
          ref={scrollContainerRef}
          onScroll={handleSidebarScroll}
          className="flex-1 overflow-y-auto"
        >

          {/* Results */}
          {(routes.length > 0 || customRouteAnalysis) && (
            <div className="p-4 pt-4">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              {routes.length > 0 ? 'Recommended Pathways' : 'Route Analysis'}
            </h2>
            <div className="space-y-4">
              {/* Generated Routes */}
              {routes.map((route) => (
                <RouteCard
                  key={route.id}
                  route={route}
                  isSelected={selectedRouteId === route.id}
                  onSelect={setSelectedRouteId}
                />
              ))}

              {/* Custom Route Card - matches RouteCard style */}
              {customRouteAnalysis && (
                <CustomRouteCard
                  analysis={customRouteAnalysis}
                  onClear={clearCustomRoute}
                />
              )}
            </div>

            {routes.length > 0 && (
              <div className="mt-6 p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                <p className="text-xs text-slate-500 mb-2">Ready to go?</p>
                <button
                  onClick={openInGoogleMaps}
                  className="text-blue-600 font-semibold text-sm hover:underline flex items-center justify-center gap-1 w-full"
                >
                  Open in Google Maps
                  <Navigation className="w-3 h-3" />
                </button>
              </div>
            )}
            </div>
          )}
        </div>

        {/* Resize Handle */}
        <div
          className="hidden md:block absolute top-0 right-0 w-1 h-full cursor-col-resize group z-30"
          onMouseDown={startResizing}
        >
          <div className={clsx(
            "absolute top-0 right-0 w-1 h-full transition-colors",
            isResizing ? "bg-blue-500" : "bg-transparent group-hover:bg-blue-400"
          )} />
        </div>
      </div>

      {/* Map Container */}
      <div className="flex-1 h-full w-full relative z-0">
        <MapComponent
          startLocation={startLocation}
          endLocation={endLocation}
          routes={routes}
          selectedRouteId={selectedRouteId}
          onSelectRoute={setSelectedRouteId}
          dangerZones={dangerZones}
          dangerSpots={dangerSpots}
          incidentLocations={incidentLocations}
          hotspots={hotspots}
          drawingMode={drawingMode}
          onDrawingComplete={handleDrawingComplete}
          onSnappingToRoads={setSnappingToRoads}
          customRouteWaypoints={customRouteWaypoints}
          customRouteAnalysis={customRouteAnalysis}
        />

        {/* Map Legend */}
        {(routes.length > 0 || totalDangerAreas > 0 || totalIncidents > 0 || customRouteWaypoints) && (
          <div className="absolute bottom-6 right-6 bg-white/95 backdrop-blur rounded-xl shadow-lg p-4 z-10">
            <h3 className="text-xs font-bold text-slate-500 uppercase mb-2">Legend</h3>
            <div className="space-y-2 text-sm">
              {customRouteWaypoints && (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-1 bg-purple-500 rounded"></div>
                  <span className="text-slate-600">Your Custom Route</span>
                </div>
              )}
              {routes.length > 0 && (
                <>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-1 bg-emerald-500 rounded"></div>
                    <span className="text-slate-600">Safest Route</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-1 bg-blue-500 rounded"></div>
                    <span className="text-slate-600">Alternative Route</span>
                  </div>
                </>
              )}
              {totalIncidents > 0 && (
                <>
                  <div className="border-t border-slate-200 my-2"></div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-600 rounded-full"></div>
                    <span className="text-slate-600">Violent Crime</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                    <span className="text-slate-600">Property Crime</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                    <span className="text-slate-600">Encampment</span>
                  </div>
                  {hotspots.length > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-red-500/40 border-2 border-red-600 rounded-full"></div>
                      <span className="text-slate-600">Hotspot ({hotspots.length})</span>
                    </div>
                  )}
                </>
              )}
              {totalDangerAreas > 0 && totalIncidents === 0 && (
                <>
                  <div className="border-t border-slate-200 my-2"></div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-red-500/40 border border-red-500 rounded"></div>
                    <span className="text-slate-600">High Risk Area</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-orange-500/40 border border-orange-500 rounded"></div>
                    <span className="text-slate-600">Medium Risk Area</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <span className="text-slate-600">Danger Spot</span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Mobile Info */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] md:hidden">
          <div className="bg-white/60 backdrop-blur px-4 py-2 rounded-full shadow-lg border border-slate-200 text-xs font-semibold text-slate-600">
            {routes.length > 0 ? `${routes.length} Routes Found` : 'Search for a route'}
          </div>
        </div>
      </div>

    </div>
  );
};

export default App;
