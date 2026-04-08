# Cardiac Solutions LLC - AED Monitoring Dashboard PRD

## Original Problem Statement
Build a Tony Stark, dark themed web page for Cardiac Solutions LLC. They sell, service and monitor AEDs in the USA using remote cameras.

## What's Been Implemented
- [x] Login page with animated SVG heart, EKG line, sound effects, build version display
- [x] Command Center Hub with "Powering Up" splash screen and dynamic module cards
- [x] MongoDB user storage with PBKDF2 hashed passwords (7 seeded users)
- [x] Role-based access control (admin/user roles)
- [x] Module-based hub filtering per user
- [x] **Dashboard Assignment System** — per-user dashboard type ("standard" or "support")
- [x] User Access admin page (full CRUD + Dashboard Type dropdown + Logout button)
- [x] Cross-domain SSO tokens for Daily Report & Notifications
- [x] Standard Dashboard with dynamic status LEDs, clickable panels, DI scrolling, OpenAI TTS preload
- [x] **Support Dashboard** — subscriber notification center with:
  - Fleet stat cards (Subscribers, Expired B/P, Expiring B/P, Not Ready, Reposition, Unknown)
  - Sortable subscriber table with device issue counts
  - Notification modal with email type selector, editable TO/CC/BCC, device preview grouped by status
  - Delete button per device to remove from email before sending
  - Mailgun integration for sending notifications
  - Subscriber contacts management (CRUD via Contacts modal)
  - Notification history logging to MongoDB
- [x] Backend Management page with live Readisys System card (GET /api/dashboard/top-cards)
- [x] Outage Status page (admin-only) monitoring 18 services
- [x] Hybrid Training page (admin-only) — 5-step workflow with Gemini LLM
- [x] Customer Portal page — Customer Info + AED Units CRUD
- [x] Service Console (/service-tickets) — Subscriber issues, device drill-down, ticket CRUD
- [x] Field Tech Management (Settings modal)
- [x] Ticket Dispatch with Mailgun email
- [x] Public Tech Response page (/tech/:ticketId)
- [x] Clickable Active Tickets / Dispatched stat cards with filtered modal
- [x] Service Console parallel API loading (30s -> ~3s)

## Tech Stack
- Frontend: React 19 + Framer Motion + Tailwind CSS + Shadcn UI
- Backend: FastAPI + Motor (async MongoDB) + PBKDF2 + PyJWT + httpx
- Database: MongoDB
- Integrations: Mailgun (email), OpenAI TTS (Emergent LLM Key), Readisys API (AED data)

## Key DB Collections
- `users`: {id, username, password_hash, role, department, allowed_modules, dashboard_type, di_permissions...}
- `subscriber_contacts`: {subscriber, to_email, cc_email, bcc_emails, sales_rep, updated_at}
- `notification_history`: {subscriber, to_email, cc_email, subject, sent_by, sent_at, success}
- `service_tickets`: {id, subscriber, device_id, issue_type, priority, assigned_tech, tech_email, status...}
- `field_techs`: {name, email, mobile, company, area...}
- `pct_ready_history`: {date, percent_ready, updated_at}

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
- Add camera image support to Support Dashboard notification modal
- Add more status types (Not Ready, Reposition, Unknown) to subscriber table when API available

### P3 (Nice to Have)
- Refactor server.py (~2400 lines) into modular route files
- Refactor LoginPage.jsx, Dashboard.jsx, ServiceTickets.jsx
- Mobile responsive optimizations

## Known Issues
- Camera images not yet shown in notification modal (Readisys API image endpoint not discovered)
- Steps 4-5 in Hybrid Training use MOCKED endpoints
- Support Dashboard only shows Expired B/P and Expiring B/P device details (other statuses in fleet totals only)

## Changelog
- 2026-04-08: Support Dashboard built with subscriber table, notification modal, email sending via Mailgun
- 2026-04-08: Dashboard assignment system (per-user dashboard_type) with User Access admin dropdown
- 2026-04-08: Subscriber contacts CRUD + notification history logging
- 2026-04-08: Backend /api/dashboard/top-cards proxy for live Readiness System data
- 2026-04-02: Fixed Service Console slow load by parallelizing Readisys API calls
- 2026-04-02: Fixed dispatch email fallback for older tickets missing tech_email
- 2026-04-02: Set APP_URL for correct production email links
