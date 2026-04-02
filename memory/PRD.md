# Cardiac Solutions LLC - AED Monitoring Dashboard PRD

## Original Problem Statement
Build a Tony Stark, dark themed web page for Cardiac Solutions LLC. They sell, service and monitor AEDs in the USA using remote cameras.

## What's Been Implemented
- [x] Login page with animated SVG heart, EKG line, sound effects, build version display
- [x] Command Center Hub with "Powering Up" splash screen and dynamic module cards
- [x] MongoDB user storage with PBKDF2 hashed passwords (7 seeded users)
- [x] Password auto-migration (bcrypt -> PBKDF2) on login
- [x] Role-based access control (admin/user roles)
- [x] Module-based hub filtering per user
- [x] User Access admin page (full CRUD + Logout button)
- [x] Cross-domain SSO tokens for Daily Report & Notifications (60s expiry, jti single-use, HS256)
- [x] Token expiry validation on page load (auto-logout if expired)
- [x] Login always redirects to /hub
- [x] Dashboard with dynamic status LEDs, clickable panels, DI scrolling, OpenAI TTS preload
- [x] Backend Management page (admin-only) with Camera Overview, Server Resources, DB Status
- [x] Outage Status page (admin-only) monitoring 18 services across 5 categories
- [x] Hybrid Training page (admin-only) — 5-step workflow with real Gemini LLM integration
- [x] Customer Portal page (admin-only) — Customer Information form + AED Units table with CRUD
- [x] Service Console (/service-tickets) — Subscriber issues, device drill-down, ticket CRUD
- [x] Field Tech Management (Settings modal) — CRUD for field technicians
- [x] Ticket Dispatch with Mailgun email (from no-reply@cardiac-solutions.ai)
- [x] Public Tech Response page (/tech/:ticketId) for technicians to update status
- [x] OpenAI TTS ("JARVIS" voice) preloaded on Dashboard mount
- [x] Daily Percent Ready tracker with DI feed integration
- [x] Parallel Readisys API calls for fast Service Console loading
- [x] Dispatch email fallback: resolves tech_email from field_techs when missing on older tickets
- [x] Production CrashLoopBackOff fix: sparse indexes, null username cleanup, duplicate removal
- [x] Frontend error resilience: auto-retries, health pings, error toasts

## Tech Stack
- Frontend: React 19 + Framer Motion + Tailwind CSS + Shadcn UI
- Backend: FastAPI + Motor (async MongoDB) + PBKDF2 (hashlib) + PyJWT + httpx
- Database: MongoDB
- Integrations: Mailgun (email), OpenAI TTS (via Emergent LLM Key), Readisys API (AED data)
- Deployment: Emergent platform with Cloudflare CDN

## Key Files
- `/app/frontend/src/App.js` — Routes
- `/app/frontend/src/pages/ServiceTickets.jsx` — Service Console with modals
- `/app/frontend/src/pages/TechResponse.jsx` — Public tech response portal
- `/app/frontend/src/pages/Dashboard.jsx` — TTS preload, DI percent ready
- `/app/frontend/src/pages/CommandCenterHub.jsx` — Hub with module cards, SSO redirects
- `/app/frontend/src/pages/HybridTraining.jsx` — 5-step training pipeline
- `/app/frontend/src/pages/UserAccess.jsx` — Admin CRUD
- `/app/frontend/src/pages/LoginPage.jsx` — Multi-stage login + build version
- `/app/backend/server.py` — All backend logic (~2100 lines)

## Credentials
- **Admin**: futureroads / @@U1s9m6c7@@
- **Users**: Lew/Lew123, Stark/Stark123, Tony/Tony123, Tracey/Tracey123, Nate/Nate123, Jon/Jon123

## Prioritized Backlog

### P1 (High)
- Build Daily Report module page
- Build Notifications module page

### P2 (Medium)
- Build Survival Path module page
- Wire Hybrid Training Step 4 "Apply" to real Qwen/OpenCV backends

### P3 (Nice to Have)
- Refactor server.py (~2100 lines) into modular route files
- Refactor LoginPage.jsx, Dashboard.jsx, ServiceTickets.jsx
- Mobile responsive optimizations
- Implement real-time AED device status

## Known Issues
- Steps 4-5 (Apply/Monitor) in Hybrid Training still use MOCKED endpoints
- Dashboard subscribers/devices/tickets are still MOCKED — only System Status and DI scroll are real

## Changelog
- 2026-04-02: Fixed Service Console slow load (30+s -> ~3s) by parallelizing Readisys API calls with asyncio.gather
- 2026-04-02: Fixed dispatch email failure on older tickets by adding field_techs collection fallback lookup
- 2026-04-02: Parallelized cache pre-warm on startup (both caches fill simultaneously)
- 2026-04-02: OpenAI TTS integrated, Dashboard DI percent ready tracker, Service Console built
- 2026-03-31: Fixed Dashboard System Status showing 0 on cold start
