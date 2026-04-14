/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User,
  signOut 
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot, 
  orderBy,
  Timestamp,
  deleteDoc,
  doc
} from 'firebase/firestore';
import { RoutePoint, Location, SavedRoute } from './types';
import { getRoute, calculateETAs } from './services/routingService';
import { fetchWeather } from './services/weatherService';
import { getTravelSummary } from './services/geminiService';
import MapComponent from './components/MapComponent';
import RouteForm from './components/RouteForm';
import WeatherTimeline from './components/WeatherTimeline';
import { 
  Cloud, 
  Wind,
  Clock,
  Navigation, 
  History, 
  LogOut, 
  LogIn, 
  Sparkles, 
  ChevronRight,
  Save,
  Plus,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [routePoints, setRoutePoints] = useState<RoutePoint[]>([]);
  const [routeGeometry, setRouteGeometry] = useState<any>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Current Route Data (for saving)
  const [currentOriginLoc, setCurrentOriginLoc] = useState<Location | null>(null);
  const [currentDestLoc, setCurrentDestLoc] = useState<Location | null>(null);
  const [currentWaypointLocs, setCurrentWaypointLocs] = useState<Location[]>([]);

  // Form State
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [speed, setSpeed] = useState(65);
  const [time, setTime] = useState(new Date().toISOString().slice(0, 16));
  const [waypoints, setWaypoints] = useState<string[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setSavedRoutes([]);
      return;
    }

    const q = query(
      collection(db, 'routes'),
      where('uid', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const routes = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SavedRoute[];
      setSavedRoutes(routes);
    }, (err) => {
      console.error("Firestore error:", err);
    });

    return () => unsubscribe();
  }, [user]);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error("Login failed:", err);
      setError("Login failed. Please try again.");
    }
  };

  const handleLogout = () => signOut(auth);

  const clearRoute = () => {
    setOrigin('');
    setDestination('');
    setWaypoints([]);
    setRoutePoints([]);
    setRouteGeometry(null);
    setAiSummary(null);
    setCurrentOriginLoc(null);
    setCurrentDestLoc(null);
    setCurrentWaypointLocs([]);
    setShowHistory(false);
  };

  const deleteRoute = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    // confirm() is often blocked in iframes, so we'll execute directly for now
    // or we could implement a custom modal, but direct is safer for "doing nothing" fix
    try {
      await deleteDoc(doc(db, 'routes', id));
    } catch (err) {
      console.error("Delete failed:", err);
      setError("Failed to delete route.");
    }
  };

  const geocode = async (query: string): Promise<Location | null> => {
    const MAPBOX_TOKEN = process.env.MAPBOX_ACCESS_TOKEN;
    
    try {
      if (MAPBOX_TOKEN && MAPBOX_TOKEN !== "undefined" && MAPBOX_TOKEN.length > 5) {
        const response = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&limit=1`
        );
        const data = await response.json();
        if (data.features && data.features.length > 0) {
          const feature = data.features[0];
          return {
            name: feature.place_name,
            lat: feature.center[1],
            lng: feature.center[0]
          };
        }
      }

      // Fallback to Nominatim
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
      const data = await response.json();
      if (data && data.length > 0) {
        return {
          name: data[0].display_name,
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon)
        };
      }
      return null;
    } catch (err) {
      console.error("Geocoding failed:", err);
      return null;
    }
  };

  const calculateTravelWeather = async (
    originStr: string, 
    destStr: string, 
    speed: number, 
    timeStr: string,
    waypointStrs: string[],
    predefinedOrigin?: Location,
    predefinedDest?: Location,
    predefinedWaypoints?: Location[]
  ) => {
    setIsLoading(true);
    setError(null);
    setAiSummary(null);
    
    try {
      const originLoc = predefinedOrigin || await geocode(originStr);
      const destLoc = predefinedDest || await geocode(destStr);
      if (!originLoc || !destLoc) {
        setError("Could not find origin or destination. Please be more specific.");
        setIsLoading(false);
        return;
      }

      let waypointLocs: Location[] = [];
      if (predefinedWaypoints) {
        waypointLocs = predefinedWaypoints;
      } else {
        for (const wp of waypointStrs) {
          if (wp.trim()) {
            const loc = await geocode(wp);
            if (loc) waypointLocs.push(loc);
          }
        }
      }

      const routeData = await getRoute(originLoc, destLoc, waypointLocs);
      if (!routeData) {
        setError("The routing service is currently unavailable. This can happen if the public servers are overloaded. Please try again in a few moments.");
        setIsLoading(false);
        return;
      }

      setRouteGeometry(routeData.routes[0].geometry);
      
      const departureTime = new Date(timeStr).getTime();
      const now = Date.now();
      const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;

      if (departureTime > now + fourteenDaysMs) {
        setError("Weather forecasts are available for up to 14 days. Please select an earlier departure date.");
        setIsLoading(false);
        return;
      }

      const points = calculateETAs(routeData, departureTime, speed, originLoc, destLoc, waypointLocs);
      
      // Fetch weather for each point
      const pointsWithWeather = await Promise.all(points.map(async (p) => {
        const weather = await fetchWeather(p.location.lat, p.location.lng, p.eta);
        return { ...p, weather: weather || undefined };
      }));

      const weatherCount = pointsWithWeather.filter(p => p.weather).length;
      if (weatherCount === 0) {
        setError("Could not retrieve weather data. This is likely because the trip dates are beyond the 14-day forecast window.");
      } else if (weatherCount < pointsWithWeather.length) {
        // Some points have weather, some don't (likely a long trip crossing the 14-day mark)
        console.warn("Some route points are beyond the 14-day forecast window.");
      }

      setRoutePoints(pointsWithWeather);
      setCurrentOriginLoc(originLoc);
      setCurrentDestLoc(destLoc);
      setCurrentWaypointLocs(waypointLocs);
    } catch (err) {
      console.error("Calculation failed:", err);
      setError("An error occurred while calculating your route.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveRoute = async () => {
    if (!user || routePoints.length === 0) return;

    setIsSaving(true);
    try {
      const departureDate = new Date(time);
      const formattedTime = departureDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const formattedDate = departureDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
      
      const routeToSave: SavedRoute = {
        uid: user.uid,
        name: `${origin.split(',')[0]} → ${destination.split(',')[0]} (${formattedDate} @ ${formattedTime})`,
        origin: { ...routePoints[0].location, name: origin },
        destination: { ...routePoints[routePoints.length - 1].location, name: destination },
        waypoints: currentWaypointLocs.map((loc, idx) => ({
          ...loc,
          name: waypoints[idx] || loc.name
        })),
        averageSpeed: speed,
        departureTime: routePoints[0].eta,
        createdAt: Date.now()
      };

      await addDoc(collection(db, 'routes'), routeToSave);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Save failed:", err);
      setError("Failed to save route.");
    } finally {
      setIsSaving(false);
    }
  };

  const loadRoute = (route: SavedRoute) => {
    setOrigin(route.origin.name);
    setDestination(route.destination.name);
    setSpeed(route.averageSpeed);
    setTime(new Date(route.departureTime).toISOString().slice(0, 16));
    setWaypoints(route.waypoints.map(w => w.name));
    
    setShowHistory(false);
    calculateTravelWeather(
      route.origin.name,
      route.destination.name,
      route.averageSpeed,
      new Date(route.departureTime).toISOString().slice(0, 16),
      route.waypoints.map(w => w.name),
      route.origin,
      route.destination,
      route.waypoints
    );
  };

  const generateAiSummary = async () => {
    if (routePoints.length === 0) return;
    setIsAiLoading(true);
    try {
      const summary = await getTravelSummary(routePoints);
      setAiSummary(summary);
    } catch (err) {
      console.error("AI Summary failed:", err);
      setError("Failed to generate AI summary.");
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#f5f5f5]">
      {/* Sidebar / Controls */}
      <div className="w-full md:w-[400px] bg-white border-r border-gray-200 flex flex-col md:h-screen md:overflow-y-auto z-10">
        <header className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-md z-20">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Cloud className="w-5 h-5 text-white" />
            </div>
            <h1 className="font-bold text-xl tracking-tight">SkyWay</h1>
          </div>
          
          {user ? (
            <div className="flex items-center gap-3">
              {routePoints.length > 0 && (
                <button 
                  onClick={clearRoute}
                  className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                  title="Clear Route"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button 
                onClick={() => setShowHistory(!showHistory)}
                className={`p-2 transition-colors ${showHistory ? 'text-blue-600' : 'text-gray-400 hover:text-blue-600'}`}
                title="History"
              >
                <History className="w-5 h-5" />
              </button>
              <button 
                onClick={handleLogout}
                className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <button 
              onClick={handleLogin}
              className="flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700"
            >
              <LogIn className="w-4 h-4" /> Sign In
            </button>
          )}
        </header>

        {(!process.env.OPENWEATHER_API_KEY || !process.env.MAPBOX_ACCESS_TOKEN) && (
          <div className="mx-6 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800 space-y-1">
              <p className="font-semibold">Missing API Keys:</p>
              {!process.env.OPENWEATHER_API_KEY && <p>• <strong>VITE_OPENWEATHER_API_KEY</strong> (Weather)</p>}
              {!process.env.MAPBOX_ACCESS_TOKEN && <p>• <strong>VITE_MAPBOX_ACCESS_TOKEN</strong> (Search Autocomplete)</p>}
              <p className="mt-1 opacity-70 italic">Add these to the Secrets panel to enable full functionality.</p>
            </div>
          </div>
        )}

        <main className="p-6 flex-1 space-y-8">
          {error && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-600 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <AnimatePresence mode="wait">
            {showHistory ? (
              <motion.div 
                key="history"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-xs uppercase tracking-widest text-gray-400 font-bold">Trip History</h2>
                  <button 
                    onClick={() => {
                      clearRoute();
                      setShowHistory(false);
                    }} 
                    className="text-xs text-blue-600 font-semibold"
                  >
                    New Trip
                  </button>
                </div>
                {savedRoutes.length === 0 ? (
                  <div className="text-center py-12">
                    <History className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                    <p className="text-sm text-gray-500 italic">No saved routes yet.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {savedRoutes.map((route) => (
                      <div 
                        key={route.id} 
                        onClick={() => loadRoute(route)}
                        className="p-4 bg-white rounded-2xl border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all cursor-pointer group relative overflow-hidden"
                      >
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-blue-50 rounded-full flex items-center justify-center">
                              <Navigation className="w-3 h-3 text-blue-600" />
                            </div>
                            <p className="font-bold text-sm text-gray-900 group-hover:text-blue-600 transition-colors">
                              {route.name}
                            </p>
                          </div>
                          <span className="text-[10px] font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded-md">
                            {new Date(route.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        
                        <div className="flex items-end justify-between">
                          <div className="space-y-1 ml-8 flex-1">
                            <div className="flex items-center gap-2 text-[11px] text-gray-500">
                              <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                              <span className="truncate">{route.origin.name}</span>
                            </div>
                            <div className="w-px h-2 bg-gray-200 ml-[2.5px]" />
                            <div className="flex items-center gap-2 text-[11px] text-gray-500">
                              <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                              <span className="truncate">{route.destination.name}</span>
                            </div>
                          </div>
                          
                          <button 
                            onClick={(e) => route.id && deleteRoute(e, route.id)}
                            className="p-2 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                            title="Delete Trip"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div 
                key="form"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-8"
              >
                <RouteForm 
                  onCalculate={calculateTravelWeather} 
                  isLoading={isLoading}
                  origin={origin}
                  setOrigin={setOrigin}
                  destination={destination}
                  setDestination={setDestination}
                  speed={speed}
                  setSpeed={setSpeed}
                  time={time}
                  setTime={setTime}
                  waypoints={waypoints}
                  setWaypoints={setWaypoints}
                />
                
                {savedRoutes.length > 0 && routePoints.length === 0 && (
                  <div className="space-y-4 pt-4 border-t border-gray-100">
                    <h2 className="text-xs uppercase tracking-widest text-gray-400 font-bold">Recent Trips</h2>
                    <div className="space-y-2">
                      {savedRoutes.slice(0, 3).map((route) => (
                        <div key={route.id} className="group relative">
                          <button
                            onClick={() => loadRoute(route)}
                            className="w-full p-3 bg-gray-50 rounded-xl border border-gray-100 hover:border-blue-200 hover:bg-white transition-all text-left flex items-center justify-between pr-10"
                          >
                            <div className="flex items-center gap-3 overflow-hidden">
                              <History className="w-4 h-4 text-gray-400 group-hover:text-blue-500 shrink-0" />
                              <span className="text-sm font-medium text-gray-700 truncate">{route.name}</span>
                            </div>
                            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500" />
                          </button>
                          <button 
                            onClick={(e) => route.id && deleteRoute(e, route.id)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                            title="Delete Trip"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      {savedRoutes.length > 3 && (
                        <button 
                          onClick={() => setShowHistory(true)}
                          className="text-[10px] font-bold text-blue-600 uppercase tracking-wider hover:underline w-full text-center py-2"
                        >
                          View all {savedRoutes.length} trips
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {routePoints.length > 0 && (
            <div className="space-y-6 pt-6 border-t border-gray-100">
              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">Route Summary</h3>
                  <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md">
                    {((routePoints[routePoints.length-1].eta - routePoints[0].eta) / (1000 * 60 * 60)).toFixed(1)} hrs
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] mb-2 pb-2 border-b border-gray-100">
                    <div className="flex items-center gap-1.5 text-gray-400 font-medium">
                      <Clock className="w-3 h-3" />
                      <span>Departure</span>
                    </div>
                    <span className="text-gray-700 font-bold">
                      {new Date(time).toLocaleString([], { 
                        month: 'short', 
                        day: 'numeric', 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-blue-600" />
                    <span className="text-sm font-semibold text-gray-900 truncate">{origin}</span>
                  </div>
                  {waypoints.filter(w => w.trim()).map((wp, i) => (
                    <div key={i} className="flex items-center gap-3 ml-1 border-l border-gray-200 py-1 pl-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                      <span className="text-xs text-gray-600 truncate">{wp}</span>
                    </div>
                  ))}
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    <span className="text-sm font-semibold text-gray-900 truncate">{destination}</span>
                  </div>
                </div>
              </div>

              {routePoints.some(p => !p.weather) && (
                <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-3">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-700 leading-tight">
                    Some parts of this trip are beyond the 14-day forecast window. Weather data for those segments is currently unavailable.
                  </p>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveRoute}
                    disabled={!user || isSaving}
                    className={`flex-1 py-3 text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-all ${
                      saveSuccess 
                        ? 'bg-green-500 text-white' 
                        : 'bg-gray-900 text-white hover:bg-black disabled:opacity-30'
                    }`}
                  >
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : saveSuccess ? (
                      <>✓ Saved!</>
                    ) : (
                      <>
                        <Save className="w-4 h-4" /> Save Route
                      </>
                    )}
                  </button>
                  <button
                    onClick={generateAiSummary}
                    disabled={isAiLoading}
                    className="flex-1 py-3 bg-blue-50 text-blue-600 text-sm font-semibold rounded-xl flex items-center justify-center gap-2 hover:bg-blue-100 transition-all disabled:opacity-50"
                  >
                    {isAiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Sparkles className="w-4 h-4" /> AI Summary</>}
                  </button>
                </div>
                <button
                  onClick={clearRoute}
                  className="w-full py-3 bg-white border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl flex items-center justify-center gap-2 hover:bg-gray-50 transition-all"
                >
                  <Plus className="w-4 h-4" /> New Trip
                </button>
              </div>

              {aiSummary && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-blue-600 text-white rounded-2xl shadow-xl shadow-blue-100 relative overflow-hidden"
                >
                  <Sparkles className="absolute -right-4 -top-4 w-24 h-24 text-white/10" />
                  <p className="text-sm leading-relaxed relative z-10">{aiSummary}</p>
                </motion.div>
              )}
            </div>
          )}
        </main>

        <footer className="p-6 border-t border-gray-100 text-[10px] text-gray-400 uppercase tracking-widest text-center">
          SkyWay Travel Weather &copy; 2024
        </footer>
      </div>

      {/* Map Area */}
      <div className="flex-1 relative flex flex-col md:h-screen">
        <div className="flex-1 p-4 md:p-6 h-[450px] md:h-auto">
          <MapComponent routePoints={routePoints} routeGeometry={routeGeometry} />
        </div>
        
        {/* Bottom Timeline Overlay - Absolute on desktop, relative on mobile for better scrolling */}
        <div className="md:absolute md:bottom-10 md:left-1/2 md:-translate-x-1/2 w-full md:w-[80%] z-20 p-4 md:p-0">
          <WeatherTimeline points={routePoints} />
        </div>
      </div>
    </div>
  );
}
