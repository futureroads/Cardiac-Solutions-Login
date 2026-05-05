import React, { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronRight, MapPin, Navigation2, Check, Crosshair, Phone, FileText, Trash2, LogOut, Map as MapIcon, Fuel } from "lucide-react";
import { useJsApiLoader } from "@react-google-maps/api";
import API_BASE from "../apiBase";

const API = API_BASE + "/api";
const MAP_KEY = process.env.REACT_APP_GOOGLE_MAPS_KEY;

const isPerStopSchema = (stops) => {
  if (!stops || stops.length === 0) return false;
  return stops.some(s => s.office_address || s.state || s.zip || (s.stop_num && s.stop_num !== s.idx + 1));
};

const sortPhases = (arr) => {
  const geoRank = (s) => {
    const t = s.toLowerCase();
    if (t.includes("west")) return 1;
    if (t.includes("middle") || t.includes("central")) return 2;
    if (t.includes("east")) return 3;
    if (t.includes("north")) return 4;
    if (t.includes("south")) return 5;
    return 99;
  };
  return [...arr].sort((a, b) => {
    const na = parseFloat(a), nb = parseFloat(b);
    const aIsNum = !Number.isNaN(na), bIsNum = !Number.isNaN(nb);
    if (aIsNum && bIsNum) return na - nb;
    if (aIsNum && !bIsNum) return -1;
    if (!aIsNum && bIsNum) return 1;
    const ra = geoRank(a), rb = geoRank(b);
    if (ra !== rb) return ra - rb;
    return a.localeCompare(b);
  });
};

const buildAddress = (s) => {
  const parts = [s.office_address, s.starting_city, s.state, s.zip].filter(Boolean);
  return parts.join(", ") || s.starting_city || "—";
};

const directionsUrl = (s) => {
  if (s.start_lat && s.start_lng) {
    return `https://www.google.com/maps/dir/?api=1&destination=${s.start_lat},${s.start_lng}`;
  }
  const q = encodeURIComponent(buildAddress(s));
  return `https://www.google.com/maps/dir/?api=1&destination=${q}`;
};

// Haversine distance in miles between two lat/lng points
const haversineMiles = (lat1, lng1, lat2, lng2) => {
  if ([lat1, lng1, lat2, lng2].some(v => v == null || Number.isNaN(v))) return 0;
  const R = 3958.7613;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};

const ROAD_FACTOR = 1.3;

// Group stops by phase/day, compute per-day driving miles
const calcFuelBreakdown = (stops) => {
  if (!stops || stops.length === 0) return { perDay: [], totalMiles: 0, dayCount: 0 };
  const groups = new Map();
  stops.forEach(s => {
    const key = String(s.phase || s.day || "Unassigned").trim() || "Unassigned";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  });
  const perDay = [];
  let totalMiles = 0;
  for (const [key, dayStops] of groups.entries()) {
    const ordered = [...dayStops].sort((a, b) => (a.idx ?? 0) - (b.idx ?? 0));
    let miles = 0;
    for (let i = 1; i < ordered.length; i++) {
      const a = ordered[i - 1], b = ordered[i];
      miles += haversineMiles(a.start_lat, a.start_lng, b.start_lat, b.start_lng) * ROAD_FACTOR;
    }
    perDay.push({ key, stops: ordered.length, miles });
    totalMiles += miles;
  }
  return { perDay, totalMiles, dayCount: groups.size };
};

