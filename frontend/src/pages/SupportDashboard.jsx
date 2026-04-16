import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Send, X, Trash2, Loader2, Settings,
  AlertTriangle, Clock, ChevronDown, ChevronUp, Mail,
  Users, Activity, Shield, History, Battery, Wifi,
  StickyNote, ZoomIn, ChevronLeft, Edit3, RefreshCw,
  CheckCircle2, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import API_BASE from "@/apiBase";

const API = API_BASE + "/api";

function StatCard({ value, label, color, icon: Icon, onClick, active, notified }) {
  const pct = value > 0 && notified != null ? Math.min(100, Math.round((notified / value) * 100)) : 0;
  const allDone = value > 0 && notified != null && notified >= value;
  return (
    <div
      onClick={onClick}
      className={`border rounded-sm p-4 min-w-[130px] cursor-pointer transition-all ${allDone ? "border-green-500/50 bg-[rgba(34,197,94,0.08)]" : active ? "border-current ring-1 ring-current bg-[rgba(10,15,28,1)]" : "border-slate-700/50 bg-[rgba(10,15,28,0.85)] hover:border-slate-600"}`}
      style={active && !allDone ? { borderColor: color, boxShadow: `0 0 12px ${color}22` } : allDone ? { boxShadow: "0 0 12px rgba(34,197,94,0.15)" } : {}}
    >
      <div className="flex items-start justify-between">
        <div className="font-orbitron text-2xl font-black" style={{ color }}>{value}</div>
        {Icon && <Icon className="w-4 h-4 opacity-60" style={{ color }} />}
      </div>
      <div className="font-orbitron text-[7px] tracking-wider text-slate-400 mt-1.5 uppercase">{label}</div>
      {notified != null && value > 0 && (
        <div className="mt-2">
          <div className="h-[3px] rounded-full bg-slate-800 overflow-hidden">
            <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <div className="font-orbitron text-[7px] tracking-wider mt-1">
            <span className="text-green-400">{notified}</span>
            <span className="text-slate-600">/{value} NOTIFIED</span>
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

function NotificationHistoryModal({ onClose }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [sortBy, setSortBy] = useState("date"); // "date" or "alpha"
  const [editingId, setEditingId] = useState(null);
  const [editStatus, setEditStatus] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [saving, setSaving] = useState(false);

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
                  <th className="text-center p-2 font-orbitron text-[8px] text-cyan-500/70 tracking-wider">STATUS</th>
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
                      <td className="p-2 font-orbitron text-[10px] text-white">{h.subscriber || "—"}</td>
                      <td className="p-2 text-slate-300 text-[10px]">{h.to_email || "—"}</td>
                      <td className="p-2 text-slate-300 text-[10px] max-w-[200px] truncate">{h.subject || "—"}</td>
                      <td className="p-2 text-slate-400 text-[10px]">{h.sent_by || "—"}</td>
                      <td className="p-2 text-slate-400 text-[10px] whitespace-nowrap">{sentDate}</td>
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
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
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
            return ["EXPIRED B/P", "EXPIRING BATT/PADS", "REPOSITION", "NOT READY", "NOT PRESENT", "LOST CONTACT", "UNKNOWN"].includes(s);
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
                        <th className="text-center p-2 border border-slate-200 w-16">Batt %</th>
                        <th className="text-center p-2 border border-slate-200 w-16">Signal</th>
                        <th className="text-left p-2 border border-slate-200 w-28">Image</th>
                        <th className="w-8 border border-slate-200"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {sec.devices.map(d => {
                        const loc = [d.site, d.building, d.placement].filter(Boolean).join(" / ") || d.location || "—";
                        const capturedAt = d.captured_at ? new Date(d.captured_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";
                        return (
                          <tr key={d.sentinel_id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setDrawerDevice(d)}>
                            <td className="p-2 border border-slate-200 font-bold text-blue-700 hover:underline">{d.sentinel_id}</td>
                            <td className="p-2 border border-slate-200 text-[11px]">{loc}</td>
                            <td className="p-2 border border-slate-200 text-[11px]">
                              <textarea
                                value={customDetails[d.sentinel_id] !== undefined ? customDetails[d.sentinel_id] : (d.days_summary || d.detailed_status || "—")}
                                onChange={e => { e.stopPropagation(); setCustomDetails(prev => ({ ...prev, [d.sentinel_id]: e.target.value })); }}
                                onClick={e => e.stopPropagation()}
                                className="w-full min-w-[120px] px-1.5 py-1 rounded border border-blue-300 bg-blue-50 text-slate-800 text-[11px] resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
                                rows={2}
                                data-testid={`edit-details-${d.sentinel_id}`}
                              />
                            </td>
                            <td className="p-2 border border-slate-200 text-[10px] text-center">
                              <div>Batt: {d.battery_expiration || "—"}</div>
                              <div>Pads: {d.pad_expiration || "—"}</div>
                            </td>
                            <td className="p-2 border border-slate-200 text-center">
                              <span className={`text-[11px] font-bold ${(d.battery_level_pct ?? 0) > 50 ? "text-green-600" : (d.battery_level_pct ?? 0) > 20 ? "text-amber-600" : "text-red-600"}`}>
                                {d.battery_level_pct != null ? `${d.battery_level_pct}%` : "—"}
                              </span>
                            </td>
                            <td className="p-2 border border-slate-200 text-center">
                              <span className={`text-[10px] ${d.cellular_signal_quality === "HIGH" ? "text-green-600" : d.cellular_signal_quality === "MEDIUM" ? "text-amber-600" : "text-red-600"}`}>
                                {d.cellular_signal_label || d.cellular_signal_quality || "—"}
                              </span>
                            </td>
                            <td className="p-2 border border-slate-200">
                              {d.image_url ? (
                                <div>
                                  <img src={d.image_url} alt={d.sentinel_id} className="max-w-[100px] max-h-[60px] rounded-sm" loading="lazy" />
                                  {capturedAt && <div className="text-[9px] text-slate-400 mt-0.5">{capturedAt}</div>}
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
      await fetch(`${API}/support/device-feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sentinel_id: device.sentinel_id, subscriber, current_status: device.detailed_status, correct_status: correctStatus, comments }),
      });
      toast.success("Feedback submitted");
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

function DeviceListModal({ subscriber, issueType, onClose }) {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedbackDevice, setFeedbackDevice] = useState(null);

  const issueLabels = { expired_bp: "EXPIRED B/P", expiring_bp: "EXPIRING BATT/PADS", not_ready: "NOT READY", reposition: "REPOSITION", unknown: "UNKNOWN" };
  const issueStatuses = {
    expired_bp: ["EXPIRED B/P"],
    expiring_bp: ["EXPIRING BATT/PADS"],
    not_ready: ["NOT READY"],
    reposition: ["REPOSITION"],
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
          setDevices(all.filter(d => statuses.includes(d.detailed_status)));
        }
      } catch {}
      setLoading(false);
    })();
  }, [subscriber, issueType]);

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-[#0a0f1c] border border-cyan-500/30 rounded-sm w-[1100px] max-w-[95vw] max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()} data-testid="device-list-modal">
        <div className="p-5 border-b border-cyan-500/15 flex justify-between items-center flex-shrink-0">
          <div>
            <div className="font-orbitron text-sm text-cyan-400 tracking-wider">{subscriber}</div>
            <div className="text-[9px] text-slate-500 font-orbitron mt-0.5">{issueLabels[issueType] || issueType} — {devices.length} devices</div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-cyan-400 animate-spin" /></div>
          ) : devices.length === 0 ? (
            <div className="text-center text-slate-500 py-12 font-orbitron text-[10px]">NO DEVICES FOUND</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {devices.map(d => {
                const loc = [d.site, d.building, d.placement].filter(Boolean).join(" / ") || "—";
                const capturedAt = d.captured_at ? new Date(d.captured_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—";
                const battColor = (d.battery_level_pct ?? 0) > 50 ? "#22c55e" : (d.battery_level_pct ?? 0) > 20 ? "#f59e0b" : "#ef4444";
                return (
                  <div key={d.sentinel_id} className="border border-slate-700/50 bg-slate-900/30 rounded-sm overflow-hidden">
                    <div className="flex gap-3 p-3">
                      {/* Image */}
                      <div className="flex-shrink-0 w-28">
                        {d.image_url ? (
                          <img src={d.image_url} alt={d.sentinel_id} className="w-28 h-20 object-cover rounded-sm border border-slate-700" loading="lazy" />
                        ) : (
                          <div className="w-28 h-20 bg-slate-800 border border-slate-700 rounded-sm flex items-center justify-center text-slate-600 text-[8px]">No image</div>
                        )}
                        <div className="text-[8px] text-slate-500 mt-1 text-center">{capturedAt}</div>
                      </div>
                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div className="font-orbitron text-xs text-white font-bold">{d.sentinel_id}</div>
                          <span className="text-[7px] px-1.5 py-0.5 bg-red-500/15 text-red-400 rounded-sm font-orbitron flex-shrink-0">{d.detailed_status}</span>
                        </div>
                        <div className="text-[9px] text-slate-400 mt-1">{d.model || "—"}</div>
                        <div className="text-[9px] text-slate-500 mt-0.5 truncate">{loc}</div>
                        <div className="flex items-center gap-3 mt-2">
                          <div className="flex items-center gap-1">
                            <Battery className="w-3 h-3" style={{ color: battColor }} />
                            <span className="text-[9px] font-bold" style={{ color: battColor }}>{d.battery_level_pct != null ? `${d.battery_level_pct}%` : "—"}</span>
                          </div>
                          <div className="text-[9px] text-slate-500">Batt: {d.battery_expiration || "—"}</div>
                          <div className="text-[9px] text-slate-500">Pads: {d.pad_expiration || "—"}</div>
                        </div>
                      </div>
                    </div>
                    {/* Action bar */}
                    <div className="border-t border-slate-700/30 px-3 py-1.5 flex justify-end gap-2">
                      <button onClick={() => setFeedbackDevice(d)}
                        className="font-orbitron text-[7px] px-2 py-1 border border-amber-500/30 text-amber-400 rounded-sm hover:bg-amber-500/10 inline-flex items-center gap-1"
                        data-testid={`feedback-btn-${d.sentinel_id}`}>
                        <Edit3 className="w-2.5 h-2.5" /> CORRECT STATUS
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        {feedbackDevice && <StatusFeedbackModal device={feedbackDevice} subscriber={subscriber} onClose={() => setFeedbackDevice(null)} />}
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

export default function SupportDashboard({ user, onLogout }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedSub, setSelectedSub] = useState(null);
  const [showContacts, setShowContacts] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [deviceList, setDeviceList] = useState(null);
  const [sortField, setSortField] = useState("total_issues");
  const [sortDir, setSortDir] = useState("desc");
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [notifiedAeds, setNotifiedAeds] = useState(null);
  const [notifiedExpanded, setNotifiedExpanded] = useState(false);
  const [refreshingAeds, setRefreshingAeds] = useState(false);

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
            <div className="font-orbitron text-sm tracking-wider text-cyan-400">SUPPORT DASHBOARD</div>
            <div className="text-[9px] text-slate-500 font-orbitron tracking-wider">SUBSCRIBER NOTIFICATION CENTER</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
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
              <StatCard value={data?.total_subscribers || 0} label="SUBSCRIBERS WITH ISSUES" color="#06b6d4" icon={Users} onClick={() => setActiveFilter("all")} active={activeFilter === "all"} notified={nc.total || 0} />
              <StatCard value={totals.expired_bp || 0} label="EXPIRED B/P" color="#ef4444" icon={AlertTriangle} onClick={() => setActiveFilter("expired_bp")} active={activeFilter === "expired_bp"} notified={nc.expired_bp || 0} />
              <StatCard value={totals.expiring_bp || 0} label="EXPIRING B/P" color="#f59e0b" icon={Clock} onClick={() => setActiveFilter("expiring_bp")} active={activeFilter === "expiring_bp"} notified={nc.expiring_bp || 0} />
              <StatCard value={totals.not_ready || 0} label="NOT READY" color="#f97316" icon={Activity} onClick={() => setActiveFilter("not_ready")} active={activeFilter === "not_ready"} notified={nc.not_ready || 0} />
              <StatCard value={totals.reposition || 0} label="REPOSITION" color="#a855f7" icon={Shield} onClick={() => setActiveFilter("reposition")} active={activeFilter === "reposition"} notified={nc.reposition || 0} />
              <StatCard value={totals.unknown || 0} label="UNKNOWN" color="#64748b" icon={Shield} onClick={() => setActiveFilter("unknown")} active={activeFilter === "unknown"} notified={nc.unknown || 0} />
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
                            {r.pct_ready || 0}%
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="font-orbitron text-[7px] text-green-400 tracking-wider mb-1">ADJUSTED READY</div>
                          <div className="font-orbitron text-lg font-black text-green-400">
                            {r.pct_ready_adjusted || 0}%
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="font-orbitron text-[7px] text-slate-500 tracking-wider mb-1">SUBSCRIBER PENDING</div>
                          <div className="font-orbitron text-lg font-black text-amber-400">
                            {na?.unresolved || 0}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); handleRefreshAeds(); }}
                        disabled={refreshingAeds}
                        className="font-orbitron text-[7px] px-2 py-1 border border-cyan-500/30 text-cyan-400 rounded-sm hover:bg-cyan-500/10 disabled:opacity-50"
                        data-testid="refresh-aeds-btn"
                      >
                        <RefreshCw className={`w-3 h-3 ${refreshingAeds ? "animate-spin" : ""}`} />
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
                    <th className="text-center p-3 font-orbitron text-[8px] tracking-wider text-pink-400/70 cursor-pointer w-20" onClick={() => toggleSort("total_issues")}>
                      TOTAL <SortIcon field="total_issues" />
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
                        {s.expired_bp > 0 ? (
                          <span className="font-orbitron text-sm font-bold text-red-400 cursor-pointer hover:underline" onClick={() => setDeviceList({ subscriber: s.subscriber, issueType: "expired_bp" })}>{s.expired_bp}</span>
                        ) : (
                          <span className="text-slate-600">0</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {s.expiring_bp > 0 ? (
                          <span className="font-orbitron text-sm font-bold text-amber-400 cursor-pointer hover:underline" onClick={() => setDeviceList({ subscriber: s.subscriber, issueType: "expiring_bp" })}>{s.expiring_bp}</span>
                        ) : (
                          <span className="text-slate-600">0</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {(s.not_ready || 0) > 0 ? (
                          <span className="font-orbitron text-sm font-bold text-orange-400 cursor-pointer hover:underline" onClick={() => setDeviceList({ subscriber: s.subscriber, issueType: "not_ready" })}>{s.not_ready}</span>
                        ) : (
                          <span className="text-slate-600">0</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {(s.reposition || 0) > 0 ? (
                          <span className="font-orbitron text-sm font-bold text-purple-400 cursor-pointer hover:underline" onClick={() => setDeviceList({ subscriber: s.subscriber, issueType: "reposition" })}>{s.reposition}</span>
                        ) : (
                          <span className="text-slate-600">0</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <span className="font-orbitron text-sm font-bold text-pink-400">{s.total_issues}</span>
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
                    <tr><td colSpan={7} className="text-center py-8 text-slate-500 font-orbitron text-[10px]">NO SUBSCRIBERS WITH ISSUES</td></tr>
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
      {deviceList && <DeviceListModal subscriber={deviceList.subscriber} issueType={deviceList.issueType} onClose={() => setDeviceList(null)} />}
    </div>
  );
}
