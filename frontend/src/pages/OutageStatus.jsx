import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  LogOut,
  ExternalLink,
  Cloud,
  Wifi,
  Radio,
  Shield,
  Server,
  Globe,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from "lucide-react";

const STATUS_CONFIG = {
  operational: { label: "OPERATIONAL", color: "text-green-400", bg: "bg-green-500/15", border: "border-l-green-400", dot: "bg-green-400", glow: "rgba(57,255,20,0.6)" },
  degraded: { label: "DEGRADED", color: "text-yellow-400", bg: "bg-yellow-500/15", border: "border-l-yellow-400", dot: "bg-yellow-400", glow: "rgba(255,204,0,0.6)" },
  outage: { label: "OUTAGE", color: "text-red-400", bg: "bg-red-500/15", border: "border-l-red-500", dot: "bg-red-500", glow: "rgba(255,34,68,0.6)" },
  maintenance: { label: "MAINTENANCE", color: "text-cyan-400", bg: "bg-cyan-500/15", border: "border-l-cyan-400", dot: "bg-cyan-400", glow: "rgba(0,212,255,0.6)" },
};

const SERVICE_CATEGORIES = [
  {
    category: "Cloud & CDN Services",
    icon: Cloud,
    services: [
      { name: "Cloudflare", status: "operational", url: "https://www.cloudflarestatus.com", description: "CDN, DDoS Protection, DNS" },
      { name: "AWS", status: "operational", url: "https://health.aws.amazon.com/health/status", description: "Cloud Infrastructure" },
      { name: "Microsoft Azure", status: "operational", url: "https://status.azure.com", description: "Cloud Platform" },
      { name: "Google Cloud", status: "operational", url: "https://status.cloud.google.com", description: "Cloud Services" },
      { name: "MongoDB Atlas", status: "operational", url: "https://status.cloud.mongodb.com", description: "Database Hosting" },
    ],
  },
  {
    category: "Cellular Carriers",
    icon: Radio,
    services: [
      { name: "AT&T", status: "operational", url: "https://downdetector.com/status/att/", description: "Cellular Network" },
      { name: "Verizon", status: "operational", url: "https://downdetector.com/status/verizon/", description: "Cellular Network" },
      { name: "T-Mobile", status: "operational", url: "https://downdetector.com/status/t-mobile/", description: "Cellular Network" },
      { name: "US Cellular", status: "operational", url: "https://downdetector.com/status/us-cellular/", description: "Cellular Network" },
    ],
  },
  {
    category: "Communication & Email",
    icon: Globe,
    services: [
      { name: "Twilio", status: "operational", url: "https://status.twilio.com", description: "SMS & Voice" },
      { name: "SendGrid", status: "operational", url: "https://status.sendgrid.com", description: "Email Delivery" },
      { name: "Resend", status: "operational", url: "https://resend-status.com", description: "Email API" },
    ],
  },
  {
    category: "Security & Auth",
    icon: Shield,
    services: [
      { name: "Auth0", status: "operational", url: "https://status.auth0.com", description: "Identity & Auth" },
      { name: "Let's Encrypt", status: "operational", url: "https://letsencrypt.status.io", description: "SSL Certificates" },
    ],
  },
  {
    category: "Internal Services",
    icon: Server,
    services: [
      { name: "Cardiac Solutions API", status: "operational", url: null, description: "Backend API Server" },
      { name: "Camera Ingest Pipeline", status: "operational", url: null, description: "Camera Data Processing" },
      { name: "Notification Engine", status: "operational", url: null, description: "Alert Dispatch System" },
      { name: "SSO Gateway", status: "operational", url: null, description: "Cross-Domain Auth" },
    ],
  },
];

