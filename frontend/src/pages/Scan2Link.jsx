import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Camera, Loader2, Send, Check, X, ScanLine, MapPin, Plus } from "lucide-react";
import API_BASE from "@/apiBase";

const API = `${API_BASE}/api`;

function ScannerModal({ open, onDetected, onClose, hint }) {
  const divId = useRef(`qr-reader-${Math.random().toString(36).slice(2)}`);
  const scannerRef = useRef(null);
  // Stable ref so useEffect doesn't restart the camera every parent re-render.
  const onDetectedRef = useRef(onDetected);
  useEffect(() => { onDetectedRef.current = onDetected; }, [onDetected]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let started = false;

    const cleanup = () => {
      const s = scannerRef.current;
      scannerRef.current = null;
      if (!s) return;
      // Only call stop() if we successfully started; guard against double-stop.
      try {
        if (started) {
          s.stop().then(() => { try { s.clear(); } catch { /* ignore */ } }).catch(() => {});
        } else {
          try { s.clear(); } catch { /* ignore */ }
        }
      } catch { /* ignore */ }
    };

    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;
        const scanner = new Html5Qrcode(divId.current);
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 260, height: 160 } },
          (decoded) => {
            // Fire the callback ONCE — parent's onClose will set open=false and
            // this effect's cleanup will stop the camera. Don't stop here.
            if (!scannerRef.current) return;
            const cb = onDetectedRef.current;
            scannerRef.current = null; // block further hits
            try { cb && cb(decoded); } catch { /* ignore */ }
          },
          () => {}
        );
        started = true;
        if (cancelled) cleanup();
      } catch (e) {
        console.error("camera start failed:", e);
      }
    })();

    return cleanup;
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] bg-black/95 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-cyan-500/40 rounded-sm w-full max-w-[440px]" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-cyan-500/20 flex items-center justify-between">
          <div className="font-orbitron text-cyan-400 text-xs tracking-widest">{hint}</div>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div id={divId.current} className="bg-black" />
        <div className="px-4 py-2 text-[10px] text-slate-500 text-center">Point at the code. Auto-closes on scan.</div>
      </div>
    </div>
  );
}

