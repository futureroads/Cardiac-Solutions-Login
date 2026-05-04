import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Mic, Download, RefreshCw, Search } from "lucide-react";
import API_BASE from "../apiBase";
const API = API_BASE + "/api";

const PRETTY_ROUTE = {
  "/hub": "Command Center Hub",
  "/dashboard": "Dashboard",
  "/stark": "Stark Dashboard",
  "/stark-dashboard": "Stark Dashboard",
  "/support": "Support Dashboard",
  "/support-dashboard": "Support Dashboard",
  "/user-access": "User Access",
  "/admin/email-errors": "Email Activity",
  "/admin/user-activity": "User Activity",
  "/customer": "Customer Portal",
  "/service-tickets": "Service Tickets",
  "/map": "Map",
};

const prettyRoute = (r) => PRETTY_ROUTE[r] || r || "—";

const fmtDuration = (s) => {
  if (s == null || isNaN(s)) return "—";
  s = Math.max(0, Math.round(s));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${ss}s`;
  return `${ss}s`;
};

const fmtTime = (iso) => {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch { return iso; }
};

const fmtAgo = (iso) => {
  if (!iso) return "—";
  try {
    const sec = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    return `${fmtDuration(sec)} ago`;
  } catch { return "—"; }
};

export default function UserActivity() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const [online, setOnline] = useState([]);
  const [history, setHistory] = useState([]);
  const [days, setDays] = useState(7);
  const [userFilter, setUserFilter] = useState("");
  const [q, setQ] = useState("");
  const [loadingOnline, setLoadingOnline] = useState(false);
  const [loadingHist, setLoadingHist] = useState(false);
  const [error, setError] = useState("");

  const fetchOnline = async () => {
    setLoadingOnline(true);
    try {
      const r = await fetch(`${API}/admin/activity/online`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error(`online ${r.status}`);
      const d = await r.json();
      setOnline(d.sessions || []);
      setError("");
    } catch (e) { setError(e.message); }
    finally { setLoadingOnline(false); }
  };

  const fetchHistory = async () => {
    setLoadingHist(true);
    try {
      const params = new URLSearchParams({ days: String(days) });
      if (userFilter) params.set("user", userFilter);
      const r = await fetch(`${API}/admin/activity/history?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error(`history ${r.status}`);
      const d = await r.json();
      setHistory(d.sessions || []);
      setError("");
    } catch (e) { setError(e.message); }
    finally { setLoadingHist(false); }
  };

  useEffect(() => { fetchOnline(); fetchHistory(); }, []); // eslint-disable-line
  useEffect(() => { const id = setInterval(fetchOnline, 5000); return () => clearInterval(id); }, []); // eslint-disable-line

  useEffect(() => { fetchHistory(); }, [days]); // eslint-disable-line

  const filteredHistory = useMemo(() => {
    if (!q) return history;
    const ql = q.toLowerCase();
    return history.filter(s =>
      (s.username || "").toLowerCase().includes(ql) ||
      (s.name || "").toLowerCase().includes(ql) ||
      (s.ip || "").toLowerCase().includes(ql) ||
      (s.routes || []).some(r => prettyRoute(r.route).toLowerCase().includes(ql))
    );
  }, [q, history]);

  const downloadCsv = () => {
    const params = new URLSearchParams({ days: String(days) });
    if (userFilter) params.set("user", userFilter);
    const url = `${API}/admin/activity/export.csv?${params}&token=${encodeURIComponent(token)}`;
    window.location.href = url;
  };

  return (
    <div className="min-h-screen bg-[#040A14] text-cyan-100 p-6 font-sans">
      <div className="max-w-[1400px] mx-auto">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => navigate("/hub")} data-testid="user-activity-back-btn" className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 text-sm">
            <ArrowLeft className="w-4 h-4" /> Back to Hub
          </button>
          <h1 className="font-orbitron text-2xl font-bold tracking-widest text-cyan-300">USER ACTIVITY</h1>
          <button onClick={() => { fetchOnline(); fetchHistory(); }} data-testid="user-activity-refresh-btn" className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 text-sm">
            <RefreshCw className={`w-4 h-4 ${loadingOnline || loadingHist ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>

        {error && <div className="mb-4 p-3 border border-red-500/40 bg-red-500/10 text-red-300 text-sm rounded">{error}</div>}

        {/* Currently Online */}
        <div className="mb-8 p-5 rounded-lg border border-cyan-500/20 bg-[rgba(0,18,32,0.93)]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-orbitron text-sm font-bold tracking-widest text-cyan-300">CURRENTLY ONLINE</h2>
            <div className="text-xs text-cyan-500/70 font-mono">{online.length} {online.length === 1 ? "user" : "users"}</div>
          </div>
          {online.length === 0 ? (
            <div className="text-center text-slate-400 py-6 text-sm">No users currently active</div>
          ) : (
            <table className="w-full text-sm" data-testid="online-users-table">
              <thead>
                <tr className="border-b border-cyan-500/20 text-cyan-400 text-[11px] uppercase tracking-wider">
                  <th className="text-left py-2">User</th>
                  <th className="text-left py-2">IP</th>
                  <th className="text-left py-2">Current Page</th>
                  <th className="text-left py-2">Voice</th>
                  <th className="text-left py-2">Last Active</th>
                  <th className="text-left py-2">Session Started</th>
                  <th className="text-right py-2">Duration</th>
                </tr>
              </thead>
              <tbody>
                {online.map((s) => (
                  <tr key={s.session_id} className="border-b border-cyan-500/10 hover:bg-cyan-500/5">
                    <td className="py-2.5 font-mono">
                      <div className="text-cyan-200">{s.username}</div>
                      {s.name && <div className="text-[11px] text-slate-400">{s.name}</div>}
                    </td>
                    <td className="py-2.5 font-mono text-xs text-slate-300">{s.ip || "—"}</td>
                    <td className="py-2.5 text-cyan-100">{prettyRoute(s.current_route)}</td>
                    <td className="py-2.5">
                      {s.voice_active ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-500/20 text-green-300 border border-green-500/40">
                          <Mic className="w-3 h-3" /> ACTIVE
                        </span>
                      ) : <span className="text-slate-500 text-xs">—</span>}
                    </td>
                    <td className="py-2.5 text-xs text-slate-300">{fmtAgo(s.last_heartbeat)}</td>
                    <td className="py-2.5 text-xs text-slate-300">{fmtTime(s.started_at)}</td>
                    <td className="py-2.5 text-right font-mono text-cyan-200">{fmtDuration(s.duration_s)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* History */}
        <div className="p-5 rounded-lg border border-cyan-500/20 bg-[rgba(0,18,32,0.93)]">
          <div className="flex items-center flex-wrap justify-between gap-3 mb-4">
            <h2 className="font-orbitron text-sm font-bold tracking-widest text-cyan-300">SESSION HISTORY</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <select value={days} onChange={(e) => setDays(Number(e.target.value))} data-testid="history-days-select" className="bg-[#020617] border border-cyan-500/30 text-cyan-200 text-xs rounded px-2 py-1.5">
                <option value="1">Last 24 hours</option>
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
              </select>
              <input type="text" value={userFilter} onChange={(e) => setUserFilter(e.target.value)} onKeyDown={(e) => e.key === "Enter" && fetchHistory()} placeholder="Filter user…" data-testid="history-user-filter" className="bg-[#020617] border border-cyan-500/30 text-cyan-200 text-xs rounded px-2 py-1.5 w-32" />
              <button onClick={fetchHistory} data-testid="history-apply-btn" className="text-cyan-400 hover:text-cyan-300 text-xs px-2">Apply</button>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" data-testid="history-search" className="bg-[#020617] border border-cyan-500/30 text-cyan-200 text-xs rounded pl-7 pr-2 py-1.5 w-44" />
              </div>
              <button onClick={downloadCsv} data-testid="history-csv-btn" className="flex items-center gap-1 text-green-400 hover:text-green-300 text-xs border border-green-500/30 rounded px-2 py-1.5 bg-green-500/10">
                <Download className="w-3 h-3" /> CSV
              </button>
            </div>
          </div>

          {filteredHistory.length === 0 ? (
            <div className="text-center text-slate-400 py-8 text-sm">No session history in this range</div>
          ) : (
            <table className="w-full text-sm" data-testid="history-table">
              <thead>
                <tr className="border-b border-cyan-500/20 text-cyan-400 text-[11px] uppercase tracking-wider">
                  <th className="text-left py-2">User</th>
                  <th className="text-left py-2">IP</th>
                  <th className="text-left py-2">Login</th>
                  <th className="text-left py-2">Logout</th>
                  <th className="text-right py-2">Duration</th>
                  <th className="text-left py-2">Pages Visited</th>
                  <th className="text-right py-2">Voice</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map((s) => (
                  <tr key={s.session_id} className="border-b border-cyan-500/10 hover:bg-cyan-500/5 align-top">
                    <td className="py-2.5 font-mono">
                      <div className="text-cyan-200">{s.username}</div>
                      {s.name && <div className="text-[11px] text-slate-400">{s.name}</div>}
                    </td>
                    <td className="py-2.5 font-mono text-xs text-slate-300">{s.ip || "—"}</td>
                    <td className="py-2.5 text-xs text-slate-300">{fmtTime(s.started_at)}</td>
                    <td className="py-2.5 text-xs text-slate-300">{s.ended_at ? fmtTime(s.ended_at) : <span className="text-green-400">active</span>}</td>
                    <td className="py-2.5 text-right font-mono text-cyan-200">{fmtDuration(s.duration_s)}</td>
                    <td className="py-2.5 text-xs">
                      {(s.routes || []).length === 0 ? <span className="text-slate-500">—</span> : (
                        <div className="space-y-0.5">
                          {(s.routes || []).map((r, i) => (
                            <div key={i} className="flex items-center gap-2 text-slate-300">
                              <span className="w-32 truncate">{prettyRoute(r.route)}</span>
                              <span className="text-slate-500 font-mono">{fmtDuration(r.duration_s)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 text-right text-xs">
                      {s.voice_sessions_count ? (
                        <div>
                          <div className="text-cyan-200 font-mono">{s.voice_sessions_count} sess</div>
                          <div className="text-slate-400 text-[11px]">{fmtDuration(s.total_voice_seconds)}</div>
                        </div>
                      ) : <span className="text-slate-500">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
