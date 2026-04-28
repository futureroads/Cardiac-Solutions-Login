import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Send, X, Trash2, Loader2, Settings,
  AlertTriangle, Clock, ChevronDown, ChevronUp, Mail,
  Users, Activity, Shield, History, Battery, Wifi,
  StickyNote, ZoomIn, ChevronLeft, Edit3, RefreshCw,
  CheckCircle2, AlertCircle, BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import API_BASE from "@/apiBase";

const API = API_BASE + "/api";

function TrendIndicator({ value, prev }) {
  // Up red if today > yesterday; Down green if today < yesterday; Blue dash if same; nothing if prev is null
  if (prev == null || value == null) return null;
  if (value > prev) {
    // up-right (45deg) red — using SVG so we can rotate exactly 45deg
    return (
      <span title={`+${value - prev} since yesterday (was ${prev})`} className="inline-flex">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M2 10 L10 2 M10 2 L4.5 2 M10 2 L10 7.5" stroke="#ef4444" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  if (value < prev) {
    // down-right (135deg) green
    return (
      <span title={`-${prev - value} since yesterday (was ${prev})`} className="inline-flex">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M2 2 L10 10 M10 10 L4.5 10 M10 10 L10 4.5" stroke="#22c55e" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  return (
    <span title={`No change since yesterday (${prev})`} className="inline-flex">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <path d="M2 6 L10 6" stroke="#38bdf8" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </span>
  );
}

function StatCard({ value, label, color, icon: Icon, onClick, active, notified, prev }) {
  const pct = value > 0 && notified != null ? Math.min(100, Math.round((notified / value) * 100)) : 0;
  const allDone = value > 0 && notified != null && notified >= value;
  return (
    <div
      onClick={onClick}
      className={`border rounded-sm p-4 min-w-[130px] cursor-pointer transition-all ${allDone ? "border-green-500/50 bg-[rgba(34,197,94,0.08)]" : active ? "border-current ring-1 ring-current bg-[rgba(10,15,28,1)]" : "border-slate-700/50 bg-[rgba(10,15,28,0.85)] hover:border-slate-600"}`}
      style={active && !allDone ? { borderColor: color, boxShadow: `0 0 12px ${color}22` } : allDone ? { boxShadow: "0 0 12px rgba(34,197,94,0.15)" } : {}}
    >
      <div className="absolute" />
      <div className="flex items-center justify-between mb-1">
        <TrendIndicator value={value} prev={prev} />
        {Icon && <Icon className="w-4 h-4 opacity-60" style={{ color }} />}
      </div>
      <div className="font-orbitron text-2xl font-black" style={{ color }}>{value}</div>
      <div className="font-orbitron text-[7px] tracking-wider text-slate-400 mt-1.5 uppercase">{label}</div>
      {notified != null && value > 0 && (
        <div className="mt-2">
          <div className="h-[3px] rounded-full bg-slate-800 overflow-hidden">
            <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <div className="font-orbitron text-[10px] tracking-wider mt-1">
            <span className="text-green-400 font-bold">{notified}</span>
            <span className="text-slate-500">/{value} NOTIFIED</span>
          </div>
        </div>
      )}
    </div>
  );
}

function DeviceDrawer({ device, onClose }) {
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API}/support/device-notes/${encodeURIComponent(device.sentinel_id)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setNotes(data.notes || "");
        }
      } catch {}
      setLoaded(true);
    })();
  }, [device.sentinel_id]);

  const saveNotes = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      await fetch(`${API}/support/device-notes/${encodeURIComponent(device.sentinel_id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ notes }),
      });
      toast.success("Notes saved");
    } catch { toast.error("Failed to save notes"); }
    setSaving(false);
  };

  const loc = [device.site, device.building, device.placement].filter(Boolean).join(" / ") || "—";
  const capturedAt = device.captured_at ? new Date(device.captured_at).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "—";
  const battColor = (device.battery_level_pct ?? 0) > 50 ? "#22c55e" : (device.battery_level_pct ?? 0) > 20 ? "#f59e0b" : "#ef4444";
  const sigColor = device.cellular_signal_quality === "HIGH" ? "#22c55e" : device.cellular_signal_quality === "MEDIUM" ? "#f59e0b" : "#ef4444";

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex justify-end" onClick={onClose}>
      <div className="bg-[#0a0f1c] border-l border-cyan-500/30 w-[520px] max-w-[95vw] h-full flex flex-col overflow-hidden" onClick={e => e.stopPropagation()} data-testid="device-drawer">
        {/* Header */}
        <div className="p-4 border-b border-cyan-500/15 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button onClick={onClose} className="text-slate-500 hover:text-cyan-400"><ChevronLeft className="w-5 h-5" /></button>
              <div>
                <div className="font-orbitron text-sm text-cyan-400 tracking-wider">{device.sentinel_id}</div>
                <div className="text-[9px] text-slate-500 font-orbitron">{device.model || "AED Device"}</div>
              </div>
            </div>
            <button onClick={onClose} className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Camera Image */}
          <div>
            <div className="font-orbitron text-[8px] text-slate-500 tracking-wider mb-2">CAMERA IMAGE</div>
            {device.image_url ? (
              <div className="border border-slate-700/50 rounded-sm overflow-hidden bg-black">
                <img src={device.image_url} alt={device.sentinel_id} className="w-full object-contain max-h-[300px]" />
                <div className="px-3 py-1.5 bg-slate-900/80 text-[9px] text-slate-400 font-orbitron flex justify-between">
                  <span>Captured: {capturedAt}</span>
                  <span>Last seen: {device.last_seen_date || "—"}</span>
                </div>
              </div>
            ) : (
              <div className="border border-slate-700/50 rounded-sm p-8 text-center text-slate-500 text-xs">No image available</div>
            )}
          </div>

          {/* Device Info Grid */}
          <div>
            <div className="font-orbitron text-[8px] text-slate-500 tracking-wider mb-2">DEVICE DETAILS</div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "SERIAL NUMBER", value: device.sentinel_id },
                { label: "STATUS", value: device.detailed_status || "—", color: device.detailed_status === "READY" ? "#22c55e" : "#ef4444" },
                { label: "LOCATION", value: loc, span: true },
                { label: "MODEL", value: device.model || "—", span: true },
                { label: "BATTERY EXPIRATION", value: device.battery_expiration || "—" },
                { label: "PAD EXPIRATION", value: device.pad_expiration || "—" },
              ].map((item, i) => (
                <div key={i} className={`border border-slate-700/40 bg-slate-900/50 rounded-sm p-2.5 ${item.span ? "col-span-2" : ""}`}>
                  <div className="font-orbitron text-[7px] text-slate-500 tracking-wider">{item.label}</div>
                  <div className="text-xs text-white mt-0.5" style={item.color ? { color: item.color } : {}}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Battery & Signal */}
          <div>
            <div className="font-orbitron text-[8px] text-slate-500 tracking-wider mb-2">DIAGNOSTICS</div>
            <div className="grid grid-cols-2 gap-2">
              <div className="border border-slate-700/40 bg-slate-900/50 rounded-sm p-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <Battery className="w-3 h-3" style={{ color: battColor }} />
                  <span className="font-orbitron text-[7px] text-slate-500 tracking-wider">BATTERY LEVEL</span>
                </div>
                <div className="font-orbitron text-lg font-bold" style={{ color: battColor }}>{device.battery_level_pct != null ? `${device.battery_level_pct}%` : "—"}</div>
              </div>
              <div className="border border-slate-700/40 bg-slate-900/50 rounded-sm p-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <Wifi className="w-3 h-3" style={{ color: sigColor }} />
                  <span className="font-orbitron text-[7px] text-slate-500 tracking-wider">SIGNAL</span>
                </div>
                <div className="font-orbitron text-lg font-bold" style={{ color: sigColor }}>{device.cellular_signal_label || device.cellular_signal_quality || "—"}</div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <StickyNote className="w-3 h-3 text-amber-400" />
              <span className="font-orbitron text-[8px] text-slate-500 tracking-wider">NOTES</span>
            </div>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add notes about this device..."
              className="w-full px-3 py-2 rounded-sm bg-slate-900 border border-slate-700 text-white text-xs placeholder-slate-600 resize-none h-24"
              data-testid="device-notes-input"
            />
            <button
              onClick={saveNotes}
              disabled={saving || !loaded}
              className="mt-2 font-orbitron text-[8px] px-4 py-1.5 border border-cyan-500/40 text-cyan-400 rounded-sm hover:bg-cyan-500/10 disabled:opacity-50 flex items-center gap-1.5"
              data-testid="save-notes-btn"
            >
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <StickyNote className="w-3 h-3" />}
              SAVE NOTES
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TrackingTestModal({ onClose }) {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [historyId, setHistoryId] = useState(null);
  const [record, setRecord] = useState(null);
  const [polling, setPolling] = useState(false);
  const [pollCount, setPollCount] = useState(0);
  const [error, setError] = useState("");

  const send = async () => {
    if (!email) { toast.error("Enter an email"); return; }
    setSending(true); setError("");
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/support/test-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ to_email: email }),
      });
      const d = await res.json();
      if (d.success) {
        toast.success(d.message);
        if (d.history_id) {
          setHistoryId(d.history_id);
          setPolling(true);
          setRecord({ subscriber: "[Test Email]", to_email: email, sg_message_id: d.sg_message_id, events: [] });
        } else {
          setError("Email sent but no history record was created — webhook tracking will not be visible.");
        }
      } else {
        setError(d.message || "Failed to send test email");
        toast.error(d.message || "Failed");
      }
    } catch (err) {
      setError(String(err)); toast.error("Failed to send test email");
    }
    setSending(false);
  };

  // Poll the notification record for events every 3s while modal open
  useEffect(() => {
    if (!polling || !historyId) return;
    const t = setInterval(async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API}/support/notification-history/${historyId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const d = await res.json();
          setRecord(d);
          setPollCount((n) => n + 1);
        }
      } catch {}
    }, 3000);
    return () => clearInterval(t);
  }, [polling, historyId]);

  const fmt = (iso) => iso ? new Date(iso).toLocaleString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" }) : "—";
  const events = (record && record.events) || [];
  const delivered = !!(record && record.delivered_at);
  const opens = (record && record.open_count) || 0;
  const clicks = (record && record.click_count) || 0;
  const bounced = !!(record && record.bounced);

  return (
    <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#0a0f1c] border border-cyan-500/30 rounded-sm w-full max-w-2xl max-h-[88vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-cyan-500/15 px-5 py-3 flex items-center justify-between bg-[rgba(6,10,20,0.95)]">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-green-400" />
            <div className="font-orbitron text-xs tracking-wider text-green-400">EMAIL TRACKING DIAGNOSTIC</div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white" data-testid="tracking-test-close"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Step 1: address */}
          <div>
            <div className="font-orbitron text-[8px] text-slate-500 tracking-[0.2em] uppercase mb-1.5">Step 1 — Recipient</div>
            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@cardiac-solutions.ai"
                disabled={!!historyId}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-sm px-3 py-2 text-white text-[12px] placeholder-slate-600 focus:border-cyan-500/40 focus:outline-none disabled:opacity-50"
                data-testid="tracking-test-email"
              />
              <button
                onClick={send}
                disabled={sending || !!historyId}
                className="font-orbitron text-[10px] px-4 bg-green-500/15 text-green-400 border border-green-500/30 rounded-sm hover:bg-green-500/25 disabled:opacity-50 flex items-center gap-1.5"
                data-testid="tracking-test-send"
              >
                {sending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                {historyId ? "SENT" : "SEND TEST"}
              </button>
            </div>
            {error && <div className="mt-2 text-[10px] text-red-400">{error}</div>}
          </div>

          {/* Step 2: instructions */}
          {historyId && (
            <>
              <div className="border-t border-slate-800/60 pt-4">
                <div className="font-orbitron text-[8px] text-slate-500 tracking-[0.2em] uppercase mb-1.5">Step 2 — Open the email</div>
                <div className="text-[11px] text-slate-400 leading-relaxed">
                  Check your inbox at <span className="text-cyan-400 font-bold">{email}</span>. Open the message, then click the cyan
                  <span className="text-cyan-400 font-bold"> "Click to verify CLICK tracking"</span> button inside it. Events arrive in
                  ~5–30 seconds.
                </div>
              </div>

              {/* Live tracking dashboard */}
              <div className="border-t border-slate-800/60 pt-4">
                <div className="font-orbitron text-[8px] text-slate-500 tracking-[0.2em] uppercase mb-2 flex items-center gap-2">
                  Step 3 — Live Tracking
                  <span className="text-cyan-400/70 normal-case tracking-normal text-[10px]">polling every 3s · {pollCount} updates</span>
                </div>
                <div className="grid grid-cols-4 gap-2 mb-3">
                  <div className={`rounded-sm border px-3 py-2 text-center ${historyId ? "border-cyan-500/40 bg-cyan-500/10" : "border-slate-700 bg-slate-900/40"}`}>
                    <div className="font-orbitron text-[8px] text-slate-400">SENT</div>
                    <div className={`font-orbitron text-base font-bold ${historyId ? "text-cyan-400" : "text-slate-600"}`}>{historyId ? "✓" : "—"}</div>
                  </div>
                  <div className={`rounded-sm border px-3 py-2 text-center ${delivered ? "border-cyan-500/40 bg-cyan-500/10" : "border-slate-700 bg-slate-900/40"}`}>
                    <div className="font-orbitron text-[8px] text-slate-400">DELIVERED</div>
                    <div className={`font-orbitron text-base font-bold ${delivered ? "text-cyan-400" : "text-slate-600"}`}>{delivered ? "✓" : "…"}</div>
                  </div>
                  <div className={`rounded-sm border px-3 py-2 text-center ${opens > 0 ? "border-emerald-500/40 bg-emerald-500/10" : "border-slate-700 bg-slate-900/40"}`}>
                    <div className="font-orbitron text-[8px] text-slate-400">OPENED</div>
                    <div className={`font-orbitron text-base font-bold ${opens > 0 ? "text-emerald-400" : "text-slate-600"}`}>{opens > 0 ? `×${opens}` : "…"}</div>
                  </div>
                  <div className={`rounded-sm border px-3 py-2 text-center ${clicks > 0 ? "border-amber-500/40 bg-amber-500/10" : "border-slate-700 bg-slate-900/40"}`}>
                    <div className="font-orbitron text-[8px] text-slate-400">CLICKED</div>
                    <div className={`font-orbitron text-base font-bold ${clicks > 0 ? "text-amber-400" : "text-slate-600"}`}>{clicks > 0 ? `×${clicks}` : "…"}</div>
                  </div>
                </div>
                {bounced && (
                  <div className="rounded-sm border border-red-500/40 bg-red-500/10 px-3 py-2 mb-3">
                    <div className="font-orbitron text-[9px] text-red-400 font-bold">BOUNCED</div>
                    <div className="text-[10px] text-red-300/80">{record.bounce_reason || "Email rejected by recipient mail server"}</div>
                  </div>
                )}
                <div className="font-orbitron text-[8px] text-slate-500 tracking-wider mb-1.5 uppercase">Event log</div>
                <div className="bg-slate-950 border border-slate-800 rounded-sm max-h-48 overflow-y-auto p-2 space-y-1">
                  {events.length === 0 ? (
                    <div className="text-[10px] text-slate-600 italic px-1.5 py-1">Waiting for SendGrid webhook events…</div>
                  ) : (
                    [...events].reverse().map((ev, i) => (
                      <div key={i} className="flex items-baseline gap-2 text-[10px] font-mono">
                        <span className="text-slate-500 w-20">{fmt(ev.timestamp)}</span>
                        <span className={`font-bold uppercase ${
                          ev.event === "delivered" ? "text-cyan-400" :
                          ev.event === "open" ? "text-emerald-400" :
                          ev.event === "click" ? "text-amber-400" :
                          ev.event === "bounce" || ev.event === "dropped" || ev.event === "blocked" ? "text-red-400" :
                          "text-slate-400"
                        }`}>{ev.event}</span>
                        <span className="text-slate-400 truncate">{ev.url || ev.reason || ev.useragent || ""}</span>
                      </div>
                    ))
                  )}
                </div>
                {record && record.sg_message_id && (
                  <div className="mt-2 text-[9px] text-slate-600 font-mono break-all">msg-id: {record.sg_message_id}</div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SendGridDebugModal({ onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const load = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/support/sendgrid-debug`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setData(await res.json());
    } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const fmt = (iso) => iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit" }) : "—";
  const events = (data && data.recent_events) || [];
  const histories = (data && data.recent_history_with_msgid) || [];
  const stats = (data && data.stats) || {};

  // Build a set of sg_message_ids from notification_history for matching
  const knownMsgIds = new Set(histories.map(h => h.sg_message_id).filter(Boolean));

  const eventTypeColor = (t) => {
    const k = (t || "").toLowerCase();
    if (k === "open") return "text-emerald-400";
    if (k === "click") return "text-amber-400";
    if (k === "delivered") return "text-cyan-400";
    if (["bounce", "blocked", "dropped"].includes(k)) return "text-red-400";
    if (k === "spamreport") return "text-orange-400";
    return "text-slate-400";
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#0a0f1c] border border-purple-500/30 rounded-sm w-full max-w-[1200px] max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()} data-testid="sendgrid-debug-modal">
        <div className="border-b border-purple-500/15 px-5 py-3 flex items-center justify-between bg-[rgba(6,10,20,0.95)]">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-purple-400" />
            <div className="font-orbitron text-xs tracking-wider text-purple-400">SENDGRID WEBHOOK DEBUG</div>
            <span className="font-orbitron text-[9px] text-slate-500 ml-2">last 30 events · last 20 sent emails</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="font-orbitron text-[9px] px-2 py-1 border border-purple-500/30 text-purple-400 rounded-sm hover:bg-purple-500/10" data-testid="sg-debug-refresh">RELOAD</button>
            <button onClick={onClose} className="text-slate-500 hover:text-white" data-testid="sg-debug-close"><X className="w-4 h-4" /></button>
          </div>
        </div>

        {/* Stats strip */}
        <div className="border-b border-slate-800/60 px-5 py-3 grid grid-cols-3 gap-3 bg-slate-950/40">
          <div className="text-center">
            <div className="font-orbitron text-xl font-black text-purple-400">{stats.events_logged_total || 0}</div>
            <div className="font-orbitron text-[7px] tracking-wider text-slate-500 mt-0.5 uppercase">TOTAL WEBHOOK EVENTS LOGGED</div>
          </div>
          <div className="text-center">
            <div className="font-orbitron text-xl font-black text-cyan-400">{stats.history_with_msgid_total || 0}</div>
            <div className="font-orbitron text-[7px] tracking-wider text-slate-500 mt-0.5 uppercase">EMAILS SENT WITH MSG-ID</div>
          </div>
          <div className="text-center">
            <div className="font-orbitron text-xl font-black text-emerald-400">{events.filter(e => (e.event || "").toLowerCase() === "open").length}</div>
            <div className="font-orbitron text-[7px] tracking-wider text-slate-500 mt-0.5 uppercase">OPEN EVENTS (LAST 30)</div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-purple-400" /></div>
          ) : (
            <>
              {/* Recent webhook events */}
              <div>
                <div className="font-orbitron text-[10px] tracking-wider text-purple-400 mb-2">RECENT WEBHOOK EVENTS</div>
                {events.length === 0 ? (
                  <div className="text-[10px] text-red-400 font-orbitron py-3 px-3 border border-red-500/20 bg-red-500/5 rounded-sm">
                    NO WEBHOOK EVENTS RECEIVED. Check SendGrid → Settings → Mail Settings → Event Webhook is enabled and pointing at <span className="text-cyan-400">https://cardiac-solutions.ai/api/sendgrid/events</span> with Open/Click toggled ON.
                  </div>
                ) : (
                  <table className="w-full text-[10px]">
                    <thead className="border-b border-slate-800">
                      <tr>
                        <th className="text-left p-2 font-orbitron text-[8px] text-slate-500 tracking-wider">RECEIVED</th>
                        <th className="text-left p-2 font-orbitron text-[8px] text-slate-500 tracking-wider">EVENT</th>
                        <th className="text-left p-2 font-orbitron text-[8px] text-slate-500 tracking-wider">EMAIL</th>
                        <th className="text-left p-2 font-orbitron text-[8px] text-slate-500 tracking-wider">SG MESSAGE ID</th>
                        <th className="text-center p-2 font-orbitron text-[8px] text-slate-500 tracking-wider">MATCHED?</th>
                      </tr>
                    </thead>
                    <tbody>
                      {events.map((e, i) => {
                        const sgId = (e.sg_message_id || "").split(".")[0];
                        const matched = e.matched_history === true || (sgId && [...knownMsgIds].some(k => (k || "").startsWith(sgId)));
                        return (
                          <tr key={i} className="border-b border-slate-800/40 hover:bg-slate-900/40">
                            <td className="p-2 text-slate-400 whitespace-nowrap">{fmt(e.received_at)}</td>
                            <td className={`p-2 font-orbitron font-bold ${eventTypeColor(e.event)}`}>{(e.event || "").toUpperCase()}</td>
                            <td className="p-2 text-slate-300">{e.email || "—"}</td>
                            <td className="p-2 text-slate-500 font-mono text-[9px]" title={e.sg_message_id}>{sgId ? `${sgId.slice(0, 22)}...` : "—"}</td>
                            <td className="p-2 text-center">
                              {matched
                                ? <span className="text-emerald-400 font-orbitron text-[9px]">✓ YES</span>
                                : <span className="text-red-400 font-orbitron text-[9px]">✗ NO</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Recent sent emails */}
              <div>
                <div className="font-orbitron text-[10px] tracking-wider text-cyan-400 mb-2">RECENT SENT EMAILS (notification_history)</div>
                {histories.length === 0 ? (
                  <div className="text-[10px] text-amber-400 font-orbitron py-3 px-3 border border-amber-500/20 bg-amber-500/5 rounded-sm">
                    NO EMAILS WITH SG MESSAGE-ID FOUND. SendGrid integration may not be configured (check SENDGRID_API_KEY env var).
                  </div>
                ) : (
                  <table className="w-full text-[10px]">
                    <thead className="border-b border-slate-800">
                      <tr>
                        <th className="text-left p-2 font-orbitron text-[8px] text-slate-500 tracking-wider">SENT AT</th>
                        <th className="text-left p-2 font-orbitron text-[8px] text-slate-500 tracking-wider">SUBSCRIBER</th>
                        <th className="text-left p-2 font-orbitron text-[8px] text-slate-500 tracking-wider">TO</th>
                        <th className="text-left p-2 font-orbitron text-[8px] text-slate-500 tracking-wider">SG MESSAGE ID</th>
                        <th className="text-right p-2 font-orbitron text-[8px] text-slate-500 tracking-wider">DELIV</th>
                        <th className="text-right p-2 font-orbitron text-[8px] text-slate-500 tracking-wider">OPENS</th>
                        <th className="text-right p-2 font-orbitron text-[8px] text-slate-500 tracking-wider">CLICKS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {histories.map((h, i) => (
                        <tr key={i} className={`border-b border-slate-800/40 hover:bg-slate-900/40 ${h.is_test ? "opacity-60" : ""}`}>
                          <td className="p-2 text-slate-400 whitespace-nowrap">{fmt(h.sent_at)}</td>
                          <td className="p-2 text-cyan-300">{h.subscriber || "—"}{h.is_test && <span className="ml-1 text-[8px] text-amber-400">[TEST]</span>}</td>
                          <td className="p-2 text-slate-300">{h.to_email}</td>
                          <td className="p-2 text-slate-500 font-mono text-[9px]" title={h.sg_message_id}>{(h.sg_message_id || "").slice(0, 22)}...</td>
                          <td className={`p-2 text-right font-orbitron ${h.delivered_at ? "text-cyan-400" : "text-slate-600"}`}>{h.delivered_at ? "✓" : "—"}</td>
                          <td className={`p-2 text-right font-orbitron ${(h.open_count || 0) > 0 ? "text-emerald-400 font-bold" : "text-slate-600"}`}>{h.open_count || 0}</td>
                          <td className={`p-2 text-right font-orbitron ${(h.click_count || 0) > 0 ? "text-amber-400 font-bold" : "text-slate-600"}`}>{h.click_count || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </div>

        <div className="border-t border-slate-800/60 px-5 py-2 text-[9px] text-slate-500 font-orbitron tracking-wider leading-relaxed">
          <span className="text-purple-400/90">DIAGNOSE:</span> If "TOTAL WEBHOOK EVENTS LOGGED" is 0, the webhook isn't reaching us. If events are logged but "MATCHED?" is mostly NO, sg_message_id mismatch (config drift). If everything matches but Adjusted = Actual, recipients simply haven't opened the emails yet.
        </div>
      </div>
    </div>
  );
}

function SubscriberEngagementModal({ onClose }) {
  const [data, setData] = useState(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState("emails_sent");
  const [sortDir, setSortDir] = useState("desc");

  const load = async (d = days) => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/support/subscriber-engagement?days=${d}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setData(await res.json());
    } catch {}
    setLoading(false);
  };
  useEffect(() => { load(days); /* eslint-disable-next-line */ }, [days]);

  // Recompute all rates locally so they ALWAYS use SENT as the denominator,
  // regardless of what the backend sends back. This guarantees the displayed
  // math always matches the disclaimer ("All percentages use SENT as denominator").
  const pct = (num, den) => {
    if (!den || den <= 0) return 0;
    return Math.round((num / den) * 1000) / 10; // 1 decimal place
  };
  const enriched = ((data && data.subscribers) || []).map(s => {
    const sent = s.emails_sent || 0;
    return {
      ...s,
      delivery_rate: pct(s.delivered || 0, sent),
      open_rate:     pct(s.opened_by_to || 0, sent),
      bounce_rate:   pct(s.bounced || 0, sent),
      click_rate:    pct(s.clicked || 0, sent),
    };
  });

  const sorted = (() => {
    const arr = [...enriched];
    arr.sort((a, b) => {
      const av = a[sortKey]; const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return sortDir === "asc" ? av - bv : bv - av;
      return sortDir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
    return arr;
  })();

  const t = (data && data.totals) || {};
  const HeaderCell = ({ k, label, align = "right", w }) => (
    <th
      onClick={() => { if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc"); else { setSortKey(k); setSortDir("desc"); } }}
      className={`p-2 text-${align} font-orbitron text-[8px] tracking-wider text-slate-400 cursor-pointer hover:text-cyan-400 select-none ${w || ""}`}
      data-testid={`engagement-sort-${k}`}
    >
      {label} {sortKey === k && <span className="text-cyan-400">{sortDir === "asc" ? "▲" : "▼"}</span>}
    </th>
  );

  const fmt = (iso) => iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—";

  const csvDownload = () => {
    if (!data) return;
    const rows = [["subscriber","emails_sent","delivered","delivery_rate","opened_by_to","open_rate","clicked","bounced","bounce_rate","spam_reported","last_sent_at","last_opened_at","last_to_email"]];
    sorted.forEach(s => rows.push([
      s.subscriber, s.emails_sent, s.delivered, s.delivery_rate, s.opened_by_to, s.open_rate, s.clicked, s.bounced, s.bounce_rate, s.spam_reported, s.last_sent_at || "", s.last_opened_at || "", s.last_to_email || "",
    ]));
    const csv = rows.map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `subscriber-engagement-${days}d.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#0a0f1c] border border-cyan-500/30 rounded-sm w-full max-w-[1200px] max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()} data-testid="engagement-modal">
        <div className="border-b border-cyan-500/15 px-5 py-3 flex items-center justify-between bg-[rgba(6,10,20,0.95)]">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-cyan-400" />
            <div className="font-orbitron text-xs tracking-wider text-cyan-400">SUBSCRIBER EMAIL ENGAGEMENT</div>
            <span className="font-orbitron text-[9px] text-slate-500 ml-2">last {days} days</span>
          </div>
          <div className="flex items-center gap-2">
            <select value={days} onChange={e => setDays(parseInt(e.target.value))} className="bg-slate-900 border border-slate-700 text-cyan-300 text-[10px] font-orbitron px-2 py-1 rounded-sm focus:outline-none" data-testid="engagement-days">
              <option value={7}>7 DAYS</option>
              <option value={14}>14 DAYS</option>
              <option value={30}>30 DAYS</option>
              <option value={90}>90 DAYS</option>
              <option value={365}>1 YEAR</option>
            </select>
            <button onClick={csvDownload} className="font-orbitron text-[9px] px-2 py-1 border border-cyan-500/30 text-cyan-400 rounded-sm hover:bg-cyan-500/10" data-testid="engagement-export">EXPORT CSV</button>
            <button onClick={onClose} className="text-slate-500 hover:text-white" data-testid="engagement-close"><X className="w-4 h-4" /></button>
          </div>
        </div>

        {/* Totals strip */}
        <div className="border-b border-slate-800/60 px-5 py-3 grid grid-cols-7 gap-3 bg-slate-950/40">
          {[
            { l: "SUBSCRIBERS", v: t.subscribers || 0, c: "text-cyan-400" },
            { l: "EMAILS SENT", v: t.emails_sent || 0, c: "text-slate-200" },
            { l: "DELIVERED", v: t.delivered || 0, c: "text-cyan-400" },
            { l: "OPENED (TO)", v: t.opened_by_to || 0, c: "text-emerald-400" },
            { l: "CLICKED", v: t.clicked || 0, c: "text-amber-400" },
            { l: "BOUNCED", v: t.bounced || 0, c: "text-red-400" },
            { l: "SPAM REPORTS", v: t.spam_reported || 0, c: "text-orange-400" },
          ].map((m, i) => (
            <div key={i} className="text-center">
              <div className={`font-orbitron text-xl font-black ${m.c}`}>{m.v}</div>
              <div className="font-orbitron text-[7px] tracking-wider text-slate-500 mt-0.5 uppercase">{m.l}</div>
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-cyan-400" /></div>
          ) : sorted.length === 0 ? (
            <div className="text-center py-16 text-slate-500 font-orbitron text-[11px]">NO ENGAGEMENT DATA IN THE LAST {days} DAYS</div>
          ) : (
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 bg-[#0a0f1c] z-10 border-b border-slate-800">
                <tr>
                  <HeaderCell k="subscriber" label="SUBSCRIBER" align="left" w="w-[180px]" />
                  <HeaderCell k="emails_sent" label="SENT" />
                  <HeaderCell k="delivered" label="DELIV" />
                  <HeaderCell k="delivery_rate" label="DELIV %" />
                  <HeaderCell k="opened_by_to" label="OPENED" />
                  <HeaderCell k="open_rate" label="OPEN %" />
                  <HeaderCell k="clicked" label="CLICKED" />
                  <HeaderCell k="bounced" label="BOUNCED" />
                  <HeaderCell k="spam_reported" label="SPAM" />
                  <HeaderCell k="last_sent_at" label="LAST SENT" align="right" />
                  <HeaderCell k="last_opened_at" label="LAST OPENED" align="right" />
                </tr>
              </thead>
              <tbody>
                {sorted.map((s) => (
                  <tr key={s.subscriber} className="border-b border-slate-800/40 hover:bg-slate-900/40">
                    <td className="p-2 text-cyan-300 font-medium" title={s.last_to_email}>{s.subscriber}</td>
                    <td className="p-2 text-right font-orbitron text-slate-200">{s.emails_sent}</td>
                    <td className="p-2 text-right font-orbitron text-cyan-400">{s.delivered}</td>
                    <td className="p-2 text-right font-orbitron text-cyan-300/80">{s.delivery_rate}%</td>
                    <td className={`p-2 text-right font-orbitron font-bold ${s.opened_by_to > 0 ? "text-emerald-400" : "text-slate-600"}`}>{s.opened_by_to}</td>
                    <td className={`p-2 text-right font-orbitron ${s.open_rate >= 40 ? "text-emerald-400" : s.open_rate >= 15 ? "text-amber-400" : "text-slate-500"}`}>{s.open_rate}%</td>
                    <td className={`p-2 text-right font-orbitron ${s.clicked > 0 ? "text-amber-400" : "text-slate-600"}`}>{s.clicked}</td>
                    <td className={`p-2 text-right font-orbitron ${s.bounced > 0 ? "text-red-400 font-bold" : "text-slate-600"}`}>{s.bounced}</td>
                    <td className={`p-2 text-right font-orbitron ${s.spam_reported > 0 ? "text-orange-400" : "text-slate-600"}`}>{s.spam_reported}</td>
                    <td className="p-2 text-right text-slate-500 text-[10px] whitespace-nowrap">{fmt(s.last_sent_at)}</td>
                    <td className="p-2 text-right text-slate-500 text-[10px] whitespace-nowrap">{fmt(s.last_opened_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="border-t border-slate-800/60 px-5 py-2 text-[9px] text-slate-500 font-orbitron tracking-wider leading-relaxed">
          <span className="text-cyan-400/90">FORMULAS:</span>{" "}
          <span className="text-slate-300">DELIV %</span> = delivered ÷ <span className="text-cyan-400/80">sent</span>{" · "}
          <span className="text-slate-300">OPEN %</span> = opened-by-TO ÷ <span className="text-cyan-400/80">sent</span>{" · "}
          all rates share the same denominator so they're directly comparable.
          <span className="text-slate-600"> · </span>
          <span className="text-slate-300">OPENED</span> counts only opens by the TO recipient (used for Adjusted % Ready).
          <span className="text-slate-600"> · </span>Click any column to sort.
        </div>
      </div>
    </div>
  );
}

function NotificationHistoryModal({ onClose }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [sortBy, setSortBy] = useState("date");
  const [editingId, setEditingId] = useState(null);
  const [editStatus, setEditStatus] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [viewEmail, setViewEmail] = useState(null);
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [bounceDetail, setBounceDetail] = useState(null);
  const [engagementDetail, setEngagementDetail] = useState(null); // {record, eventType: "open"|"click"}

  const statusOptions = [
    { value: "SENT", label: "SENT", bg: "bg-green-500/15", text: "text-green-400" },
    { value: "IN PROGRESS", label: "IN PROGRESS", bg: "bg-blue-500/15", text: "text-blue-400" },
    { value: "RESOLVED", label: "RESOLVED", bg: "bg-cyan-500/15", text: "text-cyan-400" },
    { value: "FAILED", label: "FAILED", bg: "bg-red-500/15", text: "text-red-400" },
  ];

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const url = filter
        ? `${API}/support/notification-history?subscriber=${encodeURIComponent(filter)}`
        : `${API}/support/notification-history`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setHistory(await res.json());
    } catch {}
    setLoading(false);
  }, [filter]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const openEdit = (h) => {
    setEditingId(h.id);
    setEditStatus(h.current_status || (h.success ? "SENT" : "FAILED"));
    setEditNotes(h.status_notes || "");
  };

  const saveStatus = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/support/notification-history/${editingId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: editStatus, notes: editNotes }),
      });
      if (res.ok) {
        toast.success("Status updated");
        setEditingId(null);
        fetchHistory();
      } else toast.error("Failed to update");
    } catch { toast.error("Error updating status"); }
    setSaving(false);
  };

  const getStatusStyle = (h) => {
    const status = h.current_status || (h.success ? "SENT" : "FAILED");
    return statusOptions.find(s => s.value === status) || statusOptions[0];
  };

  const openEmail = async (id) => {
    setLoadingEmail(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/support/notification-history/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setViewEmail(await res.json());
      else toast.error("Could not load email");
    } catch { toast.error("Failed to load email"); }
    setLoadingEmail(false);
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-[#0a0f1c] border border-cyan-500/30 rounded-sm w-[900px] max-w-[95vw] max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()} data-testid="history-modal">
        <div className="p-5 border-b border-cyan-500/15 flex-shrink-0">
          <div className="flex justify-between items-center">
            <div>
              <div className="font-orbitron text-sm text-cyan-400 tracking-wider">NOTIFICATION HISTORY</div>
              <div className="text-[9px] text-slate-500 mt-0.5">{history.length} emails sent</div>
            </div>
            <button onClick={onClose} className="text-slate-500 hover:text-white"><X className="w-5 h-5" /></button>
          </div>
          <div className="mt-3 flex gap-3 items-center">
            <input
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Filter by subscriber name..."
              className="flex-1 px-3 py-2 rounded-sm bg-slate-900 border border-slate-700 text-white text-xs placeholder-slate-600 font-orbitron"
              data-testid="history-filter"
            />
            <div className="flex gap-1 flex-shrink-0">
              <button
                onClick={() => setSortBy("date")}
                className={`font-orbitron text-[7px] px-2.5 py-1.5 rounded-sm border ${sortBy === "date" ? "border-cyan-500/50 text-cyan-400 bg-cyan-500/10" : "border-slate-700 text-slate-500 hover:text-slate-300"}`}
                data-testid="sort-date"
              >DATE</button>
              <button
                onClick={() => setSortBy("alpha")}
                className={`font-orbitron text-[7px] px-2.5 py-1.5 rounded-sm border ${sortBy === "alpha" ? "border-cyan-500/50 text-cyan-400 bg-cyan-500/10" : "border-slate-700 text-slate-500 hover:text-slate-300"}`}
                data-testid="sort-alpha"
              >A-Z</button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-cyan-400 animate-spin" /></div>
          ) : history.length === 0 ? (
            <div className="text-center text-slate-500 py-8 font-orbitron text-[10px]">NO NOTIFICATIONS FOUND</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-cyan-500/15">
                  <th className="text-left p-2 font-orbitron text-[8px] text-cyan-500/70 tracking-wider">SUBSCRIBER</th>
                  <th className="text-left p-2 font-orbitron text-[8px] text-cyan-500/70 tracking-wider">TO</th>
                  <th className="text-left p-2 font-orbitron text-[8px] text-cyan-500/70 tracking-wider">SUBJECT</th>
                  <th className="text-left p-2 font-orbitron text-[8px] text-cyan-500/70 tracking-wider">SENT BY</th>
                  <th className="text-left p-2 font-orbitron text-[8px] text-cyan-500/70 tracking-wider">DATE</th>
                  <th className="text-center p-2 font-orbitron text-[8px] text-cyan-500/70 tracking-wider">TRACKING</th>
                  <th className="text-center p-2 font-orbitron text-[8px] text-cyan-500/70 tracking-wider">STATUS</th>
                  <th className="text-center p-2 font-orbitron text-[8px] text-cyan-500/70 tracking-wider w-16">VIEW</th>
                </tr>
              </thead>
              <tbody>
                {[...history].sort((a, b) => {
                  if (sortBy === "alpha") return (a.subscriber || "").localeCompare(b.subscriber || "");
                  return new Date(b.sent_at || 0) - new Date(a.sent_at || 0);
                }).map((h, i) => {
                  const sentDate = h.sent_at ? new Date(h.sent_at).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "—";
                  const style = getStatusStyle(h);
                  const isEditing = editingId === h.id;
                  return (
                    <tr key={h.id || i} className={`border-b border-slate-800/50 ${i % 2 === 0 ? "bg-transparent" : "bg-slate-900/20"}`}>
                      <td className="p-2 font-orbitron text-[10px] text-cyan-400 cursor-pointer hover:underline" onClick={() => openEmail(h.id)}>{h.subscriber || "—"}</td>
                      <td className="p-2 text-slate-300 text-[10px]">{h.to_email || "—"}</td>
                      <td className="p-2 text-slate-300 text-[10px] max-w-[200px] truncate">{h.subject || "—"}</td>
                      <td className="p-2 text-slate-400 text-[10px]">{h.sent_by || "—"}</td>
                      <td className="p-2 text-slate-400 text-[10px] whitespace-nowrap">{sentDate}</td>
                      <td className="p-2 text-center whitespace-nowrap">
                        {h.bounced ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); setBounceDetail(h); }}
                            title="Click to see bounce details"
                            className="inline-block text-[8px] px-1.5 py-0.5 bg-red-500/15 text-red-400 border border-red-500/30 rounded-sm font-orbitron hover:bg-red-500/25 cursor-pointer"
                            data-testid={`bounced-badge-${i}`}
                          >BOUNCED</button>
                        ) : h.spam_reported ? (
                          <span className="inline-block text-[8px] px-1.5 py-0.5 bg-orange-500/15 text-orange-400 border border-orange-500/30 rounded-sm font-orbitron">SPAM</span>
                        ) : (
                          <div className="flex items-center gap-1 justify-center">
                            {h.delivered_at ? (
                              <span title={`Delivered ${new Date(h.delivered_at).toLocaleString()}`} className="inline-block text-[8px] px-1.5 py-0.5 bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 rounded-sm font-orbitron">DELIV</span>
                            ) : (
                              <span title="Sent — awaiting delivery confirmation" className="inline-block text-[8px] px-1.5 py-0.5 bg-slate-700/40 text-slate-400 border border-slate-600/40 rounded-sm font-orbitron">SENT</span>
                            )}
                            {(h.open_count || 0) > 0 && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setEngagementDetail({ record: h, eventType: "open" }); }}
                                title={`Click to see who opened this email`}
                                className="inline-block text-[8px] px-1.5 py-0.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-sm font-orbitron hover:bg-emerald-500/25 cursor-pointer"
                                data-testid={`open-badge-${i}`}
                              >OPEN {h.open_count > 1 ? `×${h.open_count}` : ""}</button>
                            )}
                            {(h.click_count || 0) > 0 && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setEngagementDetail({ record: h, eventType: "click" }); }}
                                title={`Click to see clicks`}
                                className="inline-block text-[8px] px-1.5 py-0.5 bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded-sm font-orbitron hover:bg-amber-500/25 cursor-pointer"
                                data-testid={`click-badge-${i}`}
                              >CLICK {h.click_count > 1 ? `×${h.click_count}` : ""}</button>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="p-2 text-center relative">
                        {isEditing ? (
                          <div className="absolute right-0 top-full mt-1 z-20 bg-[#0a0f1c] border border-cyan-500/30 rounded-sm p-3 w-[240px] shadow-xl" onClick={e => e.stopPropagation()}>
                            <div className="font-orbitron text-[7px] text-slate-500 tracking-wider mb-2">UPDATE STATUS</div>
                            <div className="flex flex-wrap gap-1 mb-3">
                              {statusOptions.map(opt => (
                                <button
                                  key={opt.value}
                                  onClick={() => setEditStatus(opt.value)}
                                  className={`text-[7px] px-2 py-1 rounded-sm font-orbitron border ${editStatus === opt.value ? `${opt.bg} ${opt.text} border-current` : "border-slate-700 text-slate-500 hover:border-slate-500"}`}
                                  data-testid={`status-opt-${opt.value.toLowerCase().replace(/ /g, "-")}`}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                            <div className="font-orbitron text-[7px] text-slate-500 tracking-wider mb-1">NOTES</div>
                            <textarea
                              value={editNotes}
                              onChange={e => setEditNotes(e.target.value)}
                              placeholder="Add resolution notes..."
                              className="w-full px-2 py-1.5 rounded-sm bg-slate-900 border border-slate-700 text-white text-[10px] placeholder-slate-600 resize-none h-16 mb-2"
                              data-testid="status-notes-input"
                            />
                            <div className="flex gap-2 justify-end">
                              <button onClick={() => setEditingId(null)} className="text-[8px] px-2 py-1 text-slate-500 hover:text-white font-orbitron">CANCEL</button>
                              <button
                                onClick={saveStatus}
                                disabled={saving}
                                className="text-[8px] px-3 py-1 bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 rounded-sm font-orbitron hover:bg-cyan-500/25 disabled:opacity-50 flex items-center gap-1"
                                data-testid="save-status-btn"
                              >
                                {saving ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : null}
                                SAVE
                              </button>
                            </div>
                          </div>
                        ) : null}
                        <button
                          onClick={() => isEditing ? setEditingId(null) : openEdit(h)}
                          className={`text-[7px] px-1.5 py-0.5 ${style.bg} ${style.text} rounded-sm font-orbitron cursor-pointer hover:opacity-80`}
                          data-testid={`status-badge-${i}`}
                        >
                          {(h.current_status || (h.success ? "SENT" : "FAILED"))}
                        </button>
                        {h.status_notes && !isEditing && (
                          <div className="text-[8px] text-slate-500 mt-0.5 italic truncate max-w-[120px] mx-auto" title={h.status_notes}>{h.status_notes}</div>
                        )}
                      </td>
                      <td className="p-2 text-center">
                        <button
                          onClick={() => openEmail(h.id)}
                          className="font-orbitron text-[7px] px-2 py-1 border border-cyan-500/30 text-cyan-400 rounded-sm hover:bg-cyan-500/10"
                          data-testid={`view-email-${i}`}
                        >
                          {loadingEmail ? <Loader2 className="w-3 h-3 animate-spin" /> : "VIEW"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Email Engagement (Open / Click) Detail Popup */}
        {engagementDetail && (() => {
          const { record, eventType } = engagementDetail;
          const allEvents = (record.events || []).filter(ev => (ev.event || "").toLowerCase() === eventType);
          // Group by recipient email
          const byEmail = {};
          allEvents.forEach(ev => {
            const e = (ev.email || "").toLowerCase();
            if (!byEmail[e]) byEmail[e] = [];
            byEmail[e].push(ev);
          });
          const recipients = Object.keys(byEmail).sort();
          const isOpen = eventType === "open";
          const titleColor = isOpen ? "text-emerald-400" : "text-amber-400";
          const borderColor = isOpen ? "border-emerald-500/40" : "border-amber-500/40";
          const headerBg = isOpen ? "bg-[rgba(16,40,28,0.5)]" : "bg-[rgba(50,30,8,0.5)]";
          return (
            <div className="fixed inset-0 bg-black/85 z-[80] flex items-center justify-center p-4" onClick={() => setEngagementDetail(null)}>
              <div className={`bg-[#0a0f1c] border ${borderColor} rounded-sm w-full max-w-2xl max-h-[85vh] flex flex-col`} onClick={e => e.stopPropagation()} data-testid="engagement-detail-modal">
                <div className={`border-b border-slate-800/40 px-5 py-3 flex items-center justify-between ${headerBg}`}>
                  <div className="flex items-center gap-2">
                    <Mail className={`w-4 h-4 ${titleColor}`} />
                    <div className={`font-orbitron text-xs tracking-wider ${titleColor}`}>{isOpen ? "EMAIL OPENS" : "LINK CLICKS"} ({allEvents.length})</div>
                  </div>
                  <button onClick={() => setEngagementDetail(null)} className="text-slate-500 hover:text-white" data-testid="engagement-detail-close"><X className="w-4 h-4" /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                  <div>
                    <div className="font-orbitron text-[8px] text-slate-500 tracking-[0.2em] uppercase mb-1">Original Email</div>
                    <div className="text-cyan-400 text-[12px] font-bold">{record.subject || "—"}</div>
                    <div className="text-slate-500 text-[10px] mt-0.5">to {record.to_email}{record.cc_email ? ` · cc ${record.cc_email}` : ""}{record.bcc_emails ? ` · bcc ${record.bcc_emails}` : ""}</div>
                    <div className="text-slate-600 text-[10px]">sent {record.sent_at ? new Date(record.sent_at).toLocaleString() : "—"}</div>
                  </div>
                  <div className="border-t border-slate-800/60 pt-3">
                    <div className="font-orbitron text-[8px] text-slate-500 tracking-[0.2em] uppercase mb-2">{isOpen ? "Recipients who opened" : "Recipients who clicked"} ({recipients.length})</div>
                    {recipients.length === 0 ? (
                      <div className="italic text-slate-500 text-[11px]">No detailed event data available.</div>
                    ) : (
                      <div className="space-y-3">
                        {recipients.map((email) => {
                          const evs = byEmail[email];
                          return (
                            <div key={email} className="border border-slate-800 rounded-sm p-3 bg-slate-950/40">
                              <div className="flex items-baseline justify-between mb-1.5">
                                <div className="text-cyan-400 text-[11px] font-bold break-all">{email || "(unknown address)"}</div>
                                <div className={`font-orbitron text-[9px] ${titleColor}`}>{evs.length}{evs.length > 1 ? " events" : " event"}</div>
                              </div>
                              <div className="space-y-1">
                                {evs.map((ev, i) => (
                                  <div key={i} className="flex items-baseline gap-2 text-[10px] font-mono">
                                    <span className="text-slate-500 w-40 flex-shrink-0">{ev.timestamp ? new Date(ev.timestamp).toLocaleString() : "—"}</span>
                                    {!isOpen && ev.url && (
                                      <a href={ev.url} target="_blank" rel="noreferrer" className="text-amber-400 hover:underline truncate" title={ev.url}>{ev.url}</a>
                                    )}
                                    {ev.useragent && (
                                      <span className="text-slate-500 truncate" title={ev.useragent}>{ev.useragent.length > 60 ? ev.useragent.slice(0, 60) + "…" : ev.useragent}</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  {isOpen && allEvents.length > recipients.length && (
                    <div className="text-[10px] text-slate-500 italic border-t border-slate-800/60 pt-2">
                      Multiple opens by the same recipient typically come from email re-renders or cached image refreshes; <span className="text-slate-400">Apple Mail Privacy Protection</span> can also auto-fetch images on Apple's servers, generating opens even if the user didn't actively view the message.
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
        {/* Bounce Detail Popup */}
        {bounceDetail && (() => {
          const bounceEvents = (bounceDetail.events || []).filter(ev => ["bounce", "blocked", "dropped"].includes((ev.event || "").toLowerCase()));
          const reason = bounceDetail.bounce_reason || (bounceEvents[0] && bounceEvents[0].reason) || "";
          // Classify
          const reasonLow = reason.toLowerCase();
          const isHard = /(no such user|user unknown|mailbox not found|address.*does not exist|account that you tried to reach does not exist|recipient.*rejected|550|5\.1\.[01])/.test(reasonLow);
          const isSoftFull = /(quota|over.*quota|mailbox.*full|452|4\.2\.2)/.test(reasonLow);
          const isPolicy = /(spam|blacklist|reputation|policy|550 5\.7|relay denied|blocked)/.test(reasonLow);
          let category = "Hard bounce — address invalid";
          let advice = "Update or remove this address from the subscriber's contact info.";
          if (isPolicy) { category = "Blocked by recipient server"; advice = "The recipient mail server rejected based on policy (spam filter, IP reputation, or attachment scanning). Try resending later, or contact the recipient to whitelist no-reply@cardiac-solutions.ai."; }
          else if (isSoftFull) { category = "Soft bounce — mailbox full"; advice = "The recipient's mailbox is over quota. SendGrid will retry for ~72 hours; no immediate action needed."; }
          else if (isHard) { category = "Hard bounce — address invalid"; advice = "Update the subscriber's contact email. SendGrid has added this address to its suppression list — future sends to it will be auto-dropped."; }
          else if (reason) { category = "Bounce / Rejection"; }
          return (
            <div className="fixed inset-0 bg-black/85 z-[80] flex items-center justify-center p-4" onClick={() => setBounceDetail(null)}>
              <div className="bg-[#0a0f1c] border border-red-500/40 rounded-sm w-full max-w-xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()} data-testid="bounce-detail-modal">
                <div className="border-b border-red-500/20 px-5 py-3 flex items-center justify-between bg-[rgba(60,10,10,0.4)]">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    <div className="font-orbitron text-xs tracking-wider text-red-400">EMAIL BOUNCE DETAIL</div>
                  </div>
                  <button onClick={() => setBounceDetail(null)} className="text-slate-500 hover:text-white" data-testid="bounce-detail-close"><X className="w-4 h-4" /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-5 space-y-3 text-[11px] text-slate-300 leading-relaxed">
                  <div>
                    <div className="font-orbitron text-[8px] text-slate-500 tracking-[0.2em] uppercase mb-1">Recipient</div>
                    <div className="text-cyan-400 font-bold text-[12px]">{bounceDetail.to_email || "—"}</div>
                    <div className="text-slate-500 mt-0.5">{bounceDetail.subscriber || ""}</div>
                  </div>
                  <div>
                    <div className="font-orbitron text-[8px] text-slate-500 tracking-[0.2em] uppercase mb-1">Subject</div>
                    <div>{bounceDetail.subject || "—"}</div>
                  </div>
                  <div>
                    <div className="font-orbitron text-[8px] text-slate-500 tracking-[0.2em] uppercase mb-1">Sent</div>
                    <div>{bounceDetail.sent_at ? new Date(bounceDetail.sent_at).toLocaleString() : "—"} by {bounceDetail.sent_by || "—"}</div>
                  </div>
                  <div className="border-t border-slate-800/60 pt-3">
                    <div className="font-orbitron text-[8px] text-slate-500 tracking-[0.2em] uppercase mb-1">Bounce Category</div>
                    <div className={`inline-block px-2 py-0.5 rounded-sm border font-orbitron text-[10px] ${isPolicy ? "bg-orange-500/15 text-orange-400 border-orange-500/30" : isSoftFull ? "bg-amber-500/15 text-amber-400 border-amber-500/30" : "bg-red-500/15 text-red-400 border-red-500/30"}`}>{category}</div>
                  </div>
                  <div>
                    <div className="font-orbitron text-[8px] text-slate-500 tracking-[0.2em] uppercase mb-1">Reason from recipient mail server</div>
                    {reason ? (
                      <pre className="bg-slate-950 border border-slate-800 rounded-sm p-2 text-[10px] text-red-300 whitespace-pre-wrap break-words font-mono">{reason}</pre>
                    ) : (
                      <div className="italic text-slate-500">No detailed reason was provided by SendGrid.</div>
                    )}
                  </div>
                  <div>
                    <div className="font-orbitron text-[8px] text-slate-500 tracking-[0.2em] uppercase mb-1">What this means / What to do</div>
                    <div className="text-slate-300">{advice}</div>
                  </div>
                  {bounceEvents.length > 0 && (
                    <div className="border-t border-slate-800/60 pt-3">
                      <div className="font-orbitron text-[8px] text-slate-500 tracking-[0.2em] uppercase mb-1">Event timeline</div>
                      <div className="space-y-1">
                        {bounceEvents.map((ev, i) => (
                          <div key={i} className="flex gap-2 items-baseline text-[10px] font-mono">
                            <span className="text-slate-500 w-32 flex-shrink-0">{ev.timestamp ? new Date(ev.timestamp).toLocaleString() : "—"}</span>
                            <span className="text-red-400 font-bold uppercase w-16">{ev.event}</span>
                            <span className="text-slate-400 break-words">{ev.reason || "—"}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
        {viewEmail && (
          <div className="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center" onClick={() => setViewEmail(null)}>
            <div className="bg-white rounded-sm w-[800px] max-w-[95vw] max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()} data-testid="email-viewer">
              <div className="p-4 border-b border-slate-200 flex justify-between items-center flex-shrink-0 bg-slate-50">
                <div>
                  <div className="text-sm font-bold text-slate-800">{viewEmail.subject || "Email"}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    To: {viewEmail.to_email} {viewEmail.cc_email && <span>| CC: {viewEmail.cc_email}</span>}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Sent {viewEmail.sent_at ? new Date(viewEmail.sent_at).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "—"} by {viewEmail.sent_by || "—"}
                  </div>
                </div>
                <button onClick={() => setViewEmail(null)} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {viewEmail.html_body ? (
                  <iframe
                    srcDoc={viewEmail.html_body}
                    title="Email Preview"
                    className="w-full h-full min-h-[500px] border-0"
                    sandbox="allow-same-origin"
                  />
                ) : (
                  <div className="p-8 text-center text-slate-400 text-sm">Email body not available. This email was sent before email content storage was enabled.</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function NotificationModal({ subscriber, contact, onClose, onSent }) {
  const [toEmail, setToEmail] = useState(contact?.to_email || "");
  const baseCc = contact?.cc_email || "";
  const alwaysCc = "tprince@cardiac-solutions.net";
  const initialCc = baseCc.includes(alwaysCc) ? baseCc : [baseCc, alwaysCc].filter(Boolean).join(", ");
  const [ccEmail, setCcEmail] = useState(initialCc);
  const [bccEmails, setBccEmails] = useState(contact?.bcc_emails || "");
  const [removedDevices, setRemovedDevices] = useState(new Set());
  const [sending, setSending] = useState(false);
  const [emailType, setEmailType] = useState("all");
  const [devices, setDevices] = useState([]);
  const [loadingDevices, setLoadingDevices] = useState(true);
  const [drawerDevice, setDrawerDevice] = useState(null);
  const [customDetails, setCustomDetails] = useState({});
  const [imageHistoryId, setImageHistoryId] = useState(null);

  // Fetch subscriber devices with full detail
  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API}/support/subscriber/${encodeURIComponent(subscriber)}/devices`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          // Filter to only issue devices
          const issueDevices = (data.devices || []).filter(d => {
            const s = (d.detailed_status || "").toUpperCase();
            return ["EXPIRED B/P", "EXPIRING BATT/PADS", "REPOSITION", "NOT READY", "NOT PRESENT", "UNKNOWN"].includes(s);
          });
          setDevices(issueDevices);
        }
      } catch {}
      setLoadingDevices(false);
    })();
  }, [subscriber]);

  const activeDevices = devices.filter(d => !removedDevices.has(d.sentinel_id));

  const grouped = {};
  for (const d of activeDevices) {
    const status = d.detailed_status || "UNKNOWN";
    if (!grouped[status]) grouped[status] = [];
    grouped[status].push(d);
  }

  const typeOptions = [
    { value: "all", label: `All Issues (${activeDevices.length} devices)` },
    ...Object.entries(grouped).map(([status, devs]) => ({
      value: status,
      label: `${status} (${devs.length} devices)`,
    })),
  ];

  const filteredGrouped = emailType === "all" ? grouped : { [emailType]: grouped[emailType] || [] };

  // Map statuses to template sections
  const sectionMap = {
    "EXPIRED B/P": { title: "AED Batteries and Pads Expired/Expiring", action: "Next Steps", actionText: "Please contact our team by phone or email as soon as possible to arrange for replacement options for these devices." },
    "EXPIRING BATT/PADS": { title: "AED Batteries and Pads Expired/Expiring", action: "Next Steps", actionText: "Please contact our team by phone or email as soon as possible to arrange for replacement options for these devices." },
    "REPOSITION": { title: "AED(s) Alignment Issues", action: "Required Action", actionText: "Please take a moment as soon as possible to inspect the AED(s) noted above. If it appears to have been moved from its original location, please reposition it so it is in the location shown in the photo below (fully to the left side of the storage cabinet and as far toward the back of the storage cabinet as possible)." },
    "NOT PRESENT": { title: "AED(s) Missing", action: "Required Action", actionText: "Please take a moment as soon as possible to inspect the AED(s) noted above. If it appears to have been moved from its original location, please place it back in its original location and reposition inside the storage case consistent with the photo below (fully to the left side of the storage cabinet and as far toward the back of the storage cabinet as possible).\n\nOnce this repositioning has been done, please notify us and we will check to ensure the AED is now working properly. If you discover the AED is missing, please notify us so we can discuss providing you with a new unit." },
    "NOT READY": { title: "AED(s) Not Ready", action: "Required Action", actionText: "Please take a moment as soon as possible to inspect the AED(s) noted above and ensure they are properly set up and ready for use." },
    "UNKNOWN": { title: "AED(s) Status Unknown", action: "Required Action", actionText: "Please take a moment as soon as possible to inspect the AED(s) noted above. We are unable to determine the current status of these units." },
  };

  const [subject, setSubject] = useState("AED Report and Action Items");

  const buildEmailHtml = () => {
    const s = `style`;
    let html = `<div ${s}="font-family:Arial,Helvetica,sans-serif;max-width:700px;margin:0 auto;color:#333;">`;

    // Greeting
    const greeting = contact?.contact_name || subscriber;
    html += `<p ${s}="font-size:14px;">Hello ${greeting},</p>`;
    html += `<p ${s}="font-size:14px;">During our recent review of your AED(s), we identified issues as outlined below.</p>`;
    html += `<p ${s}="font-size:14px;">Resolving these issues is critical to effectively monitor the health of your device. This also ensures that your units are ready to be used in an emergency.</p>`;

    // Group sections by template category (merge EXPIRED B/P and EXPIRING into one section)
    const merged = {};
    for (const [status, devs] of Object.entries(filteredGrouped)) {
      const sec = sectionMap[status] || { title: status, action: "Required Action", actionText: "Please inspect the AED(s) noted above." };
      if (!merged[sec.title]) merged[sec.title] = { ...sec, devices: [] };
      merged[sec.title].devices.push(...devs);
    }

    for (const [title, sec] of Object.entries(merged)) {
      html += `<hr ${s}="border:none;border-top:1px solid #ddd;margin:20px 0;">`;
      html += `<p ${s}="font-size:15px;font-weight:bold;margin-bottom:8px;">${title}:</p>`;

      // Device table
      html += `<table ${s}="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:12px;">`;
      html += `<tr ${s}="background:#f5f5f5;"><th ${s}="text-align:left;padding:8px;border:1px solid #ddd;">Serial Number</th>`;
      html += `<th ${s}="text-align:left;padding:8px;border:1px solid #ddd;">Location</th>`;
      html += `<th ${s}="text-align:left;padding:8px;border:1px solid #ddd;">Status</th>`;
      html += `<th ${s}="text-align:center;padding:8px;border:1px solid #ddd;">Batt/Pads Exp</th>`;
      html += `<th ${s}="text-align:left;padding:8px;border:1px solid #ddd;">Image</th></tr>`;
      for (const d of sec.devices) {
        const loc = [d.site, d.building, d.placement].filter(Boolean).join(" / ") || d.location || "—";
        const imgUrl = d.image_url || "";
        const battExp = d.battery_expiration || "—";
        const padExp = d.pad_expiration || "—";
        const capturedAt = d.captured_at ? new Date(d.captured_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "";
        html += `<tr>`;
        html += `<td ${s}="padding:8px;border:1px solid #ddd;font-weight:bold;">${d.sentinel_id}</td>`;
        html += `<td ${s}="padding:8px;border:1px solid #ddd;">${loc}</td>`;
        html += `<td ${s}="padding:8px;border:1px solid #ddd;">${customDetails[d.sentinel_id] !== undefined ? customDetails[d.sentinel_id] : (d.days_summary || d.detailed_status || "—")}</td>`;
        html += `<td ${s}="padding:8px;border:1px solid #ddd;text-align:center;font-size:11px;">Batt: ${battExp}<br>Pads: ${padExp}</td>`;
        html += `<td ${s}="padding:8px;border:1px solid #ddd;">`;
        if (imgUrl) {
          html += `<img src="${imgUrl}" alt="${d.sentinel_id}" ${s}="max-width:120px;max-height:80px;" />`;
          if (capturedAt) html += `<div ${s}="font-size:10px;color:#888;margin-top:2px;">${capturedAt}</div>`;
        } else {
          html += "—";
        }
        html += `</td></tr>`;
      }
      html += `</table>`;

      html += `<p ${s}="font-size:14px;font-weight:bold;">${sec.action}:</p>`;
      html += `<p ${s}="font-size:14px;">${sec.actionText.replace(/\n/g, '<br>')}</p>`;
    }

    // Contact info
    html += `<hr ${s}="border:none;border-top:1px solid #ddd;margin:20px 0;">`;
    html += `<p ${s}="font-size:14px;">Our Service Department Phone Number: <strong>1-888-223-2939</strong></p>`;
    html += `<p ${s}="font-size:14px;">Our Service Department Email Address: <strong>Info@cardiac-solutions.net</strong></p>`;
    html += `</div>`;
    return html;
  };

  const handleSend = async () => {
    if (!toEmail) { toast.error("Customer email (TO) is required"); return; }
    setSending(true);
    try {
      const token = localStorage.getItem("token");
      // Collect devices that will be included in the email
      const emailDevices = [];
      for (const [, devs] of Object.entries(filteredGrouped)) {
        for (const d of devs) {
          emailDevices.push({
            sentinel_id: d.sentinel_id,
            detailed_status: d.detailed_status || "UNKNOWN",
            location: [d.site, d.building, d.placement].filter(Boolean).join(" / ") || d.location || "",
            model: d.model || "",
          });
        }
      }
      const res = await fetch(`${API}/support/send-notification`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          subscriber,
          to_email: toEmail,
          cc_email: ccEmail,
          bcc_emails: bccEmails,
          subject,
          html_body: buildEmailHtml(),
          devices: emailDevices,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Notification sent to ${toEmail}`);
        // Save contact info
        await fetch(`${API}/subscriber-contacts/${encodeURIComponent(subscriber)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ to_email: toEmail, cc_email: ccEmail, bcc_emails: bccEmails }),
        });
        onSent?.();
        onClose();
      } else {
        toast.error(data.detail || data.message || "Failed to send");
      }
    } catch (e) {
      toast.error("Network error");
    }
    setSending(false);
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-[#0a0f1c] border border-cyan-500/30 rounded-sm w-[1100px] max-w-[95vw] max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()} data-testid="notification-modal">
        {/* Header */}
        <div className="p-5 border-b border-cyan-500/15 flex-shrink-0">
          <div className="flex justify-between items-center">
            <h2 className="font-orbitron text-lg text-cyan-400 tracking-wider">Send notification - {subscriber}</h2>
            <button onClick={onClose} className="text-slate-500 hover:text-white"><X className="w-5 h-5" /></button>
          </div>
          {/* Email type selector */}
          <div className="mt-3">
            <label className="font-orbitron text-[8px] tracking-wider text-slate-500 block mb-1">EMAIL TYPE</label>
            <select
              value={emailType}
              onChange={e => setEmailType(e.target.value)}
              className="w-full px-3 py-2 rounded-sm bg-slate-900 border border-slate-700 text-white font-orbitron text-xs"
              data-testid="email-type-select"
            >
              {typeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        {/* Addresses */}
        <div className="px-5 py-3 border-b border-cyan-500/15 flex-shrink-0">
          <div className="font-orbitron text-[8px] tracking-wider text-slate-500 mb-2">ADDRESSES - CONFIRM BEFORE SENDING</div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-orbitron text-[9px] text-cyan-400 w-[100px] flex-shrink-0">Customer (To):</span>
              <input value={toEmail} onChange={e => setToEmail(e.target.value)} placeholder="subscriber@email.com"
                className="flex-1 px-2 py-1 rounded-sm bg-slate-900 border border-slate-700 text-white text-xs"
                data-testid="to-email-input" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-orbitron text-[9px] text-cyan-400 w-[100px] flex-shrink-0">Sales rep (CC):</span>
              <input value={ccEmail} onChange={e => setCcEmail(e.target.value)} placeholder="salesrep@cardiac-solutions.net"
                className="flex-1 px-2 py-1 rounded-sm bg-slate-900 border border-slate-700 text-white text-xs"
                data-testid="cc-email-input" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-orbitron text-[9px] text-cyan-400 w-[100px] flex-shrink-0">BCC:</span>
              <input value={bccEmails} onChange={e => setBccEmails(e.target.value)} placeholder="internal1@email.com, internal2@email.com"
                className="flex-1 px-2 py-1 rounded-sm bg-slate-900 border border-slate-700 text-white text-xs"
                data-testid="bcc-email-input" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-orbitron text-[9px] text-cyan-400 w-[100px] flex-shrink-0">Subject:</span>
              <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Email subject line"
                className="flex-1 px-2 py-1 rounded-sm bg-slate-900 border border-slate-700 text-white text-xs"
                data-testid="subject-input" />
            </div>
          </div>
        </div>

        {/* Email Preview */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          <div className="font-orbitron text-[8px] tracking-wider text-amber-400 mb-2">
            EMAIL PREVIEW - EDIT DETAILS PER AED &amp; REMOVE WRONG AEDs WITH THE ICON
          </div>
          {loadingDevices ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 text-cyan-400 animate-spin" /><span className="ml-2 text-slate-400 text-xs">Loading devices...</span></div>
          ) : (
          <div className="bg-white rounded-sm p-6 text-slate-900 text-sm">
            <p className="mb-2">Hello <strong>{contact?.contact_name || subscriber}</strong>,</p>
            <p className="mb-2 text-[13px]">During our recent review of your AED(s), we identified issues as outlined below.</p>
            <p className="mb-4 text-[13px]">Resolving these issues is critical to effectively monitor the health of your device. This also ensures that your units are ready to be used in an emergency.</p>

            {(() => {
              // Merge sections same as email builder
              const merged = {};
              for (const [status, devs] of Object.entries(filteredGrouped)) {
                const sec = {
                  "EXPIRED B/P": { title: "AED Batteries and Pads Expired/Expiring", action: "Next Steps", actionText: "Please contact our team by phone or email as soon as possible to arrange for replacement options for these devices." },
                  "EXPIRING BATT/PADS": { title: "AED Batteries and Pads Expired/Expiring", action: "Next Steps", actionText: "Please contact our team by phone or email as soon as possible to arrange for replacement options for these devices." },
                  "REPOSITION": { title: "AED(s) Alignment Issues", action: "Required Action", actionText: "Please take a moment as soon as possible to inspect the AED(s) noted above." },
                  "NOT PRESENT": { title: "AED(s) Missing", action: "Required Action", actionText: "Please place it back in its original location. If missing, please notify us." },
                  "NOT READY": { title: "AED(s) Not Ready", action: "Required Action", actionText: "Please inspect the AED(s) noted above and ensure they are ready for use." },
                  "UNKNOWN": { title: "AED(s) Status Unknown", action: "Required Action", actionText: "We are unable to determine the current status of these units." },
                }[status] || { title: status, action: "Required Action", actionText: "Please inspect." };
                if (!merged[sec.title]) merged[sec.title] = { ...sec, devices: [] };
                merged[sec.title].devices.push(...devs);
              }
              return Object.entries(merged).map(([title, sec]) => (
                <div key={title} className="mb-4">
                  <h3 className="font-bold text-slate-800 border-b border-slate-200 pb-1 mb-2 text-sm">{title}:</h3>
                  <table className="w-full text-xs border-collapse mb-2">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="text-left p-2 border border-slate-200">Serial Number</th>
                        <th className="text-left p-2 border border-slate-200">Location</th>
                        <th className="text-left p-2 border border-slate-200">Details <span className="text-blue-400 font-normal text-[9px]">(editable)</span></th>
                        <th className="text-center p-2 border border-slate-200">Batt/Pads Exp</th>
                        <th className="text-left p-2 border border-slate-200 w-28">Image</th>
                        <th className="w-8 border border-slate-200"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {sec.devices.map((d, idx) => {
                        const loc = [d.site, d.building, d.placement].filter(Boolean).join(" / ") || d.location || "—";
                        const capturedAt = d.captured_at ? new Date(d.captured_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";
                        const currentVal = customDetails[d.sentinel_id] !== undefined ? customDetails[d.sentinel_id] : (d.days_summary || d.detailed_status || "—");
                        return (
                          <tr key={d.sentinel_id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setDrawerDevice(d)}>
                            <td className="p-2 border border-slate-200 font-bold text-blue-700 hover:underline">{d.sentinel_id}</td>
                            <td className="p-2 border border-slate-200 text-[11px]">{loc}</td>
                            <td className="p-2 border border-slate-200 text-[11px]" onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
                              <textarea
                                value={currentVal}
                                onChange={e => { e.stopPropagation(); setCustomDetails(prev => ({ ...prev, [d.sentinel_id]: e.target.value })); }}
                                onClick={e => e.stopPropagation()}
                                onMouseDown={e => e.stopPropagation()}
                                onFocus={e => e.stopPropagation()}
                                className="w-full min-w-[120px] px-1.5 py-1 rounded border border-blue-300 bg-blue-50 text-slate-800 text-[11px] resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
                                rows={2}
                                data-testid={`edit-details-${d.sentinel_id}`}
                              />
                              {idx === 0 && sec.devices.length > 1 && (
                                <button
                                  onClick={e => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    const val = customDetails[d.sentinel_id] !== undefined ? customDetails[d.sentinel_id] : (d.days_summary || d.detailed_status || "—");
                                    const updates = {};
                                    sec.devices.forEach(dev => { updates[dev.sentinel_id] = val; });
                                    setCustomDetails(prev => ({ ...prev, ...updates }));
                                  }}
                                  onMouseDown={e => e.stopPropagation()}
                                  type="button"
                                  className="mt-1 text-[9px] px-2 py-0.5 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold"
                                  data-testid="apply-to-all-btn"
                                >
                                  Apply to All ({sec.devices.length})
                                </button>
                              )}
                            </td>
                            <td className="p-2 border border-slate-200 text-[10px] text-center">
                              <div>Batt: {d.battery_expiration || "—"}</div>
                              <div>Pads: {d.pad_expiration || "—"}</div>
                            </td>
                            <td className="p-2 border border-slate-200" onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
                              {d.image_url ? (
                                <div>
                                  <img src={d.image_url} alt={d.sentinel_id} className="max-w-[100px] max-h-[60px] rounded-sm" loading="lazy" />
                                  {capturedAt && <div className="text-[9px] text-slate-400 mt-0.5">{capturedAt}</div>}
                                  <button
                                    onClick={e => { e.stopPropagation(); setImageHistoryId(d.sentinel_id); }}
                                    onMouseDown={e => e.stopPropagation()}
                                    type="button"
                                    className="mt-1 w-full flex items-center justify-center gap-1 px-1.5 py-0.5 bg-red-600 hover:bg-red-500 text-white rounded-sm transition-colors"
                                    data-testid={`email-img-history-${d.sentinel_id}`}
                                  >
                                    <History className="w-2.5 h-2.5" />
                                    <span className="text-[7px] font-bold tracking-wider">HISTORY</span>
                                  </button>
                                </div>
                              ) : (
                                <span className="text-slate-300 text-[10px]">No image</span>
                              )}</td>
                            <td className="p-2 border border-slate-200 text-center">
                              <button
                                onClick={(e) => { e.stopPropagation(); setRemovedDevices(prev => new Set([...prev, d.sentinel_id])); }}
                                className="text-red-400 hover:text-red-600"
                                data-testid={`remove-device-${d.sentinel_id}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <p className="text-xs"><strong>{sec.action}:</strong> {sec.actionText}</p>
                </div>
              ));
            })()}

            {Object.keys(filteredGrouped).length === 0 && (
              <div className="text-center text-slate-400 py-4">No devices to include</div>
            )}

            <hr className="my-3 border-slate-200" />
            <p className="text-[12px]">Our Service Department Phone Number: <strong>1-888-223-2939</strong></p>
            <p className="text-[12px]">Our Service Department Email Address: <strong>Info@cardiac-solutions.net</strong></p>
          </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-cyan-500/15 flex justify-end gap-3 flex-shrink-0">
          <button onClick={onClose} className="font-orbitron text-xs px-6 py-2 border border-slate-600 text-slate-400 rounded-sm hover:bg-slate-800">
            CANCEL
          </button>
          <button
            onClick={handleSend}
            disabled={sending || activeDevices.length === 0}
            className="font-orbitron text-xs px-6 py-2 border border-cyan-500/50 text-cyan-400 rounded-sm hover:bg-cyan-500/10 disabled:opacity-50 flex items-center gap-2"
            data-testid="send-email-btn"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            SEND EMAIL
          </button>
        </div>
      </div>
      {drawerDevice && <DeviceDrawer device={drawerDevice} onClose={() => setDrawerDevice(null)} />}
      {imageHistoryId && <ImageHistoryModal sentinelId={imageHistoryId} subscriber={subscriber} onClose={() => setImageHistoryId(null)} />}
    </div>
  );
}

function StatusFeedbackModal({ device, subscriber, onClose }) {
  const [correctStatus, setCorrectStatus] = useState(device.detailed_status || "");
  const [comments, setComments] = useState("");
  const [saving, setSaving] = useState(false);

  const statusOptions = ["READY", "EXPIRED B/P", "EXPIRING BATT/PADS", "NOT READY", "REPOSITION", "UNKNOWN", "NOT PRESENT", "LOST CONTACT"];
  const capturedAt = device.captured_at ? new Date(device.captured_at).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

  const submit = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      // Call local feedback endpoint
      await fetch(`${API}/support/device-feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sentinel_id: device.sentinel_id, subscriber, current_status: device.detailed_status, correct_status: correctStatus, comments }),
      });
      // Also call external Readisys integration API
      const extRes = await fetch(`${API}/support/aed-status-feedback-external`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ subscriber, sentinel_id: device.sentinel_id, reported_status: correctStatus, comment: comments }),
      });
      if (extRes.ok) {
        const extData = await extRes.json();
        toast.success(extData.message || "Feedback submitted and email sent");
      } else {
        toast.success("Feedback saved locally (external sync pending)");
      }
      onClose();
    } catch { toast.error("Failed to submit"); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-[70] flex items-center justify-center" onClick={onClose}>
      <div className="bg-[#0a0f1c] border border-cyan-500/30 rounded-sm w-[480px] max-w-[95vw] max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()} data-testid="feedback-modal">
        <div className="p-5 border-b border-cyan-500/15 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Edit3 className="w-4 h-4 text-cyan-400" />
            <span className="font-orbitron text-sm text-cyan-400 tracking-wider">Report correct AED status</span>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex gap-4">
            {device.image_url ? (
              <img src={device.image_url} alt={device.sentinel_id} className="w-28 h-28 object-cover rounded-sm border border-slate-700" />
            ) : (
              <div className="w-28 h-28 bg-slate-900 border border-slate-700 rounded-sm flex items-center justify-center text-slate-600 text-[9px]">No image</div>
            )}
            <div className="space-y-2 flex-1">
              <div><div className="font-orbitron text-[7px] text-slate-500 tracking-wider">SUBSCRIBER</div><div className="text-white text-xs">{subscriber}</div></div>
              <div><div className="font-orbitron text-[7px] text-slate-500 tracking-wider">AED ID</div><div className="text-white text-xs font-bold">{device.sentinel_id}</div></div>
              <div><div className="font-orbitron text-[7px] text-slate-500 tracking-wider">AED MODEL</div><div className="text-white text-xs">{device.model || "—"}</div></div>
              <div><div className="font-orbitron text-[7px] text-slate-500 tracking-wider">IMAGE DATE</div><div className="text-white text-xs">{capturedAt}</div></div>
              <div><div className="font-orbitron text-[7px] text-slate-500 tracking-wider">CURRENT STATUS</div><div className="text-red-400 text-xs font-bold">{device.detailed_status || "—"}</div></div>
            </div>
          </div>
          <div>
            <div className="font-orbitron text-[8px] text-slate-400 tracking-wider mb-2">CORRECT STATUS</div>
            <select value={correctStatus} onChange={e => setCorrectStatus(e.target.value)}
              className="w-full px-3 py-2 rounded-sm bg-slate-900 border border-slate-700 text-white text-xs" data-testid="correct-status-select">
              {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <div className="font-orbitron text-[8px] text-slate-400 tracking-wider mb-2">COMMENTS</div>
            <textarea value={comments} onChange={e => setComments(e.target.value)} placeholder="Add any notes about what you see in the image..."
              className="w-full px-3 py-2 rounded-sm bg-slate-900 border border-slate-700 text-white text-xs placeholder-slate-600 resize-none h-24" data-testid="feedback-comments" />
          </div>
          <div className="flex justify-end">
            <button onClick={submit} disabled={saving}
              className="font-orbitron text-[9px] px-5 py-2 bg-cyan-500/15 border border-cyan-500/40 text-cyan-400 rounded-sm hover:bg-cyan-500/25 disabled:opacity-50 flex items-center gap-2"
              data-testid="submit-feedback-btn">
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Edit3 className="w-3 h-3" />} Submit feedback
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ImageHistoryModal({ sentinelId, subscriber, onClose }) {
  const [images, setImages] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [skip, setSkip] = useState(0);
  const limit = 10;

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API}/support/aed-image-history/${encodeURIComponent(subscriber || "unknown")}/${encodeURIComponent(sentinelId)}?limit=${limit}&skip=${skip}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (skip === 0) {
            setImages(data.images || []);
          } else {
            setImages(prev => [...prev, ...(data.images || [])]);
          }
          setTotal(data.total || 0);
        }
      } catch {}
      setLoading(false);
    })();
  }, [sentinelId, subscriber, skip]);

  return (
    <div className="fixed inset-0 bg-black/80 z-[80] flex items-center justify-center" onClick={onClose}>
      <div className="bg-[#0f1729] border border-cyan-500/30 rounded-sm w-[500px] max-w-[90vw] max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()} data-testid="image-history-modal">
        <div className="p-4 border-b border-cyan-500/15 flex justify-between items-center flex-shrink-0">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-red-400" />
            <div>
              <span className="font-orbitron text-sm text-white tracking-wider">Image history</span>
              <span className="text-slate-400 text-sm ml-2">— {sentinelId}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 text-cyan-400 animate-spin" /></div>
          ) : images.length === 0 ? (
            <div className="text-center text-slate-500 py-8 font-orbitron text-[10px]">No image history available yet. Images are stored as they are captured.</div>
          ) : (
            <>
              <div className="text-[10px] text-slate-400 mb-3 font-orbitron">
                Showing {images.length} of {total} images (most recent first).
              </div>
              <div className="space-y-3">
                {images.map((img, i) => {
                  const date = img.captured_at ? new Date(img.captured_at).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
                  return (
                    <div key={img.job_id || i} className="flex gap-3 bg-slate-800/50 border border-slate-700/30 rounded-sm overflow-hidden">
                      <div className="flex-shrink-0 w-24 h-20 bg-slate-900">
                        <img
                          src={img.proxy_url}
                          alt={`${sentinelId} - ${date}`}
                          className="w-24 h-20 object-cover"
                          loading="lazy"
                          onError={(e) => { e.target.style.display = "none"; }}
                        />
                      </div>
                      <div className="flex items-center py-2">
                        <div>
                          <div className="text-[11px] text-slate-200 font-mono">{date}</div>
                          {img.status && <div className="text-[9px] text-amber-400 font-bold mt-0.5">{img.status}</div>}
                          {img.confidence != null && <div className="text-[8px] text-slate-500 mt-0.5">Confidence: {(img.confidence * 100).toFixed(0)}%</div>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {images.length < total && (
                <div className="mt-3 text-center">
                  <button
                    onClick={() => setSkip(images.length)}
                    className="font-orbitron text-[8px] px-4 py-1.5 border border-cyan-500/30 text-cyan-400 rounded-sm hover:bg-cyan-500/10"
                  >
                    Load more ({total - images.length} remaining)
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function DeviceListModal({ subscriber, issueType, onClose }) {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedbackDevice, setFeedbackDevice] = useState(null);
  const [imageHistoryId, setImageHistoryId] = useState(null);
  const [deviceDetails, setDeviceDetails] = useState({});
  const [deviceNotes, setDeviceNotes] = useState({});
  const [deviceNotifHistory, setDeviceNotifHistory] = useState({});
  const [savingNote, setSavingNote] = useState(null);

  const issueLabels = { expired_bp: "EXPIRED B/P", expiring_bp: "EXPIRING BATT/PADS", not_ready: "NOT READY", reposition: "REPOSITION", not_present: "NOT PRESENT", unknown: "UNKNOWN" };
  const issueStatuses = {
    expired_bp: ["EXPIRED B/P"],
    expiring_bp: ["EXPIRING BATT/PADS"],
    not_ready: ["NOT READY"],
    reposition: ["REPOSITION"],
    not_present: ["NOT PRESENT"],
    unknown: ["UNKNOWN"],
  };

  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API}/support/subscriber/${encodeURIComponent(subscriber)}/devices`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          const all = data.devices || [];
          const statuses = issueStatuses[issueType] || [];
          const filtered = all.filter(d => statuses.includes(d.detailed_status));
          setDevices(filtered);
          // Fetch AI details for each device
          filtered.forEach(async (d) => {
            try {
              const detRes = await fetch(`${API}/support/device-detail/${encodeURIComponent(subscriber)}/${d.sentinel_id}`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              if (detRes.ok) {
                const det = await detRes.json();
                setDeviceDetails(prev => ({ ...prev, [d.sentinel_id]: det }));
              }
            } catch {}
            // Fetch notes
            try {
              const notesRes = await fetch(`${API}/support/device-notes/${d.sentinel_id}`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              if (notesRes.ok) {
                const n = await notesRes.json();
                setDeviceNotes(prev => ({ ...prev, [d.sentinel_id]: n.notes || "" }));
              }
            } catch {}
            // Fetch notification history for this device
            try {
              const nhRes = await fetch(`${API}/support/device-notification-history/${d.sentinel_id}`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              if (nhRes.ok) {
                const nh = await nhRes.json();
                setDeviceNotifHistory(prev => ({ ...prev, [d.sentinel_id]: nh }));
              }
            } catch {}
          });
        }
      } catch {}
      setLoading(false);
    })();
  }, [subscriber, issueType]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveNote = async (sentinelId) => {
    setSavingNote(sentinelId);
    try {
      const token = localStorage.getItem("token");
      await fetch(`${API}/support/device-notes/${sentinelId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ notes: deviceNotes[sentinelId] || "", subscriber }),
      });
      toast.success("Comment saved");
    } catch { toast.error("Failed to save"); }
    setSavingNote(null);
  };

  const statusBadge = (status) => {
    const colors = {
      "READY": "bg-green-500/20 text-green-400 border-green-500/30",
      "NOT READY": "bg-red-500/20 text-red-400 border-red-500/30",
      "EXPIRED B/P": "bg-red-500/20 text-red-400 border-red-500/30",
      "EXPIRING BATT/PADS": "bg-amber-500/20 text-amber-400 border-amber-500/30",
      "REPOSITION": "bg-purple-500/20 text-purple-400 border-purple-500/30",
      "NOT PRESENT": "bg-orange-500/20 text-orange-400 border-orange-500/30",
      "UNKNOWN": "bg-slate-500/20 text-slate-400 border-slate-500/30",
    };
    return colors[status] || "bg-slate-500/20 text-slate-400 border-slate-500/30";
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-[#0a0f1c] border border-cyan-500/30 rounded-sm w-[800px] max-w-[95vw] max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()} data-testid="device-list-modal">
        <div className="p-5 border-b border-cyan-500/15 flex justify-between items-center flex-shrink-0">
          <div>
            <div className="text-white text-lg font-bold">{subscriber} — {issueLabels[issueType] || issueType} Devices</div>
            <div className="text-slate-400 text-xs mt-0.5">Showing {devices.length} of {devices.length} device{devices.length !== 1 ? "s" : ""}</div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-cyan-400 animate-spin" /></div>
          ) : devices.length === 0 ? (
            <div className="text-center text-slate-500 py-12 font-orbitron text-[10px]">NO DEVICES FOUND</div>
          ) : (
            <div className="space-y-5">
              {devices.map(d => {
                const loc = [d.site, d.building, d.placement].filter(Boolean).join(" · ") || "—";
                const capturedAt = d.captured_at ? new Date(d.captured_at).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
                const battColor = (d.battery_level_pct ?? 0) > 50 ? "#22c55e" : (d.battery_level_pct ?? 0) > 20 ? "#f59e0b" : "#ef4444";
                const cellColor = d.cellular_signal_quality === "HIGH" ? "#22c55e" : d.cellular_signal_quality === "MEDIUM" ? "#f59e0b" : "#ef4444";
                const det = deviceDetails[d.sentinel_id] || {};
                const note = deviceNotes[d.sentinel_id] ?? "";

                return (
                  <div key={d.sentinel_id} className="border border-slate-700/50 bg-[#0d1525] rounded-sm p-5" data-testid={`device-card-${d.sentinel_id}`}>
                    {/* Top row: Image + Info */}
                    <div className="flex gap-4">
                      <div className="flex-shrink-0 w-20 h-20">
                        {d.image_url ? (
                          <img src={d.image_url} alt={d.sentinel_id} className="w-20 h-20 object-cover rounded-sm border border-slate-700" loading="lazy" />
                        ) : (
                          <div className="w-20 h-20 bg-slate-800 border border-slate-700 rounded-sm flex items-center justify-center text-slate-600 text-[8px]">No image</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-white font-bold text-sm">{d.sentinel_id}</span>
                          <span className="text-red-400 text-xs">Last updated <span className="font-bold">{capturedAt}</span></span>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className="text-xs text-slate-400">Assigned status:</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded border font-bold ${statusBadge(d.detailed_status)}`}>{d.detailed_status}</span>
                          {det.status_source && (
                            <span className="text-[10px] px-2 py-0.5 rounded border border-slate-600 bg-slate-800 text-slate-300">SOURCE: <span className="font-bold uppercase">{det.status_source}</span></span>
                          )}
                        </div>
                        {det.original_readiness && (
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-slate-400">Original readiness:</span>
                            <span className="text-[10px] px-2 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-400">{det.original_readiness}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-4 mt-2">
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-slate-500 uppercase tracking-wider">Battery</span>
                            <Battery className="w-3.5 h-3.5" style={{ color: battColor }} />
                            <span className="text-[11px] font-bold" style={{ color: battColor }}>{d.battery_level_pct != null ? `${d.battery_level_pct}%` : "—"}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-slate-500 uppercase tracking-wider">Cellular</span>
                            <Wifi className="w-3.5 h-3.5" style={{ color: cellColor }} />
                            <span className="text-[11px] font-bold" style={{ color: cellColor }}>{d.cellular_signal_label || d.cellular_signal_quality || "—"}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Action buttons row */}
                    <div className="flex items-center gap-2 mt-3">
                      <button
                        onClick={() => setImageHistoryId(d.sentinel_id)}
                        className="w-8 h-8 flex items-center justify-center bg-red-600 hover:bg-red-500 text-white rounded-sm transition-colors"
                        data-testid={`img-history-btn-${d.sentinel_id}`}
                        title="Image History"
                      >
                        <History className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setFeedbackDevice(d)}
                        className="w-8 h-8 flex items-center justify-center bg-slate-700 hover:bg-slate-600 text-white rounded-sm transition-colors"
                        data-testid={`feedback-btn-${d.sentinel_id}`}
                        title="Correct Status"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Location + Model + Expiry */}
                    <div className="mt-3 text-slate-400 text-xs">{loc}</div>
                    <div className="text-slate-400 text-xs mt-0.5">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider mr-1">AED Model</span>
                      <span className="text-white">{d.model || "—"}</span>
                    </div>
                    <div className="text-slate-500 text-xs mt-0.5">B: {d.battery_expiration || "—"} P: {d.pad_expiration || "—"}</div>

                    {/* AI Explanation */}
                    {det.detailed_status_explanation && (
                      <div className="mt-4">
                        <div className="font-orbitron text-[9px] text-slate-400 tracking-wider mb-1.5 uppercase">AI Explanation</div>
                        <div className="text-slate-300 text-xs leading-relaxed">{det.detailed_status_explanation}</div>
                      </div>
                    )}

                    {/* Notification History for this AED */}
                    {(() => {
                      const nh = deviceNotifHistory[d.sentinel_id];
                      if (!nh || !nh.notified) return null;
                      return (
                        <div className="mt-4">
                          <div className="font-orbitron text-[9px] text-amber-400 tracking-wider mb-1.5 uppercase">Notification History ({nh.notification_count} sent)</div>
                          <div className="space-y-2">
                            {(nh.notification_dates || []).map((nd, idx) => {
                              const d2 = nd.date ? new Date(nd.date).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "—";
                              const fmt = (s) => s ? new Date(s).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : null;
                              const opens = nd.open_count || 0;
                              const clicks = nd.click_count || 0;
                              return (
                                <div key={idx} className="text-xs">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <div className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                                    <span className="text-slate-300">{d2}</span>
                                    <span className="text-slate-500">by {nd.sent_by || "—"}</span>
                                    {nd.to_email && <span className="text-slate-600 text-[10px]">to {nd.to_email}</span>}
                                  </div>
                                  {(nd.to_email || nd.delivered_at || opens > 0 || clicks > 0 || nd.bounced) && (
                                    <div className="ml-4 mt-1 flex items-center gap-1 flex-wrap">
                                      {nd.bounced ? (
                                        <span title={nd.bounce_reason || "Bounced"} className="text-[8px] px-1.5 py-0.5 bg-red-500/15 text-red-400 border border-red-500/30 rounded-sm font-orbitron">BOUNCED</span>
                                      ) : nd.spam_reported ? (
                                        <span className="text-[8px] px-1.5 py-0.5 bg-orange-500/15 text-orange-400 border border-orange-500/30 rounded-sm font-orbitron">SPAM</span>
                                      ) : nd.delivered_at ? (
                                        <span title={`Delivered ${fmt(nd.delivered_at)}`} className="text-[8px] px-1.5 py-0.5 bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 rounded-sm font-orbitron">DELIV {fmt(nd.delivered_at)}</span>
                                      ) : nd.sg_message_id ? (
                                        <span className="text-[8px] px-1.5 py-0.5 bg-slate-700/40 text-slate-400 border border-slate-600/40 rounded-sm font-orbitron">SENT</span>
                                      ) : null}
                                      {opens > 0 && (
                                        <span title={`First opened ${fmt(nd.first_opened_at)}${nd.last_opened_at && nd.last_opened_at !== nd.first_opened_at ? `, last opened ${fmt(nd.last_opened_at)}` : ""}`} className="text-[8px] px-1.5 py-0.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-sm font-orbitron">OPENED {opens > 1 ? `×${opens} ` : ""}{fmt(nd.first_opened_at)}</span>
                                      )}
                                      {clicks > 0 && (
                                        <span title={`Last clicked ${fmt(nd.last_clicked_at)}`} className="text-[8px] px-1.5 py-0.5 bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded-sm font-orbitron">CLICKED {clicks > 1 ? `×${clicks} ` : ""}{fmt(nd.last_clicked_at)}</span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                            {nh.resolved && (
                              <div className="flex items-center gap-2 text-xs mt-1">
                                <div className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
                                <span className="text-green-400 font-bold">Resolved</span>
                                {nh.resolved_at && <span className="text-slate-500">{new Date(nh.resolved_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>}
                              </div>
                            )}
                            {!nh.resolved && nh.partially_resolved && (
                              <div className="flex items-center gap-2 text-xs mt-1">
                                <div className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                                <span className="text-amber-400 font-bold">Partially Resolved</span>
                                {nh.partially_resolved_at && <span className="text-slate-500">{new Date(nh.partially_resolved_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Internal Comments */}
                    <div className="mt-4">
                      <div className="font-orbitron text-[9px] text-slate-400 tracking-wider mb-1.5 uppercase">Internal Comments</div>
                      <textarea
                        value={note}
                        onChange={e => setDeviceNotes(prev => ({ ...prev, [d.sentinel_id]: e.target.value }))}
                        placeholder="Add internal comment (visible to anyone who opens this device)"
                        className="w-full px-3 py-2 rounded-sm bg-slate-900 border border-slate-700 text-white text-xs placeholder-slate-600 resize-none h-20"
                        data-testid={`device-notes-${d.sentinel_id}`}
                      />
                      <button
                        onClick={() => saveNote(d.sentinel_id)}
                        disabled={savingNote === d.sentinel_id}
                        className="text-[10px] text-slate-400 hover:text-cyan-400 mt-1 transition-colors disabled:opacity-50"
                      >
                        {savingNote === d.sentinel_id ? "Saving..." : "Add comment"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        {feedbackDevice && <StatusFeedbackModal device={feedbackDevice} subscriber={subscriber} onClose={() => setFeedbackDevice(null)} />}
        {imageHistoryId && <ImageHistoryModal sentinelId={imageHistoryId} subscriber={subscriber} onClose={() => setImageHistoryId(null)} />}
      </div>
    </div>
  );
}

function ContactsModal({ subscribers, onClose }) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editSub, setEditSub] = useState(null);
  const [form, setForm] = useState({ to_email: "", cc_email: "", bcc_emails: "", sales_rep: "" });
  const [search, setSearch] = useState("");

  const fetchContacts = useCallback(async () => {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API}/subscriber-contacts`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setContacts(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  const saveContact = async () => {
    if (!editSub) return;
    const token = localStorage.getItem("token");
    await fetch(`${API}/subscriber-contacts/${encodeURIComponent(editSub)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(form),
    });
    toast.success(`Saved contacts for ${editSub}`);
    setEditSub(null);
    fetchContacts();
  };

  // Merge all subscribers (from dashboard data) with existing contacts
  const contactMap = {};
  for (const c of contacts) contactMap[c.subscriber] = c;
  const allSubNames = [...new Set([
    ...(subscribers || []).map(s => s.subscriber),
    ...contacts.map(c => c.subscriber),
  ])].sort();

  const filteredSubs = allSubNames.filter(n => !search || n.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-[#0a0f1c] border border-cyan-500/30 rounded-sm p-6 w-[750px] max-w-[95vw] max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()} data-testid="contacts-modal">
        <div className="flex justify-between items-center mb-4 flex-shrink-0">
          <div>
            <div className="font-orbitron text-sm text-cyan-400 tracking-wider">SUBSCRIBER CONTACTS</div>
            <div className="text-[9px] text-slate-500 mt-0.5">{allSubNames.length} subscribers</div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        {editSub ? (
          <div className="space-y-3">
            <div className="font-orbitron text-xs text-cyan-400 mb-2">{editSub}</div>
            {[
              { key: "to_email", label: "Customer Email (TO)", placeholder: "subscriber@company.com" },
              { key: "cc_email", label: "Sales Rep Email (CC)", placeholder: "rep@cardiac-solutions.net" },
              { key: "bcc_emails", label: "BCC (comma-separated)", placeholder: "internal1@email.com, internal2@email.com" },
              { key: "sales_rep", label: "Sales Rep Name", placeholder: "Jon Seale" },
            ].map(f => (
              <div key={f.key}>
                <label className="font-orbitron text-[8px] text-slate-500 mb-1 block">{f.label}</label>
                <input
                  value={form[f.key]}
                  onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                  placeholder={f.placeholder}
                  className="w-full px-3 py-2 rounded-sm bg-slate-900 border border-slate-700 text-white text-xs placeholder-slate-600"
                  data-testid={`contact-${f.key}`}
                />
              </div>
            ))}
            <div className="flex gap-2 mt-3">
              <button onClick={saveContact} className="font-orbitron text-[9px] px-4 py-1.5 border border-cyan-500/40 text-cyan-400 rounded-sm hover:bg-cyan-500/10" data-testid="save-contact-btn">SAVE</button>
              <button onClick={() => setEditSub(null)} className="font-orbitron text-[9px] px-4 py-1.5 border border-slate-600 text-slate-400 rounded-sm hover:bg-slate-800">BACK</button>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-3 flex-shrink-0">
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search subscribers..."
                className="w-full px-3 py-2 rounded-sm bg-slate-900 border border-slate-700 text-white text-xs placeholder-slate-600 font-orbitron"
                data-testid="contacts-search"
              />
            </div>
            <div className="overflow-y-auto flex-1">
              {loading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-cyan-400 animate-spin" /></div>
              ) : (
                <div className="space-y-1.5">
                  {filteredSubs.map(name => {
                    const c = contactMap[name];
                    const hasContact = c && c.to_email;
                    return (
                      <div key={name} className="border border-slate-700/50 bg-slate-900/50 rounded-sm p-2.5 flex justify-between items-center">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="font-orbitron text-[10px] text-white truncate">{name}</div>
                            {hasContact ? (
                              <span className="text-[7px] px-1.5 py-0.5 bg-green-500/15 text-green-400 rounded-sm font-orbitron">SET</span>
                            ) : (
                              <span className="text-[7px] px-1.5 py-0.5 bg-red-500/15 text-red-400 rounded-sm font-orbitron">EMPTY</span>
                            )}
                          </div>
                          {hasContact && (
                            <div className="text-[8px] text-slate-400 mt-0.5 truncate">TO: {c.to_email} {c.cc_email ? `| CC: ${c.cc_email}` : ''}</div>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            setEditSub(name);
                            setForm({
                              to_email: c?.to_email || "",
                              cc_email: c?.cc_email || "",
                              bcc_emails: c?.bcc_emails || "",
                              sales_rep: c?.sales_rep || "",
                            });
                          }}
                          className="font-orbitron text-[8px] px-2 py-1 border border-cyan-500/30 text-cyan-400 rounded-sm hover:bg-cyan-500/10 flex-shrink-0 ml-2"
                          data-testid={`edit-contact-${name}`}
                        >
                          {hasContact ? "EDIT" : "ADD"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function NotifiedAedsModal({ onClose, onRefresh }) {
  const [aeds, setAeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all, unresolved, resolved
  const [sortBy, setSortBy] = useState("days"); // days, alpha, notifications

  const fetchAeds = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const params = new URLSearchParams();
      if (filter) params.set("subscriber", filter);
      if (statusFilter !== "all") params.set("status_filter", statusFilter);
      const res = await fetch(`${API}/support/notified-aeds?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAeds(data.notified_aeds || []);
      }
    } catch {}
    setLoading(false);
  }, [filter, statusFilter]);

  useEffect(() => { fetchAeds(); }, [fetchAeds]);

  const sorted = [...aeds].sort((a, b) => {
    if (sortBy === "alpha") return (a.subscriber || "").localeCompare(b.subscriber || "");
    if (sortBy === "notifications") return (b.notification_count || 0) - (a.notification_count || 0);
    return (b.days_since_notified || 0) - (a.days_since_notified || 0);
  });

  const statusColor = (s) => {
    if (s === "READY") return "#22c55e";
    if (s === "EXPIRED B/P" || s === "EXPIRING BATT/PADS") return "#ef4444";
    if (s === "REPOSITION") return "#a855f7";
    if (s === "NOT PRESENT") return "#f97316";
    return "#f59e0b";
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-[#0a0f1c] border border-cyan-500/30 rounded-sm w-[1100px] max-w-[95vw] max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()} data-testid="notified-aeds-modal">
        {/* Header */}
        <div className="p-5 border-b border-cyan-500/15 flex-shrink-0">
          <div className="flex justify-between items-center">
            <div>
              <div className="font-orbitron text-sm text-cyan-400 tracking-wider">NOTIFIED AEDs DETAIL VIEW</div>
              <div className="text-[9px] text-slate-500 mt-0.5 font-orbitron">{aeds.length} tracked devices</div>
            </div>
            <button onClick={onClose} className="text-slate-500 hover:text-white"><X className="w-5 h-5" /></button>
          </div>
          {/* Filters */}
          <div className="mt-3 flex gap-3 items-center flex-wrap">
            <input
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Filter by subscriber..."
              className="flex-1 min-w-[200px] px-3 py-2 rounded-sm bg-slate-900 border border-slate-700 text-white text-xs placeholder-slate-600 font-orbitron"
              data-testid="notified-filter"
            />
            <div className="flex gap-1 flex-shrink-0">
              {[
                { v: "all", l: "ALL" },
                { v: "unresolved", l: "PENDING" },
                { v: "resolved", l: "RESOLVED" },
              ].map(opt => (
                <button
                  key={opt.v}
                  onClick={() => setStatusFilter(opt.v)}
                  className={`font-orbitron text-[7px] px-2.5 py-1.5 rounded-sm border transition-colors ${statusFilter === opt.v ? "border-cyan-500/50 text-cyan-400 bg-cyan-500/10" : "border-slate-700 text-slate-500 hover:text-slate-300"}`}
                  data-testid={`filter-${opt.v}`}
                >{opt.l}</button>
              ))}
            </div>
            <div className="flex gap-1 flex-shrink-0">
              {[
                { v: "days", l: "OLDEST" },
                { v: "notifications", l: "MOST NOTIFIED" },
                { v: "alpha", l: "A-Z" },
              ].map(opt => (
                <button
                  key={opt.v}
                  onClick={() => setSortBy(opt.v)}
                  className={`font-orbitron text-[7px] px-2.5 py-1.5 rounded-sm border transition-colors ${sortBy === opt.v ? "border-amber-500/50 text-amber-400 bg-amber-500/10" : "border-slate-700 text-slate-500 hover:text-slate-300"}`}
                  data-testid={`sort-${opt.v}`}
                >{opt.l}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-cyan-400 animate-spin" /></div>
          ) : sorted.length === 0 ? (
            <div className="text-center text-slate-500 py-12 font-orbitron text-[10px]">NO TRACKED AEDs FOUND</div>
          ) : (
            <div className="space-y-3">
              {sorted.map(aed => {
                const isResolved = aed.resolved;
                const daysText = aed.days_since_notified != null ? `${aed.days_since_notified}d ago` : "—";
                const firstDate = aed.first_notified_at ? new Date(aed.first_notified_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
                const lastDate = aed.last_notified_at ? new Date(aed.last_notified_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
                const resolvedDate = aed.resolved_at ? new Date(aed.resolved_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null;

                return (
                  <div
                    key={`${aed.sentinel_id}-${aed.subscriber}`}
                    className={`border rounded-sm overflow-hidden ${isResolved ? "border-green-500/30 bg-[rgba(34,197,94,0.04)]" : "border-slate-700/50 bg-slate-900/30"}`}
                    data-testid={`notified-aed-${aed.sentinel_id}`}
                  >
                    <div className="flex items-start gap-4 p-4">
                      {/* Left: Status + ID */}
                      <div className="flex-shrink-0 w-[160px]">
                        <div className="font-orbitron text-xs text-white font-bold">{aed.sentinel_id}</div>
                        <div className="text-[9px] text-slate-400 font-orbitron mt-0.5">{aed.model || "—"}</div>
                        <div className="text-[9px] text-slate-500 mt-1 truncate" title={aed.location}>{aed.location || "—"}</div>
                        <div className="mt-2 flex items-center gap-1.5">
                          {isResolved ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                          ) : (
                            <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                          )}
                          <span
                            className="text-[8px] font-orbitron font-bold px-1.5 py-0.5 rounded-sm"
                            style={{ color: statusColor(aed.current_status), background: `${statusColor(aed.current_status)}15` }}
                          >
                            {aed.current_status}
                          </span>
                        </div>
                      </div>

                      {/* Center: Subscriber + Dates */}
                      <div className="flex-1 min-w-0">
                        <div className="font-orbitron text-[10px] text-cyan-400 tracking-wider">{aed.subscriber}</div>
                        <div className="mt-2 grid grid-cols-3 gap-x-4 gap-y-1.5">
                          <div>
                            <div className="font-orbitron text-[7px] text-slate-500 tracking-wider">ORIGINAL ISSUE</div>
                            <div className="text-[9px] text-slate-300" style={{ color: statusColor(aed.issue_type) }}>{aed.issue_type}</div>
                          </div>
                          <div>
                            <div className="font-orbitron text-[7px] text-slate-500 tracking-wider">FIRST NOTIFIED</div>
                            <div className="text-[9px] text-slate-300">{firstDate}</div>
                          </div>
                          <div>
                            <div className="font-orbitron text-[7px] text-slate-500 tracking-wider">LAST NOTIFIED</div>
                            <div className="text-[9px] text-slate-300">{lastDate}</div>
                          </div>
                          <div>
                            <div className="font-orbitron text-[7px] text-slate-500 tracking-wider">NOTIFICATIONS SENT</div>
                            <div className="text-[9px] text-white font-bold">{aed.notification_count || 0}</div>
                          </div>
                          <div>
                            <div className="font-orbitron text-[7px] text-slate-500 tracking-wider">DAYS SINCE NOTIFIED</div>
                            <div className={`text-[9px] font-bold ${(aed.days_since_notified || 0) > 14 ? "text-red-400" : (aed.days_since_notified || 0) > 7 ? "text-amber-400" : "text-slate-300"}`}>{daysText}</div>
                          </div>
                          {isResolved && resolvedDate && (
                            <div>
                              <div className="font-orbitron text-[7px] text-slate-500 tracking-wider">RESOLVED ON</div>
                              <div className="text-[9px] text-green-400 font-bold">{resolvedDate}</div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: Notification + Status Timeline */}
                      <div className="flex-shrink-0 w-[230px]">
                        <div className="font-orbitron text-[7px] text-slate-500 tracking-wider mb-2">NOTIFICATION TIMELINE</div>
                        <div className="space-y-1 max-h-[80px] overflow-y-auto mb-2">
                          {(aed.notification_dates || []).map((nd, idx) => {
                            const d = nd.date ? new Date(nd.date).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—";
                            return (
                              <div key={idx} className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 flex-shrink-0" />
                                <span className="text-[8px] text-slate-400">{d}</span>
                                <span className="text-[7px] text-slate-600">by {nd.sent_by || "—"}</span>
                              </div>
                            );
                          })}
                        </div>
                        {(aed.status_history && aed.status_history.length > 0) && (
                          <>
                            <div className="font-orbitron text-[7px] text-slate-500 tracking-wider mb-1.5 mt-2 pt-2 border-t border-slate-800/40">STATUS CHANGES</div>
                            <div className="space-y-1 max-h-[120px] overflow-y-auto">
                              {[...aed.status_history].reverse().map((sh, idx) => {
                                const dt = sh.at ? new Date(sh.at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—";
                                const isReady = (sh.status || "").toUpperCase() === "READY";
                                return (
                                  <div key={idx} className="flex items-start gap-2">
                                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1 ${isReady ? "bg-green-400" : "bg-amber-400"}`} />
                                    <div className="flex-1">
                                      <div className="text-[8px] text-slate-400">{dt}</div>
                                      <div className="text-[8px] font-orbitron">
                                        <span className="text-slate-500">{sh.from_status || "—"}</span>
                                        <span className="text-slate-600 mx-1">→</span>
                                        <span style={{ color: statusColor(sh.status) }}>{sh.status}</span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </>
                        )}
                        {aed.partially_resolved && !aed.resolved && (
                          <div className="mt-2 px-2 py-1 bg-amber-500/10 border border-amber-500/30 rounded-sm">
                            <div className="text-[8px] text-amber-400 font-orbitron font-bold">PARTIALLY RESOLVED</div>
                            <div className="text-[7px] text-amber-300/80 mt-0.5">{aed.resolution_reason}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SupportDashboard({ user, onLogout }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedSub, setSelectedSub] = useState(null);
  const [showContacts, setShowContacts] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showTrackingTest, setShowTrackingTest] = useState(false);
  const [showEngagement, setShowEngagement] = useState(false);
  const [showSgDebug, setShowSgDebug] = useState(false);
  const [deviceList, setDeviceList] = useState(null);
  const [sortField, setSortField] = useState("total_issues");
  const [sortDir, setSortDir] = useState("desc");
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [notifiedAeds, setNotifiedAeds] = useState(null);
  const [notifiedExpanded, setNotifiedExpanded] = useState(false);
  const [refreshingAeds, setRefreshingAeds] = useState(false);
  const [showNotifiedAeds, setShowNotifiedAeds] = useState(false);
  const [buildVersion, setBuildVersion] = useState("");

  const token = localStorage.getItem("token") || "";

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${API}/support/dashboard-data`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setData(await res.json());
    } catch {}
    setLoading(false);
  }, [token]);

  const fetchNotifiedAeds = useCallback(async () => {
    try {
      const res = await fetch(`${API}/support/notified-aeds/summary`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setNotifiedAeds(await res.json());
    } catch {}
  }, [token]);

  useEffect(() => { fetchData(); fetchNotifiedAeds(); }, [fetchData, fetchNotifiedAeds]);

  useEffect(() => {
    fetch(`${API_BASE}/api/version`).then(r => r.json()).then(d => { if (d?.version) setBuildVersion(d.version); }).catch(() => {});
  }, []);

  const handleRefreshAeds = async () => {
    setRefreshingAeds(true);
    try {
      await fetch(`${API}/support/notified-aeds/refresh`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Status refresh started — may take a minute");
      setTimeout(() => { fetchNotifiedAeds(); setRefreshingAeds(false); }, 10000);
    } catch {
      toast.error("Failed to start refresh");
      setRefreshingAeds(false);
    }
  };

  const [syncingOpens, setSyncingOpens] = useState(false);
  const handleSyncOpens = async () => {
    setSyncingOpens(true);
    try {
      const res = await fetch(`${API}/support/backfill-email-opens`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const j = await res.json();
        toast.success(
          `Sync complete — ${j.newly_matched_aeds || 0} AED${(j.newly_matched_aeds || 0) === 1 ? "" : "s"} now credited as opened (${j.current_unresolved_with_open}/${j.current_unresolved_total} unresolved with opens)`
        );
        await fetchData();
        await fetchNotifiedAeds();
      } else {
        toast.error("Sync failed — check server logs");
      }
    } catch {
      toast.error("Sync failed — network error");
    } finally {
      setSyncingOpens(false);
    }
  };

  const subscribers = data?.subscribers || [];
  const totals = data?.fleet_totals || {};
  const nc = data?.notified_counts || {};

  const filtered = subscribers
    .filter(s => s.total_issues > 0)
    .filter(s => !search || s.subscriber.toLowerCase().includes(search.toLowerCase()))
    .filter(s => {
      if (activeFilter === "all") return true;
      if (activeFilter === "expired_bp") return (s.expired_bp || 0) > 0;
      if (activeFilter === "expiring_bp") return (s.expiring_bp || 0) > 0;
      if (activeFilter === "not_ready") return (s.not_ready || 0) > 0;
      if (activeFilter === "reposition") return (s.reposition || 0) > 0;
      if (activeFilter === "not_present") return (s.not_present || 0) > 0;
      if (activeFilter === "unknown") return (s.unknown || 0) > 0;
      return true;
    });

  const sorted = [...filtered].sort((a, b) => {
    if (sortField === "subscriber") {
      const cmp = a.subscriber.localeCompare(b.subscriber);
      return sortDir === "desc" ? -cmp : cmp;
    }
    const av = a[sortField] || 0;
    const bv = b[sortField] || 0;
    return sortDir === "desc" ? bv - av : av - bv;
  });

  const toggleSort = (field) => {
    if (sortField === field) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortField(field); setSortDir("desc"); }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return null;
    return sortDir === "desc" ? <ChevronDown className="w-3 h-3 inline ml-0.5" /> : <ChevronUp className="w-3 h-3 inline ml-0.5" />;
  };

  return (
    <div className="min-h-screen bg-[#060a14] text-white overflow-auto" data-testid="support-dashboard">
      {/* Top bar */}
      <div className="border-b border-cyan-500/15 px-6 py-3 flex items-center justify-between bg-[rgba(6,10,20,0.95)]">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/hub")} className="text-slate-500 hover:text-cyan-400 transition-colors" data-testid="back-to-hub">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="font-orbitron text-sm tracking-wider text-cyan-400">SUPPORT DASHBOARD {buildVersion && <span className="text-[11px] text-cyan-400/60 ml-3 font-bold">{buildVersion}</span>}</div>
            <div className="text-[9px] text-slate-500 font-orbitron tracking-wider">SUBSCRIBER NOTIFICATION CENTER</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowTrackingTest(true)}
            className="font-orbitron text-[8px] px-3 py-1.5 border border-green-500/30 text-green-400 rounded-sm hover:bg-green-500/10 flex items-center gap-1.5"
            data-testid="test-email-btn"
          >
            <Mail className="w-3 h-3" /> TEST EMAIL
          </button>
          <button
            onClick={() => setShowEngagement(true)}
            className="font-orbitron text-[8px] px-3 py-1.5 border border-cyan-500/30 text-cyan-400 rounded-sm hover:bg-cyan-500/10 flex items-center gap-1.5"
            data-testid="engagement-btn"
            title="Per-subscriber email engagement report (delivery, opens, bounces, etc.)"
          >
            <BarChart3 className="w-3 h-3" /> ENGAGEMENT
          </button>
          <button
            onClick={() => setShowSgDebug(true)}
            className="font-orbitron text-[8px] px-3 py-1.5 border border-purple-500/30 text-purple-400 rounded-sm hover:bg-purple-500/10 flex items-center gap-1.5"
            data-testid="sg-debug-btn"
            title="SendGrid webhook diagnostic — see what events are arriving and whether they match"
          >
            <Activity className="w-3 h-3" /> SG DEBUG
          </button>
          <button
            onClick={() => setShowHistory(true)}
            className="font-orbitron text-[8px] px-3 py-1.5 border border-amber-500/30 text-amber-400 rounded-sm hover:bg-amber-500/10 flex items-center gap-1.5"
            data-testid="history-btn"
          >
            <History className="w-3 h-3" /> HISTORY
          </button>
          <button
            onClick={() => setShowContacts(true)}
            className="font-orbitron text-[8px] px-3 py-1.5 border border-cyan-500/30 text-cyan-400 rounded-sm hover:bg-cyan-500/10 flex items-center gap-1.5"
            data-testid="contacts-btn"
          >
            <Settings className="w-3 h-3" /> CONTACTS
          </button>
        </div>
      </div>

      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          </div>
        ) : (
          <>
            {/* Fleet Stats */}
            <div className="flex gap-3 flex-wrap mb-6">
              <StatCard value={data?.total_subscribers || 0} label="SUBSCRIBERS WITH ISSUES" color="#06b6d4" icon={Users} onClick={() => setActiveFilter("all")} active={activeFilter === "all"} notified={subscribers.filter(s => s.notified).length} prev={data?.total_subscribers_prev} />
              <StatCard value={totals.expired_bp || 0} label="EXPIRED B/P" color="#ef4444" icon={AlertTriangle} onClick={() => setActiveFilter("expired_bp")} active={activeFilter === "expired_bp"} notified={nc.expired_bp || 0} prev={totals.prev_expired_bp} />
              <StatCard value={totals.expiring_bp || 0} label="EXPIRING B/P" color="#f59e0b" icon={Clock} onClick={() => setActiveFilter("expiring_bp")} active={activeFilter === "expiring_bp"} notified={nc.expiring_bp || 0} prev={totals.prev_expiring_bp} />
              <StatCard value={totals.not_ready || 0} label="NOT READY" color="#f97316" icon={Activity} onClick={() => setActiveFilter("not_ready")} active={activeFilter === "not_ready"} notified={nc.not_ready || 0} prev={totals.prev_not_ready} />
              <StatCard value={totals.reposition || 0} label="REPOSITION" color="#a855f7" icon={Shield} onClick={() => setActiveFilter("reposition")} active={activeFilter === "reposition"} notified={nc.reposition || 0} prev={totals.prev_reposition} />
              <StatCard value={totals.not_present || 0} label="NOT PRESENT" color="#38bdf8" icon={AlertCircle} onClick={() => setActiveFilter("not_present")} active={activeFilter === "not_present"} notified={nc.not_present || 0} prev={totals.prev_not_present} />
              <StatCard value={totals.unknown || 0} label="UNKNOWN" color="#64748b" icon={Shield} onClick={() => setActiveFilter("unknown")} active={activeFilter === "unknown"} notified={nc.unknown || 0} prev={totals.prev_unknown} />
            </div>

            {/* Notified AEDs Readiness Tracker */}
            {(() => {
              const r = data?.readiness || {};
              const na = notifiedAeds;
              const hasData = r.total_monitored > 0 || (na && na.total_tracked > 0);
              if (!hasData) return null;
              return (
                <div className="mb-6 border border-cyan-500/20 rounded-sm bg-[rgba(10,15,28,0.9)] overflow-hidden" data-testid="notified-aeds-card">
                  <div
                    className="px-5 py-3 flex items-center justify-between cursor-pointer hover:bg-cyan-500/5 transition-colors"
                    onClick={() => setNotifiedExpanded(e => !e)}
                  >
                    <div className="flex items-center gap-3">
                      <Shield className="w-4 h-4 text-cyan-400" />
                      <div>
                        <div className="font-orbitron text-[10px] tracking-wider text-cyan-400">NOTIFIED AEDs READINESS TRACKER</div>
                        <div className="text-[8px] text-slate-500 font-orbitron mt-0.5">
                          {na?.total_tracked || 0} AEDs TRACKED - {na?.unresolved || 0} PENDING - {na?.resolved || 0} RESOLVED
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {/* Readiness gauges */}
                      <div className="flex items-center gap-6">
                        <div className="text-center">
                          <div className="font-orbitron text-[7px] text-slate-500 tracking-wider mb-1">ACTUAL READY</div>
                          <div className="font-orbitron text-lg font-black" style={{ color: (r.pct_ready || 0) >= 90 ? "#22c55e" : (r.pct_ready || 0) >= 70 ? "#f59e0b" : "#ef4444" }}>
                            {Number(r.pct_ready || 0).toFixed(1)}%
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="font-orbitron text-[7px] text-green-400 tracking-wider mb-1">ADJUSTED READY</div>
                          <div className="font-orbitron text-lg font-black text-green-400">
                            {Number(r.pct_ready_adjusted || 0).toFixed(1)}%
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="font-orbitron text-[7px] text-slate-500 tracking-wider mb-1">SUBSCRIBER PENDING</div>
                          <div className="font-orbitron text-lg font-black text-amber-400">
                            {na?.unresolved || 0}
                          </div>
                        </div>
                        <div
                          className="text-center cursor-pointer hover:bg-emerald-500/5 rounded px-2"
                          onClick={e => { e.stopPropagation(); setShowNotifiedAeds(true); }}
                          data-testid="resolved-24h-card"
                          title="Click to see all recently resolved AEDs"
                        >
                          <div className="font-orbitron text-[7px] text-emerald-400/80 tracking-wider mb-1">RESOLVED 24H</div>
                          <div className="font-orbitron text-lg font-black text-emerald-400">
                            {data?.resolutions?.recently_resolved_24h || 0}
                          </div>
                          <div className="font-orbitron text-[7px] text-slate-500/70 mt-0.5">{data?.resolutions?.recently_resolved_72h || 0} in 72h</div>
                        </div>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); handleRefreshAeds(); }}
                        disabled={refreshingAeds}
                        className="font-orbitron text-[7px] px-2 py-1 border border-cyan-500/30 text-cyan-400 rounded-sm hover:bg-cyan-500/10 disabled:opacity-50"
                        data-testid="refresh-aeds-btn"
                        title="Re-check device statuses against Readisys"
                      >
                        <RefreshCw className={`w-3 h-3 ${refreshingAeds ? "animate-spin" : ""}`} />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); handleSyncOpens(); }}
                        disabled={syncingOpens}
                        className="font-orbitron text-[7px] px-2 py-1 border border-emerald-500/30 text-emerald-400 rounded-sm hover:bg-emerald-500/10 disabled:opacity-50 flex items-center gap-1"
                        data-testid="sync-opens-btn"
                        title="Backfill: link historical email opens to notified AEDs (lifts Adjusted % above Actual)"
                      >
                        <Mail className={`w-3 h-3 ${syncingOpens ? "animate-pulse" : ""}`} />
                        <span>SYNC OPENS</span>
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); setShowNotifiedAeds(true); }}
                        className="font-orbitron text-[7px] px-3 py-1 border border-amber-500/30 text-amber-400 rounded-sm hover:bg-amber-500/10"
                        data-testid="view-notified-aeds-btn"
                      >
                        VIEW ALL
                      </button>
                      {notifiedExpanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                    </div>
                  </div>
                  {notifiedExpanded && na && (
                    <div className="border-t border-cyan-500/15 px-5 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        {/* Unresolved by Issue Type */}
                        <div>
                          <div className="font-orbitron text-[8px] text-slate-400 tracking-wider mb-2">UNRESOLVED BY ISSUE TYPE</div>
                          {Object.keys(na.unresolved_by_issue_type || {}).length === 0 ? (
                            <div className="text-[9px] text-slate-600 font-orbitron">No unresolved AEDs tracked yet</div>
                          ) : (
                            <div className="space-y-1.5">
                              {Object.entries(na.unresolved_by_issue_type).sort(([,a],[,b]) => b - a).map(([type, count]) => (
                                <div key={type} className="flex justify-between items-center">
                                  <span className="text-[9px] text-slate-300 font-orbitron">{type}</span>
                                  <span className="text-[10px] font-bold text-amber-400 font-orbitron">{count}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        {/* Unresolved by Subscriber (top 10) */}
                        <div>
                          <div className="font-orbitron text-[8px] text-slate-400 tracking-wider mb-2">UNRESOLVED BY SUBSCRIBER</div>
                          {(na.unresolved_by_subscriber || []).length === 0 ? (
                            <div className="text-[9px] text-slate-600 font-orbitron">No unresolved AEDs tracked yet</div>
                          ) : (
                            <div className="space-y-1.5">
                              {(na.unresolved_by_subscriber || []).slice(0, 10).map(s => (
                                <div key={s.subscriber} className="flex justify-between items-center">
                                  <span className="text-[9px] text-slate-300 font-orbitron truncate max-w-[200px]">{s.subscriber}</span>
                                  <span className="text-[10px] font-bold text-amber-400 font-orbitron">{s.count}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      {na.last_refresh && (
                        <div className="mt-3 text-[8px] text-slate-600 font-orbitron">
                          Last auto-refresh: {new Date(na.last_refresh).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Search + Sort controls */}
            <div className="mb-4 flex items-center gap-4">
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search subscribers..."
                className="px-4 py-2 rounded-sm bg-slate-900/80 border border-slate-700/50 text-white text-sm font-orbitron w-full max-w-xs"
                data-testid="subscriber-search"
              />
              <div className="flex items-center gap-2">
                <span className="font-orbitron text-[8px] text-slate-500 tracking-wider">SORT BY:</span>
                <select
                  value={`${sortField}:${sortDir}`}
                  onChange={e => {
                    const [f, d] = e.target.value.split(":");
                    setSortField(f);
                    setSortDir(d);
                  }}
                  className="px-3 py-2 rounded-sm bg-slate-900/80 border border-slate-700/50 text-white text-xs font-orbitron appearance-none cursor-pointer"
                  data-testid="sort-dropdown"
                >
                  <option value="total_issues:desc" style={{ background: "#0f172a" }}>MOST ISSUES</option>
                  <option value="total_issues:asc" style={{ background: "#0f172a" }}>FEWEST ISSUES</option>
                  <option value="subscriber:asc" style={{ background: "#0f172a" }}>A - Z</option>
                  <option value="subscriber:desc" style={{ background: "#0f172a" }}>Z - A</option>
                  <option value="expired_bp:desc" style={{ background: "#0f172a" }}>EXPIRED B/P</option>
                  <option value="expiring_bp:desc" style={{ background: "#0f172a" }}>EXPIRING B/P</option>
                  <option value="not_ready:desc" style={{ background: "#0f172a" }}>NOT READY</option>
                  <option value="reposition:desc" style={{ background: "#0f172a" }}>REPOSITION</option>
                  <option value="not_present:desc" style={{ background: "#0f172a" }}>NOT PRESENT</option>
                </select>
              </div>
            </div>

            {/* Subscriber Table */}
            <div className="border border-slate-700/30 rounded-sm overflow-hidden">
              <div className="max-h-[calc(100vh-320px)] overflow-y-auto">
              <table className="w-full">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-[#0a0f1c] border-b border-cyan-500/15">
                    <th className="text-left p-3 font-orbitron text-[8px] tracking-wider text-cyan-500/70 cursor-pointer" onClick={() => toggleSort("subscriber")}>
                      SUBSCRIBER <SortIcon field="subscriber" />
                    </th>
                    <th className="text-center p-3 font-orbitron text-[8px] tracking-wider text-red-400/70 cursor-pointer w-20" onClick={() => toggleSort("expired_bp")}>
                      EXP B/P <SortIcon field="expired_bp" />
                    </th>
                    <th className="text-center p-3 font-orbitron text-[8px] tracking-wider text-amber-400/70 cursor-pointer w-20" onClick={() => toggleSort("expiring_bp")}>
                      EXPIRING <SortIcon field="expiring_bp" />
                    </th>
                    <th className="text-center p-3 font-orbitron text-[8px] tracking-wider text-orange-400/70 cursor-pointer w-20" onClick={() => toggleSort("not_ready")}>
                      NOT RDY <SortIcon field="not_ready" />
                    </th>
                    <th className="text-center p-3 font-orbitron text-[8px] tracking-wider text-purple-400/70 cursor-pointer w-20" onClick={() => toggleSort("reposition")}>
                      REPOS <SortIcon field="reposition" />
                    </th>
                    <th className="text-center p-3 font-orbitron text-[8px] tracking-wider text-sky-400/70 cursor-pointer w-20" onClick={() => toggleSort("not_present")}>
                      NOT PRES <SortIcon field="not_present" />
                    </th>
                    <th className="text-center p-3 font-orbitron text-[8px] tracking-wider text-pink-400/70 cursor-pointer w-20" onClick={() => toggleSort("total_issues")}>
                      TOTAL <SortIcon field="total_issues" />
                    </th>
                    <th className="text-center p-3 font-orbitron text-[8px] tracking-wider text-emerald-400/70 w-24" title="Recently resolved by subscriber (last 24h / last 7 days). Includes fully and partially resolved AEDs.">
                      RESOLVED
                    </th>
                    <th className="text-center p-3 font-orbitron text-[8px] tracking-wider text-slate-500 w-24">
                      ACTIONS
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((s, i) => (
                    <tr
                      key={s.subscriber}
                      className={`border-b border-slate-800/50 hover:bg-cyan-500/5 transition-colors ${i % 2 === 0 ? 'bg-transparent' : 'bg-slate-900/20'}`}
                      data-testid={`sub-row-${s.subscriber}`}
                    >
                      <td className="p-3">
                        <button
                          onClick={() => setSelectedSub(s)}
                          className="font-orbitron text-[10px] text-white hover:text-cyan-400 transition-colors text-left"
                          data-testid={`sub-name-${s.subscriber}`}
                        >
                          {s.subscriber}
                        </button>
                        {s.contact?.to_email && (
                          <div className="text-[8px] text-slate-500 mt-0.5">{s.contact.to_email}</div>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {(() => { const v = s.expired_bp || 0; const n = s.notified_devices?.expired_bp || 0; if (v === 0) return <span className="text-slate-600">0</span>; return (<span className="font-orbitron text-sm cursor-pointer hover:underline" onClick={() => setDeviceList({ subscriber: s.subscriber, issueType: "expired_bp" })}>{n > 0 ? <><span className="text-green-400">{n}&#10003;</span><span className="text-slate-500 text-[9px]">/{v}</span></> : <span className="font-bold text-red-400">{v}</span>}</span>); })()}
                      </td>
                      <td className="p-3 text-center">
                        {(() => { const v = s.expiring_bp || 0; const n = s.notified_devices?.expiring_bp || 0; if (v === 0) return <span className="text-slate-600">0</span>; return (<span className="font-orbitron text-sm cursor-pointer hover:underline" onClick={() => setDeviceList({ subscriber: s.subscriber, issueType: "expiring_bp" })}>{n > 0 ? <><span className="text-green-400">{n}&#10003;</span><span className="text-slate-500 text-[9px]">/{v}</span></> : <span className="font-bold text-amber-400">{v}</span>}</span>); })()}
                      </td>
                      <td className="p-3 text-center">
                        {(() => { const v = s.not_ready || 0; const n = s.notified_devices?.not_ready || 0; if (v === 0) return <span className="text-slate-600">0</span>; return (<span className="font-orbitron text-sm cursor-pointer hover:underline" onClick={() => setDeviceList({ subscriber: s.subscriber, issueType: "not_ready" })}>{n > 0 ? <><span className="text-green-400">{n}&#10003;</span><span className="text-slate-500 text-[9px]">/{v}</span></> : <span className="font-bold text-orange-400">{v}</span>}</span>); })()}
                      </td>
                      <td className="p-3 text-center">
                        {(() => { const v = s.reposition || 0; const n = s.notified_devices?.reposition || 0; if (v === 0) return <span className="text-slate-600">0</span>; return (<span className="font-orbitron text-sm cursor-pointer hover:underline" onClick={() => setDeviceList({ subscriber: s.subscriber, issueType: "reposition" })}>{n > 0 ? <><span className="text-green-400">{n}&#10003;</span><span className="text-slate-500 text-[9px]">/{v}</span></> : <span className="font-bold text-purple-400">{v}</span>}</span>); })()}
                      </td>
                      <td className="p-3 text-center">
                        {(() => { const v = s.not_present || 0; const n = s.notified_devices?.not_present || 0; if (v === 0) return <span className="text-slate-600">0</span>; return (<span className="font-orbitron text-sm cursor-pointer hover:underline" onClick={() => setDeviceList({ subscriber: s.subscriber, issueType: "not_present" })}>{n > 0 ? <><span className="text-green-400">{n}&#10003;</span><span className="text-slate-500 text-[9px]">/{v}</span></> : <span className="font-bold text-sky-400">{v}</span>}</span>); })()}
                      </td>
                      <td className="p-3 text-center">
                        {(() => { const v = s.total_issues; const n = s.notified_devices?.total || 0; return n > 0 ? <span className="font-orbitron text-sm"><span className="text-green-400 font-bold">{n}&#10003;</span><span className="text-slate-500 text-[9px]">/{v}</span></span> : <span className="font-orbitron text-sm font-bold text-pink-400">{v}</span>; })()}
                      </td>
                      <td className="p-3 text-center" data-testid={`resolved-cell-${s.subscriber}`}>
                        {(() => {
                          const r = s.resolutions || {};
                          const r24 = (r.resolved_24h || 0) + (r.partial_24h || 0);
                          const r7 = (r.resolved_7d || 0) + (r.partial_7d || 0);
                          if (r24 === 0 && r7 === 0) return <span className="text-slate-600">—</span>;
                          return (
                            <div className="font-orbitron text-[10px] leading-tight">
                              <div title={`${r.resolved_24h || 0} fully + ${r.partial_24h || 0} partial in last 24h`}>
                                <span className="text-emerald-400 font-bold">{r24}</span>
                                <span className="text-slate-500 text-[8px]"> 24h</span>
                              </div>
                              <div className="text-slate-500 text-[8px]" title={`${r.resolved_7d || 0} fully + ${r.partial_7d || 0} partial in last 7 days`}>
                                <span className="text-emerald-400/70">{r7}</span> 7d
                              </div>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {s.notified && <span className="text-[7px] px-1.5 py-0.5 bg-green-500/15 text-green-400 rounded-sm font-orbitron">SENT</span>}
                          <button
                            onClick={() => setSelectedSub(s)}
                            className="font-orbitron text-[7px] px-2 py-1 border border-cyan-500/30 text-cyan-400 rounded-sm hover:bg-cyan-500/10 inline-flex items-center gap-1"
                            data-testid={`notify-btn-${s.subscriber}`}
                          >
                            <Send className="w-2.5 h-2.5" /> NOTIFY
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {sorted.length === 0 && (
                    <tr><td colSpan={9} className="text-center py-8 text-slate-500 font-orbitron text-[10px]">NO SUBSCRIBERS WITH ISSUES</td></tr>
                  )}
                </tbody>
              </table>
              </div>
            </div>

            <div className="text-[8px] text-slate-600 mt-3 font-orbitron tracking-wider">
              {sorted.length} SUBSCRIBER{sorted.length !== 1 ? "S" : ""} WITH ACTIVE ISSUES
            </div>
          </>
        )}
      </div>

      {/* Modals */}
      {selectedSub && (
        <NotificationModal
          subscriber={selectedSub.subscriber}
          contact={selectedSub.contact}
          onClose={() => setSelectedSub(null)}
          onSent={fetchData}
        />
      )}
      {showContacts && <ContactsModal subscribers={subscribers} onClose={() => { setShowContacts(false); fetchData(); }} />}
      {showHistory && <NotificationHistoryModal onClose={() => setShowHistory(false)} />}
      {showTrackingTest && <TrackingTestModal onClose={() => setShowTrackingTest(false)} />}
      {showEngagement && <SubscriberEngagementModal onClose={() => setShowEngagement(false)} />}
      {showSgDebug && <SendGridDebugModal onClose={() => setShowSgDebug(false)} />}
      {deviceList && <DeviceListModal subscriber={deviceList.subscriber} issueType={deviceList.issueType} onClose={() => setDeviceList(null)} />}
      {showNotifiedAeds && <NotifiedAedsModal onClose={() => setShowNotifiedAeds(false)} onRefresh={() => { fetchNotifiedAeds(); fetchData(); }} />}
    </div>
  );
}
