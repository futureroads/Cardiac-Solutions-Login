// In production builds, use relative URLs so the frontend always calls its own domain.
// In development (preview), use REACT_APP_BACKEND_URL from .env.
const API_BASE = process.env.NODE_ENV === 'production'
  ? ''
  : (process.env.REACT_APP_BACKEND_URL || '');

export default API_BASE;
