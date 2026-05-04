import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronRight, MapPin, Navigation2, Check, Crosshair, Phone } from "lucide-react";
import API_BASE from "../apiBase";

const API = API_BASE + "/api";

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

  // ROUTE PICKER
  if (!selected) {
    return (
      <div className="min-h-screen bg-[#040A14] text-cyan-100 px-4 py-5 font-sans">
        <div className="flex items-center justify-between mb-5">
          <button onClick={() => navigate("/hub")} data-testid="mobile-back-btn" className="flex items-center gap-1.5 text-cyan-400 text-sm">
            <ArrowLeft className="w-4 h-4" /> Hub
          </button>
          <h1 className="font-orbitron text-base font-bold tracking-widest text-cyan-300">FIELD VIEW</h1>
          <button onClick={() => navigate("/sales")} data-testid="mobile-desktop-link" className="text-[10px] text-slate-500">DESKTOP</button>
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
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => setSelected(null)} data-testid="mobile-route-back" className="flex items-center gap-1.5 text-cyan-400 text-sm">
            <ArrowLeft className="w-4 h-4" /> Routes
          </button>
          <div className="text-[10px] text-slate-500">{completed}/{filteredStops.length} done</div>
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
                className={`p-4 rounded-xl border-2 ${s.completed ? "border-green-500/50 bg-green-500/5" : "border-cyan-500/30 bg-[rgba(0,18,32,0.93)]"}`}
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

                <div className="grid grid-cols-2 gap-2">
                  <a
                    href={directionsUrl(s)}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid={`mobile-stop-${s.idx}-directions`}
                    className="flex items-center justify-center gap-2 py-3 rounded-lg border border-cyan-500/40 bg-cyan-500/10 text-cyan-300 text-sm font-bold tracking-wide active:bg-cyan-500/30"
                  >
                    <Navigation2 className="w-4 h-4" /> DIRECTIONS
                  </a>
                  {s.completed ? (
                    <button
                      onClick={() => undoStop(s)}
                      data-testid={`mobile-stop-${s.idx}-undo`}
                      className="flex items-center justify-center gap-2 py-3 rounded-lg border border-slate-500/40 bg-slate-500/10 text-slate-300 text-sm font-bold tracking-wide active:bg-slate-500/30"
                    >
                      UNDO
                    </button>
                  ) : (
                    <button
                      onClick={() => openVisit(s)}
                      data-testid={`mobile-stop-${s.idx}-here`}
                      className="flex items-center justify-center gap-2 py-3 rounded-lg border border-green-500/50 bg-green-500/20 text-green-200 text-sm font-bold tracking-wide active:bg-green-500/40"
                    >
                      <Check className="w-4 h-4" /> I'M HERE
                    </button>
                  )}
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
    </div>
  );
}
