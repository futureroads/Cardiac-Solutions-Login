import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Download, Loader2, Search, FileSpreadsheet, RefreshCw } from "lucide-react";
import API_BASE from "@/apiBase";

const API = `${API_BASE}/api`;

const STATUS_STYLE = {
  READY: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  "EXPIRED B/P": "bg-red-500/15 text-red-300 border-red-500/30",
  "EXPIRING BATT/PADS": "bg-amber-500/15 text-amber-300 border-amber-500/30",
  "NOT READY": "bg-orange-500/15 text-orange-300 border-orange-500/30",
  "REPOSITION": "bg-purple-500/15 text-purple-300 border-purple-500/30",
  "NOT PRESENT": "bg-pink-500/15 text-pink-300 border-pink-500/30",
  "LOST CONTACT": "bg-rose-500/15 text-rose-300 border-rose-500/30",
  "BATTERY LOW": "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
};

function StatusBadge({ status }) {
  const key = (status || "").toUpperCase();
  const cls = STATUS_STYLE[key] || "bg-slate-700/40 text-slate-400 border-slate-600/40";
  return (
    <span className={`px-2 py-0.5 rounded-sm border font-orbitron text-[9px] tracking-wider whitespace-nowrap ${cls}`}>
      {key || "—"}
    </span>
  );
}

