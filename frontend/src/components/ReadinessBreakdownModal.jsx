import { useState, useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import API_BASE from "@/apiBase";

const API = API_BASE + "/api";

export function ReadinessBreakdownModal({ onClose, onDataLoaded }) {
  const [readiness, setReadiness] = useState(null);
  const [fleetTotals, setFleetTotals] = useState(null);
  const [notifiedSummary, setNotifiedSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      try {
        const [dashRes, notifRes] = await Promise.all([
          fetch(`${API}/support/dashboard-data`, { headers }),
          fetch(`${API}/support/notified-aeds/summary`, { headers }),
        ]);
        if (dashRes.ok) {
          const d = await dashRes.json();
          setReadiness(d.readiness || {});
          setFleetTotals(d.fleet_totals || {});
          if (onDataLoaded && d.readiness) onDataLoaded(d.readiness);
        }
        if (notifRes.ok) setNotifiedSummary(await notifRes.json());
      } catch {}
      setLoading(false);
    })();
  }, []);

  const r = readiness || {};
  const ft = fleetTotals || {};
  const ns = notifiedSummary || {};

  const totalMon = r.total_monitored || 0;
  const totalReady = r.total_ready || 0;
  const totalIssues = r.total_issues || 0;
  const pctActual = r.pct_ready != null ? Number(r.pct_ready).toFixed(1) : "—";
  const notifiedUnresolved = r.notified_aed_unresolved || 0;
  const adjustedIssues = r.adjusted_issues || 0;
  const pctAdjusted = r.pct_ready_adjusted != null ? Number(r.pct_ready_adjusted).toFixed(1) : "—";

  const issueRows = [
    { label: "Expired B/P", count: ft.expired_bp || 0, color: "#ef4444" },
    { label: "Expiring B/P", count: ft.expiring_bp || 0, color: "#f59e0b" },
    { label: "Not Ready", count: ft.not_ready || 0, color: "#f97316" },
    { label: "Reposition", count: ft.reposition || 0, color: "#a855f7" },
    { label: "Not Present", count: ft.not_present || 0, color: "#38bdf8" },
    { label: "Unknown", count: ft.unknown || 0, color: "#64748b" },
  ].filter(r => r.count > 0);

  const notifiedByType = ns.unresolved_by_issue_type || {};
  const notifiedRows = Object.entries(notifiedByType)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a);

  return (
    <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center" onClick={onClose}>
      <div className="bg-[#0a0f1c] border border-cyan-500/30 rounded-sm w-[620px] max-w-[95vw] max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()} data-testid="readiness-breakdown-modal">
        {/* Header */}
        <div className="p-5 border-b border-cyan-500/15 flex justify-between items-center">
          <div className="font-orbitron text-sm text-cyan-400 tracking-wider">SYSTEM READINESS BREAKDOWN</div>
          <button onClick={onClose} className="text-slate-500 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-cyan-400 animate-spin" /></div>
        ) : (
          <div className="p-5 space-y-6">
            {/* ADJUSTED READY (first, more prominent) */}
            <div className="border border-green-500/30 bg-green-500/5 rounded-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="font-orbitron text-[10px] text-green-400 tracking-wider">ADJUSTED SYSTEM READY</div>
                <div className="font-orbitron text-2xl font-black text-green-400" style={{ textShadow: "0 0 12px rgba(34,197,94,0.4)" }}>
                  {pctAdjusted}%
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center py-1.5 border-b border-green-500/10">
                  <span className="text-xs text-slate-300">Total Issues</span>
                  <span className="font-orbitron text-sm text-red-400 font-bold">{totalIssues.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-green-500/10">
                  <span className="text-xs text-amber-400">Subscriber Notified (pending resolution)</span>
                  <span className="font-orbitron text-sm text-amber-400 font-bold">−{notifiedUnresolved.toLocaleString()}</span>
                </div>

                {/* Notified breakdown */}
                {notifiedRows.length > 0 && (
                  <div className="pl-4 space-y-1 pt-1">
                    {notifiedRows.map(([type, count]) => (
                      <div key={type} className="flex justify-between items-center py-0.5">
                        <span className="text-[11px] text-amber-400/70">{type}</span>
                        <span className="text-[11px] text-amber-400/70">{count.toLocaleString()}</span>
                      </div>
                    ))}
                    {ns.unresolved_by_subscriber && ns.unresolved_by_subscriber.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-amber-500/10">
                        <div className="text-[9px] text-slate-500 font-orbitron tracking-wider mb-1">BY SUBSCRIBER</div>
                        {ns.unresolved_by_subscriber.slice(0, 5).map(s => (
                          <div key={s.subscriber} className="flex justify-between items-center py-0.5">
                            <span className="text-[11px] text-slate-400 truncate max-w-[300px]">{s.subscriber}</span>
                            <span className="text-[11px] text-amber-400 font-bold">{s.count}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-between items-center py-1.5 border-b border-green-500/10">
                  <span className="text-xs text-green-400 font-bold">Adjusted Issues</span>
                  <span className="font-orbitron text-sm text-green-400 font-bold">{adjustedIssues.toLocaleString()}</span>
                </div>

                {/* Calculation */}
                <div className="mt-3 pt-3 border-t border-green-500/20">
                  <div className="text-[10px] text-slate-500 font-mono space-y-1">
                    <div>Issues: {totalIssues.toLocaleString()} − {notifiedUnresolved.toLocaleString()} notified = <span className="text-green-400 font-bold">{adjustedIssues.toLocaleString()}</span> adjusted issues</div>
                    <div>Ready: {totalMon.toLocaleString()} − {adjustedIssues.toLocaleString()} = <span className="text-green-400 font-bold">{(totalMon - adjustedIssues).toLocaleString()}</span> adjusted ready</div>
                    <div>{(totalMon - adjustedIssues).toLocaleString()} ÷ {totalMon.toLocaleString()} = <span className="text-green-400 font-bold">{pctAdjusted}%</span></div>
                  </div>
                </div>
              </div>
            </div>

            {/* ACTUAL READY (second, subdued) */}
            <div className="border border-slate-700/50 bg-slate-900/30 rounded-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="font-orbitron text-[10px] text-slate-400 tracking-wider">ACTUAL SYSTEM READY</div>
                <div className="font-orbitron text-2xl font-black" style={{ color: parseFloat(pctActual) >= 90 ? "#22c55e" : parseFloat(pctActual) >= 70 ? "#f59e0b" : "#ef4444" }}>
                  {pctActual}%
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center py-1.5 border-b border-slate-800">
                  <span className="text-xs text-slate-300">Total AEDs Monitored</span>
                  <span className="font-orbitron text-sm text-white font-bold">{totalMon.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-800">
                  <span className="text-xs text-green-400">AEDs Ready</span>
                  <span className="font-orbitron text-sm text-green-400 font-bold">{totalReady.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-800">
                  <span className="text-xs text-red-400">AEDs With Issues</span>
                  <span className="font-orbitron text-sm text-red-400 font-bold">{totalIssues.toLocaleString()}</span>
                </div>

                {/* Issue breakdown */}
                <div className="pl-4 space-y-1 pt-1">
                  {issueRows.map(row => (
                    <div key={row.label} className="flex justify-between items-center py-0.5">
                      <span className="text-[11px]" style={{ color: row.color }}>{row.label}</span>
                      <span className="text-[11px] font-bold" style={{ color: row.color }}>{row.count.toLocaleString()}</span>
                    </div>
                  ))}
                </div>

                {/* Calculation */}
                <div className="mt-3 pt-3 border-t border-slate-700/50">
                  <div className="text-[10px] text-slate-500 font-mono">
                    {totalReady.toLocaleString()} ready ÷ {totalMon.toLocaleString()} total = <span className="text-white font-bold">{pctActual}%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Explanation */}
            <div className="text-[10px] text-slate-500 leading-relaxed">
              The <span className="text-green-400 font-bold">Adjusted Ready</span> percentage excludes AEDs where the subscriber has been notified about issues but has not yet resolved them. These are issues outside our direct control — the subscriber is responsible for correcting them. The adjustment reflects our true operational readiness.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
