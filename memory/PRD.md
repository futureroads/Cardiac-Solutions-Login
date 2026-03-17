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
- JWT-based email/password authentication
- Animated login page with EKG heart visualization
- Custom AED electrode pad cursor
- Dashboard with real-time AED status monitoring
- Subscriber table with sort/filter capabilities
- Dark theme with cyan/neon accents

## What's Been Implemented (Dec 2025)
- [x] Login page with animated SVG heart and EKG line
- [x] Custom AED pad cursor that clamps on mouse click
- [x] Shock effect (brightness flash) on authentication
- [x] JWT authentication (register/login)
- [x] Dashboard with 10 status cards (Total Monitored, % Ready, Ready, Not Ready, Reposition, Not Present, Expired B/P, Expiring B/P, Lost Contact, Unknown)
- [x] Subscriber table with 8 mock subscribers
- [x] Sort by alphabetical/total/ready/not ready
- [x] Filter by status dropdown
- [x] Holographic grid background
- [x] Glassmorphic UI components
- [x] Rajdhani + Exo 2 typography
- [x] HUD corner decorations

## Tech Stack
- Frontend: React 19 + Framer Motion + Tailwind CSS
- Backend: FastAPI + Motor (async MongoDB driver)
- Database: MongoDB
- Authentication: JWT with bcrypt password hashing

## API Endpoints
- POST `/api/auth/register` - Register new user
- POST `/api/auth/login` - Authenticate user
- GET `/api/auth/me` - Get current user
- GET `/api/dashboard/stats` - Get AED statistics
- GET `/api/dashboard/subscribers` - Get subscriber list
- GET `/api/dashboard/devices` - Get device list

## Prioritized Backlog

### P0 (Critical)
- All core features implemented ✅

### P1 (High Priority)
- Real-time device status from cameras
- Individual device detail view
- Alert/notification system for critical issues
- Device location map view

### P2 (Medium Priority)
- Export data to CSV functionality
- Historical trend charts
- User management (admin roles)
- Device maintenance scheduling

### P3 (Nice to Have)
- Mobile responsive optimizations
- Sound effects (charging whine, heartbeat beep)
- Dark/light theme toggle
- Multi-language support

## Next Tasks
1. Implement real camera integration for live AED monitoring
2. Add notification center with push alerts
3. Build device detail page with camera feed
4. Create export functionality for CSV reports
5. Add interactive map showing AED locations
