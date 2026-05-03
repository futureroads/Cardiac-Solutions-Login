// Determine the API base URL at runtime, NOT build time.
//
// Why runtime:
//   The `REACT_APP_BACKEND_URL` env var was being baked into production
//   builds with a stale Emergent internal hostname (pulse-ops.emergent.host),
//   causing every API call from cardiac-solutions.ai to hit a different
//   origin → CORS errors + 520s. By switching to a runtime check on
//   window.location.hostname we ALWAYS use relative URLs in any deployed
//   environment, bypassing whatever the build env vars contain.
//
// Behavior:
//   * Running on localhost / 127.0.0.1 → use REACT_APP_BACKEND_URL (dev workflow)
//   * Running on any other hostname (preview, prod, custom domain) → use ''
//     so requests stay same-origin (e.g. /api/...) and never trigger CORS.
const isLocalDev = (() => {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname || '';
  return h === 'localhost' || h === '127.0.0.1' || h.endsWith('.local');
})();

const API_BASE = isLocalDev
  ? (process.env.REACT_APP_BACKEND_URL || '')
  : '';

export default API_BASE;
