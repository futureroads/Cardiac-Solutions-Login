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
  - Fleet stats (40 subscribers, 203 Expired, 28 Expiring, 6 Not Ready, 144 Reposition, 3 Unknown)
  - Sortable table: EXP B/P, EXPIRING, NOT RDY, REPOS, TOTAL columns
  - Real-time data from Readisys Voice API per-subscriber status
  - Notification modal with email template from user's .docx
  - **Camera images** from Readisys `/voice/aed/{id}/last-image` API
  - Device detail: serial number, site/building/placement, status, image
  - Email type filter, device removal, editable TO/CC/BCC
  - Mailgun email sending + notification history logging
  - 38 subscriber contacts seeded from Excel spreadsheet
- [x] Backend Management page with live Readisys data
- [x] Service Console with parallel API loading, ticket CRUD, dispatch, tech response
- [x] Hybrid Training, Customer Portal, Outage Status pages

## Key API Endpoints (from AEDA APIs doc)
- `GET /voice/subscriber/{name}/devices` — all devices for subscriber with s3_url
- `GET /voice/aed/{sentinel_id}/last-image` — camera image metadata + download_url
- `GET /aed-images/download?url={s3_url}` — actual image binary (PNG)
- `GET /voice/subscriber/{name}/status?brief=true` — per-subscriber counts
- `GET /voice/subscribers` — list all subscribers
- `GET /devices/by-status?subscriber=X&status=Y` — devices filtered by status

## Tech Stack
- Frontend: React 19 + Framer Motion + Tailwind CSS + Shadcn UI
- Backend: FastAPI + Motor (async MongoDB) + PBKDF2 + PyJWT + httpx
- Database: MongoDB
- Integrations: Mailgun (email), OpenAI TTS (Emergent LLM Key), Readisys API (AED data + images)

## Credentials
- **Admin**: futureroads / @@U1s9m6c7@@
- **Support User**: Lew / Lew123 (dashboard_type: support)
- **Users**: Stark/Stark123, Tony/Tony123, Tracey/Tracey123, Nate/Nate123, Jon/Jon123

## Prioritized Backlog
### P1 (High)
- Build Daily Report module page
- Build Notifications module page

### P2 (Medium)
- Build Survival Path module page

### P3 (Nice to Have)
- Refactor server.py (~2500 lines) into modular route files
- Refactor large frontend components

## Changelog
- 2026-04-08: Camera images integrated from Readisys API into Support Dashboard notification modal
- 2026-04-08: Upgraded to Voice API for full per-subscriber status (40 subs, all issue types)
- 2026-04-08: Added NOT RDY and REPOS columns to subscriber table
- 2026-04-08: Email template integrated from user's .docx (3 sections: Alignment, Missing, Pads)
- 2026-04-08: 38 subscriber contacts seeded from Excel spreadsheet
- 2026-04-08: Support Dashboard + dashboard assignment system built
- 2026-04-02: Service Console performance fix + dispatch email fix
