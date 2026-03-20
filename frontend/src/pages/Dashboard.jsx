import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { LogOut, Mic, Mail, Loader2, Play, Pause } from "lucide-react";

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function Dashboard({ user, onLogout }) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isListening, setIsListening] = useState(false);
  const [aiScrollPaused, setAiScrollPaused] = useState(false);
  const [sendingOverview, setSendingOverview] = useState(false);
  const [viewMode, setViewMode] = useState(() => localStorage.getItem("dashboard_view") || 'detailed');

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

  // Mock data
  const stats = {
    total: 3300,
    ready: 3201,
    lost: 62,
    service: 28,
    dispatch: 9,
    alerts: 12,
    pendingNotifs: 2,
    sentToday: 2,
    devicesAffected: 5,
    openTickets: 10
  };

  const pctReady = ((stats.ready / stats.total) * 100).toFixed(1);

  const aiRecommendations = [
    { type: 'INFO', msg: 'Tech R. Chen has 4 open tickets in SW region. Recommend reassigning AED-0772 (Phoenix) to nearest available tech.' },
    { type: 'ACT', msg: 'Battery degradation on AED-1204 & AED-1205 (Seattle). Schedule combined service visit.' },
    { type: 'WARN', msg: '3 devices in Miami-Dade lost contact within 12h — possible network outage. Check ISP before dispatching.' },
    { type: 'ACT', msg: "AED-0881 Chicago O'Hare offline 48h — escalate to SVC-0038. Risk: critical public venue." },
    { type: 'ACT', msg: 'Dispatch tech to AED-0293 (Tampa Intl) — lost contact 6h, high-traffic zone. Recommend same-day response.' },
  ];

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

  const cameraBattery = {
    overall: 90,
    levels: [
      { label: 'Dead', count: 66, pct: 2 },
      { label: '1/4', count: 99, pct: 3 },
      { label: '1/2', count: 165, pct: 5 },
      { label: '3/4', count: 495, pct: 15 },
      { label: 'Full', count: 2475, pct: 75 },
    ]
  };

  const cameraCellular = [
    { bars: 0, count: 33, label: 'X' },
    { bars: 1, count: 52, label: '1' },
    { bars: 2, count: 115, label: '2' },
    { bars: 3, count: 280, label: '3' },
    { bars: 4, count: 620, label: '4' },
    { bars: 5, count: 2200, label: '5' },
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
          <div className="flex flex-col">
            <div className="font-orbitron text-[13px] font-black tracking-[0.25em] text-red-500 animate-logo-pulse">
              CARDIAC SOLUTIONS
            </div>
            <div className="font-orbitron text-[9px] font-bold tracking-[0.2em] text-cyan-400">
              COMMAND CENTER
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
          <div className="flex gap-[18px] items-center text-[9px] tracking-wider">
            <span className="flex items-center gap-1">
              <span className="w-[5px] h-[5px] rounded-full bg-green-400 animate-blink" />
              AI MONITOR ACTIVE
            </span>
            <span>|</span>
            <span>{stats.total.toLocaleString()} DEVICES</span>
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
          <div className="panel relative p-[10px] bg-[rgba(0,18,32,0.93)] border border-cyan-500/30 overflow-hidden">
            <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
            <div className="panel-glow" />
            <div className="plabel">System Status</div>
            <div className="flex flex-col items-center py-[10px]">
              <div className="relative w-[105px] h-[105px]">
                <div className="absolute inset-0 rounded-full border border-cyan-500/30 animate-spin-slow" />
                <div className="absolute inset-[9px] rounded-full border border-cyan-500/45 border-t-cyan-400 animate-spin-reverse" />
                <div className="absolute inset-[19px] rounded-full border border-cyan-500/20 border-l-cyan-400 border-r-cyan-400 animate-spin-medium" />
                <div className="absolute inset-[34px] rounded-full bg-[rgba(0,35,70,0.95)] border border-cyan-500/65 flex items-center justify-center animate-core-glow">
                  <span className="font-orbitron text-[15px] font-black text-green-400">{Math.round(parseFloat(pctReady))}%</span>
                </div>
              </div>
              <div className="font-orbitron text-[9px] font-bold text-green-400 mt-[6px] tracking-wider">{stats.ready.toLocaleString()} READY</div>
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
              { name: 'READY', val: stats.ready, pct: (stats.ready/stats.total*100), color: 'green' },
              { name: 'LOST CONTACT', val: stats.lost, pct: (stats.lost/stats.total*100), color: 'yellow' },
              { name: 'NEEDS SERVICE', val: stats.service, pct: (stats.service/stats.total*100), color: 'orange' },
              { name: 'DISPATCHED', val: stats.dispatch, pct: (stats.dispatch/stats.total*100), color: 'cyan' },
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
            <div className="max-h-[220px] overflow-hidden relative">
              <div className="ai-scroll-container">
                <div className={`ai-scroll-content ${aiScrollPaused ? 'ai-scroll-paused' : ''}`}>
                  {[...aiRecommendations, ...aiRecommendations].map((rec, i) => (
                    <div key={i} className="py-[6px] border-b border-cyan-500/10 flex gap-[10px] items-start">
                      <span className={`font-orbitron text-[8px] font-bold px-[7px] py-[3px] rounded-sm tracking-wider flex-shrink-0 ${rec.type === 'ACT' ? 'bg-orange-500/20 text-orange-400' : rec.type === 'WARN' ? 'bg-yellow-500/15 text-yellow-400' : 'bg-cyan-500/15 text-cyan-400'}`}>
                        {rec.type}
                      </span>
                      <span className="text-[11px] text-slate-200/90 leading-relaxed">{rec.msg}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="absolute top-0 left-0 right-0 h-[16px] bg-gradient-to-b from-[rgba(0,18,32,0.93)] to-transparent pointer-events-none z-10" />
              <div className="absolute bottom-0 left-0 right-0 h-[32px] bg-gradient-to-t from-[rgba(0,18,32,0.93)] to-transparent pointer-events-none z-10" />
            </div>
          </div>

          {/* Customer Notifications (compact) */}
          <div className="panel relative p-[10px] bg-[rgba(0,18,32,0.93)] border border-cyan-500/30 overflow-hidden" data-testid="customer-notifications-panel">
            <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
            <div className="panel-glow" />
            <div className="plabel">Customer Notifications</div>
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
          <div className="panel relative p-[10px] bg-[rgba(0,18,32,0.93)] border border-cyan-500/30 overflow-hidden flex-1">
            <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
            <div className="panel-glow" />
            <div className="plabel">Service Tickets</div>
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
          <div className="panel relative p-[10px] bg-[rgba(0,18,32,0.93)] border border-cyan-500/30 overflow-hidden">
            <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
            <div className="panel-glow" />
            <div className="plabel">System Status</div>
            <div className="flex flex-col items-center py-[10px]">
              <div className="relative w-[105px] h-[105px]">
                <div className="absolute inset-0 rounded-full border border-cyan-500/30 animate-spin-slow" />
                <div className="absolute inset-[9px] rounded-full border border-cyan-500/45 border-t-cyan-400 animate-spin-reverse" />
                <div className="absolute inset-[19px] rounded-full border border-cyan-500/20 border-l-cyan-400 border-r-cyan-400 animate-spin-medium" />
                <div className="absolute inset-[34px] rounded-full bg-[rgba(0,35,70,0.95)] border border-cyan-500/65 flex items-center justify-center animate-core-glow">
                  <span className="font-orbitron text-[15px] font-black text-green-400">{Math.round(parseFloat(pctReady))}%</span>
                </div>
              </div>
              <div className="font-orbitron text-[9px] font-bold text-green-400 mt-[6px] tracking-wider">{stats.ready.toLocaleString()} READY</div>
            </div>
          </div>
        </div>

        {/* SIMPLE - CENTER COLUMN */}
        <div className="flex flex-col gap-[7px]">
          {/* AI Recommendations */}
          <div className="panel relative p-[10px] bg-[rgba(0,18,32,0.93)] border border-cyan-500/30 overflow-hidden">
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
            <div className="max-h-[220px] overflow-hidden relative">
              <div className="ai-scroll-container">
                <div className={`ai-scroll-content ${aiScrollPaused ? 'ai-scroll-paused' : ''}`}>
                  {[...aiRecommendations, ...aiRecommendations].map((rec, i) => (
                    <div key={i} className="py-[6px] border-b border-cyan-500/10 flex gap-[10px] items-start">
                      <span className={`font-orbitron text-[8px] font-bold px-[7px] py-[3px] rounded-sm tracking-wider flex-shrink-0 ${rec.type === 'ACT' ? 'bg-orange-500/20 text-orange-400' : rec.type === 'WARN' ? 'bg-yellow-500/15 text-yellow-400' : 'bg-cyan-500/15 text-cyan-400'}`}>
                        {rec.type}
                      </span>
                      <span className="text-[11px] text-slate-200/90 leading-relaxed">{rec.msg}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="absolute top-0 left-0 right-0 h-[16px] bg-gradient-to-b from-[rgba(0,18,32,0.93)] to-transparent pointer-events-none z-10" />
              <div className="absolute bottom-0 left-0 right-0 h-[32px] bg-gradient-to-t from-[rgba(0,18,32,0.93)] to-transparent pointer-events-none z-10" />
            </div>
          </div>

          {/* Customer Notifications (compact) */}
          <div className="panel relative p-[10px] bg-[rgba(0,18,32,0.93)] border border-cyan-500/30 overflow-hidden">
            <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
            <div className="panel-glow" />
            <div className="plabel">Customer Notifications</div>
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
            <div className="panel relative p-[10px] bg-[rgba(0,18,32,0.93)] border border-cyan-500/30 overflow-hidden flex-1 flex flex-col">
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
            <div className="panel relative p-[10px] bg-[rgba(0,18,32,0.93)] border border-cyan-500/30 overflow-hidden flex-1 flex flex-col">
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

        {/* SIMPLE - RIGHT COLUMN */}
        <div className="flex flex-col gap-[7px]">
          {/* Service Tickets */}
          <div className="panel relative p-[10px] bg-[rgba(0,18,32,0.93)] border border-cyan-500/30 overflow-hidden flex-1">
            <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
            <div className="panel-glow" />
            <div className="plabel">Service Tickets</div>
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
      </div>

      <style jsx>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;700;900&family=Share+Tech+Mono&display=swap');
        
        .ai-scroll-container {
          overflow: hidden;
          height: 100%;
        }
        .ai-scroll-content {
          animation: ai-scroll 25s linear infinite;
        }
        .ai-scroll-container:hover .ai-scroll-content {
          animation-play-state: paused;
        }
        .ai-scroll-content.ai-scroll-paused {
          animation-play-state: paused;
        }
        @keyframes ai-scroll {
          0% { transform: translateY(0); }
          100% { transform: translateY(-50%); }
        }
        
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
