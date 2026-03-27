# Cardiac Solutions LLC - AED Monitoring Dashboard PRD

## Original Problem Statement
Build a Tony Stark, dark themed web page for Cardiac Solutions LLC. They sell, service and monitor AEDs in the USA using remote cameras.

## What's Been Implemented
- [x] Login page with animated SVG heart, EKG line, sound effects
- [x] Command Center Hub with "Powering Up" splash screen and dynamic module cards
- [x] MongoDB user storage with PBKDF2 hashed passwords (7 seeded users)
- [x] Password auto-migration (bcrypt → PBKDF2) on login
- [x] Role-based access control (admin/user roles)
- [x] Module-based hub filtering per user
- [x] User Access admin page (full CRUD)
- [x] Cross-domain SSO tokens for Daily Report & Notifications (60s expiry, jti single-use, HS256)
- [x] Service Tickets card → external link (service.cardiac-solutions.ai)
- [x] Dashboard card → external link (dashboard.cardiac-solutions.ai)
- [x] Backend card → external link (backend.cardiac-solutions.ai)
- [x] Outage Status card → external link (outage.cardiac-solutions.ai)
- [x] Daily Report card → SSO redirect (report.cardiac-solutions.ai/auth?token=...)
- [x] Notifications card → SSO redirect (notifications.cardiac-solutions.ai/auth?token=...)
- [x] Server status indicator on login page
- [x] **Production deployment FIXED** — v6-resilient: module-level Motor client with auto-reconnect, global exception handler, CORS-first middleware, all DB calls wrapped in try/except

## Tech Stack
- Frontend: React 19 + Framer Motion + Tailwind CSS + Shadcn UI
- Backend: FastAPI + Motor (async MongoDB) + PBKDF2 (hashlib) + PyJWT
- Database: MongoDB
- Deployment: Emergent platform with Cloudflare CDN

## Key Files
- `/app/frontend/src/apiBase.js` — environment-aware API URL (relative in production)
- `/app/frontend/src/pages/CommandCenterHub.jsx` — Hub with module cards, SSO redirects, external links
- `/app/frontend/src/pages/UserAccess.jsx` — Admin CRUD with retry logic
- `/app/frontend/src/pages/LoginPage.jsx` — Multi-stage login + server status
- `/app/backend/server.py` — All backend logic, auth, cross-domain SSO, admin CRUD, seeding

## API Endpoints
- POST `/api/auth/login` — Authenticate user
- GET `/api/auth/me` — Current user profile
- POST `/api/auth/cross-domain-token` — Generate 60s SSO JWT for subdomain redirect
- GET/POST/PUT/DELETE `/api/admin/users` — User CRUD (admin only)
- GET `/api/admin/modules` — Available modules list
- GET `/api/dashboard/stats|subscribers|devices` — Dashboard data (mocked)
- GET `/api/debug/status` — DB diagnostics (no auth)
- GET `/api/debug/test-login` — Login test diagnostics (no auth)
- GET `/api/version` — Server version check (no auth)

## Cross-Domain SSO
- JWT Secret: `cardiac-solutions-secure-jwt-secret-key-2024-production`
- Algorithm: HS256
- Expiry: 60 seconds
- Claims: sub, username, name, role, email, allowed_modules, jti, iat, exp, target
- Targets: report → report.cardiac-solutions.ai/auth, notifications → notifications.cardiac-solutions.ai/auth

## Credentials
- **Admin**: futureroads / @@U1s9m6c7@@
- **Users**: Lew/Lew123, Stark/Stark123, Tony/Tony123, Tracey/Tracey123, Nate/Nate123, Jon/Jon123

## Prioritized Backlog

### P1 (High)
- Enable real email delivery (Resend API key)
- Wire dashboard to real backend APIs

### P2 (Medium)
- Build Survival Path module page
- Export to CSV, historical charts

### P3 (Nice to Have)
- Mobile responsive optimizations
- Refactor LoginPage.jsx into smaller components
- Split server.py into modular route files

## Notes
- Dashboard data is MOCKED
- Email sending requires RESEND_API_KEY (currently mocked)
- Password hashing uses PBKDF2 (pure Python) — no bcrypt binary dependency
- Production backend v6-resilient: Motor auto-reconnect, global exception handler, CORS-first
