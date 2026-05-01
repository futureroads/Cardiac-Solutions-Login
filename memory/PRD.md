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
- 2026-05-01: **Stark Dashboard expanded readiness trend modal** — Made the System Status sparklines clickable. Opens a full-width readiness trend modal (`ReadinessTrendModal`) showing both Adjusted (solid green) and Actual (dashed gray) % lines overlaid on a 1100×360 SVG chart with Y-axis ticks, X-axis date labels, legend, and 7D/14D/30D/60D window selector. Hovering any day reveals a 5-card breakdown: SELECTED DAY · ADJUSTED · ACTUAL · AEDs NOTIFIED · AEDs RESOLVED. Backend `/api/support/readiness-history` now augments each daily point with `notified_count` and `resolved_count` aggregated from `notified_aeds`. Click propagation stopped on the sparkline so it doesn't also open the existing System Readiness Breakdown modal.
- 2026-05-01: **Stark Dashboard sparklines** — Mirrored the Support Dashboard's 7-day sparklines onto the Stark Dashboard System Status panel. Two compact sparklines (130×28) appear under the gauge labeled ADJ 7-DAY and ACT 7-DAY, sourced from the same `/api/support/readiness-history?days=7` endpoint. Same color logic (green=up, red=down, blue=flat), tooltips, and fallback states (1-point dot, 0-point hidden).
- 2026-05-01: **Settings dropdown + Detail Messages** — Replaced the standalone "CONTACTS" button on the Support Dashboard with a "SETTINGS" dropdown containing two items: CONTACTS (existing) and DETAIL MESSAGES (new). The new feature lets Mark create reusable templates of "Details" text keyed on (status, subscriber, AED model). Backend: 4 new endpoints — `GET/POST /api/support/detail-messages`, `DELETE /api/support/detail-messages/{id}`, `GET /api/support/detail-messages/lookup`, plus helper `GET /api/support/aed-models` returning distinct AED models seeded with 14 common models. NotificationModal now fetches all templates on mount and pre-populates the Details cell for each AED row via best-match (subscriber+model > subscriber > model > ALL/ALL). Mark can still edit per-row before sending.
- 2026-04-30: **Reversed trend colors + 7-day sparklines** — Corrected the readiness trend semantics: UP=GREEN (improvement), DOWN=RED (regression), FLAT=BLUE line. Added a 72×18 SVG sparkline below each percentage showing the last 7 daily snapshots with color driven by net 7-day direction and a tooltip like "7-day: 84.5% → 82.0% (Δ -2.5)". Backend additions: new `readiness_daily` collection (auto-upserted on each `/api/support/dashboard-data` call) and new endpoint `GET /api/support/readiness-history?days=7` returning ordered daily points.
- 2026-04-30: **Readiness Trend Arrows** — Added trend indicators to the right of both ACTUAL READY and ADJUSTED READY percentages in the Notified AEDs Readiness Tracker bar. Per user spec: UP=red (rising), DOWN=green (dropping), flat=blue horizontal line (<0.05% change). Hover tooltip shows `"Yesterday: X% · Δ ±Y"`. Backend now exposes `prev_pct_ready` alongside existing `prev_pct_ready_adjusted` in `/api/support/dashboard-data` → `readiness` block. Verified live via DOM inspection: both arrows rendering correctly with title tooltips.
- 2026-04-30: **DELIV/OPEN consistency fix** — Two-pronged solution to the "OPEN > DELIV" anomaly (e.g. Opelika PD: 4 sent / 3 deliv / 2 open): (a) Added runtime `delivered_effective = max(delivered, opened_by_to, clicked)` safety guard in `/api/support/subscriber-engagement` — DELIV can never be less than OPEN or CLICKED in reports. (b) Added `_backfill_delivered_from_opens_core` helper + `POST /api/support/backfill-delivered-from-opens` endpoint. For records with `open_count>0` or `click_count>0` but no `delivered_at`, stamps the earliest open/click/sent timestamp as `delivered_at` and sets `delivered_inferred: true`. Wired into the 30-min auto-loop. Reason: SendGrid webhook ordering or legacy pre-webhook sends sometimes left records with opens but no delivery event.
- 2026-04-29: **Auto-alert on send failures** — Added `_send_send_failure_alert` helper that fires a styled HTML alert email to `SEND_FAILURE_ALERT_TO` (default `iq.ai.solutions@gmail.com`) whenever a notification send fails — both the SendGrid non-2xx path and the exception path are wired in. Alert includes timestamp, user (sent_by), subscriber, recipient addresses, subject, result summary, error_type, error_message, and a link to `/admin/email-errors`. Verified end-to-end: forced a `KeyError` failure → log entry recorded → alert email dispatched (confirmed via backend log). Added `SEND_FAILURE_ALERT_TO` env var.
- 2026-04-29: **Admin Email Activity Monitor** — New admin-only page at `/admin/email-errors` (also surfaced as a Hub module card and a small `EMAIL LOG` button on the Support Dashboard top bar visible only when `user.role==="admin"`). Backend exposes `GET /api/admin/email-activity?days=&user=&status=` (admin-gated) returning the last 500 sends with totals + per-user breakdown + distinct-users list. UI features: time-window selector, user-filter dropdown, ALL/SUCCESS/FAILED chips, free-text search, click-row drawer with full details (WHEN/USER/SUBSCRIBER/TO/CC/BCC/SUBJECT/SENDGRID RESPONSE/SG-Message-ID/LINKED AEDs/DELIVERY EVENTS, plus error_type + error_message for failed sends). Also fixed the send-notification flow to **persist failures** (exceptions, network errors, etc.) into `notification_history` with `success=False`, `error_type`, `error_message` — previously only non-2xx responses were logged. Verified live as `futureroads`.
- 2026-04-29: **Auto-backfill linked_sentinel_ids** — Added `_backfill_linked_sids_core` helper (and `POST /api/support/backfill-linked-sids` manual trigger). For each legacy `notification_history` record with empty/missing `linked_sentinel_ids`, finds notified_aeds for the same subscriber whose `notification_dates` (or first/last_notified_at) match the email's `sent_at` ±10 minutes, and stamps the matched sentinel IDs back onto the email record. Now runs silently after each 30-min status refresh in `_notified_aeds_daily_loop`. Verified on preview: linked 262 sentinel IDs to 2 legacy records.
- 2026-04-29: **Per-AED targeted NOTIFY** — Each row in the SubscriberDetailModal's ACTIVE ISSUES tab now has a dedicated NOTIFY button that opens the compose modal pre-filtered to just that single AED (so Mark can chase a specific stuck device without spamming the full subscriber). Compose modal title shows a clear "SINGLE AED: {sentinel_id}" amber badge. Implemented via new `targetSentinelId` prop on `NotificationModal`.
- 2026-04-29: **Subscriber Status Icons + Detail Modal** — Replaced the static "SENT" badge in the ACTIONS column with a 4-state notification status indicator: 🔴 NEEDS NOTIFY (active issues, zero sent), 🟡 PARTIAL (some sent, some new still pending), 🟡 STALE >14d (notified but unresolved >14d), 🟢 ALL NOTIFIED (every active issue covered). Clicking a subscriber name opens a new full-screen `SubscriberDetailModal` with three tabs: ACTIVE ISSUES (per-AED Sentinel ID/location/dates/days-since-notified/email-opened), RESOLVED, and EMAIL HISTORY (per-email DELIV/OPEN/CLICK/BOUNCE tracking). Backend: added `GET /api/support/subscriber/{subscriber}/breakdown` aggregator endpoint and `stale_unresolved` field on each subscriber in `/api/support/dashboard-data`.
- 2026-04-28: **Bigger NotificationModal** — Expanded the Send Notification modal from 1100px to 1500px wide and 92vh→95vh tall. The email preview area (white card) now gets significantly more horizontal/vertical room, making it much easier to scan multiple AED rows, full location strings, and camera images at a glance before sending.
- 2026-04-28: **Backfill matching relaxed + diagnostics** — `_backfill_email_opens_core` now (1) treats legacy `notification_history` records with `open_count > 0` but empty `events` array as TO-opens (preserves count without per-event log), (2) adds a "subscriber fallback" path that credits the most recent open from a subscriber to that subscriber's unresolved AEDs when neither linked_sentinel_ids nor ±10-min time-window match, (3) returns rich diagnostic counters (`candidate_aeds`, `to_recipient_opens`, `matched_via_linked_sids`, `matched_via_time_window`, `matched_via_subscriber_fallback`, `unmatched_*`). Frontend toast shows the matched count plus the most actionable reason when 0 are credited. Resolves the production case where 58+ opens existed but none lifted Adjusted % above Actual.
- 2026-04-28: **SG DEBUG modal** — Added a purple "SG DEBUG" button in the Support Dashboard top bar that opens `SendGridDebugModal`. Shows: total webhook events logged, last 30 webhook events with EVENT type / EMAIL / SG MESSAGE ID / MATCHED? Y/N, and the last 20 sent emails (notification_history) with their delivery + open + click counts. Surfaces sg_message_id mismatches, missing webhook config, or the simple "no opens yet" case. Calls existing `GET /api/support/sendgrid-debug` endpoint.
- 2026-04-28: **Auto-Backfill Email Opens** — Refactored backfill into reusable `_backfill_email_opens_core()` helper; now runs automatically after every 30-min `notified_aeds` status refresh in `_notified_aeds_daily_loop`. Logs `[NOTIFIED_AEDS] Auto-backfill credited N AEDs as opened` whenever new matches are found. Adjusted % Ready now self-corrects continuously without requiring manual SYNC OPENS clicks.
- 2026-04-28: **SYNC OPENS button** — Wired up a new emerald-bordered "SYNC OPENS" button in the Notified AEDs Readiness Tracker bar that calls existing `POST /api/support/backfill-email-opens`. Scans `notification_history` for TO-recipient opens and back-stamps `email_opened=true` on matching `notified_aeds` (via `linked_sentinel_ids` direct match OR ±10min time-window fallback for legacy records). Resolves the "Adjusted % Ready = Actual % Ready" issue caused by historical email opens never being linked to the AEDs they referenced. Toast reports `newly_matched_aeds` and current opened/unresolved totals.
- 2026-04-28: **Engagement Modal Math Hardening** — `SubscriberEngagementModal` now recomputes DELIV %, OPEN %, BOUNCE %, CLICK % locally on the frontend using `emails_sent` as the denominator, regardless of what the backend returns. Guarantees the displayed math always matches the disclaimer even if a deployed environment serves a stale JS bundle. New explicit "FORMULAS:" footer spells out each formula. (Resolves user-reported math mismatch on deployed build.)
- 2026-04-26: **SendGrid Open/Click Tracking** — Built `POST /api/sendgrid/events` webhook to receive SendGrid event batches (delivered/open/click/bounce/dropped/spamreport). Captures `X-Message-Id` on every send and correlates incoming events to `notification_history` records, updating `delivered_at`, `open_count`, `click_count`, `first_opened_at`, `bounced` flags. New TRACKING column on the HISTORY modal shows DELIV/OPEN/CLICK/BOUNCED badges per email. Replaced the old prompt-based "TEST EMAIL" button with a full `TrackingTestModal` that polls live and shows the lifecycle (SENT → DELIVERED → OPENED → CLICKED) with an event log. Added `/api/support/sendgrid-debug` diagnostic endpoint for troubleshooting webhook delivery.
- 2026-04-26: **Stark Map Fullscreen + Satellite View** — Added FULLSCREEN/EXIT FULLSCREEN button on Stark Dashboard map (covers entire viewport, ESC to close, auto-resizes Google Map). Added MAP/SATELLITE style toggle (uses Google's hybrid imagery). Color-coded AED dots by live Readisys status: green=READY, red=NOT READY/LOST CONTACT/EXPIRED B/P, yellow=other. Popup shows current status with matching color badge.
- 2026-04-26: **Voice API for AED Locations** — Added `GET /api/voice/aeds-near` endpoint accepting either `location` (free-text geocoded server-side via Google Maps) or explicit `lat`+`lng`. Returns nearest AEDs within `radius_miles` (default 25) along with each device's live status from Readisys, distance in miles, and a natural-language `voice_answer` ready for AEDA/voice apps. Auth via `X-Voice-API-Key` header. Production URL: `https://cardiac-solutions.ai/api/voice/aeds-near`.
- 2026-04-25: **Stark Dashboard Map AED Mode + Geocoded Subscriber Data** — Added Subscribers/AEDs toggle, subscriber filter dropdown, and prominent control bar on Stark Dashboard map. Seeded 280 Georgia Power AED locations (from `Geocoded_AED_Full_List.xlsx`), re-geocoded server-side via Google Maps Geocoding API for 63 ROOFTOP + 10 RANGE_INTERPOLATED + 14 GEOMETRIC_CENTER + 3 APPROXIMATE precision tiers. Added auto-seed on backend startup from bundled `subscriber_map_seed.json` so production stays in sync.
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
