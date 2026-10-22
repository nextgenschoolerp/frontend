# UI → communicationservice API mapping

This document details every UI action, screen, and workflow in the School ERP frontend wired to **communicationservice** (Module 09: Stakeholder Communication, WhatsApp/SMS Gateway & Parent App).

In development, the Vite dev server proxies `/api/v1/communication/*` to communicationservice at `http://localhost:8090/communicationservice` (its context path). Configure `COMMUNICATION_SERVICE_URL` in `.env.development` or environment variables if deploying remotely.

Production Nginx reverse proxy routes:
```nginx
location /api/v1/communication/ {
    proxy_pass http://localhost:8090/communicationservice/api/v1/communication/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

---

## Code References

- [`src/api/communicationService.js`](../src/api/communicationService.js): Complete API client functions, endpoints, and role authorizations.
- [`src/components/CommunicationsLive.jsx`](../src/components/CommunicationsLive.jsx): The Communications workspace (seven tabs and their dialogs).
- [`src/pages/Admin.jsx`](../src/pages/Admin.jsx):
  - `Communications`: Renders `<CommunicationsLive />` for all communications workflows.
  - `Calendar`: Connected to live calendar events via `commApi.listCalendarEvents` and `commApi.createCalendarEvent`.

---

## Roles & Permissions (Module 09 Matrix)

| Role Code | BRD Stakeholder Actor | Typical Access / Actions |
|---|---|---|
| `PUBLIC_RELATIONS_OFFICER` | Ananya Sengupta (PRO) | Multi-channel broadcast dispatch, emergency alerts, delivery logs, bulletin posts |
| `SCHOOL_PRINCIPAL` | Dr. Sunita Rao (Principal) | Executive emergency broadcast override, grievance SLAs, audit logs, surveys |
| `VICE_PRINCIPAL` | Vice Principal | High-priority broadcasts, grievances, calendar events |
| `ACADEMIC_COORDINATOR` | Academic Coordinator | Broadcasts, calendar event coordination |
| `CLASS_TEACHER` | Kavya Krishnan (Teacher) | Two-way parent messaging, daily bulletin posts, class calendar events |
| `SUBJECT_TEACHER` | Subject Teacher | Direct parent messaging |
| `SECURITY_GUARD` | Ramsingh (Head Guard) | Gate pass verification, physical QR scanner desk, gate audit logging |
| `RECEPTIONIST` | Meena Deshmukh (Receptionist) | Visitor pass check-in, appointment registration, visitor badging |
| `APPLICANT_PARENT` | Rajesh Sharma (Parent) | Digital gate pass creation, feedback surveys, grievances, parent app messaging |
| `SUPER_ADMIN` | Platform Administrator | Global multi-tenant oversight across all endpoints |

---

## Screen & Endpoint Mappings (`/communications`)

The page uses the shared layout: `PageHeader`, four `Metrics`, one `Card` with `Tabs`, boxed `DataTable`s and the standard `Modal` dialogs; success notes and errors use `api-note` / `ApiErr`.
Roles are the guards in `CommunicationRoles.java`, mirrored as `ROLES` in `communicationService.js`. Buttons, tabs and data loads a role may not use are left out, so the page never calls an endpoint that would refuse it.
Tabs: **Circulars** and **Absence alerts** for everyone; **Messages** (messaging), **Gate passes** (gate pass or security), **Visitors** (reception), **Grievances** (reception or parent), **Preferences** (parent).

| Screen · action | Method & endpoint | Story | Roles (`ROLES.*`) | Status |
|---|---|---|---|---|
| Metric **Active circulars**, tab **Circulars** › Active | `GET /broadcasts?tenantId=` | US-09000 | any signed-in user | **Wired**; pinned count under the metric |
| Circulars › Pinned | `GET /broadcasts/pinned?tenantId=` | US-09018 | any signed-in user | **Wired** |
| Circulars › Archived · **Archive** / **Restore** | `GET /broadcasts/archived`, `PUT /broadcasts/{id}/archive` | US-09019 | `broadcast` | **Role-gated** |
| Circulars · **Pin** / **Unpin** | `PUT /broadcasts/{id}/pin` | US-09018 | `leadership` | **Role-gated** |
| Circulars · **Delivery** (dialog: recipient, channel, status, SMS fallback) | `GET /broadcasts/{id}/delivery-logs` | US-09011 | `broadcast` | **Role-gated** |
| Header **New circular** (dialog: title, audience, channel, priority, message) | `POST /broadcasts` | US-09000, US-09010 | `broadcast` | **Role-gated** |
| Header **Emergency alert** (dialog: headline, message; all stakeholders, pinned) | `POST /broadcasts/emergency` | US-09010 | `leadership` | **Role-gated** |
| Header **Scan gate pass** (dialog: pass code, gate) | `POST /gate-passes/verify` | US-09006 | `security` | **Role-gated** |
| Metric **Absence alerts today**, tab **Absence alerts** (date picker) · **Escalate** | `GET /absence-alerts?tenantId=&date=`, `POST /absence-alerts/{id}/escalate` | US-09001 | `attendanceAlerts` | **Role-gated**; others see a note |
| Absence alerts › Daily bulletins | `GET /community/bulletins?tenantId=&date=` | US-09013 | any signed-in user | **Wired** |
| Tab **Messages**: inbox · **Open** (thread dialog, reply, marks read) | `GET /messages/inbox/{userId}`, `GET /messages/threads/{threadId}`, `POST /messages`, `PUT /messages/{id}/read` | US-09004 | `messaging` | **Role-gated** |
| Tab **Gate passes** · **Issue gate pass** (dialog) | `POST /gate-passes` | US-09005 | `gatePass` | **Role-gated**; passes issued in the session are listed (the list endpoint needs a studentId) |
| Gate passes › Gate log | `GET /gate-passes/audit-logs?tenantId=` | US-09017 | `security` | **Role-gated** |
| Metric **Visitors today**, tab **Visitors** · **Register visitor** / **Check in** / **Check out** | `GET`/`POST /visitors/appointments`, `PUT …/{id}/check-in`, `PUT …/{id}/check-out` | US-09007 | `reception` | **Role-gated** |
| Metric **Open grievances**, tab **Grievances** · **Resolve** (dialog) | `GET /community/grievances`, `PUT /community/grievances/{id}` | US-09009 | `reception` | **Role-gated** |
| Grievances · **Log grievance** (dialog) | `POST /community/grievances` | US-09009 | `parent` | **Role-gated** |
| Tab **Preferences**: channel switches, quiet hours | `GET`/`POST /mobile/preferences` | US-09012 | `parent` | **Role-gated** |

Known backend issue: seed users whose id is not a UUID (e.g. `principal_anita`, `u2222222-…`) get **500** instead of 403 from `/messages/inbox/{id}` and `/mobile/preferences`, because the UUID conversion fails before the role check. The page no longer calls them for those roles.
Surveys (US-09014) have no screen: the old page created a new survey on every page load, which was removed.

---

## Story Backlog Verification (`US-09000` to `US-09019`)

| Story ID | Story Title | Core API Controller | UI Component Wiring |
|---|---|---|---|
| `US-09000` | Automated Multi-Channel Emergency & General Broadcast Dispatcher | `BroadcastController` | `CommunicationsLive` Broadcasts tab & compose dialog |
| `US-09001` | Urgent Inclement Weather & Campus Lockdown Emergency Notification Blast | `BroadcastController` | `CommunicationsLive` Emergency modal & flash banner |
| `US-09002` | Automated Student Unexcused Absence & Truancy Escalation Gateway | `AbsenceAlertController` | `CommunicationsLive` Absence alerts escalation panel |
| `US-09003` | Push Notification Engine & Device Registration for Mobile Parent App | `MobileAppController` | Registered device badges & preferences |
| `US-09004` | Parent Multi-Student Ward Switching & Academic Portfolio Linker | `MobileAppController` | Parent ward switcher & student mappings |
| `US-09005` | Secure Two-Way Teacher-Parent In-App Confidential Messaging Channel | `MessagingController` | `CommunicationsLive` Direct message inbox & chat composer |
| `US-09006` | Contactless QR-Coded Student Early Pickup & Gate Pass Clearance | `GatePassController` | `CommunicationsLive` Early gate pass dialog & badge |
| `US-09007` | Campus Visitor Appointment Scheduling & On-Premises Security Badging | `VisitorController` | `CommunicationsLive` Visitor registration & badge issuance |
| `US-09008` | Unified Academic, Sports & Holiday Master Event Calendar Synchronizer | `CommunityEngagementController` | `Calendar()` in `Admin.jsx` & Calendar tab |
| `US-09009` | Stakeholder Grievance Redressal, Ticketing & SLA Escalation Matrix | `CommunityEngagementController` | `CommunicationsLive` Grievance SLA dashboard |
| `US-09010` | Parent Notification Preferences & Granular Delivery Channel Opt-In Matrix | `MobileAppController` | Notification settings & preferences manager |
| `US-09011` | Automated Fee Payment Due & Overdue Milestone Alert Notifications | `BroadcastController` | Multi-channel broadcast finance alerts |
| `US-09012` | Examination Timetable & Hall Ticket Publishing Multi-Channel Dispatcher | `CommunityEngagementController` | Document notification & broadcast dispatcher |
| `US-09013` | Daily School Activity Feed, Digital Bulletin Board & News Flash Stream | `CommunityEngagementController` | `CommunicationsLive` Digital bulletin board feed |
| `US-09014` | School Community Feedback Surveys, Polls & Net Promoter Score Engine | `CommunityEngagementController` | `CommunicationsLive` Survey feedback & ratings |
| `US-09015` | Digital Report Card, Transfer Certificate & Document Delivery Tracker | `CommunityEngagementController` | Document notification dispatcher & vault |
| `US-09016` | Automated Parent-Teacher Conference (PTC) Time Slot Booking System | `VisitorController` | Appointment slot booking & confirmation |
| `US-09017` | Real-Time Security Gate Entry-Exit Scanning & Parent Perimeter Audit | `GatePassController` | `CommunicationsLive` Security guard QR scanner desk |
| `US-09018` | Multi-Campus Centralized Communication Coordination & Hub Broadcasts | `BroadcastController` | Multi-tenant tenant-scoped broadcast dispatcher |
| `US-09019` | Immutable Communication Audit Trail & Compliance Verification Registry | `AuditController` | Security audit logging & SLA tracking |
