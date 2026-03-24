import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  Bell,
  FileCheck,
  Lightbulb,
  LayoutDashboard,
  LogOut,
  BookOpen,
  Headphones,
} from "lucide-react";

const modules = [
  {
    id: 1,
    title: "DAILY REPORT",
    status: "LIVE",
    icon: Activity,
    route: "/daily-report",
    description:
      "Real-time AED fleet status across all subscribers. AI-analyzed device health, trends and status breakdowns.",
    badgeCount: null,
  },
  {
    id: 2,
    title: "NOTIFICATIONS",
    status: "LIVE",
    icon: Bell,
    route: "/notifications",
    description:
      "Subscriber issue alerts and email dispatch console. Track sent notifications and actionable AED events.",
    badgeCount: 16,
  },
  {
    id: 3,
    title: "SERVICE TICKETS",
    status: "IN DEV",
    icon: FileCheck,
    route: null,
    description:
      "Field technician dispatch, ticket lifecycle management, and AED service workflow from open to confirmed.",
    badgeCount: null,
  },
  {
    id: 4,
    title: "SURVIVAL PATH",
    status: "IN DEV",
    icon: Lightbulb,
    route: null,
    description:
      "Cardiac event outcome tracking, response analytics, and chain-of-survival documentation per incident.",
    badgeCount: null,
  },
  {
    id: 5,
    title: "DASHBOARD",
    status: "LIVE",
    icon: LayoutDashboard,
    route: "/dashboard",
    description:
      "Comprehensive AED monitoring dashboard with system status, service summary, AI recommendations, and voice query.",
    badgeCount: null,
  },
];

function ModuleCard({ module, index, onNavigate }) {
  const Icon = module.icon;
  const isLive = module.status === "LIVE";
  const statusColor = isLive ? "#22c55e" : "#eab308";

  return (
    <motion.div
      data-testid={`module-card-${module.id}`}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 + index * 0.1, duration: 0.5 }}
      onClick={() => isLive && module.route && onNavigate(module.route)}
      className="relative group"
      style={{
        cursor: isLive ? "pointer" : "not-allowed",
        opacity: isLive ? 1 : 0.6,
      }}
    >
      <div
        className="relative overflow-hidden rounded-sm border transition-all duration-300"
        style={{
          background: "rgba(10, 15, 28, 0.85)",
          borderColor: isLive
            ? "rgba(6, 182, 212, 0.15)"
            : "rgba(148, 163, 184, 0.1)",
          minHeight: "260px",
        }}
      >
        {/* Grid overlay on card */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(rgba(148,163,184,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.03) 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        />

        {/* Hover glow */}
        {isLive && (
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse at center, rgba(6, 182, 212, 0.06) 0%, transparent 70%)",
            }}
          />
        )}

        <div className="relative p-6 flex flex-col h-full">
          {/* Status badge */}
          <div className="flex justify-between items-start mb-6">
            <span
              className="font-tech text-[10px] tracking-[0.2em] px-2.5 py-0.5 rounded-sm"
              style={{
                color: statusColor,
                background: isLive
                  ? "rgba(34, 197, 94, 0.1)"
                  : "rgba(234, 179, 8, 0.1)",
                border: `1px solid ${isLive ? "rgba(34, 197, 94, 0.3)" : "rgba(234, 179, 8, 0.3)"}`,
              }}
            >
              {module.status}
            </span>
          </div>

          {/* Icon */}
          <div className="mb-5 relative">
            <Icon
              size={38}
              strokeWidth={1.4}
              style={{ color: "#06b6d4" }}
            />
            {module.badgeCount && (
              <span
                className="absolute -top-1.5 -right-1 font-tech text-[10px] min-w-[18px] h-[18px] flex items-center justify-center rounded-full"
                style={{
                  background: "#ef4444",
                  color: "#fff",
                  left: "32px",
                  right: "auto",
                }}
              >
                {module.badgeCount}
              </span>
            )}
          </div>

          {/* Module number */}
          <p
            className="font-tech text-[11px] tracking-[0.15em] mb-1.5"
            style={{ color: "#06b6d4" }}
          >
            MODULE #{module.id}
          </p>

          {/* Title */}
          <h3
            className="font-tech text-lg tracking-wide mb-3"
            style={{ color: "#f1f5f9", fontWeight: 600 }}
          >
            {module.title}
          </h3>

          {/* Description */}
          <p
            className="text-[13px] leading-relaxed"
            style={{ color: "#94a3b8" }}
          >
            {module.description}
          </p>
        </div>

        {/* Bottom hover bar */}
        {isLive && (
          <div
            className="absolute bottom-0 left-0 right-0 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            style={{
              background:
                "linear-gradient(90deg, transparent, #06b6d4, transparent)",
            }}
          />
        )}
      </div>
    </motion.div>
  );
}

