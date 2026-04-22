import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { GoogleMap, useJsApiLoader, Marker, OverlayView } from "@react-google-maps/api";
import { Loader2, Play, Pause, Maximize2, MapPin, LogOut, Mic, AlertTriangle, RefreshCw } from "lucide-react";
import { getLedColor, LED_STYLES, useServiceStatuses } from "@/data/serviceStatuses";
import { ReadinessBreakdownModal } from "@/components/ReadinessBreakdownModal";
import API_BASE from "@/apiBase";

const API = API_BASE + "/api";
const API_URL = API_BASE;
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

const mapOptions = { styles: darkMapStyles, disableDefaultUI: false, zoomControl: true, mapTypeControl: false, streetViewControl: false, fullscreenControl: false, minZoom: 4, maxZoom: 18 };
const mapCenter = { lat: 33.5, lng: -86.8 };

export default function StarkDashboard({ user, onLogout }) {
  const navigate = useNavigate();
  const token = localStorage.getItem("token") || "";
  const [currentTime, setCurrentTime] = useState(new Date());
  const [freshUser, setFreshUser] = useState(user);

  // Voice state
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const cachedAudioRef = useRef(null);

  // Map state
  const [mapSubs, setMapSubs] = useState([]);
  const [mapLoading, setMapLoading] = useState(true);
  const [hoveredId, setHoveredId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const mapRef = useRef(null);
  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: MAP_KEY });

  // Status data
  const [liveStats, setLiveStats] = useState(null);
  const [statusError, setStatusError] = useState(null);
  const [bpData, setBpData] = useState(null);
  const { categories: serviceCategories } = useServiceStatuses(60000);

  // DI state
  const [diPaused, setDiPaused] = useState(false);
  const [showReadinessBreakdown, setShowReadinessBreakdown] = useState(false);

  // Service tickets (from service-tickets API or static)
  const [ticketCounts, setTicketCounts] = useState(null);
  // Readiness data (actual + adjusted from support dashboard-data)
  const [readiness, setReadiness] = useState(null);
  const [supportData, setSupportData] = useState(null);
  // Notifications sent today
  const [notifToday, setNotifToday] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Refresh user
  useEffect(() => {
    fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) { setFreshUser(d); localStorage.setItem("user", JSON.stringify(d)); } })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Preload TTS
  useEffect(() => {
    (async () => {
      try {
        const hour = new Date().getHours();
        const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
        const text = `${greeting}. My name is Ayda. How can I help you?`;
        const res = await fetch(`${API_URL}/api/tts/speak`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ text, voice: "nova" }) });
        if (res.ok) { const d = await res.json(); cachedAudioRef.current = `data:audio/mp3;base64,${d.audio}`; }
      } catch {}
    })();
  }, [token]);

  const jarvisGreet = async () => {
    if (isSpeaking) return;
    setIsSpeaking(true); setIsListening(true);
    if (cachedAudioRef.current) {
      const audio = new Audio(cachedAudioRef.current);
      audio.onended = () => { setIsSpeaking(false); setIsListening(false); };
      audio.onerror = () => { setIsSpeaking(false); setIsListening(false); };
      await audio.play(); return;
    }
    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
    const text = `${greeting}. My name is AEDA. How can I help you?`;
    try {
      const res = await fetch(`${API_URL}/api/tts/speak`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ text, voice: "nova" }) });
      if (!res.ok) throw new Error();
      const d = await res.json();
      const audio = new Audio(`data:audio/mp3;base64,${d.audio}`);
      audio.onended = () => { setIsSpeaking(false); setIsListening(false); };
      await audio.play();
    } catch {
      setIsSpeaking(false); setIsListening(false);
    }
  };

  // Fetch map
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/support/map-locations`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) { const d = await res.json(); setMapSubs((d.subscribers || []).filter(s => s.has_geocode && s.geocode_lat && s.geocode_lng)); }
      } catch {}
      setMapLoading(false);
    })();
  }, [token]);

  // Fetch Readisys stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API}/status-overview`);
      if (res.ok) { setLiveStats(await res.json()); setStatusError(null); } else setStatusError("API error");
    } catch { setStatusError("Connection failed"); }
    try { const res = await fetch(`${API}/status-overview/expiring-expired-bp`); if (res.ok) setBpData(await res.json()); } catch {}
  }, []);

  useEffect(() => { fetchStats(); const i = setInterval(fetchStats, 300000); return () => clearInterval(i); }, [fetchStats]);

  // Fetch readiness + support data from support dashboard-data
  useEffect(() => {
    const fetchSupportData = async () => {
      try {
        const res = await fetch(`${API}/support/dashboard-data`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) { const d = await res.json(); setReadiness(d.readiness || null); setSupportData(d); }
      } catch {}
    };
    fetchSupportData();
    const i = setInterval(fetchSupportData, 300000);
    return () => clearInterval(i);
  }, [token]);

  // Fetch service ticket counts
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/service-tickets/counts`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) setTicketCounts(await res.json());
      } catch {}
    })();
  }, [token]);

  // Fetch notifications sent today (refresh every 60s)
  useEffect(() => {
    const fetchNotifCount = async () => {
      try {
        const res = await fetch(`${API}/support/notifications-today-count`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) { const d = await res.json(); setNotifToday(d.count || 0); }
      } catch {}
    };
    fetchNotifCount();
    const i = setInterval(fetchNotifCount, 60000);
    return () => clearInterval(i);
  }, [token]);

  // Map helpers
  const geoSubs = mapSubs;
  const fitAll = useCallback(() => {
    if (geoSubs.length > 0 && mapRef.current && window.google) {
      const bounds = new window.google.maps.LatLngBounds();
      geoSubs.forEach(s => bounds.extend({ lat: parseFloat(s.geocode_lat), lng: parseFloat(s.geocode_lng) }));
      mapRef.current.fitBounds(bounds, 60);
    }
  }, [geoSubs]);
  useEffect(() => { fitAll(); }, [fitAll]);

  // Stats
  const totals = liveStats?.totals || {};
  const stats = {
    total: totals.total || 0, ready: totals.ready || 0, lost: totals.lost_contact || 0,
    service: totals.not_ready || 0, dispatch: 0, alerts: (totals.lost_contact || 0) + (totals.not_ready || 0),
    pendingNotifs: 48, sentToday: 0, devicesAffected: totals.total || 0,
  };
  const pctReady = totals.percent_ready != null ? Number(totals.percent_ready).toFixed(1) : "—";
  const pctAdjusted = readiness?.pct_ready_adjusted != null ? Number(readiness.pct_ready_adjusted).toFixed(1) : pctReady;
  const pctActual = readiness?.pct_ready != null ? Number(readiness.pct_ready).toFixed(1) : pctReady;

  // Gauge angles: 0% = -90deg (left), 100% = 90deg (right)
  const adjustedVal = readiness?.pct_ready_adjusted ?? totals.percent_ready ?? 0;
  const actualVal = readiness?.pct_ready ?? totals.percent_ready ?? 0;
  const gaugeAngleAdjusted = -90 + (adjustedVal / 100) * 180;
  const gaugeAngleActual = -90 + (actualVal / 100) * 180;

  // Last updated
  const lastUpdated = (() => {
    const ts = liveStats?.completion_time;
    if (!ts) return null;
    try {
      const d = new Date(ts);
      const now = new Date();
      const time = d.toLocaleString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
      if (d.toDateString() === now.toDateString()) return `Today ${time}`;
      return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
    } catch { return null; }
  })();

  // DI Recommendations — overview mode
  const diPerms = freshUser?.di_permissions || { expired_bp: "overview", expiring_bp: "overview", camera_battery: "overview", camera_cellular: "overview" };
  const aiRecs = (() => {
    if (!liveStats && !bpData) return [{ type: "SYS", msg: "Loading your Decision Intelligence Overview Messages..." }];
    const items = [];
    const bd = totals.telemetry_distribution?.battery || {};
    const cd = totals.telemetry_distribution?.cellular || {};
    const todayPct = totals.percent_ready;
    const prevPct = totals.prev_percent_ready;
    if (todayPct != null && prevPct != null) {
      const diff = (todayPct - prevPct).toFixed(1);
      const absDiff = Math.abs(diff);
      if (todayPct > prevPct) items.push({ type: "INFO", msg: `GOOD JOB! Percent ready improved from ${prevPct}% yesterday to ${todayPct}% today (+${absDiff}%).` });
      else if (todayPct < prevPct) items.push({ type: "INFO", msg: `Percent ready slipped from ${prevPct}% yesterday to ${todayPct}% today (-${absDiff}%). You might want to review the statuses.` });
      else items.push({ type: "INFO", msg: `Percent ready is stable at ${todayPct}% (same as yesterday).` });
    }
    items.push({ type: "SYS", msg: `SUBSCRIBER NOTIFICATIONS: ${notifToday} email${notifToday !== 1 ? "s" : ""} sent today.` });
    if (diPerms.camera_battery === "overview") {
      const t = (bd.p0_24 || 0) + (bd.p25_49 || 0) + (bd.p50_74 || 0) + (bd.p75_100 || 0);
      items.push({ type: "SYS", msg: `CAMERA BATTERY OVERVIEW: ${t} total - P0-24: ${bd.p0_24 || 0}, P25-49: ${bd.p25_49 || 0}, P50-74: ${bd.p50_74 || 0}, P75-100: ${bd.p75_100 || 0}` });
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
      if (diPerms.expired_bp === "overview") { const c = bpData?.totals?.expired_bp || expired.length; if (c > 0) items.push({ type: "ACT", msg: `EXPIRED B/P OVERVIEW: ${c} devices with expired batteries/pads.` }); }
      else if (diPerms.expired_bp === "details") { expired.forEach(d => items.push({ type: "ACT", msg: `${d.subscriber} - ${d.sentinel_id} - ${d.days_summary}` })); }
      if (diPerms.expiring_bp === "overview") { const c = bpData?.totals?.expiring_batt_pads || expiring.length; if (c > 0) items.push({ type: "WARN", msg: `EXPIRING B/P OVERVIEW: ${c} devices with expiring batteries/pads.` }); }
      else if (diPerms.expiring_bp === "details") { expiring.forEach(d => items.push({ type: "WARN", msg: `${d.subscriber} - ${d.sentinel_id} - ${d.days_summary}` })); }
    }
    return items.length > 0 ? items : [{ type: "SYS", msg: "No device alerts at this time." }];
  })();
  const diList = [...aiRecs.map((r, i) => ({ ...r, _key: `a-${i}` })), { type: "_DIVIDER", msg: "", _key: "div" }, ...aiRecs.map((r, i) => ({ ...r, _key: `b-${i}` }))];
  const scrollDur = Math.max(60, diList.length * 3);
  const typeColor = (t) => t === "ACT" ? "text-red-400" : t === "WARN" ? "text-yellow-400" : t === "INFO" ? "text-green-400" : t === "ERR" ? "text-red-500" : "text-cyan-400/80";

  const formatTime = (d) => d.toTimeString().slice(0, 8);
  const formatDate = (d) => { const days = ["SUN","MON","TUE","WED","THU","FRI","SAT"]; const months = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"]; return `${days[d.getDay()]}  ${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`; };

  // Notified AED summary
  const dsc = totals.detailed_status_counts || {};
  const actionIssues = (dsc.expired_bp || 0) + (dsc.expiring_batt_pads || 0) + (dsc.not_ready || 0) + (dsc.reposition || 0) + (dsc.not_present || 0) + (dsc.unknown || 0);

  // Ticket status rows
  const tc = ticketCounts || {};
  const ticketRows = [
    { label: "Needs Attention", count: tc.needs_attention ?? stats.alerts, color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
    { label: "Open", count: tc.open ?? 0, color: "text-green-400", bg: "bg-slate-800/50 border-slate-700/30" },
    { label: "Dispatched", count: tc.dispatched ?? 0, color: "text-green-400", bg: "bg-slate-800/50 border-slate-700/30" },
    { label: "Dispatch Acknowledged", count: tc.dispatch_acknowledged ?? 0, color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
    { label: "En Route", count: tc.en_route ?? 0, color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20" },
    { label: "On Site", count: tc.on_site ?? 0, color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
    { label: "Completed", count: tc.completed ?? 0, color: "text-cyan-400", bg: "bg-slate-800/50 border-slate-700/30" },
    { label: "Confirmed", count: tc.confirmed ?? 0, color: "text-cyan-400", bg: "bg-slate-800/50 border-slate-700/30" },
  ];

  return (
    <div className="jarvis-dash min-h-screen text-cyan-400 font-mono text-[11px] relative" data-testid="stark-dashboard">
      <div className="fixed inset-0 pointer-events-none z-0" style={{ backgroundImage: "linear-gradient(rgba(0,212,255,0.032) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.032) 1px, transparent 1px)", backgroundSize: "36px 36px" }} />
      <div className="fixed top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-500/10 to-transparent animate-scan pointer-events-none z-0" />

      <div className="grid grid-cols-[210px_1fr_220px] grid-rows-[auto_1fr] gap-[7px] p-[10px] relative z-10 min-h-screen">
        {/* TOP BAR */}
        <div className="col-span-3 flex items-center justify-between px-[18px] py-[7px] border border-cyan-500/30 bg-[rgba(0,18,32,0.93)]" style={{ clipPath: "polygon(0 0, 100% 0, 98.5% 100%, 1.5% 100%)" }}>
          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <div className="font-orbitron text-[13px] font-black tracking-[0.25em] text-red-500 animate-logo-pulse">CARDIAC SOLUTIONS</div>
              <div className="font-orbitron text-[9px] font-bold tracking-[0.2em] text-cyan-400">COMMAND CENTER</div>
            </div>
          </div>
          <div className="flex items-center gap-[16px]">
            {(() => { const c = getLedColor(serviceCategories, "external"); const s = LED_STYLES[c]; return (
              <div className="flex items-center gap-[6px] cursor-pointer hover:opacity-80" onClick={() => navigate("/outage")}>
                <span className="w-[10px] h-[10px] rounded-full animate-led-flash" style={{ backgroundColor: s.bg, boxShadow: s.shadow }} />
                <span className="font-orbitron text-[8px] font-bold tracking-wider text-slate-200">EXTERNAL SERVICES</span>
              </div>
            ); })()}
            {(() => { const c = getLedColor(serviceCategories, "internal"); const s = LED_STYLES[c]; return (
              <div className="flex items-center gap-[6px] cursor-pointer hover:opacity-80" onClick={() => navigate("/outage")}>
                <span className="w-[10px] h-[10px] rounded-full animate-led-flash-alt" style={{ backgroundColor: s.bg, boxShadow: s.shadow }} />
                <span className="font-orbitron text-[8px] font-bold tracking-wider text-slate-200">INTERNAL SYSTEMS</span>
              </div>
            ); })()}
          </div>
          <div className="flex gap-[18px] items-center text-[9px] tracking-wider">
            <span>{stats.total.toLocaleString()} AEDs</span><span>|</span>
            <span className="flex items-center gap-1"><span className="w-[5px] h-[5px] rounded-full bg-yellow-400 animate-blink-fast" />{stats.alerts} ALERTS</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end gap-[2px]">
              <div className="font-orbitron text-[13px] font-bold tracking-wider">{formatTime(currentTime)}</div>
              <div className="font-orbitron text-[10px] tracking-[0.12em] text-cyan-500/65">{formatDate(currentTime)}</div>
            </div>
            <button onClick={onLogout} className="text-red-500 hover:text-red-400 transition-colors"><LogOut className="w-4 h-4" /></button>
          </div>
        </div>

        {/* LEFT COLUMN */}
        <div className="flex flex-col gap-[7px]">
          {/* System Status with Gauge */}
          <div className="panel relative p-[10px] bg-[rgba(0,18,32,0.93)] border border-cyan-500/30 overflow-hidden cursor-pointer hover:border-cyan-400/60 transition-colors" onClick={() => setShowReadinessBreakdown(true)} data-testid="stark-system-status">
            <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
            <div className="panel-glow" />
            <div className="plabel">System Status</div>
            <div className="flex items-center justify-center gap-2 mt-1 mb-1">
              <span className="inline-block w-[6px] h-[6px] rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.7)] animate-pulse" />
              <span className="font-orbitron text-[8px] font-bold tracking-[0.2em] text-green-400">STATUS: ONLINE</span>
            </div>
            {/* Gauge */}
            <div className="flex flex-col items-center py-[8px]">
              {!liveStats && statusError ? (
                <div className="flex flex-col items-center gap-2 py-4">
                  <AlertTriangle className="w-6 h-6 text-yellow-400" />
                  <span className="font-orbitron text-[8px] text-yellow-400/80 tracking-wider text-center">{statusError}</span>
                  <button onClick={fetchStats} className="font-orbitron text-[7px] px-3 py-1 border border-cyan-500/40 bg-cyan-500/10 text-cyan-400 rounded-sm hover:bg-cyan-500/20 flex items-center gap-1"><RefreshCw className="w-3 h-3" /> RETRY</button>
                </div>
              ) : !liveStats ? (
                <div className="flex flex-col items-center gap-2 py-4"><Loader2 className="w-6 h-6 text-cyan-400 animate-spin" /></div>
              ) : (
                <>
                  <svg width="160" height="90" viewBox="0 0 160 90" className="mb-1">
                    {/* Background arc: red -> yellow -> green */}
                    <path d="M15 80 A65 65 0 0 1 145 80" fill="none" stroke="#ef4444" strokeWidth="10" strokeLinecap="round" opacity="0.5" />
                    <path d="M35 35 A65 65 0 0 1 80 18" fill="none" stroke="#f59e0b" strokeWidth="10" strokeLinecap="round" opacity="0.5" />
                    <path d="M80 18 A65 65 0 0 1 145 80" fill="none" stroke="#22c55e" strokeWidth="10" strokeLinecap="round" opacity="0.5" />
                    {/* Actual needle (thinner, dimmer) */}
                    <line x1="80" y1="80" x2="80" y2="30" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" opacity="0.6"
                      transform={`rotate(${gaugeAngleActual}, 80, 80)`} />
                    {/* Adjusted needle (thicker, bright green) */}
                    <line x1="80" y1="80" x2="80" y2="25" stroke="#22c55e" strokeWidth="3.5" strokeLinecap="round"
                      transform={`rotate(${gaugeAngleAdjusted}, 80, 80)`} />
                    <circle cx="80" cy="80" r="5" fill="#22c55e" />
                    <circle cx="80" cy="80" r="2.5" fill="white" />
                  </svg>
                  {/* Adjusted (prominent) */}
                  <div className="font-orbitron text-[28px] font-black text-green-400" style={{ textShadow: "0 0 18px rgba(57,255,20,0.5)" }}>{pctAdjusted}%</div>
                  <div className="font-orbitron text-[7px] font-bold text-green-400 tracking-[0.2em]">ADJUSTED READY</div>
                  {/* Actual (smaller, subdued) */}
                  <div className="font-orbitron text-[13px] font-bold text-slate-400 mt-1">{pctActual}%</div>
                  <div className="font-orbitron text-[7px] text-slate-500 tracking-[0.2em]">ACTUAL READY</div>
                  <div className="font-orbitron text-[9px] text-cyan-400/70 tracking-wider mt-2">{stats.total.toLocaleString()} TOTAL AEDs</div>
                  {lastUpdated && <div className="font-orbitron text-[8px] text-cyan-500/50 tracking-wider mt-1">Last Updated: {lastUpdated}</div>}
                </>
              )}
            </div>
          </div>

          {/* Subscriber Notifications */}
          <div className="panel relative p-[10px] bg-[rgba(0,18,32,0.93)] border border-cyan-500/30 overflow-hidden" data-testid="stark-notifications">
            <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
            <div className="panel-glow" />
            <div className="plabel">Subscriber Notifications</div>
            <div className="grid grid-cols-2 gap-[6px] mt-2">
              <div className="border border-cyan-500/20 bg-cyan-500/5 rounded-sm p-2 text-center">
                <div className="font-orbitron text-[18px] font-black text-white">{supportData?.total_subscribers || 0}</div>
                <div className="text-[7px] text-cyan-500/50 tracking-wider uppercase">Subscribers w/ Issues</div>
              </div>
              <div className="border border-cyan-500/20 bg-cyan-500/5 rounded-sm p-2 text-center">
                <div className="font-orbitron text-[18px] font-black text-white">{readiness?.total_issues || 0}</div>
                <div className="text-[7px] text-cyan-500/50 tracking-wider uppercase">Total Issues</div>
              </div>
              <div className="border border-green-500/20 bg-green-500/5 rounded-sm p-2 text-center">
                <div className="font-orbitron text-[18px] font-black text-green-400">{readiness?.notified_aed_unresolved || 0}</div>
                <div className="text-[7px] text-green-500/50 tracking-wider uppercase">Notified Pending</div>
              </div>
              <div className="border border-amber-500/20 bg-amber-500/5 rounded-sm p-2 text-center">
                <div className="font-orbitron text-[18px] font-black text-amber-400">{notifToday}</div>
                <div className="text-[7px] text-amber-500/50 tracking-wider uppercase">Emails Sent Today</div>
              </div>
            </div>
          </div>
        </div>

        {/* CENTER COLUMN */}
        <div className="flex flex-col gap-[7px]">
          {/* MAP */}
          <div className="panel relative bg-[rgba(0,18,32,0.93)] border border-cyan-500/30 overflow-hidden flex-1" data-testid="stark-map-card">
            <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
            <div className="absolute top-2 left-3 z-20 flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-cyan-400" />
              <span className="font-orbitron text-[9px] text-cyan-400 tracking-wider">SUBSCRIBER MAP</span>
              <span className="font-orbitron text-[7px] text-slate-500 ml-1">AED READINESS MONITORING</span>
            </div>
            <button onClick={fitAll} className="absolute top-2 right-3 z-20 font-orbitron text-[7px] px-2 py-1 border border-cyan-500/30 text-cyan-400 rounded-sm hover:bg-cyan-500/10 flex items-center gap-1" data-testid="stark-fit-all">
              <Maximize2 className="w-3 h-3" /> FIT ALL
            </button>
            {mapLoading || !isLoaded ? (
              <div className="flex items-center justify-center h-full"><Loader2 className="w-6 h-6 text-cyan-400 animate-spin" /></div>
            ) : (
              <GoogleMap mapContainerStyle={{ width: "100%", height: "100%" }} center={mapCenter} zoom={7} options={mapOptions} onLoad={(m) => { mapRef.current = m; setTimeout(() => fitAll(), 500); }} onClick={() => { setSelectedId(null); setHoveredId(null); }}>
                {geoSubs.map((sub, i) => {
                  const lat = parseFloat(sub.geocode_lat); const lng = parseFloat(sub.geocode_lng);
                  if (isNaN(lat) || isNaN(lng)) return null;
                  const counts = sub.status_counts || {}; const total = sub.aed_count || 0;
                  const readyPct = total > 0 ? Math.round(((counts.READY || 0) / total) * 100) : 0;
                  const pinColor = readyPct >= 90 ? "#22c55e" : readyPct >= 50 ? "#f59e0b" : "#ef4444";
                  return (
                    <Marker key={`${sub.subscriber}-${i}`} position={{ lat, lng }}
                      icon={{ path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z", fillColor: pinColor, fillOpacity: 1, strokeColor: "#0a0f1c", strokeWeight: 2, scale: 2.2, anchor: { x: 12, y: 24 } }}
                      onMouseOver={() => { if (selectedId !== i) setHoveredId(i); }} onMouseOut={() => setHoveredId(null)}
                      onClick={() => setSelectedId(prev => prev === i ? null : i)}
                    >
                      {hoveredId === i && selectedId !== i && (
                        <OverlayView position={{ lat, lng }} mapPaneName={OverlayView.FLOAT_PANE} getPixelPositionOffset={(w, h) => ({ x: -(w/2), y: -h-30 })}>
                          <div style={{ background: "rgba(6,10,20,0.92)", border: "1px solid rgba(6,182,212,0.4)", borderRadius: 3, padding: "8px 14px", fontFamily: "Orbitron, monospace", whiteSpace: "nowrap", pointerEvents: "none" }}>
                            <div style={{ fontWeight: 700, fontSize: 13, color: "#06b6d4", letterSpacing: 1 }}>{sub.display_name || sub.subscriber}</div>
                            <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{total} AEDs - {readyPct}% Ready</div>
                          </div>
                        </OverlayView>
                      )}
                      {selectedId === i && (
                        <OverlayView position={{ lat, lng }} mapPaneName={OverlayView.FLOAT_PANE} getPixelPositionOffset={(w, h) => ({ x: -(w/2), y: -h-36 })}>
                          <div style={{ background: "rgba(6,10,20,0.95)", border: "1px solid rgba(6,182,212,0.5)", borderRadius: 4, padding: "10px 16px", fontFamily: "Orbitron, monospace", minWidth: 200, maxWidth: 280 }}>
                            <div style={{ fontWeight: 700, fontSize: 13, color: "#06b6d4", letterSpacing: 1, marginBottom: 6 }}>{sub.display_name || sub.subscriber}</div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                              <span style={{ fontSize: 15, fontWeight: 700, color: "#22c55e" }}>{total} AEDs</span>
                              <span style={{ fontSize: 12, fontWeight: 700, color: readyPct >= 90 ? "#22c55e" : readyPct >= 50 ? "#f59e0b" : "#ef4444" }}>{readyPct}% READY</span>
                            </div>
                            {Object.entries(counts).filter(([k, v]) => k !== "READY" && k !== "UNCLASSIFIED" && v > 0).sort(([,a],[,b]) => b - a).map(([status, count]) => (
                              <div key={status} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#94a3b8", marginTop: 3 }}>
                                <span>{status}</span><span style={{ color: "#ef4444", fontWeight: 700, marginLeft: 16 }}>{count}</span>
                              </div>
                            ))}
                            {(counts.READY || 0) > 0 && (
                              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#94a3b8", marginTop: 3 }}>
                                <span>READY</span><span style={{ color: "#22c55e", fontWeight: 700, marginLeft: 16 }}>{counts.READY}</span>
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

          {/* DI Feed */}
          <div className="panel relative p-[10px] bg-[rgba(0,18,32,0.93)] border border-cyan-500/30 overflow-hidden" style={{ height: 180 }} data-testid="stark-di-panel">
            <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
            <div className="panel-glow" />
            <div className="absolute top-[6px] right-[8px] z-20">
              <button onClick={() => setDiPaused(!diPaused)} className="w-[24px] h-[24px] flex items-center justify-center rounded-sm border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20" data-testid="stark-di-toggle">
                {diPaused ? <Play className="w-3 h-3 text-cyan-400" /> : <Pause className="w-3 h-3 text-cyan-400" />}
              </button>
            </div>
            <div className="overflow-hidden" style={{ height: 150 }}>
              <div className="space-y-[4px]" style={{ animation: diPaused ? "none" : `diScroll ${scrollDur}s linear infinite` }}>
                {diList.map((rec) => rec.type === "_DIVIDER" ? (
                  <div key={rec._key} className="border-t border-cyan-500/10 my-1" />
                ) : (
                  <div key={rec._key} className="flex gap-2 items-start py-[3px]">
                    <span className={`font-orbitron text-[8px] font-bold tracking-wider flex-shrink-0 mt-[1px] px-[4px] py-[1px] rounded-sm ${rec.type === "ACT" ? "bg-orange-500/20 text-orange-400" : rec.type === "WARN" ? "bg-yellow-500/20 text-yellow-400" : rec.type === "INFO" ? "bg-green-500/20 text-green-400" : "bg-cyan-500/20 text-cyan-400"}`}>{rec.type}</span>
                    <span className="text-[11px] text-slate-200/90 leading-tight font-mono">{rec.msg}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="flex flex-col gap-[7px]">
          {/* Service Tickets */}
          <div onClick={() => navigate("/service-tickets")} className="panel relative p-[10px] bg-[rgba(0,18,32,0.93)] border border-cyan-500/30 overflow-hidden flex-1 cursor-pointer hover:border-cyan-400/60 transition-colors" data-testid="stark-service-tickets">
            <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
            <div className="panel-glow" />
            <div className="plabel">Service Tickets <span className="ml-2 text-[7px] px-[5px] py-[1px] bg-yellow-500/20 text-yellow-400 rounded-sm font-bold tracking-wider">IN DEV</span></div>
            <div className="flex flex-col gap-[4px] mt-2">
              {ticketRows.map((row, i) => (
                <div key={i} className={`flex items-center justify-between px-[10px] py-[8px] border rounded-sm ${row.bg}`}>
                  <span className="text-[11px] text-slate-200/90">{row.label}</span>
                  <span className={`font-orbitron text-[14px] font-black ${row.color}`}>{row.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Voice Query */}
          <div className="panel relative p-[10px] bg-[rgba(0,18,32,0.93)] border border-cyan-500/30 overflow-hidden" data-testid="stark-voice-query">
            <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
            <div className="panel-glow" />
            <div className="plabel">Voice Query</div>
            <div className="flex items-center justify-center gap-[10px] py-[8px]">
              <div className="flex items-center gap-[2px] h-[16px]">
                {[4,8,12,8,14,10,16,12,8,5].map((h, i) => (
                  <div key={i} className={`w-[2px] rounded-sm ${isListening ? "bg-red-500 animate-voice-wave" : "bg-cyan-500/30"}`} style={{ height: h, animationDelay: `${i*0.1}s` }} />
                ))}
              </div>
              <button onClick={jarvisGreet} className={`w-[36px] h-[36px] rounded-full border flex items-center justify-center transition-all ${isListening ? "border-red-500 bg-red-500/10 animate-mic-pulse" : "border-cyan-500/50 bg-[rgba(0,40,70,0.8)] hover:border-cyan-400 hover:shadow-[0_0_16px_rgba(0,212,255,0.35)]"}`}>
                <Mic className={`w-[14px] h-[14px] ${isListening ? "text-red-500" : "text-cyan-400"}`} />
              </button>
              <div className={`font-orbitron text-[7px] font-bold tracking-[0.18em] ${isListening ? "text-red-500 animate-blink" : "text-cyan-500/60"}`}>
                {isSpeaking ? "SPEAKING" : isListening ? "LISTENING" : "READY"}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes diScroll { 0% { transform: translateY(0); } 100% { transform: translateY(-50%); } }
        @keyframes led-flash { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        .animate-led-flash { animation: led-flash 1.4s ease-in-out infinite; }
        .animate-led-flash-alt { animation: led-flash 1.4s ease-in-out infinite 0.7s; }
      `}</style>

      {showReadinessBreakdown && <ReadinessBreakdownModal onClose={() => setShowReadinessBreakdown(false)} onDataLoaded={(r) => setReadiness(r)} />}
    </div>
  );
}
