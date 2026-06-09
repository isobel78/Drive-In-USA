import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, MapPin, Loader2, Film, Ticket, Star, Compass, X, Map as MapIcon, RefreshCcw, Download, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getTheatersFromMap } from '../services/theaterService';
import { Theater } from '../types';
import { TheaterCard } from '../components/TheaterCard';
import { TheaterModal } from '../components/TheaterModal';
import TheaterMap from '../components/TheaterMap';
import { ScrollToTop } from '../components/ScrollToTop';
import { calculateDistance } from '../lib/utils';
import { Link } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

type LocationChoice = 'granted' | 'denied' | 'later' | null;

function saveChoice(value: string) {
  try {
    localStorage.setItem('locationChoice', value);
  } catch {}
}

const getSortName = (name: string) => {
  return name.replace(/^the\s+/i, '');
};

export default function Home() {
  const [theaters, setTheaters] = useState<Theater[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTheater, setSelectedTheater] = useState<Theater | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sortMethod, setSortMethod] = useState<'nearest' | 'alphabetical' | 'state'>('alphabetical');
  const [maxDistance, setMaxDistance] = useState<number | null>(null);
  const [showFullMap, setShowFullMap] = useState(false);
  const [locationChoice, setLocationChoice] = useState<LocationChoice>(() => {
    try {
      return localStorage.getItem('locationChoice') as LocationChoice;
    } catch {
      return null;
    }
  });
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const toggleSection = (sectionKey: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  const requestLocation = useCallback(async () => {
    setLoading(true);
    
    // Check if running inside a native Capacitor shell
    if (Capacitor.isNativePlatform()) {
      try {
        // Request/check native App Geolocation Permissions
        let permStatus = await Geolocation.checkPermissions();
        
        if (permStatus.location !== 'granted' && permStatus.coarseLocation !== 'granted') {
          permStatus = await Geolocation.requestPermissions({
            permissions: ['coarseLocation', 'location']
          });
        }

        if (permStatus.location === 'granted' || permStatus.coarseLocation === 'granted') {
          const position = await Geolocation.getCurrentPosition({
            enableHighAccuracy: false,
            timeout: 8000,
            maximumAge: 60000
          });
          
          const newLoc = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setUserLocation(newLoc);
          setSortMethod('nearest');
          setShowLocationPrompt(false);
          setLocationChoice('granted');
          saveChoice('granted');
          setError(null);
        } else {
          setError("Location access was denied. Please enable it in your device settings to find the nearest theaters.");
          setLocationChoice('denied');
          saveChoice('denied');
          setShowLocationPrompt(false);
        }
      } catch (err: any) {
        console.warn('Capacitor geolocation error:', err);
        setError(err?.message || "Could not get your location.");
        setLocationChoice('later');
        saveChoice('later');
        setShowLocationPrompt(false);
      } finally {
        setLoading(false);
      }
      return;
    }

    // Fallback to standard Browser Geolocation API
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newLoc = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setUserLocation(newLoc);
          setSortMethod('nearest');
          setShowLocationPrompt(false);
          setLocationChoice('granted');
          saveChoice('granted');
          setError(null);
          setLoading(false);
        },
        (err) => {
          console.warn('Geolocation error:', err);
          setLoading(false);
          setShowLocationPrompt(false);
          
          let message = "Could not get your location.";
          if (err.code === err.PERMISSION_DENIED) {
            message = "Location access was denied. Please enable it in your browser settings to find the nearest theaters.";
            setLocationChoice('denied');
            saveChoice('denied');
          } else {
            setLocationChoice('later');
            saveChoice('later');
          }
          
          if (err.code === err.POSITION_UNAVAILABLE) {
            message = "Location information is unavailable.";
          } else if (err.code === err.TIMEOUT) {
            message = "The request to get user location timed out.";
          }
          setError(message);
        },
        {
          enableHighAccuracy: false,
          timeout: 8000,
          maximumAge: 60000
        }
      );
    } else {
      setError("Geolocation is not supported by this browser.");
      setLoading(false);
    }
  }, []);

  const resetHome = () => {
    setSearchQuery('');
    setSortMethod(userLocation ? 'nearest' : 'alphabetical');
    setMaxDistance(null);
    setShowFullMap(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getTheatersFromMap();
      setTheaters(data);
    } catch (err) {
      setError('Failed to load theater data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    // After a reload triggered by "Try Location Again", auto-request location.
    const pendingRequest = (() => { try { return localStorage.getItem('pendingLocationRequest'); } catch { return null; } })();
    if (pendingRequest) {
      try { localStorage.removeItem('pendingLocationRequest'); } catch {}
      // Give the browser a tick to settle, then attempt location directly.
      // On Safari, navigator.permissions doesn't exist — calling getCurrentPosition
      // directly is the only reliable way to pick up a newly-granted permission.
      setTimeout(() => {
        if (navigator.permissions) {
          navigator.permissions.query({ name: 'geolocation' }).then((status) => {
            if (status.state === 'granted') {
              requestLocation();
            } else {
              setShowLocationPrompt(true);
            }
          }).catch(() => setShowLocationPrompt(true));
        } else {
          // Safari: just call getCurrentPosition — it will succeed silently if
          // the user already granted in Settings, or show its native prompt if not.
          requestLocation();
        }
      }, 100);
    }

    // Chrome/Firefox: if permission already granted on mount (non-pending path),
    // silently acquire location. Also watch for live permission changes.
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'geolocation' }).then((status) => {
        if (status.state === 'granted' && !pendingRequest) {
          requestLocation();
        }
        status.onchange = () => {
          if (status.state === 'granted') {
            window.location.reload();
          }
        };
      }).catch(() => {});
    }

    // Visibility change: user went to Settings and came back.
    // Chrome/Firefox: check Permissions API. Safari: just attempt getCurrentPosition —
    // if granted it succeeds, if still denied the error handler fires silently.
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && locationChoice === 'denied') {
        if (navigator.permissions) {
          navigator.permissions.query({ name: 'geolocation' }).then((status) => {
            if (status.state === 'granted') {
              window.location.reload();
            }
          }).catch(() => {});
        } else {
          // Safari fallback: attempt location directly; success means they granted it
          requestLocation();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [loadData, locationChoice, requestLocation]);

  const sortedTheaters = useMemo(() => {
    let result = [...theaters];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(t => 
        t.name.toLowerCase().includes(query) || 
        t.city.toLowerCase().includes(query) || 
        t.state.toLowerCase().includes(query) ||
        t.state_long.toLowerCase().includes(query)
      );
    }

    if (sortMethod === 'nearest' && userLocation && maxDistance !== null) {
      result = result.filter(t => {
        const dist = calculateDistance(userLocation.lat, userLocation.lng, t.lat, t.lng);
        return dist <= maxDistance;
      });
    }

    result.sort((a, b) => {
      if (sortMethod === 'nearest' && userLocation) {
        const distA = calculateDistance(userLocation.lat, userLocation.lng, a.lat, a.lng);
        const distB = calculateDistance(userLocation.lat, userLocation.lng, b.lat, b.lng);
        return distA - distB;
      } else if (sortMethod === 'alphabetical') {
        return getSortName(a.name).localeCompare(getSortName(b.name));
      } else if (sortMethod === 'state') {
        const stateA = a.state_long || a.state;
        const stateB = b.state_long || b.state;
        const stateCompare = stateA.localeCompare(stateB);
        if (stateCompare !== 0) return stateCompare;
        return getSortName(a.name).localeCompare(getSortName(b.name));
      }
      // sortMethod is 'nearest' but location not yet acquired — sort alphabetically as interim
      return getSortName(a.name).localeCompare(getSortName(b.name));
    });

    return result;
  }, [theaters, searchQuery, userLocation, sortMethod, maxDistance]);

  return (
    <div className="min-h-screen pb-12 overflow-x-hidden">
      <header className="relative pt-12 pb-8 px-6 text-center overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
          <div className="grid grid-cols-6 gap-4 p-4">
            {Array.from({ length: 24 }).map((_, i) => (
              <Star key={i} className="w-8 h-8 text-retro-yellow animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />
            ))}
          </div>
        </div>

        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="relative z-10"
        >
          <h1 className="font-display text-6xl md:text-8xl text-white neon-text mb-2 tracking-tighter">
            <button 
              onClick={(e) => {
                e.preventDefault();
                resetHome();
              }}
              className="cursor-pointer bg-transparent border-none p-0"
            >
              DRIVE-IN <span className="text-retro-cyan">USA</span>
            </button>
          </h1>
          <p className="font-retro text-retro-yellow text-xl tracking-[0.2em] uppercase mb-6">
            Find Your Nearest Screen
          </p>
          
          <div className="flex flex-wrap justify-center gap-4 mx-auto">
            <button
              onClick={() => setShowFullMap(!showFullMap)}
              className="retro-button text-lg px-8 py-3 flex items-center gap-2 touch-manipulation cursor-pointer active:scale-95"
            >
              {showFullMap ? <X className="w-5 h-5" /> : <MapIcon className="w-5 h-5" />}
              {showFullMap ? 'CLOSE MAP' : 'VIEW FULL MAP'}
            </button>

            <button
              onClick={loadData}
              className="retro-button bg-retro-cyan text-retro-navy border-white text-lg px-8 py-3 flex items-center gap-2 touch-manipulation cursor-pointer active:scale-95"
            >
              <RefreshCcw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'LOADING...' : 'REFRESH LIST'}
            </button>
          </div>
        </motion.div>

        <AnimatePresence>
          {showFullMap && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: '500px', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-8 max-w-4xl mx-auto relative overflow-hidden rounded-xl border-4 border-white shadow-[0_0_30px_rgba(0,255,255,0.3)]"
            >
              <TheaterMap 
                theaters={theaters} 
                onTheaterSelect={(t) => setSelectedTheater(t)}
                userLocation={userLocation}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <div className="max-w-xl mx-auto px-6 mb-8 space-y-4">
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-retro-pink to-retro-cyan rounded-lg blur opacity-25 md:group-hover:opacity-50 transition duration-1000 md:group-hover:duration-200"></div>
          <div className="relative flex items-center bg-retro-navy border-2 border-white rounded-lg px-4 py-3">
            <Search className="w-5 h-5 text-retro-cyan mr-3" />
            <input
              type="text"
              placeholder="Search by name, city, or state..."
              className="bg-transparent border-none outline-none text-white w-full font-sans placeholder:text-gray-500 text-base"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="ml-2 p-1 md:hover:bg-white/10 rounded-full transition-colors text-retro-pink"
                aria-label="Clear search"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          {[
            { id: 'nearest', label: 'Nearest', icon: Compass, disabled: false },
            { id: 'alphabetical', label: 'A-Z', icon: Film, disabled: false },
            { id: 'state', label: 'By State', icon: MapPin, disabled: false },
          ].map((method) => (
            <button
              key={method.id}
              onClick={() => {
                if (method.id === 'nearest' && !userLocation) {
                  setShowLocationPrompt(true);
                } else {
                  setSortMethod(method.id as any);
                }
              }}
              className={`
                flex items-center gap-2 px-4 py-2 font-retro text-xs border-2 transition-all touch-manipulation cursor-pointer active:scale-95 [transform:skewX(-10deg)]
                ${sortMethod === method.id 
                  ? 'bg-retro-cyan text-retro-navy border-white shadow-[0_0_10px_rgba(0,255,255,0.5)]' 
                  : 'bg-retro-navy text-retro-cyan border-retro-cyan/50 md:hover:border-retro-cyan'}
                ${method.id === 'nearest' && !userLocation ? 'animate-pulse border-retro-pink/50' : ''}
              `}
            >
              <method.icon className="w-3 h-3" />
              {method.label}
            </button>
          ))}
        </div>

        {!userLocation && (locationChoice === 'later' || locationChoice === 'granted' || locationChoice === null || locationChoice === 'denied') && (
          <div className="flex justify-center pt-2">
            <button 
              onClick={() => setShowLocationPrompt(true)}
              className="text-[10px] font-retro text-retro-pink md:hover:text-white transition-colors flex items-center gap-1 uppercase tracking-widest cursor-pointer active:scale-95"
            >
              <Compass className="w-3 h-3" />
              Enable Location Services
            </button>
          </div>
        )}

        {sortMethod === 'nearest' && userLocation && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-wrap justify-center gap-2 pt-2"
          >
            {[
              { label: 'All', value: null },
              { label: '25 mi', value: 25 },
              { label: '50 mi', value: 50 },
              { label: '100 mi', value: 100 },
              { label: '250 mi', value: 250 },
            ].map((dist) => (
              <button
                key={dist.label}
                onClick={() => setMaxDistance(dist.value)}
                className={`
                  px-3 py-1 font-retro text-[10px] border transition-all touch-manipulation cursor-pointer active:scale-95
                  ${maxDistance === dist.value
                    ? 'bg-retro-pink text-white border-white shadow-[0_0_8px_rgba(255,0,128,0.5)]'
                    : 'bg-retro-navy text-retro-pink border-retro-pink/30 md:hover:border-retro-pink'}
                `}
              >
                {dist.label}
              </button>
            ))}
          </motion.div>
        )}
      </div>

      <main className="max-w-4xl mx-auto px-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <Loader2 className="w-12 h-12 text-retro-pink animate-spin" />
            <p className="font-retro text-retro-cyan animate-pulse">Loading the reels...</p>
          </div>
        ) : error ? (
          <div className="text-center py-20 bg-retro-red/20 border-2 border-retro-red rounded-xl p-8 flex flex-col items-center">
            <p className="text-retro-red font-display text-2xl mb-2 uppercase tracking-tighter">STATIC DETECTED!</p>
            <p className="text-white mb-6 max-w-md">{error}</p>
            <div className="flex flex-col items-center gap-4">
              <button
                onClick={() => {
                  setSortMethod('alphabetical');
                  setError(null);
                  setLocationChoice('later');
                  saveChoice('later');
                }}
                className="bg-retro-cyan text-retro-navy font-retro px-8 py-4 rounded-xl shadow-[0_0_20px_rgba(0,255,255,0.3)] active:scale-95 transition-transform uppercase text-sm flex items-center gap-2"
              >
                <RefreshCcw className="w-4 h-4" />
                Back to A-Z Sort
              </button>
              <button
                onClick={() => {
                  // If previously denied, the browser caches the denial for this page
                  // session — a reload is required for the new grant to take effect.
                  if (locationChoice === 'denied') {
                    saveChoice('later');
                    try { localStorage.setItem('pendingLocationRequest', '1'); } catch {}
                    window.location.reload();
                  } else {
                    setError(null);
                    setLocationChoice('later');
                    saveChoice('later');
                    setShowLocationPrompt(true);
                  }
                }}
                className="text-retro-pink font-retro text-xs uppercase tracking-widest hover:text-white transition-colors flex items-center gap-1"
              >
                <Compass className="w-3 h-3" />
                Try Location Again
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-retro text-retro-cyan text-sm uppercase tracking-widest flex items-center gap-2">
                <Film className="w-4 h-4" />
                {sortedTheaters.length} Theaters Found
              </h2>
              <span className="text-xs font-retro text-retro-yellow uppercase tracking-tighter flex items-center gap-1">
                <Star className="w-3 h-3" />
                Sorted {sortMethod === 'nearest' ? `by Distance${maxDistance ? ` (within ${maxDistance}mi)` : ''}` : sortMethod === 'alphabetical' ? 'Alphabetically' : 'by State'}
              </span>
            </div>

            <div className="space-y-12">
              {sortMethod === 'state' ? (
                Object.entries(
                  sortedTheaters.reduce((acc, t) => {
                    const stateName = t.state_long || t.state;
                    if (!acc[stateName]) acc[stateName] = [];
                    acc[stateName].push(t);
                    return acc;
                  }, {} as Record<string, Theater[]>)
                )
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([stateName, stateTheaters]) => {
                  const isExpanded = expandedSections[stateName];
                  return (
                    <div key={stateName} className="space-y-6">
                      <motion.button 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        onClick={() => toggleSection(stateName)}
                        className="w-full font-display text-3xl text-retro-cyan border-b-2 border-retro-cyan/30 pb-2 flex items-center justify-between group cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <motion.div
                            animate={{ rotate: isExpanded ? 0 : -90 }}
                            transition={{ type: "spring", stiffness: 300, damping: 20 }}
                          >
                            <ChevronDown className="w-6 h-6 text-retro-pink" />
                          </motion.div>
                          <div className="flex items-center gap-3">
                            <MapPin className="w-6 h-6" />
                            {stateName}
                          </div>
                        </div>
                        <span className="font-retro text-xs bg-retro-cyan/10 px-3 py-1 rounded-full border border-retro-cyan/30 group-hover:bg-retro-cyan/20 transition-colors">
                          {stateTheaters.length} {stateTheaters.length === 1 ? 'THEATER' : 'THEATERS'}
                        </span>
                      </motion.button>
                      
                      <AnimatePresence initial={false}>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease: "easeInOut" }}
                            className="overflow-hidden"
                          >
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-4">
                              <AnimatePresence mode="popLayout">
                                {stateTheaters.map((theater, index) => (
                                  <motion.div
                                    key={theater.name + index}
                                    layout
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    transition={{ delay: Math.min(index * 0.03, 0.3) }}
                                  >
                                    <TheaterCard
                                      theater={theater}
                                      distance={userLocation ? calculateDistance(userLocation.lat, userLocation.lng, theater.lat, theater.lng) : undefined}
                                      onClick={() => setSelectedTheater(theater)}
                                    />
                                  </motion.div>
                                ))}
                              </AnimatePresence>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })
              ) : sortMethod === 'alphabetical' ? (
                Object.entries(
                  sortedTheaters.reduce((acc, t) => {
                    const sortName = getSortName(t.name);
                    const firstChar = sortName.charAt(0).toUpperCase();
                    const firstLetter = /^[0-9]/.test(firstChar) ? '#' : firstChar;
                    if (!acc[firstLetter]) acc[firstLetter] = [];
                    acc[firstLetter].push(t);
                    return acc;
                  }, {} as Record<string, Theater[]>)
                )
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([letter, letterTheaters]) => {
                  const isExpanded = expandedSections[letter];
                  return (
                    <div key={letter} className="space-y-6">
                      <motion.button 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        onClick={() => toggleSection(letter)}
                        className="w-full font-display text-3xl text-retro-cyan border-b-2 border-retro-cyan/30 pb-2 flex items-center gap-3 group cursor-pointer"
                      >
                        <motion.div
                          animate={{ rotate: isExpanded ? 0 : -90 }}
                          transition={{ type: "spring", stiffness: 300, damping: 20 }}
                        >
                          <ChevronDown className="w-6 h-6 text-retro-pink" />
                        </motion.div>
                        <Film className="w-6 h-6" />
                        {letter}
                        <span className="ml-auto font-retro text-xs bg-retro-cyan/10 px-3 py-1 rounded-full border border-retro-cyan/30 group-hover:bg-retro-cyan/20 transition-colors">
                          {letterTheaters.length}
                        </span>
                      </motion.button>
                      
                      <AnimatePresence initial={false}>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease: "easeInOut" }}
                            className="overflow-hidden"
                          >
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-4">
                              <AnimatePresence mode="popLayout">
                                {letterTheaters.map((theater, index) => (
                                  <motion.div
                                    key={theater.name + index}
                                    layout
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    transition={{ delay: Math.min(index * 0.03, 0.3) }}
                                  >
                                    <TheaterCard
                                      theater={theater}
                                      distance={userLocation ? calculateDistance(userLocation.lat, userLocation.lng, theater.lat, theater.lng) : undefined}
                                      onClick={() => setSelectedTheater(theater)}
                                    />
                                  </motion.div>
                                ))}
                              </AnimatePresence>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })
              ) : !userLocation ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                  <Loader2 className="w-12 h-12 text-retro-pink animate-spin" />
                  <p className="font-retro text-retro-cyan animate-pulse">Locating your signal...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <AnimatePresence mode="popLayout">
                    {sortedTheaters.map((theater, index) => (
                      <motion.div
                        key={theater.name + index}
                        layout
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ delay: Math.min(index * 0.03, 0.3) }}
                      >
                        <TheaterCard
                          theater={theater}
                          distance={userLocation ? calculateDistance(userLocation.lat, userLocation.lng, theater.lat, theater.lng) : undefined}
                          onClick={() => setSelectedTheater(theater)}
                        />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>

            {sortedTheaters.length === 0 && (
              <div className="text-center py-20 border-2 border-dashed border-gray-700 rounded-xl">
                <Ticket className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                <p className="text-gray-500 font-retro uppercase">No screens found in this area.</p>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="mt-20 border-t-4 border-retro-pink pt-8 pb-12 px-6 text-center">
        <div className="max-w-xl mx-auto">
          <p className="font-display text-3xl text-retro-cyan mb-4">SEE YOU AT THE MOVIES!</p>
          <div className="flex justify-center gap-8 text-retro-yellow/50">
            <Film className="w-6 h-6" />
            <Ticket className="w-6 h-6" />
            <Star className="w-6 h-6" />
          </div>
          <p className="mt-8 text-[10px] font-retro text-gray-600 uppercase tracking-[0.3em] mb-4">
            Drive-In Movie Theater Locator &copy; 2026
          </p>
          <Link 
            to="/install" 
            className="inline-flex items-center gap-2 text-retro-cyan font-retro text-[10px] uppercase tracking-widest hover:text-white transition-colors border border-retro-cyan/30 px-4 py-2 rounded-full"
          >
            <Download className="w-3 h-3" />
            Install App Guide
          </Link>
        </div>
      </footer>

      <TheaterModal
        theater={selectedTheater}
        onClose={() => setSelectedTheater(null)}
      />

      <AnimatePresence>
        {showLocationPrompt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="button"
            tabIndex={-1}
            className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md touch-manipulation"
            onClick={() => {
              setShowLocationPrompt(false);
              if (!locationChoice) {
                setLocationChoice('later');
                saveChoice('later');
              }
            }}
            onTouchEnd={() => {
              setShowLocationPrompt(false);
              if (!locationChoice) {
                setLocationChoice('later');
                saveChoice('later');
              }
            }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="max-w-md w-full bg-retro-navy border-4 border-retro-cyan rounded-2xl p-8 text-center shadow-[0_0_50px_rgba(0,255,255,0.3)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-20 h-20 bg-retro-cyan/20 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-retro-cyan animate-pulse">
                <Compass className="w-10 h-10 text-retro-cyan" />
              </div>
              
              <h2 className="font-display text-4xl text-white mb-4 tracking-tighter uppercase">
                Find the <span className="text-retro-pink">Nearest</span> Screen!
              </h2>
              
              <p className="text-gray-300 font-sans mb-8 leading-relaxed">
                Allow location access to see which drive-in theaters are closest to your current position. We'll sort the list and show you exactly how many miles away they are!
              </p>
              
              <div className="space-y-4">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    requestLocation();
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="w-full bg-retro-cyan text-retro-navy font-retro py-4 rounded-xl text-lg shadow-[0_0_20px_rgba(0,255,255,0.4)] md:hover:shadow-[0_0_30px_rgba(0,255,255,0.6)] transition-all touch-manipulation cursor-pointer active:scale-95 select-none"
                >
                  ENABLE LOCATION
                </button>
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowLocationPrompt(false);
                    setLocationChoice('later');
                    saveChoice('later');
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="text-gray-500 font-retro text-sm uppercase tracking-widest md:hover:text-white transition-colors touch-manipulation cursor-pointer active:scale-95 select-none"
                >
                  Maybe Later
                </button>
              </div>
              
              <div className="mt-8 pt-6 border-t border-white/10">
                <p className="text-[10px] text-gray-600 uppercase tracking-widest">
                  Your privacy matters. We only use your location to find nearby theaters.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <ScrollToTop />
    </div>
  );
}