export default function Reports() {
  const navigate = useNavigate();
  const [models, setModels] = useState([]);
  const [model, setModel] = useState("");
  const [rows, setRows] = useState(null);
  const [loadingModels, setLoadingModels] = useState(true);
  const [loadingRows, setLoadingRows] = useState(false);
  const [err, setErr] = useState("");
  const [search, setSearch] = useState("");
  const [generatedAt, setGeneratedAt] = useState(null);

  const token = localStorage.getItem("token") || "";

  const loadModels = async () => {
    setLoadingModels(true);
    setErr("");
    try {
      const r = await fetch(`${API}/admin/reports/by-model/models`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.detail || `HTTP ${r.status}`);
      }
      const d = await r.json();
      setModels(d.models || []);
    } catch (e) {
      setErr(e.message || "Failed to load models");
    } finally {
      setLoadingModels(false);
    }
  };

  const loadRows = async (m) => {
    if (!m) {
      setRows(null);
      return;
    }
    setLoadingRows(true);
    setErr("");
    try {
      const r = await fetch(`${API}/admin/reports/by-model?model=${encodeURIComponent(m)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.detail || `HTTP ${r.status}`);
      }
      const d = await r.json();
      setRows(d.rows || []);
      setGeneratedAt(d.generated_at || null);
    } catch (e) {
      setErr(e.message || "Failed to load report");
      setRows([]);
    } finally {
      setLoadingRows(false);
    }
  };

  useEffect(() => {
    loadModels();
  }, []);

  useEffect(() => {
    if (model) loadRows(model);
  }, [model]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      return (
        (r.subscriber || "").toLowerCase().includes(q) ||
        (r.sentinel_id || "").toLowerCase().includes(q) ||
        (r.site || "").toLowerCase().includes(q) ||
        (r.building || "").toLowerCase().includes(q) ||
        (r.placement || "").toLowerCase().includes(q) ||
        (r.detailed_status || "").toLowerCase().includes(q)
      );
    });
  }, [rows, search]);

  const handleDownload = () => {
    if (!model) return;
    const url = `${API}/admin/reports/by-model.xlsx?model=${encodeURIComponent(model)}&token=${encodeURIComponent(token)}`;
    window.location.href = url;
  };

  const subscriberCount = useMemo(() => {
    if (!filtered.length) return 0;
    return new Set(filtered.map((r) => r.subscriber || "").filter(Boolean)).size;
  }, [filtered]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      {/* Top bar */}
      <div className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate("/hub")}
            data-testid="reports-back-btn"
            className="p-2 -ml-2 rounded text-slate-400 hover:text-cyan-300 hover:bg-cyan-500/5"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1">
            <div className="font-orbitron text-sm tracking-wider text-cyan-400">REPORTS</div>
            <div className="text-[9px] text-slate-500 font-orbitron tracking-wider">ADMIN — AED FLEET REPORTING</div>
          </div>
          <button
            onClick={loadModels}
            disabled={loadingModels}
            data-testid="reports-refresh-btn"
            className="font-orbitron text-[10px] px-3 py-1.5 rounded-sm border border-slate-700 text-slate-300 hover:text-cyan-300 hover:border-cyan-500/40 disabled:opacity-50"
            title="Refresh model list"
          >
            <RefreshCw className={`w-3 h-3 inline mr-1 ${loadingModels ? "animate-spin" : ""}`} />
            RELOAD
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Report list (single card for now) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div
            data-testid="report-card-by-model"
            className="border border-cyan-500/40 bg-cyan-500/5 rounded-md p-4"
          >
            <div className="flex items-center gap-2 mb-1">
              <FileSpreadsheet className="w-4 h-4 text-cyan-300" />
              <div className="font-orbitron text-[11px] tracking-wider text-cyan-300">BY MODEL</div>
              <span className="ml-auto font-orbitron text-[8px] tracking-widest text-emerald-400 border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 rounded-sm">
                ACTIVE
              </span>
            </div>
            <div className="text-[11px] text-slate-400 leading-relaxed">
              Pick an AED model and see every device, its subscriber, current status, and battery / pads expiration. Export to Excel.
            </div>
          </div>
        </div>

        {/* By Model controls */}
        <div className="border border-slate-800 rounded-md bg-slate-900/40 p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[260px]">
              <label className="block font-orbitron text-[9px] tracking-widest text-slate-500 mb-1">
                AED MODEL
              </label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                disabled={loadingModels}
                data-testid="report-model-select"
                className="w-full bg-slate-950 border border-slate-700 text-cyan-200 text-sm font-orbitron px-3 py-2 rounded-sm focus:outline-none focus:border-cyan-500/60"
              >
                <option value="">— Select a model —</option>
                {models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <div className="mt-1 text-[9px] text-slate-600 font-orbitron tracking-wider">
                {loadingModels ? "LOADING MODELS…" : `${models.length} MODEL${models.length === 1 ? "" : "S"} ACROSS LIVE FLEET`}
              </div>
            </div>

            <div className="flex-1 min-w-[200px]">
              <label className="block font-orbitron text-[9px] tracking-widest text-slate-500 mb-1">
                FILTER RESULTS
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Subscriber, sentinel ID, site…"
                  data-testid="report-search-input"
                  disabled={!rows}
                  className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs pl-8 pr-3 py-2 rounded-sm focus:outline-none focus:border-cyan-500/60 disabled:opacity-50"
                />
              </div>
            </div>

            <button
              onClick={handleDownload}
              disabled={!model || !rows || rows.length === 0}
              data-testid="report-download-xlsx-btn"
              className="font-orbitron text-[10px] tracking-widest px-4 py-2 rounded-sm border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-400 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Download className="w-3 h-3 inline mr-1.5" />
              EXPORT XLSX
            </button>
          </div>

          {err && (
            <div data-testid="report-error" className="mt-3 text-[11px] text-red-400 font-orbitron">
              {err}
            </div>
          )}
        </div>

        {/* Results */}
        {model && (
          <div className="border border-slate-800 rounded-md bg-slate-900/30">
            <div className="px-4 py-3 border-b border-slate-800 flex flex-wrap items-center gap-3">
              <div className="font-orbitron text-[10px] tracking-widest text-slate-400">
                <span className="text-cyan-300">{filtered.length}</span> DEVICE{filtered.length === 1 ? "" : "S"}
                {rows && filtered.length !== rows.length && (
                  <span className="text-slate-600"> (of {rows.length})</span>
                )}
                {" · "}
                <span className="text-cyan-300">{subscriberCount}</span> SUBSCRIBER{subscriberCount === 1 ? "" : "S"}
              </div>
              {generatedAt && (
                <div className="ml-auto text-[9px] text-slate-600 font-orbitron tracking-wider">
                  GENERATED {new Date(generatedAt).toLocaleString()}
                </div>
              )}
            </div>

            {loadingRows ? (
              <div className="p-12 flex items-center justify-center text-slate-500">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                <span className="font-orbitron text-[11px] tracking-wider">LOADING REPORT…</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center text-slate-500 font-orbitron text-[11px] tracking-wider">
                NO DEVICES MATCH
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs" data-testid="report-results-table">
                  <thead className="bg-slate-900/60 border-b border-slate-800">
                    <tr className="font-orbitron text-[9px] tracking-widest text-slate-500">
                      <th className="text-left px-4 py-2.5">SUBSCRIBER</th>
                      <th className="text-left px-4 py-2.5">SENTINEL ID</th>
                      <th className="text-left px-4 py-2.5">LOCATION</th>
                      <th className="text-left px-4 py-2.5">STATUS</th>
                      <th className="text-left px-4 py-2.5">BATTERY EXP</th>
                      <th className="text-left px-4 py-2.5">PADS EXP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r, i) => (
                      <tr
                        key={`${r.sentinel_id}-${i}`}
                        className="border-b border-slate-800/60 hover:bg-cyan-500/5"
                      >
                        <td className="px-4 py-2 text-slate-200">{r.subscriber || "—"}</td>
                        <td className="px-4 py-2 text-cyan-300 font-mono text-[11px]">{r.sentinel_id || "—"}</td>
                        <td className="px-4 py-2 text-slate-400 max-w-[360px]">
                          {[r.site, r.building, r.placement].filter(Boolean).join(" / ") || "—"}
                        </td>
                        <td className="px-4 py-2"><StatusBadge status={r.detailed_status} /></td>
                        <td className="px-4 py-2 text-slate-300 font-mono text-[11px]">
                          {r.battery_expiration || "—"}
                        </td>
                        <td className="px-4 py-2 text-slate-300 font-mono text-[11px]">
                          {r.pad_expiration || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {!model && !err && (
          <div className="text-center py-16 text-slate-600 font-orbitron text-[11px] tracking-wider">
            SELECT A MODEL ABOVE TO RUN A REPORT
          </div>
        )}
      </div>
    </div>
  );
}
