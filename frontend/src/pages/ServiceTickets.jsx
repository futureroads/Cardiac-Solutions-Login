import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, RefreshCw, Zap, AlertTriangle, Wrench, Send, Plus, Clock, X, Loader2, FileText, Radio, Settings, Users, ChevronRight, Trash2, Edit2 } from "lucide-react";
import { toast } from "sonner";
import API_BASE from "@/apiBase";

const API = `${API_BASE}/api`;

// Stat card component
function StatCard({ value, label, sublabel, color, icon: Icon }) {
  return (
    <div className="border border-slate-700/50 bg-[rgba(10,15,28,0.85)] rounded-sm p-4 min-w-[140px]" data-testid={`stat-${label.replace(/\s+/g, '-').toLowerCase()}`}>
      <div className="flex items-start justify-between">
        <div className="font-orbitron text-3xl font-black" style={{ color }}>{value}</div>
        {Icon && <Icon className="w-5 h-5 opacity-60" style={{ color }} />}
      </div>
      <div className="font-orbitron text-[8px] tracking-wider text-slate-400 mt-2 uppercase">{label}</div>
      {sublabel && <div className="text-[7px] text-slate-500 mt-0.5">{sublabel}</div>}
    </div>
  );
}

// Issue badge
function IssueBadge({ type, count }) {
  const colors = {
    "NOT READY": "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    "LOST CONTACT": "bg-red-500/20 text-red-400 border-red-500/30",
    "EXPIRED B/P": "bg-pink-500/20 text-pink-400 border-pink-500/30",
    "EXPIRING B/P": "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  };
  if (!count || count <= 0) return null;
  return (
    <span className={`inline-block font-orbitron text-[7px] font-bold px-2 py-1 rounded-sm border ${colors[type] || 'bg-slate-500/20 text-slate-400 border-slate-500/30'}`}>
      {type} {count}
    </span>
  );
}

// Device detail modal (Need Attention drill-down)
function DeviceDetailModal({ subscriber, onClose, onCreateTicket }) {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API}/service/devices/${encodeURIComponent(subscriber)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setDevices(data.devices || []);
        }
      } catch {}
      setLoading(false);
    };
    fetchDevices();
  }, [subscriber]);

  const statusColors = {
    "EXPIRED B/P": "bg-pink-500/20 text-pink-400 border-pink-500/30",
    "EXPIRING BATT/PADS": "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
    "NOT READY": "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    "LOST CONTACT": "bg-red-500/20 text-red-400 border-red-500/30",
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-[#0a0f1c] border border-cyan-500/30 rounded-sm w-[900px] max-w-[95vw] max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()} data-testid="device-detail-modal">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-700/50">
          <div>
            <h2 className="text-xl font-bold text-white">{subscriber} — Need Attention</h2>
            <p className="text-sm text-slate-400 mt-1">Showing {devices.length} of {devices.length} devices</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
        </div>

        {/* Devices list */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
              <span className="font-orbitron text-[10px] text-cyan-400 tracking-wider ml-3">LOADING DEVICES...</span>
            </div>
          ) : devices.length === 0 ? (
            <div className="text-center py-12 text-slate-500 font-orbitron text-[10px] tracking-wider">NO DEVICES FOUND FOR THIS SUBSCRIBER</div>
          ) : (
            <div className="space-y-3">
              {devices.map((dev, i) => (
                <div key={dev.sentinel_id || i} className="border border-slate-700/40 bg-slate-900/50 rounded-sm p-4" data-testid={`device-${dev.sentinel_id}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {/* Device ID and status */}
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="inline-block w-3 h-3 rounded-full bg-green-500/60 shadow-[0_0_4px_rgba(34,197,94,0.4)]" />
                        <span className="font-orbitron text-sm font-bold text-white">{dev.sentinel_id}</span>
                        <span className="text-slate-500 text-xs">Hybrid:</span>
                        <span className={`font-orbitron text-[8px] font-bold px-2 py-0.5 rounded-sm border ${statusColors[dev.detailed_status] || 'bg-slate-500/20 text-slate-400 border-slate-500/30'}`}>
                          {dev.detailed_status}
                        </span>
                      </div>
                      {/* Location */}
                      <div className="text-xs text-slate-400 mb-2">{dev.location}</div>
                      {/* Battery / Pad info */}
                      <div className="flex items-center gap-4 text-[10px] text-slate-500">
                        <span>B: <span className={dev.battery_days < 0 ? 'text-red-400' : dev.battery_days < 60 ? 'text-yellow-400' : 'text-green-400'}>{dev.battery_expiration}</span></span>
                        <span>P: <span className={dev.pad_days < 0 ? 'text-red-400' : dev.pad_days < 60 ? 'text-yellow-400' : 'text-green-400'}>{dev.pad_expiration}</span></span>
                      </div>
                      {/* Days summary */}
                      {dev.days_summary && (
                        <div className="text-[10px] text-amber-400/80 mt-1">{dev.days_summary}</div>
                      )}
                    </div>
                    {/* Create Ticket button */}
                    <button
                      onClick={() => onCreateTicket(subscriber, dev)}
                      className="flex items-center gap-1.5 font-orbitron text-[9px] px-3 py-2 border border-cyan-500/30 text-cyan-400 rounded-sm hover:bg-cyan-500/10 transition-all whitespace-nowrap"
                      data-testid={`create-ticket-device-${dev.sentinel_id}`}
                    >
                      <Wrench className="w-3 h-3" /> Create Ticket
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Create ticket modal - matches service.cardiac-solutions.ai layout
function CreateTicketModal({ subscriber, device, fieldTechs = [], onClose, onCreated }) {
  const [deviceId, setDeviceId] = useState(device?.sentinel_id || "");
  const [deviceType, setDeviceType] = useState("Hybrid");
  const [issueType, setIssueType] = useState(device?.detailed_status || "NOT READY");
  const [location, setLocation] = useState(device?.location || "");
  const [priority, setPriority] = useState("Medium");
  const [assignedTo, setAssignedTo] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState(
    device ? `Device ${device.sentinel_id} — ${device.detailed_status}. ${device.days_summary || ''} Requires immediate attention.` : ""
  );
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/service/tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          subscriber,
          device_id: deviceId,
          device_type: deviceType,
          issue_type: issueType,
          location,
          priority: priority.toUpperCase(),
          assigned_tech: assignedTo,
          due_date: dueDate,
          description,
          notes: notes,
        }),
      });
      if (res.ok) {
        const ticket = await res.json();
        toast.success(`Ticket ${ticket.id} created`);
        onCreated(ticket);
        onClose();
      } else {
        toast.error("Failed to create ticket");
      }
    } catch { toast.error("Error creating ticket"); }
    setSaving(false);
  };

  const inputClass = "w-full bg-transparent text-white border-b border-cyan-500/30 px-2 py-2 text-sm outline-none focus:border-cyan-400 transition-colors placeholder-slate-600";
  const labelClass = "font-orbitron text-[8px] text-slate-500 tracking-wider uppercase mb-1";
  const sectionClass = "font-orbitron text-[10px] text-cyan-400 tracking-wider uppercase mb-3 mt-5";

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-[#0a0f1c] border border-cyan-500/30 rounded-sm w-[560px] max-w-[95vw] max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()} data-testid="create-ticket-modal">
        {/* Header */}
        <div className="flex justify-between items-start px-6 pt-5 pb-2">
          <div>
            <div className="flex items-center gap-2">
              <Wrench className="w-4 h-4 text-cyan-400" />
              <span className="font-orbitron text-sm text-cyan-400 tracking-wider font-bold">Create Service Ticket</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-1">New Service Ticket</div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-6 pb-6">
          {/* SUBSCRIBER INFORMATION */}
          <div className={sectionClass}>Subscriber Information</div>
          <div className="border-t border-cyan-500/20 pt-3">
            <div className={labelClass}>Subscriber Name</div>
            <div className={inputClass + " bg-slate-800/30 cursor-default text-slate-300"}>{subscriber}</div>
          </div>

          {/* DEVICE INFORMATION */}
          <div className={sectionClass}>Device Information</div>
          <div className="border-t border-cyan-500/20 pt-3">
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div>
                <div className={labelClass}>Device ID</div>
                <input value={deviceId} onChange={e => setDeviceId(e.target.value)} className={inputClass} placeholder="e.g. APES-X01" data-testid="device-id-input" />
              </div>
              <div>
                <div className={labelClass}>Device Type</div>
                <input value={deviceType} onChange={e => setDeviceType(e.target.value)} className={inputClass} placeholder="Hybrid" data-testid="device-type-input" />
              </div>
              <div>
                <div className={labelClass}>Issue Type</div>
                <select value={issueType} onChange={e => setIssueType(e.target.value)} className={inputClass + " bg-transparent"} data-testid="issue-type-select">
                  <option value="NOT READY" className="bg-[#0a0f1c]">NOT READY</option>
                  <option value="EXPIRED B/P" className="bg-[#0a0f1c]">EXPIRED B/P</option>
                  <option value="EXPIRING B/P" className="bg-[#0a0f1c]">EXPIRING B/P</option>
                  <option value="LOST CONTACT" className="bg-[#0a0f1c]">LOST CONTACT</option>
                  <option value="CAMERA ISSUE" className="bg-[#0a0f1c]">CAMERA ISSUE</option>
                  <option value="OTHER" className="bg-[#0a0f1c]">OTHER</option>
                </select>
              </div>
            </div>
            <div>
              <div className={labelClass}>Location</div>
              <input value={location} onChange={e => setLocation(e.target.value)} className={inputClass} placeholder="Building · Floor · Area" data-testid="location-input" />
            </div>
          </div>

          {/* TICKET DETAILS */}
          <div className={sectionClass}>Ticket Details</div>
          <div className="border-t border-cyan-500/20 pt-3">
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div>
                <div className={labelClass}>Priority</div>
                <select value={priority} onChange={e => setPriority(e.target.value)} className={inputClass + " bg-transparent"} data-testid="priority-select">
                  <option value="Low" className="bg-[#0a0f1c]">Low</option>
                  <option value="Medium" className="bg-[#0a0f1c]">Medium</option>
                  <option value="High" className="bg-[#0a0f1c]">High</option>
                  <option value="Urgent" className="bg-[#0a0f1c]">Urgent</option>
                </select>
              </div>
              <div>
                <div className={labelClass}>Assigned To</div>
                <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)} className={inputClass + " bg-transparent"} data-testid="assigned-to-select">
                  <option value="" className="bg-[#0a0f1c]">-- Select --</option>
                  {fieldTechs.filter(t => t.active !== false).map(t => (
                    <option key={t.id} value={t.name} className="bg-[#0a0f1c]">{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <div className={labelClass}>Due Date</div>
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={inputClass} data-testid="due-date-input" />
              </div>
            </div>

            <div className="mb-3">
              <div className={labelClass}>Description</div>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className={inputClass + " resize-y border border-cyan-500/20 rounded-sm px-3 py-2"} placeholder="Describe the issue..." data-testid="description-input" />
            </div>

            <div>
              <div className={labelClass}>Additional Notes</div>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={inputClass + " resize-y border border-cyan-500/20 rounded-sm px-3 py-2"} placeholder="Add any additional notes or instructions..." data-testid="notes-input" />
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-700/30">
            <button onClick={onClose} className="font-orbitron text-[9px] tracking-wider px-5 py-2 text-slate-400 hover:text-white transition-colors">Cancel</button>
            <button onClick={handleCreate} disabled={saving} className="flex items-center gap-1.5 font-orbitron text-[9px] tracking-wider px-5 py-2 bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 rounded-sm hover:bg-cyan-500/30 transition-all disabled:opacity-50" data-testid="create-ticket-btn">
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wrench className="w-3 h-3" />}
              Create Ticket
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Ticket list modal for a subscriber
function TicketListModal({ subscriber, onClose }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dispatchId, setDispatchId] = useState(null);
  const [techName, setTechName] = useState("");
  const [techEmail, setTechEmail] = useState("");

  const fetchTickets = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/service/tickets/${encodeURIComponent(subscriber)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setTickets(await res.json());
    } catch {}
    setLoading(false);
  }, [subscriber]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const updateStatus = async (ticketId, status) => {
    const token = localStorage.getItem("token");
    await fetch(`${API}/service/tickets/${ticketId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status }),
    });
    toast.success(`Ticket ${ticketId} → ${status}`);
    fetchTickets();
  };

  const handleDispatch = async (ticketId) => {
    if (!techName || !techEmail) { toast.error("Enter tech name and email"); return; }
    const token = localStorage.getItem("token");
    await fetch(`${API}/service/tickets/${ticketId}/dispatch`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ tech_name: techName, tech_email: techEmail }),
    });
    toast.success(`Dispatched to ${techName}`);
    setDispatchId(null);
    setTechName("");
    setTechEmail("");
    fetchTickets();
  };

  const statusColors = {
    OPEN: "text-cyan-400 bg-cyan-500/15",
    DISPATCHED: "text-purple-400 bg-purple-500/15",
    "EN ROUTE": "text-blue-400 bg-blue-500/15",
    "ON SITE": "text-yellow-400 bg-yellow-500/15",
    DONE: "text-green-400 bg-green-500/15",
    CLOSED: "text-slate-400 bg-slate-500/15",
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-[#0a0f1c] border border-cyan-500/30 rounded-sm p-6 w-[700px] max-w-[95vw] max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()} data-testid="ticket-list-modal">
        <div className="flex justify-between items-center mb-4">
          <div>
            <div className="font-orbitron text-sm text-cyan-400 tracking-wider">TICKETS — {subscriber}</div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 text-cyan-400 animate-spin" /></div>
        ) : tickets.length === 0 ? (
          <div className="text-slate-500 text-center py-8 font-orbitron text-[10px] tracking-wider">NO TICKETS FOR THIS SUBSCRIBER</div>
        ) : (
          <div className="space-y-3">
            {tickets.map(t => (
              <div key={t.id} className="border border-slate-700/50 bg-slate-900/50 rounded-sm p-3" data-testid={`ticket-${t.id}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-orbitron text-[10px] text-white font-bold">{t.id}</span>
                    <span className={`font-orbitron text-[8px] px-2 py-0.5 rounded-sm ${statusColors[t.status] || 'text-slate-400'}`}>{t.status}</span>
                    <span className="font-orbitron text-[8px] text-slate-500">{t.issue_type}</span>
                  </div>
                  <span className="text-[8px] text-slate-600">{new Date(t.created_at).toLocaleDateString()}</span>
                </div>
                {t.description && <div className="text-[10px] text-slate-400 mb-2">{t.description}</div>}
                {t.assigned_tech && <div className="text-[8px] text-slate-500 mb-2">Tech: {t.assigned_tech} ({t.tech_email})</div>}

                {/* Actions */}
                <div className="flex gap-2 flex-wrap">
                  {t.status === "OPEN" && (
                    <>
                      <button onClick={() => setDispatchId(dispatchId === t.id ? null : t.id)} className="font-orbitron text-[7px] px-2 py-1 border border-purple-500/40 text-purple-400 rounded-sm hover:bg-purple-500/10" data-testid={`dispatch-btn-${t.id}`}>
                        <Send className="w-2.5 h-2.5 inline mr-1" />DISPATCH
                      </button>
                      <button onClick={() => updateStatus(t.id, "CLOSED")} className="font-orbitron text-[7px] px-2 py-1 border border-slate-500/40 text-slate-400 rounded-sm hover:bg-slate-500/10">CLOSE</button>
                    </>
                  )}
                  {t.status === "DISPATCHED" && (
                    <>
                      <button onClick={() => updateStatus(t.id, "EN ROUTE")} className="font-orbitron text-[7px] px-2 py-1 border border-blue-500/40 text-blue-400 rounded-sm hover:bg-blue-500/10">EN ROUTE</button>
                      <button onClick={() => updateStatus(t.id, "CLOSED")} className="font-orbitron text-[7px] px-2 py-1 border border-slate-500/40 text-slate-400 rounded-sm hover:bg-slate-500/10">CLOSE</button>
                    </>
                  )}
                  {t.status === "EN ROUTE" && (
                    <button onClick={() => updateStatus(t.id, "ON SITE")} className="font-orbitron text-[7px] px-2 py-1 border border-yellow-500/40 text-yellow-400 rounded-sm hover:bg-yellow-500/10">ON SITE</button>
                  )}
                  {t.status === "ON SITE" && (
                    <button onClick={() => updateStatus(t.id, "DONE")} className="font-orbitron text-[7px] px-2 py-1 border border-green-500/40 text-green-400 rounded-sm hover:bg-green-500/10">DONE</button>
                  )}
                  {t.status === "DONE" && (
                    <button onClick={() => updateStatus(t.id, "CLOSED")} className="font-orbitron text-[7px] px-2 py-1 border border-slate-500/40 text-slate-400 rounded-sm hover:bg-slate-500/10">CLOSE</button>
                  )}
                </div>

                {/* Dispatch form */}
                {dispatchId === t.id && (
                  <div className="mt-2 flex gap-2 items-end">
                    <div className="flex-1">
                      <input value={techName} onChange={e => setTechName(e.target.value)} placeholder="Tech name" className="w-full bg-slate-800/50 text-white border border-slate-700 rounded-sm px-2 py-1 text-[10px] outline-none" data-testid="tech-name-input" />
                    </div>
                    <div className="flex-1">
                      <input value={techEmail} onChange={e => setTechEmail(e.target.value)} placeholder="Tech email" className="w-full bg-slate-800/50 text-white border border-slate-700 rounded-sm px-2 py-1 text-[10px] outline-none" data-testid="tech-email-input" />
                    </div>
                    <button onClick={() => handleDispatch(t.id)} className="font-orbitron text-[7px] px-3 py-1 bg-purple-500/20 border border-purple-500/40 text-purple-400 rounded-sm hover:bg-purple-500/30" data-testid="confirm-dispatch-btn">SEND</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Settings modal
function SettingsModal({ onClose }) {
  const [view, setView] = useState("menu"); // "menu" or "field-techs"
  const [techs, setTechs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [addMode, setAddMode] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: "", company: "", email: "", mobile: "", address: "", area: "" });
  const [sortBy, setSortBy] = useState("name");

  const fetchTechs = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/service/field-techs`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setTechs(await res.json());
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { if (view === "field-techs") fetchTechs(); }, [view, fetchTechs]);

  const sortedTechs = [...techs].sort((a, b) => {
    if (sortBy === "name") {
      const aLast = (a.name || "").split(" ").pop().toLowerCase();
      const bLast = (b.name || "").split(" ").pop().toLowerCase();
      return aLast.localeCompare(bLast);
    }
    if (sortBy === "area") return (a.area || "zzz").localeCompare(b.area || "zzz");
    if (sortBy === "company") return (a.company || "zzz").localeCompare(b.company || "zzz");
    return 0;
  });

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    const token = localStorage.getItem("token");
    const url = editId ? `${API}/service/field-techs/${editId}` : `${API}/service/field-techs`;
    const method = editId ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      toast.success(editId ? "Tech updated" : "Tech added");
      setForm({ name: "", company: "", email: "", mobile: "", address: "", area: "" });
      setAddMode(false);
      setEditId(null);
      fetchTechs();
    }
  };

  const handleDelete = async (id) => {
    const token = localStorage.getItem("token");
    await fetch(`${API}/service/field-techs/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    toast.success("Tech removed");
    fetchTechs();
  };

  const startEdit = (tech) => {
    setEditId(tech.id);
    setForm({ name: tech.name || "", company: tech.company || "", email: tech.email || "", mobile: tech.mobile || tech.phone || "", address: tech.address || "", area: tech.area || tech.region || "" });
    setAddMode(true);
  };

  const inputClass = "w-full bg-transparent text-white border-b border-cyan-500/30 px-2 py-2 text-sm outline-none focus:border-cyan-400 transition-colors placeholder-slate-600";
  const labelClass = "font-orbitron text-[8px] text-slate-500 tracking-wider uppercase mb-1";

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-[#0a0f1c] border border-cyan-500/30 rounded-sm w-[800px] max-w-[95vw] max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()} data-testid="settings-modal">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-5 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            {view !== "menu" && (
              <button onClick={() => { setView("menu"); setAddMode(false); setEditId(null); }} className="text-slate-400 hover:text-white mr-1">
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <Settings className="w-5 h-5 text-cyan-400" />
            <div>
              <h2 className="text-xl font-bold text-white">Settings</h2>
              <p className="text-sm text-slate-500">Manage system configuration</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {view === "menu" ? (
            <div className="p-6">
              <button
                onClick={() => setView("field-techs")}
                className="w-full flex items-center gap-4 p-5 border border-slate-700/40 bg-slate-900/30 rounded-sm hover:bg-slate-800/40 hover:border-cyan-500/30 transition-all group"
                data-testid="field-techs-option"
              >
                <Users className="w-6 h-6 text-cyan-400/70 group-hover:text-cyan-400" />
                <div className="flex-1 text-left">
                  <div className="text-white font-bold text-sm">Field Techs</div>
                  <div className="text-slate-500 text-xs">Manage field technicians and their assignments</div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-slate-400" />
              </button>
            </div>
          ) : (
            <div className="p-6">
              {/* Field Techs Header */}
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-cyan-400" />
                  <h3 className="text-xl font-bold text-white">Field Techs</h3>
                </div>
                <div className="flex items-center gap-2">
                  {!addMode && (
                    <button onClick={() => { setAddMode(true); setEditId(null); setForm({ name: "", company: "", email: "", mobile: "", address: "", area: "" }); }} className="flex items-center gap-1.5 font-orbitron text-[9px] px-4 py-2 bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 rounded-sm hover:bg-cyan-500/25 transition-all" data-testid="add-tech-btn">
                      <Plus className="w-3 h-3" /> Add Tech
                    </button>
                  )}
                </div>
              </div>
              <div className="text-sm text-slate-500 mb-5">{techs.length} technician{techs.length !== 1 ? 's' : ''} registered</div>

              {/* Sort bar */}
              <div className="flex items-center gap-2 bg-slate-800/40 border border-slate-700/30 rounded-sm px-4 py-2 mb-5">
                <span className="font-orbitron text-[8px] text-slate-400 tracking-wider">SORT BY:</span>
                <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 rounded-sm px-2 py-0.5 text-xs font-orbitron outline-none cursor-pointer" data-testid="sort-techs">
                  <option value="name" className="bg-[#0a0f1c]">Last Name</option>
                  <option value="area" className="bg-[#0a0f1c]">Area</option>
                  <option value="company" className="bg-[#0a0f1c]">Company</option>
                </select>
              </div>

              {/* Add/Edit form */}
              {addMode && (
                <div className="border border-cyan-500/30 bg-slate-900/40 rounded-sm p-5 mb-5" data-testid="tech-form">
                  <div className="font-orbitron text-[10px] text-cyan-400 tracking-wider mb-4">{editId ? "EDIT" : "NEW"} FIELD TECHNICIAN</div>
                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div>
                      <div className={labelClass}>Name *</div>
                      <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className={inputClass} placeholder="Full name" data-testid="tech-name" />
                    </div>
                    <div>
                      <div className={labelClass}>Company</div>
                      <input value={form.company} onChange={e => setForm({...form, company: e.target.value})} className={inputClass} placeholder="e.g. MedTech Support" data-testid="tech-company" />
                    </div>
                    <div>
                      <div className={labelClass}>Email</div>
                      <input value={form.email} onChange={e => setForm({...form, email: e.target.value})} className={inputClass} placeholder="email@example.com" data-testid="tech-email" />
                    </div>
                    <div>
                      <div className={labelClass}>Mobile</div>
                      <input value={form.mobile} onChange={e => setForm({...form, mobile: e.target.value})} className={inputClass} placeholder="(555) 555-5555" data-testid="tech-mobile" />
                    </div>
                    <div>
                      <div className={labelClass}>Address</div>
                      <input value={form.address} onChange={e => setForm({...form, address: e.target.value})} className={inputClass} placeholder="321 Elm Street, Mobile, AL 36601" data-testid="tech-address" />
                    </div>
                    <div>
                      <div className={labelClass}>Area</div>
                      <input value={form.area} onChange={e => setForm({...form, area: e.target.value})} className={inputClass} placeholder="Gulf Coast, Southeast, etc." data-testid="tech-area" />
                    </div>
                  </div>
                  <div className="flex gap-3 justify-end pt-2">
                    <button onClick={() => { setAddMode(false); setEditId(null); }} className="font-orbitron text-[9px] px-4 py-1.5 text-slate-400 hover:text-white transition-colors">Cancel</button>
                    <button onClick={handleSave} className="font-orbitron text-[9px] px-5 py-1.5 bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 rounded-sm hover:bg-cyan-500/30 transition-all" data-testid="save-tech-btn">
                      {editId ? "UPDATE" : "SAVE"}
                    </button>
                  </div>
                </div>
              )}

              {/* Tech cards */}
              {loading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 text-cyan-400 animate-spin" /></div>
              ) : sortedTechs.length === 0 ? (
                <div className="text-center py-12 text-slate-500 font-orbitron text-[10px] tracking-wider">NO FIELD TECHNICIANS CONFIGURED</div>
              ) : (
                <div className="space-y-3">
                  {sortedTechs.map(tech => (
                    <div key={tech.id} className="border border-slate-700/40 bg-slate-900/30 rounded-sm overflow-hidden" data-testid={`tech-row-${tech.id}`}>
                      {/* Card header */}
                      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700/30">
                        <div className="flex items-center gap-3">
                          <Users className="w-4 h-4 text-cyan-400/60" />
                          <span className="text-white font-bold">{tech.name}</span>
                          {tech.company && <span className="text-[10px] text-slate-500 bg-slate-800/60 px-2 py-0.5 rounded-sm">{tech.company}</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => startEdit(tech)} className="flex items-center gap-1 font-orbitron text-[8px] px-3 py-1 bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 rounded-sm hover:bg-cyan-500/25 transition-all" data-testid={`edit-tech-${tech.id}`}>
                            <Edit2 className="w-2.5 h-2.5" /> EDIT
                          </button>
                          <button onClick={() => handleDelete(tech.id)} className="flex items-center gap-1 font-orbitron text-[8px] px-3 py-1 bg-red-500/15 border border-red-500/30 text-red-400 rounded-sm hover:bg-red-500/25 transition-all" data-testid={`delete-tech-${tech.id}`}>
                            <Trash2 className="w-2.5 h-2.5" /> DELETE
                          </button>
                        </div>
                      </div>
                      {/* Card body */}
                      <div className="px-5 py-3 space-y-1.5">
                        <div className="flex gap-8 text-[11px]">
                          <span className="text-slate-500">EMAIL: <span className="text-slate-300">{tech.email || '—'}</span></span>
                          <span className="text-slate-500">MOBILE: <span className="text-slate-300">{tech.mobile || tech.phone || '—'}</span></span>
                        </div>
                        <div className="text-[11px] text-slate-500">ADDRESS: <span className="text-slate-300">{tech.address || '—'}</span></div>
                        <div className="text-[11px] text-slate-500">
                          AREA: {tech.area || tech.region ? (
                            <span className="inline-block bg-cyan-500/15 text-cyan-400 px-2 py-0.5 rounded-sm text-[9px] font-orbitron">{tech.area || tech.region}</span>
                          ) : (
                            <span className="inline-block bg-slate-500/15 text-slate-400 px-2 py-0.5 rounded-sm text-[9px] font-orbitron">Not assigned</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ServiceTickets({ user, onLogout }) {
  const navigate = useNavigate();
  const [consoleData, setConsoleData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [createModal, setCreateModal] = useState(null);
  const [ticketModal, setTicketModal] = useState(null);
  const [deviceModal, setDeviceModal] = useState(null);
  const [createFromDevice, setCreateFromDevice] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [fieldTechs, setFieldTechs] = useState([]);

  const fetchData = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const [consoleRes, techsRes] = await Promise.all([
        fetch(`${API}/service/console-data`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/service/field-techs`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (consoleRes.ok) setConsoleData(await consoleRes.json());
      if (techsRes.ok) setFieldTechs(await techsRes.json());
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const stats = consoleData?.stats || {};
  const subscribers = consoleData?.subscribers || [];
  const completionTime = consoleData?.completion_time;

  return (
    <div className="min-h-screen bg-[#020617] text-white font-mono" data-testid="service-tickets-page">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/hub")} className="flex items-center gap-1 text-cyan-400 font-orbitron text-[10px] tracking-wider hover:text-cyan-300 transition-colors border border-cyan-500/30 px-3 py-1.5 rounded-sm" data-testid="back-to-hub">
            <ArrowLeft className="w-3 h-3" /> BACK TO HUB
          </button>
          <div className="flex items-center gap-2">
            <span className="text-red-500 text-lg">&#9829;</span>
            <span className="font-orbitron text-sm font-bold tracking-wider text-white">RESCUEAID</span>
            <span className="font-orbitron text-[8px] text-slate-500 tracking-wider">SERVICE CONSOLE V2.0</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => setSettingsOpen(true)} className="text-slate-400 hover:text-cyan-400 transition-colors" data-testid="settings-btn">
            <Settings className="w-4 h-4" />
          </button>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.7)] animate-pulse" />
            <span className="font-orbitron text-[9px] text-green-400 tracking-wider">SYSTEM ONLINE</span>
          </span>
        </div>
      </div>

      <div className="px-6 py-6 max-w-[1400px] mx-auto">
        {/* Title */}
        <div className="flex items-center gap-2 mb-1">
          <Zap className="w-5 h-5 text-cyan-400" />
          <h1 className="font-orbitron text-xl font-bold text-cyan-400 tracking-wider">SERVICE CONSOLE</h1>
        </div>
        <div className="text-slate-400 text-xs mb-1">AED Service Management</div>
        {completionTime && (
          <div className="text-[10px] text-slate-500 mb-4">
            Data from last download: <span className="text-amber-400">{new Date(completionTime).toLocaleString()}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 mb-6">
          <button onClick={handleRefresh} disabled={refreshing} className="flex items-center gap-1.5 font-orbitron text-[9px] tracking-wider px-4 py-2 border border-cyan-500/30 text-cyan-400 rounded-sm hover:bg-cyan-500/10 transition-all disabled:opacity-50" data-testid="refresh-btn">
            <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} /> REFRESH
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
            <span className="font-orbitron text-[10px] text-cyan-400 tracking-wider ml-3">LOADING SERVICE DATA...</span>
          </div>
        ) : (
          <>
            {/* Stats Row 1 */}
            <div className="flex gap-3 flex-wrap mb-3">
              <StatCard value={consoleData?.total_subscribers || 0} label="SUBSCRIBERS WITH SERVICE ISSUES" sublabel={`${consoleData?.total_subscribers || 0} with issues`} color="#06b6d4" icon={Radio} />
              <StatCard value={stats.total_aeds_need_service || 0} label="TOTAL AEDs THAT NEED SERVICE" color="#f472b6" icon={AlertTriangle} />
              <StatCard value={stats.active_tickets || 0} label="ACTIVE TICKETS" sublabel="All active tickets" color="#06b6d4" icon={Wrench} />
              <StatCard value={stats.dispatched || 0} label="DISPATCHED" sublabel="Active dispatched tickets" color="#a78bfa" icon={Send} />
            </div>

            {/* Stats Row 2 */}
            <div className="flex gap-3 flex-wrap mb-8">
              <StatCard value={stats.lost_contact || 0} label="LOST CONTACT" color="#f59e0b" icon={AlertTriangle} />
              <StatCard value={stats.not_ready || 0} label="NOT READY" color="#eab308" icon={AlertTriangle} />
              <StatCard value={stats.expired_bp || 0} label="EXPIRED B/P" color="#ec4899" icon={Clock} />
              <StatCard value={stats.expiring_bp || 0} label="EXPIRING B/P" color="#06b6d4" icon={Clock} />
            </div>

            {/* Service Overview Table */}
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-4 h-4 text-cyan-400" />
              <h2 className="font-orbitron text-sm font-bold text-cyan-400 tracking-wider">SERVICE OVERVIEW</h2>
            </div>
            <div className="text-[10px] text-slate-500 mb-4">{subscribers.length} SUBSCRIBERS MONITORED</div>

            <div className="border border-slate-700/50 rounded-sm overflow-hidden">
              {/* Table header */}
              <div className="grid grid-cols-[1fr_90px_70px_1fr_1fr] gap-2 px-4 py-3 bg-slate-800/30 border-b border-slate-700/50">
                <div className="font-orbitron text-[8px] text-slate-400 tracking-wider">SUBSCRIBER</div>
                <div className="font-orbitron text-[8px] text-slate-400 tracking-wider">TOTAL AEDs</div>
                <div className="font-orbitron text-[8px] text-slate-400 tracking-wider">ISSUES</div>
                <div className="font-orbitron text-[8px] text-slate-400 tracking-wider">ISSUE TYPES</div>
                <div className="font-orbitron text-[8px] text-slate-400 tracking-wider">STATUS</div>
              </div>

              {/* Table rows */}
              {subscribers.length === 0 ? (
                <div className="text-center py-8 text-slate-500 font-orbitron text-[10px]">NO SUBSCRIBERS WITH ACTIVE ISSUES</div>
              ) : (
                subscribers.map((sub, i) => (
                  <div key={sub.subscriber} className={`grid grid-cols-[1fr_90px_70px_1fr_1fr] gap-2 px-4 py-3 items-center ${i % 2 === 0 ? 'bg-transparent' : 'bg-slate-800/10'} border-b border-slate-700/20 hover:bg-slate-800/30 transition-colors`} data-testid={`subscriber-row-${i}`}>
                    <div className="text-sm text-white">{sub.subscriber}</div>
                    <div className="text-sm text-white">{sub.total_aeds}</div>
                    <div className="text-sm font-bold" style={{ color: sub.issues > 10 ? '#f472b6' : sub.issues > 5 ? '#fbbf24' : '#06b6d4' }}>
                      {sub.issues}
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      <IssueBadge type="NOT READY" count={sub.not_ready} />
                      <IssueBadge type="LOST CONTACT" count={sub.lost_contact} />
                      <IssueBadge type="EXPIRED B/P" count={sub.expired_bp} />
                      <IssueBadge type="EXPIRING B/P" count={sub.expiring_bp} />
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      <button onClick={() => setDeviceModal(sub.subscriber)} className="font-orbitron text-[7px] px-2 py-1 border border-red-500/30 text-red-400 rounded-sm hover:bg-red-500/10 transition-all flex items-center gap-1" data-testid={`need-attention-${i}`}>
                        <AlertTriangle className="w-2.5 h-2.5" /> NEED ATTENTION {sub.issues}
                      </button>
                      <button onClick={() => setCreateModal(sub.subscriber)} className="font-orbitron text-[7px] px-2 py-1 border border-cyan-500/30 text-cyan-400 rounded-sm hover:bg-cyan-500/10 transition-all flex items-center gap-1" data-testid={`create-ticket-${i}`}>
                        <Plus className="w-2.5 h-2.5" /> NEW TICKET
                      </button>
                      <button onClick={() => setTicketModal(sub.subscriber)} className="font-orbitron text-[7px] px-2 py-1 border border-yellow-500/30 text-yellow-400 rounded-sm hover:bg-yellow-500/10 transition-all flex items-center gap-1" data-testid={`active-tickets-${i}`}>
                        <FileText className="w-2.5 h-2.5" /> TICKETS ({sub.active_tickets || 0})
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {/* Modals */}
      {createModal && (
        <CreateTicketModal
          subscriber={createModal}
          device={createFromDevice}
          fieldTechs={fieldTechs}
          onClose={() => { setCreateModal(null); setCreateFromDevice(null); }}
          onCreated={() => fetchData()}
        />
      )}
      {ticketModal && (
        <TicketListModal subscriber={ticketModal} onClose={() => setTicketModal(null)} />
      )}
      {deviceModal && (
        <DeviceDetailModal
          subscriber={deviceModal}
          onClose={() => setDeviceModal(null)}
          onCreateTicket={(sub, dev) => {
            setDeviceModal(null);
            setCreateFromDevice(dev);
            setCreateModal(sub);
          }}
        />
      )}
      {settingsOpen && (
        <SettingsModal onClose={() => { setSettingsOpen(false); fetchData(); }} />
      )}
    </div>
  );
}
