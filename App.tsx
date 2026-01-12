import React, { useState, useEffect } from 'react';
import { MapPin, Navigation, Search, AlertCircle, Loader2, AlertTriangle } from 'lucide-react';
import MapComponent from './components/MapComponent';
import RouteCard from './components/RouteCard';
import { getGeocode, generateRoutes } from './services/geminiService';
import { analyzeRoutes, mergeRouteAnalysis } from './services/snowleopardService';
import { LocationInfo, RouteData, Coordinate, DangerZone, DangerSpot, RouteAnalysis, IncidentLocation, Hotspot } from './types';
import clsx from 'clsx';

const App: React.FC = () => {
  const [startInput, setStartInput] = useState('');
  const [endInput, setEndInput] = useState('');

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

  const totalDangerAreas = dangerZones.length + dangerSpots.length;
  const totalIncidents = incidentLocations.length;

  return (
    <div className="h-screen w-full flex flex-col md:flex-row bg-slate-50 overflow-hidden relative">

      {/* Sidebar / Floating Panel */}
      <div className="z-20 w-full md:w-[420px] h-auto md:h-full bg-white/95 backdrop-blur-md shadow-xl flex flex-col border-r border-slate-200 absolute md:relative top-0 left-0 max-h-[55vh] md:max-h-full overflow-y-auto">

        {/* Header */}
        <div className="p-6 pb-4 border-b border-slate-100 bg-white sticky top-0 z-10">
          <div className="flex items-center justify-center mb-2">
            <img src="/logo.png" alt="SafeWalk SF" className="h-10" />
          </div>
          <p className="text-slate-500 text-sm text-center">AI-powered safe pedestrian routing with real-time danger alerts.</p>
        </div>

        {/* Inputs */}
        <div className="p-6 space-y-4">
          <div className="relative">
            <MapPin className="absolute left-3 top-3 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Start Location (e.g. Union Square)"
              className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all text-slate-700 font-medium"
              value={startInput}
              onChange={(e) => setStartInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button
              onClick={useCurrentLocation}
              className="absolute right-2 top-2 p-1 text-blue-500 hover:bg-blue-50 rounded-md text-xs font-semibold"
            >
              Use Current
            </button>
          </div>

          <div className="relative">
            <MapPin className="absolute left-3 top-3 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Destination (e.g. Pier 39)"
              className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all text-slate-700 font-medium"
              value={endInput}
              onChange={(e) => setEndInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>

          <button
            onClick={handleSearch}
            disabled={!!loadingStep}
            className={clsx(
              "w-full py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/20",
              loadingStep ? "bg-blue-400 cursor-wait" : "bg-blue-600 hover:bg-blue-700 active:scale-[0.98]"
            )}
          >
            {loadingStep ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {loadingStep}
              </>
            ) : (
              <>
                <Search className="w-5 h-5" />
                Find Safe Routes
              </>
            )}
          </button>

          {error && (
            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2 border border-red-100">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
        </div>

        {/* Danger Alert Banner */}
        {(totalDangerAreas > 0 || totalIncidents > 0) && (
          <div className="mx-6 mb-4 p-3 bg-red-50 border border-red-200 rounded-xl">
            <div className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="w-5 h-5" />
              <span className="font-semibold">
                {totalIncidents > 0
                  ? `${totalIncidents} Real Incident${totalIncidents > 1 ? 's' : ''} Found`
                  : `${totalDangerAreas} Danger Area${totalDangerAreas > 1 ? 's' : ''} Detected`
                }
              </span>
            </div>
            <p className="text-red-600 text-sm mt-1">
              {totalIncidents > 0
                ? `${totalIncidents} incidents from database (past 60 days). ${hotspots.length} hotspot${hotspots.length !== 1 ? 's' : ''} identified.`
                : `${dangerZones.length} neighborhood${dangerZones.length !== 1 ? 's' : ''} and ${dangerSpots.length} hotspot${dangerSpots.length !== 1 ? 's' : ''} identified.`
              }
              {' '}Click on map to see details.
            </p>
          </div>
        )}

        {/* Results */}
        {routes.length > 0 && (
          <div className="p-6 pt-0 flex-1 overflow-y-auto">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
              Recommended Pathways
            </h2>
            <div className="space-y-4">
              {routes.map((route) => (
                <RouteCard
                  key={route.id}
                  route={route}
                  isSelected={selectedRouteId === route.id}
                  onSelect={setSelectedRouteId}
                />
              ))}
            </div>

            <div className="mt-8 p-4 bg-slate-50 rounded-xl border border-slate-100 text-center">
              <p className="text-sm text-slate-500 mb-3">Ready to go?</p>
              <button
                onClick={openInGoogleMaps}
                className="text-blue-600 font-semibold text-sm hover:underline flex items-center justify-center gap-1 w-full"
              >
                Open navigation in Google Maps
                <Navigation className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}
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
        />

        {/* Map Legend */}
        {(routes.length > 0 || totalDangerAreas > 0 || totalIncidents > 0) && (
          <div className="absolute bottom-6 right-6 bg-white/95 backdrop-blur rounded-xl shadow-lg p-4 z-10">
            <h3 className="text-xs font-bold text-slate-500 uppercase mb-2">Legend</h3>
            <div className="space-y-2 text-sm">
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
