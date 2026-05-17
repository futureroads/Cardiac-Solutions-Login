import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Upload, Plus, Pencil, Trash2, Loader2, Search,
  AlertTriangle, X, Save, Building2, Mail,
} from "lucide-react";
import API_BASE from "@/apiBase";

const API = `${API_BASE}/api`;

export default function LocationContacts() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const token = localStorage.getItem("token") || "";

  // Subscriber list — start with GP, allow other subscribers later
  const [subscriber, setSubscriber] = useState("Georgia Power");
  const [notifyMode, setNotifyMode] = useState("subscriber");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [search, setSearch] = useState("");
  const [showOrphansOnly, setShowOrphansOnly] = useState(false);
  const [editing, setEditing] = useState(null); // {site, building, emails} or null
  const [importing, setImporting] = useState(false);

  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      const [sRes, lRes] = await Promise.all([
        fetch(`${API}/admin/subscriber-settings/${encodeURIComponent(subscriber)}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API}/admin/location-contacts/${encodeURIComponent(subscriber)}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      if (!sRes.ok) throw new Error(`Settings: HTTP ${sRes.status}`);
      if (!lRes.ok) throw new Error(`Contacts: HTTP ${lRes.status}`);
      const s = await sRes.json();
      const l = await lRes.json();
      setNotifyMode(s.notify_mode || "subscriber");
      setItems(l.items || []);
    } catch (e) {
      setErr(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [subscriber]);

  // Fetch the full real subscriber list once
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API}/support/dashboard-data`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.ok) return;
        const d = await r.json();
        const names = Array.from(
          new Set((d.subscribers || []).map((s) => s.subscriber).filter(Boolean)),
        ).sort();
        if (names.length) {
          // Keep Georgia Power pinned at the top, then the rest alphabetically
          const rest = names.filter((n) => n !== "Georgia Power");
          const hasGp = names.includes("Georgia Power");
          setAllSubscribers(hasGp ? ["Georgia Power", ...rest] : rest);
        }
      } catch {/* swallow */}
    })();
  }, [token]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      if (showOrphansOnly && it.emails && it.emails.length > 0) return false;
      if (!q) return true;
      return (
        (it.site || "").toLowerCase().includes(q) ||
        (it.building || "").toLowerCase().includes(q) ||
        (it.emails || []).some((e) => e.includes(q))
      );
    });
  }, [items, search, showOrphansOnly]);

  const totalAeds = useMemo(() => items.reduce((s, it) => s + (it.aed_count || 0), 0), [items]);
  const orphanCount = useMemo(() => items.filter((it) => !it.emails || it.emails.length === 0).length, [items]);

  const toggleNotifyMode = async (mode) => {
    setErr("");
    try {
      const r = await fetch(`${API}/admin/subscriber-settings/${encodeURIComponent(subscriber)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ notify_mode: mode }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.detail || `HTTP ${r.status}`);
      }
      setNotifyMode(mode);
      setInfo(`Notification mode for ${subscriber} → ${mode.toUpperCase()}`);
      setTimeout(() => setInfo(""), 3000);
    } catch (e) {
      setErr(e.message);
    }
  };

  const handleImport = async (file) => {
    if (!file) return;
    setImporting(true);
    setErr("");
    setInfo("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch(
        `${API}/admin/location-contacts/${encodeURIComponent(subscriber)}/import`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd },
      );
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || `HTTP ${r.status}`);
      setInfo(
        `Imported ${d.locations_upserted} location(s) from ${d.rows_processed} row(s). ` +
        `${d.orphan_count > 0 ? `${d.orphan_count} location(s) have no contacts — see orange rows below.` : "All locations have contacts."}`
      );
      await load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSave = async (payload) => {
    setErr("");
    try {
      const r = await fetch(`${API}/admin/location-contacts/${encodeURIComponent(subscriber)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || `HTTP ${r.status}`);
      setEditing(null);
      await load();
    } catch (e) {
      setErr(e.message);
    }
  };

  const handleDelete = async (it) => {
    if (!window.confirm(`Delete contact mapping for "${it.site} / ${it.building}"?`)) return;
    try {
      const r = await fetch(
        `${API}/admin/location-contacts/${encodeURIComponent(subscriber)}?site=${encodeURIComponent(it.site)}&building=${encodeURIComponent(it.building)}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await load();
    } catch (e) {
      setErr(e.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <div className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate("/hub")}
            data-testid="loc-back-btn"
            className="p-2 -ml-2 rounded text-slate-400 hover:text-cyan-300 hover:bg-cyan-500/5"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1">
            <div className="font-orbitron text-sm tracking-wider text-cyan-400">LOCATION CONTACTS</div>
            <div className="text-[9px] text-slate-500 font-orbitron tracking-wider">
              ADMIN — PER-LOCATION NOTIFICATION RECIPIENTS
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Subscriber selector + mode toggle */}
        <div className="border border-slate-800 rounded-md bg-slate-900/40 p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-[240px]">
              <label className="block font-orbitron text-[9px] tracking-widest text-slate-500 mb-1">
                SUBSCRIBER
              </label>
              <select
                value={subscriber}
                onChange={(e) => setSubscriber(e.target.value)}
                data-testid="loc-subscriber-select"
                className="w-full bg-slate-950 border border-slate-700 text-cyan-200 text-sm font-orbitron px-3 py-2 rounded-sm focus:outline-none focus:border-cyan-500/60"
              >
                {allSubscribers.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-orbitron text-[9px] tracking-widest text-slate-500 mb-1">
                NOTIFICATION MODE
              </label>
              <div className="inline-flex rounded-sm border border-slate-700 overflow-hidden">
                {["subscriber", "location"].map((m) => (
                  <button
                    key={m}
                    onClick={() => toggleNotifyMode(m)}
                    data-testid={`loc-mode-${m}-btn`}
                    className={`font-orbitron text-[10px] tracking-widest px-4 py-2 ${
                      notifyMode === m
                        ? "bg-cyan-500/20 text-cyan-200 border-cyan-500"
                        : "bg-slate-950 text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    {m === "subscriber" ? "BY SUBSCRIBER" : "BY LOCATION"}
                  </button>
                ))}
              </div>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={(e) => handleImport(e.target.files?.[0])}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                data-testid="loc-import-btn"
                className="font-orbitron text-[10px] tracking-widest px-3 py-2 rounded-sm border border-cyan-500/40 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 disabled:opacity-50"
              >
                {importing ? (
                  <Loader2 className="w-3 h-3 inline mr-1.5 animate-spin" />
                ) : (
                  <Upload className="w-3 h-3 inline mr-1.5" />
                )}
                IMPORT XLSX
              </button>
              <button
                onClick={() => setEditing({ site: "", building: "", emails: [] })}
                data-testid="loc-add-btn"
                className="font-orbitron text-[10px] tracking-widest px-3 py-2 rounded-sm border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
              >
                <Plus className="w-3 h-3 inline mr-1.5" />
                ADD
              </button>
            </div>
          </div>

          {notifyMode === "location" && (
            <div className="mt-3 text-[11px] text-cyan-400/80 font-orbitron tracking-wider">
              📍 PER-LOCATION MODE: NOTIFICATIONS WILL BE SENT AS ONE EMAIL PER (SITE, BUILDING).
            </div>
          )}

          {err && (
            <div data-testid="loc-error" className="mt-3 text-[11px] text-red-400 font-orbitron">{err}</div>
          )}
          {info && (
            <div className="mt-3 text-[11px] text-emerald-400 font-orbitron">{info}</div>
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="LOCATIONS" value={items.length} />
          <Stat label="AEDS COVERED" value={totalAeds} />
          <Stat
            label="ORPHAN LOCATIONS"
            value={orphanCount}
            danger={orphanCount > 0}
            onClick={() => setShowOrphansOnly((v) => !v)}
            active={showOrphansOnly}
          />
          <Stat label="UNIQUE EMAILS" value={new Set(items.flatMap((i) => i.emails || [])).size} />
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search site, building, or email…"
            data-testid="loc-search-input"
            className="w-full bg-slate-900/40 border border-slate-800 text-slate-200 text-sm pl-10 pr-3 py-2.5 rounded-sm focus:outline-none focus:border-cyan-500/60"
          />
        </div>

        {/* Table */}
        <div className="border border-slate-800 rounded-md bg-slate-900/30 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-800 font-orbitron text-[10px] tracking-widest text-slate-400">
            <span className="text-cyan-300">{filtered.length}</span> LOCATION{filtered.length === 1 ? "" : "S"}
            {showOrphansOnly && <span className="ml-2 text-amber-400">· ORPHANS ONLY</span>}
          </div>

          {loading ? (
            <div className="p-10 flex items-center justify-center text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              <span className="font-orbitron text-[11px] tracking-wider">LOADING…</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-slate-500 font-orbitron text-[11px] tracking-wider">
              {items.length === 0 ? "NO LOCATIONS — IMPORT AN XLSX OR ADD MANUALLY" : "NO MATCHES"}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs" data-testid="loc-table">
                <thead className="bg-slate-900/60 border-b border-slate-800">
                  <tr className="font-orbitron text-[9px] tracking-widest text-slate-500">
                    <th className="text-left px-4 py-2.5">SITE</th>
                    <th className="text-left px-4 py-2.5">BUILDING</th>
                    <th className="text-left px-4 py-2.5">AEDS</th>
                    <th className="text-left px-4 py-2.5">RECIPIENTS</th>
                    <th className="text-right px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((it) => {
                    const isOrphan = !it.emails || it.emails.length === 0;
                    return (
                      <tr
                        key={it.loc_key}
                        className={`border-b border-slate-800/60 hover:bg-cyan-500/5 ${
                          isOrphan ? "bg-amber-500/5" : ""
                        }`}
                      >
                        <td className="px-4 py-2 text-slate-200">{it.site || "—"}</td>
                        <td className="px-4 py-2 text-slate-300">
                          <div className="flex items-center gap-1.5">
                            <Building2 className="w-3 h-3 text-slate-500" />
                            <span>{it.building || "—"}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-cyan-300 font-mono">{it.aed_count ?? "—"}</td>
                        <td className="px-4 py-2">
                          {isOrphan ? (
                            <span className="font-orbitron text-[9px] tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-sm">
                              <AlertTriangle className="w-3 h-3 inline mr-1" />
                              NO CONTACTS
                            </span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {(it.emails || []).slice(0, 5).map((e) => (
                                <span
                                  key={e}
                                  title={e}
                                  className="font-mono text-[10px] px-1.5 py-0.5 rounded-sm bg-cyan-500/10 text-cyan-300 border border-cyan-500/30"
                                >
                                  {e.length > 28 ? e.slice(0, 26) + "…" : e}
                                </span>
                              ))}
                              {it.emails && it.emails.length > 5 && (
                                <span className="font-mono text-[10px] px-1.5 py-0.5 text-slate-500">
                                  +{it.emails.length - 5}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right whitespace-nowrap">
                          <button
                            onClick={() => setEditing({ ...it })}
                            data-testid={`loc-edit-${it.loc_key}`}
                            className="p-1.5 text-slate-400 hover:text-cyan-300"
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(it)}
                            className="p-1.5 text-slate-400 hover:text-red-400"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {editing && (
        <EditModal
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

function Stat({ label, value, danger, onClick, active }) {
  const base = "rounded-md p-3 border";
  const tone = danger
    ? "border-amber-500/40 bg-amber-500/5"
    : "border-slate-800 bg-slate-900/30";
  const activeRing = active ? " ring-1 ring-cyan-500/60" : "";
  return (
    <div
      onClick={onClick}
      className={`${base} ${tone}${activeRing} ${onClick ? "cursor-pointer hover:bg-slate-800/60" : ""}`}
    >
      <div className="font-orbitron text-[9px] tracking-widest text-slate-500">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${danger ? "text-amber-300" : "text-cyan-200"}`}>{value}</div>
    </div>
  );
}

function EditModal({ initial, onClose, onSave }) {
  const [site, setSite] = useState(initial.site || "");
  const [building, setBuilding] = useState(initial.building || "");
  const [emailsRaw, setEmailsRaw] = useState((initial.emails || []).join(", "));
  const [err, setErr] = useState("");
  const isNew = !initial.site && !initial.building;

  const submit = () => {
    if (!site.trim() || !building.trim()) {
      setErr("Site and Building are required");
      return;
    }
    onSave({ site: site.trim(), building: building.trim(), emails: emailsRaw });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-md shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <div className="font-orbitron text-sm tracking-wider text-cyan-300">
            {isNew ? "ADD LOCATION CONTACT" : "EDIT LOCATION CONTACT"}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="block font-orbitron text-[9px] tracking-widest text-slate-500 mb-1">SITE</label>
            <input
              value={site}
              onChange={(e) => setSite(e.target.value)}
              disabled={!isNew}
              data-testid="loc-edit-site"
              className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-sm px-3 py-2 rounded-sm disabled:opacity-50 focus:outline-none focus:border-cyan-500/60"
            />
          </div>
          <div>
            <label className="block font-orbitron text-[9px] tracking-widest text-slate-500 mb-1">BUILDING</label>
            <input
              value={building}
              onChange={(e) => setBuilding(e.target.value)}
              disabled={!isNew}
              data-testid="loc-edit-building"
              className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-sm px-3 py-2 rounded-sm disabled:opacity-50 focus:outline-none focus:border-cyan-500/60"
            />
          </div>
          <div>
            <label className="block font-orbitron text-[9px] tracking-widest text-slate-500 mb-1">
              <Mail className="w-3 h-3 inline mr-1" />
              EMAILS (comma or newline separated)
            </label>
            <textarea
              value={emailsRaw}
              onChange={(e) => setEmailsRaw(e.target.value)}
              data-testid="loc-edit-emails"
              rows={4}
              className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-sm px-3 py-2 rounded-sm font-mono focus:outline-none focus:border-cyan-500/60"
              placeholder="name1@southernco.com, name2@southernco.com"
            />
            <div className="mt-1 text-[9px] font-orbitron tracking-wider text-slate-600">
              EMPTY = ORPHAN LOCATION (will block per-location sends for these AEDs)
            </div>
          </div>
          {err && <div className="text-[11px] text-red-400 font-orbitron">{err}</div>}
        </div>
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-slate-800">
          <button
            onClick={onClose}
            className="font-orbitron text-[10px] tracking-widest px-4 py-2 rounded-sm border border-slate-700 text-slate-400 hover:text-slate-200"
          >
            CANCEL
          </button>
          <button
            onClick={submit}
            data-testid="loc-edit-save"
            className="font-orbitron text-[10px] tracking-widest px-4 py-2 rounded-sm border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
          >
            <Save className="w-3 h-3 inline mr-1" />
            SAVE
          </button>
        </div>
      </div>
    </div>
  );
}
