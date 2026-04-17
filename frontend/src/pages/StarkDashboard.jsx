import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { GoogleMap, useJsApiLoader, Marker, OverlayView } from "@react-google-maps/api";
import { ArrowLeft, Loader2, Play, Pause, Maximize2, MapPin } from "lucide-react";
import API_BASE from "@/apiBase";

const API = API_BASE + "/api";
const MAP_KEY = process.env.REACT_APP_GOOGLE_MAPS_KEY;

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

const mapCenter = { lat: 33.5, lng: -86.8 };

export default function StarkDashboard({ user, onLogout }) {
  const navigate = useNavigate();
  const token = localStorage.getItem("token") || "";

  // --- Map State ---
  const [mapSubs, setMapSubs] = useState([]);
  const [mapLoading, setMapLoading] = useState(true);
  const [hoveredId, setHoveredId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const mapRef = useRef(null);
  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: MAP_KEY });

  // --- DI State ---
  const [liveStats, setLiveStats] = useState(null);
  const [bpData, setBpData] = useState(null);
  const [diPaused, setDiPaused] = useState(false);
  const [freshUser, setFreshUser] = useState(user);

  // Refresh user data
  useEffect(() => {
    fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) { setFreshUser(data); localStorage.setItem("user", JSON.stringify(data)); } })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch map data
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/support/map-locations`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const data = await res.json();
          setMapSubs((data.subscribers || []).filter(s => s.has_geocode && s.geocode_lat && s.geocode_lng));
        }
      } catch {}
      setMapLoading(false);
    })();
  }, [token]);

  // Fetch Readisys stats for DI
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch(`${API}/status-overview`);
        if (res.ok) setLiveStats(await res.json());
      } catch {}
      try {
        const res = await fetch(`${API}/status-overview/expiring-expired-bp`);
        if (res.ok) setBpData(await res.json());
      } catch {}
    };
    fetchStats();
    const interval = setInterval(fetchStats, 300000);
    return () => clearInterval(interval);
  }, []);

  // Map helpers
  const geoSubs = mapSubs;
  const fitAllMarkers = useCallback(() => {
    if (geoSubs.length > 0 && mapRef.current && window.google) {
      const bounds = new window.google.maps.LatLngBounds();
      geoSubs.forEach(s => bounds.extend({ lat: parseFloat(s.geocode_lat), lng: parseFloat(s.geocode_lng) }));
      mapRef.current.fitBounds(bounds, 60);
    }
  }, [geoSubs]);
  useEffect(() => { fitAllMarkers(); }, [fitAllMarkers]);
  const onMapLoad = useCallback((m) => { mapRef.current = m; }, []);

  // DI Recommendations — default all to overview for Stark
  const diPerms = freshUser?.di_permissions || { expired_bp: "overview", expiring_bp: "overview", camera_battery: "overview", camera_cellular: "overview" };
  const aiRecs = (() => {
    if (!liveStats && !bpData) return [{ type: "SYS", msg: "Connecting to Readisys API... Stand by." }];
    const items = [];
    const bd = liveStats?.totals?.telemetry_distribution?.battery || {};
    const cd = liveStats?.totals?.telemetry_distribution?.cellular || {};
    const trend = liveStats?._pct_trend;
    if (trend === "up") items.push({ type: "INFO", msg: "GOOD JOB! The percent ready has improved since yesterday!" });
    else if (trend === "down") items.push({ type: "INFO", msg: "The percent ready has slipped today. You might want to review the statuses." });
    else if (trend === "stable") items.push({ type: "INFO", msg: "Percent ready is stable." });

    if (diPerms.camera_battery === "overview") {
      const total = (bd.p0_24 || 0) + (bd.p25_49 || 0) + (bd.p50_74 || 0) + (bd.p75_100 || 0);
      items.push({ type: "SYS", msg: `CAMERA BATTERY OVERVIEW: ${total} total — P0-24: ${bd.p0_24 || 0}, P25-49: ${bd.p25_49 || 0}, P50-74: ${bd.p50_74 || 0}, P75-100: ${bd.p75_100 || 0}` });
    } else if (diPerms.camera_battery === "details") {
      if (bd.p0_24 > 0) items.push({ type: "ACT", msg: `CAMERA BATTERY P0-P24: ${bd.p0_24} devices at critical battery level.` });
      if (bd.p25_49 > 0) items.push({ type: "WARN", msg: `CAMERA BATTERY P25-P49: ${bd.p25_49} devices at low battery level.` });
    }
    if (diPerms.camera_cellular === "overview") {
      const cc = bpData?.totals?.camera_cellular || cd;
      items.push({ type: "SYS", msg: `CAMERA CELLULAR OVERVIEW: HIGH: ${cc.HIGH || 0}, MEDIUM: ${cc.MEDIUM || 0}, LOW: ${cc.LOW || 0}, BAD: ${cc.BAD || 0}` });
    } else if (diPerms.camera_cellular === "details") {
      const cc = bpData?.totals?.camera_cellular || cd;
      if ((cc.BAD || 0) > 0) items.push({ type: "ACT", msg: `CAMERA CELLULAR BAD: ${cc.BAD} devices with no signal.` });
      if ((cc.LOW || 0) > 0) items.push({ type: "WARN", msg: `CAMERA CELLULAR LOW: ${cc.LOW} devices with weak signal.` });
    }
    if (bpData?.devices) {
      const expired = bpData.devices.filter(d => d.detailed_status === "EXPIRED B/P");
      const expiring = bpData.devices.filter(d => d.detailed_status !== "EXPIRED B/P");
      if (diPerms.expired_bp === "overview") {
        const c = bpData?.totals?.expired_bp || expired.length;
        if (c > 0) items.push({ type: "ACT", msg: `EXPIRED B/P OVERVIEW: ${c} devices with expired batteries/pads.` });
      } else if (diPerms.expired_bp === "details") {
        expired.forEach(d => items.push({ type: "ACT", msg: `${d.subscriber} — ${d.sentinel_id} — ${d.days_summary}. Location: ${d.location?.split("·").slice(0, 3).join("·").trim() || "—"}` }));
      }
      if (diPerms.expiring_bp === "overview") {
        const c = bpData?.totals?.expiring_batt_pads || expiring.length;
        if (c > 0) items.push({ type: "WARN", msg: `EXPIRING B/P OVERVIEW: ${c} devices with expiring batteries/pads.` });
      } else if (diPerms.expiring_bp === "details") {
        expiring.forEach(d => items.push({ type: "WARN", msg: `${d.subscriber} — ${d.sentinel_id} — ${d.days_summary}. Location: ${d.location?.split("·").slice(0, 3).join("·").trim() || "—"}` }));
      }
    }
    return items.length > 0 ? items : [{ type: "SYS", msg: "No device alerts at this time." }];
  })();

  const diList = [...aiRecs.map((r, i) => ({ ...r, _key: `a-${i}` })), { type: "_DIVIDER", msg: "", _key: "div" }, ...aiRecs.map((r, i) => ({ ...r, _key: `b-${i}` }))];
  const scrollDur = Math.max(60, diList.length * 3);

  const stats = liveStats?.totals || {};
  const pctReady = stats.percent_ready != null ? Number(stats.percent_ready).toFixed(1) : "—";
  const totalAeds = stats.total || 0;
  const readyCount = stats.ready || 0;

  const typeColor = (t) => t === "ACT" ? "text-red-400" : t === "WARN" ? "text-yellow-400" : t === "INFO" ? "text-green-400" : t === "ERR" ? "text-red-500" : "text-cyan-400/80";

  return (
    <div className="h-screen bg-[#060a14] text-white flex flex-col overflow-hidden" data-testid="stark-dashboard">
      {/* Background Grid */}
      <div className="fixed inset-0 pointer-events-none z-0" style={{
        backgroundImage: "linear-gradient(rgba(0,212,255,0.032) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.032) 1px, transparent 1px)",
        backgroundSize: "36px 36px",
      }} />

      {/* Top Bar */}
      <div className="flex-shrink-0 border-b border-cyan-500/30 bg-[rgba(0,18,32,0.93)] px-6 py-2 flex items-center justify-between z-10" style={{ clipPath: "polygon(0 0, 100% 0, 99% 100%, 1% 100%)" }}>
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/hub")} className="flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 transition-colors" data-testid="stark-back-btn">
            <ArrowLeft className="w-4 h-4" />
            <span className="font-orbitron text-[9px] font-bold tracking-wider">HUB</span>
          </button>
          <div className="w-[1px] h-[20px] bg-cyan-500/30" />
          <div className="flex flex-col">
            <div className="font-orbitron text-[13px] font-black tracking-[0.25em] text-red-500">CARDIAC SOLUTIONS</div>
            <div className="font-orbitron text-[9px] font-bold tracking-[0.2em] text-cyan-400">STARK COMMAND CENTER</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="font-orbitron text-[9px] text-cyan-400 tracking-wider">{pctReady}% READY</div>
            <div className="font-orbitron text-[7px] text-slate-500 tracking-wider">{totalAeds.toLocaleString()} AEDs / {readyCount.toLocaleString()} READY</div>
          </div>
          <div className="font-orbitron text-[9px] text-slate-500 tracking-wider">{user?.username?.toUpperCase()}</div>
        </div>
      </div>

      {/* Main Content: Map (top/center) + DI (bottom) */}
      <div className="flex-1 flex flex-col gap-[7px] p-[10px] relative z-10 overflow-hidden">
        {/* MAP — Hero Card */}
        <div className="flex-1 border border-cyan-500/30 bg-[rgba(0,18,32,0.93)] rounded-sm overflow-hidden relative" data-testid="stark-map-card">
          <div className="absolute top-3 left-4 z-20 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-cyan-400" />
            <span className="font-orbitron text-[10px] text-cyan-400 tracking-wider">SUBSCRIBER MAP</span>
            <span className="font-orbitron text-[8px] text-slate-500 ml-2">{geoSubs.length} LOCATIONS</span>
          </div>
          <button
            onClick={fitAllMarkers}
            className="absolute top-3 right-4 z-20 font-orbitron text-[7px] px-2.5 py-1 border border-cyan-500/30 text-cyan-400 rounded-sm hover:bg-cyan-500/10 flex items-center gap-1"
            data-testid="stark-fit-all"
          >
            <Maximize2 className="w-3 h-3" /> FIT ALL
          </button>
          {mapLoading || !isLoaded ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
            </div>
          ) : (
            <GoogleMap mapContainerStyle={{ width: "100%", height: "100%" }} center={mapCenter} zoom={7} options={mapOptions} onLoad={onMapLoad}>
              {geoSubs.map((sub, i) => {
                const lat = parseFloat(sub.geocode_lat);
                const lng = parseFloat(sub.geocode_lng);
                if (isNaN(lat) || isNaN(lng)) return null;
                const counts = sub.status_counts || {};
                const total = sub.aed_count || 0;
                const readyPct = total > 0 ? Math.round(((counts.READY || 0) / total) * 100) : 0;
                const pinColor = readyPct >= 90 ? "#22c55e" : readyPct >= 50 ? "#f59e0b" : "#ef4444";
                return (
                  <Marker key={`${sub.subscriber}-${i}`} position={{ lat, lng }}
                    icon={{ path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z", fillColor: pinColor, fillOpacity: 1, strokeColor: "#0a0f1c", strokeWeight: 2, scale: 2.2, anchor: { x: 12, y: 24 } }}
                    onMouseOver={() => { if (selectedId !== i) setHoveredId(i); }}
                    onMouseOut={() => setHoveredId(null)}
                    onClick={() => setSelectedId(prev => prev === i ? null : i)}
                  >
                    {hoveredId === i && selectedId !== i && (
                      <OverlayView position={{ lat, lng }} mapPaneName={OverlayView.FLOAT_PANE} getPixelPositionOffset={(w, h) => ({ x: -(w / 2), y: -h - 30 })}>
                        <div style={{ background: "rgba(6,10,20,0.92)", border: "1px solid rgba(6,182,212,0.4)", borderRadius: 3, padding: "8px 14px", fontFamily: "Orbitron, monospace", whiteSpace: "nowrap", pointerEvents: "none" }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: "#06b6d4", letterSpacing: 1 }}>{sub.display_name || sub.subscriber}</div>
                          <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{total} AEDs - {readyPct}% Ready</div>
                        </div>
                      </OverlayView>
                    )}
                    {selectedId === i && (
                      <OverlayView position={{ lat, lng }} mapPaneName={OverlayView.FLOAT_PANE} getPixelPositionOffset={(w, h) => ({ x: -(w / 2), y: -h - 36 })}>
                        <div style={{ background: "rgba(6,10,20,0.95)", border: "1px solid rgba(6,182,212,0.5)", borderRadius: 4, padding: "10px 16px", fontFamily: "Orbitron, monospace", whiteSpace: "nowrap", minWidth: 200 }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: "#06b6d4", letterSpacing: 1, marginBottom: 6 }}>{sub.display_name || sub.subscriber}</div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                            <span style={{ fontSize: 15, fontWeight: 700, color: "#22c55e" }}>{total} AEDs</span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: readyPct >= 90 ? "#22c55e" : readyPct >= 50 ? "#f59e0b" : "#ef4444" }}>{readyPct}% READY</span>
                          </div>
                          {Object.entries(counts).filter(([k, v]) => k !== "READY" && k !== "UNCLASSIFIED" && v > 0).sort(([,a],[,b]) => b - a).map(([status, count]) => (
                            <div key={status} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#94a3b8", marginTop: 3 }}>
                              <span>{status}</span>
                              <span style={{ color: "#ef4444", fontWeight: 700, marginLeft: 16 }}>{count}</span>
                            </div>
                          ))}
                          {(counts.READY || 0) > 0 && (
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#94a3b8", marginTop: 3 }}>
                              <span>READY</span>
                              <span style={{ color: "#22c55e", fontWeight: 700, marginLeft: 16 }}>{counts.READY}</span>
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

        {/* DI Panel — Compact, below map */}
        <div className="flex-shrink-0 h-[160px] border border-cyan-500/30 bg-[rgba(0,18,32,0.93)] rounded-sm overflow-hidden relative" data-testid="stark-di-panel">
          <div className="absolute top-[6px] right-[8px] z-20">
            <button onClick={() => setDiPaused(!diPaused)} className="w-[24px] h-[24px] flex items-center justify-center rounded-sm border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 transition-colors" data-testid="stark-di-toggle">
              {diPaused ? <Play className="w-3 h-3 text-cyan-400" /> : <Pause className="w-3 h-3 text-cyan-400" />}
            </button>
          </div>
          <div className="px-3 pt-2 pb-1">
            <div className="font-orbitron text-[9px] text-cyan-400/70 tracking-wider">Decision Intelligence — Overview</div>
          </div>
          <div className="px-3 overflow-hidden h-[120px]" data-testid="stark-di-scroll">
            <div
              className="space-y-[3px]"
              style={{
                animation: diPaused ? "none" : `diScroll ${scrollDur}s linear infinite`,
              }}
            >
              {diList.map((rec) =>
                rec.type === "_DIVIDER" ? (
                  <div key={rec._key} className="border-t border-cyan-500/10 my-1" />
                ) : (
                  <div key={rec._key} className="flex gap-2 items-start py-[2px]">
                    <span className={`font-orbitron text-[7px] font-bold tracking-wider flex-shrink-0 mt-[1px] ${typeColor(rec.type)}`}>[{rec.type}]</span>
                    <span className="text-[10px] text-slate-300/90 leading-tight">{rec.msg}</span>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes diScroll {
          0% { transform: translateY(0); }
          100% { transform: translateY(-50%); }
        }
      `}</style>
    </div>
  );
}
