import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import {
  ArrowLeft, Upload, Loader2, Search, Save, FileText,
  Trash2, Eye, Send, AlertTriangle, Check, Clock,
} from "lucide-react";
import API_BASE from "@/apiBase";

const API = `${API_BASE}/api`;
const THRESHOLDS = ["90", "60", "30"];

const PLACEHOLDER_HELP = [
  { key: "{{subscriber_name}}", note: "The subscriber (e.g. Georgia Power)" },
  { key: "{{contact_name}}", note: "Primary contact's first name" },
  { key: "{{aed_table}}", note: "Table of AEDs that just crossed this threshold" },
  { key: "{{aed_list}}", note: "Same data as a bullet list" },
  { key: "{{today_date}}", note: "Today's date (Eastern Time)" },
  { key: "{{cs_signature}}", note: "Cardiac Solutions email signature" },
];

function AutomationTabs({ location }) {
  const on = (p) => location.pathname === p;
  const tab = (to, label) => (
    <Link
      to={to}
      className={`text-[10px] font-orbitron tracking-widest px-3 py-1.5 rounded-sm border transition ${
        on(to)
          ? "bg-cyan-500/20 border-cyan-500/60 text-cyan-200"
          : "border-slate-700 text-slate-400 hover:text-cyan-300 hover:border-cyan-500/40"
      }`}
      data-testid={`tab-${to.replace(/\W+/g, "_")}`}
    >
      {label}
    </Link>
  );
  return (
    <div className="flex items-center gap-2">
      {tab("/admin/expired-bp-automation", "EXPIRED B/P")}
      {tab("/admin/expiring-bp-automation", "EXPIRING B/P")}
    </div>
  );
}