export default function CommandCenterHub({ user, onLogout }) {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const operatorName = user?.username?.toUpperCase() || "ADMIN";

  return (
    <div
      data-testid="command-center-hub"
      className="min-h-screen flex flex-col"
      style={{ background: "#020617" }}
    >
      {/* Grid background */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(148,163,184,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.04) 1px, transparent 1px)",
          backgroundSize: "50px 50px",
        }}
      />

      {/* HEADER */}
      <header
        data-testid="hub-header"
        className="relative z-10 flex items-center justify-between px-8 py-5 border-b"
        style={{ borderColor: "rgba(148, 163, 184, 0.08)" }}
      >
        {/* Left - Branding */}
        <div className="flex items-center gap-3">
          {/* Heartbeat icon */}
          <svg
            width="32"
            height="32"
            viewBox="0 0 32 32"
            fill="none"
            className="flex-shrink-0"
          >
            <path
              d="M4 17 L10 17 L13 10 L16 24 L19 14 L22 17 L28 17"
              stroke="#ef4444"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
          <div>
            <h1
              className="font-tech text-base tracking-[0.1em] leading-none"
              style={{ color: "#f1f5f9", fontWeight: 700 }}
            >
              CARDIAC SOLUTIONS
            </h1>
            <p
              className="font-tech text-[10px] tracking-[0.15em] mt-0.5"
              style={{ color: "#06b6d4" }}
            >
              AED MONITORING COMMAND CENTER
            </p>
          </div>
        </div>

        {/* Right - Status & Operator */}
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full"
              style={{
                background: "#22c55e",
                boxShadow: "0 0 6px rgba(34,197,94,0.6)",
              }}
            />
            <span
              className="font-tech text-[11px] tracking-[0.12em]"
              style={{ color: "#06b6d4" }}
              data-testid="system-status"
            >
              SYSTEM ONLINE
            </span>
          </div>
          <div
            className="px-3 py-1 rounded-sm border font-tech text-[11px] tracking-[0.1em]"
            style={{
              borderColor: "rgba(148, 163, 184, 0.2)",
              color: "#e2e8f0",
            }}
            data-testid="operator-badge"
          >
            OPERATOR: {operatorName}
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-8 py-10">
        {/* Title block */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          {/* Red line + SELECT MODULE */}
          <div className="flex flex-col items-center mb-4">
            <div
              className="w-12 h-[1px] mb-2"
              style={{ background: "#ef4444" }}
            />
            <span
              className="font-tech text-[11px] tracking-[0.2em]"
              style={{ color: "#ef4444" }}
            >
              SELECT MODULE
            </span>
          </div>

          {/* COMMAND CENTER HUB */}
          <h2
            className="font-tech text-4xl sm:text-5xl tracking-[0.08em] mb-3"
            style={{ fontWeight: 700, lineHeight: 1.1 }}
          >
            <span style={{ color: "#f1f5f9" }}>COMMAND </span>
            <span style={{ color: "#ef4444" }}>CENTER </span>
            <span style={{ color: "#f1f5f9" }}>HUB</span>
          </h2>

          {/* Subtitle */}
          <p
            className="font-tech text-[11px] tracking-[0.18em]"
            style={{ color: "#06b6d4" }}
          >
            CARDIAC SOLUTIONS, LLC — INTEGRATED AED OPERATIONS PLATFORM
          </p>
        </motion.div>

        {/* AVAILABLE MODULES label */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="w-full max-w-[1200px] mb-6"
        >
          <p
            className="font-tech text-sm tracking-[0.12em]"
            style={{ color: "#e2e8f0" }}
          >
            AVAILABLE MODULES
          </p>
        </motion.div>

        {/* Module cards grid */}
        <div
          className="w-full max-w-[1200px] grid gap-5"
          style={{
            gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          }}
        >
          {modules.map((mod, i) => (
            <ModuleCard
              key={mod.id}
              module={mod}
              index={i}
              onNavigate={navigate}
            />
          ))}
        </div>
      </main>

      {/* FOOTER */}
      <footer
        data-testid="hub-footer"
        className="relative z-10 flex items-center justify-between px-8 py-4 border-t"
        style={{ borderColor: "rgba(148, 163, 184, 0.08)" }}
      >
        <div className="flex items-center gap-4">
          <span
            className="font-tech text-[10px] tracking-[0.1em]"
            style={{ color: "#64748b" }}
          >
            &copy; 2026 CARDIAC SOLUTIONS, LLC
          </span>
          <span
            className="font-tech text-[10px] tracking-[0.1em]"
            style={{ color: "#475569" }}
          >
            V2.1.0
          </span>
        </div>
        <div className="flex items-center gap-6">
          <button
            className="font-tech text-[10px] tracking-[0.12em] flex items-center gap-1.5 hover:opacity-80 transition-opacity"
            style={{ color: "#94a3b8" }}
            data-testid="footer-documentation"
          >
            <BookOpen size={12} />
            DOCUMENTATION
          </button>
          <button
            className="font-tech text-[10px] tracking-[0.12em] flex items-center gap-1.5 hover:opacity-80 transition-opacity"
            style={{ color: "#94a3b8" }}
            data-testid="footer-support"
          >
            <Headphones size={12} />
            SUPPORT
          </button>
          <button
            onClick={onLogout}
            className="font-tech text-[10px] tracking-[0.12em] flex items-center gap-1.5 hover:opacity-80 transition-opacity"
            style={{ color: "#ef4444" }}
            data-testid="footer-logout"
          >
            <LogOut size={12} />
            LOGOUT
          </button>
        </div>
      </footer>
    </div>
  );
}