export default function Scan2Link() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token") || "";
  const [imei, setImei] = useState("");
  const [serial, setSerial] = useState("");
  const [aedInfo, setAedInfo] = useState(null);
  const [looking, setLooking] = useState(false);
  const [gpLocs, setGpLocs] = useState([]);
  const [gpChoice, setGpChoice] = useState("");
  const [gpFree, setGpFree] = useState("");
  const [scannerFor, setScannerFor] = useState(null); // "imei" | "serial"
  const [sending, setSending] = useState(false);
  const [flash, setFlash] = useState("");
  const [err, setErr] = useState("");
  // Inline "add new GA Power location" form
  const [showNewLoc, setShowNewLoc] = useState(false);
  const [newAddr, setNewAddr] = useState("");
  const [newCity, setNewCity] = useState("");
  const [newZip, setNewZip] = useState("");
  const [savingLoc, setSavingLoc] = useState(false);

  useEffect(() => {
    fetch(`${API}/scan2link/gp-locations`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : { locations: [] })
      .then(d => setGpLocs(d.locations || []))
      .catch(() => {});
  }, [token]);

  const reloadGpLocs = async () => {
    try {
      const r = await fetch(`${API}/scan2link/gp-locations`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      setGpLocs(d.locations || []);
    } catch { /* ignore */ }
  };

  const saveNewLocation = async () => {
    if (!newAddr.trim() || !newCity.trim()) { setErr("Address and City are required."); return; }
    setSavingLoc(true); setErr("");
    try {
      const r = await fetch(`${API}/scan2link/gp-locations`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ address: newAddr.trim(), city: newCity.trim(), zip: newZip.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || "Save failed");
      await reloadGpLocs();
      if (d.location?.label) setGpChoice(d.location.label);
      setShowNewLoc(false);
      setNewAddr(""); setNewCity(""); setNewZip("");
      setFlash(d.duplicate ? "Location already exists — selected ✓" : "New GA Power location added ✓");
      setTimeout(() => setFlash(""), 3000);
    } catch (e) { setErr(e.message || "Save failed"); }
    setSavingLoc(false);
  };

  const doLookup = async (s) => {
    if (!s?.trim()) { setAedInfo(null); return; }
    setLooking(true); setErr("");
    try {
      const r = await fetch(`${API}/scan2link/lookup?serial=${encodeURIComponent(s.trim())}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      setAedInfo(d);
    } catch (e) { setErr(e.message || "Lookup failed"); }
    setLooking(false);
  };

  const send = async () => {
    if (!imei.trim() || !serial.trim()) { setErr("Both Tracker ID and AED SN are required."); return; }
    setSending(true); setErr("");
    const chosenLoc = gpChoice ? gpLocs.find(l => l.label === gpChoice) : null;
    const body = {
      tracker_imei: imei.trim(),
      aed_serial: serial.trim(),
      subscriber: aedInfo?.found ? aedInfo.subscriber : (gpChoice ? "Georgia Power" : ""),
      model: aedInfo?.model || "",
      site: chosenLoc?.site || aedInfo?.site || "",
      building: chosenLoc?.building || aedInfo?.building || "",
      placement: gpFree.trim() || aedInfo?.placement || "",
    };
    try {
      const r = await fetch(`${API}/scan2link/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(await r.text());
      setFlash(`Linked ✓ ${imei.trim()} → ${serial.trim()}`);
      setTimeout(() => setFlash(""), 3000);
      // Reset for next AED
      setImei(""); setSerial(""); setAedInfo(null); setGpChoice(""); setGpFree("");
    } catch (e) { setErr(e.message || "Send failed"); }
    setSending(false);
  };

  const isGaPower = aedInfo?.found && aedInfo?.subscriber === "Georgia Power";

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200">
      <div className="sticky top-0 z-30 bg-[rgba(2,6,23,0.95)] border-b border-cyan-500/20 backdrop-blur">
        <div className="max-w-[720px] mx-auto flex items-center justify-between px-4 py-3">
          <button onClick={() => navigate("/hub")} className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5" data-testid="back-to-hub">
            <ArrowLeft className="w-4 h-4" /><span className="font-orbitron text-[11px] tracking-widest">HUB</span>
          </button>
          <div>
            <div className="font-orbitron text-cyan-400 text-sm tracking-widest">SCAN2LINK</div>
            <div className="text-[10px] text-slate-500 tracking-wider text-right">TRACKER ↔ AED</div>
          </div>
        </div>
      </div>

      <div className="max-w-[720px] mx-auto px-4 py-4 space-y-4">
        {flash && <div className="px-3 py-2 rounded-sm border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-[12px] font-orbitron tracking-wider flex items-center gap-2"><Check className="w-4 h-4" /> {flash}</div>}
        {err && <div className="px-3 py-2 rounded-sm border border-red-500/40 bg-red-500/10 text-red-300 text-[12px] font-mono flex items-start justify-between gap-3"><div className="break-words">{err}</div><button onClick={() => setErr("")} className="text-red-400 shrink-0">×</button></div>}

        {/* Step 1 — Tracker IMEI */}
        <div className="border border-cyan-500/30 bg-[#0a0f1c] rounded-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="font-orbitron text-[10px] tracking-widest text-cyan-400 bg-cyan-500/10 border border-cyan-500/40 px-2 py-0.5 rounded-sm">STEP 1</span>
            <div className="font-orbitron text-cyan-300 text-sm tracking-widest">TRACKER ID</div>
          </div>
          <div className="flex gap-2">
            <input value={imei} onChange={e => setImei(e.target.value)} placeholder="Scan or type Tracker ID" className="flex-1 bg-slate-900/60 border border-slate-700 rounded-sm px-3 py-2 text-[13px] font-mono text-slate-200" data-testid="imei-input" />
            <button onClick={() => setScannerFor("imei")} className="px-3 py-2 border border-cyan-500/50 text-cyan-300 hover:bg-cyan-500/10 rounded-sm flex items-center gap-1" data-testid="scan-imei-btn">
              <Camera className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Step 2 — AED Serial */}
        <div className="border border-cyan-500/30 bg-[#0a0f1c] rounded-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="font-orbitron text-[10px] tracking-widest text-cyan-400 bg-cyan-500/10 border border-cyan-500/40 px-2 py-0.5 rounded-sm">STEP 2</span>
            <div className="font-orbitron text-cyan-300 text-sm tracking-widest">AED SN</div>
          </div>
          <div className="flex gap-2">
            <input value={serial} onChange={e => setSerial(e.target.value)} onBlur={e => doLookup(e.target.value)} placeholder="Scan or type AED SN" className="flex-1 bg-slate-900/60 border border-slate-700 rounded-sm px-3 py-2 text-[13px] font-mono text-slate-200" data-testid="serial-input" />
            <button onClick={() => setScannerFor("serial")} className="px-3 py-2 border border-cyan-500/50 text-cyan-300 hover:bg-cyan-500/10 rounded-sm flex items-center gap-1" data-testid="scan-serial-btn">
              <Camera className="w-4 h-4" />
            </button>
            <button onClick={() => doLookup(serial)} disabled={looking || !serial.trim()} className="px-3 py-2 border border-slate-600 text-slate-300 hover:bg-slate-800 rounded-sm text-[11px] font-orbitron tracking-widest disabled:opacity-40" data-testid="lookup-btn">
              {looking ? <Loader2 className="w-4 h-4 animate-spin" /> : "LOOKUP"}
            </button>
          </div>
          {aedInfo && (
            <div className={`mt-3 border rounded-sm p-3 ${aedInfo.found ? "border-emerald-500/40 bg-emerald-500/5" : "border-amber-500/40 bg-amber-500/5"}`}>
              {aedInfo.found ? (
                <>
                  <div className="text-[10px] font-orbitron tracking-widest text-emerald-300 mb-1 flex items-center gap-1"><Check className="w-3 h-3" /> AED FOUND</div>
                  <div className="text-[12px] font-mono text-slate-200 space-y-0.5">
                    <div><span className="text-slate-500">Subscriber:</span> {aedInfo.subscriber}</div>
                    <div><span className="text-slate-500">Model:</span> {aedInfo.model || "—"}</div>
                    <div><span className="text-slate-500">Location:</span> {[aedInfo.site, aedInfo.building, aedInfo.placement].filter(Boolean).join(" / ") || "—"}</div>
                    <div><span className="text-slate-500">Status:</span> {aedInfo.detailed_status || aedInfo.status || "—"}</div>
                  </div>
                </>
              ) : (
                <div className="text-[11px] text-amber-300 font-orbitron tracking-wider">Not found — you can still SEND (link will save without subscriber/model).</div>
              )}
            </div>
          )}
        </div>

        {/* Step 3 — GA Power location (optional; only shown when GA Power detected or user wants to enter) */}
        {(isGaPower || (!aedInfo?.found && serial)) && (
          <div className="border border-cyan-500/30 bg-[#0a0f1c] rounded-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="font-orbitron text-[10px] tracking-widest text-cyan-400 bg-cyan-500/10 border border-cyan-500/40 px-2 py-0.5 rounded-sm">STEP 3</span>
              <MapPin className="w-4 h-4 text-cyan-400" />
              <div className="font-orbitron text-cyan-300 text-sm tracking-widest">GA POWER LOCATION (OPTIONAL)</div>
            </div>
            <div className="flex gap-2 mb-2">
              <select
                value={gpChoice}
                onChange={e => setGpChoice(e.target.value)}
                disabled={showNewLoc}
                className="flex-1 bg-slate-900/60 border border-slate-700 rounded-sm px-3 py-2 text-[13px] font-mono text-slate-200 disabled:opacity-50"
                data-testid="gp-location-select"
              >
                <option value="">-- pick a location --</option>
                {gpLocs.map(l => <option key={l.label} value={l.label}>{l.label}</option>)}
              </select>
              <button
                type="button"
                onClick={() => { setShowNewLoc(v => !v); setGpChoice(""); }}
                data-testid="gp-new-location-btn"
                className={`px-3 py-2 rounded-sm text-[11px] font-orbitron tracking-widest flex items-center gap-1 border ${showNewLoc ? "border-red-500/50 text-red-300 bg-red-500/10 hover:bg-red-500/20" : "border-cyan-500/50 text-cyan-300 hover:bg-cyan-500/10"}`}
              >
                {showNewLoc ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                {showNewLoc ? "CANCEL" : "NEW"}
              </button>
            </div>

            {showNewLoc && (
              <div className="border border-cyan-500/30 bg-slate-950/60 rounded-sm p-3 mb-2 space-y-2" data-testid="gp-new-location-form">
                <div className="font-orbitron text-[10px] tracking-widest text-cyan-300 mb-1">ADD NEW GA POWER LOCATION</div>
                <div>
                  <label className="block text-[9px] font-orbitron tracking-widest text-slate-500 mb-0.5">ADDRESS</label>
                  <input
                    value={newAddr}
                    onChange={e => setNewAddr(e.target.value)}
                    placeholder="e.g. 101 GA Power Rd"
                    className="w-full bg-slate-900/60 border border-slate-700 rounded-sm px-3 py-2 text-[13px] font-mono text-slate-200"
                    data-testid="gp-new-address"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9px] font-orbitron tracking-widest text-slate-500 mb-0.5">CITY</label>
                    <input
                      value={newCity}
                      onChange={e => setNewCity(e.target.value)}
                      placeholder="e.g. Albany"
                      className="w-full bg-slate-900/60 border border-slate-700 rounded-sm px-3 py-2 text-[13px] font-mono text-slate-200"
                      data-testid="gp-new-city"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-orbitron tracking-widest text-slate-500 mb-0.5">ZIP CODE</label>
                    <input
                      value={newZip}
                      onChange={e => setNewZip(e.target.value.replace(/[^0-9-]/g, ""))}
                      placeholder="e.g. 31705"
                      inputMode="numeric"
                      className="w-full bg-slate-900/60 border border-slate-700 rounded-sm px-3 py-2 text-[13px] font-mono text-slate-200"
                      data-testid="gp-new-zip"
                    />
                  </div>
                </div>
                <button
                  onClick={saveNewLocation}
                  disabled={savingLoc || !newAddr.trim() || !newCity.trim()}
                  data-testid="gp-new-save-btn"
                  className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-orbitron tracking-widest text-[11px] rounded-sm flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  {savingLoc ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  SAVE LOCATION
                </button>
              </div>
            )}

            <input
              value={gpFree}
              onChange={e => setGpFree(e.target.value)}
              placeholder="Or type placement details (e.g., 'Lobby wall by front desk')"
              className="w-full bg-slate-900/60 border border-slate-700 rounded-sm px-3 py-2 text-[12px] font-mono text-slate-200"
              data-testid="gp-freetext"
            />
          </div>
        )}

        {/* SEND */}
        <button onClick={send} disabled={sending || !imei.trim() || !serial.trim()} className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-orbitron tracking-widest text-sm rounded-sm flex items-center justify-center gap-2 disabled:opacity-40" data-testid="send-link-btn">
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} SEND
        </button>

        <div className="text-[10px] text-slate-500 text-center pt-2 flex items-center justify-center gap-1">
          <ScanLine className="w-3 h-3" /> Tip: cameras need HTTPS + browser permission
        </div>
      </div>

      <ScannerModal
        open={!!scannerFor}
        hint={scannerFor === "imei" ? "SCAN TRACKER QR (ID)" : "SCAN AED SN BARCODE"}
        onClose={() => setScannerFor(null)}
        onDetected={(v) => {
          if (scannerFor === "imei") setImei(v);
          else { setSerial(v); doLookup(v); }
          setScannerFor(null);
        }}
      />
    </div>
  );
}
