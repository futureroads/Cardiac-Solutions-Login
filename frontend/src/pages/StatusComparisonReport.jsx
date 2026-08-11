import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, FileSpreadsheet, Search, GitCompareArrows, Check, X as XIcon } from "lucide-react";
import API_BASE from "@/apiBase";

const API = `${API_BASE}/api`;

export default function StatusComparisonReport() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token") || "";
  const [subscribers, setSubscribers] = useState([]);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [err, setErr] = useState("");
  const [filterMode, setFilterMode] = useState("all"); // "all" | "mismatch" | "match"
  const [downloading, setDownloading] = useState(false);
  const [subsLoading, setSubsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API}/reports/status-comparison/subscribers`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (r.ok) {
          const d = await r.json();
          setSubscribers(d.subscribers || []);
        }
      } catch {} // eslint-disable-line
      setSubsLoading(false);
    })();
  }, [token]);

  const generate = async () => {
    if (!selected) { setErr("Pick a subscriber first"); return; }
    setLoading(true); setErr(""); setReport(null);
    try {
      const r = await fetch(`${API}/reports/status-comparison?subscriber=${encodeURIComponent(selected)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error(await r.text());
      setReport(await r.json());
    } catch (e) {
      setErr(e.message || "Report failed");
    } finally {
      setLoading(false);
    }
  };

  const downloadXlsx = async () => {
    if (!selected) return;
    setDownloading(true);
    try {
      const r = await fetch(`${API}/reports/status-comparison.xlsx?subscriber=${encodeURIComponent(selected)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error(await r.text());
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `status-comparison-${selected.replace(/ /g, "_")}-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErr(e.message || "Download failed");
    } finally {
      setDownloading(false);
    }
  };

  const rows = useMemo(() => {
    const all = report?.rows || [];
    if (filterMode === "mismatch") return all.filter(r => !r.match && r.assigned_status && r.readiness_status);
    if (filterMode === "match") return all.filter(r => r.match);
    return all;
  }, [report, filterMode]);

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200">
      <div className="sticky top-0 z-30 bg-[rgba(2,6,23,0.95)] border-b border-cyan-500/20 backdrop-blur">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/hub")} className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5" data-testid="back-to-hub">
              <ArrowLeft className="w-4 h-4" />
              <span className="font-orbitron text-[11px] tracking-widest">HUB</span>
            </button>
            <div>
              <div className="font-orbitron text-cyan-400 text-sm tracking-widest">STATUS COMPARISON REPORT</div>
              <div className="text-[10px] text-slate-500 tracking-wider">READINESS vs. AI ASSIGNED STATUS — PER SUBSCRIBER</div>
            </div>
          </div>
          {report && (
            <div className="flex items-center gap-3 text-[10px] font-orbitron tracking-wider">
              <span className="text-slate-500">TOTAL:</span><span className="text-cyan-300">{report.summary.total}</span>
              <span className="text-slate-600">·</span>
              <span className="text-slate-500">MATCH:</span><span className="text-emerald-300">{report.summary.matches}</span>
              <span className="text-slate-600">·</span>
              <span className="text-slate-500">MISMATCH:</span><span className="text-red-300">{report.summary.mismatches}</span>
              {report.summary.missing_ai > 0 && (
                <><span className="text-slate-600">·</span><span className="text-slate-500">NO AI:</span><span className="text-amber-300">{report.summary.missing_ai}</span></>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-6 py-4 space-y-4">
        <div className="border border-cyan-500/30 bg-[#0a0f1c] rounded-sm p-5">
          <div className="flex items-center gap-3 flex-wrap">
            <GitCompareArrows className="w-4 h-4 text-cyan-400" />
            <div className="font-orbitron text-cyan-400 text-xs tracking-widest">SUBSCRIBER</div>
            <select
              value={selected}
              onChange={e => setSelected(e.target.value)}
              disabled={subsLoading || loading}
              className="bg-slate-900/60 border border-slate-700 rounded-sm px-2 py-1.5 text-[12px] font-mono text-slate-200 min-w-[260px]"
              data-testid="subscriber-select"
            >
              <option value="">{subsLoading ? "Loading…" : "-- pick a subscriber --"}</option>
              {subscribers.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button
              onClick={generate}
              disabled={!selected || loading}
              className="text-[10px] font-orbitron tracking-widest px-3 py-1.5 border border-cyan-500/50 text-cyan-300 hover:bg-cyan-500/10 rounded-sm flex items-center gap-1 disabled:opacity-30"
              data-testid="generate-report-btn"
            >
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />} GENERATE REPORT
            </button>
            {report && (
              <button
                onClick={downloadXlsx}
                disabled={downloading}
                className="text-[10px] font-orbitron tracking-widest px-3 py-1.5 border border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/10 rounded-sm flex items-center gap-1 disabled:opacity-30"
                data-testid="download-xlsx-btn"
              >
                {downloading ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileSpreadsheet className="w-3 h-3" />} DOWNLOAD XLSX
              </button>
            )}
          </div>
          {report && (
            <div className="mt-3 flex items-center gap-2 text-[10px] font-orbitron tracking-widest">
              <span className="text-slate-500">FILTER:</span>
              {["all", "mismatch", "match"].map(m => (
                <button
                  key={m}
                  onClick={() => setFilterMode(m)}
                  className={`px-2 py-0.5 rounded-sm border ${filterMode === m ? "bg-cyan-500/20 border-cyan-500/60 text-cyan-200" : "border-slate-700 text-slate-400 hover:text-cyan-300"}`}
                  data-testid={`filter-${m}`}
                >
                  {m.toUpperCase()}
                </button>
              ))}
            </div>
          )}
          {err && (
            <div className="mt-3 px-3 py-2 rounded-sm border border-red-500/40 bg-red-500/10 text-red-300 text-[11px] font-mono flex items-start justify-between gap-3">
              <div className="break-words">{err}</div>
              <button onClick={() => setErr("")} className="text-red-400 hover:text-red-200 shrink-0">×</button>
            </div>
          )}
        </div>

        {loading && (
          <div className="border border-slate-800 rounded-sm p-8 text-center text-[11px] font-orbitron tracking-widest text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin inline-block mr-2" /> FETCHING FLEET + AI STATUS…
          </div>
        )}

        {report && !loading && (
          <div className="border border-cyan-500/30 bg-[#0a0f1c] rounded-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/40 text-left">
                    <th className="py-2 px-2 font-orbitron text-[9px] text-slate-400 tracking-widest">MODEL</th>
                    <th className="py-2 px-2 font-orbitron text-[9px] text-slate-400 tracking-widest">AED SERIAL</th>
                    <th className="py-2 px-2 font-orbitron text-[9px] text-slate-400 tracking-widest">SENTINEL ID</th>
                    <th className="py-2 px-2 font-orbitron text-[9px] text-slate-400 tracking-widest">ORIGINAL READINESS</th>
                    <th className="py-2 px-2 font-orbitron text-[9px] text-slate-400 tracking-widest">ASSIGNED STATUS</th>
                    <th className="py-2 px-2 font-orbitron text-[9px] text-slate-400 tracking-widest">MATCH</th>
                    <th className="py-2 px-2 font-orbitron text-[9px] text-slate-400 tracking-widest">LOCATION</th>
                    <th className="py-2 px-2 font-orbitron text-[9px] text-slate-400 tracking-widest">IMAGE</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.sentinel_id} className={`border-b border-slate-900 ${r.match ? "" : (r.assigned_status && r.readiness_status ? "bg-red-500/5" : "")}`} data-testid={`row-${r.sentinel_id}`}>
                      <td className="py-2 px-2 font-mono text-slate-300">{r.model}</td>
                      <td className="py-2 px-2 font-mono text-slate-400">{r.aed_serial}</td>
                      <td className="py-2 px-2 font-mono text-cyan-300 font-bold">{r.sentinel_id}</td>
                      <td className="py-2 px-2 font-orbitron text-[10px] text-slate-200">{r.readiness_status || "—"}</td>
                      <td className="py-2 px-2 font-orbitron text-[10px] text-slate-200">{r.assigned_status || <span className="text-slate-600">—</span>}</td>
                      <td className="py-2 px-2">
                        {r.match ? (
                          <span className="inline-flex items-center gap-1 text-[9px] font-orbitron tracking-widest text-emerald-300 bg-emerald-500/10 border border-emerald-500/40 px-1.5 py-0.5 rounded-sm">
                            <Check className="w-3 h-3" /> MATCH
                          </span>
                        ) : r.assigned_status && r.readiness_status ? (
                          <span className="inline-flex items-center gap-1 text-[9px] font-orbitron tracking-widest text-red-300 bg-red-500/10 border border-red-500/40 px-1.5 py-0.5 rounded-sm">
                            <XIcon className="w-3 h-3" /> MISMATCH
                          </span>
                        ) : (
                          <span className="text-[9px] font-orbitron tracking-widest text-slate-500">—</span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-[10px] text-slate-400">{r.location || "—"}</td>
                      <td className="py-2 px-2">
                        {r.image_url ? (
                          <img
                            src={r.image_url}
                            alt="AED"
                            className="w-16 h-16 object-cover rounded-sm border border-slate-700"
                            onError={e => { e.currentTarget.style.display = "none"; }}
                          />
                        ) : (
                          <span className="text-slate-600 text-[10px]">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr><td colSpan={8} className="py-6 text-center text-slate-500 text-[11px]">No AEDs match the current filter.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
