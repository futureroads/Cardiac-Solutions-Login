# Cardiac Solutions LLC - AED Monitoring Dashboard PRD

## Original Problem Statement
Build a Tony Stark, dark themed web page for Cardiac Solutions LLC. They sell, service and monitor AEDs in the USA using remote cameras.

## What's Been Implemented
- [x] Login page with animated SVG heart, EKG line, sound effects, build version display
- [x] Command Center Hub with "Powering Up" splash screen and dynamic module cards
- [x] MongoDB user storage with PBKDF2 hashed passwords (7 seeded users)
- [x] Password auto-migration (bcrypt → PBKDF2) on login
- [x] Role-based access control (admin/user roles)
- [x] Module-based hub filtering per user
- [x] User Access admin page (full CRUD + Logout button)
- [x] Cross-domain SSO tokens for Daily Report & Notifications (60s expiry, jti single-use, HS256)
- [x] Token expiry validation on page load (auto-logout if expired)
- [x] Login always redirects to /hub (never gets stuck on /user-access)
- [x] Service Tickets card → service.cardiac-solutions.ai (external)
- [x] Dashboard card → dashboard.cardiac-solutions.ai (external)
- [x] Backend card → backend.cardiac-solutions.ai (external)
- [x] Outage Status card → outage.cardiac-solutions.ai (external)
- [x] Daily Report card → SSO redirect (report.cardiac-solutions.ai/auth?token=...)
- [x] Notifications card → SSO redirect (notifications.cardiac-solutions.ai/auth?token=...)
- [x] Frontend auto-retry on 520/502/503 errors (3 retries, 2s delay, Retry button)
- [x] **Production deployment FIXED (v8-nuclear)** — unpinned requirements, non-blocking PBKDF2 via asyncio.to_thread, fast restart (skip seed if users exist), global exception handler, CORS-first middleware, all DB calls wrapped in try/except, safe shutdown handler
- [x] **MongoDB CrashLoopBackOff FIX (2026-03-28)** — Added programmatic DB cleanup migration in lazy init: deletes null/empty username docs, resolves duplicate `user-tony-001`, drops old indexes, recreates with `sparse=True`

## Tech Stack
- Frontend: React 19 + Framer Motion + Tailwind CSS + Shadcn UI
- Backend: FastAPI + Motor (async MongoDB) + PBKDF2 (hashlib) + PyJWT
- Database: MongoDB
- Deployment: Emergent platform with Cloudflare CDN

## Key Files
- `/app/frontend/src/apiBase.js` — environment-aware API URL
- `/app/frontend/src/pages/CommandCenterHub.jsx` — Hub with module cards, SSO redirects
- `/app/frontend/src/pages/UserAccess.jsx` — Admin CRUD with Logout button
- `/app/frontend/src/pages/LoginPage.jsx` — Multi-stage login + build version
- `/app/backend/server.py` — All backend logic, auth, cross-domain SSO, admin CRUD

## Cross-Domain SSO
- JWT Secret: `cardiac-solutions-secure-jwt-secret-key-2024-production`
- Algorithm: HS256
- Expiry: 60 seconds
- Claims: sub, username, name, role, email, allowed_modules, jti, iat, exp, target

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
