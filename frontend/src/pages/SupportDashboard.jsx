import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Send, X, Trash2, Loader2, Settings,
  AlertTriangle, Clock, ChevronDown, ChevronUp, Mail,
  Users, Activity, Shield,
} from "lucide-react";
import { toast } from "sonner";
import API_BASE from "@/apiBase";

const API = API_BASE + "/api";

function StatCard({ value, label, color, icon: Icon }) {
  return (
    <div className="border border-slate-700/50 bg-[rgba(10,15,28,0.85)] rounded-sm p-4 min-w-[120px]">
      <div className="flex items-start justify-between">
        <div className="font-orbitron text-2xl font-black" style={{ color }}>{value}</div>
        {Icon && <Icon className="w-4 h-4 opacity-60" style={{ color }} />}
      </div>
      <div className="font-orbitron text-[7px] tracking-wider text-slate-400 mt-1.5 uppercase">{label}</div>
    </div>
  );
}

function NotificationModal({ subscriber, devices, contact, onClose, onSent }) {
  const [toEmail, setToEmail] = useState(contact?.to_email || "");
  const [ccEmail, setCcEmail] = useState(contact?.cc_email || "");
  const [bccEmails, setBccEmails] = useState(contact?.bcc_emails || "");
  const [removedDevices, setRemovedDevices] = useState(new Set());
  const [sending, setSending] = useState(false);
  const [emailType, setEmailType] = useState("all");

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

  const subject = emailType === "all"
    ? `AED Attention Required - ${subscriber}`
    : `${emailType} - AED Attention Required`;

  const buildEmailHtml = () => {
    let html = `<div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;">`;
    html += `<div style="background:#0a1628;color:#06b6d4;padding:20px;border-bottom:2px solid #06b6d4;">`;
    html += `<h2 style="margin:0;font-size:18px;">Cardiac Solutions - AED Status Notification</h2>`;
    html += `<p style="margin:4px 0 0;font-size:12px;color:#94a3b8;">Subscriber: ${subscriber}</p></div>`;
    html += `<div style="padding:20px;background:#fff;">`;
    html += `<p>Dear Customer,</p>`;
    html += `<p>The following AED devices at <strong>${subscriber}</strong> require your attention:</p>`;

    for (const [status, devs] of Object.entries(filteredGrouped)) {
      html += `<h3 style="color:#dc2626;border-bottom:1px solid #e5e7eb;padding-bottom:6px;margin-top:20px;">${status}</h3>`;
      html += `<table style="width:100%;border-collapse:collapse;font-size:13px;">`;
      html += `<tr style="background:#f8fafc;"><th style="text-align:left;padding:8px;border:1px solid #e5e7eb;">Device ID</th>`;
      html += `<th style="text-align:left;padding:8px;border:1px solid #e5e7eb;">Location</th>`;
      html += `<th style="text-align:left;padding:8px;border:1px solid #e5e7eb;">Details</th></tr>`;
      for (const d of devs) {
        html += `<tr>`;
        html += `<td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold;">${d.sentinel_id}</td>`;
        html += `<td style="padding:8px;border:1px solid #e5e7eb;">${d.location || "—"}</td>`;
        html += `<td style="padding:8px;border:1px solid #e5e7eb;">${d.days_summary || "—"}</td>`;
        html += `</tr>`;
      }
      html += `</table>`;
    }

    html += `<p style="margin-top:20px;">Please address these issues at your earliest convenience. If you have any questions, contact our support team.</p>`;
    html += `<p>Best regards,<br><strong>Cardiac Solutions Support Team</strong></p>`;
    html += `</div></div>`;
    return html;
  };

  const handleSend = async () => {
    if (!toEmail) { toast.error("Customer email (TO) is required"); return; }
    setSending(true);
    try {
      const token = localStorage.getItem("token");
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
      <div className="bg-[#0a0f1c] border border-cyan-500/30 rounded-sm w-[800px] max-w-[95vw] max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()} data-testid="notification-modal">
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
              <span className="font-orbitron text-[9px] text-slate-500 w-[100px] flex-shrink-0">Subject:</span>
              <span className="text-xs text-white">{subject}</span>
            </div>
          </div>
        </div>

        {/* Email Preview */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          <div className="font-orbitron text-[8px] tracking-wider text-amber-400 mb-2">
            EMAIL PREVIEW - REMOVE WRONG AEDs WITH THE ICON
          </div>
          <div className="bg-white rounded-sm p-4 text-slate-900 text-sm">
            {Object.entries(filteredGrouped).map(([status, devs]) => (
              <div key={status} className="mb-4">
                <h3 className="font-bold text-red-600 border-b border-slate-200 pb-1 mb-2 text-sm">{status}</h3>
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="text-left p-2 border border-slate-200">Device ID</th>
                      <th className="text-left p-2 border border-slate-200">Location</th>
                      <th className="text-left p-2 border border-slate-200">Details</th>
                      <th className="w-8 border border-slate-200"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {devs.map(d => (
                      <tr key={d.sentinel_id} className="hover:bg-slate-50">
                        <td className="p-2 border border-slate-200 font-bold">{d.sentinel_id}</td>
                        <td className="p-2 border border-slate-200 text-[11px]">{d.location || "—"}</td>
                        <td className="p-2 border border-slate-200 text-[11px]">{d.days_summary || "—"}</td>
                        <td className="p-2 border border-slate-200 text-center">
                          <button
                            onClick={() => setRemovedDevices(prev => new Set([...prev, d.sentinel_id]))}
                            className="text-red-400 hover:text-red-600"
                            data-testid={`remove-device-${d.sentinel_id}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
            {Object.keys(filteredGrouped).length === 0 && (
              <div className="text-center text-slate-400 py-4">No devices to include</div>
            )}
          </div>
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
    </div>
  );
}

function ContactsModal({ onClose }) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editSub, setEditSub] = useState(null);
  const [form, setForm] = useState({ to_email: "", cc_email: "", bcc_emails: "", sales_rep: "" });

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

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-[#0a0f1c] border border-cyan-500/30 rounded-sm p-6 w-[700px] max-w-[95vw] max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()} data-testid="contacts-modal">
        <div className="flex justify-between items-center mb-4">
          <div className="font-orbitron text-sm text-cyan-400 tracking-wider">SUBSCRIBER CONTACTS</div>
          <button onClick={onClose} className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        {editSub ? (
          <div className="space-y-3">
            <div className="font-orbitron text-xs text-white mb-2">{editSub}</div>
            {[
              { key: "to_email", label: "Customer Email (TO)" },
              { key: "cc_email", label: "Sales Rep (CC)" },
              { key: "bcc_emails", label: "BCC (comma-separated)" },
              { key: "sales_rep", label: "Sales Rep Name" },
            ].map(f => (
              <div key={f.key}>
                <label className="font-orbitron text-[8px] text-slate-500 mb-1 block">{f.label}</label>
                <input
                  value={form[f.key]}
                  onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                  className="w-full px-3 py-2 rounded-sm bg-slate-900 border border-slate-700 text-white text-xs"
                  data-testid={`contact-${f.key}`}
                />
              </div>
            ))}
            <div className="flex gap-2 mt-3">
              <button onClick={saveContact} className="font-orbitron text-[9px] px-4 py-1.5 border border-cyan-500/40 text-cyan-400 rounded-sm hover:bg-cyan-500/10">SAVE</button>
              <button onClick={() => setEditSub(null)} className="font-orbitron text-[9px] px-4 py-1.5 border border-slate-600 text-slate-400 rounded-sm hover:bg-slate-800">CANCEL</button>
            </div>
          </div>
        ) : (
          <>
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-cyan-400 animate-spin" /></div>
            ) : contacts.length === 0 ? (
              <div className="text-slate-500 text-center py-8 font-orbitron text-[10px]">NO CONTACTS CONFIGURED YET<br />Click a subscriber in the dashboard to set up contacts</div>
            ) : (
              <div className="space-y-2">
                {contacts.map(c => (
                  <div key={c.subscriber} className="border border-slate-700/50 bg-slate-900/50 rounded-sm p-3 flex justify-between items-center">
                    <div>
                      <div className="font-orbitron text-[10px] text-white">{c.subscriber}</div>
                      <div className="text-[9px] text-slate-400 mt-0.5">{c.to_email || "No email"} | CC: {c.cc_email || "—"}</div>
                    </div>
                    <button
                      onClick={() => { setEditSub(c.subscriber); setForm({ to_email: c.to_email, cc_email: c.cc_email, bcc_emails: c.bcc_emails, sales_rep: c.sales_rep || "" }); }}
                      className="font-orbitron text-[8px] px-2 py-1 border border-cyan-500/30 text-cyan-400 rounded-sm hover:bg-cyan-500/10"
                    >
                      EDIT
                    </button>
                  </div>
                ))}
              </div>
            )}
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
  const [sortField, setSortField] = useState("total_issues");
  const [sortDir, setSortDir] = useState("desc");
  const [search, setSearch] = useState("");

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

  useEffect(() => { fetchData(); }, [fetchData]);

  const subscribers = data?.subscribers || [];
  const totals = data?.fleet_totals || {};

  const filtered = subscribers
    .filter(s => s.total_issues > 0)
    .filter(s => !search || s.subscriber.toLowerCase().includes(search.toLowerCase()));

  const sorted = [...filtered].sort((a, b) => {
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
            onClick={() => setShowContacts(true)}
            className="font-orbitron text-[8px] px-3 py-1.5 border border-cyan-500/30 text-cyan-400 rounded-sm hover:bg-cyan-500/10 flex items-center gap-1.5"
            data-testid="contacts-btn"
          >
            <Settings className="w-3 h-3" /> CONTACTS
          </button>
          <button onClick={onLogout} className="font-orbitron text-[8px] px-3 py-1.5 border border-red-500/30 text-red-400 rounded-sm hover:bg-red-500/10">
            LOGOUT
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
              <StatCard value={data?.total_subscribers || 0} label="SUBSCRIBERS WITH ISSUES" color="#06b6d4" icon={Users} />
              <StatCard value={totals.expired_bp || 0} label="EXPIRED B/P" color="#ef4444" icon={AlertTriangle} />
              <StatCard value={totals.expiring_bp || 0} label="EXPIRING B/P" color="#f59e0b" icon={Clock} />
              <StatCard value={totals.not_ready || 0} label="NOT READY" color="#f97316" icon={Activity} />
              <StatCard value={totals.reposition || 0} label="REPOSITION" color="#a855f7" icon={Shield} />
              <StatCard value={totals.unknown || 0} label="UNKNOWN" color="#64748b" icon={Shield} />
            </div>

            {/* Search */}
            <div className="mb-4">
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search subscribers..."
                className="px-4 py-2 rounded-sm bg-slate-900/80 border border-slate-700/50 text-white text-sm font-orbitron w-full max-w-xs"
                data-testid="subscriber-search"
              />
            </div>

            {/* Subscriber Table */}
            <div className="border border-slate-700/30 rounded-sm overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-[rgba(6,182,212,0.05)] border-b border-cyan-500/15">
                    <th className="text-left p-3 font-orbitron text-[8px] tracking-wider text-cyan-500/70 cursor-pointer" onClick={() => toggleSort("subscriber")}>
                      SUBSCRIBER <SortIcon field="subscriber" />
                    </th>
                    <th className="text-center p-3 font-orbitron text-[8px] tracking-wider text-red-400/70 cursor-pointer w-24" onClick={() => toggleSort("expired_bp")}>
                      EXPIRED B/P <SortIcon field="expired_bp" />
                    </th>
                    <th className="text-center p-3 font-orbitron text-[8px] tracking-wider text-amber-400/70 cursor-pointer w-24" onClick={() => toggleSort("expiring_bp")}>
                      EXPIRING B/P <SortIcon field="expiring_bp" />
                    </th>
                    <th className="text-center p-3 font-orbitron text-[8px] tracking-wider text-pink-400/70 cursor-pointer w-24" onClick={() => toggleSort("total_issues")}>
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
                          <span className="font-orbitron text-sm font-bold text-red-400">{s.expired_bp}</span>
                        ) : (
                          <span className="text-slate-600">0</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {s.expiring_bp > 0 ? (
                          <span className="font-orbitron text-sm font-bold text-amber-400">{s.expiring_bp}</span>
                        ) : (
                          <span className="text-slate-600">0</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <span className="font-orbitron text-sm font-bold text-pink-400">{s.total_issues}</span>
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => setSelectedSub(s)}
                          className="font-orbitron text-[7px] px-2 py-1 border border-cyan-500/30 text-cyan-400 rounded-sm hover:bg-cyan-500/10 inline-flex items-center gap-1"
                          data-testid={`notify-btn-${s.subscriber}`}
                        >
                          <Send className="w-2.5 h-2.5" /> NOTIFY
                        </button>
                      </td>
                    </tr>
                  ))}
                  {sorted.length === 0 && (
                    <tr><td colSpan={5} className="text-center py-8 text-slate-500 font-orbitron text-[10px]">NO SUBSCRIBERS WITH ISSUES</td></tr>
                  )}
                </tbody>
              </table>
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
          devices={selectedSub.devices}
          contact={selectedSub.contact}
          onClose={() => setSelectedSub(null)}
          onSent={fetchData}
        />
      )}
      {showContacts && <ContactsModal onClose={() => { setShowContacts(false); fetchData(); }} />}
    </div>
  );
}
