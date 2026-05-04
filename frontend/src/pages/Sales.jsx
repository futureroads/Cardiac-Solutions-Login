import React, { useEffect, useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Upload, MapPin, Trash2, Check, Calendar, User, Printer, ClipboardList, Crosshair } from "lucide-react";
import { useJsApiLoader } from "@react-google-maps/api";
import API_BASE from "../apiBase";

const API = API_BASE + "/api";
const MAP_KEY = process.env.REACT_APP_GOOGLE_MAPS_KEY;

const fmtDate = (iso) => {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
};

// Detect whether a stops[] array is per-stop schema (has office_address / stop_num / state / zip)
const isPerStopSchema = (stops) => {
  if (!stops || stops.length === 0) return false;
  return stops.some(s => s.office_address || s.state || s.zip || (s.stop_num && s.stop_num !== s.idx + 1));
};

const escapeHtml = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Build a printable HTML doc and open it in a new window with auto-print.
const openCallSheet = ({ route, stops, perStop, phaseFilter }) => {
  const geocoded = stops.filter(s => s.start_lat && s.start_lng);
  // Static Map URL — keep within Google's 8192-char URL cap. Cap to 50 markers.
  let staticMapUrl = "";
  if (MAP_KEY && geocoded.length > 0) {
    const capped = geocoded.slice(0, 50);
    const markerParts = capped.map((s, i) => {
      const lbl = perStop ? String(s.stop_num || i + 1) : String(i + 1);
      // Static map labels must be 1 alphanumeric char; fall back to no label if multi-digit.
      const safeLbl = /^[0-9A-Z]$/i.test(lbl) ? lbl : "";
      return `markers=color:0x06b6d4${safeLbl ? `%7Clabel:${safeLbl}` : ""}%7C${s.start_lat},${s.start_lng}`;
    });
    const path = `path=color:0x06b6d4ff%7Cweight:3%7C${capped.map(s => `${s.start_lat},${s.start_lng}`).join("%7C")}`;
    staticMapUrl = `https://maps.googleapis.com/maps/api/staticmap?size=800x400&maptype=roadmap&${markerParts.join("&")}&${path}&key=${MAP_KEY}`;
  }
  const today = new Date().toLocaleDateString();
  const phaseLabel = phaseFilter === "ALL" ? "All stops" : `${perStop ? "Phase" : "Day"} ${phaseFilter}`;
  const rowsHtml = stops.map((s, i) => {
    const stopNo = perStop ? (s.stop_num || i + 1) : (i + 1);
    if (perStop) {
      const fullAddr = [s.office_address, s.starting_city, s.state, s.zip].filter(Boolean).join(", ");
      return `<tr>
        <td class="num">${escapeHtml(stopNo)}</td>
        <td>${escapeHtml(s.phase || "—")}</td>
        <td>${escapeHtml(s.counties || "—")}</td>
        <td><div class="addr">${escapeHtml(fullAddr || "—")}</div></td>
        <td class="check"></td>
        <td class="notes"></td>
      </tr>`;
    } else {
      return `<tr>
        <td class="num">${escapeHtml(stopNo)}</td>
        <td>${escapeHtml(s.day || "—")}${s.week ? ` <span class="muted">W${escapeHtml(s.week)}</span>` : ""}</td>
        <td>${escapeHtml(s.region || "—")}</td>
        <td><div class="addr">${escapeHtml(s.counties || "—")}<br/><span class="muted">${escapeHtml(s.starting_city || "")}${s.ending_city ? ` → ${escapeHtml(s.ending_city)}` : ""}</span></div></td>
        <td class="check"></td>
        <td class="notes"></td>
      </tr>`;
    }
  }).join("");
  const headerCols = perStop
    ? `<th>Stop #</th><th>Phase</th><th>County</th><th>Office Address</th><th class="check">Visited</th><th class="notes">Notes</th>`
    : `<th>#</th><th>Day</th><th>Region</th><th>Counties / Cities</th><th class="check">Visited</th><th class="notes">Notes</th>`;
  const html = `<!doctype html>
<html><head><meta charset="utf-8"/>
<title>Call Sheet — ${escapeHtml(route.name)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0a1628; margin: 0; padding: 24px; background: #fff; }
  h1 { font-size: 20px; margin: 0 0 4px; letter-spacing: 1px; }
  .meta { font-size: 11px; color: #475569; margin-bottom: 12px; }
  .meta b { color: #0a1628; }
  .map { width: 100%; max-width: 800px; height: auto; border: 1px solid #cbd5e1; border-radius: 6px; margin: 0 0 14px; display: block; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  thead th { text-align: left; background: #0a1628; color: #fff; padding: 6px 8px; font-size: 10px; letter-spacing: 0.5px; text-transform: uppercase; }
  tbody td { border-bottom: 1px solid #e2e8f0; padding: 8px; vertical-align: top; }
  td.num { font-weight: 700; width: 36px; text-align: center; background: #f1f5f9; }
  td.check { width: 60px; text-align: center; }
  td.check::before { content: ""; display: inline-block; width: 14px; height: 14px; border: 1.5px solid #0a1628; border-radius: 3px; }
  td.notes { width: 240px; }
  .addr { line-height: 1.35; }
  .muted { color: #64748b; font-size: 10px; }
  .footer { margin-top: 18px; font-size: 9px; color: #94a3b8; text-align: right; }
  @media print {
    body { padding: 12px; }
    .noprint { display: none !important; }
    table { page-break-inside: auto; }
    tr { page-break-inside: avoid; }
    thead { display: table-header-group; }
  }
  .toolbar { margin-bottom: 16px; }
  .toolbar button { background: #0a1628; color: #fff; border: 0; padding: 8px 14px; font-size: 11px; letter-spacing: 1px; cursor: pointer; border-radius: 4px; }
</style></head>
<body>
  <div class="toolbar noprint"><button onclick="window.print()">PRINT</button></div>
  <h1>${escapeHtml(route.name)} — Call Sheet</h1>
  <div class="meta">
    <b>Salesman:</b> ${escapeHtml(route.salesman || "—")} &nbsp;·&nbsp;
    <b>Start date:</b> ${escapeHtml(route.start_date || "—")} &nbsp;·&nbsp;
    <b>${escapeHtml(phaseLabel)}:</b> ${stops.length} stops &nbsp;·&nbsp;
    <b>Printed:</b> ${escapeHtml(today)}
  </div>
  ${staticMapUrl ? `<img class="map" src="${staticMapUrl}" alt="Route map" onerror="this.style.display='none'"/>` : ""}
  <table>
    <thead><tr>${headerCols}</tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <div class="footer">Cardiac Solutions LLC — Sales Routes</div>
  <script>window.addEventListener('load', () => setTimeout(() => window.print(), 600));</script>
</body></html>`;
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) { alert("Popup blocked. Please allow popups for this site."); return; }
  w.document.open();
  w.document.write(html);
  w.document.close();
};