export default function ExpiringBpAutomation() {
  const navigate = useNavigate();
  const location = useLocation();
  const token = localStorage.getItem("token") || "";
  const fileInputRefs = { 90: useRef(null), 60: useRef(null), 30: useRef(null) };

  // Three templates
  const [templates, setTemplates] = useState({ 90: null, 60: null, 30: null });
  const [subjects, setSubjects] = useState({ 90: "AED Batteries / Pads Expiring in 90 Days", 60: "AED Batteries / Pads Expiring in 60 Days", 30: "AED Batteries / Pads Expiring in 30 Days" });
  const [uploading, setUploading] = useState({ 90: false, 60: false, 30: false });

  // Test mode (separate from Expired B/P)
  const [testMode, setTestMode] = useState({ enabled: false, to: "", cc: "" });
  const [testModeSaving, setTestModeSaving] = useState(false);
  const [testModeDirty, setTestModeDirty] = useState(false);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [savingRow, setSavingRow] = useState(null);
  const [runningRow, setRunningRow] = useState(null); // {sub, thr}
  const [runConfirm, setRunConfirm] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(null);
  const [flash, setFlash] = useState("");
  const [err, setErr] = useState("");

  const showFlash = (msg) => { setFlash(msg); setTimeout(() => setFlash(""), 2500); };

  const loadAllTemplates = async () => {
    const results = await Promise.all(THRESHOLDS.map(t =>
      fetch(`${API}/admin/expiring-bp/template?threshold=${t}`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : { exists: false })
        .catch(() => ({ exists: false }))
    ));
    const tmap = {}; const smap = { ...subjects };
    THRESHOLDS.forEach((t, i) => {
      tmap[t] = results[i].exists ? results[i] : null;
      if (results[i].exists && results[i].subject) smap[t] = results[i].subject;
    });
    setTemplates(tmap);
    setSubjects(smap);
  };

  const loadTestMode = async () => {
    try {
      const r = await fetch(`${API}/admin/expiring-bp/test-mode`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) {
        const d = await r.json();
        setTestMode({ enabled: !!d.enabled, to: d.to || "", cc: d.cc || "" });
        setTestModeDirty(false);
      }
    } catch { /* ignore */ }
  };

  const loadSettings = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/admin/expiring-bp/settings`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setItems(d.items || []);
    } catch (e) { setErr(e.message || "Failed to load subscribers"); }
    setLoading(false);
  };

  useEffect(() => { loadAllTemplates(); loadTestMode(); loadSettings(); }, []);

  const uploadTpl = async (thr, file) => {
    setUploading(u => ({ ...u, [thr]: true })); setErr("");
    try {
      const fd = new FormData();
      fd.append("threshold", thr);
      fd.append("file", file);
      fd.append("subject", subjects[thr] || "");
      const r = await fetch(`${API}/admin/expiring-bp/template`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
      if (!r.ok) throw new Error(await r.text());
      await loadAllTemplates();
      showFlash(`${thr}-day template uploaded`);
    } catch (e) { setErr(e.message || "Upload failed"); }
    setUploading(u => ({ ...u, [thr]: false }));
    if (fileInputRefs[thr].current) fileInputRefs[thr].current.value = "";
  };

  const saveSubject = async (thr) => {
    const tpl = templates[thr];
    if (!tpl) return;
    setUploading(u => ({ ...u, [thr]: true }));
    try {
      const blob = new Blob([tpl.text_content || ""], { type: "text/plain" });
      const fd = new FormData();
      fd.append("threshold", thr);
      fd.append("file", blob, tpl.filename || "template.txt");
      fd.append("subject", subjects[thr] || "");
      const r = await fetch(`${API}/admin/expiring-bp/template`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
      if (!r.ok) throw new Error(await r.text());
      await loadAllTemplates();
      showFlash(`${thr}-day subject saved`);
    } catch (e) { setErr(e.message || "Save failed"); }
    setUploading(u => ({ ...u, [thr]: false }));
  };

  const deleteTpl = async (thr) => {
    if (!window.confirm(`Delete the ${thr}-day template? Sends for that threshold will stop until you re-upload.`)) return;
    try {
      const r = await fetch(`${API}/admin/expiring-bp/template?threshold=${thr}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error(await r.text());
      setTemplates(t => ({ ...t, [thr]: null }));
      showFlash(`${thr}-day template deleted`);
    } catch (e) { setErr(e.message || "Delete failed"); }
  };

  const saveTestMode = async () => {
    if (testMode.enabled && !testMode.to.trim()) { setErr("Enter a TO address before enabling Test Mode."); return; }
    setTestModeSaving(true);
    try {
      const r = await fetch(`${API}/admin/expiring-bp/test-mode`, {
        method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(testMode),
      });
      if (!r.ok) throw new Error(await r.text());
      const d = await r.json();
      setTestMode({ enabled: !!d.enabled, to: d.to || "", cc: d.cc || "" });
      setTestModeDirty(false);
      showFlash(d.enabled ? "Test Mode enabled" : "Test Mode disabled");
    } catch (e) { setErr(e.message || "Save failed"); }
    setTestModeSaving(false);
  };

  const toggleThreshold = async (row, thr) => {
    const current = new Set(row.enabled_thresholds || []);
    if (current.has(thr)) current.delete(thr); else current.add(thr);
    const next = Array.from(current).sort((a, b) => Number(b) - Number(a));
    setSavingRow(row.subscriber);
    try {
      const r = await fetch(`${API}/admin/expiring-bp/settings/${encodeURIComponent(row.subscriber)}`, {
        method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ enabled_thresholds: next }),
      });
      if (!r.ok) throw new Error(await r.text());
      const d = await r.json();
      setItems(prev => prev.map(x => x.subscriber === row.subscriber ? d.settings : x));
    } catch (e) { setErr(e.message || "Save failed"); }
    setSavingRow(null);
  };

  const askRunNow = (row, thr) => {
    if (!templates[thr]) { setErr(`Upload the ${thr}-day template first`); return; }
    setRunConfirm({ row, thr });
  };

  const doRunNow = async ({ row, thr }) => {
    setRunConfirm(null);
    setRunningRow({ sub: row.subscriber, thr });
    setErr("");
    try {
      const r = await fetch(`${API}/admin/expiring-bp/run-now/${encodeURIComponent(row.subscriber)}?threshold=${thr}`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` },
      });
      const bodyText = await r.text();
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${bodyText.slice(0, 300)}`);
      let d;
      try { d = JSON.parse(bodyText); } catch { throw new Error(`Non-JSON response: ${bodyText.slice(0, 200)}`); }
      const res = d.result || {};
      if (res.skipped) {
        showFlash(`Skipped ${thr}d: ${res.reason} (today=${res.todays_count ?? "?"})`);
      } else {
        const grp = res.groups?.[0] || {};
        const dest = grp.test_mode ? `${grp.to} [TEST MODE, intended ${grp.intended_to}]` : (grp.to || "?");
        showFlash(`Sent ${res.groups?.length || 0} email(s) at ${thr}d — ${res.aed_count} AED(s) → ${dest}`);
      }
      await loadSettings();
    } catch (e) { setErr(e.message || "Run failed"); }
    setRunningRow(null);
  };

  const openPreview = async (row, thr) => {
    if (!templates[thr]) { setErr(`Upload the ${thr}-day template first`); return; }
    try {
      const r = await fetch(`${API}/admin/expiring-bp/preview/${encodeURIComponent(row.subscriber)}?threshold=${thr}`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error(await r.text());
      const d = await r.json();
      setPreviewOpen({ subscriber: row.subscriber, threshold: thr, data: d });
    } catch (e) { setErr(e.message || "Preview failed"); }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(x => x.subscriber.toLowerCase().includes(q));
  }, [items, search]);

  const enabledCount = items.filter(x => (x.enabled_thresholds || []).length > 0).length;

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200">
      <div className="sticky top-0 z-30 bg-[rgba(2,6,23,0.95)] border-b border-cyan-500/20 backdrop-blur">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/hub")} className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5" data-testid="back-to-hub">
              <ArrowLeft className="w-4 h-4" />
              <span className="font-orbitron text-[11px] tracking-widest">HUB</span>
            </button>
            <div>
              <div className="font-orbitron text-cyan-400 text-sm tracking-widest">EXPIRING B/P NOTIFICATIONS</div>
              <div className="text-[10px] text-slate-500 tracking-wider">90 / 60 / 30-DAY THRESHOLDS — PER-SUBSCRIBER AUTOMATION</div>
            </div>
            <div className="ml-4"><AutomationTabs location={location} /></div>
          </div>
          <div className="flex items-center gap-3 text-[10px] font-orbitron tracking-wider">
            <span className="text-slate-500">TEMPLATES:</span>
            {THRESHOLDS.map(t => (
              <span key={t} className={templates[t] ? "text-emerald-400" : "text-amber-400"}>{t}d{templates[t] ? "✓" : "✗"}</span>
            ))}
            <span className="text-slate-600">·</span>
            <span className="text-slate-500">ACTIVE:</span>
            <span className="text-cyan-300">{enabledCount}/{items.length}</span>
            {testMode.enabled && (<><span className="text-slate-600">·</span><span className="text-amber-200 bg-amber-500/20 border border-amber-500/50 px-1.5 py-0.5 rounded-sm">TEST MODE</span></>)}
          </div>
        </div>
      </div>

      {(flash || err) && (
        <div className="max-w-[1400px] mx-auto px-6 pt-3">
          {flash && <div className="mb-2 px-3 py-2 rounded-sm border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-[11px] font-orbitron tracking-wider flex items-center gap-2"><Check className="w-3.5 h-3.5" /> {flash}</div>}
          {err && <div className="mb-2 px-3 py-2 rounded-sm border border-red-500/40 bg-red-500/10 text-red-300 text-[11px] font-mono flex items-start justify-between gap-3"><div className="break-words">{err}</div><button onClick={() => setErr("")} className="text-red-400 hover:text-red-200 shrink-0">×</button></div>}
        </div>
      )}

      <div className="max-w-[1400px] mx-auto px-6 py-4 space-y-4">
        {/* 3 template cards side-by-side */}
        <div className="grid md:grid-cols-3 gap-3">
          {THRESHOLDS.map(thr => {
            const tpl = templates[thr];
            return (
              <div key={thr} className="border border-cyan-500/30 bg-[#0a0f1c] rounded-sm p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-cyan-400" />
                    <div className="font-orbitron text-cyan-400 text-xs tracking-widest">{thr}-DAY TEMPLATE</div>
                  </div>
                  {tpl && (
                    <button onClick={() => deleteTpl(thr)} className="text-[9px] font-orbitron tracking-widest px-1.5 py-0.5 border border-red-500/40 text-red-300 hover:bg-red-500/10 rounded-sm flex items-center gap-1" data-testid={`delete-tpl-${thr}`}>
                      <Trash2 className="w-3 h-3" /> DEL
                    </button>
                  )}
                </div>
                {tpl ? (
                  <div className="border border-slate-700 rounded-sm px-2 py-1.5 text-[11px] font-mono text-slate-300 flex items-center justify-between gap-2 mb-2">
                    <span className="truncate">{tpl.filename}</span>
                    <span className="text-slate-500 text-[10px] whitespace-nowrap">{Math.round((tpl.size_bytes || 0) / 1024)} KB</span>
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-500 italic mb-2">No template uploaded</div>
                )}
                <input ref={fileInputRefs[thr]} type="file" accept=".docx,.doc,.html,.htm,.txt,.md" onChange={e => { const f = e.target.files?.[0]; if (f) uploadTpl(thr, f); }} className="hidden" data-testid={`file-input-${thr}`} />
                <button onClick={() => fileInputRefs[thr].current?.click()} disabled={uploading[thr]} className="text-[10px] font-orbitron tracking-widest px-3 py-1.5 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10 rounded-sm flex items-center gap-2 disabled:opacity-50" data-testid={`upload-${thr}`}>
                  {uploading[thr] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                  {tpl ? "REPLACE" : "UPLOAD"}
                </button>
                <div className="mt-3">
                  <div className="text-[10px] font-orbitron text-slate-500 tracking-widest mb-1">SUBJECT</div>
                  <div className="flex gap-1">
                    <input value={subjects[thr]} onChange={e => setSubjects(s => ({ ...s, [thr]: e.target.value }))} className="flex-1 bg-slate-900/40 border border-slate-700 rounded-sm px-2 py-1 text-[11px] font-mono text-slate-200" data-testid={`subject-${thr}`} />
                    <button onClick={() => saveSubject(thr)} disabled={!tpl || uploading[thr]} className="text-[10px] font-orbitron tracking-widest px-2 py-1 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10 rounded-sm flex items-center gap-1 disabled:opacity-30" data-testid={`save-subject-${thr}`}>
                      <Save className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Placeholder cheatsheet */}
        <div className="border border-slate-800 bg-[#0a0f1c] rounded-sm p-3">
          <div className="text-[10px] font-orbitron text-slate-500 tracking-widest mb-1">SUPPORTED PLACEHOLDERS (all 3 templates)</div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
            {PLACEHOLDER_HELP.map(p => (
              <div key={p.key} className="flex items-baseline gap-1"><code className="text-cyan-300 font-mono text-[10px]">{p.key}</code><span className="text-slate-500 text-[10px]">— {p.note}</span></div>
            ))}
          </div>
        </div>

        {/* Test Mode */}
        <div className={`border rounded-sm p-4 ${testMode.enabled ? "border-amber-500/60 bg-amber-500/5" : "border-slate-700 bg-[#0a0f1c]"}`} data-testid="test-mode-card">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className={`w-4 h-4 ${testMode.enabled ? "text-amber-400" : "text-slate-500"}`} />
              <div className={`font-orbitron text-xs tracking-widest ${testMode.enabled ? "text-amber-300" : "text-slate-400"}`}>TEST MODE (EXPIRING B/P — separate from Expired B/P)</div>
              {testMode.enabled && <span className="font-orbitron text-[9px] tracking-widest text-amber-200 bg-amber-500/20 border border-amber-500/50 px-1.5 py-0.5 rounded-sm">ACTIVE</span>}
            </div>
            <button onClick={() => { setTestMode(m => ({ ...m, enabled: !m.enabled })); setTestModeDirty(true); }} className={`relative inline-flex h-5 w-10 items-center rounded-full transition ${testMode.enabled ? "bg-amber-500" : "bg-slate-700"}`} data-testid="test-mode-toggle">
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${testMode.enabled ? "translate-x-5" : "translate-x-1"}`} />
            </button>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <div className="text-[10px] font-orbitron text-slate-500 tracking-widest mb-1">TEST TO (required to enable)</div>
              <input value={testMode.to} onChange={e => { setTestMode(m => ({ ...m, to: e.target.value })); setTestModeDirty(true); }} placeholder="you@example.com" className="w-full bg-slate-900/40 border border-slate-700 rounded-sm px-2 py-1.5 text-[12px] font-mono text-slate-200" data-testid="test-to-input" />
            </div>
            <div>
              <div className="text-[10px] font-orbitron text-slate-500 tracking-widest mb-1">TEST CC (optional)</div>
              <input value={testMode.cc} onChange={e => { setTestMode(m => ({ ...m, cc: e.target.value })); setTestModeDirty(true); }} placeholder="teammate@example.com" className="w-full bg-slate-900/40 border border-slate-700 rounded-sm px-2 py-1.5 text-[12px] font-mono text-slate-200" data-testid="test-cc-input" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button onClick={saveTestMode} disabled={testModeSaving || !testModeDirty} className="text-[10px] font-orbitron tracking-widest px-3 py-1.5 border border-amber-500/50 text-amber-300 hover:bg-amber-500/10 rounded-sm flex items-center gap-1 disabled:opacity-30" data-testid="save-test-mode">
              {testModeSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} SAVE
            </button>
            {!testModeDirty && !testModeSaving && <span className="text-[10px] text-slate-500 font-orbitron tracking-wider">saved</span>}
          </div>
        </div>

        {/* Subscriber table */}
        <div className="border border-cyan-500/30 bg-[#0a0f1c] rounded-sm p-4">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              <div className="font-orbitron text-cyan-400 text-xs tracking-widest">PER-SUBSCRIBER THRESHOLDS</div>
              <span className="text-[10px] text-slate-500">(send time is set on the Expired B/P tab)</span>
            </div>
            <div className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-slate-500" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter…" className="bg-slate-900/40 border border-slate-700 rounded-sm px-2 py-1 text-[11px] font-mono text-slate-200 w-56" data-testid="filter-subs" />
            </div>
          </div>
          {loading ? (
            <div className="text-slate-500 text-[11px] p-6 text-center">Loading…</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-slate-800 text-left">
                    <th className="py-2 px-2 font-orbitron text-[9px] text-slate-500 tracking-widest">SUBSCRIBER</th>
                    {THRESHOLDS.map(t => <th key={t} className="py-2 px-2 font-orbitron text-[9px] text-slate-500 tracking-widest w-20 text-center">{t}-DAY</th>)}
                    <th className="py-2 px-2 font-orbitron text-[9px] text-slate-500 tracking-widest">LAST SENT</th>
                    <th className="py-2 px-2 font-orbitron text-[9px] text-slate-500 tracking-widest w-72">ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(row => {
                    const en = new Set(row.enabled_thresholds || []);
                    const running = runningRow && runningRow.sub === row.subscriber;
                    return (
                      <tr key={row.subscriber} className="border-b border-slate-900 hover:bg-slate-900/30" data-testid={`row-${row.subscriber}`}>
                        <td className="py-2 px-2 font-mono text-slate-200">{row.subscriber}</td>
                        {THRESHOLDS.map(thr => (
                          <td key={thr} className="py-2 px-2 text-center">
                            <button onClick={() => toggleThreshold(row, thr)} disabled={savingRow === row.subscriber} className={`relative inline-flex h-5 w-10 items-center rounded-full transition ${en.has(thr) ? "bg-emerald-500" : "bg-slate-700"} disabled:opacity-50`} data-testid={`toggle-${row.subscriber}-${thr}`}>
                              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${en.has(thr) ? "translate-x-5" : "translate-x-1"}`} />
                            </button>
                          </td>
                        ))}
                        <td className="py-2 px-2 font-mono text-slate-500 text-[10px]">
                          {row.last_sent_at ? (
                            <div>
                              <div className="text-slate-300">{new Date(row.last_sent_at).toLocaleString()}</div>
                              {row.last_result && <div className="text-[9px] text-slate-500">{row.last_result.threshold}d · {row.last_result.groups} email(s) · {row.last_result.aeds} AED(s) · {row.last_result.trigger}</div>}
                            </div>
                          ) : <span className="text-slate-600 italic">never</span>}
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex items-center gap-1 flex-wrap">
                            {THRESHOLDS.map(thr => (
                              <div key={thr} className="flex items-center gap-0.5">
                                <button onClick={() => openPreview(row, thr)} className="text-[9px] font-orbitron tracking-widest px-1.5 py-0.5 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10 rounded-sm flex items-center gap-1" title={`Preview ${thr}-day email`} data-testid={`preview-${row.subscriber}-${thr}`}>
                                  <Eye className="w-3 h-3" />{thr}d
                                </button>
                                <button onClick={() => askRunNow(row, thr)} disabled={running || !templates[thr]} className="text-[9px] font-orbitron tracking-widest px-1.5 py-0.5 border border-amber-500/40 text-amber-300 hover:bg-amber-500/10 rounded-sm flex items-center gap-1 disabled:opacity-30" title={`Send ${thr}-day email now`} data-testid={`runnow-${row.subscriber}-${thr}`}>
                                  {running && runningRow.thr === thr ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                                </button>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-slate-500 text-[11px]">No subscribers match.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Run Now confirm */}
      {runConfirm && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setRunConfirm(null)}>
          <div className="bg-[#0a0f1c] border border-amber-500/50 rounded-sm w-full max-w-[520px] p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              <div className="font-orbitron text-sm text-amber-300 tracking-widest">CONFIRM RUN NOW · {runConfirm.thr}-DAY</div>
            </div>
            <div className="text-[12px] text-slate-300 mb-2">Send Expiring B/P email now for <span className="font-mono text-cyan-300">{runConfirm.row.subscriber}</span> at the <span className="font-mono text-cyan-300">{runConfirm.thr}-day</span> threshold?</div>
            <div className="text-[11px] text-slate-500 mb-4 leading-relaxed">
              Uses ALL currently-in-window AEDs (ignores yesterday diff).{" "}
              {testMode.enabled
                ? <span className="text-amber-300">Test Mode is ACTIVE — will send to <code>{testMode.to}</code>{testMode.cc && ` (cc: ${testMode.cc})`}.</span>
                : <span className="text-red-300">Test Mode is OFF — will send to the REAL subscriber contact.</span>}
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setRunConfirm(null)} className="text-[10px] font-orbitron tracking-widest px-3 py-1.5 border border-slate-600 text-slate-300 hover:bg-slate-800 rounded-sm">CANCEL</button>
              <button onClick={() => doRunNow(runConfirm)} className="text-[10px] font-orbitron tracking-widest px-3 py-1.5 border border-amber-500/50 text-amber-300 hover:bg-amber-500/10 rounded-sm flex items-center gap-1"><Send className="w-3 h-3" /> SEND NOW</button>
            </div>
          </div>
        </div>
      )}

      {/* Preview modal */}
      {previewOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4" onClick={() => setPreviewOpen(null)}>
          <div className="bg-[#0a0f1c] border border-cyan-500/30 rounded-sm w-full max-w-[900px] max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="border-b border-cyan-500/15 px-5 py-3 flex items-center justify-between">
              <div>
                <div className="font-orbitron text-sm text-cyan-400 tracking-widest">PREVIEW · {previewOpen.subscriber} · {previewOpen.threshold}-DAY</div>
                <div className="text-[10px] text-slate-500 tracking-wider">SHOWING ALL CURRENT DEVICES IN THE {previewOpen.threshold}-DAY WINDOW (IGNORES YESTERDAY DIFF)</div>
              </div>
              <button onClick={() => setPreviewOpen(null)} className="text-slate-500 hover:text-white text-lg">×</button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="text-[11px] text-slate-400">In-window: <span className="text-cyan-300">{previewOpen.data.todays_count}</span> AED(s) · Groups: <span className="text-cyan-300">{previewOpen.data.recipient_groups?.length || 0}</span></div>
              {(previewOpen.data.recipient_groups || []).length === 0 && <div className="text-slate-500 text-[11px] italic">No emails would be sent — either no AEDs in this window today, or no resolved recipients.</div>}
              {(previewOpen.data.recipient_groups || []).map((g, i) => (
                <div key={i} className="border border-slate-800 rounded-sm">
                  <div className="border-b border-slate-800 bg-slate-900/40 px-3 py-2 text-[11px] font-mono text-slate-300 flex items-center justify-between gap-2 flex-wrap">
                    <div><span className="text-slate-500 font-orbitron text-[9px] tracking-widest">TO:</span> {g.to}{g.cc && <><span className="text-slate-500 font-orbitron text-[9px] tracking-widest ml-3">CC:</span> {g.cc}</>}</div>
                    <div className="text-cyan-300 font-orbitron text-[9px] tracking-widest">{g.aed_count} AED(s){g.loc_label ? ` · ${g.loc_label}` : ""}</div>
                  </div>
                  <div className="p-3 bg-white text-black" dangerouslySetInnerHTML={{ __html: g.html }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
