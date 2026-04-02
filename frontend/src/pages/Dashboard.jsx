import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { LogOut, Mic, Mail, Loader2, Play, Pause, ArrowLeft, AlertTriangle, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getLedColor, LED_STYLES, useServiceStatuses } from "@/data/serviceStatuses";

import API_BASE from "@/apiBase";
const API_URL = API_BASE;

export default function Dashboard({ user, onLogout }) {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isListening, setIsListening] = useState(false);
  const [aiScrollPaused, setAiScrollPaused] = useState(false);
  const [aiHovered, setAiHovered] = useState(false);
  const [freshUser, setFreshUser] = useState(user);

  // Refresh user data on mount to pick up latest di_permissions
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    fetch(`${API_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setFreshUser(data);
          localStorage.setItem("user", JSON.stringify(data));
        }
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [diScrollPct, setDiScrollPct] = useState(0);
  const diRef = useRef(null);
  const diTouchTimer = useRef(null);
  const diTrackRef = useRef(null);

  const diEnter = () => setAiHovered(true);
  const diLeave = () => setAiHovered(false);
  const diTouchStart = () => {
    setAiHovered(true);
    clearTimeout(diTouchTimer.current);
  };
  const diTouchEnd = () => {
    diTouchTimer.current = setTimeout(() => setAiHovered(false), 3000);
  };
  const diOnScroll = (e) => {
    const el = e.target;
    const maxScroll = el.scrollHeight - el.clientHeight;
    if (maxScroll > 0) setDiScrollPct(el.scrollTop / maxScroll);
  };
  const diTrackClick = (e) => {
    const el = diRef.current;
    const track = diTrackRef.current;
    if (!el || !track) return;
    const rect = track.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    el.scrollTop = pct * (el.scrollHeight - el.clientHeight);
  };
  const diThumbDrag = (e) => {
    e.preventDefault();
    const el = diRef.current;
    const track = diTrackRef.current;
    if (!el || !track) return;
    const rect = track.getBoundingClientRect();
    const onMove = (ev) => {
      const pct = Math.max(0, Math.min(1, (ev.clientY - rect.top) / rect.height));
      el.scrollTop = pct * (el.scrollHeight - el.clientHeight);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };
  const [sendingOverview, setSendingOverview] = useState(false);
  const [viewMode, setViewMode] = useState(() => localStorage.getItem("dashboard_view") || 'detailed');
  const { categories: serviceCategories } = useServiceStatuses(60000);
  const [liveStats, setLiveStats] = useState(() => {
    try { const c = localStorage.getItem("dash_status_cache"); return c ? JSON.parse(c) : null; } catch { return null; }
  });
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState(null);

  const token = localStorage.getItem("token") || "";

  // Fetch real status overview from Readisys, then BP — sequential, never stops retrying
  useEffect(() => {
    let cancelled = false;
    let hasStatus = !!liveStats;
    let hasBP = !!bpData;

    const fetchStatus = async () => {
      try {
        const res = await fetch(`${API_URL}/api/status-overview`);
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          if (data._error) {
            if (!hasStatus) setStatusError(data._error);
            setStatusLoading(false);
          } else if (data.totals) {
            setLiveStats(data);
            setStatusError(null);
            setStatusLoading(false);
            hasStatus = true;
            try { localStorage.setItem("dash_status_cache", JSON.stringify(data)); } catch {}
          }
        }
      } catch {
        if (!hasStatus) setStatusLoading(false);
      }
    };

    const fetchBP = async () => {
      try {
        const res = await fetch(`${API_URL}/api/status-overview/expiring-expired-bp`);
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          if (data._error) {
            if (!hasBP) setBpError(data._error);
            setBpLoading(false);
          } else if (data.devices && data.devices.length > 0) {
            setBpData(data);
            setBpError(null);
            setBpLoading(false);
            hasBP = true;
            try { localStorage.setItem("dash_bp_cache", JSON.stringify(data)); } catch {}
          }
        }
      } catch {
        if (!hasBP) setBpLoading(false);
      }
    };

    // Sequential: status first, then BP
    const fetchAll = async () => {
      await fetchStatus();
      if (!cancelled) await fetchBP();
    };

    fetchAll();
    const poll = setInterval(fetchAll, 10000);
    return () => { cancelled = true; clearInterval(poll); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Cross-domain SSO redirect helper
  const ssoRedirect = async (target) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(`${API_URL}/api/auth/cross-domain-token`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ target }),
        });
        if ([502, 503, 520].includes(res.status) && attempt < 2) { await new Promise(r => setTimeout(r, 1500)); continue; }
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();
        window.open(data.redirect_url, "_blank", "noopener,noreferrer");
        return;
      } catch { if (attempt < 2) { await new Promise(r => setTimeout(r, 1500)); continue; } }
    }
    toast.error("Could not connect. Try again.");
  };

  const toggleViewMode = () => {
    const newMode = viewMode === 'simple' ? 'detailed' : 'simple';
    setViewMode(newMode);
    localStorage.setItem("dashboard_view", newMode);
  };

  const handleSendOverview = async () => {
    setSendingOverview(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/dashboard/send-overview`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || "Overview email sent!");
      } else {
        toast.error(data.detail || "Failed to send overview");
      }
    } catch (err) {
      toast.error("Failed to send overview email");
    } finally {
      setSendingOverview(false);
    }
  };

  // Real data from Readisys, with fallback
  const totals = liveStats?.totals || {};
  const stats = {
    total: totals.total || 0,
    ready: totals.ready || 0,
    subscribers: liveStats ? liveStats.total_subscribers : 0,
    pctReady: totals.percent_ready || 0,
    lost: totals.detailed_status_counts?.lost_contact || 0,
    service: (totals.detailed_status_counts?.not_ready || 0) + (totals.detailed_status_counts?.reposition || 0),
    dispatch: 9,
    alerts: (totals.detailed_status_counts?.expired_bp || 0) + (totals.detailed_status_counts?.expiring_batt_pads || 0),
    pendingNotifs: 2,
    sentToday: 2,
    devicesAffected: 5,
    openTickets: 10
  };

  const pctReady = stats.pctReady.toFixed(1);

  // Retry handler for manual refresh
  const retryStatus = () => {
    setStatusLoading(true);
    setStatusError(null);
    fetch(`${API_URL}/api/status-overview`)
      .then(r => r.ok ? r.json() : Promise.reject('error'))
      .then(data => {
        if (data.totals) {
          setLiveStats(data);
          setStatusError(null);
          try { localStorage.setItem("dash_status_cache", JSON.stringify(data)); } catch {}
        } else if (data._error) {
          setStatusError(data._error);
        }
        setStatusLoading(false);
      })
      .catch(() => { setStatusError("Connection failed — retrying automatically"); setStatusLoading(false); });
  };

  const retryBP = () => {
    setBpLoading(true);
    setBpError(null);
    fetch(`${API_URL}/api/status-overview/expiring-expired-bp`)
      .then(r => r.ok ? r.json() : Promise.reject('error'))
      .then(data => {
        if (data.devices && data.devices.length > 0) {
          setBpData(data);
          setBpError(null);
          try { localStorage.setItem("dash_bp_cache", JSON.stringify(data)); } catch {}
        } else if (data._error) {
          setBpError(data._error);
        }
        setBpLoading(false);
      })
      .catch(() => { setBpError("Connection failed"); setBpLoading(false); });
  };

  const [bpData, setBpData] = useState(() => {
    try { const c = localStorage.getItem("dash_bp_cache"); return c ? JSON.parse(c) : null; } catch { return null; }
  });
  const [bpLoading, setBpLoading] = useState(true);
  const [bpError, setBpError] = useState(null);

  // Get user's DI permissions (default: all details)
  const diPerms = freshUser?.di_permissions || { expired_bp: 'details', expiring_bp: 'details', camera_battery: 'details', camera_cellular: 'details' };

  const aiRecommendations = bpError ? [
    { type: 'ERR', msg: `DI feed unavailable: ${bpError}. Retrying...` },
  ] : bpLoading ? [
    { type: 'SYS', msg: 'Connecting to Readisys API... Stand by.' },
  ] : (() => {
    const items = [];
    const bd = liveStats?.totals?.telemetry_distribution?.battery || {};
    const cd = liveStats?.totals?.telemetry_distribution?.cellular || {};

    // Camera Battery events
    if (diPerms.camera_battery === 'overview') {
      const total = (bd.p0_24 || 0) + (bd.p25_49 || 0) + (bd.p50_74 || 0) + (bd.p75_100 || 0);
      items.push({ type: 'SYS', msg: `CAMERA BATTERY OVERVIEW: ${total} total — P0-24: ${bd.p0_24 || 0}, P25-49: ${bd.p25_49 || 0}, P50-74: ${bd.p50_74 || 0}, P75-100: ${bd.p75_100 || 0}` });
    } else if (diPerms.camera_battery === 'details') {
      if (bd.p0_24 > 0) items.push({ type: 'ACT', msg: `CAMERA BATTERY P0-P24: ${bd.p0_24} devices at critical battery level. Immediate attention required.` });
      if (bd.p25_49 > 0) items.push({ type: 'WARN', msg: `CAMERA BATTERY P25-P49: ${bd.p25_49} devices at low battery level. Schedule replacement.` });
    }

    // Camera Cellular events
    if (diPerms.camera_cellular === 'overview') {
      const cc = bpData?.totals?.camera_cellular || cd;
      items.push({ type: 'SYS', msg: `CAMERA CELLULAR OVERVIEW: HIGH: ${cc.HIGH || 0}, MEDIUM: ${cc.MEDIUM || 0}, LOW: ${cc.LOW || 0}, BAD: ${cc.BAD || 0}` });
    } else if (diPerms.camera_cellular === 'details') {
      const cc = bpData?.totals?.camera_cellular || cd;
      if ((cc.BAD || 0) > 0) items.push({ type: 'ACT', msg: `CAMERA CELLULAR BAD: ${cc.BAD} devices with no signal. Check antenna/location.` });
      if ((cc.LOW || 0) > 0) items.push({ type: 'WARN', msg: `CAMERA CELLULAR LOW: ${cc.LOW} devices with weak signal.` });
    }

    // BP device-level alerts
    if (bpData && bpData.devices) {
      const expired = bpData.devices.filter(d => d.detailed_status === 'EXPIRED B/P');
      const expiring = bpData.devices.filter(d => d.detailed_status !== 'EXPIRED B/P');

      // Expired B/P
      if (diPerms.expired_bp === 'overview') {
        const expiredCount = bpData?.totals?.expired_bp || expired.length;
        if (expiredCount > 0) items.push({ type: 'ACT', msg: `EXPIRED B/P OVERVIEW: ${expiredCount} devices with expired batteries/pads.` });
      } else if (diPerms.expired_bp === 'details') {
        expired.forEach(dev => {
          items.push({ type: 'ACT', msg: `${dev.subscriber} — ${dev.sentinel_id} — ${dev.days_summary.replace(/Battery /g, 'Battery Expiring ')}. Location: ${dev.location.split('·').slice(0, 3).join('·').trim()}` });
        });
      }

      // Expiring B/P
      if (diPerms.expiring_bp === 'overview') {
        const expiringCount = bpData?.totals?.expiring_batt_pads || expiring.length;
        if (expiringCount > 0) items.push({ type: 'WARN', msg: `EXPIRING B/P OVERVIEW: ${expiringCount} devices with expiring batteries/pads.` });
      } else if (diPerms.expiring_bp === 'details') {
        expiring.forEach(dev => {
          items.push({ type: 'WARN', msg: `${dev.subscriber} — ${dev.sentinel_id} — ${dev.days_summary.replace(/Battery /g, 'Battery Expiring ')}. Location: ${dev.location.split('·').slice(0, 3).join('·').trim()}` });
        });
      }
    }
    return items.length > 0 ? items : [{ type: 'SYS', msg: 'No device alerts at this time.' }];
  })();

  // Build the doubled event list with a divider at the repeat point
  const diEventList = (() => {
    const items = [];
    aiRecommendations.forEach((rec, i) => {
      items.push({ ...rec, _key: `a-${i}` });
    });
    items.push({ type: '_DIVIDER', msg: '', _key: 'divider' });
    aiRecommendations.forEach((rec, i) => {
      items.push({ ...rec, _key: `b-${i}` });
    });
    return items;
  })();

  // Dynamic scroll speed: ~3 seconds per item for comfortable reading
  const scrollDuration = Math.max(60, diEventList.length * 3);

  // Format the Readisys completion_time for "Last Updated" display
  const lastUpdated = (() => {
    const ts = liveStats?.completion_time;
    if (!ts) return null;
    try {
      const d = new Date(ts);
      const now = new Date();
      const isToday = d.toDateString() === now.toDateString();
      const time = d.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      if (isToday) return `Today ${time}`;
      const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
      if (d.toDateString() === yesterday.toDateString()) return `Yesterday ${time}`;
      return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
    } catch { return null; }
  })();

  const statusChanges = [
    { location: 'Miami-Dade FL', status: 'Lost Contact', delta: '+3', positive: false },
    { location: 'Chicago IL', status: 'Needs Service', delta: '+2', positive: false },
    { location: 'Dallas TX', status: 'Ready', delta: '-8', positive: true },
    { location: 'Seattle WA', status: 'Lost Contact', delta: '+2', positive: false },
    { location: 'Atlanta GA', status: 'Ready', delta: '-5', positive: true },
  ];

  const notifications = [
    {
      customer: 'Westfield Mall Group',
      time: '3 days ago',
      contacts: 'mgmt@westfieldgroup.com · facility@westfield.com',
      devices: [
        { id: 'AED-0441', issue: 'Exp. Battery', type: 'bat' },
        { id: 'AED-0442', issue: 'Exp. Pads', type: 'pad' },
        { id: 'AED-0889', issue: 'Reposition', type: 'repos' },
      ]
    },
    {
      customer: 'Tampa Bay Convention Ctr',
      time: '1 day ago',
      contacts: 'ops@tbcc.com · safety@tbcc.com',
      devices: [
        { id: 'AED-1102', issue: 'Exp. Battery', type: 'bat' },
        { id: 'AED-1103', issue: 'Exp. Battery', type: 'bat' },
      ]
    },
  ];

  const batteryDist = liveStats?.totals?.telemetry_distribution?.battery || {};
  const cameraBattery = {
    overall: batteryDist.p75_100 && stats.total ? Math.round(batteryDist.p75_100 / stats.total * 100) : 90,
    levels: [
      { label: 'P0-24', count: batteryDist.p0_24 || 0, pct: stats.total ? Math.round((batteryDist.p0_24 || 0) / stats.total * 100) : 0 },
      { label: 'P25-49', count: batteryDist.p25_49 || 0, pct: stats.total ? Math.round((batteryDist.p25_49 || 0) / stats.total * 100) : 0 },
      { label: 'P50-74', count: batteryDist.p50_74 || 0, pct: stats.total ? Math.round((batteryDist.p50_74 || 0) / stats.total * 100) : 0 },
      { label: 'P75-100', count: batteryDist.p75_100 || 0, pct: stats.total ? Math.round((batteryDist.p75_100 || 0) / stats.total * 100) : 0 },
    ]
  };

  const cellularDist = liveStats?.totals?.telemetry_distribution?.cellular || {};
  const cameraCellular = [
    { bars: 0, count: cellularDist.BAD || 0, label: 'BAD' },
    { bars: 1, count: cellularDist.LOW || 0, label: 'LOW' },
    { bars: 2, count: cellularDist.MEDIUM || 0, label: 'MED' },
    { bars: 3, count: cellularDist.HIGH || 0, label: 'HIGH' },
    { bars: 4, count: cellularDist.UNKNOWN || 0, label: 'UNK' },
  ];

  const tickets = [
    { id: 'SVC-0042', loc: 'Tampa Intl Airport', status: 'open' },
    { id: 'SVC-0041', loc: 'Miami Central Mall', status: 'dispatched' },
    { id: 'SVC-0040', loc: 'Atlanta Hartsfield', status: 'enroute' },
    { id: 'SVC-0039', loc: 'Dallas Conv. Ctr', status: 'onsite' },
    { id: 'SVC-0038', loc: "O'Hare Terminal 3", status: 'open' },
    { id: 'SVC-0037', loc: 'LAX Concourse B', status: 'dispatched' },
    { id: 'SVC-0036', loc: 'NYC Penn Station', status: 'complete' },
    { id: 'SVC-0035', loc: 'Seattle Waterfront', status: 'open' },
    { id: 'SVC-0034', loc: 'Denver Union Sta.', status: 'enroute' },
    { id: 'SVC-0033', loc: 'Boston South Sta.', status: 'open' },
    { id: 'SVC-0032', loc: 'Phoenix Sky Harbor', status: 'dispatched' },
    { id: 'SVC-0031', loc: 'San Diego Conv.', status: 'open' },
    { id: 'SVC-0030', loc: 'Houston Galleria', status: 'complete' },
    { id: 'SVC-0029', loc: 'Nashville Intl', status: 'enroute' },
    { id: 'SVC-0028', loc: 'Orlando MCO', status: 'open' },
    { id: 'SVC-0027', loc: 'Portland Union Sta.', status: 'dispatched' },
  ];

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date) => date.toTimeString().slice(0, 8);
  const formatDate = (date) => {
    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    return `${days[date.getDay()]}  ${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };

  const getStatusBadge = (status) => {
    const badges = {
      open: { label: 'OPEN', class: 'bg-red-500/20 text-red-400' },
      dispatched: { label: 'DISPATCHED', class: 'bg-cyan-500/20 text-cyan-400' },
      enroute: { label: 'EN ROUTE', class: 'bg-yellow-500/20 text-yellow-400' },
      onsite: { label: 'ON SITE', class: 'bg-orange-500/20 text-orange-400' },
      complete: { label: 'DONE', class: 'bg-green-500/20 text-green-400' },
    };
    return badges[status] || badges.open;
  };

  const getTagType = (type) => {
    const types = {
      bat: 'bg-orange-500/20 text-orange-400',
      pad: 'bg-yellow-500/20 text-yellow-400',
      repos: 'bg-cyan-500/20 text-cyan-400',
    };
    return types[type] || types.bat;
  };

  return (
    <div className="jarvis-dash min-h-screen text-cyan-400 font-mono text-[11px] relative">
      {/* Background Grid */}
      <div className="fixed inset-0 pointer-events-none z-0" style={{
        backgroundImage: 'linear-gradient(rgba(0,212,255,0.032) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.032) 1px, transparent 1px)',
        backgroundSize: '36px 36px'
      }} />
      
      {/* Scan Line */}
      <div className="fixed top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-500/10 to-transparent animate-scan pointer-events-none z-0" />

      <div className="grid grid-cols-[210px_1fr_220px] grid-rows-[auto_1fr_auto] gap-[7px] p-[10px] relative z-10 min-h-screen">
        
        {/* TOP BAR */}
        <div className="col-span-3 flex items-center justify-between px-[18px] py-[7px] border border-cyan-500/30 bg-[rgba(0,18,32,0.93)]" style={{ clipPath: 'polygon(0 0, 100% 0, 98.5% 100%, 1.5% 100%)' }}>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/hub")}
              className="flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 transition-colors"
              data-testid="dashboard-back-btn"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="font-orbitron text-[9px] font-bold tracking-wider">HUB</span>
            </button>
            <div className="w-[1px] h-[20px] bg-cyan-500/30" />
            <div className="flex flex-col">
              <div className="font-orbitron text-[13px] font-black tracking-[0.25em] text-red-500 animate-logo-pulse">
                CARDIAC SOLUTIONS
              </div>
              <div className="font-orbitron text-[9px] font-bold tracking-[0.2em] text-cyan-400">
                COMMAND CENTER
              </div>
            </div>
          </div>
          {/* View Mode Toggle */}
          <div className="flex items-center gap-[6px]" data-testid="view-mode-toggle">
            <span className={`font-orbitron text-[7px] font-bold tracking-wider transition-colors ${viewMode === 'simple' ? 'text-cyan-400' : 'text-cyan-500/35'}`}>SIMPLE</span>
            <button
              onClick={toggleViewMode}
              className="relative w-[32px] h-[16px] rounded-full border border-cyan-500/40 bg-[rgba(0,40,70,0.6)] transition-all hover:border-cyan-400/60"
            >
              <div className={`absolute top-[2px] w-[10px] h-[10px] rounded-full transition-all duration-300 ${viewMode === 'detailed' ? 'left-[18px] bg-cyan-400 shadow-[0_0_8px_rgba(0,212,255,0.6)]' : 'left-[2px] bg-cyan-500/60 shadow-[0_0_6px_rgba(0,212,255,0.3)]'}`} />
            </button>
            <span className={`font-orbitron text-[7px] font-bold tracking-wider transition-colors ${viewMode === 'detailed' ? 'text-cyan-400' : 'text-cyan-500/35'}`}>DETAILED</span>
          </div>
          {/* Flashing LED Indicators */}
          <div className="flex items-center gap-[16px]">
            {(() => { const c = getLedColor(serviceCategories, "external"); const s = LED_STYLES[c]; return (
            <div className="flex items-center gap-[6px] cursor-pointer hover:opacity-80 transition-opacity" onClick={() => navigate("/outage")} data-testid="led-external-services">
              <span className="w-[10px] h-[10px] rounded-full animate-led-flash" style={{ backgroundColor: s.bg, boxShadow: s.shadow }} />
              <span className="font-orbitron text-[8px] font-bold tracking-wider text-slate-200">EXTERNAL SERVICES</span>
            </div>
            ); })()}
            {(() => { const c = getLedColor(serviceCategories, "internal"); const s = LED_STYLES[c]; return (
            <div className="flex items-center gap-[6px] cursor-pointer hover:opacity-80 transition-opacity" onClick={() => navigate("/outage")} data-testid="led-internal-systems">
              <span className="w-[10px] h-[10px] rounded-full animate-led-flash-alt" style={{ backgroundColor: s.bg, boxShadow: s.shadow }} />
              <span className="font-orbitron text-[8px] font-bold tracking-wider text-slate-200">INTERNAL SYSTEMS</span>
            </div>
            ); })()}
          </div>
          <div className="flex gap-[18px] items-center text-[9px] tracking-wider">
            {!liveStats && statusLoading ? (
              <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> LOADING...</span>
            ) : !liveStats && statusError ? (
              <span className="flex items-center gap-1 text-yellow-400"><AlertTriangle className="w-3 h-3" /> OFFLINE</span>
            ) : !liveStats ? (
              <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> LOADING...</span>
            ) : (
              <span>{stats.total.toLocaleString()} DEVICES</span>
            )}
            <span>|</span>
            <span className="flex items-center gap-1">
              <span className="w-[5px] h-[5px] rounded-full bg-yellow-400 animate-blink-fast" />
              {stats.alerts} ALERTS
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end gap-[2px]">
              <div className="font-orbitron text-[13px] font-bold tracking-wider">{formatTime(currentTime)}</div>
              <div className="font-orbitron text-[10px] tracking-[0.12em] text-cyan-500/65">{formatDate(currentTime)}</div>
            </div>
            <button onClick={onLogout} className="text-red-500 hover:text-red-400 transition-colors" data-testid="logout-btn">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {viewMode === 'detailed' ? (<>
        {/* LEFT COLUMN */}
        <div className="flex flex-col gap-[7px]">
          {/* System Status */}
          <div onClick={() => ssoRedirect("report")} className="panel relative p-[10px] bg-[rgba(0,18,32,0.93)] border border-cyan-500/30 overflow-hidden cursor-pointer hover:border-cyan-400/60 transition-colors" data-testid="system-status-panel">
            <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
            <div className="panel-glow" />
            <div className="plabel">System Status</div>
            <div className="flex flex-col items-center py-[10px]">
              {!liveStats && statusError ? (
                <div className="flex flex-col items-center gap-3 py-4" data-testid="status-error">
                  <AlertTriangle className="w-8 h-8 text-yellow-400" />
                  <span className="font-orbitron text-[8px] text-yellow-400/80 tracking-wider text-center">{statusError}</span>
                  <button onClick={(e) => { e.stopPropagation(); retryStatus(); }} className="font-orbitron text-[7px] font-bold tracking-wider px-3 py-1 border border-cyan-500/40 bg-cyan-500/10 text-cyan-400 rounded-sm hover:bg-cyan-500/20 transition-all flex items-center gap-1" data-testid="status-retry-btn">
                    <RefreshCw className="w-3 h-3" /> RETRY
                  </button>
                </div>
              ) : !liveStats ? (
                <div className="flex flex-col items-center gap-3 py-4" data-testid="status-loading">
                  <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
                  <span className="font-orbitron text-[9px] text-cyan-500/60 tracking-wider">CONNECTING TO READISYS...</span>
                </div>
              ) : (
              <>
              <div className="relative w-[105px] h-[105px]">
                <div className="absolute inset-0 rounded-full border border-cyan-500/30 animate-spin-slow" />
                <div className="absolute inset-[9px] rounded-full border border-cyan-500/45 border-t-cyan-400 animate-spin-reverse" />
                <div className="absolute inset-[19px] rounded-full border border-cyan-500/20 border-l-cyan-400 border-r-cyan-400 animate-spin-medium" />
                <div className="absolute inset-[34px] rounded-full bg-[rgba(0,35,70,0.95)] border border-cyan-500/65 flex items-center justify-center animate-core-glow">
                  <span className="font-orbitron text-[15px] font-black text-green-400">{Math.round(parseFloat(pctReady))}%</span>
                </div>
              </div>
              <div className="font-orbitron text-[9px] font-bold text-green-400 mt-[6px] tracking-wider">{stats.ready.toLocaleString()} READY</div>
              {lastUpdated && <div className="font-orbitron text-[9px] text-cyan-300/80 tracking-wider mt-[5px]">Last Updated: {lastUpdated}</div>}
              </>
              )}
            </div>
          </div>

          {/* Stats Panel */}
          <div className="panel relative p-[10px] bg-[rgba(0,18,32,0.93)] border border-cyan-500/30 overflow-hidden flex-1">
            <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
            <div className="panel-glow" />
            
            {/* % Ready */}
            <div className="pb-[10px] mb-[10px] border-b border-cyan-500/15">
              <div className="plabel">% Ready</div>
              <div className="flex items-end justify-between gap-2">
                <div>
                  <div className="text-[7px] tracking-wider text-cyan-500/45 uppercase mb-[2px]">Fleet Uptime</div>
                  <div className="font-orbitron text-[32px] font-black text-green-400 leading-none" style={{ textShadow: '0 0 18px rgba(57,255,20,0.5)' }}>{pctReady}%</div>
                </div>
                <div className="flex-1 flex flex-col justify-end">
                  <div className="flex gap-[2px] h-[24px] items-end">
                    {[13, 19, 17, 7, 7, 11, 17].map((h, i) => (
                      <div key={i} className="flex-1 rounded-t-sm" style={{ height: h, background: i === 6 ? '#39ff14' : 'rgba(57,255,20,0.3)' }} />
                    ))}
                  </div>
                  <div className="flex justify-between text-[7px] text-cyan-500/35 tracking-wider mt-[2px]">
                    <span>30d</span><span>Now</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Status Breakdown */}
            <div className="plabel">Status Breakdown</div>
            {[
              { name: 'READY', val: stats.ready, pct: stats.total ? (stats.ready/stats.total*100) : 0, color: 'green' },
              { name: 'LOST CONTACT', val: stats.lost, pct: stats.total ? (stats.lost/stats.total*100) : 0, color: 'yellow' },
              { name: 'NEEDS SERVICE', val: stats.service, pct: stats.total ? (stats.service/stats.total*100) : 0, color: 'orange' },
              { name: 'DISPATCHED', val: stats.dispatch, pct: stats.total ? (stats.dispatch/stats.total*100) : 0, color: 'cyan' },
            ].map((item, i) => (
              <div key={i}>
                <div className="flex justify-between items-center mb-[2px]">
                  <span className="text-[9px] tracking-wider text-cyan-500/75 uppercase">{item.name}</span>
                  <span className="font-orbitron text-[11px] font-bold text-white">{item.val.toLocaleString()}</span>
                </div>
                <div className="h-[3px] bg-cyan-500/10 rounded mb-[10px] overflow-hidden">
                  <div className={`h-full rounded bg-gradient-to-r ${item.color === 'green' ? 'from-green-500/25 to-green-400' : item.color === 'yellow' ? 'from-yellow-500/25 to-yellow-400' : item.color === 'orange' ? 'from-orange-500/25 to-orange-400' : 'from-cyan-500/25 to-cyan-400'}`} style={{ width: `${item.pct}%` }} />
                </div>
              </div>
            ))}

            <hr className="border-cyan-500/15 my-[10px]" />
            <div className="plabel">Status Changes vs Yesterday</div>
            <table className="w-full">
              <thead>
                <tr className="text-[7px] font-orbitron font-bold text-cyan-500/60 uppercase tracking-wider">
                  <th className="text-left pb-[5px]">Location</th>
                  <th className="text-left pb-[5px]">Status</th>
                  <th className="text-left pb-[5px]">Δ</th>
                </tr>
              </thead>
              <tbody>
                {statusChanges.map((item, i) => (
                  <tr key={i} className="text-[8px] hover:bg-cyan-500/5">
                    <td className="py-[4px] text-slate-300/85">{item.location}</td>
                    <td className="py-[4px] text-cyan-500/60 text-[8px]">{item.status}</td>
                    <td className={`py-[4px] font-orbitron font-bold ${item.positive ? 'text-green-400' : 'text-red-400'}`}>
                      {item.positive ? '▼' : '▲'}{item.delta.replace(/[+-]/, '')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* CENTER COLUMN */}
        <div className="flex flex-col gap-[7px]">
          {/* AI Recommendations */}
          <div className="panel relative p-[10px] bg-[rgba(0,18,32,0.93)] border border-cyan-500/30 overflow-hidden">
            <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
            <div className="panel-glow" />
            <div className="absolute top-[8px] right-[10px] z-20 flex flex-col items-center gap-[3px]">
              <button
                onClick={() => setAiScrollPaused(!aiScrollPaused)}
                data-testid="ai-scroll-toggle"
                className="w-[30px] h-[30px] flex items-center justify-center rounded-sm border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 transition-colors"
              >
                {aiScrollPaused ? <Play className="w-[16px] h-[16px] text-cyan-400" /> : <Pause className="w-[16px] h-[16px] text-cyan-400" />}
              </button>
              <span className="text-[9px] text-cyan-500/60 tracking-wider font-orbitron font-bold">{aiScrollPaused ? 'Scroll' : 'Stop'}</span>
            </div>
            <div className="plabel">Decision Intelligence — AI Recommendations</div>
            {lastUpdated && <div className="font-orbitron text-[8px] text-cyan-400/60 tracking-wider mt-[-2px] mb-[4px]">READINESS DATA UPDATED: {lastUpdated}</div>}
            <div style={{ position: 'relative' }}
              onMouseEnter={diEnter}
              onMouseLeave={diLeave}
              onTouchStart={diTouchStart}
              onTouchEnd={diTouchEnd}
            >
            <div
              ref={diRef}
              className="max-h-[220px] relative di-scroll-area"
              style={{ overflowY: 'auto', overscrollBehavior: 'contain', touchAction: aiHovered ? 'pan-y' : 'auto' }}
              onScroll={diOnScroll}
            >
              <div className={`ai-scroll-container ${aiHovered ? 'ai-scroll-manual' : ''}`}>
                <div className={`ai-scroll-content ${(aiScrollPaused || aiHovered) ? 'ai-scroll-paused' : ''}`} style={{ animationDuration: `${scrollDuration}s` }}>
                  {diEventList.map((rec) => (
                    rec.type === '_DIVIDER' ? (
                      <div key={rec._key} className="flex items-center gap-3 py-[16px] my-[6px]">
                        <div className="flex-1 h-[3px]" style={{ background: 'linear-gradient(to right, transparent 5%, #f59e0b 30%, #f59e0b 70%, transparent 95%)' }} />
                        <span className="font-orbitron text-[11px] text-yellow-400 tracking-[0.3em] flex-shrink-0 font-bold" style={{ textShadow: '0 0 10px rgba(245,158,11,0.6)' }}>EVENTS REPEAT</span>
                        <div className="flex-1 h-[3px]" style={{ background: 'linear-gradient(to right, transparent 5%, #f59e0b 30%, #f59e0b 70%, transparent 95%)' }} />
                      </div>
                    ) : (
                    <div key={rec._key} className="py-[6px] border-b border-cyan-500/10 flex gap-[10px] items-start">
                      <span className={`font-orbitron text-[8px] font-bold px-[7px] py-[3px] rounded-sm tracking-wider flex-shrink-0 ${rec.type === 'ACT' ? 'bg-orange-500/20 text-orange-400' : rec.type === 'WARN' ? 'bg-yellow-500/15 text-yellow-400' : rec.type === 'ERR' ? 'bg-red-500/20 text-red-400' : rec.type === 'SYS' ? 'bg-cyan-500/20 text-cyan-300' : 'bg-cyan-500/15 text-cyan-400'}`}>
                        {rec.type}
                      </span>
                      <span className="text-[11px] text-slate-200/90 leading-relaxed">{rec.msg}</span>
                    </div>
                    )
                  ))}
                </div>
              </div>
              <div className="absolute top-0 left-0 right-0 h-[16px] bg-gradient-to-b from-[rgba(0,18,32,0.93)] to-transparent pointer-events-none z-10" />
              <div className="absolute bottom-0 left-0 right-0 h-[32px] bg-gradient-to-t from-[rgba(0,18,32,0.93)] to-transparent pointer-events-none z-10" />
            </div>
            {/* Custom blue scrollbar — only visible on hover */}
            {aiHovered && (
              <div ref={diTrackRef} onClick={diTrackClick}
                style={{ position: 'absolute', top: 0, right: 0, width: 10, height: '100%', background: 'rgba(0,40,80,0.5)', borderRadius: 5, cursor: 'pointer', zIndex: 20 }}>
                <div onMouseDown={diThumbDrag} style={{ position: 'absolute', top: `${diScrollPct * 80}%`, width: '100%', height: '20%', background: '#0088ff', borderRadius: 5, boxShadow: '0 0 6px rgba(0,136,255,0.5)', minHeight: 30, cursor: 'grab' }} />
              </div>
            )}
            </div>
          </div>

          {/* Customer Notifications (compact) */}
          <div onClick={() => ssoRedirect("notifications")} className="panel relative p-[10px] bg-[rgba(0,18,32,0.93)] border border-cyan-500/30 overflow-hidden cursor-pointer hover:border-cyan-400/60 transition-colors" data-testid="customer-notifications-panel">
            <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
            <div className="panel-glow" />
            <div className="plabel">Customer Notifications <span className="ml-2 text-[7px] px-[5px] py-[1px] bg-yellow-500/20 text-yellow-400 rounded-sm font-bold tracking-wider">IN DEV</span></div>
            <div className="flex gap-[14px] mb-[8px] pb-[8px] border-b border-cyan-500/10">
              <div className="flex flex-col items-center gap-[2px]">
                <div className="font-orbitron text-[13px] font-black text-yellow-400">{stats.pendingNotifs}</div>
                <div className="text-[7px] tracking-wider text-cyan-500/45 uppercase">Pending</div>
              </div>
              <div className="flex flex-col items-center gap-[2px]">
                <div className="font-orbitron text-[13px] font-black text-green-400">{stats.sentToday}</div>
                <div className="text-[7px] tracking-wider text-cyan-500/45 uppercase">Sent Today</div>
              </div>
              <div className="flex flex-col items-center gap-[2px]">
                <div className="font-orbitron text-[13px] font-black text-orange-400">{stats.devicesAffected}</div>
                <div className="text-[7px] tracking-wider text-cyan-500/45 uppercase">Devices</div>
              </div>
            </div>
            <div className="flex flex-col gap-[6px] max-h-[140px] overflow-y-auto scrollbar-thin">
              {notifications.map((notif, i) => (
                <div key={i} className="bg-cyan-500/5 border border-cyan-500/15 border-l-[3px] border-l-yellow-400 p-[7px]">
                  <div className="flex justify-between items-center mb-[3px]">
                    <span className="text-[10px] font-bold text-slate-200/95">{notif.customer}</span>
                    <span className="font-orbitron text-[7px] text-cyan-500/35 tracking-wider">{notif.time}</span>
                  </div>
                  <div className="flex flex-wrap gap-[3px] mb-[5px]">
                    {notif.devices.map((dev, j) => (
                      <span key={j} className={`font-orbitron text-[7px] font-bold px-[5px] py-[1px] rounded-sm ${getTagType(dev.type)}`}>
                        {dev.id} · {dev.issue}
                      </span>
                    ))}
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[7px] text-cyan-500/35">{notif.devices.length} devices</span>
                    <button className="font-orbitron text-[7px] font-bold tracking-wider px-[10px] py-[3px] border border-yellow-400 bg-yellow-500/10 text-yellow-400 rounded-sm hover:bg-yellow-500/20 hover:shadow-[0_0_10px_rgba(255,204,0,0.35)] transition-all">
                      SEND EMAIL
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Camera Battery & Camera Cellular */}
          <div className="flex gap-[7px] flex-1">
            {/* Camera Battery */}
            <div className="panel relative p-[10px] bg-[rgba(0,18,32,0.93)] border border-cyan-500/30 overflow-hidden flex-1 flex flex-col" data-testid="camera-battery-panel">
              <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
              <div className="panel-glow" />
              <div className="plabel">Camera Battery</div>
              <div className="flex flex-col items-center flex-1 justify-center gap-[8px]">
                <div className="relative w-[80px] h-[80px] flex items-center justify-center">
                  <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 80 80">
                    <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(0,212,255,0.12)" strokeWidth="5" />
                    <circle cx="40" cy="40" r="34" fill="none" stroke="#39ff14" strokeWidth="5" strokeLinecap="round"
                      strokeDasharray={`${cameraBattery.overall * 2.136} ${213.6 - cameraBattery.overall * 2.136}`}
                      className="drop-shadow-[0_0_6px_rgba(57,255,20,0.5)]" />
                  </svg>
                  <span className="font-orbitron text-[20px] font-black text-green-400" style={{ textShadow: '0 0 12px rgba(57,255,20,0.5)' }}>
                    {cameraBattery.overall}%
                  </span>
                </div>
                <div className="w-full grid grid-cols-5 gap-[3px] mt-[4px]">
                  {cameraBattery.levels.map((level, i) => {
                    const colors = [
                      'text-red-400 bg-red-500/15 border-red-500/30',
                      'text-orange-400 bg-orange-500/15 border-orange-500/30',
                      'text-yellow-400 bg-yellow-500/15 border-yellow-500/30',
                      'text-cyan-400 bg-cyan-500/15 border-cyan-500/30',
                      'text-green-400 bg-green-500/15 border-green-500/30',
                    ];
                    return (
                      <div key={i} className={`flex flex-col items-center gap-[2px] p-[4px] border rounded-sm ${colors[i]}`}>
                        <div className="font-orbitron text-[10px] font-black">{level.count}</div>
                        <div className="text-[7px] tracking-wider opacity-70">{level.pct}%</div>
                        <div className="text-[6px] tracking-wider opacity-50 uppercase whitespace-nowrap">{level.label}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Camera Cellular */}
            <div className="panel relative p-[10px] bg-[rgba(0,18,32,0.93)] border border-cyan-500/30 overflow-hidden flex-1 flex flex-col" data-testid="camera-cellular-panel">
              <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
              <div className="panel-glow" />
              <div className="plabel">Camera Cellular</div>
              <div className="flex items-end justify-center gap-[10px] flex-1 pb-[10px]">
                {cameraCellular.map((item, i) => {
                  const barHeights = [0, 15, 30, 50, 72, 95];
                  const barColors = [
                    '', 
                    'bg-gradient-to-t from-red-500/40 to-red-400',
                    'bg-gradient-to-t from-orange-500/40 to-orange-400',
                    'bg-gradient-to-t from-yellow-500/40 to-yellow-400',
                    'bg-gradient-to-t from-cyan-500/40 to-cyan-400',
                    'bg-gradient-to-t from-green-500/40 to-green-400',
                  ];
                  return (
                    <div key={i} className="flex flex-col items-center gap-[4px]">
                      <div className="font-orbitron text-[10px] font-bold text-slate-200/90">{item.count}</div>
                      <div className="flex items-end" style={{ height: '95px' }}>
                        {i === 0 ? (
                          <div className="w-[20px] flex items-end justify-center h-full">
                            <span className="font-orbitron text-[16px] font-black text-red-500 leading-none" style={{ textShadow: '0 0 8px rgba(255,34,68,0.6)' }}>X</span>
                          </div>
                        ) : (
                          <div
                            className={`w-[20px] rounded-t-sm ${barColors[i]}`}
                            style={{ height: `${barHeights[i]}%`, boxShadow: i === 5 ? '0 0 8px rgba(57,255,20,0.3)' : 'none' }}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="flex flex-col gap-[7px]">
          {/* Service Tickets */}
          <div onClick={() => window.open("https://service.cardiac-solutions.ai", "_blank", "noopener,noreferrer")} className="panel relative p-[10px] bg-[rgba(0,18,32,0.93)] border border-cyan-500/30 overflow-hidden flex-1 cursor-pointer hover:border-cyan-400/60 transition-colors" data-testid="service-tickets-panel">
            <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
            <div className="panel-glow" />
            <div className="plabel">Service Tickets <span className="ml-2 text-[7px] px-[5px] py-[1px] bg-yellow-500/20 text-yellow-400 rounded-sm font-bold tracking-wider">IN DEV</span></div>
            <div className="flex flex-col gap-[5px] overflow-y-auto scrollbar-thin" style={{ maxHeight: 'calc(100% - 30px)' }}>
              {tickets.map((ticket, i) => {
                const badge = getStatusBadge(ticket.status);
                const borderColors = {
                  open: 'border-l-red-500',
                  dispatched: 'border-l-cyan-400',
                  enroute: 'border-l-yellow-400',
                  onsite: 'border-l-orange-400',
                  complete: 'border-l-green-400',
                };
                return (
                  <div key={i} className={`flex items-center gap-[8px] px-[8px] py-[7px] bg-cyan-500/5 border-l-2 ${borderColors[ticket.status]} cursor-pointer hover:bg-cyan-500/10 transition-colors`}>
                    <span className="font-orbitron text-[8px] font-bold text-cyan-500/70 min-w-[52px]">{ticket.id}</span>
                    <span className="flex-1 text-[10px] text-slate-200/95 truncate max-w-[95px]">{ticket.loc}</span>
                    <span className={`font-orbitron text-[7px] font-bold px-[6px] py-[3px] rounded-sm ${badge.class}`}>{badge.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Send Overview */}
          <div className="panel relative p-[10px] bg-[rgba(0,18,32,0.93)] border border-cyan-500/30 overflow-hidden" data-testid="send-overview-panel">
            <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
            <div className="panel-glow" />
            <div className="plabel">Send Overview</div>
            <div className="flex flex-col items-center gap-[8px] py-[8px]">
              <div className="text-[9px] text-cyan-500/50 tracking-wider">Email me an overview of this data</div>
              <button
                onClick={handleSendOverview}
                disabled={sendingOverview}
                data-testid="send-overview-btn"
                className="font-orbitron text-[8px] font-bold tracking-[0.15em] px-[14px] py-[5px] border border-cyan-500 bg-cyan-500/10 text-cyan-400 rounded-sm hover:bg-cyan-500/20 hover:shadow-[0_0_14px_rgba(0,212,255,0.4)] transition-all flex items-center gap-[6px] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sendingOverview ? (
                  <Loader2 className="w-[12px] h-[12px] animate-spin" />
                ) : (
                  <Mail className="w-[12px] h-[12px]" />
                )}
                {sendingOverview ? 'SENDING...' : 'SEND'}
              </button>
            </div>
          </div>

          {/* Voice Query */}
          <div className="panel relative p-[10px] bg-[rgba(0,18,32,0.93)] border border-cyan-500/30 overflow-hidden">
            <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
            <div className="panel-glow" />
            <div className="plabel">Voice Query</div>
            <div className="flex items-center justify-center gap-[10px] py-[8px]">
              <div className="flex items-center gap-[2px] h-[16px]">
                {[4, 8, 12, 8, 14, 10, 16, 12, 8, 5].map((h, i) => (
                  <div key={i} className={`w-[2px] rounded-sm ${isListening ? 'bg-red-500 animate-voice-wave' : 'bg-cyan-500/30'}`} style={{ height: h, animationDelay: `${i * 0.1}s` }} />
                ))}
              </div>
              <button 
                onClick={() => setIsListening(!isListening)}
                className={`w-[36px] h-[36px] rounded-full border flex items-center justify-center transition-all flex-shrink-0 ${isListening ? 'border-red-500 bg-red-500/10 animate-mic-pulse' : 'border-cyan-500/50 bg-[rgba(0,40,70,0.8)] hover:border-cyan-400 hover:shadow-[0_0_16px_rgba(0,212,255,0.35)]'}`}
              >
                <Mic className={`w-[14px] h-[14px] ${isListening ? 'text-red-500' : 'text-cyan-400'}`} />
              </button>
              <div className={`font-orbitron text-[7px] font-bold tracking-[0.18em] ${isListening ? 'text-red-500 animate-blink' : 'text-cyan-500/60'}`}>
                {isListening ? 'LISTENING' : 'READY'}
              </div>
            </div>
          </div>
        </div>
        </>) : (<>
        {/* SIMPLE - LEFT COLUMN */}
        <div className="flex flex-col gap-[7px]">
          {/* System Status */}
          <div onClick={() => ssoRedirect("report")} className="panel relative p-[10px] bg-[rgba(0,18,32,0.93)] border border-cyan-500/30 overflow-hidden cursor-pointer hover:border-cyan-400/60 transition-colors">
            <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
            <div className="panel-glow" />
            <div className="plabel">System Status</div>
            <div className="flex flex-col items-center py-[10px]">
              {!liveStats && statusError ? (
                <div className="flex flex-col items-center gap-3 py-4" data-testid="simple-status-error">
                  <AlertTriangle className="w-8 h-8 text-yellow-400" />
                  <span className="font-orbitron text-[8px] text-yellow-400/80 tracking-wider text-center">{statusError}</span>
                  <button onClick={(e) => { e.stopPropagation(); retryStatus(); }} className="font-orbitron text-[7px] font-bold tracking-wider px-3 py-1 border border-cyan-500/40 bg-cyan-500/10 text-cyan-400 rounded-sm hover:bg-cyan-500/20 transition-all flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" /> RETRY
                  </button>
                </div>
              ) : !liveStats ? (
                <div className="flex flex-col items-center gap-3 py-4" data-testid="simple-status-loading">
                  <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
                  <span className="font-orbitron text-[9px] text-cyan-500/60 tracking-wider">CONNECTING TO READISYS...</span>
                </div>
              ) : (
              <>
              <div className="relative w-[120px] h-[75px] flex items-end justify-center overflow-hidden">
                <svg className="absolute top-0 left-0 w-full" viewBox="0 0 120 70" style={{ height: '70px' }}>
                  {/* Colored zone arcs */}
                  {[
                    { start: 0, end: 40, color: '#ff2244' },
                    { start: 40, end: 60, color: '#ffff00' },
                    { start: 60, end: 70, color: '#ffff00' },
                    { start: 70, end: 80, color: '#22b814' },
                    { start: 80, end: 90, color: '#22b814' },
                    { start: 90, end: 100, color: '#22b814' },
                  ].map((zone, i) => {
                    const startAngle = Math.PI + (zone.start / 100) * Math.PI;
                    const endAngle = Math.PI + (zone.end / 100) * Math.PI;
                    const x1 = 60 + 50 * Math.cos(startAngle);
                    const y1 = 65 + 50 * Math.sin(startAngle);
                    const x2 = 60 + 50 * Math.cos(endAngle);
                    const y2 = 65 + 50 * Math.sin(endAngle);
                    return <path key={i} d={`M ${x1} ${y1} A 50 50 0 0 1 ${x2} ${y2}`} fill="none" stroke={zone.color} strokeWidth="8" strokeLinecap="butt" opacity="0.5" />;
                  })}
                  {/* Active arc up to current value */}
                  {(() => {
                    const pct = Math.round(parseFloat(pctReady));
                    const zones = [
                      { start: 0, end: 40, color: '#ff2244' },
                      { start: 40, end: 60, color: '#ffff00' },
                      { start: 60, end: 70, color: '#ffff00' },
                      { start: 70, end: 80, color: '#22b814' },
                      { start: 80, end: 90, color: '#22b814' },
                      { start: 90, end: 100, color: '#22b814' },
                    ];
                    return zones.map((zone, i) => {
                      if (pct <= zone.start) return null;
                      const fillEnd = Math.min(pct, zone.end);
                      const startAngle = Math.PI + (zone.start / 100) * Math.PI;
                      const endAngle = Math.PI + (fillEnd / 100) * Math.PI;
                      const x1 = 60 + 50 * Math.cos(startAngle);
                      const y1 = 65 + 50 * Math.sin(startAngle);
                      const x2 = 60 + 50 * Math.cos(endAngle);
                      const y2 = 65 + 50 * Math.sin(endAngle);
                      return <path key={`active-${i}`} d={`M ${x1} ${y1} A 50 50 0 0 1 ${x2} ${y2}`} fill="none" stroke={zone.color} strokeWidth="8" strokeLinecap="butt" />;
                    });
                  })()}
                  {/* Tick marks */}
                  {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((tick) => {
                    const angle = Math.PI + (tick / 100) * Math.PI;
                    const x1 = 60 + 44 * Math.cos(angle);
                    const y1 = 65 + 44 * Math.sin(angle);
                    const x2 = 60 + 56 * Math.cos(angle);
                    const y2 = 65 + 56 * Math.sin(angle);
                    return <line key={tick} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(0,212,255,0.3)" strokeWidth="1" />;
                  })}
                  {/* Needle */}
                  {(() => {
                    const pct = Math.round(parseFloat(pctReady));
                    const visualPct = pct * 0.88;
                    const angle = Math.PI + (visualPct / 100) * Math.PI;
                    const nx = 60 + 38 * Math.cos(angle);
                    const ny = 65 + 38 * Math.sin(angle);
                    return <line x1="60" y1="65" x2={nx} y2={ny} stroke="#ffffff" strokeWidth="2" strokeLinecap="round" style={{ filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.6))' }} />;
                  })()}
                  {/* Center dot */}
                  <circle cx="60" cy="65" r="3" fill="#ffffff" style={{ filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.5))' }} />
                </svg>
              </div>
              {(() => {
                const pct = parseFloat(pctReady);
                const color = pct < 40 ? '#ff2244' : pct < 70 ? '#ffff00' : '#22b814';
                return (
                  <span className="font-orbitron text-[22px] font-black mt-[4px]" style={{ color, textShadow: `0 0 12px ${color}80` }}>
                    {pctReady}%
                  </span>
                );
              })()}
              {(() => {
                const pct = Math.round(parseFloat(pctReady));
                const color = pct < 40 ? '#ff2244' : pct < 70 ? '#ffff00' : '#22b814';
                return (
                  <div className="font-orbitron text-[9px] font-bold mt-[4px] tracking-wider" style={{ color }}>{stats.ready.toLocaleString()} READY</div>
                );
              })()}
              <div className="font-orbitron text-[9px] font-bold mt-[2px] tracking-wider text-cyan-400">{stats.total.toLocaleString()} TOTAL AEDs</div>
              {lastUpdated && <div className="font-orbitron text-[9px] text-cyan-300/80 tracking-wider mt-[5px]">Last Updated: {lastUpdated}</div>}
              </>
              )}
            </div>
          </div>

          {/* Customer Notifications */}
          <div onClick={() => ssoRedirect("notifications")} className="panel relative p-[10px] bg-[rgba(0,18,32,0.93)] border border-cyan-500/30 overflow-hidden cursor-pointer hover:border-cyan-400/60 transition-colors">
            <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
            <div className="panel-glow" />
            <div className="plabel">Customer Notifications <span className="ml-2 text-[7px] px-[5px] py-[1px] bg-yellow-500/20 text-yellow-400 rounded-sm font-bold tracking-wider">IN DEV</span></div>
            <div className="grid grid-cols-2 gap-[6px] pt-[6px]">
              {[
                { label: 'Total Subscribers', value: stats.subscribers.toLocaleString(), color: 'text-white' },
                { label: 'Total AEDs', value: stats.total.toLocaleString(), color: 'text-cyan-400' },
                { label: 'Action Issues', value: 843, color: 'text-yellow-400' },
                { label: 'Resolved', value: 12, color: 'text-green-600' },
              ].map((item, i) => (
                <div key={i} className="flex flex-col items-center gap-[3px] py-[5px] bg-cyan-500/5 border border-cyan-500/15 rounded-sm">
                  <div className={`font-orbitron text-[14px] font-black ${item.color}`}>{item.value}</div>
                  <div className="text-[6px] tracking-wider text-cyan-500/50 uppercase text-center">{item.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Send Overview */}
          <div className="panel relative p-[10px] bg-[rgba(0,18,32,0.93)] border border-cyan-500/30 overflow-hidden">
            <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
            <div className="panel-glow" />
            <div className="plabel">Send Overview</div>
            <div className="flex flex-col items-center gap-[8px] py-[8px]">
              <div className="text-[9px] text-cyan-500/50 tracking-wider">Email me an overview of this data</div>
              <button
                onClick={handleSendOverview}
                disabled={sendingOverview}
                className="font-orbitron text-[8px] font-bold tracking-[0.15em] px-[14px] py-[5px] border border-cyan-500 bg-cyan-500/10 text-cyan-400 rounded-sm hover:bg-cyan-500/20 hover:shadow-[0_0_14px_rgba(0,212,255,0.4)] transition-all flex items-center gap-[6px] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sendingOverview ? (
                  <Loader2 className="w-[12px] h-[12px] animate-spin" />
                ) : (
                  <Mail className="w-[12px] h-[12px]" />
                )}
                {sendingOverview ? 'SENDING...' : 'SEND'}
              </button>
            </div>
          </div>
        </div>

        {/* SIMPLE - CENTER COLUMN */}
        <div className="flex flex-col gap-[7px]">
          {/* AI Recommendations */}
          <div className="panel relative p-[10px] bg-[rgba(0,18,32,0.93)] border border-cyan-500/30 overflow-hidden" style={{ height: 'calc(100% - 130px)' }}>
            <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
            <div className="panel-glow" />
            <div className="absolute top-[8px] right-[10px] z-20 flex flex-col items-center gap-[3px]">
              <button
                onClick={() => setAiScrollPaused(!aiScrollPaused)}
                className="w-[30px] h-[30px] flex items-center justify-center rounded-sm border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 transition-colors"
              >
                {aiScrollPaused ? <Play className="w-[16px] h-[16px] text-cyan-400" /> : <Pause className="w-[16px] h-[16px] text-cyan-400" />}
              </button>
              <span className="text-[9px] text-cyan-500/60 tracking-wider font-orbitron font-bold">{aiScrollPaused ? 'Scroll' : 'Stop'}</span>
            </div>
            <div className="plabel">Decision Intelligence — AI Recommendations</div>
            {lastUpdated && <div className="font-orbitron text-[8px] text-cyan-400/60 tracking-wider mt-[-2px] mb-[4px]">READINESS DATA UPDATED: {lastUpdated}</div>}
            <div style={{ position: 'relative' }}
              onMouseEnter={diEnter}
              onMouseLeave={diLeave}
              onTouchStart={diTouchStart}
              onTouchEnd={diTouchEnd}
            >
            <div
              className="relative di-scroll-area"
              style={{ height: 'calc(100% - 25px)', overflowY: 'auto', overscrollBehavior: 'contain', touchAction: aiHovered ? 'pan-y' : 'auto' }}
              onScroll={diOnScroll}
            >
              <div className={`ai-scroll-container ${aiHovered ? 'ai-scroll-manual' : ''}`}>
                <div className={`ai-scroll-content ${(aiScrollPaused || aiHovered) ? 'ai-scroll-paused' : ''}`} style={{ animationDuration: `${scrollDuration}s` }}>
                  {diEventList.map((rec) => (
                    rec.type === '_DIVIDER' ? (
                      <div key={rec._key} className="flex items-center gap-3 py-[16px] my-[6px]">
                        <div className="flex-1 h-[3px]" style={{ background: 'linear-gradient(to right, transparent 5%, #f59e0b 30%, #f59e0b 70%, transparent 95%)' }} />
                        <span className="font-orbitron text-[11px] text-yellow-400 tracking-[0.3em] flex-shrink-0 font-bold" style={{ textShadow: '0 0 10px rgba(245,158,11,0.6)' }}>EVENTS REPEAT</span>
                        <div className="flex-1 h-[3px]" style={{ background: 'linear-gradient(to right, transparent 5%, #f59e0b 30%, #f59e0b 70%, transparent 95%)' }} />
                      </div>
                    ) : (
                    <div key={rec._key} className="py-[6px] border-b border-cyan-500/10 flex gap-[10px] items-start">
                      <span className={`font-orbitron text-[8px] font-bold px-[7px] py-[3px] rounded-sm tracking-wider flex-shrink-0 ${rec.type === 'ACT' ? 'bg-orange-500/20 text-orange-400' : rec.type === 'WARN' ? 'bg-yellow-500/15 text-yellow-400' : rec.type === 'ERR' ? 'bg-red-500/20 text-red-400' : rec.type === 'SYS' ? 'bg-cyan-500/20 text-cyan-300' : 'bg-cyan-500/15 text-cyan-400'}`}>
                        {rec.type}
                      </span>
                      <span className="text-[11px] text-slate-200/90 leading-relaxed">{rec.msg}</span>
                    </div>
                    )
                  ))}
                </div>
              </div>
              <div className="absolute top-0 left-0 right-0 h-[16px] bg-gradient-to-b from-[rgba(0,18,32,0.93)] to-transparent pointer-events-none z-10" />
              <div className="absolute bottom-0 left-0 right-0 h-[32px] bg-gradient-to-t from-[rgba(0,18,32,0.93)] to-transparent pointer-events-none z-10" />
            </div>
            {aiHovered && (
              <div ref={diTrackRef} onClick={diTrackClick}
                style={{ position: 'absolute', top: 0, right: 0, width: 10, height: '100%', background: 'rgba(0,40,80,0.5)', borderRadius: 5, cursor: 'pointer', zIndex: 20 }}>
                <div onMouseDown={diThumbDrag} style={{ position: 'absolute', top: `${diScrollPct * 80}%`, width: '100%', height: '20%', background: '#0088ff', borderRadius: 5, boxShadow: '0 0 6px rgba(0,136,255,0.5)', minHeight: 30, cursor: 'grab' }} />
              </div>
            )}
            </div>
          </div>

          {/* Camera Battery & Camera Cellular */}
          <div className="flex gap-[7px]">
            {/* Camera Battery */}
            <div className="panel relative p-[10px] bg-[rgba(0,18,32,0.93)] border border-cyan-500/30 overflow-hidden flex-1">
              <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
              <div className="panel-glow" />
              <div className="plabel">Camera Battery</div>
              <div className="flex flex-col items-center justify-start gap-[8px] pt-[4px]">
                <div className="w-full grid grid-cols-5 gap-[3px]">
                  {cameraBattery.levels.map((level, i) => {
                    const colors = [
                      'text-red-400 bg-red-500/15 border-red-500/30',
                      'text-orange-400 bg-orange-500/15 border-orange-500/30',
                      'text-yellow-400 bg-yellow-500/15 border-yellow-500/30',
                      'text-cyan-400 bg-cyan-500/15 border-cyan-500/30',
                      'text-green-400 bg-green-500/15 border-green-500/30',
                    ];
                    return (
                      <div key={i} className={`flex flex-col items-center gap-[2px] p-[4px] border rounded-sm ${colors[i]}`}>
                        <div className="font-orbitron text-[10px] font-black">{level.count}</div>
                        <div className="text-[7px] tracking-wider opacity-70">{level.pct}%</div>
                        <div className="text-[6px] tracking-wider opacity-50 uppercase whitespace-nowrap">{level.label}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Camera Cellular */}
            <div className="panel relative p-[10px] bg-[rgba(0,18,32,0.93)] border border-cyan-500/30 overflow-hidden flex-1">
              <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
              <div className="panel-glow" />
              <div className="plabel">Camera Cellular</div>
              <div className="flex items-end justify-center gap-[8px] pt-[4px]">
                {cameraCellular.map((item, i) => {
                  const barHeights = [0, 15, 30, 50, 72, 95];
                  const barColors = [
                    '', 
                    'bg-gradient-to-t from-red-500/40 to-red-400',
                    'bg-gradient-to-t from-orange-500/40 to-orange-400',
                    'bg-gradient-to-t from-yellow-500/40 to-yellow-400',
                    'bg-gradient-to-t from-cyan-500/40 to-cyan-400',
                    'bg-gradient-to-t from-green-500/40 to-green-400',
                  ];
                  return (
                    <div key={i} className="flex flex-col items-center gap-[3px]">
                      <div className="font-orbitron text-[9px] font-bold text-slate-200/90">{item.count}</div>
                      <div className="flex items-end" style={{ height: '55px' }}>
                        {i === 0 ? (
                          <div className="w-[16px] flex items-end justify-center h-full">
                            <span className="font-orbitron text-[12px] font-black text-red-500 leading-none" style={{ textShadow: '0 0 8px rgba(255,34,68,0.6)' }}>X</span>
                          </div>
                        ) : (
                          <div
                            className={`w-[16px] rounded-t-sm ${barColors[i]}`}
                            style={{ height: `${barHeights[i]}%`, boxShadow: i === 5 ? '0 0 8px rgba(57,255,20,0.3)' : 'none' }}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* SIMPLE - RIGHT COLUMN */}
        <div className="flex flex-col gap-[7px]">
          {/* Service Tickets */}
          <div onClick={() => window.open("https://service.cardiac-solutions.ai", "_blank", "noopener,noreferrer")} className="panel relative p-[10px] bg-[rgba(0,18,32,0.93)] border border-cyan-500/30 overflow-hidden cursor-pointer hover:border-cyan-400/60 transition-colors">
            <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
            <div className="panel-glow" />
            <div className="plabel">Service Tickets <span className="ml-2 text-[7px] px-[5px] py-[1px] bg-yellow-500/20 text-yellow-400 rounded-sm font-bold tracking-wider">IN DEV</span></div>
            <div className="flex flex-col gap-[5px] pt-[4px]">
              {[
                { label: 'Needs Attention', value: stats.lost + stats.service, color: 'text-red-400', bg: 'bg-red-500/15', border: 'border-l-red-500' },
                { label: 'Open', value: tickets.filter(t => t.status === 'open').length, color: 'text-white', bg: 'bg-white/5', border: 'border-l-white' },
                { label: 'Dispatched', value: tickets.filter(t => t.status === 'dispatched').length, color: 'text-green-300', bg: 'bg-green-500/8', border: 'border-l-green-300' },
                { label: 'Dispatch Acknowledged', value: 2, color: 'text-green-600', bg: 'bg-green-500/8', border: 'border-l-green-600' },
                { label: 'En Route', value: tickets.filter(t => t.status === 'enroute').length, color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-l-yellow-400' },
                { label: 'On Site', value: tickets.filter(t => t.status === 'onsite').length, color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-l-orange-400' },
                { label: 'Completed', value: tickets.filter(t => t.status === 'complete').length, color: 'text-cyan-300', bg: 'bg-cyan-500/8', border: 'border-l-cyan-300' },
                { label: 'Confirmed', value: 1, color: 'text-blue-600', bg: 'bg-blue-500/8', border: 'border-l-blue-600' },
              ].map((item, i) => (
                <div key={i} className={`flex items-center justify-between px-[9px] py-[7px] ${item.bg} border-l-2 ${item.border}`}>
                  <span className="text-[10px] text-slate-200/90 tracking-wider">{item.label}</span>
                  <span className={`font-orbitron text-[13px] font-black ${item.color}`}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Voice Query */}
          <div className="panel relative p-[10px] bg-[rgba(0,18,32,0.93)] border border-cyan-500/30 overflow-hidden">
            <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
            <div className="panel-glow" />
            <div className="plabel">Voice Query</div>
            <div className="flex items-center justify-center gap-[10px] py-[8px]">
              <div className="flex items-center gap-[2px] h-[16px]">
                {[4, 8, 12, 8, 14, 10, 16, 12, 8, 5].map((h, i) => (
                  <div key={i} className={`w-[2px] rounded-sm ${isListening ? 'bg-red-500 animate-voice-wave' : 'bg-cyan-500/30'}`} style={{ height: h, animationDelay: `${i * 0.1}s` }} />
                ))}
              </div>
              <button 
                onClick={() => setIsListening(!isListening)}
                className={`w-[36px] h-[36px] rounded-full border flex items-center justify-center transition-all flex-shrink-0 ${isListening ? 'border-red-500 bg-red-500/10 animate-mic-pulse' : 'border-cyan-500/50 bg-[rgba(0,40,70,0.8)] hover:border-cyan-400 hover:shadow-[0_0_16px_rgba(0,212,255,0.35)]'}`}
              >
                <Mic className={`w-[14px] h-[14px] ${isListening ? 'text-red-500' : 'text-cyan-400'}`} />
              </button>
              <div className={`font-orbitron text-[7px] font-bold tracking-[0.18em] ${isListening ? 'text-red-500 animate-blink' : 'text-cyan-500/60'}`}>
                {isListening ? 'LISTENING' : 'READY'}
              </div>
            </div>
          </div>
        </div>
        </>)}

        {/* BOTTOM BAR */}
        {viewMode === 'detailed' && (
        <div className="col-span-3 flex gap-[7px]">
          {[
            { label: 'Total\nDevices', value: stats.total.toLocaleString(), size: '13px' },
            { label: 'Ready', value: stats.ready.toLocaleString(), color: 'green' },
            { label: 'Lost\nContact', value: stats.lost, color: 'yellow' },
            { label: 'Needs\nService', value: stats.service, color: 'orange' },
            { label: 'Notifs\nPending', value: stats.pendingNotifs, color: 'yellow', size: '14px' },
            { label: 'Open\nTickets', value: stats.openTickets, size: '14px' },
          ].map((item, i) => (
            <div key={i} className="flex-1 flex items-center justify-center gap-[10px] px-[8px] py-[7px] border border-cyan-500/30 bg-[rgba(0,18,32,0.93)] relative overflow-hidden">
              <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/10 to-transparent" />
              <div className="w-[44px] h-[44px] rounded-full border border-cyan-500/30 flex items-center justify-center relative flex-shrink-0">
                <div className="absolute inset-[4px] rounded-full border border-cyan-500/15" />
                <span className={`font-orbitron font-black ${item.color === 'green' ? 'text-green-400' : item.color === 'yellow' ? 'text-yellow-400' : item.color === 'orange' ? 'text-orange-400' : 'text-cyan-400'}`} style={{ fontSize: item.size || '18px', textShadow: item.color ? `0 0 10px ${item.color === 'green' ? 'rgba(57,255,20,0.45)' : item.color === 'yellow' ? 'rgba(255,204,0,0.45)' : 'rgba(255,107,53,0.45)'}` : '0 0 8px rgba(0,212,255,0.35)' }}>
                  {item.value}
                </span>
              </div>
              <div className="text-[7px] tracking-[0.13em] text-cyan-500/50 uppercase leading-[1.5] whitespace-pre-line">{item.label}</div>
            </div>
          ))}
        </div>
        )}
      </div>

      <style jsx>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;700;900&family=Share+Tech+Mono&display=swap');
        
        .ai-scroll-container {
          overflow: hidden;
          height: 100%;
        }
        .ai-scroll-container.ai-scroll-manual {
          overflow: visible;
          height: auto;
        }
        .ai-scroll-content {
          animation: ai-scroll 180s linear infinite;
        }
        .ai-scroll-container.ai-scroll-manual .ai-scroll-content,
        .ai-scroll-content.ai-scroll-paused {
          animation: none;
          transform: none;
        }
        @keyframes ai-scroll {
          0% { transform: translateY(0); }
          100% { transform: translateY(-50%); }
        }
        
        /* DI scroll area - hide native scrollbar, custom one rendered via React */
        .di-scroll-area { scrollbar-width: none; -ms-overflow-style: none; }
        .di-scroll-area::-webkit-scrollbar { display: none; }
        
        .jarvis-dash {
          background: #020c15;
          font-family: 'Share Tech Mono', monospace;
        }
        
        .font-orbitron {
          font-family: 'Orbitron', monospace;
        }
        
        .corner {
          position: absolute;
          width: 9px;
          height: 9px;
          pointer-events: none;
          border-color: rgb(0, 212, 255);
          border-style: solid;
        }
        .corner.tl { top: -1px; left: -1px; border-width: 2px 0 0 2px; }
        .corner.tr { top: -1px; right: -1px; border-width: 2px 2px 0 0; }
        .corner.bl { bottom: -1px; left: -1px; border-width: 0 0 2px 2px; }
        .corner.br { bottom: -1px; right: -1px; border-width: 0 2px 2px 0; }
        
        .panel-glow {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgb(0, 212, 255), transparent);
          opacity: 0.35;
          animation: topline 5s ease-in-out infinite;
          pointer-events: none;
        }
        
        .plabel {
          font-family: 'Orbitron', monospace;
          font-size: 8px;
          font-weight: 700;
          letter-spacing: 0.2em;
          color: rgba(0, 212, 255, 0.85);
          text-transform: uppercase;
          margin-bottom: 10px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .plabel::after {
          content: '';
          flex: 1;
          height: 1px;
          background: linear-gradient(90deg, rgba(0, 212, 255, 0.4), transparent);
        }
        
        @keyframes topline {
          0%, 100% { opacity: 0.15; }
          50% { opacity: 0.65; }
        }
        
        @keyframes scan {
          from { transform: translateY(-100vh); }
          to { transform: translateY(100vh); }
        }
        .animate-scan { animation: scan 7s linear infinite; }
        
        @keyframes logo-pulse {
          0%, 100% { text-shadow: 0 0 8px rgba(255, 34, 68, 0.5); }
          50% { text-shadow: 0 0 26px #ff2244, 0 0 50px rgba(255, 34, 68, 0.4); }
        }
        .animate-logo-pulse { animation: logo-pulse 3s ease-in-out infinite; }
        
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.2; }
        }
        .animate-blink { animation: blink 2s ease-in-out infinite; }
        .animate-blink-fast { animation: blink 1s ease-in-out infinite; }

        @keyframes led-flash {
          0%, 100% { opacity: 1; box-shadow: 0 0 10px #39ff14, 0 0 22px rgba(57,255,20,0.6), 0 0 40px rgba(57,255,20,0.25); }
          50% { opacity: 0.15; box-shadow: 0 0 2px rgba(57,255,20,0.2); }
        }
        .animate-led-flash { animation: led-flash 1.4s ease-in-out infinite; }
        .animate-led-flash-alt { animation: led-flash 1.4s ease-in-out infinite 0.7s; }
        
        @keyframes spin-slow { to { transform: rotate(360deg); } }
        @keyframes spin-reverse { to { transform: rotate(-360deg); } }
        @keyframes spin-medium { to { transform: rotate(360deg); } }
        .animate-spin-slow { animation: spin-slow 14s linear infinite; }
        .animate-spin-reverse { animation: spin-reverse 9s linear infinite; }
        .animate-spin-medium { animation: spin-medium 5.5s linear infinite; }
        
        @keyframes core-glow {
          0%, 100% { box-shadow: 0 0 10px rgba(57, 255, 20, 0.3), inset 0 0 7px rgba(57, 255, 20, 0.15); }
          50% { box-shadow: 0 0 26px rgba(57, 255, 20, 0.65), inset 0 0 16px rgba(57, 255, 20, 0.3); }
        }
        .animate-core-glow { animation: core-glow 2s ease-in-out infinite; }
        
        @keyframes mic-pulse {
          0%, 100% { box-shadow: 0 0 8px rgba(255, 34, 68, 0.4); }
          50% { box-shadow: 0 0 22px rgba(255, 34, 68, 0.8); }
        }
        .animate-mic-pulse { animation: mic-pulse 1s ease-in-out infinite; }
        
        @keyframes voice-wave {
          0%, 100% { transform: scaleY(1); }
          50% { transform: scaleY(1.5); }
        }
        .animate-voice-wave { animation: voice-wave 0.5s ease-in-out infinite; }
        
        .scrollbar-thin::-webkit-scrollbar { width: 2px; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: rgba(0, 212, 255, 0.3); }
      `}</style>
    </div>
  );
}
