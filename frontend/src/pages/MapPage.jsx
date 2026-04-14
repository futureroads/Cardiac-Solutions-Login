import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from "@react-google-maps/api";
import { ArrowLeft, Loader2 } from "lucide-react";
import API_BASE from "@/apiBase";

const API = API_BASE + "/api";
const MAP_KEY = process.env.REACT_APP_GOOGLE_MAPS_KEY;

const containerStyle = { width: "100%", height: "100%" };
const center = { lat: 33.5, lng: -86.8 };

const darkMapStyles = [
  { elementType: "geometry", stylers: [{ color: "#0a0f1c" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0a0f1c" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#4a5568" }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#1a2332" }] },
  { featureType: "administrative.country", elementType: "geometry.stroke", stylers: [{ color: "#06b6d4", weight: 1 }] },
  { featureType: "administrative.province", elementType: "geometry.stroke", stylers: [{ color: "#1e3a5f" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#0f1a2e" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#1a2332" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#14253d" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#060a14" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#1e3a5f" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

const mapOptions = {
  styles: darkMapStyles,
  disableDefaultUI: false,
  zoomControl: true,
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: false,
  minZoom: 4,
  maxZoom: 18,
};

export default function MapPage({ user }) {
  const navigate = useNavigate();
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hoveredId, setHoveredId] = useState(null);

  const { isLoaded, loadError } = useJsApiLoader({ googleMapsApiKey: MAP_KEY });

  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API}/support/map-locations`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          const locs = (data.locations || []).filter(l => l.geocode_lat && l.geocode_lng);
          setLocations(locs);
        }
      } catch {}
      setLoading(false);
    })();
  }, []);

  const onLoad = useCallback(() => {}, []);

  if (loadError) {
    return (
      <div className="min-h-screen bg-[#060a14] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="font-orbitron text-red-400 text-sm mb-2">MAP LOAD ERROR</div>
          <div className="text-slate-500 text-xs">{loadError.message}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#060a14] text-white flex flex-col" data-testid="map-page">
      {/* Top bar */}
      <div className="border-b border-cyan-500/15 px-6 py-3 flex items-center justify-between bg-[rgba(6,10,20,0.95)] flex-shrink-0 z-10">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/hub")} className="text-slate-500 hover:text-cyan-400 transition-colors" data-testid="back-to-hub">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="font-orbitron text-sm tracking-wider text-cyan-400">SUBSCRIBER MAP</div>
            <div className="text-[9px] text-slate-500 font-orbitron tracking-wider">AED LOCATION MONITORING</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {loading && <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />}
          <div className="font-orbitron text-[9px] text-slate-500">
            {locations.length} LOCATIONS
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        {!isLoaded ? (
          <div className="flex items-center justify-center h-full">
            <div className="font-orbitron text-cyan-400 text-xs animate-pulse">LOADING MAP...</div>
          </div>
        ) : (
          <GoogleMap
            mapContainerStyle={containerStyle}
            center={center}
            zoom={7}
            options={mapOptions}
            onLoad={onLoad}
          >
            {locations.map((loc, i) => {
              const lat = parseFloat(loc.geocode_lat);
              const lng = parseFloat(loc.geocode_lng);
              if (isNaN(lat) || isNaN(lng)) return null;
              return (
                <Marker
                  key={`${loc.subscriber}-${i}`}
                  position={{ lat, lng }}
                  title={loc.subscriber}
                  icon={{
                    path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
                    fillColor: "#22c55e",
                    fillOpacity: 1,
                    strokeColor: "#0a0f1c",
                    strokeWeight: 1.5,
                    scale: 1.5,
                    anchor: { x: 12, y: 24 },
                  }}
                  onMouseOver={() => setHoveredId(i)}
                  onMouseOut={() => setHoveredId(null)}
                >
                  {hoveredId === i && (
                    <InfoWindow onCloseClick={() => setHoveredId(null)}>
                      <div style={{ padding: "4px 8px", fontFamily: "Orbitron, monospace", minWidth: 160 }}>
                        <div style={{ fontWeight: 700, fontSize: 12, color: "#0a0f1c", marginBottom: 4 }}>{loc.subscriber}</div>
                        {loc.location_name && loc.location_name !== loc.subscriber && (
                          <div style={{ fontSize: 10, color: "#475569" }}>{loc.location_name}</div>
                        )}
                        <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>
                          {[loc.city, loc.state].filter(Boolean).join(", ")}
                        </div>
                      </div>
                    </InfoWindow>
                  )}
                </Marker>
              );
            })}
          </GoogleMap>
        )}
      </div>
    </div>
  );
}
