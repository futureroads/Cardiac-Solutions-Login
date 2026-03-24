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
1. **System Admin (futureroads)** - Manages user access, controls module visibility per user
2. **AED Technicians** - Monitor device status, check battery/pads expiry
3. **Healthcare Facility Managers** - Overview of subscriber AED fleet
4. **Field Service Engineers** - Track reposition and maintenance needs

## Core Requirements
- JWT-based username/password authentication with MongoDB user storage
- Admin role with "User Access" module for user CRUD + module assignment
- Animated login page with EKG heart visualization and sound
- Multi-stage login flow: heart click -> EKG animation -> login form
- Command Center Hub as post-login landing page with module-based access control
- JARVIS-style dashboard accessible from hub
- Dark theme with cyan/neon accents, red branding for Cardiac Solutions

## What's Been Implemented
- [x] Login page with animated SVG heart and EKG line
- [x] Multi-stage login: heart -> 5s EKG animation with MP3 sound -> login form
- [x] BACK button on login screen
- [x] Custom logo on heart and login screens
- [x] **MongoDB user storage** with bcrypt hashed passwords (migrated from hardcoded)
- [x] 7 seeded users on startup (1 admin + 6 regular users)
- [x] **Role-based access control** (admin/user roles)
- [x] **Module-based hub filtering** - users only see cards they have access to
- [x] **Command Center Hub** with "Powering Up" splash screen
- [x] Hub header with pulsing red heart, SYSTEM ONLINE, OPERATOR badge, LOGOUT button
- [x] **User Access admin page** - Add/Edit/Delete users with Username, Password, Email, Phone, Role, Module Access
- [x] Module selection checkboxes for assigning card visibility per user
- [x] System admin (futureroads) cannot be deleted
- [x] Non-admin users redirected away from /user-access
- [x] JARVIS-style dashboard accessible via Dashboard module card
- [x] Dashboard panels: System Status, AI Recommendations, Service Tickets, etc.
- [x] Send Overview email feature (MOCKED)

## Tech Stack
- Frontend: React 19 + Framer Motion + Tailwind CSS
- Backend: FastAPI (Python) + bcrypt + PyJWT + Motor (async MongoDB)
- Database: MongoDB (users collection with roles + allowed_modules)
- Authentication: JWT with MongoDB-backed users

## API Endpoints
- POST `/api/auth/login` - Authenticate user (returns JWT + user with role/modules)
- GET `/api/auth/me` - Get current user profile
- GET `/api/admin/users` - List all users (admin only)
- POST `/api/admin/users` - Create user (admin only)
- PUT `/api/admin/users/{id}` - Update user (admin only)
- DELETE `/api/admin/users/{id}` - Delete user (admin only)
- GET `/api/admin/modules` - List available modules (admin only)
- GET `/api/dashboard/stats` - Get AED statistics (mocked)
- GET `/api/dashboard/subscribers` - Get subscriber list (mocked)
- GET `/api/dashboard/devices` - Get device list (mocked)
- POST `/api/dashboard/send-overview` - Email dashboard overview (mocked)

## Key Files
- `/app/frontend/src/pages/CommandCenterHub.jsx` - Hub with module filtering
- `/app/frontend/src/pages/UserAccess.jsx` - Admin user management page
- `/app/frontend/src/pages/Dashboard.jsx` - JARVIS dashboard
- `/app/frontend/src/pages/LoginPage.jsx` - Multi-stage login
- `/app/frontend/src/App.js` - Routing with admin guard
- `/app/backend/server.py` - All backend logic, auth, admin CRUD, seeding

## Prioritized Backlog

### P0 (Critical)
- Build Daily Report module page (Module #1) based on user's "Daily Report UI" image
- Build Notifications module page (Module #2)

### P1 (High Priority)
- Set up Resend API key for real email delivery (currently mocked)
- Wire dashboard to backend APIs (currently uses frontend mock data)

### P2 (Medium Priority)
- Build Service Tickets module page (Module #3)
- Build Survival Path module page (Module #4)
- Export data to CSV functionality
- Historical trend charts

### P3 (Nice to Have)
- Device location map view
- Mobile responsive optimizations
- Refactor LoginPage.jsx into smaller components

## Credentials
- **Admin**: futureroads / @@U1s9m6c7@@ (role: admin, all modules + user_access)
- Lew / Lew123 (email: c130usmc@gmail.com)
- Stark / Stark123 (email: iq.ai.solutions@gmail.com)
- Tony / Tony123
- Tracey / Tracey123
- Nate / Nate123
- Jon / Jon123

## Module IDs
- daily_report, notifications, service_tickets, dashboard, survival_path, user_access (admin only)

## Notes
- Dashboard data is MOCKED (stats, subscribers, devices)
- Email sending requires RESEND_API_KEY in backend/.env (currently mocked)
- Users are stored in MongoDB with bcrypt password hashes
- Admin user (user-admin-001) cannot be deleted via API
