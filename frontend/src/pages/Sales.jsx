import React, { useEffect, useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Upload, MapPin, Trash2, Check, Calendar, User } from "lucide-react";
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
    const r = await fetch(`${API}/sales/routes/${selected.route_id}/stops/${idx}/toggle`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    if (r.ok) fetchDetail(selected.route_id);
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
    // Natural sort: numeric phases first, then alpha
    out.sort((a, b) => {
      const na = parseFloat(a), nb = parseFloat(b);
      if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
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

                {/* Phase / Day filter chips */}
                {phases.length > 1 && (
                  <div className="flex flex-wrap gap-2 mb-3" data-testid="sales-phase-filter">
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
                  </div>
                )}

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
