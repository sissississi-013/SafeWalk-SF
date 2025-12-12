import React, { useState, useEffect } from 'react';
import { MapPin, Navigation, Search, AlertCircle, Loader2 } from 'lucide-react';
import MapComponent from './components/MapComponent';
import RouteCard from './components/RouteCard';
import { getGeocode, generateRoutes } from './services/geminiService';
import { LocationInfo, RouteData, Coordinate } from './types';
import clsx from 'clsx';

const App: React.FC = () => {
  const [startInput, setStartInput] = useState('');
  const [endInput, setEndInput] = useState('');
  
  const [startLocation, setStartLocation] = useState<LocationInfo | null>(null);
  const [endLocation, setEndLocation] = useState<LocationInfo | null>(null);
  const [routes, setRoutes] = useState<RouteData[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  
  const [loadingStep, setLoadingStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userCoords, setUserCoords] = useState<Coordinate | null>(null);

  useEffect(() => {
    // Attempt to get user location on load for convenience
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
      setLoadingStep("Analyzing safety data & calculating routes...");
      const generatedRoutes = await generateRoutes(startLoc, endLoc);
      
      setRoutes(generatedRoutes);
      if (generatedRoutes.length > 0) {
        setSelectedRouteId(generatedRoutes[0].id);
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
    
    // Fallback to standard directions if no specific route logic can be passed deep linked easily
    // However, we can pass waypoints if we really wanted to, but standard query is safer for mobile.
    const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(startLocation.formattedAddress || startLocation.name)}&destination=${encodeURIComponent(endLocation.formattedAddress || endLocation.name)}&travelmode=walking`;
    window.open(url, '_blank');
  };

  return (
    <div className="h-screen w-full flex flex-col md:flex-row bg-slate-50 overflow-hidden relative">
      
      {/* Sidebar / Floating Panel */}
      <div className="z-20 w-full md:w-[400px] h-auto md:h-full bg-white/90 backdrop-blur-md shadow-xl flex flex-col border-r border-slate-200 absolute md:relative top-0 left-0 max-h-[50vh] md:max-h-full overflow-y-auto">
        
        {/* Header */}
        <div className="p-6 pb-4 border-b border-slate-100 bg-white sticky top-0 z-10">
          <div className="flex items-center gap-2 mb-1">
            <div className="bg-blue-600 text-white p-2 rounded-lg">
              <Navigation className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-800">SafeWalk SF</h1>
          </div>
          <p className="text-slate-500 text-sm">AI-powered safe pedestrian routing.</p>
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
        />
        
        {/* Mobile Toggle Handle (Visual Only for this demo) */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] md:hidden">
          <div className="bg-white/90 backdrop-blur px-4 py-2 rounded-full shadow-lg border border-slate-200 text-xs font-semibold text-slate-600">
            {routes.length > 0 ? `${routes.length} Routes Found` : 'Search for a route'}
          </div>
        </div>
      </div>

    </div>
  );
};

export default App;