export default function SalesMobile() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const [routes, setRoutes] = useState([]);
  const [selected, setSelected] = useState(null);
  const [phaseFilter, setPhaseFilter] = useState("ALL");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  // Visit modal
  const [visitModal, setVisitModal] = useState(null);
  const [visitGps, setVisitGps] = useState({ status: "idle", lat: null, lng: null, accuracy: null, error: "" });
  const [visitNote, setVisitNote] = useState("");
  const [visitSaving, setVisitSaving] = useState(false);

  // Recap modal
  const [recapModal, setRecapModal] = useState(null);
  const [recapForm, setRecapForm] = useState({ contact_name: "", contact_title: "", contact_phone: "", contact_email: "", interest_level: 5, followup: false, action_text: "" });
  const [recapSaving, setRecapSaving] = useState(false);

  // Route map modal
  const [showMap, setShowMap] = useState(false);
  // Fuel estimate modal
  const [showFuel, setShowFuel] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await fetch(`${API}/sales/routes`, { headers: { Authorization: `Bearer ${token}` } });
        const d = await r.json();
        setRoutes(d.routes || []);
      } catch (e) { setErr(e.message); }
      finally { setLoading(false); }
    })();
  }, [token]);

  const fetchDetail = async (route_id) => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/sales/routes/${route_id}`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      setSelected(d);
      setPhaseFilter("ALL");
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  const perStop = useMemo(() => isPerStopSchema(selected?.stops || []), [selected]);
  const phases = useMemo(() => {
    if (!selected?.stops) return [];
    const seen = new Set();
    selected.stops.forEach(s => {
      const k = String(s.phase || s.day || "").trim();
      if (k) seen.add(k);
    });
    return sortPhases([...seen]);
  }, [selected]);

  const filteredStops = useMemo(() => {
    if (!selected?.stops) return [];
    if (phaseFilter === "ALL") return selected.stops;
    return selected.stops.filter(s => String(s.phase || s.day || "").trim() === phaseFilter);
  }, [selected, phaseFilter]);

  const completed = filteredStops.filter(s => s.completed).length;

  const openVisit = (stop) => {
    setVisitNote("");
    setVisitGps({ status: "idle", lat: null, lng: null, accuracy: null, error: "" });
    setVisitModal(stop);
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
      const body = { lat: visitGps.lat, lng: visitGps.lng, accuracy_m: visitGps.accuracy, note: visitNote };
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

  const undoStop = async (stop) => {
    if (!window.confirm("Mark this stop as not visited?")) return;
    await fetch(`${API}/sales/routes/${selected.route_id}/stops/${stop.idx}/toggle`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    fetchDetail(selected.route_id);
  };

  const openRecap = (stop) => {
    const r = stop.recap || {};
    setRecapForm({
      contact_name: r.contact_name || "",
      contact_title: r.contact_title || "",
      contact_phone: r.contact_phone || "",
      contact_email: r.contact_email || "",
      interest_level: r.interest_level || 5,
      followup: !!r.followup,
      action_text: r.action_text || "",
    });
    setRecapModal(stop);
  };

  const submitRecap = async () => {
    if (!recapModal) return;
    setRecapSaving(true);
    try {
      const r = await fetch(`${API}/sales/routes/${selected.route_id}/stops/${recapModal.idx}/recap`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(recapForm),
      });
      if (!r.ok) throw new Error(`save ${r.status}`);
      setRecapModal(null);
      await fetchDetail(selected.route_id);
    } catch (e) { setErr(e.message); }
    finally { setRecapSaving(false); }
  };

  const deleteRecap = async () => {
    if (!recapModal || !recapModal.recap) { setRecapModal(null); return; }
    if (!window.confirm("Delete this recap?")) return;
    setRecapSaving(true);
    try {
      await fetch(`${API}/sales/routes/${selected.route_id}/stops/${recapModal.idx}/recap`, {
        method: "DELETE", headers: { Authorization: `Bearer ${token}` },
      });
      setRecapModal(null);
      await fetchDetail(selected.route_id);
    } catch (e) { setErr(e.message); }
    finally { setRecapSaving(false); }
  };

  // ROUTE PICKER
  if (!selected) {
    return (
      <div className="min-h-screen bg-[#040A14] text-cyan-100 px-4 py-5 font-sans">
        <div className="flex items-center justify-between mb-5">
          <h1 className="font-orbitron text-base font-bold tracking-widest text-cyan-300">SALES FIELD PORTAL</h1>
          <button
            onClick={() => {
              localStorage.removeItem("token");
              localStorage.removeItem("user");
              window.location.href = "/sales";
            }}
            data-testid="mobile-logout-btn"
            className="flex items-center gap-1.5 text-[10px] tracking-widest font-bold text-red-400 active:text-red-300 px-2 py-1"
          >
            <LogOut className="w-3.5 h-3.5" /> LOGOUT
          </button>
        </div>
        {err && <div className="mb-4 p-3 border border-red-500/40 bg-red-500/10 text-red-300 text-sm rounded">{err}</div>}
        <div className="text-[10px] tracking-widest text-cyan-400 font-bold mb-2">SELECT ROUTE</div>
        {loading && <div className="text-slate-400 text-sm py-4 text-center">Loading…</div>}
        {!loading && routes.length === 0 && (
          <div className="text-slate-400 text-sm py-8 text-center">No routes yet. Open the desktop view to upload one.</div>
        )}
        <div className="space-y-2" data-testid="mobile-routes-list">
          {routes.map(r => (
            <button
              key={r.route_id}
              onClick={() => fetchDetail(r.route_id)}
              data-testid={`mobile-route-${r.route_id}`}
              className="w-full text-left p-4 rounded-lg border border-cyan-500/30 bg-[rgba(0,18,32,0.93)] hover:bg-cyan-500/10 active:bg-cyan-500/20"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="text-base font-bold text-cyan-200 truncate">{r.name}</div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    {r.salesman || "—"} · {r.stops_count} stops
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-cyan-400" />
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // STOP LIST
  return (
    <div className="min-h-screen bg-[#040A14] text-cyan-100 pb-32 font-sans">
      {/* Sticky header */}
      <div className="sticky top-0 z-30 bg-[#040A14]/95 backdrop-blur border-b border-cyan-500/20 px-4 py-3">
        <div className="flex items-center justify-between mb-2 gap-2">
          <button onClick={() => setSelected(null)} data-testid="mobile-route-back" className="flex items-center gap-1 text-cyan-400 text-sm shrink-0">
            <ArrowLeft className="w-4 h-4" /> Routes
          </button>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowMap(true)}
              data-testid="mobile-route-map-btn"
              className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold tracking-widest border border-cyan-500/40 bg-cyan-500/10 text-cyan-300 active:bg-cyan-500/30"
            >
              <MapIcon className="w-3.5 h-3.5" /> MAP
            </button>
            <button
              onClick={() => setShowFuel(true)}
              data-testid="mobile-fuel-btn"
              className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold tracking-widest border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 active:bg-emerald-500/30"
            >
              <Fuel className="w-3.5 h-3.5" /> FUEL
            </button>
          </div>
          <div className="text-[10px] text-slate-500 shrink-0">{completed}/{filteredStops.length}</div>
        </div>
        <div className="text-base font-bold text-cyan-200 truncate" data-testid="mobile-route-name">{selected.name}</div>
        <div className="text-[11px] text-slate-400">{selected.salesman || "—"}</div>

        {/* Day chips */}
        {phases.length > 1 && (
          <div className="flex gap-2 mt-3 -mx-4 px-4 overflow-x-auto pb-1" data-testid="mobile-phase-filter">
            <button
              onClick={() => setPhaseFilter("ALL")}
              data-testid="mobile-chip-ALL"
              className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold tracking-wider border ${phaseFilter === "ALL" ? "border-cyan-400 bg-cyan-500/20 text-cyan-200" : "border-cyan-500/30 text-cyan-400"}`}
            >
              ALL ({selected.stops.length})
            </button>
            {phases.map(p => {
              const cnt = selected.stops.filter(s => String(s.phase || s.day || "").trim() === p).length;
              const active = phaseFilter === p;
              return (
                <button
                  key={p}
                  onClick={() => setPhaseFilter(p)}
                  data-testid={`mobile-chip-${p}`}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold tracking-wider border ${active ? "border-amber-400 bg-amber-500/20 text-amber-200" : "border-cyan-500/30 text-cyan-400"}`}
                >
                  {perStop ? "PHASE" : "DAY"} {p} ({cnt})
                </button>
              );
            })}
          </div>
        )}
      </div>

      {err && <div className="m-4 p-3 border border-red-500/40 bg-red-500/10 text-red-300 text-sm rounded">{err}</div>}

      {/* Stop cards */}
      <div className="px-4 pt-4 space-y-3" data-testid="mobile-stops-list">
        {filteredStops.length === 0 ? (
          <div className="text-slate-400 text-sm py-8 text-center">No stops in this filter.</div>
        ) : (
          filteredStops.map((s) => {
            const stopNo = perStop ? (s.stop_num || s.idx + 1) : s.idx + 1;
            const addr = buildAddress(s);
            return (
              <div
                key={s.idx}
                data-testid={`mobile-stop-${s.idx}`}
                className={`p-4 rounded-xl border-2 ${
                  s.recap
                    ? "border-slate-400/40 bg-slate-300/10"
                    : s.completed
                      ? "border-green-500/50 bg-green-500/5"
                      : "border-cyan-500/30 bg-[rgba(0,18,32,0.93)]"
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold font-mono text-sm shrink-0 ${s.completed ? "bg-green-500/30 text-green-300 border border-green-400/50" : "bg-cyan-500/20 text-cyan-300 border border-cyan-400/40"}`}>
                      {s.completed ? <Check className="w-5 h-5" /> : stopNo}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] tracking-widest text-cyan-400 font-bold truncate">
                        {perStop ? `${s.phase || "—"} · STOP ${stopNo}` : `${s.day || "DAY"}${s.week ? ` · WEEK ${s.week}` : ""}`}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 truncate">{s.counties || s.region || "—"}</div>
                    </div>
                  </div>
                </div>

                <a
                  href={directionsUrl(s)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-base text-cyan-100 leading-snug mb-3 active:text-cyan-300"
                  data-testid={`mobile-stop-${s.idx}-addr`}
                >
                  <MapPin className="inline w-4 h-4 text-cyan-400 mr-1 mb-0.5" />
                  {addr}
                </a>

                {s.completed && s.visit_note && (
                  <div className="text-[11px] text-slate-300 bg-green-500/5 border border-green-500/20 rounded p-2 mb-3 italic">
                    "{s.visit_note}"
                  </div>
                )}
                {s.completed && s.completed_at && (
                  <div className="text-[10px] text-slate-500 mb-3">
                    Logged {new Date(s.completed_at).toLocaleString()} {s.visited_by ? `· ${s.visited_by}` : ""}
                  </div>
                )}

                {s.recap && (
                  <div className="text-[11px] bg-amber-500/5 border border-amber-500/30 rounded p-2 mb-3">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-amber-300 font-bold tracking-wider text-[10px]">RECAP</span>
                      <span className="text-amber-300 text-[10px]">Interest: {s.recap.interest_level ?? "—"}/10 {s.recap.followup ? "· Follow-up" : ""}</span>
                    </div>
                    <div className="text-cyan-200 truncate">
                      {s.recap.contact_name || "—"}{s.recap.contact_title ? `, ${s.recap.contact_title}` : ""}
                    </div>
                    {s.recap.action_text && <div className="text-slate-300 italic mt-0.5 line-clamp-2">"{s.recap.action_text}"</div>}
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2">
                  <a
                    href={directionsUrl(s)}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid={`mobile-stop-${s.idx}-directions`}
                    className="flex items-center justify-center gap-1 py-3 rounded-lg border border-cyan-500/40 bg-cyan-500/10 text-cyan-300 text-xs font-bold tracking-wide active:bg-cyan-500/30"
                  >
                    <Navigation2 className="w-3.5 h-3.5" /> DIRS
                  </a>
                  {s.completed ? (
                    <button
                      onClick={() => undoStop(s)}
                      data-testid={`mobile-stop-${s.idx}-undo`}
                      className="flex items-center justify-center gap-1 py-3 rounded-lg border border-slate-500/40 bg-slate-500/10 text-slate-300 text-xs font-bold tracking-wide active:bg-slate-500/30"
                    >
                      UNDO
                    </button>
                  ) : (
                    <button
                      onClick={() => openVisit(s)}
                      data-testid={`mobile-stop-${s.idx}-here`}
                      className="flex items-center justify-center gap-1 py-3 rounded-lg border border-green-500/50 bg-green-500/20 text-green-200 text-xs font-bold tracking-wide active:bg-green-500/40"
                    >
                      <Check className="w-3.5 h-3.5" /> HERE
                    </button>
                  )}
                  <button
                    onClick={() => openRecap(s)}
                    data-testid={`mobile-stop-${s.idx}-recap`}
                    className={`flex items-center justify-center gap-1 py-3 rounded-lg border text-xs font-bold tracking-wide ${s.recap ? "border-amber-500/60 bg-amber-500/20 text-amber-200 active:bg-amber-500/40" : "border-amber-500/40 bg-amber-500/10 text-amber-300 active:bg-amber-500/30"}`}
                  >
                    <FileText className="w-3.5 h-3.5" /> RECAP
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Visit modal — full screen on mobile */}
      {visitModal && (
        <div className="fixed inset-0 bg-black/85 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => !visitSaving && setVisitModal(null)} data-testid="mobile-visit-modal">
          <div className="bg-[#0A1628] border-t-2 sm:border-2 border-green-500/50 rounded-t-2xl sm:rounded-2xl p-5 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-green-300" />
                <h3 className="font-orbitron text-lg text-green-300">LOG VISIT</h3>
              </div>
              <button onClick={() => setVisitModal(null)} className="text-slate-400 text-2xl leading-none">×</button>
            </div>

            <div className="text-[11px] text-cyan-400 font-bold tracking-widest">{perStop ? `${visitModal.phase} · STOP ${visitModal.stop_num}` : `${visitModal.day || "DAY"}`}</div>
            <div className="text-base text-cyan-100 leading-snug mb-4">{buildAddress(visitModal)}</div>

            <div className="mb-4 p-3 rounded-lg border border-cyan-500/20 bg-[rgba(0,12,24,0.6)]">
              <div className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5 text-cyan-400 font-bold tracking-wider">
                  <Crosshair className="w-3.5 h-3.5" /> GPS
                </div>
                <div data-testid="mobile-visit-gps-status" className={`text-[10px] tracking-wider ${
                  visitGps.status === "ok" ? "text-green-400" :
                  visitGps.status === "capturing" ? "text-amber-300" :
                  visitGps.status === "error" ? "text-red-400" : "text-slate-500"
                }`}>
                  {visitGps.status === "ok" ? "CAPTURED" : visitGps.status === "capturing" ? "CAPTURING…" : visitGps.status === "error" ? "UNAVAILABLE" : "IDLE"}
                </div>
              </div>
              {visitGps.status === "ok" && (
                <div className="text-[11px] text-cyan-200 mt-1 font-mono">
                  {visitGps.lat.toFixed(5)}, {visitGps.lng.toFixed(5)}
                  {visitGps.accuracy && <span className="text-slate-500 ml-2">±{Math.round(visitGps.accuracy)}m</span>}
                </div>
              )}
              {visitGps.status === "error" && (
                <div className="text-[11px] text-red-300 mt-1">{visitGps.error}</div>
              )}
            </div>

            <label className="text-[10px] text-cyan-400 uppercase tracking-widest font-bold">Quick note</label>
            <textarea
              value={visitNote}
              onChange={(e) => setVisitNote(e.target.value)}
              data-testid="mobile-visit-note"
              rows={4}
              maxLength={500}
              placeholder="Met with Sheriff Davis — interested in 3 AED units, follow up next week"
              className="w-full mt-1 bg-[#020617] border border-cyan-500/30 text-cyan-200 rounded-lg px-3 py-2 text-base resize-none"
            />
            <div className="text-[10px] text-slate-500 text-right mt-0.5">{visitNote.length}/500</div>

            <button
              onClick={submitVisit}
              disabled={visitSaving}
              data-testid="mobile-visit-save"
              className="w-full mt-4 py-4 rounded-lg border-2 border-green-500/60 bg-green-500/20 text-green-200 text-base font-bold tracking-wide active:bg-green-500/40 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Check className="w-5 h-5" /> {visitSaving ? "Saving…" : "SAVE & MARK COMPLETE"}
            </button>
            <button
              onClick={() => setVisitModal(null)}
              disabled={visitSaving}
              className="w-full mt-2 py-3 rounded-lg border border-slate-500/40 text-slate-400 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Recap modal — CRM-style lead capture per stop */}
      {recapModal && (
        <div className="fixed inset-0 bg-black/85 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => !recapSaving && setRecapModal(null)} data-testid="mobile-recap-modal">
          <div className="bg-[#0A1628] border-t-2 sm:border-2 border-amber-500/50 rounded-t-2xl sm:rounded-2xl p-5 w-full max-w-md max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-300" />
                <h3 className="font-orbitron text-lg text-amber-300">RECAP</h3>
              </div>
              <button onClick={() => setRecapModal(null)} className="text-slate-400 text-2xl leading-none">×</button>
            </div>

            <div className="text-[11px] text-cyan-400 font-bold tracking-widest">
              {perStop ? `${recapModal.phase} · STOP ${recapModal.stop_num}` : `${recapModal.day || "DAY"}`}
            </div>
            <div className="text-base text-cyan-100 leading-snug mb-4">{buildAddress(recapModal)}</div>

            <div className="text-[10px] text-amber-400 uppercase tracking-widest font-bold mb-2">Who did I see?</div>
            <div className="space-y-2 mb-4">
              <input
                value={recapForm.contact_name}
                onChange={(e) => setRecapForm({ ...recapForm, contact_name: e.target.value })}
                data-testid="recap-name"
                placeholder="Name"
                className="w-full bg-[#020617] border border-cyan-500/30 text-cyan-200 rounded-lg px-3 py-2.5 text-base"
              />
              <input
                value={recapForm.contact_title}
                onChange={(e) => setRecapForm({ ...recapForm, contact_title: e.target.value })}
                data-testid="recap-title"
                placeholder="Title (e.g. Sheriff, Chief, Captain)"
                className="w-full bg-[#020617] border border-cyan-500/30 text-cyan-200 rounded-lg px-3 py-2.5 text-base"
              />
              <input
                value={recapForm.contact_phone}
                onChange={(e) => setRecapForm({ ...recapForm, contact_phone: e.target.value })}
                data-testid="recap-phone"
                type="tel"
                inputMode="tel"
                placeholder="Phone #"
                className="w-full bg-[#020617] border border-cyan-500/30 text-cyan-200 rounded-lg px-3 py-2.5 text-base"
              />
              <input
                value={recapForm.contact_email}
                onChange={(e) => setRecapForm({ ...recapForm, contact_email: e.target.value })}
                data-testid="recap-email"
                type="email"
                inputMode="email"
                autoCapitalize="off"
                autoCorrect="off"
                placeholder="Email"
                className="w-full bg-[#020617] border border-cyan-500/30 text-cyan-200 rounded-lg px-3 py-2.5 text-base"
              />
            </div>

            {/* Interest level slider */}
            <div className="mb-4">
              <div className="flex items-center justify-between">
                <label className="text-[10px] text-amber-400 uppercase tracking-widest font-bold">Interest Level</label>
                <span className="text-2xl font-bold font-mono text-amber-300" data-testid="recap-interest-display">{recapForm.interest_level}<span className="text-sm text-slate-500">/10</span></span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                step="1"
                value={recapForm.interest_level}
                onChange={(e) => setRecapForm({ ...recapForm, interest_level: parseInt(e.target.value, 10) })}
                data-testid="recap-interest"
                className="w-full mt-1 accent-amber-500"
              />
              <div className="flex justify-between text-[9px] text-slate-500 mt-0.5">
                <span>Cold</span><span>Lukewarm</span><span>Hot</span>
              </div>
            </div>

            {/* Follow-up toggle */}
            <div className="mb-4">
              <label className="text-[10px] text-amber-400 uppercase tracking-widest font-bold mb-1 block">Follow-up needed?</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRecapForm({ ...recapForm, followup: true })}
                  data-testid="recap-followup-yes"
                  className={`py-3 rounded-lg border text-sm font-bold tracking-wide ${recapForm.followup ? "border-green-500/60 bg-green-500/20 text-green-200" : "border-slate-500/40 bg-slate-500/5 text-slate-400"}`}
                >YES</button>
                <button
                  type="button"
                  onClick={() => setRecapForm({ ...recapForm, followup: false })}
                  data-testid="recap-followup-no"
                  className={`py-3 rounded-lg border text-sm font-bold tracking-wide ${!recapForm.followup ? "border-cyan-500/60 bg-cyan-500/20 text-cyan-200" : "border-slate-500/40 bg-slate-500/5 text-slate-400"}`}
                >NO</button>
              </div>
            </div>

            {/* Action */}
            <label className="text-[10px] text-amber-400 uppercase tracking-widest font-bold">Action</label>
            <textarea
              value={recapForm.action_text}
              onChange={(e) => setRecapForm({ ...recapForm, action_text: e.target.value })}
              data-testid="recap-action"
              rows={4}
              maxLength={1000}
              placeholder="Send quote for 3 AED units by Friday. Schedule training in May."
              className="w-full mt-1 bg-[#020617] border border-cyan-500/30 text-cyan-200 rounded-lg px-3 py-2 text-base resize-none"
            />
            <div className="text-[10px] text-slate-500 text-right mt-0.5">{recapForm.action_text.length}/1000</div>

            <button
              onClick={submitRecap}
              disabled={recapSaving}
              data-testid="recap-save"
              className="w-full mt-4 py-4 rounded-lg border-2 border-amber-500/60 bg-amber-500/20 text-amber-200 text-base font-bold tracking-wide active:bg-amber-500/40 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Check className="w-5 h-5" /> {recapSaving ? "Saving…" : "SAVE"}
            </button>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <button
                onClick={() => setRecapModal(null)}
                disabled={recapSaving}
                className="py-3 rounded-lg border border-slate-500/40 text-slate-400 text-sm"
              >
                Cancel
              </button>
              {recapModal.recap && (
                <button
                  onClick={deleteRecap}
                  disabled={recapSaving}
                  data-testid="recap-delete"
                  className="py-3 rounded-lg border border-red-500/40 text-red-300 text-sm flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Route map modal */}
      {showMap && (
        <RouteMapModal
          stops={filteredStops}
          perStop={perStop}
          phaseFilter={phaseFilter}
          routeName={selected.name}
          onClose={() => setShowMap(false)}
        />
      )}

      {/* Fuel estimate modal */}
      {showFuel && (
        <FuelEstimateMobile
          stops={selected.stops || []}
          perStop={perStop}
          routeName={selected.name}
          onClose={() => setShowFuel(false)}
        />
      )}
    </div>
  );
}

function FuelEstimateMobile({ stops, perStop, routeName, onClose }) {
  const [mpg, setMpg] = useState(() => {
    const stored = parseFloat(localStorage.getItem("sales_fuel_mpg"));
    return Number.isFinite(stored) && stored > 0 ? stored : 20;
  });
  const [pricePerGal, setPricePerGal] = useState(() => {
    const stored = parseFloat(localStorage.getItem("sales_fuel_price"));
    return Number.isFinite(stored) && stored > 0 ? stored : 4.0;
  });

  useEffect(() => { localStorage.setItem("sales_fuel_mpg", String(mpg)); }, [mpg]);
  useEffect(() => { localStorage.setItem("sales_fuel_price", String(pricePerGal)); }, [pricePerGal]);

  const breakdown = useMemo(() => calcFuelBreakdown(stops), [stops]);
  const safeMpg = mpg > 0 ? mpg : 20;
  const totalGal = breakdown.totalMiles / safeMpg;
  const totalCost = totalGal * pricePerGal;

  const sortedPerDay = useMemo(() => {
    const geoRank = (s) => {
      const t = s.toLowerCase();
      if (t.includes("west")) return 1;
      if (t.includes("middle") || t.includes("central")) return 2;
      if (t.includes("east")) return 3;
      if (t.includes("north")) return 4;
      if (t.includes("south")) return 5;
      return 99;
    };
    return [...breakdown.perDay].sort((a, b) => {
      const na = parseFloat(a.key), nb = parseFloat(b.key);
      const aIsNum = !Number.isNaN(na), bIsNum = !Number.isNaN(nb);
      if (aIsNum && bIsNum) return na - nb;
      if (aIsNum && !bIsNum) return -1;
      if (!aIsNum && bIsNum) return 1;
      const ra = geoRank(a.key), rb = geoRank(b.key);
      if (ra !== rb) return ra - rb;
      return a.key.localeCompare(b.key);
    });
  }, [breakdown.perDay]);

  return (
    <div className="fixed inset-0 bg-black/85 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose} data-testid="mobile-fuel-modal">
      <div className="bg-[#0A1628] border-t-2 sm:border-2 border-emerald-500/50 rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-emerald-500/20">
          <div className="flex items-center gap-2">
            <Fuel className="w-5 h-5 text-emerald-300" />
            <h3 className="font-orbitron text-base text-emerald-300 tracking-wider">FUEL ESTIMATE</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 text-2xl leading-none px-2">×</button>
        </div>

        <div className="px-4 pt-3 text-[11px] text-slate-400">
          <div className="text-cyan-200 truncate">{routeName}</div>
          <div>{breakdown.dayCount} {perStop ? "phase" : "day"}{breakdown.dayCount !== 1 ? "s" : ""} · {stops.length} stops</div>
        </div>

        {/* Trip total */}
        <div className="px-4 pt-3">
          <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5">
            <div className="text-[9px] tracking-widest text-emerald-400 font-bold">TRIP TOTAL</div>
            <div className="mt-1 text-2xl font-bold text-emerald-200" data-testid="mobile-fuel-trip-miles">
              {breakdown.totalMiles.toFixed(1)} <span className="text-sm text-emerald-400">mi</span>
            </div>
            <div className="text-[12px] text-slate-300 mt-0.5">
              {totalGal.toFixed(2)} gal · <span className="text-emerald-300 font-bold">${totalCost.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Inputs */}
        <div className="grid grid-cols-2 gap-2 p-4">
          <div>
            <label className="text-[10px] text-emerald-400 uppercase tracking-widest font-bold">MPG</label>
            <input
              type="number"
              value={mpg}
              onChange={(e) => setMpg(parseFloat(e.target.value) || 0)}
              data-testid="mobile-fuel-mpg"
              inputMode="decimal"
              min="1"
              step="0.5"
              className="w-full mt-1 bg-[#020617] border border-emerald-500/30 text-emerald-200 rounded-lg px-3 py-2.5 text-base font-mono"
            />
          </div>
          <div>
            <label className="text-[10px] text-emerald-400 uppercase tracking-widest font-bold">$ / gal</label>
            <input
              type="number"
              value={pricePerGal}
              onChange={(e) => setPricePerGal(parseFloat(e.target.value) || 0)}
              data-testid="mobile-fuel-price"
              inputMode="decimal"
              min="0"
              step="0.05"
              className="w-full mt-1 bg-[#020617] border border-emerald-500/30 text-emerald-200 rounded-lg px-3 py-2.5 text-base font-mono"
            />
          </div>
        </div>

        {/* Per-day breakdown */}
        <div className="px-4 pb-4">
          <div className="text-[10px] text-emerald-400 uppercase tracking-widest font-bold mb-2">
            Per-{perStop ? "Phase" : "Day"} Breakdown
          </div>
          {sortedPerDay.length === 0 ? (
            <div className="text-slate-400 text-sm py-6 text-center">No geocoded stops to estimate.</div>
          ) : (
            <div className="space-y-1.5" data-testid="mobile-fuel-breakdown">
              {sortedPerDay.map(d => {
                const gal = d.miles / safeMpg;
                const cost = gal * pricePerGal;
                return (
                  <div key={d.key} className="grid grid-cols-12 gap-2 items-center px-2 py-2 rounded border border-emerald-500/15 bg-[rgba(0,12,24,0.5)]">
                    <div className="col-span-5 text-[12px] text-cyan-200 truncate">{d.key}</div>
                    <div className="col-span-2 text-[11px] text-slate-400 text-right">{d.stops}<span className="text-slate-500">×</span></div>
                    <div className="col-span-3 text-[12px] text-cyan-200 font-mono text-right">{d.miles.toFixed(1)}mi</div>
                    <div className="col-span-2 text-[12px] text-emerald-300 font-mono text-right">${cost.toFixed(0)}</div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-3 text-[10px] text-slate-500 leading-relaxed">
            Straight-line distance × 1.3× road factor. Excludes home-base commute.
          </div>
        </div>
      </div>
    </div>
  );
}

function RouteMapModal({ stops, perStop, phaseFilter, routeName, onClose }) {
  const ref = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const polylineRef = useRef(null);
  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: MAP_KEY });

  const points = useMemo(() => {
    return stops
      .filter(s => s.start_lat && s.start_lng)
      .map(s => ({
        lat: s.start_lat,
        lng: s.start_lng,
        idx: s.idx,
        stopNum: s.stop_num,
        phase: s.phase,
        day: s.day,
        completed: s.completed,
        recap: s.recap || null,
        label: s.office_address || s.starting_city || "",
        city: s.starting_city || "",
        state: s.state || "",
        zip: s.zip || "",
      }));
  }, [stops]);

  useEffect(() => {
    if (!isLoaded || !window.google?.maps || !ref.current) return;
    if (!mapRef.current) {
      mapRef.current = new window.google.maps.Map(ref.current, {
        zoom: 6, center: { lat: 35.86, lng: -86.66 },
        mapTypeControl: false, streetViewControl: false, fullscreenControl: false,
        zoomControl: true,
        zoomControlOptions: { position: window.google.maps.ControlPosition.RIGHT_BOTTOM },
        gestureHandling: "greedy",
        styles: [
          { elementType: "geometry", stylers: [{ color: "#1a2332" }] },
          { elementType: "labels.text.fill", stylers: [{ color: "#9ca3af" }] },
          { elementType: "labels.text.stroke", stylers: [{ color: "#0a1628" }] },
          { featureType: "water", stylers: [{ color: "#0a1628" }] },
          { featureType: "road", stylers: [{ color: "#2a3a4a" }] },
        ],
      });
    }
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];
    if (polylineRef.current) polylineRef.current.setMap(null);
    if (points.length === 0) return;

    const escapeHtml = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const bounds = new window.google.maps.LatLngBounds();
    points.forEach((p, i) => {
      const labelText = perStop ? String(p.stopNum || i + 1) : String(i + 1);
      const isGreen = !!p.recap || p.completed;
      const marker = new window.google.maps.Marker({
        position: { lat: p.lat, lng: p.lng },
        map: mapRef.current,
        label: { text: labelText, color: "#0a1628", fontWeight: "bold", fontSize: "11px" },
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 13,
          fillColor: isGreen ? "#22c55e" : "#06b6d4",
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 2,
        },
        title: perStop ? `Phase ${p.phase} · Stop ${p.stopNum}` : `Day ${p.day}`,
      });
      const headerLine = perStop
        ? `<b>Phase ${escapeHtml(p.phase || "—")} · Stop ${escapeHtml(p.stopNum || "—")}</b>`
        : `<b>Day ${escapeHtml(p.day || "—")}</b>`;
      const cityState = [p.city, p.state, p.zip].filter(Boolean).join(", ");
      let recapBlock = "";
      if (p.recap) {
        const r = p.recap;
        const rows = [];
        if (r.contact_name) rows.push(`<div><b>${escapeHtml(r.contact_name)}</b>${r.contact_title ? `, ${escapeHtml(r.contact_title)}` : ""}</div>`);
        if (r.contact_phone) rows.push(`<div><a href="tel:${escapeHtml(r.contact_phone)}" style="color:#0891b2">${escapeHtml(r.contact_phone)}</a></div>`);
        if (r.contact_email) rows.push(`<div><a href="mailto:${escapeHtml(r.contact_email)}" style="color:#0891b2">${escapeHtml(r.contact_email)}</a></div>`);
        const meta = [];
        if (r.interest_level != null) meta.push(`Interest: <b>${r.interest_level}/10</b>`);
        if (r.followup) meta.push(`<span style="color:#16a34a">Follow-up</span>`);
        if (meta.length) rows.push(`<div style="margin-top:4px">${meta.join(" · ")}</div>`);
        if (r.action_text) rows.push(`<div style="margin-top:6px;font-style:italic;color:#334155">"${escapeHtml(r.action_text)}"</div>`);
        recapBlock = `<div style="margin-top:8px;padding-top:8px;border-top:1px solid #e2e8f0">
          <div style="color:#16a34a;font-size:9px;font-weight:bold;letter-spacing:1.5px;margin-bottom:4px">RECAP</div>
          ${rows.join("")}
        </div>`;
      }
      const info = new window.google.maps.InfoWindow({
        content: `<div style="color:#0a1628;font-size:12px;max-width:260px;line-height:1.45">${headerLine}<br/>${escapeHtml(p.label)}${cityState ? `<br/><span style="color:#475569">${escapeHtml(cityState)}</span>` : ""}${recapBlock}</div>`,
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

  return (
    <div className="fixed inset-0 z-50 bg-[#040A14] flex flex-col" data-testid="mobile-route-map-modal">
      <div className="flex items-center justify-between px-4 py-3 border-b border-cyan-500/20 bg-[#040A14]/95">
        <div className="flex-1 min-w-0">
          <div className="text-base font-bold text-cyan-200 truncate">{routeName}</div>
          <div className="text-[10px] text-slate-400">
            {points.length} stop{points.length !== 1 ? "s" : ""} · {phaseFilter === "ALL" ? "All phases" : `${perStop ? "Phase" : "Day"} ${phaseFilter}`}
          </div>
        </div>
        <button
          onClick={onClose}
          data-testid="mobile-route-map-close"
          className="ml-3 px-3 py-2 rounded border border-cyan-500/40 bg-cyan-500/10 text-cyan-300 text-xs font-bold tracking-wider active:bg-cyan-500/30"
        >
          CLOSE
        </button>
      </div>
      <div className="flex-1 relative">
        {!isLoaded ? (
          <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">Loading map…</div>
        ) : points.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm px-6 text-center">No geocoded stops to map for this filter.</div>
        ) : (
          <div ref={ref} className="w-full h-full" />
        )}
      </div>
      <div className="px-4 py-2 border-t border-cyan-500/20 bg-[#040A14]/95 text-[10px] text-slate-500 flex items-center justify-center gap-4">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-cyan-500 border border-white" /> Pending</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-500 border border-white" /> Visited / Recap</span>
      </div>
    </div>
  );
}
