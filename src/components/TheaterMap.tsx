import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import { Theater } from '../types';

// Fix for default marker icon
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIconRetina from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// @ts-ignore
L.Browser.touch = false;

const DefaultIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIconRetina,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface TheaterMapProps {
  theaters: Theater[];
  onTheaterSelect: (theater: Theater) => void;
  userLocation: { lat: number; lng: number } | null;
}

const MapResizer = () => {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 500);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
};

const getStateColor = (state: string) => {
  const stateMap: Record<string, string> = {
    'AL': '#FF00FF', 'AK': '#00FFFF', 'AZ': '#FFFF00', 'AR': '#00FF00', 'CA': '#FF6600',
    'CO': '#FF0066', 'CT': '#00FF99', 'DE': '#9900FF', 'DC': '#3366FF', 'FL': '#CCFF00',
    'GA': '#FF0033', 'HI': '#0099CC', 'ID': '#FFCC00', 'IL': '#CC00FF', 'IN': '#6600FF',
    'IA': '#00FFCC', 'KS': '#FFD700', 'KY': '#FF7F50', 'LA': '#00BFFF', 'ME': '#DA70D6',
    'MD': '#ADFF2F', 'MA': '#FF1493', 'MI': '#7FFF00', 'MN': '#00CED1', 'MS': '#FF4500',
    'MO': '#7B68EE', 'MT': '#00FA9A', 'NE': '#1E90FF', 'NV': '#B0E0E6', 'NH': '#EE82EE',
    'NJ': '#FF00FF', 'NM': '#00FFFF', 'NY': '#FFFF00', 'NC': '#00FF00', 'ND': '#FF6600',
    'OH': '#FF0066', 'OK': '#00FF99', 'OR': '#9900FF', 'PA': '#3366FF', 'RI': '#CCFF00',
    'SC': '#FF0033', 'SD': '#0099CC', 'TN': '#FFCC00', 'TX': '#CC00FF', 'UT': '#6600FF',
    'VT': '#00FFCC', 'VA': '#FFD700', 'WA': '#FF7F50', 'WV': '#00BFFF', 'WI': '#DA70D6',
    'WY': '#ADFF2F'
  };

  const normalizedState = state.toUpperCase().trim();
  
  // Return mapped color if exists
  if (stateMap[normalizedState]) {
    return stateMap[normalizedState];
  }

  // Fallback palette for state names or unknowns
  const colors = [
    '#ff00ff', '#00ffff', '#ffff00', '#00ff00', '#ff6600',
    '#ff0066', '#00ff99', '#9900ff', '#3366ff', '#ccff00',
    '#ff0033', '#0099cc', '#ffcc00', '#cc00ff', '#6600ff'
  ];
  
  // Hash for unknown states
  let hash = 0;
  for (let i = 0; i < state.length; i++) {
    hash = state.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

const TheaterMap: React.FC<TheaterMapProps> = ({ theaters, onTheaterSelect, userLocation }) => {
  const [geojsonData, setGeojsonData] = useState<any>(null);
  const defaultCenter: [number, number] = [39.8283, -98.5795];
  const zoom = 4;

  useEffect(() => {
    fetch('https://raw.githubusercontent.com/python-visualization/folium/master/examples/data/us-states.json')
      .then(res => res.json())
      .then(data => setGeojsonData(data))
      .catch(err => console.error("Error loading geojson:", err));
  }, []);

  // Filter valid theaters and handle overlaps
  const validTheaters = theaters.filter(t => 
    typeof t.lat === 'number' && typeof t.lng === 'number' && 
    !isNaN(t.lat) && !isNaN(t.lng) &&
    t.lat !== 0 && t.lng !== 0
  );

  if (validTheaters.length < theaters.length) {
    console.warn(`[TheaterMap] Skipped ${theaters.length - validTheaters.length} theaters due to invalid or missing coordinates.`);
  }

  // Handle overlapping coordinates by applying a tiny offset
  const processedTheaters = validTheaters.map((t, i) => {
    const isDuplicate = validTheaters.slice(0, i).some(prev => 
      prev.lat === t.lat && prev.lng === t.lng
    );
    
    if (isDuplicate) {
      // Apply a tiny random offset to make overlapping markers distinguishible
      return {
        ...t,
        lat: t.lat + (Math.random() - 0.5) * 0.005,
        lng: t.lng + (Math.random() - 0.5) * 0.005
      };
    }
    return t;
  });

  return (
    <div className="h-full w-full relative">
      {theaters.length > validTheaters.length && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-retro-red/90 text-white text-[10px] px-3 py-1 rounded-full border border-white font-retro animate-pulse">
          {theaters.length - validTheaters.length} THEATERS HIDDEN (MISSING COORDINATES)
        </div>
      )}
      <MapContainer 
        center={userLocation ? [userLocation.lat, userLocation.lng] : defaultCenter} 
        zoom={userLocation ? 6 : zoom} 
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={false}
        touchZoom={true}
        dragging={true}
      >
        <MapResizer />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        
        {geojsonData && (
          <GeoJSON 
            data={geojsonData}
            style={() => ({
              color: '#00ffff',
              weight: 1.5,
              opacity: 0.8,
              fillColor: 'transparent',
              fillOpacity: 0,
              className: 'state-border-neon'
            })}
          />
        )}
        
        {processedTheaters.map((theater, idx) => {
          const color = getStateColor(theater.state);
          return (
            <Marker 
              key={`${theater.id || theater.name}-${idx}`} 
              position={[theater.lat, theater.lng]}
              icon={L.divIcon({
                className: 'custom-theater-marker',
                html: `
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="${color}" stroke="white" stroke-width="1.5" style="filter: drop-shadow(0 0 5px ${color});">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                  </svg>
                `,
                iconSize: [18, 18],
                iconAnchor: [9, 9]
              })}
            >
              <Popup>
                <div className="text-retro-navy p-1">
                  <h3 className="font-bold text-sm">{theater.name}</h3>
                  <p className="text-xs">{theater.city}, <span style={{ color: color, fontWeight: 'bold' }}>{theater.state}</span></p>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      console.log('View Details clicked for:', theater.name);
                      onTheaterSelect(theater);
                    }}
                    className="mt-2 text-[10px] bg-retro-pink text-white px-2 py-1 rounded uppercase font-bold w-full touch-manipulation cursor-pointer active:scale-95"
                  >
                    View Details
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {userLocation && (
          <Marker 
            position={[userLocation.lat, userLocation.lng]}
            icon={L.divIcon({
              className: 'user-location-marker',
              html: '<div class="w-4 h-4 bg-retro-cyan rounded-full border-2 border-white shadow-[0_0_10px_#00ffff]"></div>',
              iconSize: [16, 16],
              iconAnchor: [8, 8]
            })}
          >
            <Popup>You are here</Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
};

export default TheaterMap;
