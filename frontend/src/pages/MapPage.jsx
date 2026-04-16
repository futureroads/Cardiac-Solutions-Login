import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { GoogleMap, useJsApiLoader, Marker, OverlayView } from "@react-google-maps/api";
import { ArrowLeft, Loader2, Maximize2 } from "lucide-react";
import API_BASE from "@/apiBase";

const API = API_BASE + "/api";
const MAP_KEY = process.env.REACT_APP_GOOGLE_MAPS_KEY;

const containerStyle = { width: "100%", height: "100%" };
const center = { lat: 33.5, lng: -86.8 };

const darkMapStyles = [
  { elementType: "geometry", stylers: [{ color: "#1a2035" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0a0f1c" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#5a6a80" }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#2a3a52" }] },
  { featureType: "administrative.country", elementType: "geometry.stroke", stylers: [{ color: "#06b6d4", weight: 1 }] },
  { featureType: "administrative.province", elementType: "geometry.stroke", stylers: [{ color: "#2a3a52" }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#1a2035" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#141c2e" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#1a2332" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#1c2840" }] },
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
  const [subscribers, setSubscribers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hoveredId, setHoveredId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const mapRef = useRef(null);

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
          const subs = (data.subscribers || []).filter(s => s.has_geocode && s.geocode_lat && s.geocode_lng);
          setSubscribers(subs);
        }
      } catch {}
      setLoading(false);
    })();
  }, []);

  const geoSubs = subscribers;

  const fitAllMarkers = useCallback(() => {
    if (geoSubs.length > 0 && mapRef.current && window.google) {
      const bounds = new window.google.maps.LatLngBounds();
      geoSubs.forEach(s => bounds.extend({ lat: parseFloat(s.geocode_lat), lng: parseFloat(s.geocode_lng) }));
      mapRef.current.fitBounds(bounds, 60);
    }
  }, [geoSubs]);

  useEffect(() => { fitAllMarkers(); }, [fitAllMarkers]);

  const onLoad = useCallback((mapInstance) => { mapRef.current = mapInstance; }, []);

  const handleMarkerClick = useCallback((i) => {
    setSelectedId(prev => prev === i ? null : i);
  }, []);

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
            <div className="text-[9px] text-slate-500 font-orbitron tracking-wider">AED READINESS MONITORING</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {loading && <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />}
          <div className="font-orbitron text-[9px] text-slate-500">
            {geoSubs.length} LOCATIONS
          </div>
          <button
            onClick={fitAllMarkers}
            className="font-orbitron text-[8px] px-3 py-1.5 border border-cyan-500/30 text-cyan-400 rounded-sm hover:bg-cyan-500/10 flex items-center gap-1.5"
            data-testid="fit-all-btn"
          >
            <Maximize2 className="w-3 h-3" /> FIT ALL
          </button>
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
            {geoSubs.map((sub, i) => {
              const lat = parseFloat(sub.geocode_lat);
              const lng = parseFloat(sub.geocode_lng);
              if (isNaN(lat) || isNaN(lng)) return null;

              const counts = sub.status_counts || {};
              const total = sub.aed_count || 0;
              const readyCount = counts.READY || 0;
              const readyPct = total > 0 ? Math.round((readyCount / total) * 100) : 0;
              const pinColor = readyPct >= 90 ? "#22c55e" : readyPct >= 50 ? "#f59e0b" : "#ef4444";

              return (
                <Marker
                  key={`${sub.subscriber}-${i}`}
                  position={{ lat, lng }}
                  icon={{
                    path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
                    fillColor: pinColor,
                    fillOpacity: 1,
                    strokeColor: "#0a0f1c",
                    strokeWeight: 2,
                    scale: 2.2,
                    anchor: { x: 12, y: 24 },
                  }}
                  onMouseOver={() => { if (selectedId !== i) setHoveredId(i); }}
                  onMouseOut={() => setHoveredId(null)}
                  onClick={() => handleMarkerClick(i)}
                >
                  {hoveredId === i && selectedId !== i && (
                    <OverlayView
                      position={{ lat, lng }}
                      mapPaneName={OverlayView.FLOAT_PANE}
                      getPixelPositionOffset={(w, h) => ({ x: -(w / 2), y: -h - 30 })}
                    >
                      <div style={{
                        background: "rgba(6,10,20,0.92)",
                        border: "1px solid rgba(6,182,212,0.4)",
                        borderRadius: 3,
                        padding: "8px 14px",
                        fontFamily: "Orbitron, monospace",
                        whiteSpace: "nowrap",
                        pointerEvents: "none",
                      }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: "#06b6d4", letterSpacing: 1 }}>{sub.display_name || sub.subscriber}</div>
                        <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
                          {total} AEDs - {readyPct}% Ready
                        </div>
                      </div>
                    </OverlayView>
                  )}
                  {selectedId === i && (
                    <OverlayView
                      position={{ lat, lng }}
                      mapPaneName={OverlayView.FLOAT_PANE}
                      getPixelPositionOffset={(w, h) => ({ x: -(w / 2), y: -h - 36 })}
                    >
                      <div style={{
                        background: "rgba(6,10,20,0.95)",
                        border: "1px solid rgba(6,182,212,0.5)",
                        borderRadius: 4,
                        padding: "10px 16px",
                        fontFamily: "Orbitron, monospace",
                        whiteSpace: "nowrap",
                        minWidth: 200,
                      }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: "#06b6d4", letterSpacing: 1, marginBottom: 6 }}>{sub.display_name || sub.subscriber}</div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                          <span style={{ fontSize: 15, fontWeight: 700, color: "#22c55e" }}>
                            {total} AEDs
                          </span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: readyPct >= 90 ? "#22c55e" : readyPct >= 50 ? "#f59e0b" : "#ef4444" }}>
                            {readyPct}% READY
                          </span>
                        </div>
                        {Object.entries(counts)
                          .filter(([k, v]) => k !== "READY" && k !== "UNCLASSIFIED" && v > 0)
                          .sort(([,a],[,b]) => b - a)
                          .map(([status, count]) => (
                            <div key={status} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#94a3b8", marginTop: 3 }}>
                              <span>{status}</span>
                              <span style={{ color: "#ef4444", fontWeight: 700, marginLeft: 16 }}>{count}</span>
                            </div>
                          ))
                        }
                        {readyCount > 0 && (
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#94a3b8", marginTop: 3 }}>
                            <span>READY</span>
                            <span style={{ color: "#22c55e", fontWeight: 700, marginLeft: 16 }}>{readyCount}</span>
                          </div>
                        )}
                      </div>
                    </OverlayView>
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
