import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Upload, Loader2, Search, Save, FileText,
  Trash2, Eye, Send, AlertTriangle, Check, Clock,
} from "lucide-react";
import API_BASE from "@/apiBase";

const API = `${API_BASE}/api`;

const PLACEHOLDER_HELP = [
  { key: "{{subscriber_name}}", note: "The subscriber (e.g. Georgia Power)" },
  { key: "{{contact_name}}", note: "Primary contact's first name" },
  { key: "{{aed_table}}", note: "Full table of newly-expired AEDs" },
  { key: "{{aed_list}}", note: "Same data as a bullet list" },
  { key: "{{today_date}}", note: "Today's date (Eastern Time)" },
  { key: "{{cs_signature}}", note: "Cardiac Solutions email signature" },
];

export default function ExpiredBpAutomation() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token") || "";
  const fileInputRef = useRef(null);

  const [template, setTemplate] = useState(null);
  const [templateLoading, setTemplateLoading] = useState(true);
  const [subject, setSubject] = useState("AED Expired Battery / Pads Notification");
  const [uploading, setUploading] = useState(false);

  const [testMode, setTestMode] = useState({ enabled: false, to: "", cc: "" });
  const [testModeSaving, setTestModeSaving] = useState(false);
  const [testModeDirty, setTestModeDirty] = useState(false);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [savingRow, setSavingRow] = useState(null);
  const [runningRow, setRunningRow] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(null); // {subscriber, data}
  const [flash, setFlash] = useState("");
  const [err, setErr] = useState("");

  const loadTemplate = async () => {
    setTemplateLoading(true);
    try {
      const r = await fetch(`${API}/admin/expired-bp/template`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setTemplate(d.exists ? d : null);
      if (d.exists && d.subject) setSubject(d.subject);
    } catch (e) {
      setErr(e.message || "Failed to load template");
    } finally {
      setTemplateLoading(false);
    }
  };

  const loadSettings = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/admin/expired-bp/settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setItems(d.items || []);
    } catch (e) {
      setErr(e.message || "Failed to load subscribers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTemplate(); loadSettings(); loadTestMode(); }, []);

  const loadTestMode = async () => {
    try {
      const r = await fetch(`${API}/admin/expired-bp/test-mode`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        const d = await r.json();
        setTestMode({ enabled: !!d.enabled, to: d.to || "", cc: d.cc || "" });
        setTestModeDirty(false);
      }
    } catch {} // eslint-disable-line
  };

  const saveTestMode = async () => {
    if (testMode.enabled && !testMode.to.trim()) {
      setErr("Enter a TO address before enabling Test Mode.");
      return;
    }
    setTestModeSaving(true);
    try {
      const r = await fetch(`${API}/admin/expired-bp/test-mode`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(testMode),
      });
      if (!r.ok) throw new Error(await r.text());
      const d = await r.json();
      setTestMode({ enabled: !!d.enabled, to: d.to || "", cc: d.cc || "" });
      setTestModeDirty(false);
      showFlash(d.enabled ? "Test Mode enabled" : "Test Mode disabled");
    } catch (e) {
      setErr(e.message || "Save failed");
    } finally {
      setTestModeSaving(false);
    }
  };

  const showFlash = (msg) => {
    setFlash(msg);
    setTimeout(() => setFlash(""), 2500);
  };

  const onFilePicked = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    setErr("");
    try {
      const fd = new FormData();
      fd.append("file", f);
      fd.append("subject", subject || "");
      const r = await fetch(`${API}/admin/expired-bp/template`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!r.ok) throw new Error(await r.text());
      await loadTemplate();
      showFlash("Template uploaded");
    } catch (e2) {
      setErr(e2.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const saveSubject = async () => {
    if (!template) return;
    setUploading(true);
    try {
      // Re-upload the same content with the new subject by round-tripping the text
      const blob = new Blob([template.text_content || ""], { type: "text/plain" });
      const fd = new FormData();
      fd.append("file", blob, template.filename || "template.txt");
      fd.append("subject", subject || "");
      const r = await fetch(`${API}/admin/expired-bp/template`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!r.ok) throw new Error(await r.text());
      await loadTemplate();
      showFlash("Subject saved");
    } catch (e) {
      setErr(e.message || "Save failed");
    } finally {
      setUploading(false);
    }
  };

  const deleteTemplate = async () => {
    if (!window.confirm("Delete the uploaded template? Automated sends will stop until you upload a new one.")) return;
    try {
      const r = await fetch(`${API}/admin/expired-bp/template`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error(await r.text());
      setTemplate(null);
      showFlash("Template deleted");
    } catch (e) {
      setErr(e.message || "Delete failed");
    }
  };

  const saveRow = async (row, patch) => {
    setSavingRow(row.subscriber);
    try {
      const body = {
        enabled: patch.enabled !== undefined ? patch.enabled : row.enabled,
        send_time_et: patch.send_time_et !== undefined ? patch.send_time_et : row.send_time_et,
      };
      const r = await fetch(`${API}/admin/expired-bp/settings/${encodeURIComponent(row.subscriber)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(await r.text());
      const d = await r.json();
      setItems(prev => prev.map(x => x.subscriber === row.subscriber ? d.settings : x));
    } catch (e) {
      setErr(e.message || "Save failed");
    } finally {
      setSavingRow(null);
    }
  };

  const runNow = async (row) => {
    if (!template) { setErr("Upload a template first"); return; }
    if (!window.confirm(`Send an Expired B/P email NOW for ${row.subscriber}? This will send to every currently-expired AED (ignoring the yesterday diff).`)) return;
    setRunningRow(row.subscriber);
    try {
      const r = await fetch(`${API}/admin/expired-bp/run-now/${encodeURIComponent(row.subscriber)}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error(await r.text());
      const d = await r.json();
      const res = d.result || {};
      if (res.skipped) {
        showFlash(`Skipped: ${res.reason}`);
      } else {
        showFlash(`Sent ${res.groups?.length || 0} email(s) — ${res.aed_count} AED(s)`);
      }
      await loadSettings();
    } catch (e) {
      setErr(e.message || "Run failed");
    } finally {
      setRunningRow(null);
    }
  };

  const openPreview = async (row) => {
    if (!template) { setErr("Upload a template first"); return; }
    try {
      const r = await fetch(`${API}/admin/expired-bp/preview/${encodeURIComponent(row.subscriber)}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error(await r.text());
      const d = await r.json();
      setPreviewOpen({ subscriber: row.subscriber, data: d });
    } catch (e) {
      setErr(e.message || "Preview failed");
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(x => x.subscriber.toLowerCase().includes(q));
  }, [items, search]);

  const enabledCount = items.filter(x => x.enabled).length;

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-[rgba(2,6,23,0.95)] border-b border-cyan-500/20 backdrop-blur">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/hub")}
              className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5"
              data-testid="back-to-hub"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="font-orbitron text-[11px] tracking-widest">HUB</span>
            </button>
            <div>
              <div className="font-orbitron text-cyan-400 text-sm tracking-widest">EXPIRED B/P NOTIFICATIONS</div>
              <div className="text-[10px] text-slate-500 tracking-wider">DAILY AUTOMATION — TEMPLATE + PER-SUBSCRIBER SCHEDULE</div>
            </div>
          </div>
          <div className="flex items-center gap-3 text-[10px] font-orbitron tracking-wider">
            <span className="text-slate-500">TEMPLATE:</span>
            {template ? <span className="text-emerald-400">LOADED</span> : <span className="text-amber-400">NOT UPLOADED</span>}
            <span className="text-slate-600">·</span>
            <span className="text-slate-500">ENABLED:</span>
            <span className="text-cyan-300">{enabledCount}/{items.length}</span>
            {testMode.enabled && (
              <>
                <span className="text-slate-600">·</span>
                <span className="text-amber-200 bg-amber-500/20 border border-amber-500/50 px-1.5 py-0.5 rounded-sm">TEST MODE ACTIVE</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Flash / Error */}
      {(flash || err) && (
        <div className="max-w-[1400px] mx-auto px-6 pt-3">
          {flash && (
            <div className="mb-2 px-3 py-2 rounded-sm border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-[11px] font-orbitron tracking-wider flex items-center gap-2">
              <Check className="w-3.5 h-3.5" /> {flash}
            </div>
          )}
          {err && (
            <div className="mb-2 px-3 py-2 rounded-sm border border-red-500/40 bg-red-500/10 text-red-300 text-[11px] font-mono flex items-start justify-between gap-3">
              <div className="break-words">{err}</div>
              <button onClick={() => setErr("")} className="text-red-400 hover:text-red-200 shrink-0">×</button>
            </div>
          )}
        </div>
      )}

      <div className="max-w-[1400px] mx-auto px-6 py-4 space-y-4">
        {/* Template card */}
        <div className="border border-cyan-500/30 bg-[#0a0f1c] rounded-sm p-5" data-testid="template-card">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-cyan-400" />
              <div className="font-orbitron text-cyan-400 text-xs tracking-widest">GLOBAL EMAIL TEMPLATE</div>
            </div>
            {template && (
              <button
                onClick={deleteTemplate}
                className="text-[10px] font-orbitron tracking-widest px-2 py-1 border border-red-500/40 text-red-300 hover:bg-red-500/10 rounded-sm flex items-center gap-1"
                data-testid="delete-template-btn"
              >
                <Trash2 className="w-3 h-3" /> DELETE
              </button>
            )}
          </div>
          {templateLoading ? (
            <div className="text-slate-500 text-[11px]">Loading…</div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {/* Left: file & subject */}
              <div className="space-y-3">
                <div>
                  <div className="text-[10px] font-orbitron text-slate-500 tracking-widest mb-1">FILE</div>
                  {template ? (
                    <div className="border border-slate-700 rounded-sm px-3 py-2 text-[12px] font-mono text-slate-300 flex items-center justify-between gap-2">
                      <span className="truncate">{template.filename}</span>
                      <span className="text-slate-500 text-[10px] whitespace-nowrap">{Math.round((template.size_bytes || 0) / 1024)} KB</span>
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-500 italic">No template uploaded yet</div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".docx,.doc,.html,.htm,.txt,.md"
                    onChange={onFilePicked}
                    className="hidden"
                    data-testid="template-file-input"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="mt-2 text-[10px] font-orbitron tracking-widest px-3 py-1.5 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10 rounded-sm flex items-center gap-2 disabled:opacity-50"
                    data-testid="upload-template-btn"
                  >
                    {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                    {template ? "REPLACE FILE" : "UPLOAD FILE"}
                  </button>
                  <div className="text-[9px] text-slate-600 mt-1">Accepts .docx, .doc, .html, .htm, .txt, .md</div>
                </div>
                <div>
                  <div className="text-[10px] font-orbitron text-slate-500 tracking-widest mb-1">SUBJECT</div>
                  <div className="flex gap-2">
                    <input
                      value={subject}
                      onChange={e => setSubject(e.target.value)}
                      className="flex-1 bg-slate-900/40 border border-slate-700 rounded-sm px-2 py-1.5 text-[12px] font-mono text-slate-200"
                      placeholder="AED Expired Battery / Pads Notification"
                      data-testid="subject-input"
                    />
                    <button
                      onClick={saveSubject}
                      disabled={!template || uploading}
                      className="text-[10px] font-orbitron tracking-widest px-3 py-1.5 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10 rounded-sm flex items-center gap-1 disabled:opacity-30"
                      data-testid="save-subject-btn"
                    >
                      <Save className="w-3 h-3" /> SAVE
                    </button>
                  </div>
                  <div className="text-[9px] text-slate-600 mt-1">Supports <code className="text-slate-400">{"{{subscriber}}"}</code> and <code className="text-slate-400">{"{{location}}"}</code></div>
                </div>
              </div>

              {/* Right: placeholders help */}
              <div className="border-l md:pl-4 border-slate-800">
                <div className="text-[10px] font-orbitron text-slate-500 tracking-widest mb-2">SUPPORTED PLACEHOLDERS</div>
                <ul className="space-y-1 text-[11px]">
                  {PLACEHOLDER_HELP.map(p => (
                    <li key={p.key} className="flex items-baseline gap-2">
                      <code className="text-cyan-300 font-mono text-[10px] whitespace-nowrap">{p.key}</code>
                      <span className="text-slate-500">— {p.note}</span>
                    </li>
                  ))}
                </ul>
                <div className="text-[9px] text-slate-600 mt-2 leading-relaxed">
                  Only admins can edit this template. It is used for every enabled subscriber&apos;s automated email.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Test Mode card */}
        <div
          className={`border rounded-sm p-5 ${testMode.enabled ? "border-amber-500/60 bg-amber-500/5" : "border-slate-700 bg-[#0a0f1c]"}`}
          data-testid="test-mode-card"
        >
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className={`w-4 h-4 ${testMode.enabled ? "text-amber-400" : "text-slate-500"}`} />
              <div className={`font-orbitron text-xs tracking-widest ${testMode.enabled ? "text-amber-300" : "text-slate-400"}`}>
                TEST MODE
              </div>
              {testMode.enabled && (
                <span className="font-orbitron text-[9px] tracking-widest text-amber-200 bg-amber-500/20 border border-amber-500/50 px-1.5 py-0.5 rounded-sm">
                  ACTIVE
                </span>
              )}
            </div>
            <button
              onClick={() => {
                setTestMode(m => ({ ...m, enabled: !m.enabled }));
                setTestModeDirty(true);
              }}
              className={`relative inline-flex h-5 w-10 items-center rounded-full transition ${testMode.enabled ? "bg-amber-500" : "bg-slate-700"}`}
              data-testid="test-mode-toggle"
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${testMode.enabled ? "translate-x-5" : "translate-x-1"}`} />
            </button>
          </div>

          <div className="text-[11px] text-slate-400 mb-3 leading-relaxed">
            When Test Mode is active, all scheduled and Run-Now sends for enabled subscribers are redirected to the addresses below instead of the real subscriber contacts. Subject line is prefixed with <code className="text-amber-300">[TEST MODE]</code> and a banner is added to the top of the email showing who the intended recipient would have been.
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <div className="text-[10px] font-orbitron text-slate-500 tracking-widest mb-1">TEST TO (required)</div>
              <input
                value={testMode.to}
                onChange={e => { setTestMode(m => ({ ...m, to: e.target.value })); setTestModeDirty(true); }}
                placeholder="you@example.com"
                className="w-full bg-slate-900/40 border border-slate-700 rounded-sm px-2 py-1.5 text-[12px] font-mono text-slate-200"
                data-testid="test-to-input"
              />
            </div>
            <div>
              <div className="text-[10px] font-orbitron text-slate-500 tracking-widest mb-1">TEST CC (optional, comma-separated)</div>
              <input
                value={testMode.cc}
                onChange={e => { setTestMode(m => ({ ...m, cc: e.target.value })); setTestModeDirty(true); }}
                placeholder="teammate@example.com, boss@example.com"
                className="w-full bg-slate-900/40 border border-slate-700 rounded-sm px-2 py-1.5 text-[12px] font-mono text-slate-200"
                data-testid="test-cc-input"
              />
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={saveTestMode}
              disabled={testModeSaving || !testModeDirty}
              className="text-[10px] font-orbitron tracking-widest px-3 py-1.5 border border-amber-500/50 text-amber-300 hover:bg-amber-500/10 rounded-sm flex items-center gap-1 disabled:opacity-30"
              data-testid="save-test-mode-btn"
            >
              {testModeSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} SAVE TEST MODE
            </button>
            {!testModeDirty && !testModeSaving && (
              <span className="text-[10px] text-slate-500 font-orbitron tracking-wider">saved</span>
            )}
          </div>
        </div>

        {/* Subscribers table */}
        <div className="border border-cyan-500/30 bg-[#0a0f1c] rounded-sm p-5">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              <div className="font-orbitron text-cyan-400 text-xs tracking-widest">PER-SUBSCRIBER AUTOMATION</div>
            </div>
            <div className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-slate-500" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Filter subscribers…"
                className="bg-slate-900/40 border border-slate-700 rounded-sm px-2 py-1 text-[11px] font-mono text-slate-200 w-56"
                data-testid="filter-subscribers"
              />
            </div>
          </div>

          {!template && (
            <div className="mb-3 px-3 py-2 rounded-sm border border-amber-500/40 bg-amber-500/10 text-amber-300 text-[11px] font-orbitron tracking-wider flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5" /> Upload a template above before enabling any subscribers — sends will be skipped without one.
            </div>
          )}

          {loading ? (
            <div className="text-slate-500 text-[11px] p-6 text-center">Loading subscribers…</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-slate-800 text-left">
                    <th className="py-2 px-2 font-orbitron text-[9px] text-slate-500 tracking-widest">SUBSCRIBER</th>
                    <th className="py-2 px-2 font-orbitron text-[9px] text-slate-500 tracking-widest w-24">AUTOMATED</th>
                    <th className="py-2 px-2 font-orbitron text-[9px] text-slate-500 tracking-widest w-32">SEND TIME (ET)</th>
                    <th className="py-2 px-2 font-orbitron text-[9px] text-slate-500 tracking-widest">LAST SENT</th>
                    <th className="py-2 px-2 font-orbitron text-[9px] text-slate-500 tracking-widest w-44">ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(row => (
                    <tr key={row.subscriber} className="border-b border-slate-900 hover:bg-slate-900/30" data-testid={`row-${row.subscriber}`}>
                      <td className="py-2 px-2 font-mono text-slate-200">{row.subscriber}</td>
                      <td className="py-2 px-2">
                        <button
                          onClick={() => saveRow(row, { enabled: !row.enabled })}
                          disabled={savingRow === row.subscriber}
                          className={`relative inline-flex h-5 w-10 items-center rounded-full transition ${row.enabled ? "bg-emerald-500" : "bg-slate-700"} disabled:opacity-50`}
                          data-testid={`toggle-${row.subscriber}`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${row.enabled ? "translate-x-5" : "translate-x-1"}`} />
                        </button>
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="time"
                          value={row.send_time_et || "06:00"}
                          onChange={e => saveRow(row, { send_time_et: e.target.value })}
                          disabled={savingRow === row.subscriber}
                          className="bg-slate-900/60 border border-slate-700 rounded-sm px-1.5 py-0.5 text-[11px] font-mono text-slate-200 w-28"
                          data-testid={`time-${row.subscriber}`}
                        />
                      </td>
                      <td className="py-2 px-2 font-mono text-slate-500 text-[10px]">
                        {row.last_sent_at ? (
                          <div>
                            <div className="text-slate-300">{new Date(row.last_sent_at).toLocaleString()}</div>
                            {row.last_result && (
                              <div className="text-[9px] text-slate-500">
                                {row.last_result.groups} email(s) · {row.last_result.aeds} AED(s) · {row.last_result.trigger}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-600 italic">never</span>
                        )}
                      </td>
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => openPreview(row)}
                            className="text-[9px] font-orbitron tracking-widest px-2 py-1 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10 rounded-sm flex items-center gap-1"
                            data-testid={`preview-${row.subscriber}`}
                          >
                            <Eye className="w-3 h-3" /> PREVIEW
                          </button>
                          <button
                            onClick={() => runNow(row)}
                            disabled={runningRow === row.subscriber || !template}
                            className="text-[9px] font-orbitron tracking-widest px-2 py-1 border border-amber-500/40 text-amber-300 hover:bg-amber-500/10 rounded-sm flex items-center gap-1 disabled:opacity-30"
                            data-testid={`runnow-${row.subscriber}`}
                          >
                            {runningRow === row.subscriber ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />} RUN NOW
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={5} className="py-6 text-center text-slate-500 text-[11px]">No subscribers match your filter.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Preview modal */}
      {previewOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4" onClick={() => setPreviewOpen(null)} data-testid="preview-modal">
          <div className="bg-[#0a0f1c] border border-cyan-500/30 rounded-sm w-full max-w-[900px] max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="border-b border-cyan-500/15 px-5 py-3 flex items-center justify-between">
              <div>
                <div className="font-orbitron text-sm text-cyan-400 tracking-widest">PREVIEW — {previewOpen.subscriber}</div>
                <div className="text-[10px] text-slate-500 tracking-wider">SHOWING ALL CURRENT EXPIRED B/P (IGNORES YESTERDAY DIFF)</div>
              </div>
              <button onClick={() => setPreviewOpen(null)} className="text-slate-500 hover:text-white text-lg">×</button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="text-[11px] text-slate-400">
                Currently expired: <span className="text-cyan-300">{previewOpen.data.todays_expired_count}</span> AED(s) · Recipient groups: <span className="text-cyan-300">{previewOpen.data.recipient_groups?.length || 0}</span>
              </div>
              {(previewOpen.data.recipient_groups || []).length === 0 && (
                <div className="text-slate-500 text-[11px] italic">No emails would be sent &mdash; either no expired AEDs today, or no resolved recipients.</div>
              )}
              {(previewOpen.data.recipient_groups || []).map((g, i) => (
                <div key={i} className="border border-slate-800 rounded-sm">
                  <div className="border-b border-slate-800 bg-slate-900/40 px-3 py-2 text-[11px] font-mono text-slate-300 flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <span className="text-slate-500 font-orbitron text-[9px] tracking-widest">TO:</span> {g.to}
                      {g.cc && <><span className="text-slate-500 font-orbitron text-[9px] tracking-widest ml-3">CC:</span> {g.cc}</>}
                    </div>
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
