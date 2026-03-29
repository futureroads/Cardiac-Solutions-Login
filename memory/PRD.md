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
- [x] Dashboard with dynamic status LEDs, clickable panels
- [x] Backend Management page (admin-only) with Camera Overview, Server Resources, DB Status
- [x] Outage Status page (admin-only) monitoring 18 services across 5 categories
- [x] Hybrid Training page (admin-only) — 5-step workflow: Feedback Queue -> Analyze -> Updates -> Apply -> Monitor
- [x] Hybrid Training syncs from real Readisys API with 3-attempt retry logic
- [x] Hybrid Training Step 2: Real Gemini LLM (gemini-2.5-flash) generates Qwen + OpenCV prompt suggestions
- [x] Hybrid Training Step 2: Editable QWEN and OPENCV text fields for manual prompt editing/pasting
- [x] Hybrid Training Step 2: SUBMIT PROMPTS endpoint saves final prompts as update records
- [x] Frontend error resilience: auto-retries, health pings, error toasts
- [x] Production CrashLoopBackOff fix: sparse indexes, null username cleanup, duplicate removal
- [x] Seed always updates allowed_modules for existing users (no fast-path skip)
- [x] `hybrid_training` added to ALL_MODULE_IDS for all users

## Tech Stack
- Frontend: React 19 + Framer Motion + Tailwind CSS + Shadcn UI
- Backend: FastAPI + Motor (async MongoDB) + PBKDF2 (hashlib) + PyJWT + httpx
- Database: MongoDB
- Deployment: Emergent platform with Cloudflare CDN

## Key Files
- `/app/frontend/src/App.js` — Routes
- `/app/frontend/src/pages/CommandCenterHub.jsx` — Hub with module cards, SSO redirects
- `/app/frontend/src/pages/HybridTraining.jsx` — 5-step training pipeline
- `/app/frontend/src/pages/Dashboard.jsx` — Dynamic status LEDs
- `/app/frontend/src/pages/UserAccess.jsx` — Admin CRUD
- `/app/frontend/src/pages/BackendManagement.jsx` — Admin backend panel
- `/app/frontend/src/pages/OutageStatus.jsx` — Service monitoring
- `/app/frontend/src/pages/LoginPage.jsx` — Multi-stage login + build version
- `/app/backend/server.py` — All backend logic

## Cross-Domain SSO
- JWT Secret: `cardiac-solutions-secure-jwt-secret-key-2024-production`
- Algorithm: HS256
- Expiry: 60 seconds

## Credentials
- **Admin**: futureroads / @@U1s9m6c7@@
- **Users**: Lew/Lew123, Stark/Stark123, Tony/Tony123, Tracey/Tracey123, Nate/Nate123, Jon/Jon123

## Prioritized Backlog

### P1 (High)
- Wire Hybrid Training Step 4 "Apply" to send prompts to real Qwen/OpenCV backends
- Build Daily Report module page
- Build Notifications module page
- Enable real email delivery (Resend API key)

### P2 (Medium)
- Wire dashboard to real backend APIs
- Build Survival Path module page
- Export to CSV, historical charts

### P3 (Nice to Have)
- Mobile responsive optimizations
- Refactor LoginPage.jsx into smaller components
- Split server.py into modular route files (/routes/auth.py, /routes/admin.py, /routes/training.py)
- Implement real-time AED device status

## Known Issues
- Production cold start / "asleep" timeouts (BLOCKED on platform infrastructure)
- Steps 4-5 (Apply/Monitor) still use MOCKED endpoints — Apply doesn't call real Qwen/OpenCV backends
- Email sending is MOCKED (no RESEND_API_KEY configured)
- Dashboard stats/subscribers/devices are MOCKED
