import React, { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { CheckCircle, Truck, MapPin, Wrench, Loader2, AlertTriangle } from "lucide-react";
import { toast, Toaster } from "sonner";
import API_BASE from "@/apiBase";

const API = `${API_BASE}/api`;

const STATUS_FLOW = [
  { key: "DISPATCHED", label: "Dispatched", icon: Wrench, color: "#a78bfa" },
  { key: "ACKNOWLEDGED", label: "Acknowledged", icon: CheckCircle, color: "#06b6d4" },
  { key: "EN ROUTE", label: "En Route", icon: Truck, color: "#3b82f6" },
  { key: "ON SITE", label: "On Site", icon: MapPin, color: "#f59e0b" },
  { key: "COMPLETE", label: "Complete", icon: CheckCircle, color: "#22c55e" },
];

export default function TechResponse() {
  const { ticketId } = useParams();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    const fetchTicket = async () => {
      try {
        const res = await fetch(`${API}/tech/ticket/${ticketId}?token=${token}`);
        if (res.ok) {
          setTicket(await res.json());
        } else {
          const err = await res.json();
          setError(err.detail || "Unable to load ticket");
        }
      } catch {
        setError("Unable to connect to server");
      }
      setLoading(false);
    };
    fetchTicket();
  }, [ticketId, token]);

  const updateStatus = async (newStatus) => {
    setUpdating(true);
    try {
      const res = await fetch(`${API}/tech/ticket/${ticketId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, status: newStatus, note }),
      });
      if (res.ok) {
        const updated = await res.json();
        setTicket(updated);
        setNote("");
        toast.success(`Status updated to ${newStatus}`);
      } else {
        const err = await res.json();
        toast.error(err.detail || "Update failed");
      }
    } catch {
      toast.error("Connection error");
    }
    setUpdating(false);
  };

  const currentIdx = STATUS_FLOW.findIndex(s => s.key === ticket?.status);
  const nextStatus = currentIdx >= 0 && currentIdx < STATUS_FLOW.length - 1 ? STATUS_FLOW[currentIdx + 1] : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <div className="text-xl text-white font-bold mb-2">Access Denied</div>
          <div className="text-slate-400">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-white font-mono" data-testid="tech-response-page">
      <Toaster position="top-center" theme="dark" />
      {/* Header */}
      <div className="border-b border-slate-800 px-5 py-4">
        <div className="max-w-[700px] mx-auto flex items-center gap-3">
          <span className="text-red-500 text-xl">&#9829;</span>
          <span className="font-orbitron text-sm font-bold tracking-wider">RESCUEAID</span>
          <span className="font-orbitron text-[8px] text-slate-500 tracking-wider">FIELD TECH PORTAL</span>
        </div>
      </div>

      <div className="max-w-[700px] mx-auto px-5 py-8">
        {/* Ticket ID */}
        <div className="font-orbitron text-[10px] text-slate-500 tracking-wider mb-1">SERVICE TICKET</div>
        <div className="text-2xl font-bold text-cyan-400 mb-6">{ticket.id}</div>

        {/* Status Progress */}
        <div className="flex items-center gap-1 mb-8 overflow-x-auto pb-2">
          {STATUS_FLOW.map((step, i) => {
            const isActive = i <= currentIdx;
            const isCurrent = step.key === ticket.status;
            const Icon = step.icon;
            return (
              <React.Fragment key={step.key}>
                {i > 0 && <div className={`flex-1 h-[2px] min-w-[20px] ${isActive ? 'bg-cyan-400' : 'bg-slate-700'}`} />}
                <div className={`flex flex-col items-center gap-1 ${isCurrent ? 'scale-110' : ''}`}>
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all ${isActive ? 'border-cyan-400 bg-cyan-500/15' : 'border-slate-700 bg-transparent'}`}>
                    <Icon className="w-4 h-4" style={{ color: isActive ? step.color : '#475569' }} />
                  </div>
                  <span className={`font-orbitron text-[7px] tracking-wider whitespace-nowrap ${isActive ? 'text-cyan-400' : 'text-slate-600'}`}>{step.label}</span>
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {/* Ticket Details */}
        <div className="border border-slate-700/50 bg-[rgba(10,15,28,0.85)] rounded-sm p-5 mb-6">
          <div className="font-orbitron text-[9px] text-cyan-400 tracking-wider mb-4 pb-2 border-b border-cyan-500/20">TICKET DETAILS</div>
          <div className="space-y-3">
            <Row label="SUBSCRIBER" value={ticket.subscriber} />
            <Row label="DEVICE ID" value={ticket.device_id} />
            <Row label="ISSUE TYPE" value={ticket.issue_type} highlight />
            <Row label="LOCATION" value={ticket.location} />
            <Row label="PRIORITY" value={ticket.priority} />
            <Row label="ASSIGNED TO" value={ticket.assigned_tech} accent />
            {ticket.description && <Row label="DESCRIPTION" value={ticket.description} />}
            <Row label="DISPATCHED" value={ticket.dispatched_at ? new Date(ticket.dispatched_at).toLocaleString() : '—'} />
          </div>
        </div>

        {/* Notes */}
        {ticket.notes && ticket.notes.length > 0 && (
          <div className="border border-slate-700/50 bg-[rgba(10,15,28,0.85)] rounded-sm p-5 mb-6">
            <div className="font-orbitron text-[9px] text-cyan-400 tracking-wider mb-3">ACTIVITY LOG</div>
            <div className="space-y-2">
              {ticket.notes.map((n, i) => (
                <div key={i} className="text-xs text-slate-400 border-l-2 border-cyan-500/30 pl-3">
                  <span className="text-slate-500 text-[10px]">{new Date(n.at).toLocaleString()} — {n.by}</span>
                  <div className="text-slate-300 mt-0.5">{n.text}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action */}
        {nextStatus ? (
          <div className="border border-cyan-500/30 bg-[rgba(10,15,28,0.85)] rounded-sm p-5">
            <div className="font-orbitron text-[9px] text-cyan-400 tracking-wider mb-4">UPDATE STATUS</div>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              className="w-full bg-transparent text-white border border-slate-700/50 rounded-sm px-3 py-2 text-sm outline-none focus:border-cyan-500/50 resize-none mb-4 placeholder-slate-600"
              placeholder="Add a note (optional)..."
              data-testid="tech-note-input"
            />
            <button
              onClick={() => updateStatus(nextStatus.key)}
              disabled={updating}
              className="w-full flex items-center justify-center gap-2 font-orbitron text-sm tracking-wider py-3 rounded-sm transition-all disabled:opacity-50"
              style={{ background: `${nextStatus.color}20`, border: `1px solid ${nextStatus.color}60`, color: nextStatus.color }}
              data-testid="update-status-btn"
            >
              {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <nextStatus.icon className="w-4 h-4" />}
              {nextStatus.label.toUpperCase()}
            </button>
          </div>
        ) : (
          <div className="text-center py-8">
            <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
            <div className="font-orbitron text-sm text-green-400 tracking-wider">SERVICE COMPLETE</div>
            <div className="text-slate-500 text-xs mt-2">This ticket has been completed. Thank you!</div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, highlight, accent }) {
  return (
    <div className="flex">
      <span className="w-[120px] flex-shrink-0 text-[10px] text-slate-500 font-orbitron tracking-wider">{label}</span>
      <span className={`text-sm ${highlight ? 'text-amber-400 font-bold' : accent ? 'text-cyan-400 font-bold' : 'text-slate-300'}`}>
        {value || '—'}
      </span>
    </div>
  );
}
