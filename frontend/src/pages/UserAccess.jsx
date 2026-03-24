import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  UserPlus,
  Pencil,
  Trash2,
  Check,
  X,
  Shield,
  User,
} from "lucide-react";
import { toast } from "sonner";

const API_URL = process.env.REACT_APP_BACKEND_URL;

const MODULE_OPTIONS = [
  { id: "daily_report", title: "Daily Report" },
  { id: "notifications", title: "Notifications" },
  { id: "service_tickets", title: "Service Tickets" },
  { id: "dashboard", title: "Dashboard" },
  { id: "survival_path", title: "Survival Path" },
];

const ROLE_OPTIONS = ["C Level", "Director", "Manager", "Supervisor", "Employee"];

const DEPARTMENT_OPTIONS = ["Admin", "Sales", "Service", "Shipping", "Warehouse", "Accounting"];

const emptyForm = {
  username: "",
  password: "",
  email: "",
  phone: "",
  role: "Employee",
  department: "",
  allowed_modules: [],
};

export default function UserAccess() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const token = localStorage.getItem("token");

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/users`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed to fetch users");
      const data = await res.json();
      setUsers(data);
    } catch {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (user) => {
    setEditingId(user.id);
    setForm({
      username: user.username,
      password: "",
      email: user.email || "",
      phone: user.phone || "",
      role: user.role || "Employee",
      department: user.department || "",
      allowed_modules: user.allowed_modules || [],
    });
    setShowForm(true);
  };

  const cancel = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const toggleModule = (moduleId) => {
    setForm((prev) => ({
      ...prev,
      allowed_modules: prev.allowed_modules.includes(moduleId)
        ? prev.allowed_modules.filter((m) => m !== moduleId)
        : [...prev.allowed_modules, moduleId],
    }));
  };

  const handleSave = async () => {
    if (!form.username.trim()) {
      toast.error("Username is required");
      return;
    }
    if (!editingId && !form.password.trim()) {
      toast.error("Password is required for new users");
      return;
    }

    setSaving(true);
    try {
      const body = { ...form };
      if (editingId && !body.password) delete body.password;

      const url = editingId
        ? `${API_URL}/api/admin/users/${editingId}`
        : `${API_URL}/api/admin/users`;
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, { method, headers, body: JSON.stringify(body) });
      const data = await res.json();

      if (!res.ok) throw new Error(data.detail || "Failed to save user");

      toast.success(editingId ? "User updated" : "User created");
      cancel();
      fetchUsers();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (userId, username) => {
    if (!window.confirm(`Delete user "${username}"?`)) return;
    try {
      const res = await fetch(`${API_URL}/api/admin/users/${userId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Failed to delete");
      }
      toast.success(`User "${username}" deleted`);
      fetchUsers();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const inputStyle = {
    background: "rgba(15, 23, 42, 0.8)",
    border: "1px solid rgba(148, 163, 184, 0.15)",
    color: "#e2e8f0",
    outline: "none",
  };

  return (
    <div
      data-testid="user-access-page"
      className="min-h-screen flex flex-col"
      style={{ background: "#020617" }}
    >
      {/* Grid bg */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(148,163,184,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.04) 1px, transparent 1px)",
          backgroundSize: "50px 50px",
        }}
      />

      {/* Header */}
      <header
        className="relative z-10 flex items-center justify-between px-8 py-5 border-b"
        style={{ borderColor: "rgba(148, 163, 184, 0.08)" }}
      >
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/hub")}
            className="flex items-center gap-2 font-tech text-[11px] tracking-[0.12em] hover:opacity-80 transition-opacity"
            style={{ color: "#06b6d4" }}
            data-testid="back-to-hub"
          >
            <ArrowLeft size={14} />
            BACK TO HUB
          </button>
          <div className="w-[1px] h-4" style={{ background: "rgba(148,163,184,0.15)" }} />
          <h1
            className="font-tech text-base tracking-[0.1em]"
            style={{ color: "#f1f5f9", fontWeight: 700 }}
          >
            USER ACCESS MANAGEMENT
          </h1>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 rounded-sm font-tech text-[11px] tracking-[0.1em] transition-colors hover:bg-cyan-500/10"
          style={{
            border: "1px solid rgba(6, 182, 212, 0.3)",
            color: "#06b6d4",
          }}
          data-testid="add-user-btn"
        >
          <UserPlus size={14} />
          ADD USER
        </button>
      </header>

      {/* Main */}
      <main className="relative z-10 flex-1 px-8 py-8 max-w-[1200px] mx-auto w-full">
        {/* Form Panel */}
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-6 rounded-sm border"
            style={{
              background: "rgba(10, 15, 28, 0.9)",
              borderColor: "rgba(6, 182, 212, 0.15)",
            }}
            data-testid="user-form"
          >
            <h2
              className="font-tech text-sm tracking-[0.12em] mb-5"
              style={{ color: "#06b6d4" }}
            >
              {editingId ? "EDIT USER" : "CREATE NEW USER"}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
              {/* Username */}
              <div>
                <label className="font-tech text-[10px] tracking-[0.15em] mb-1 block" style={{ color: "#94a3b8" }}>
                  USER NAME
                </label>
                <input
                  data-testid="input-username"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  className="w-full px-3 py-2 rounded-sm font-tech text-sm"
                  style={inputStyle}
                  placeholder="Enter username"
                />
              </div>
              {/* Password */}
              <div>
                <label className="font-tech text-[10px] tracking-[0.15em] mb-1 block" style={{ color: "#94a3b8" }}>
                  PASSWORD {editingId && "(leave blank to keep)"}
                </label>
                <input
                  data-testid="input-password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full px-3 py-2 rounded-sm font-tech text-sm"
                  style={inputStyle}
                  placeholder={editingId ? "••••••" : "Enter password"}
                />
              </div>
              {/* Email */}
              <div>
                <label className="font-tech text-[10px] tracking-[0.15em] mb-1 block" style={{ color: "#94a3b8" }}>
                  EMAIL
                </label>
                <input
                  data-testid="input-email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 rounded-sm font-tech text-sm"
                  style={inputStyle}
                  placeholder="user@example.com"
                />
              </div>
              {/* Phone */}
              <div>
                <label className="font-tech text-[10px] tracking-[0.15em] mb-1 block" style={{ color: "#94a3b8" }}>
                  PHONE
                </label>
                <input
                  data-testid="input-phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-3 py-2 rounded-sm font-tech text-sm"
                  style={inputStyle}
                  placeholder="555-0100"
                />
              </div>
              {/* Role */}
              <div>
                <label className="font-tech text-[10px] tracking-[0.15em] mb-1 block" style={{ color: "#94a3b8" }}>
                  ROLE
                </label>
                <select
                  data-testid="input-role"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full px-3 py-2 rounded-sm font-tech text-sm appearance-none"
                  style={inputStyle}
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r} style={{ background: "#0f172a" }}>
                      {r.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
              {/* Department */}
              <div>
                <label className="font-tech text-[10px] tracking-[0.15em] mb-1 block" style={{ color: "#94a3b8" }}>
                  DEPARTMENT
                </label>
                <select
                  data-testid="input-department"
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                  className="w-full px-3 py-2 rounded-sm font-tech text-sm appearance-none"
                  style={inputStyle}
                >
                  <option value="" style={{ background: "#0f172a" }}>SELECT...</option>
                  {DEPARTMENT_OPTIONS.map((d) => (
                    <option key={d} value={d} style={{ background: "#0f172a" }}>
                      {d.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Module Access */}
            <div className="mb-5">
              <label className="font-tech text-[10px] tracking-[0.15em] mb-2 block" style={{ color: "#94a3b8" }}>
                MODULE ACCESS
              </label>
              <div className="flex flex-wrap gap-2">
                {MODULE_OPTIONS.map((mod) => {
                  const active = form.allowed_modules.includes(mod.id);
                  return (
                    <button
                      key={mod.id}
                      data-testid={`module-toggle-${mod.id}`}
                      onClick={() => toggleModule(mod.id)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-sm font-tech text-[11px] tracking-[0.08em] transition-all"
                      style={{
                        border: `1px solid ${active ? "rgba(6, 182, 212, 0.5)" : "rgba(148, 163, 184, 0.15)"}`,
                        background: active ? "rgba(6, 182, 212, 0.1)" : "transparent",
                        color: active ? "#06b6d4" : "#64748b",
                      }}
                    >
                      <div
                        className="w-3 h-3 rounded-sm border flex items-center justify-center"
                        style={{
                          borderColor: active ? "#06b6d4" : "#475569",
                          background: active ? "#06b6d4" : "transparent",
                        }}
                      >
                        {active && <Check size={8} color="#020617" strokeWidth={3} />}
                      </div>
                      {mod.title}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 rounded-sm font-tech text-[11px] tracking-[0.1em] transition-colors hover:brightness-110"
                style={{ background: "#06b6d4", color: "#020617", fontWeight: 600 }}
                data-testid="save-user-btn"
              >
                <Check size={14} />
                {saving ? "SAVING..." : editingId ? "UPDATE USER" : "CREATE USER"}
              </button>
              <button
                onClick={cancel}
                className="flex items-center gap-2 px-5 py-2 rounded-sm font-tech text-[11px] tracking-[0.1em] transition-opacity hover:opacity-80"
                style={{
                  border: "1px solid rgba(148, 163, 184, 0.2)",
                  color: "#94a3b8",
                }}
                data-testid="cancel-btn"
              >
                <X size={14} />
                CANCEL
              </button>
            </div>
          </motion.div>
        )}

        {/* Users Table */}
        {loading ? (
          <div className="text-center py-20">
            <p className="font-tech text-sm" style={{ color: "#64748b" }}>
              LOADING USERS...
            </p>
          </div>
        ) : (
          <div
            className="rounded-sm border overflow-hidden"
            style={{
              background: "rgba(10, 15, 28, 0.85)",
              borderColor: "rgba(148, 163, 184, 0.08)",
            }}
          >
            <table className="w-full" data-testid="users-table">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(148,163,184,0.08)" }}>
                  {["USERNAME", "EMAIL", "PHONE", "ROLE", "DEPT", "MODULES", "ACTIONS"].map((h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-3 font-tech text-[10px] tracking-[0.15em]"
                      style={{ color: "#64748b" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr
                    key={u.id}
                    className="table-row-hover"
                    style={{ borderBottom: "1px solid rgba(148,163,184,0.05)" }}
                    data-testid={`user-row-${u.username}`}
                  >
                    <td className="px-4 py-3 font-tech text-sm" style={{ color: "#e2e8f0" }}>
                      <div className="flex items-center gap-2">
                        {u.role === "admin" ? (
                          <Shield size={12} style={{ color: "#ef4444" }} />
                        ) : (
                          <User size={12} style={{ color: "#06b6d4" }} />
                        )}
                        {u.username}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-tech text-xs" style={{ color: "#94a3b8" }}>
                      {u.email || "—"}
                    </td>
                    <td className="px-4 py-3 font-tech text-xs" style={{ color: "#94a3b8" }}>
                      {u.phone || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="font-tech text-[10px] tracking-[0.1em] px-2 py-0.5 rounded-sm"
                        style={{
                          color: u.role === "admin" ? "#ef4444" : "#06b6d4",
                          background: u.role === "admin" ? "rgba(239,68,68,0.1)" : "rgba(6,182,212,0.1)",
                          border: `1px solid ${u.role === "admin" ? "rgba(239,68,68,0.3)" : "rgba(6,182,212,0.3)"}`,
                        }}
                      >
                        {(u.role || "Employee").toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-tech text-xs" style={{ color: "#94a3b8" }}>
                      {u.department || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(u.allowed_modules || [])
                          .filter((m) => m !== "user_access")
                          .map((m) => (
                            <span
                              key={m}
                              className="font-tech text-[9px] tracking-[0.05em] px-1.5 py-0.5 rounded-sm"
                              style={{
                                background: "rgba(148,163,184,0.08)",
                                color: "#64748b",
                              }}
                            >
                              {m.replace(/_/g, " ").toUpperCase()}
                            </span>
                          ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEdit(u)}
                          className="p-1.5 rounded-sm hover:bg-cyan-500/10 transition-colors"
                          style={{ color: "#06b6d4" }}
                          data-testid={`edit-${u.username}`}
                        >
                          <Pencil size={13} />
                        </button>
                        {u.id !== "user-admin-001" && (
                          <button
                            onClick={() => handleDelete(u.id, u.username)}
                            className="p-1.5 rounded-sm hover:bg-red-500/10 transition-colors"
                            style={{ color: "#ef4444" }}
                            data-testid={`delete-${u.username}`}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
