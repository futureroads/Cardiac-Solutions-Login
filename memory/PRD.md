# Cardiac Solutions LLC - AED Monitoring Dashboard PRD

## Original Problem Statement
Build a Tony Stark, dark themed web page for Cardiac Solutions LLC. They sell, service and monitor AEDs in the USA using remote cameras. Features include:
- High-tech, futuristic login page with obsidian black background
- Glowing cyan heart symbol with EKG line animation
- Stark Industries HUD aesthetic with Jarvis-style circular data rings
- Custom AED pad cursor that clamps on click
- "Shock" effect on login
- Dashboard for AED monitoring

## User Personas
1. **AED Technicians** - Monitor device status, check battery/pads expiry
2. **Healthcare Facility Managers** - Overview of subscriber AED fleet
3. **Field Service Engineers** - Track reposition and maintenance needs

## Core Requirements
- JWT-based username/password authentication (6 hardcoded users)
- Animated login page with EKG heart visualization and sound
- Multi-stage login flow: heart click -> EKG animation -> login form
- Command Center Hub as post-login landing page with module navigation
- JARVIS-style dashboard accessible from hub
- Dark theme with cyan/neon accents, red branding for Cardiac Solutions

## What's Been Implemented
- [x] Login page with animated SVG heart and EKG line
- [x] Multi-stage login: heart -> 5s EKG animation with MP3 sound -> login form
- [x] BACK button on login screen
- [x] Custom logo on heart and login screens
- [x] JWT authentication with 6 hardcoded users (Lew, Stark, Tony, Tracey, Nate, Jon)
- [x] User email addresses added (Lew: c130usmc@gmail.com, Stark: iq.ai.solutions@gmail.com)
- [x] **Command Center Hub** - Post-login landing page with 5 module cards (Daily Report, Notifications, Service Tickets, Survival Path, Dashboard)
- [x] Module cards with LIVE/IN DEV status badges, icons, descriptions
- [x] Hub header with branding, SYSTEM ONLINE status, OPERATOR badge
- [x] Hub footer with copyright, version, documentation, support, logout
- [x] Routing: / → /hub (authenticated), /hub, /dashboard, catch-all redirect
- [x] JARVIS-style dashboard (v11 layout from user HTML) - accessible via Dashboard module card
- [x] Dashboard panels: System Status, % Ready, Status Breakdown, Status Changes vs Yesterday
- [x] AI Recommendations panel with INFO/ACT/WARN badges
- [x] Customer Notifications panel (compact) with SEND EMAIL buttons
- [x] Camera Battery panel - 90% ring gauge + Dead/1/4/1/2/3/4/Full breakdown
- [x] Camera Cellular panel - signal meter bar graph with counts
- [x] Service Tickets panel with status badges
- [x] Voice Query panel (compact, single-row layout)
- [x] Send Overview panel - emails dashboard summary to logged-in user's email
- [x] Red "glow" effect on text, heart icon, EKG line
- [x] Removed "Made with Emergent" watermark
- [x] Custom social media link previews

## Tech Stack
- Frontend: React 19 + Framer Motion + Tailwind CSS
- Backend: FastAPI (Python) + Resend (email)
- Database: MongoDB (currently unused, data is mocked)
- Authentication: JWT with hardcoded user dictionary

## API Endpoints
- POST `/api/token` - Authenticate user (returns JWT)
- GET `/api/users/me` - Get current user profile
- GET `/api/aed-data` - Get mock AED statistics
- POST `/api/send-overview` - Email dashboard overview (MOCKED)

## Key Files
- `/app/frontend/src/pages/CommandCenterHub.jsx` - **NEW** Command Center Hub (post-login landing)
- `/app/frontend/src/pages/Dashboard.jsx` - JARVIS dashboard (Module #5)
- `/app/frontend/src/pages/LoginPage.jsx` - Multi-stage login experience
- `/app/frontend/src/App.js` - Routing (/, /hub, /dashboard, catch-all)
- `/app/backend/server.py` - All backend logic, auth, API routes, email

## Prioritized Backlog

### P0 (Critical)
- Build Daily Report module page (Module #1) based on user's "Daily Report UI" image
- Build Notifications module page (Module #2)

### P1 (High Priority)
- Set up Resend API key for real email delivery (currently mocked)
- Wire dashboard to backend APIs (currently uses frontend mock data)
- Migrate hardcoded users to MongoDB
- Refactor LoginPage.jsx (~650 lines) into smaller components

### P2 (Medium Priority)
- Build Service Tickets module page (Module #3)
- Build Survival Path module page (Module #4)
- Individual device detail view
- Alert/notification system for critical issues
- Export data to CSV functionality
- Historical trend charts
- User management (admin roles)

### P3 (Nice to Have)
- Device location map view
- Mobile responsive optimizations
- Sound effects (charging whine, heartbeat beep)
- Dark/light theme toggle

## Credentials
- Lew / Lew123 (email: c130usmc@gmail.com)
- Stark / Stark123 (email: iq.ai.solutions@gmail.com)
- Tony / Tony123
- Tracey / Tracey123
- Nate / Nate123
- Jon / Jon123

## Notes
- All backend data is MOCKED (hardcoded users, static AED stats)
- Dashboard currently uses inline mock data, not connected to backend API
- Email sending requires RESEND_API_KEY in backend/.env (currently not set, mocked success)
