# Cardiac Solutions LLC - AED Monitoring Dashboard PRD

## Original Problem Statement
Build a Tony Stark, dark themed web page for Cardiac Solutions LLC. They sell, service and monitor AEDs in the USA using remote cameras.

## What's Been Implemented
- [x] Login page with animated SVG heart, EKG line, sound effects, build version display
- [x] Command Center Hub with "Powering Up" splash screen and dynamic module cards
- [x] MongoDB user storage with PBKDF2 hashed passwords (7 seeded users)
- [x] Role-based access control (admin/user roles)
- [x] Dashboard Assignment System — per-user dashboard type ("standard" or "support")
- [x] User Access admin page (full CRUD + Dashboard Type dropdown)
- [x] Standard Dashboard with dynamic status LEDs, DI scrolling, OpenAI TTS preload
- [x] **Support Dashboard** with:
  - Fleet stats (subscribers, issues by type)
  - Sortable table: EXP B/P, EXPIRING, NOT RDY, REPOS, TOTAL columns
  - Real-time data from Readisys Voice API per-subscriber status
  - Notification modal with email template from user's .docx
  - Camera images from Readisys `/voice/aed/{id}/last-image` API
  - Device detail columns: Batt/Pads Exp, Battery %, Signal, Capture Timestamp
  - **Device Detail Drawer** — click any device row to see full-size image, all device info, diagnostics, and editable notes (saved to MongoDB)
  - **Notification History** — view all sent emails with subscriber filter, manual status override, notes, sorting
  - **Editable Details per AED** — support reps can customize detail text per device before sending; reflected in Mailgun HTML
  - Clickable issue counts open DeviceListModal; interactive stat card filters with progress bars
  - Status Correction Feedback modal; Auto CC tprince@cardiac-solutions.net
  - Email subject: "AED Report and Action Items"
  - Section label: "AED Batteries and Pads Expired/Expiring"
  - 51 subscriber contacts seeded from Excel + Readisys name variants
  - Contacts modal with SET/EMPTY badges, search, alphabetical sort
- [x] Backend Management page with live Readisys data
- [x] Service Console with parallel API loading, ticket CRUD, dispatch, tech response

## Key API Endpoints
- `GET /api/support/dashboard-data` — aggregated subscriber issues + readiness stats (actual & adjusted %)
- `GET /api/support/subscriber/{name}/devices` — all devices for subscriber
- `GET /api/support/aed-image/{sentinel_id}` — camera image metadata
- `POST /api/support/send-notification` — send email via Mailgun + track notified AEDs in DB
- `GET /api/support/notification-history` — sent email history with optional subscriber filter
- `GET /api/support/notified-aeds` — list all tracked notified AEDs
- `GET /api/support/notified-aeds/summary` — summary stats (total, unresolved, resolved, breakdowns)
- `POST /api/support/notified-aeds/refresh` — manually trigger status refresh from Readisys
- `GET/PUT /api/support/device-notes/{sentinel_id}` — device notes CRUD

## Tech Stack
- Frontend: React 19 + Framer Motion + Tailwind CSS + Shadcn UI
- Backend: FastAPI + Motor (async MongoDB) + PBKDF2 + PyJWT + httpx
- Database: MongoDB
- Integrations: Mailgun (email), OpenAI TTS (Emergent LLM Key), Readisys API (AED data + images)

## Credentials
- **Admin**: futureroads / @@U1s9m6c7@@
- **Support User**: Lew / Lew123 (dashboard_type: support)

## Prioritized Backlog
### P1 (High)
- Build Daily Report module page
- Build Notifications module page
- View past images for a device (needs Readisys API check)

### P2 (Medium)
- Build Survival Path module page

### P3 (Nice to Have)
- Refactor server.py (~2600 lines) into modular route files
- Refactor large frontend components

## Changelog
- 2026-04-18: Added Image History feature to DeviceListModal — red HISTORY button below each camera image opens modal showing all captured images for that device (stored in MongoDB, auto-populated from Readisys API)
- 2026-04-17: Created "Stark" dashboard type — MAP as hero center card, DI panel compact below with overview mode, assigned to user Stark. Skip-to-dashboard login when only "dashboard" module enabled.
- 2026-04-16: Backfill logic for notified AEDs from historical notification_history records; percent format fixed to XX.X%; uses /devices API for accurate device list
- 2026-04-16: Added Notified AEDs Detail View modal — drill into each tracked device with full notification timeline, days since notified, current vs original status, filter/sort by subscriber/status/age
- 2026-04-16: Built Notified AEDs Readiness Tracker — tracks each AED in sent notification emails, shows Actual vs Adjusted readiness %, daily auto-refresh of statuses, expandable card with issue type & subscriber breakdowns
- 2026-04-15: Switched Map Module to use new `GET /api/map/readiness/subscribers/summary` API — single call replaces N+1 subscriber calls, pins color-coded by readiness %, instant popups
- 2026-04-15: Added editable DETAILS field per AED device in notification email modal (preview + Mailgun HTML)
- 2026-04-14: Added Map Module (Google Maps), stat card filters, progress bars, notification history sorting, clickable issue counts, status correction feedback, auto CC
- 2026-04-09: Added Device Detail Drawer (full image, all device info, diagnostics, editable notes)
- 2026-04-09: Added Notification History modal with subscriber filter
- 2026-04-09: Added Batt/Pads Exp, Battery %, Signal, Capture Timestamp columns to email preview
- 2026-04-09: Updated email subject to "AED Report and Action Items"
- 2026-04-09: Renamed section to "AED Batteries and Pads Expired/Expiring"
- 2026-04-08: Bulk imported 48 subscriber contacts from Excel spreadsheet
- 2026-04-08: Camera images integrated from Readisys API
- 2026-04-08: Support Dashboard + dashboard assignment system built
