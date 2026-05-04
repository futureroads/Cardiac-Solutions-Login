import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import API_BASE from "../apiBase";
const API = API_BASE + "/api";

/**
 * Sends a 20-second activity heartbeat to /api/admin/activity/heartbeat while
 * the user is logged in. Tracks current route + voice-session active state.
 * Calls /api/admin/activity/end on tab close (best-effort sendBeacon).
 *
 * Voice-active state is read from window.__aedaVoiceActive (set by the Stark
 * Dashboard mic handler). Keeps this hook decoupled from voice internals.
 */
export default function useActivityHeartbeat({ enabled }) {
  const location = useLocation();
  const routeRef = useRef(location.pathname);
  const lastSentRef = useRef(0);

  useEffect(() => { routeRef.current = location.pathname; }, [location.pathname]);

  useEffect(() => {
    if (!enabled) return;
    const token = localStorage.getItem("token");
    if (!token) return;

    const sendHeartbeat = (force = false) => {
      const now = Date.now();
      // Throttle to once per 5s minimum
      if (!force && now - lastSentRef.current < 5000) return;
      lastSentRef.current = now;
      try {
        fetch(`${API}/admin/activity/heartbeat`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            route: routeRef.current,
            voice_active: !!window.__aedaVoiceActive,
            user_agent: navigator.userAgent || "",
          }),
          keepalive: true,
        }).catch(() => {});
      } catch {}
    };

    // Fire immediately, then every 20s
    sendHeartbeat(true);
    const id = setInterval(() => sendHeartbeat(false), 20000);
    // Also fire on route change (force)
    const routeId = setInterval(() => {
      if (routeRef.current !== location.pathname) sendHeartbeat(true);
    }, 1000);

    // Send "end" on unload via sendBeacon (best-effort)
    const handleUnload = () => {
      try {
        const blob = new Blob([JSON.stringify({ token })], { type: "application/json" });
        navigator.sendBeacon(`${API}/admin/activity/end?token=${encodeURIComponent(token)}`, blob);
      } catch {}
    };
    window.addEventListener("beforeunload", handleUnload);
    window.addEventListener("pagehide", handleUnload);

    return () => {
      clearInterval(id);
      clearInterval(routeId);
      window.removeEventListener("beforeunload", handleUnload);
      window.removeEventListener("pagehide", handleUnload);
    };
  }, [enabled, location.pathname]);
}