function ServiceRow({ service }) {
  const cfg = STATUS_CONFIG[service.status];
  const StatusIcon = service.status === "operational" ? CheckCircle2 : service.status === "degraded" ? AlertTriangle : XCircle;

  return (
    <div
      className={`flex items-center justify-between px-[12px] py-[9px] bg-cyan-500/5 border-l-2 ${cfg.border} hover:bg-cyan-500/8 transition-colors ${service.url ? "cursor-pointer" : ""}`}
      onClick={() => service.url && window.open(service.url, "_blank", "noopener,noreferrer")}
      data-testid={`service-${service.name.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div className="flex items-center gap-[10px] flex-1">
        <span className={`w-[6px] h-[6px] rounded-full ${cfg.dot}`} style={{ boxShadow: `0 0 6px ${cfg.glow}` }} />
        <div className="flex flex-col">
          <span className="text-[10px] text-slate-200/90 tracking-wider font-bold">{service.name}</span>
          <span className="text-[7px] text-cyan-500/40 tracking-wider">{service.description}</span>
        </div>
      </div>
      <div className="flex items-center gap-[8px]">
        <span className={`font-orbitron text-[7px] font-bold px-[7px] py-[3px] rounded-sm ${cfg.bg} ${cfg.color} tracking-wider`}>
          {cfg.label}
        </span>
        {service.url && <ExternalLink className="w-[10px] h-[10px] text-cyan-500/30" />}
      </div>
    </div>
  );
}

function CategoryPanel({ category }) {
  const Icon = category.icon;
  const allOperational = category.services.every((s) => s.status === "operational");
  const hasOutage = category.services.some((s) => s.status === "outage");
  const overallColor = hasOutage ? "text-red-400" : allOperational ? "text-green-400" : "text-yellow-400";
  const overallLabel = hasOutage ? "ISSUES DETECTED" : allOperational ? "ALL OPERATIONAL" : "DEGRADED";

  return (
    <div className="panel relative p-[10px] bg-[rgba(0,18,32,0.93)] border border-cyan-500/30 overflow-hidden" data-testid={`category-${category.category.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
      <div className="panel-glow" />
      <div className="flex items-center justify-between mb-[10px]">
        <div className="plabel mb-0 flex-1">
          <Icon className="w-[12px] h-[12px]" />
          {category.category}
        </div>
        <span className={`font-orbitron text-[7px] font-bold tracking-wider ${overallColor}`}>{overallLabel}</span>
      </div>
      <div className="flex flex-col gap-[4px]">
        {category.services.map((svc, i) => (
          <ServiceRow key={i} service={svc} />
        ))}
      </div>
    </div>
  );
}

export default function OutageStatus({ user, onLogout }) {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date) => date.toTimeString().slice(0, 8);
  const formatDate = (date) => {
    const days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
    const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    return `${days[date.getDay()]}  ${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };

  const totalServices = SERVICE_CATEGORIES.reduce((sum, c) => sum + c.services.length, 0);
  const operationalCount = SERVICE_CATEGORIES.reduce((sum, c) => sum + c.services.filter((s) => s.status === "operational").length, 0);
  const degradedCount = SERVICE_CATEGORIES.reduce((sum, c) => sum + c.services.filter((s) => s.status === "degraded").length, 0);
  const outageCount = SERVICE_CATEGORIES.reduce((sum, c) => sum + c.services.filter((s) => s.status === "outage").length, 0);

  return (
    <div className="outage-page min-h-screen text-cyan-400 font-mono text-[11px] relative" data-testid="outage-status-page">
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
              <div className="font-orbitron text-[13px] font-black tracking-[0.25em] text-red-500 animate-logo-pulse">
                OUTAGE STATUS
              </div>
              <div className="font-orbitron text-[9px] font-bold tracking-[0.2em] text-cyan-400">
                EXTERNAL SERVICE MONITOR
              </div>
            </div>
          </div>
          <div className="flex gap-[18px] items-center text-[9px] tracking-wider">
            <span className="flex items-center gap-1">
              <span className="w-[5px] h-[5px] rounded-full bg-green-400 animate-blink" />
              {operationalCount}/{totalServices} OPERATIONAL
            </span>
            {degradedCount > 0 && (
              <>
                <span>|</span>
                <span className="text-yellow-400">{degradedCount} DEGRADED</span>
              </>
            )}
            {outageCount > 0 && (
              <>
                <span>|</span>
                <span className="text-red-400">{outageCount} OUTAGE</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end gap-[2px]">
              <div className="font-orbitron text-[13px] font-bold tracking-wider">{formatTime(currentTime)}</div>
              <div className="font-orbitron text-[10px] tracking-[0.12em] text-cyan-500/65">{formatDate(currentTime)}</div>
            </div>
            <button onClick={onLogout} className="text-red-500 hover:text-red-400 transition-colors" data-testid="outage-logout-btn">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Summary Bar */}
        <div className="flex gap-[7px] px-[10px] pt-[10px]">
          {[
            { label: "Total\nMonitored", value: totalServices, color: "text-cyan-400" },
            { label: "Operational", value: operationalCount, color: "text-green-400", glow: "rgba(57,255,20,0.45)" },
            { label: "Degraded", value: degradedCount, color: "text-yellow-400", glow: "rgba(255,204,0,0.45)" },
            { label: "Outage", value: outageCount, color: "text-red-400", glow: "rgba(255,34,68,0.45)" },
          ].map((item, i) => (
            <div key={i} className="flex-1 flex items-center justify-center gap-[10px] px-[8px] py-[7px] border border-cyan-500/30 bg-[rgba(0,18,32,0.93)] relative overflow-hidden">
              <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/10 to-transparent" />
              <div className="w-[40px] h-[40px] rounded-full border border-cyan-500/30 flex items-center justify-center relative flex-shrink-0">
                <div className="absolute inset-[4px] rounded-full border border-cyan-500/15" />
                <span className={`font-orbitron text-[18px] font-black ${item.color}`} style={{ textShadow: item.glow ? `0 0 10px ${item.glow}` : "0 0 8px rgba(0,212,255,0.35)" }}>
                  {item.value}
                </span>
              </div>
              <div className="text-[7px] tracking-[0.13em] text-cyan-500/50 uppercase leading-[1.5] whitespace-pre-line">{item.label}</div>
            </div>
          ))}
        </div>

        {/* Service Categories */}
        <div className="flex-1 p-[10px] grid grid-cols-2 gap-[7px] auto-rows-min">
          {SERVICE_CATEGORIES.map((cat, i) => (
            <CategoryPanel key={i} category={cat} />
          ))}
        </div>
      </div>

      <style jsx>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;700;900&family=Share+Tech+Mono&display=swap');

        .outage-page {
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
      `}</style>
    </div>
  );
}
