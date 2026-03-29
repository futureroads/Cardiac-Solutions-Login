import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Server,
  Camera,
  Database,
  Activity,
  Cpu,
  HardDrive,
  Clock,
  ArrowLeft,
  LogOut,
  Wifi,
  CheckCircle2,
  ExternalLink,
  Globe,
  ShieldCheck,
  Link,
  User,
  Key,
  CalendarClock,
  Timer,
} from "lucide-react";
import API_BASE from "@/apiBase";

export default function BackendManagement({ user, onLogout }) {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [serverInfo, setServerInfo] = useState(null);

  const token = localStorage.getItem("token") || "";

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchServerInfo = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/version`);
        if (res.ok) setServerInfo(await res.json());
      } catch {}
    };
    fetchServerInfo();
  }, []);

  const formatTime = (date) => date.toTimeString().slice(0, 8);
  const formatDate = (date) => {
    const days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
    const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    return `${days[date.getDay()]}  ${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };

  // Mock backend stats
  const cameraStats = {
    totalCameras: 3300,
    checkedIn24h: 3200,
    online: 3108,
    offline: 192,
    endpoint: "camera.cardiac-solutions.ai",
  };

  const serverStats = {
    uptime: "14d 7h 22m",
    cpu: 23,
    memory: 61,
    disk: 44,
    dbStatus: "CONNECTED",
    dbLatency: "3ms",
    apiRequests24h: 48200,
    avgResponseTime: "42ms",
  };

  const services = [
    { name: "API Gateway", status: "online", latency: "12ms" },
    { name: "Auth Service", status: "online", latency: "8ms" },
    { name: "Camera Ingest", status: "online", latency: "22ms" },
    { name: "Notification Engine", status: "online", latency: "15ms" },
    { name: "Report Generator", status: "online", latency: "31ms" },
    { name: "SSO Service", status: "online", latency: "5ms" },
  ];

  const recentEvents = [
    { time: "2m ago", event: "Camera check-in batch processed", count: 142, type: "info" },
    { time: "5m ago", event: "SSL certificate renewed", count: null, type: "success" },
    { time: "12m ago", event: "Database backup completed", count: null, type: "success" },
    { time: "18m ago", event: "Camera check-in batch processed", count: 138, type: "info" },
    { time: "34m ago", event: "High latency detected — Camera Ingest", count: null, type: "warn" },
    { time: "1h ago", event: "Auto-scaling triggered — 2 pods added", count: null, type: "info" },
    { time: "2h ago", event: "Camera check-in batch processed", count: 156, type: "info" },
    { time: "3h ago", event: "User session cleanup — 24 expired", count: 24, type: "info" },
  ];

  return (
    <div className="backend-mgmt min-h-screen text-cyan-400 font-mono text-[11px] relative" data-testid="backend-management">
      {/* Background Grid */}
      <div className="fixed inset-0 pointer-events-none z-0" style={{
        backgroundImage: "linear-gradient(rgba(0,212,255,0.032) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.032) 1px, transparent 1px)",
        backgroundSize: "36px 36px",
      }} />

      {/* Scan Line */}
      <div className="fixed top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-500/10 to-transparent animate-scan pointer-events-none z-0" />

      <div className="flex flex-col min-h-screen relative z-10">
        {/* TOP BAR */}
        <div className="flex items-center justify-between px-[18px] py-[7px] border-b border-cyan-500/30 bg-[rgba(0,18,32,0.93)]" style={{ clipPath: "polygon(0 0, 100% 0, 98.5% 100%, 1.5% 100%)" }}>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/hub")}
              className="flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 transition-colors"
              data-testid="back-to-hub-btn"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="font-orbitron text-[9px] font-bold tracking-wider">HUB</span>
            </button>
            <div className="w-[1px] h-[20px] bg-cyan-500/30" />
            <div className="flex flex-col">
              <div className="font-orbitron text-[13px] font-black tracking-[0.25em]" style={{ lineHeight: 1.2 }}>
                <span className="text-white">CARDIAC</span>{" "}
                <span className="text-red-500 animate-logo-pulse">SOLUTIONS</span>
              </div>
              <div className="font-orbitron text-[9px] font-bold tracking-[0.2em] text-cyan-400">
                SYSTEM MONITORING & CONTROL
              </div>
            </div>
          </div>
          <div className="flex gap-[18px] items-center text-[9px] tracking-wider">
            <span className="flex items-center gap-1">
              <span className="w-[5px] h-[5px] rounded-full bg-green-400 animate-blink" />
              ALL SYSTEMS OPERATIONAL
            </span>
            <span>|</span>
            <span>{serverInfo?.version || "v10-instant"}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end gap-[2px]">
              <div className="font-orbitron text-[13px] font-bold tracking-wider">{formatTime(currentTime)}</div>
              <div className="font-orbitron text-[10px] tracking-[0.12em] text-cyan-500/65">{formatDate(currentTime)}</div>
            </div>
            <button onClick={onLogout} className="text-red-500 hover:text-red-400 transition-colors" data-testid="backend-logout-btn">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* MAIN CONTENT */}
        <div className="flex-1 p-[10px] grid grid-cols-[1fr_1fr_280px] gap-[7px]">

          {/* LEFT COLUMN — Camera Stats */}
          <div className="flex flex-col gap-[7px]">
            {/* Camera Overview */}
            <div className="panel relative p-[10px] bg-[rgba(0,18,32,0.93)] border border-cyan-500/30 overflow-hidden" data-testid="camera-overview-panel">
              <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
              <div className="panel-glow" />
              <div className="plabel">Camera Overview</div>

              <div className="flex flex-col gap-[8px]">
                {/* Total Cameras */}
                <div className="flex items-center justify-between px-[12px] py-[10px] bg-cyan-500/5 border border-cyan-500/15 rounded-sm" data-testid="total-cameras-stat">
                  <div className="flex items-center gap-[10px]">
                    <div className="w-[36px] h-[36px] rounded-full border border-cyan-500/40 flex items-center justify-center">
                      <Camera className="w-[16px] h-[16px] text-cyan-400" />
                    </div>
                    <div>
                      <div className="text-[7px] tracking-wider text-cyan-500/50 uppercase">Total Cameras</div>
                      <div className="font-orbitron text-[9px] font-bold text-cyan-500/40 tracking-wider">Registered Devices</div>
                    </div>
                  </div>
                  <div className="font-orbitron text-[28px] font-black text-cyan-400" style={{ textShadow: "0 0 14px rgba(0,212,255,0.5)" }}>
                    {cameraStats.totalCameras.toLocaleString()}
                  </div>
                </div>

                {/* Total Checked In In Past 24 Hrs */}
                <div className="flex items-center justify-between px-[12px] py-[10px] bg-green-500/5 border border-green-500/20 rounded-sm" data-testid="checked-in-24h-stat">
                  <div className="flex items-center gap-[10px]">
                    <div className="w-[36px] h-[36px] rounded-full border border-green-500/40 flex items-center justify-center">
                      <CheckCircle2 className="w-[16px] h-[16px] text-green-400" />
                    </div>
                    <div>
                      <div className="text-[7px] tracking-wider text-green-500/60 uppercase">Total Checked In In Past 24 Hrs</div>
                      <div className="font-orbitron text-[9px] font-bold text-green-500/40 tracking-wider">Active Check-Ins</div>
                    </div>
                  </div>
                  <div className="font-orbitron text-[28px] font-black text-green-400" style={{ textShadow: "0 0 14px rgba(57,255,20,0.5)" }}>
                    {cameraStats.checkedIn24h.toLocaleString()}
                  </div>
                </div>

                {/* Online / Offline breakdown */}
                <div className="grid grid-cols-2 gap-[6px]">
                  <div className="flex flex-col items-center gap-[4px] py-[8px] bg-green-500/8 border border-green-500/20 rounded-sm" data-testid="cameras-online-stat">
                    <Wifi className="w-[14px] h-[14px] text-green-400" />
                    <div className="font-orbitron text-[18px] font-black text-green-400">{cameraStats.online.toLocaleString()}</div>
                    <div className="text-[7px] tracking-wider text-green-500/50 uppercase">Online</div>
                  </div>
                  <div className="flex flex-col items-center gap-[4px] py-[8px] bg-red-500/8 border border-red-500/20 rounded-sm" data-testid="cameras-offline-stat">
                    <Wifi className="w-[14px] h-[14px] text-red-400 opacity-50" />
                    <div className="font-orbitron text-[18px] font-black text-red-400">{cameraStats.offline}</div>
                    <div className="text-[7px] tracking-wider text-red-500/50 uppercase">Offline</div>
                  </div>
                </div>

                {/* Camera Endpoint */}
                <div className="flex items-center justify-between px-[12px] py-[10px] bg-cyan-500/5 border border-cyan-500/15 rounded-sm" data-testid="camera-endpoint-stat">
                  <div className="flex items-center gap-[10px]">
                    <div className="w-[36px] h-[36px] rounded-full border border-cyan-500/40 flex items-center justify-center">
                      <Globe className="w-[16px] h-[16px] text-cyan-400" />
                    </div>
                    <div>
                      <div className="text-[7px] tracking-wider text-cyan-500/50 uppercase">Camera Endpoint</div>
                      <div className="font-orbitron text-[11px] font-bold text-cyan-400 tracking-wider">{cameraStats.endpoint}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => window.open(`https://${cameraStats.endpoint}`, "_blank", "noopener,noreferrer")}
                    className="flex items-center gap-[4px] px-[8px] py-[4px] border border-cyan-500/30 bg-cyan-500/10 rounded-sm hover:bg-cyan-500/20 transition-colors"
                    data-testid="camera-endpoint-link"
                  >
                    <ExternalLink className="w-[10px] h-[10px] text-cyan-400" />
                    <span className="font-orbitron text-[7px] font-bold text-cyan-400 tracking-wider">OPEN</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Services Status */}
            <div className="panel relative p-[10px] bg-[rgba(0,18,32,0.93)] border border-cyan-500/30 overflow-hidden flex-1" data-testid="services-panel">
              <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
              <div className="panel-glow" />
              <div className="plabel">Microservices</div>
              <div className="flex flex-col gap-[5px]">
                {services.map((svc, i) => (
                  <div key={i} className="flex items-center justify-between px-[10px] py-[7px] bg-cyan-500/5 border-l-2 border-l-green-400 hover:bg-cyan-500/10 transition-colors">
                    <div className="flex items-center gap-[8px]">
                      <span className="w-[5px] h-[5px] rounded-full bg-green-400" style={{ boxShadow: "0 0 6px rgba(57,255,20,0.6)" }} />
                      <span className="text-[10px] text-slate-200/90 tracking-wider">{svc.name}</span>
                    </div>
                    <div className="flex items-center gap-[10px]">
                      <span className="font-orbitron text-[8px] font-bold text-cyan-500/60 tracking-wider">{svc.latency}</span>
                      <span className="font-orbitron text-[7px] font-bold px-[6px] py-[2px] rounded-sm bg-green-500/15 text-green-400 tracking-wider">ONLINE</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* CENTER COLUMN — Server Stats & Events */}
          <div className="flex flex-col gap-[7px]">
            {/* Readiness System — square card */}
            <div className="flex justify-center">
              <div className="panel relative p-[14px] bg-[rgba(0,18,32,0.93)] border border-cyan-500/30 overflow-hidden w-[320px] aspect-square flex flex-col" data-testid="readiness-system-panel">
                <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
                <div className="panel-glow" />
                <div className="plabel"><ShieldCheck className="w-[12px] h-[12px]" /> Readiness System</div>
                <div className="flex flex-col gap-[6px] flex-1 justify-center">
                  {(() => {
                    const today = new Date();
                    const lastAccessed = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 1, 0, 0);
                    const nextAccess = new Date(lastAccessed.getTime() + 24 * 60 * 60 * 1000);
                    const fmtDate = (d) => {
                      const mm = String(d.getMonth() + 1).padStart(2, "0");
                      const dd = String(d.getDate()).padStart(2, "0");
                      const yy = d.getFullYear();
                      return `${mm}/${dd}/${yy} 01:00 AM`;
                    };
                    const items = [
                      { label: "URL", value: "readiness.cardiac-solutions.ai", icon: Link, color: "text-cyan-400", isLink: true },
                      { label: "User Name", value: "readiness_admin", icon: User, color: "text-slate-200" },
                      { label: "Password", value: "••••••••••", icon: Key, color: "text-slate-200" },
                      { label: "Daily Access Time", value: "1:00 AM", icon: CalendarClock, color: "text-cyan-400" },
                      { label: "Last Accessed", value: fmtDate(lastAccessed), icon: Clock, color: "text-green-400" },
                      { label: "Next Access", value: fmtDate(nextAccess), icon: CalendarClock, color: "text-yellow-400" },
                      { label: "Last Access Duration", value: "3 hrs", icon: Timer, color: "text-green-400" },
                    ];
                    return items.map((item, i) => {
                      const Icon = item.icon;
                      return (
                        <div key={i} className="flex items-center gap-[8px] px-[10px] py-[5px] bg-cyan-500/5 border border-cyan-500/15 rounded-sm" data-testid={`readiness-${item.label.toLowerCase().replace(/\s+/g, "-")}`}>
                          <div className="w-[24px] h-[24px] rounded-full border border-cyan-500/30 flex items-center justify-center flex-shrink-0">
                            <Icon className="w-[11px] h-[11px] text-cyan-400" />
                          </div>
                          <div className="flex items-center justify-between flex-1 min-w-0">
                            <div className="text-[7px] tracking-wider text-cyan-500/50 uppercase">{item.label}</div>
                            {item.isLink ? (
                              <button onClick={() => window.open(`https://${item.value}`, "_blank", "noopener,noreferrer")} className={`font-orbitron text-[9px] font-bold ${item.color} tracking-wider hover:underline truncate ml-[8px]`}>
                                {item.value}
                              </button>
                            ) : (
                              <div className={`font-orbitron text-[9px] font-bold ${item.color} tracking-wider truncate ml-[8px]`}>{item.value}</div>
                            )}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>

            {/* Server Resources */}
            <div className="panel relative p-[10px] bg-[rgba(0,18,32,0.93)] border border-cyan-500/30 overflow-hidden" data-testid="server-resources-panel">
              <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
              <div className="panel-glow" />
              <div className="plabel">Server Resources</div>

              <div className="grid grid-cols-4 gap-[6px] mb-[10px]">
                {[
                  { label: "CPU", value: serverStats.cpu, unit: "%", icon: Cpu, color: serverStats.cpu > 80 ? "red" : serverStats.cpu > 60 ? "yellow" : "green" },
                  { label: "Memory", value: serverStats.memory, unit: "%", icon: HardDrive, color: serverStats.memory > 80 ? "red" : serverStats.memory > 60 ? "yellow" : "cyan" },
                  { label: "Disk", value: serverStats.disk, unit: "%", icon: Database, color: "cyan" },
                  { label: "Uptime", value: serverStats.uptime, unit: "", icon: Clock, color: "green", isText: true },
                ].map((item, i) => {
                  const Icon = item.icon;
                  const colorMap = { green: "text-green-400", yellow: "text-yellow-400", red: "text-red-400", cyan: "text-cyan-400", orange: "text-orange-400" };
                  const glowMap = { green: "rgba(57,255,20,0.5)", yellow: "rgba(255,204,0,0.5)", red: "rgba(255,34,68,0.5)", cyan: "rgba(0,212,255,0.5)", orange: "rgba(255,107,53,0.5)" };
                  return (
                    <div key={i} className="flex flex-col items-center gap-[6px] py-[10px] bg-cyan-500/5 border border-cyan-500/15 rounded-sm">
                      <Icon className={`w-[14px] h-[14px] ${colorMap[item.color]}`} />
                      {item.isText ? (
                        <div className={`font-orbitron text-[11px] font-bold ${colorMap[item.color]}`}>{item.value}</div>
                      ) : (
                        <>
                          <div className="relative w-[50px] h-[50px]">
                            <svg className="w-full h-full -rotate-90" viewBox="0 0 50 50">
                              <circle cx="25" cy="25" r="20" fill="none" stroke="rgba(0,212,255,0.1)" strokeWidth="4" />
                              <circle cx="25" cy="25" r="20" fill="none" stroke={item.color === "green" ? "#39ff14" : item.color === "yellow" ? "#fbbf24" : item.color === "red" ? "#ff2244" : "#06b6d4"} strokeWidth="4" strokeLinecap="round"
                                strokeDasharray={`${item.value * 1.256} ${125.6 - item.value * 1.256}`} />
                            </svg>
                            <span className={`absolute inset-0 flex items-center justify-center font-orbitron text-[10px] font-black ${colorMap[item.color]}`}>
                              {item.value}{item.unit}
                            </span>
                          </div>
                        </>
                      )}
                      <div className="text-[7px] tracking-wider text-cyan-500/50 uppercase">{item.label}</div>
                    </div>
                  );
                })}
              </div>

              {/* Quick Stats Row */}
              <div className="grid grid-cols-3 gap-[6px]">
                {[
                  { label: "API Requests (24h)", value: serverStats.apiRequests24h.toLocaleString(), color: "text-cyan-400" },
                  { label: "Avg Response", value: serverStats.avgResponseTime, color: "text-green-400" },
                  { label: "DB Latency", value: serverStats.dbLatency, color: "text-green-400" },
                ].map((item, i) => (
                  <div key={i} className="flex flex-col items-center gap-[3px] py-[6px] bg-cyan-500/5 border border-cyan-500/15 rounded-sm">
                    <div className={`font-orbitron text-[13px] font-black ${item.color}`}>{item.value}</div>
                    <div className="text-[6px] tracking-wider text-cyan-500/50 uppercase text-center">{item.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Database Status */}
            <div className="panel relative p-[10px] bg-[rgba(0,18,32,0.93)] border border-cyan-500/30 overflow-hidden" data-testid="database-panel">
              <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
              <div className="panel-glow" />
              <div className="plabel">Database Status</div>
              <div className="grid grid-cols-2 gap-[6px]">
                {[
                  { label: "Status", value: serverStats.dbStatus, color: "text-green-400" },
                  { label: "Latency", value: serverStats.dbLatency, color: "text-green-400" },
                  { label: "Collections", value: "6", color: "text-cyan-400" },
                  { label: "Documents", value: "14.2K", color: "text-cyan-400" },
                  { label: "Storage", value: "128 MB", color: "text-cyan-400" },
                  { label: "Connections", value: "12 / 100", color: "text-green-400" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between px-[10px] py-[6px] bg-cyan-500/5 border border-cyan-500/10 rounded-sm">
                    <span className="text-[8px] tracking-wider text-cyan-500/50 uppercase">{item.label}</span>
                    <span className={`font-orbitron text-[10px] font-bold ${item.color}`}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Server Info from API */}
            {serverInfo && (
              <div className="panel relative p-[10px] bg-[rgba(0,18,32,0.93)] border border-cyan-500/30 overflow-hidden" data-testid="server-info-panel">
                <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
                <div className="panel-glow" />
                <div className="plabel">Runtime Info</div>
                <div className="grid grid-cols-2 gap-[4px]">
                  {[
                    { label: "Version", value: serverInfo.version },
                    { label: "Build", value: serverInfo.build },
                    { label: "Seed Done", value: serverInfo.seed_done ? "YES" : "NO" },
                    { label: "DB Init", value: serverInfo.db_initialized ? "YES" : "NO" },
                    ...Object.entries(serverInfo.packages || {}).map(([pkg, ver]) => ({
                      label: pkg, value: typeof ver === "string" ? ver.split(".").slice(0, 2).join(".") : ver,
                    })),
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between px-[8px] py-[4px] bg-cyan-500/5 border border-cyan-500/10 rounded-sm">
                      <span className="text-[7px] tracking-wider text-cyan-500/45 uppercase">{item.label}</span>
                      <span className="font-orbitron text-[8px] font-bold text-slate-200/80">{String(item.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN — Event Log */}
          <div className="flex flex-col gap-[7px]">
            <div className="panel relative p-[10px] bg-[rgba(0,18,32,0.93)] border border-cyan-500/30 overflow-hidden flex-1" data-testid="event-log-panel">
              <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
              <div className="panel-glow" />
              <div className="plabel">Event Log</div>
              <div className="flex flex-col gap-[4px] overflow-y-auto scrollbar-thin" style={{ maxHeight: "calc(100vh - 140px)" }}>
                {recentEvents.map((evt, i) => {
                  const borderColor = evt.type === "success" ? "border-l-green-400" : evt.type === "warn" ? "border-l-yellow-400" : "border-l-cyan-400";
                  const typeLabel = evt.type === "success" ? "OK" : evt.type === "warn" ? "WARN" : "INFO";
                  const typeBg = evt.type === "success" ? "bg-green-500/15 text-green-400" : evt.type === "warn" ? "bg-yellow-500/15 text-yellow-400" : "bg-cyan-500/15 text-cyan-400";
                  return (
                    <div key={i} className={`px-[8px] py-[7px] bg-cyan-500/5 border-l-2 ${borderColor}`}>
                      <div className="flex items-center justify-between mb-[3px]">
                        <span className={`font-orbitron text-[7px] font-bold px-[5px] py-[1px] rounded-sm ${typeBg} tracking-wider`}>{typeLabel}</span>
                        <span className="font-orbitron text-[7px] text-cyan-500/40 tracking-wider">{evt.time}</span>
                      </div>
                      <div className="text-[9px] text-slate-200/85 leading-relaxed">{evt.event}</div>
                      {evt.count !== null && (
                        <div className="font-orbitron text-[8px] font-bold text-cyan-400 mt-[2px]">{evt.count} items</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;700;900&family=Share+Tech+Mono&display=swap');

        .backend-mgmt {
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

        .scrollbar-thin::-webkit-scrollbar { width: 10px; height: 10px; }
        .scrollbar-thin::-webkit-scrollbar-track { background: #0a0f1c; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: #ff2244; border-radius: 5px; }
        .scrollbar-thin::-webkit-scrollbar-thumb:hover { background: #ff4466; }
      `}</style>
    </div>
  );
}
