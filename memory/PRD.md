# Cardiac Solutions LLC - AED Monitoring Dashboard PRD

## Original Problem Statement
Build a Tony Stark, dark themed web page for Cardiac Solutions LLC. They sell, service and monitor AEDs in the USA using remote cameras.

## What's Been Implemented
- [x] Login page with animated SVG heart, EKG line, sound effects
- [x] Command Center Hub with "Powering Up" splash screen and dynamic module cards
- [x] MongoDB user storage with bcrypt hashed passwords (7 seeded users)
- [x] Password re-sync on startup (verify-then-rehash only if needed)
- [x] Role-based access control (admin/user roles)
- [x] Module-based hub filtering per user
- [x] User Access admin page (full CRUD)
- [x] Service Tickets card → external link (service.cardiac-solutions.ai)
- [x] Dashboard card → external link (dashboard.cardiac-solutions.ai)
- [x] Server status indicator on login page
- [x] **Production deployment FIXED** — multiple root causes resolved:
  - Stale password hashes (re-sync on startup)
  - Frontend hardcoded preview URL (relative URLs in production builds via apiBase.js)
  - Over-pinned requirements.txt (stripped to direct deps only)
  - Missing DB null checks in auth flow
  - Null-safe user sorting in User Access

## Tech Stack
- Frontend: React 19 + Framer Motion + Tailwind CSS + Shadcn UI
- Backend: FastAPI + Motor (async MongoDB) + bcrypt + PyJWT
- Database: MongoDB
- Deployment: Emergent platform with Cloudflare CDN

## Key Files
- `/app/frontend/src/apiBase.js` — environment-aware API URL (relative in production)
- `/app/frontend/src/pages/CommandCenterHub.jsx` — Hub with module cards + external URLs
- `/app/frontend/src/pages/UserAccess.jsx` — Admin CRUD with retry logic
- `/app/frontend/src/pages/LoginPage.jsx` — Multi-stage login + server status
- `/app/frontend/src/pages/Dashboard.jsx` — JARVIS dashboard (links to external)
- `/app/backend/server.py` — All backend logic, auth, admin CRUD, seeding

## API Endpoints
- POST `/api/auth/login` — Authenticate user
- GET `/api/auth/me` — Current user profile
- GET/POST/PUT/DELETE `/api/admin/users` — User CRUD (admin only)
- GET `/api/admin/modules` — Available modules list
- GET `/api/dashboard/stats|subscribers|devices` — Dashboard data (mocked)
- GET `/api/debug/status` — DB diagnostics (no auth)
- GET `/api/debug/test-login` — Login test diagnostics (no auth)

## Credentials
- **Admin**: futureroads / @@U1s9m6c7@@
- **Users**: Lew/Lew123, Stark/Stark123, Tony/Tony123, Tracey/Tracey123, Nate/Nate123, Jon/Jon123

## Prioritized Backlog

### P0 (Critical)
- Build Daily Report module page
- Build Notifications module page

### P1 (High)
- Build Backend Management page (admin-only)
- Enable real email delivery (Resend API key)
- Wire dashboard to real backend APIs

### P2 (Medium)
- Build Survival Path module page
- Export to CSV, historical charts

### P3 (Nice to Have)
- Mobile responsive optimizations
- Refactor LoginPage.jsx into smaller components

## Notes
- Dashboard data is MOCKED
- Email sending requires RESEND_API_KEY (currently mocked)
- Service Tickets → service.cardiac-solutions.ai (external)
- Dashboard → dashboard.cardiac-solutions.ai (external)
- Notifications card shows "IN DEV" but is clickable (routes to /notifications)
