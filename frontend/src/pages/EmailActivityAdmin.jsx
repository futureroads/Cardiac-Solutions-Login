import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, RefreshCw, AlertCircle, CheckCircle2, Mail, X, Loader2, Search, Send } from "lucide-react";
import API_BASE from "@/apiBase";

const API = `${API_BASE}/api`;

export default function EmailActivityAdmin() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [user, setUser] = useState("");
  const [status, setStatus] = useState("all"); // all | success | failed
  const [search, setSearch] = useState("");
  const [detailRow, setDetailRow] = useState(null);

  // Email provider selector (SendGrid / Mailgun)
  const [provider, setProvider] = useState(null); // { active, providers: { sendgrid: {configured}, mailgun: {configured} } }
  const [providerSaving, setProviderSaving] = useState(false);
  const [providerErr, setProviderErr] = useState("");

  const loadProvider = async () => {
    try {
      const token = localStorage.getItem("token");
      const r = await fetch(`${API}/admin/email-provider`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) setProvider(await r.json());
    } catch (e) { /* non-fatal */ }
  };

  const switchProvider = async (newProvider) => {
    if (!provider || newProvider === provider.active) return;
    setProviderSaving(true);
    setProviderErr("");
    try {
      const token = localStorage.getItem("token");
      const r = await fetch(`${API}/admin/email-provider`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ provider: newProvider }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || `HTTP ${r.status}`);
      await loadProvider();
    } catch (e) {
      setProviderErr(e.message || "Failed to switch provider");
    } finally {
      setProviderSaving(false);
    }
  };

  useEffect(() => { loadProvider(); }, []);

  // Test email modal
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState(null); // {success, message, provider}

  const sendTestEmail = async () => {
    const target = (testEmail || "").trim();
    if (!target) {
      setTestResult({ success: false, message: "Enter a recipient email." });
      return;
    }
    setTestSending(true);
    setTestResult(null);
    try {
      const token = localStorage.getItem("token");
      const r = await fetch(`${API}/support/test-email`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ to_email: target }),
      });
      const d = await r.json();
      if (!r.ok || d.success === false) {
        setTestResult({ success: false, message: d.message || d.detail || `HTTP ${r.status}`, provider: d.provider });
      } else {
        setTestResult({ success: true, message: d.message || `Sent via ${d.provider}`, provider: d.provider });
        // Refresh the activity list so the new send appears
        load();
      }
    } catch (e) {
      setTestResult({ success: false, message: e.message || "Network error" });
    } finally {
      setTestSending(false);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const params = new URLSearchParams({ days: String(days), status });
      if (user) params.set("user", user);
      const res = await fetch(`${API}/admin/email-activity?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setData(await res.json());
      else if (res.status === 403) setData({ _error: "ADMIN ACCESS REQUIRED" });
      else setData({ _error: `HTTP ${res.status}` });
    } catch (e) {
      setData({ _error: String(e) });
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [days, user, status]);

  const fmt = (iso) => iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit" }) : "—";

  const filtered = useMemo(() => {
    if (!data?.activity) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data.activity;
    return data.activity.filter(a =>
      [a.subscriber, a.to_email, a.cc_email, a.bcc_emails, a.subject, a.email_response, a.error_message, a.sent_by]
        .some(v => (v || "").toLowerCase().includes(q))
    );
  }, [data, search]);

  const totals = data?.totals || {};
  const byUser = data?.by_user || {};
  const distinctUsers = data?.distinct_users || [];

  if (data?._error) {
    return (
      <div className="min-h-screen bg-[#060a14] text-white flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <div className="font-orbitron text-red-400 tracking-wider">{data._error}</div>
          <button onClick={() => navigate("/hub")} className="mt-4 font-orbitron text-[10px] px-4 py-2 border border-cyan-500/40 text-cyan-400 rounded-sm hover:bg-cyan-500/10">BACK TO HUB</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060a14] text-white" data-testid="email-activity-admin">
      {/* Top bar */}
      <div className="border-b border-cyan-500/15 px-6 py-3 flex items-center justify-between bg-[rgba(6,10,20,0.95)]">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/hub")} className="text-slate-500 hover:text-cyan-400" data-testid="back-to-hub">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="font-orbitron text-sm tracking-wider text-cyan-400">EMAIL ACTIVITY MONITOR</div>
            <div className="text-[9px] text-slate-500 font-orbitron tracking-wider">ADMIN — INVESTIGATE FAILED & SUCCESSFUL SENDS</div>
          </div>
          {/* Email provider toggle */}
          {provider && (
            <div className="flex items-center gap-2 ml-3 pl-3 border-l border-slate-700/60" data-testid="email-provider-toggle">
              <span className="font-orbitron text-[9px] text-slate-500 tracking-widest">PROVIDER:</span>
              <div className="flex items-center border border-slate-700 rounded-sm overflow-hidden">
                {["sendgrid", "mailgun", "resend"].map((p) => {
                  const isActive = provider.active === p;
                  const isConfigured = provider.providers?.[p]?.configured;
                  const label = provider.providers?.[p]?.label || p.toUpperCase();
                  return (
                    <button
                      key={p}
                      onClick={() => switchProvider(p)}
                      disabled={providerSaving || !isConfigured}
                      data-testid={`provider-${p}`}
                      title={!isConfigured ? `${label} is not configured (missing API key)` : isActive ? `Active: all emails go through ${label}` : `Switch to ${label}`}
                      className={`font-orbitron text-[9px] px-3 py-1 transition ${
                        isActive
                          ? "bg-cyan-500/20 text-cyan-300"
                          : isConfigured
                            ? "text-slate-400 hover:text-cyan-300 hover:bg-cyan-500/5"
                            : "text-slate-700 cursor-not-allowed"
                      }`}
                    >
                      {label.toUpperCase()}
                      {!isConfigured && <span className="ml-1 text-[8px]">(N/A)</span>}
                      {isActive && <span className="ml-1 text-emerald-400">●</span>}
                    </button>
                  );
                })}
              </div>
              {providerErr && <span className="text-[9px] text-red-400 font-orbitron">{providerErr}</span>}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <select value={days} onChange={e => setDays(parseInt(e.target.value))} className="bg-slate-900 border border-slate-700 text-cyan-300 text-[10px] font-orbitron px-2 py-1 rounded-sm" data-testid="days-select">
            <option value={1}>LAST 24H</option>
            <option value={7}>7 DAYS</option>
            <option value={30}>30 DAYS</option>
            <option value={90}>90 DAYS</option>
            <option value={365}>1 YEAR</option>
          </select>
          <select value={user} onChange={e => setUser(e.target.value)} className="bg-slate-900 border border-slate-700 text-cyan-300 text-[10px] font-orbitron px-2 py-1 rounded-sm" data-testid="user-filter">
            <option value="">ALL USERS</option>
            {distinctUsers.map(u => <option key={u} value={u}>{u.toUpperCase()}</option>)}
          </select>
          <div className="flex items-center border border-slate-700 rounded-sm overflow-hidden">
            {[
              { v: "all", label: "ALL", color: "text-slate-300" },
              { v: "success", label: "SUCCESS", color: "text-emerald-400" },
              { v: "failed", label: "FAILED", color: "text-red-400" },
            ].map(s => (
              <button
                key={s.v}
                onClick={() => setStatus(s.v)}
                className={`font-orbitron text-[9px] px-3 py-1 ${status === s.v ? "bg-cyan-500/15 " + s.color : "text-slate-500 hover:text-slate-300"}`}
                data-testid={`status-${s.v}`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <button onClick={load} className="font-orbitron text-[9px] px-2 py-1 border border-cyan-500/30 text-cyan-400 rounded-sm hover:bg-cyan-500/10 inline-flex items-center gap-1" data-testid="reload-btn">
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} /> RELOAD
          </button>
          <button
            onClick={() => { setTestResult(null); setTestModalOpen(true); }}
            data-testid="send-test-email-btn"
            className="font-orbitron text-[9px] px-2 py-1 border border-emerald-500/40 text-emerald-300 rounded-sm hover:bg-emerald-500/10 inline-flex items-center gap-1"
          >
            <Send className="w-3 h-3" /> SEND TEST
          </button>
        </div>
      </div>

      {/* Stats strip */}
      <div className="border-b border-slate-800/60 px-6 py-3 grid grid-cols-4 gap-3 bg-slate-950/40">
        <div className="text-center">
          <div className="font-orbitron text-2xl font-black text-cyan-400">{totals.total || 0}</div>
          <div className="font-orbitron text-[8px] tracking-wider text-slate-500 mt-0.5 uppercase">TOTAL SENDS</div>
        </div>
        <div className="text-center">
          <div className="font-orbitron text-2xl font-black text-emerald-400">{totals.success || 0}</div>
          <div className="font-orbitron text-[8px] tracking-wider text-slate-500 mt-0.5 uppercase">SUCCESSFUL</div>
        </div>
        <div className="text-center">
          <div className={`font-orbitron text-2xl font-black ${(totals.failed || 0) > 0 ? "text-red-400" : "text-slate-600"}`}>{totals.failed || 0}</div>
          <div className="font-orbitron text-[8px] tracking-wider text-slate-500 mt-0.5 uppercase">FAILED</div>
        </div>
        <div className="text-center">
          <div className="font-orbitron text-2xl font-black text-amber-400">{distinctUsers.length}</div>
          <div className="font-orbitron text-[8px] tracking-wider text-slate-500 mt-0.5 uppercase">ACTIVE USERS</div>
        </div>
      </div>

      {/* Per-user breakdown */}
      {Object.keys(byUser).length > 0 && (
        <div className="border-b border-slate-800/60 px-6 py-3 bg-slate-950/30">
          <div className="font-orbitron text-[8px] tracking-wider text-slate-500 mb-2">BY USER</div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(byUser).sort((a, b) => b[1].total - a[1].total).map(([u, c]) => (
              <button
                key={u}
                onClick={() => setUser(user === u ? "" : u)}
                className={`font-orbitron text-[10px] px-3 py-1.5 rounded-sm border ${user === u ? "bg-cyan-500/15 border-cyan-500/40 text-cyan-400" : "border-slate-700/60 text-slate-300 hover:border-slate-500"}`}
                data-testid={`user-chip-${u}`}
              >
                <span className="font-bold">{u.toUpperCase()}</span>{" "}
                <span className="text-slate-500">·</span>{" "}
                <span className="text-slate-300">{c.total}</span>{" "}
                <span className="text-emerald-400">✓{c.success}</span>{" "}
                {c.failed > 0 && <span className="text-red-400">✗{c.failed}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="px-6 py-3 border-b border-slate-800/60">
        <div className="relative max-w-md">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search subscriber, recipient, subject, error..."
            className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-700 text-white text-[11px] rounded-sm focus:outline-none focus:border-cyan-500/40"
            data-testid="search-input"
          />
        </div>
      </div>

      {/* Activity table */}
      <div className="overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-cyan-400" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-slate-500 font-orbitron text-[11px]">NO ACTIVITY MATCHES FILTERS</div>
        ) : (
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 bg-[#0a0f1c] z-10 border-b border-slate-800">
              <tr>
                <th className="text-center p-3 font-orbitron text-[8px] text-slate-400 tracking-wider w-16"></th>
                <th className="text-left p-3 font-orbitron text-[8px] text-slate-400 tracking-wider">SENT AT</th>
                <th className="text-left p-3 font-orbitron text-[8px] text-slate-400 tracking-wider">USER</th>
                <th className="text-left p-3 font-orbitron text-[8px] text-slate-400 tracking-wider">SUBSCRIBER</th>
                <th className="text-left p-3 font-orbitron text-[8px] text-slate-400 tracking-wider">TO</th>
                <th className="text-left p-3 font-orbitron text-[8px] text-slate-400 tracking-wider">SUBJECT</th>
                <th className="text-left p-3 font-orbitron text-[8px] text-slate-400 tracking-wider">RESULT</th>
                <th className="text-left p-3 font-orbitron text-[8px] text-slate-400 tracking-wider">STATUS</th>
                <th className="text-center p-3 font-orbitron text-[8px] text-slate-400 tracking-wider">AEDs</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a, i) => {
                const ok = a.success;
                return (
                  <tr
                    key={i}
                    onClick={() => setDetailRow(a)}
                    className={`border-b border-slate-800/40 cursor-pointer hover:bg-cyan-500/5 ${!ok ? "bg-red-500/5" : ""}`}
                    data-testid={`activity-row-${i}`}
                  >
                    <td className="p-3 text-center">
                      {ok
                        ? <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" />
                        : <AlertCircle className="w-4 h-4 text-red-400 mx-auto" />}
                    </td>
                    <td className="p-3 text-slate-400 whitespace-nowrap text-[10px]">{fmt(a.sent_at)}</td>
                    <td className="p-3 font-orbitron text-cyan-300 text-[10px]">{(a.sent_by || "—").toUpperCase()}</td>
                    <td className="p-3 text-slate-200">{a.subscriber || "—"}</td>
                    <td className="p-3 text-slate-300 text-[10px]">{a.to_email}</td>
                    <td className="p-3 text-slate-300 text-[10px] max-w-[300px] truncate" title={a.subject}>{a.subject || "—"}</td>
                    <td className={`p-3 font-orbitron text-[10px] ${ok ? "text-emerald-400" : "text-red-400 font-bold"}`}>{a.email_response || "—"}</td>
                    <td className="p-3"><EmailStatusBadges row={a} /></td>
                    <td className="p-3 text-center font-orbitron text-slate-400">{(a.linked_sentinel_ids || []).length}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail drawer */}
      {detailRow && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4" onClick={() => setDetailRow(null)}>
          <div className="bg-[#0a0f1c] border border-cyan-500/30 rounded-sm w-full max-w-[900px] max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()} data-testid="activity-detail">
            <div className="border-b border-cyan-500/15 px-5 py-3 flex items-center justify-between bg-[rgba(6,10,20,0.95)]">
              <div className="flex items-center gap-3">
                {detailRow.success
                  ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  : <AlertCircle className="w-4 h-4 text-red-400" />}
                <div>
                  <div className="font-orbitron text-sm tracking-wider text-cyan-400">SEND ATTEMPT DETAIL</div>
                  <div className={`font-orbitron text-[9px] tracking-wider ${detailRow.success ? "text-emerald-400" : "text-red-400"}`}>{detailRow.email_response || "—"}</div>
                </div>
              </div>
              <button onClick={() => setDetailRow(null)} className="text-slate-500 hover:text-white" data-testid="detail-close"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-[11px]">
              <Section label="WHEN">{fmt(detailRow.sent_at)}</Section>
              <Section label="USER (sent_by)">{detailRow.sent_by || "—"}</Section>
              <Section label="SUBSCRIBER">{detailRow.subscriber || "—"}</Section>
              <Section label="TO">{detailRow.to_email}</Section>
              {detailRow.cc_email && <Section label="CC">{detailRow.cc_email}</Section>}
              {detailRow.bcc_emails && <Section label="BCC">{detailRow.bcc_emails}</Section>}
              <Section label="SUBJECT">{detailRow.subject || "—"}</Section>
              <Section label="SENDGRID RESPONSE">{detailRow.email_response || "—"}</Section>
              {detailRow.sg_message_id && <Section label="SG MESSAGE ID"><code className="text-[10px] font-mono text-slate-300 break-all">{detailRow.sg_message_id}</code></Section>}
              {!detailRow.success && (
                <>
                  {detailRow.error_type && <Section label="ERROR TYPE"><span className="text-red-400 font-bold">{detailRow.error_type}</span></Section>}
                  {detailRow.error_message && (
                    <div>
                      <div className="font-orbitron text-[8px] text-slate-500 tracking-wider mb-1">ERROR MESSAGE</div>
                      <pre className="text-[10px] font-mono text-red-300 bg-red-500/10 border border-red-500/30 rounded-sm p-3 whitespace-pre-wrap break-words">{detailRow.error_message}</pre>
                    </div>
                  )}
                </>
              )}
              <Section label="LINKED AEDs">
                {(detailRow.linked_sentinel_ids || []).length === 0
                  ? <span className="text-slate-600">none</span>
                  : <div className="flex flex-wrap gap-1.5">
                      {(detailRow.linked_sentinel_ids || []).map(sid => (
                        <span key={sid} className="font-orbitron text-[10px] text-cyan-300 px-2 py-0.5 bg-cyan-500/10 border border-cyan-500/20 rounded-sm">{sid}</span>
                      ))}
                    </div>}
              </Section>
              <Section label="DELIVERY EVENTS">
                <div className="flex flex-wrap gap-2 text-[10px] font-orbitron">
                  <Pill ok={!!detailRow.delivered_at} label="DELIVERED" />
                  <Pill ok={(detailRow.open_count || 0) > 0} label={`OPENED ${detailRow.open_count || 0}`} color="emerald" />
                  <Pill ok={(detailRow.click_count || 0) > 0} label={`CLICKED ${detailRow.click_count || 0}`} color="amber" />
                  <Pill ok={detailRow.bounced} label="BOUNCED" color="red" />
                  <Pill ok={detailRow.spam_reported} label="SPAM" color="orange" />
                </div>
              </Section>
            </div>
          </div>
        </div>
      )}

      {/* Send Test Email Modal */}
      {testModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4" onClick={() => !testSending && setTestModalOpen(false)} data-testid="test-email-modal">
          <div className="bg-[#0d1526] border border-emerald-500/40 rounded-md w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-emerald-300" />
                <div className="font-orbitron text-sm text-emerald-300 tracking-widest">SEND TEST EMAIL</div>
              </div>
              <button onClick={() => setTestModalOpen(false)} className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
            </div>

            <div className="text-[11px] text-slate-400 mb-3">
              Sends through the active provider <span className="text-cyan-300 font-bold">{provider?.active?.toUpperCase() || "—"}</span>.
              The send will appear in the activity table below.
            </div>

            <label className="font-orbitron text-[9px] text-slate-500 tracking-wider">RECIPIENT</label>
            <input
              type="email"
              autoFocus
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !testSending) sendTestEmail(); }}
              data-testid="test-email-input"
              placeholder="recipient@example.com"
              className="w-full mt-1 mb-3 bg-[#020617] border border-emerald-500/30 text-emerald-100 rounded px-3 py-2.5 text-sm font-mono"
            />

            {testResult && (
              <div
                className={`mb-3 p-2.5 rounded text-[12px] ${
                  testResult.success
                    ? "border border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                    : "border border-red-500/40 bg-red-500/10 text-red-300"
                }`}
                data-testid="test-email-result"
              >
                {testResult.success ? "✓ " : "✗ "}{testResult.message}
              </div>
            )}

            <div className="flex justify-end gap-2 mt-2">
              <button
                onClick={() => setTestModalOpen(false)}
                disabled={testSending}
                className="font-orbitron text-[10px] px-3 py-2 border border-slate-700 text-slate-400 rounded hover:bg-slate-800 tracking-wider"
              >
                CLOSE
              </button>
              <button
                onClick={sendTestEmail}
                disabled={testSending || !testEmail.trim()}
                data-testid="test-email-send"
                className="font-orbitron text-[10px] px-4 py-2 border border-emerald-500/50 bg-emerald-500/15 text-emerald-200 rounded hover:bg-emerald-500/30 disabled:opacity-50 tracking-wider inline-flex items-center gap-1.5"
              >
                {testSending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                {testSending ? "SENDING…" : "SEND"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ label, children }) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-3 items-baseline">
      <div className="font-orbitron text-[8px] text-slate-500 tracking-wider">{label}</div>
      <div className="text-slate-200">{children}</div>
    </div>
  );
}

function Pill({ ok, label, color = "cyan" }) {
  const colorMap = {
    cyan: ok ? "bg-cyan-500/15 text-cyan-400 border-cyan-500/30" : "bg-slate-800 text-slate-600 border-slate-700",
    emerald: ok ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : "bg-slate-800 text-slate-600 border-slate-700",
    amber: ok ? "bg-amber-500/15 text-amber-400 border-amber-500/30" : "bg-slate-800 text-slate-600 border-slate-700",
    red: ok ? "bg-red-500/15 text-red-400 border-red-500/30 font-bold" : "bg-slate-800 text-slate-600 border-slate-700",
    orange: ok ? "bg-orange-500/15 text-orange-400 border-orange-500/30" : "bg-slate-800 text-slate-600 border-slate-700",
  };
  return <span className={`px-2 py-0.5 rounded-sm border ${colorMap[color]}`}>{label}</span>;
}

function EmailStatusBadges({ row }) {
  if (!row) return null;
  const badges = [];
  if (row.bounced) badges.push({ label: "BOUNCED", cls: "bg-red-500/20 text-red-300 border-red-500/40" });
  if (row.spam_reported) badges.push({ label: "SPAM", cls: "bg-orange-500/20 text-orange-300 border-orange-500/40" });
  if (row.click_count > 0) badges.push({ label: row.click_count > 1 ? `CLICKED ×${row.click_count}` : "CLICKED", cls: "bg-purple-500/20 text-purple-300 border-purple-500/40" });
  if (row.open_count > 0) badges.push({ label: row.open_count > 1 ? `OPENED ×${row.open_count}` : "OPENED", cls: "bg-amber-500/20 text-amber-300 border-amber-500/40" });
  if (row.delivered_at) badges.push({ label: "DELIVERED", cls: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" });
  if (badges.length === 0) {
    if (row.success) {
      return <span className="px-2 py-0.5 rounded-sm border bg-slate-800/80 text-slate-500 border-slate-700 font-orbitron text-[9px] tracking-wider">PENDING</span>;
    }
    return <span className="text-slate-600 font-orbitron text-[9px] tracking-wider">—</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {badges.map(b => (
        <span key={b.label} className={`px-1.5 py-0.5 rounded-sm border font-orbitron text-[9px] tracking-wider ${b.cls}`}>{b.label}</span>
      ))}
    </div>
  );
}