export default function Sales() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const [routes, setRoutes] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [phaseFilter, setPhaseFilter] = useState("ALL");

  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadName, setUploadName] = useState("");
  const [uploadSalesman, setUploadSalesman] = useState("");
  const [uploadStartDate, setUploadStartDate] = useState("");
  const [uploading, setUploading] = useState(false);

  // Visit logging modal state
  const [visitModal, setVisitModal] = useState(null); // { idx, stop } when marking complete
  const [visitGps, setVisitGps] = useState({ status: "idle", lat: null, lng: null, accuracy: null, error: "" });
  const [visitNote, setVisitNote] = useState("");
  const [visitSaving, setVisitSaving] = useState(false);

  // Trip recap modal state
  const [recapData, setRecapData] = useState(null);
  const [recapLoading, setRecapLoading] = useState(false);

  const fetchRoutes = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/sales/routes`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error(`list ${r.status}`);
      const d = await r.json();
      setRoutes(d.routes || []);
      setErr("");
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  const fetchDetail = async (route_id) => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/sales/routes/${route_id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error(`detail ${r.status}`);
      const d = await r.json();
      setSelected(d);
      setPhaseFilter("ALL");
      setErr("");
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchRoutes(); }, []); // eslint-disable-line

  const submitUpload = async () => {
    if (!uploadFile) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", uploadFile);
      fd.append("name", uploadName);
      fd.append("salesman", uploadSalesman);
      fd.append("start_date", uploadStartDate);
      const r = await fetch(`${API}/sales/routes/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || `upload ${r.status}`);
      setShowUpload(false);
      setUploadFile(null); setUploadName(""); setUploadSalesman(""); setUploadStartDate("");
      await fetchRoutes();
      await fetchDetail(d.route_id);
    } catch (e) { setErr(e.message); }
    finally { setUploading(false); }
  };

  const deleteRoute = async (route_id) => {
    if (!window.confirm("Delete this route?")) return;
    try {
      await fetch(`${API}/sales/routes/${route_id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      if (selected?.route_id === route_id) setSelected(null);
      fetchRoutes();
    } catch (e) { setErr(e.message); }
  };

  const toggleStop = async (idx) => {
    if (!selected) return;
    const stop = selected.stops?.[idx];
    if (!stop) return;
    // If already complete, simply un-mark via plain POST
    if (stop.completed) {
      const r = await fetch(`${API}/sales/routes/${selected.route_id}/stops/${idx}/toggle`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) fetchDetail(selected.route_id);
      return;
    }
    // Otherwise open the visit logging modal
    setVisitNote("");
    setVisitGps({ status: "idle", lat: null, lng: null, accuracy: null, error: "" });
    setVisitModal({ idx, stop });
    // Try to capture GPS immediately
    if (navigator.geolocation) {
      setVisitGps({ status: "capturing", lat: null, lng: null, accuracy: null, error: "" });
      navigator.geolocation.getCurrentPosition(
        (pos) => setVisitGps({ status: "ok", lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, error: "" }),
        (e) => setVisitGps({ status: "error", lat: null, lng: null, accuracy: null, error: e.message || "GPS unavailable" }),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      setVisitGps({ status: "error", lat: null, lng: null, accuracy: null, error: "Geolocation not supported" });
    }
  };

  const submitVisit = async () => {
    if (!visitModal) return;
    setVisitSaving(true);
    try {
      const body = {
        lat: visitGps.lat,
        lng: visitGps.lng,
        accuracy_m: visitGps.accuracy,
        note: visitNote,
      };
      const r = await fetch(`${API}/sales/routes/${selected.route_id}/stops/${visitModal.idx}/toggle`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(`save ${r.status}`);
      setVisitModal(null);
      await fetchDetail(selected.route_id);
    } catch (e) { setErr(e.message); }
    finally { setVisitSaving(false); }
  };

  const openRecap = async () => {
    if (!selected) return;
    setRecapLoading(true);
    try {
      const r = await fetch(`${API}/sales/routes/${selected.route_id}/recap`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error(`recap ${r.status}`);
      const d = await r.json();
      setRecapData(d);
    } catch (e) { setErr(e.message); }
    finally { setRecapLoading(false); }
  };

  // Schema detection + phases derived from selected route
  const perStop = useMemo(() => isPerStopSchema(selected?.stops || []), [selected]);
  const phases = useMemo(() => {
    if (!selected?.stops) return [];
    const seen = new Set();
    const out = [];
    selected.stops.forEach(s => {
      const key = String(s.phase || s.day || "").trim();
      if (key && !seen.has(key)) { seen.add(key); out.push(key); }
    });
    // Sort:
    //  1. Numeric phases first (1, 2, 3 …)
    //  2. Geographic keywords: West → Middle/Central → East, North → South
    //  3. Otherwise alphabetical
    const geoRank = (s) => {
      const t = s.toLowerCase();
      if (t.includes("west")) return 1;
      if (t.includes("middle") || t.includes("central")) return 2;
      if (t.includes("east")) return 3;
      if (t.includes("north")) return 4;
      if (t.includes("south")) return 5;
      return 99;
    };
    out.sort((a, b) => {
      const na = parseFloat(a), nb = parseFloat(b);
      const aIsNum = !Number.isNaN(na), bIsNum = !Number.isNaN(nb);
      if (aIsNum && bIsNum) return na - nb;
      if (aIsNum && !bIsNum) return -1;
      if (!aIsNum && bIsNum) return 1;
      const ra = geoRank(a), rb = geoRank(b);
      if (ra !== rb) return ra - rb;
      return a.localeCompare(b);
    });
    return out;
  }, [selected]);

  const filteredStops = useMemo(() => {
    if (!selected?.stops) return [];
    if (phaseFilter === "ALL") return selected.stops;
    return selected.stops.filter(s => String(s.phase || s.day || "").trim() === phaseFilter);
  }, [selected, phaseFilter]);

  return (
    <div className="min-h-screen bg-[#040A14] text-cyan-100 p-6 font-sans">
      <div className="max-w-[1500px] mx-auto">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => navigate("/hub")} data-testid="sales-back-btn" className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 text-sm">
            <ArrowLeft className="w-4 h-4" /> Back to Hub
          </button>
          <h1 className="font-orbitron text-2xl font-bold tracking-widest text-cyan-300">SALES ROUTES</h1>
          <button onClick={() => setShowUpload(true)} data-testid="sales-upload-btn" className="flex items-center gap-2 px-3 py-1.5 rounded text-sm border border-green-500/40 bg-green-500/10 text-green-300 hover:bg-green-500/20">
            <Upload className="w-4 h-4" /> Upload Route
          </button>
        </div>

        {err && <div className="mb-4 p-3 border border-red-500/40 bg-red-500/10 text-red-300 text-sm rounded">{err}</div>}

        <div className="grid grid-cols-12 gap-4">
          {/* Routes list */}
          <div className="col-span-4 p-4 rounded-lg border border-cyan-500/20 bg-[rgba(0,18,32,0.93)]">
            <h2 className="font-orbitron text-xs font-bold tracking-widest text-cyan-300 mb-3">UPLOADED ROUTES ({routes.length})</h2>
            {routes.length === 0 ? (
              <div className="text-slate-400 text-sm py-6 text-center">No routes yet. Click "Upload Route" to add one.</div>
            ) : (
              <div className="space-y-2" data-testid="sales-routes-list">
                {routes.map(r => (
                  <div
                    key={r.route_id}
                    onClick={() => fetchDetail(r.route_id)}
                    data-testid={`sales-route-item-${r.route_id}`}
                    className={`group p-3 rounded border cursor-pointer transition-all ${selected?.route_id === r.route_id ? "border-cyan-400 bg-cyan-500/10" : "border-cyan-500/20 hover:border-cyan-400/50 hover:bg-cyan-500/5"}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-cyan-200 truncate">{r.name}</div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-1">
                          <User className="w-3 h-3" /> {r.salesman || "—"}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                          <Calendar className="w-3 h-3" /> {r.start_date || "—"}
                          <span className="text-cyan-400">{r.stops_count} stops</span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-1">{fmtDate(r.uploaded_at)}</div>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); deleteRoute(r.route_id); }} className="opacity-0 group-hover:opacity-100 transition text-red-400 hover:text-red-300 p-1">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Detail panel */}
          <div className="col-span-8 p-4 rounded-lg border border-cyan-500/20 bg-[rgba(0,18,32,0.93)]">
            {!selected ? (
              <div className="text-slate-400 text-sm py-12 text-center">Select a route to view stops</div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h2 className="font-orbitron text-base font-bold tracking-wider text-cyan-200">{selected.name}</h2>
                    <div className="text-xs text-slate-400 mt-1">
                      Salesman: <span className="text-cyan-300">{selected.salesman || "—"}</span>
                      <span className="mx-2">·</span>
                      Start: <span className="text-cyan-300">{selected.start_date || "—"}</span>
                      <span className="mx-2">·</span>
                      <span className="text-cyan-300">{selected.stops_count} stops</span>
                      {phaseFilter !== "ALL" && (
                        <>
                          <span className="mx-2">·</span>
                          <span className="text-amber-300">Showing {filteredStops.length} for {perStop ? "Phase" : "Day"} {phaseFilter}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Phase / Day filter chips + Print button */}
                <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                  <div className="flex flex-wrap gap-2" data-testid="sales-phase-filter">
                    {phases.length > 1 && (
                      <>
                        <button
                          onClick={() => setPhaseFilter("ALL")}
                          data-testid="phase-chip-ALL"
                          className={`px-3 py-1 rounded-full text-[11px] font-bold tracking-wider border transition ${phaseFilter === "ALL" ? "border-cyan-400 bg-cyan-500/20 text-cyan-200" : "border-cyan-500/30 text-cyan-400 hover:border-cyan-400/60"}`}
                        >
                          ALL ({selected.stops.length})
                        </button>
                        {phases.map(p => {
                          const count = selected.stops.filter(s => String(s.phase || s.day || "").trim() === p).length;
                          const active = phaseFilter === p;
                          return (
                            <button
                              key={p}
                              onClick={() => setPhaseFilter(p)}
                              data-testid={`phase-chip-${p}`}
                              className={`px-3 py-1 rounded-full text-[11px] font-bold tracking-wider border transition ${active ? "border-amber-400 bg-amber-500/20 text-amber-200" : "border-cyan-500/30 text-cyan-400 hover:border-amber-400/60 hover:text-amber-300"}`}
                            >
                              {perStop ? "PHASE" : "DAY"} {p} ({count})
                            </button>
                          );
                        })}
                      </>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={openRecap}
                      data-testid="trip-recap-btn"
                      className="flex items-center gap-1.5 px-3 py-1 rounded text-[11px] font-bold tracking-wider border border-cyan-500/40 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20"
                      title="View visited stops with GPS accuracy and notes"
                    >
                      <ClipboardList className="w-3.5 h-3.5" /> TRIP RECAP
                    </button>
                    <button
                      onClick={() => openCallSheet({ route: selected, stops: filteredStops, perStop, phaseFilter })}
                      data-testid="print-call-sheet-btn"
                      className="flex items-center gap-1.5 px-3 py-1 rounded text-[11px] font-bold tracking-wider border border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
                      title="Open a printable call sheet for the visible stops"
                    >
                      <Printer className="w-3.5 h-3.5" /> PRINT CALL SHEET
                    </button>
                  </div>
                </div>

                <SalesRouteMap stops={filteredStops} perStop={perStop} />

                <div className="mt-4 max-h-[55vh] overflow-y-auto">
                  <table className="w-full text-sm" data-testid="sales-stops-table">
                    <thead>
                      <tr className="border-b border-cyan-500/20 text-cyan-400 text-[10px] uppercase tracking-wider">
                        <th className="text-left py-2 w-8"></th>
                        {perStop ? (
                          <>
                            <th className="text-left py-2">Phase</th>
                            <th className="text-left py-2">Stop #</th>
                            <th className="text-left py-2">County</th>
                            <th className="text-left py-2">Office Address</th>
                            <th className="text-left py-2">City</th>
                            <th className="text-left py-2">State</th>
                            <th className="text-left py-2">ZIP</th>
                          </>
                        ) : (
                          <>
                            <th className="text-left py-2">Day</th>
                            <th className="text-left py-2">Region</th>
                            <th className="text-left py-2">Counties</th>
                            <th className="text-left py-2">Start</th>
                            <th className="text-left py-2">End</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStops.map((s) => {
                        const i = s.idx; // original index needed for toggle
                        return (
                          <tr key={i} className={`border-b border-cyan-500/10 ${s.completed ? "opacity-50" : ""}`}>
                            <td className="py-2">
                              <button onClick={() => toggleStop(i)} data-testid={`stop-toggle-${i}`} className={`w-5 h-5 rounded border flex items-center justify-center ${s.completed ? "bg-green-500/30 border-green-400 text-green-300" : "border-cyan-500/40 hover:border-cyan-400"}`} title={s.completed ? "Mark incomplete" : "Mark complete"}>
                                {s.completed && <Check className="w-3 h-3" />}
                              </button>
                            </td>
                            {perStop ? (
                              <>
                                <td className="py-2 text-xs text-cyan-200 font-mono">{s.phase || "—"}</td>
                                <td className="py-2 text-xs text-cyan-200 font-mono">{s.stop_num || "—"}</td>
                                <td className="py-2 text-xs text-slate-300">{s.counties || "—"}</td>
                                <td className="py-2 text-xs text-slate-300 max-w-[280px]">
                                  <span className={s.start_lat ? "text-cyan-200" : "text-slate-400"}>{s.office_address || "—"}</span>
                                  {!s.start_lat && s.office_address && <MapPin className="inline w-3 h-3 text-yellow-500/60 ml-1" title="not geocoded" />}
                                </td>
                                <td className="py-2 text-xs text-slate-300">{s.starting_city || "—"}</td>
                                <td className="py-2 text-xs text-slate-300">{s.state || "—"}</td>
                                <td className="py-2 text-xs text-slate-300">{s.zip || "—"}</td>
                              </>
                            ) : (
                              <>
                                <td className="py-2 text-xs">
                                  <div className="text-cyan-200 font-mono">{s.day}</div>
                                  {s.week && <div className="text-[10px] text-slate-500">Week {s.week}</div>}
                                </td>
                                <td className="py-2 text-xs text-slate-300">{s.region}</td>
                                <td className="py-2 text-xs text-slate-300 max-w-[260px]">{s.counties}</td>
                                <td className="py-2 text-xs">
                                  <span className={s.start_lat ? "text-cyan-200" : "text-slate-500"}>{s.starting_city || "—"}</span>
                                  {!s.start_lat && s.starting_city && <MapPin className="inline w-3 h-3 text-yellow-500/60 ml-1" title="not geocoded" />}
                                </td>
                                <td className="py-2 text-xs">
                                  <span className={s.end_lat ? "text-cyan-200" : "text-slate-500"}>{s.ending_city || "—"}</span>
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Upload modal */}
      {showUpload && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50" onClick={() => !uploading && setShowUpload(false)}>
          <div className="bg-[#0A1628] border border-cyan-500/40 rounded-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-orbitron text-lg text-cyan-300 mb-4">UPLOAD ROUTE</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-cyan-400 uppercase tracking-wider">Route Name</label>
                <input value={uploadName} onChange={(e) => setUploadName(e.target.value)} placeholder="Tennessee Sheriffs" data-testid="upload-name" className="w-full mt-1 bg-[#020617] border border-cyan-500/30 text-cyan-200 rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-cyan-400 uppercase tracking-wider">Salesman</label>
                <input value={uploadSalesman} onChange={(e) => setUploadSalesman(e.target.value)} placeholder="Mark Allred" data-testid="upload-salesman" className="w-full mt-1 bg-[#020617] border border-cyan-500/30 text-cyan-200 rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-cyan-400 uppercase tracking-wider">Start Date (optional)</label>
                <input type="date" value={uploadStartDate} onChange={(e) => setUploadStartDate(e.target.value)} data-testid="upload-start-date" className="w-full mt-1 bg-[#020617] border border-cyan-500/30 text-cyan-200 rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-cyan-400 uppercase tracking-wider">File (.xlsx or .csv)</label>
                <input type="file" accept=".xlsx,.xlsm,.csv" onChange={(e) => setUploadFile(e.target.files?.[0])} data-testid="upload-file" className="w-full mt-1 text-sm text-cyan-200" />
                <div className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                  Supported schemas:<br/>
                  <span className="text-cyan-400">A.</span> Week · Day · Region · Counties · Starting City · Ending City<br/>
                  <span className="text-cyan-400">B.</span> Phase · Stop # · County · Office Address · City · State · ZIP
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowUpload(false)} disabled={uploading} className="px-4 py-2 text-sm border border-slate-500/40 text-slate-300 rounded hover:bg-slate-500/10">Cancel</button>
              <button onClick={submitUpload} disabled={!uploadFile || uploading} data-testid="upload-submit" className="px-4 py-2 text-sm border border-green-500/40 bg-green-500/10 text-green-300 rounded hover:bg-green-500/20 disabled:opacity-50">
                {uploading ? "Uploading…" : "Upload"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Log Visit modal */}
      {visitModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50" onClick={() => !visitSaving && setVisitModal(null)}>
          <div className="bg-[#0A1628] border border-cyan-500/40 rounded-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-orbitron text-lg text-cyan-300 mb-1 flex items-center gap-2"><MapPin className="w-4 h-4" /> LOG VISIT</h3>
            <div className="text-[11px] text-slate-400 mb-4">
              {perStop ? `Phase ${visitModal.stop.phase} · Stop ${visitModal.stop.stop_num}` : `Day ${visitModal.stop.day}`}
              <div className="text-cyan-200 mt-0.5">{visitModal.stop.office_address || visitModal.stop.starting_city || "—"}</div>
            </div>

            {/* GPS status */}
            <div className="mb-4 p-3 rounded border border-cyan-500/20 bg-[rgba(0,12,24,0.6)]">
              <div className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-2 text-cyan-400 font-bold tracking-wider">
                  <Crosshair className="w-3.5 h-3.5" /> GPS LOCATION
                </div>
                <div data-testid="visit-gps-status" className={`text-[10px] tracking-wider ${
                  visitGps.status === "ok" ? "text-green-400" :
                  visitGps.status === "capturing" ? "text-amber-300" :
                  visitGps.status === "error" ? "text-red-400" : "text-slate-500"
                }`}>
                  {visitGps.status === "ok" ? "CAPTURED" : visitGps.status === "capturing" ? "CAPTURING…" : visitGps.status === "error" ? "UNAVAILABLE" : "IDLE"}
                </div>
              </div>
              {visitGps.status === "ok" && (
                <div className="text-[11px] text-cyan-200 mt-1 font-mono">
                  {visitGps.lat.toFixed(6)}, {visitGps.lng.toFixed(6)}
                  {visitGps.accuracy && <span className="text-slate-500 ml-2">±{Math.round(visitGps.accuracy)}m</span>}
                </div>
              )}
              {visitGps.status === "error" && (
                <div className="text-[11px] text-red-300 mt-1">{visitGps.error}<br/><span className="text-slate-500">You can still save without GPS.</span></div>
              )}
              {visitGps.status === "capturing" && (
                <div className="text-[11px] text-slate-400 mt-1">Waiting for browser location permission…</div>
              )}
            </div>

            <label className="text-xs text-cyan-400 uppercase tracking-wider">Note (optional)</label>
            <textarea
              value={visitNote}
              onChange={(e) => setVisitNote(e.target.value)}
              data-testid="visit-note"
              rows={3}
              maxLength={500}
              placeholder="Met with John — interested in 2 AED units, follow up next week"
              className="w-full mt-1 bg-[#020617] border border-cyan-500/30 text-cyan-200 rounded px-3 py-2 text-sm resize-none"
            />
            <div className="text-[10px] text-slate-500 text-right mt-0.5">{visitNote.length}/500</div>

            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setVisitModal(null)} disabled={visitSaving} className="px-4 py-2 text-sm border border-slate-500/40 text-slate-300 rounded hover:bg-slate-500/10">Cancel</button>
              <button
                onClick={submitVisit}
                disabled={visitSaving}
                data-testid="visit-save-btn"
                className="px-4 py-2 text-sm border border-green-500/40 bg-green-500/10 text-green-300 rounded hover:bg-green-500/20 disabled:opacity-50 flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                {visitSaving ? "Saving…" : "Save & Mark Complete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Trip Recap modal */}
      {recapData && (
        <TripRecapModal data={recapData} onClose={() => setRecapData(null)} />
      )}
      {recapLoading && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="text-cyan-300 text-sm">Loading trip recap…</div>
        </div>
      )}
    </div>
  );
}

function TripRecapModal({ data, onClose }) {
  const fmt = (iso) => {
    if (!iso) return "—";
    try { return new Date(iso).toLocaleString(); } catch { return iso; }
  };
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50" onClick={onClose} data-testid="trip-recap-modal">
      <div className="bg-[#0A1628] border border-cyan-500/40 rounded-lg w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-cyan-500/20">
          <div>
            <h2 className="font-orbitron text-lg text-cyan-300 tracking-wider">TRIP RECAP</h2>
            <div className="text-[11px] text-slate-400 mt-0.5">{data.name} · {data.salesman || "—"}</div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-cyan-300 text-xl leading-none px-2">×</button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-5 gap-3 p-5 border-b border-cyan-500/20">
          <Stat label="VISITED" value={`${data.visited_count} / ${data.total_stops}`} accent="text-green-300" />
          <Stat label="COMPLETION" value={`${data.completion_pct}%`} accent="text-cyan-200" />
          <Stat label="DURATION" value={data.duration_min != null ? `${data.duration_min} min` : "—"} accent="text-cyan-200" />
          <Stat label="AVG OFF-PLAN" value={data.avg_miles_off_plan != null ? `${data.avg_miles_off_plan} mi` : "—"} accent="text-amber-300" />
          <Stat label="LAST VISIT" value={data.last_visit_at ? fmt(data.last_visit_at).replace(/:\d{2}\s/, " ") : "—"} accent="text-slate-300" small />
        </div>

        {/* Visited table */}
        <div className="flex-1 overflow-y-auto p-5">
          {data.visited.length === 0 ? (
            <div className="text-slate-400 text-sm py-8 text-center">No visits logged yet. Mark a stop complete to capture GPS + notes.</div>
          ) : (
            <table className="w-full text-sm" data-testid="recap-table">
              <thead>
                <tr className="border-b border-cyan-500/20 text-cyan-400 text-[10px] uppercase tracking-wider">
                  <th className="text-left py-2">Stop</th>
                  <th className="text-left py-2">Phase</th>
                  <th className="text-left py-2">Location</th>
                  <th className="text-left py-2">Visited At</th>
                  <th className="text-left py-2">By</th>
                  <th className="text-right py-2">Off-Plan</th>
                  <th className="text-left py-2">Note</th>
                </tr>
              </thead>
              <tbody>
                {data.visited.map((v) => (
                  <tr key={v.idx} className="border-b border-cyan-500/10">
                    <td className="py-2 text-cyan-200 font-mono text-xs">{v.stop_num || v.idx + 1}</td>
                    <td className="py-2 text-slate-300 text-xs">{v.phase || "—"}</td>
                    <td className="py-2 text-cyan-200 text-xs max-w-[260px]">
                      <div className="truncate">{v.label || "—"}</div>
                      {(v.city || v.state) && <div className="text-[10px] text-slate-500">{[v.city, v.state].filter(Boolean).join(", ")}</div>}
                    </td>
                    <td className="py-2 text-slate-300 text-xs">{fmt(v.completed_at)}</td>
                    <td className="py-2 text-slate-400 text-xs">{v.visited_by || "—"}</td>
                    <td className="py-2 text-right text-xs">
                      {v.miles_off == null ? (
                        <span className="text-slate-500">no GPS</span>
                      ) : v.miles_off < 0.1 ? (
                        <span className="text-green-400">on-site</span>
                      ) : v.miles_off < 1 ? (
                        <span className="text-cyan-300">{v.miles_off} mi</span>
                      ) : (
                        <span className="text-amber-300">{v.miles_off} mi</span>
                      )}
                    </td>
                    <td className="py-2 text-slate-300 text-xs max-w-[300px]">
                      <div className="truncate" title={v.visit_note}>{v.visit_note || <span className="text-slate-600">—</span>}</div>
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

function Stat({ label, value, accent = "text-cyan-200", small = false }) {
  return (
    <div className="p-3 rounded border border-cyan-500/20 bg-[rgba(0,12,24,0.6)]">
      <div className="text-[9px] tracking-widest text-cyan-400 font-bold">{label}</div>
      <div className={`mt-1 ${small ? "text-xs" : "text-lg"} font-bold ${accent}`}>{value}</div>
    </div>
  );
}

function SalesRouteMap({ stops, perStop }) {
  const ref = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const polylineRef = useRef(null);
  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: MAP_KEY });

  const points = useMemo(() => {
    return stops
      .map((s) => s.start_lat && s.start_lng ? {
        lat: s.start_lat,
        lng: s.start_lng,
        label: perStop ? (s.office_address || s.starting_city) : s.starting_city,
        day: s.day,
        phase: s.phase,
        stopNum: s.stop_num,
        idx: s.idx,
        completed: s.completed,
        cityState: [s.starting_city, s.state, s.zip].filter(Boolean).join(", "),
      } : null)
      .filter(Boolean);
  }, [stops, perStop]);

  useEffect(() => {
    if (!isLoaded || !window.google?.maps || !ref.current) return;
    if (!mapRef.current) {
      mapRef.current = new window.google.maps.Map(ref.current, {
        zoom: 6, center: { lat: 35.86, lng: -86.66 },
        mapTypeControl: false, streetViewControl: false, fullscreenControl: false,
        zoomControl: true,
        zoomControlOptions: { position: window.google.maps.ControlPosition.RIGHT_CENTER },
        gestureHandling: "greedy",
        styles: [{ elementType: "geometry", stylers: [{ color: "#1a2332" }] }, { elementType: "labels.text.fill", stylers: [{ color: "#9ca3af" }] }, { elementType: "labels.text.stroke", stylers: [{ color: "#0a1628" }] }, { featureType: "water", stylers: [{ color: "#0a1628" }] }, { featureType: "road", stylers: [{ color: "#2a3a4a" }] }],
      });
    }
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];
    if (polylineRef.current) polylineRef.current.setMap(null);
    if (points.length === 0) return;

    const bounds = new window.google.maps.LatLngBounds();
    points.forEach((p, i) => {
      const labelText = perStop ? String(p.stopNum || i + 1) : String(i + 1);
      const marker = new window.google.maps.Marker({
        position: { lat: p.lat, lng: p.lng },
        map: mapRef.current,
        label: { text: labelText, color: "#0a1628", fontWeight: "bold", fontSize: "11px" },
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 13,
          fillColor: p.completed ? "#22c55e" : "#06b6d4",
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 2,
        },
        title: perStop ? `Phase ${p.phase} · Stop ${p.stopNum}: ${p.label}` : `Day ${p.day}: ${p.label}`,
      });
      const headerLine = perStop
        ? `<b>Phase ${p.phase || "—"} · Stop ${p.stopNum || "—"}</b>`
        : `<b>Day ${p.day || "—"}</b>`;
      const cityLine = perStop && p.cityState ? `<br/><span style="color:#475569">${p.cityState}</span>` : "";
      const info = new window.google.maps.InfoWindow({
        content: `<div style="color:#0a1628;font-size:12px;max-width:260px">${headerLine}<br/>${p.label || ""}${cityLine}</div>`,
      });
      marker.addListener("click", () => info.open(mapRef.current, marker));
      markersRef.current.push(marker);
      bounds.extend(marker.getPosition());
    });
    polylineRef.current = new window.google.maps.Polyline({
      path: points.map(p => ({ lat: p.lat, lng: p.lng })),
      geodesic: true, strokeColor: "#06b6d4", strokeOpacity: 0.8, strokeWeight: 3,
      map: mapRef.current,
    });
    if (points.length === 1) {
      mapRef.current.setCenter(points[0]);
      mapRef.current.setZoom(11);
    } else {
      mapRef.current.fitBounds(bounds, 60);
    }
  }, [points, perStop, isLoaded]);

  if (!isLoaded) {
    return <div className="h-[320px] rounded border border-cyan-500/20 bg-[rgba(0,12,24,0.6)] flex items-center justify-center text-slate-500 text-sm">Loading map…</div>;
  }
  if (points.length === 0) {
    return <div className="h-[260px] rounded border border-dashed border-cyan-500/30 bg-[rgba(0,12,24,0.6)] flex items-center justify-center text-slate-500 text-sm">No geocoded stops to map</div>;
  }
  return <div ref={ref} className="h-[320px] rounded border border-cyan-500/20 bg-[rgba(0,12,24,0.6)]" data-testid="sales-route-map" />;
}
