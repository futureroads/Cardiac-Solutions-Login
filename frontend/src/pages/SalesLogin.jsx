import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogIn, Loader2 } from "lucide-react";
import API_BASE from "../apiBase";

const API = API_BASE + "/api";

export default function SalesLogin({ onLogin }) {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // If already logged in, jump straight to mobile route picker
  useEffect(() => {
    const t = localStorage.getItem("token");
    if (t) navigate("/sales/mobile", { replace: true });
  }, [navigate]);

  // Pre-fill saved username
  useEffect(() => {
    const saved = localStorage.getItem("saved_username");
    if (saved) setUsername(saved);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setErr("Enter your username and password.");
      return;
    }
    setLoading(true);
    setErr("");
    try {
      const r = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || `Login failed (${r.status})`);
      // Save credentials + token
      localStorage.setItem("saved_username", username.trim());
      localStorage.setItem("token", d.access_token);
      localStorage.setItem("user", JSON.stringify(d.user || {}));
      if (typeof onLogin === "function") {
        // Lift state to App without redirecting away — we'll navigate ourselves
        onLogin(d.access_token, d.user, { skipRedirect: true });
      }
      navigate("/sales/mobile", { replace: true });
    } catch (e) {
      setErr(e.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#040A14] text-cyan-100 flex flex-col font-sans">
      {/* Branded header */}
      <div className="px-6 pt-8 pb-6 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 mb-3">
          <svg viewBox="0 0 24 24" className="w-7 h-7 text-cyan-300" fill="currentColor" aria-hidden="true">
            <path d="M12 21s-7-4.35-7-10a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 5.65-7 10-7 10z" opacity=".15"/>
            <path d="M3 13h4l2-4 3 8 2-5 2 1h5" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h1 className="font-orbitron text-xl font-bold tracking-widest text-cyan-300">CARDIAC SOLUTIONS</h1>
        <div className="text-[11px] tracking-[0.25em] text-slate-500 mt-1">SALES FIELD PORTAL</div>
      </div>

      {/* Form card */}
      <form onSubmit={handleSubmit} className="flex-1 px-5">
        <div className="max-w-sm mx-auto p-5 rounded-2xl border border-cyan-500/30 bg-[rgba(0,18,32,0.93)]">
          <h2 className="text-base font-bold text-cyan-200 mb-1">Sign in</h2>
          <p className="text-[11px] text-slate-400 mb-5">Use your Cardiac Solutions credentials.</p>

          <label className="text-[10px] text-cyan-400 uppercase tracking-widest font-bold">Username</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            data-testid="sales-login-username"
            type="text"
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="username"
            placeholder="e.g. Nate"
            className="w-full mt-1 mb-4 bg-[#020617] border border-cyan-500/30 text-cyan-100 rounded-lg px-3 py-3 text-base"
          />

          <label className="text-[10px] text-cyan-400 uppercase tracking-widest font-bold">Password</label>
          <div className="relative mt-1 mb-4">
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              data-testid="sales-login-password"
              type={showPwd ? "text" : "password"}
              autoComplete="current-password"
              className="w-full bg-[#020617] border border-cyan-500/30 text-cyan-100 rounded-lg px-3 py-3 pr-16 text-base"
            />
            <button
              type="button"
              onClick={() => setShowPwd(s => !s)}
              data-testid="sales-login-show-pwd"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] tracking-widest font-bold text-cyan-400 px-2 py-1"
              aria-label={showPwd ? "Hide password" : "Show password"}
            >
              {showPwd ? "HIDE" : "SHOW"}
            </button>
          </div>

          {err && (
            <div className="mb-3 p-2.5 border border-red-500/40 bg-red-500/10 text-red-300 text-[12px] rounded" data-testid="sales-login-error">
              {err}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            data-testid="sales-login-submit"
            className="w-full py-3.5 rounded-lg border-2 border-cyan-500/60 bg-cyan-500/20 text-cyan-100 text-base font-bold tracking-wider active:bg-cyan-500/40 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
            {loading ? "Signing in…" : "SIGN IN"}
          </button>

          <div className="mt-4 text-[10px] text-slate-500 text-center">
            Need help? Contact your administrator.
          </div>
        </div>
      </form>

      <div className="text-center text-[10px] text-slate-600 py-4 tracking-widest">CARDIAC-SOLUTIONS.AI</div>
    </div>
  );
}
