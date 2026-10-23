# UI → analyticservice API mapping

This document details the UI screens and actions in the School ERP frontend wired to **analyticservice** (Module 10: Enterprise Integrations, API Webhooks, Compliance & Analytics).

In development, the Vite dev server proxies `/api/v1/analytics/*` to analyticservice at `http://localhost:8091/analyticservice` (its context path). Configure `ANALYTICS_SERVICE_URL` in `.env.development` or the shell environment to point elsewhere.

Production Nginx reverse proxy route (`deploy/nginx.conf`):
```nginx
location ^~ /api/v1/analytics {
    rewrite ^ /analyticservice$uri break;
    proxy_pass http://analyticservice:8091;
}
```

> [!NOTE]
> The Vite env variable is `ANALYTICS_SERVICE_URL` (plural, matching the `/api/v1/analytics` prefix) even though the service directory is `analyticservice`.

---

## Code References

- [`src/api/analyticService.js`](../src/api/analyticService.js): API client for all five analyticservice controllers, role groups (`ROLES`) mirroring `AnalyticsRoles`, report categories and chart types.
- [`src/components/ReportsLive.jsx`](../src/components/ReportsLive.jsx): The Reports workspace (saved custom reports, run results, trustee KPI dashboard, create-report and KPI-snapshot dialogs). The weekly attendance preview on the same page comes from studentservice.
- [`src/pages/Admin.jsx`](../src/pages/Admin.jsx): `Reports` renders `<ReportsLive />`.

---

## Roles & Permissions (Module 10 Matrix)

Role groups from `com.kvs.analytics.config.AnalyticsRoles`; `SUPER_ADMIN` and `ADMIN` belong to every group.

| UI role group (`ROLES.*`) | Backend constant | Role codes |
|---|---|---|
| `reportBuilder` | `REPORT_BUILDER` | `DATA_ANALYST`, `SYSTEM_INTEGRATOR` |
| `analyticsView` | `ANALYTICS_VIEW` | `DATA_ANALYST`, `TRUSTEE`, `PRINCIPAL`, `SCHOOL_PRINCIPAL` |
| `integration` | `INTEGRATION_MANAGE` | `CHIEF_TECHNOLOGY_OFFICER`, `SYSTEM_INTEGRATOR` |
| `webhook` | `WEBHOOK_MANAGE` | `CHIEF_TECHNOLOGY_OFFICER`, `DATA_ANALYST`, `SYSTEM_AUTOMATION` |
| `compliance` | `COMPLIANCE_MANAGE` | `COMPLIANCE_OFFICER`, `PRINCIPAL`, `SCHOOL_PRINCIPAL`, `EXAM_CONTROLLER`, `DATABASE_ADMINISTRATOR` |
| `audit` | `AUDIT_VIEW` | `SECURITY_AUDITOR`, `AUDITOR`, `CHIEF_TECHNOLOGY_OFFICER`, `PRINCIPAL`, `SCHOOL_PRINCIPAL` |
| `backup` | `BACKUP_MANAGE` | `CHIEF_TECHNOLOGY_OFFICER`, `DATABASE_ADMINISTRATOR` |
| `gateway` | `GATEWAY_INGEST` | `SYSTEM_AUTOMATION`, `SYSTEM_INTEGRATOR` |

Roles outside a group do not see that group's controls; the Reports page shows a short notice in their place instead of calling the endpoint.

---

## Screen & Action Catalog

| Screen · Action / Tab | Method & Endpoint | User Story | Allowed Roles | Status |
|---|---|---|---|---|
| Reports · Saved reports list, category counts, search | `GET /api/v1/analytics/reports/custom?tenantId=` | US-10009 | `reportBuilder` | **Wired** |
| Reports · Create report dialog | `POST /api/v1/analytics/reports/custom` | US-10009 | `reportBuilder` | **Wired** |
| Reports · Run (results table + CSV download) | `POST /api/v1/analytics/reports/custom/{id}/execute` | US-10009 | `reportBuilder` | **Wired** |
| Reports · Trustee KPI dashboard (latest period + history) | `GET /api/v1/analytics/reports/trustee/kpi?tenantId=` | US-10014 | `analyticsView` | **Wired** |
| Reports · Record KPI snapshot dialog | `POST /api/v1/analytics/reports/trustee/kpi` | US-10014 | `analyticsView` | **Wired** |
| Integrations (endpoints, API keys, rate limits, latency rules) | `/api/v1/analytics/integrations/*` | US-10000, US-10010, US-10011, US-10015 | `integration` | Client only (no screen yet) |
| Connectors (biometric, payment webhooks, bank recon, WhatsApp, Tally) | `/api/v1/analytics/connectors/*` | US-10001–US-10004, US-10012 | `gateway`, `webhook` | Client only (no screen yet) |
| Board compliance (CBSE LOC, anonymisation, certificates) | `/api/v1/analytics/compliance/*` | US-10005, US-10013, US-10017 | `compliance` | Client only (no screen yet) |
| System health, audit, backups, replicas, SLAs, incidents | `/api/v1/analytics/system/*` | US-10006–US-10008, US-10016, US-10018, US-10019 | `audit`, `backup` | Client only (no screen yet) |

### Request bodies sent by the Reports page

- **Create report** (`CustomReportRequest`): `tenantId`, `reportName`, `category` (`ACADEMIC` · `ATTENDANCE` · `FINANCE` · `STAFF_HR`), `chartType` (`TABLE` · `BAR` · `LINE` · `PIE`), `createdByUserId`, and `dimensionsJson` / `metricsJson` as JSON string arrays built from the comma-separated inputs (null when blank).
- **Record KPI snapshot** (`TrusteeKpiRequest`): `tenantId`, `periodName` (required), `feeCollectionPct`, `averageAttendancePct`, `studentEnrollmentCount`, `teacherStudentRatio`, `boardPassPercentage`, `summaryNotes` (blank fields are sent as null).

---

## Story Backlog Verification

| Story | Capability | UI coverage |
|---|---|---|
| US-10009 | Custom report builder | Reports page: list, create, run, CSV |
| US-10014 | Trustee executive KPI dashboards | Reports page: dashboard, record snapshot |
| US-10000, US-10010, US-10011, US-10015 | Integration platform, latency alerts, rate limits, API keys | API client only |
| US-10001, US-10002, US-10003, US-10004, US-10012 | Biometric, payment webhooks, WhatsApp, Tally, bank recon | API client only |
| US-10005, US-10013, US-10017 | CBSE LOC export, anonymisation, compliance certificates | API client only |
| US-10006, US-10007, US-10008, US-10016, US-10018, US-10019 | Health, audit logs, backups, query profiling, replica failover, uptime SLAs | API client only |
