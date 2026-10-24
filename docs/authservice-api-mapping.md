# UI → authservice API mapping

Every UI action that belongs to **authservice** (Module 01), the endpoint it calls, who may use it, and its status.
In development the Vite dev server proxies `/api/*` to authservice at `http://localhost:8082/authservice` (its context path) (and `/api/v1/admissions/*`
to admissionservice at `http://localhost:8083/admissionservice`), so no CORS setup is needed. Override with `AUTH_SERVICE_URL` / `ADMISSION_SERVICE_URL`.

Code: [`src/api/client.js`](../src/api/client.js) (fetch wrapper, JWT, error envelope),
[`src/api/authService.js`](../src/api/authService.js) (one function per endpoint), [`src/auth.jsx`](../src/auth.jsx) (session).

## Legend

| Status | Meaning |
|---|---|
| **Wired** | The UI calls the endpoint and was checked against the running service |
| **Client-only** | No endpoint exists; handled in the browser |
| **Gap** | The UI shows the action but authservice has no API for it; the control is disabled or still static |

## Sign-in & session

| Screen · action | Method & endpoint | Story | Roles | Status |
|---|---|---|---|---|
| Initial Setup · **Check bootstrap requirement** | `GET /api/v1/auth/bootstrap/status` | BOOTSTRAP | public | **Wired**. If database has 0 tenants, automatically routes `/login` to `/setup` |
| Initial Setup · **Download Excel Template** | `GET /api/v1/auth/bootstrap/template` | BOOTSTRAP | public | **Wired**. Streams `School_ERP_Initial_Setup_Template.xlsx` |
| Initial Setup · **Upload Excel spreadsheet** | `POST /api/v1/auth/bootstrap/upload` | BOOTSTRAP | public | **Wired**. Multipart file upload; provisions tenant, branch & IT admin (`must_change_password=true`) |
| Initial Setup · **Quick setup form submit** | `POST /api/v1/auth/bootstrap` | BOOTSTRAP | public | **Wired**. JSON payload alternative for direct onboarding without Excel |
| Login · **Sign in** (email or username + password) | `POST /api/v1/auth/login` | US-00000 | public | **Wired**. Stores `accessToken`, `tenantId`, `roles`; 401 shows the service message (wrong credentials, locked until …, inactive account) |
| Login · **Keep me signed in** | — | — | — | **Client-only**: token kept in `localStorage` (checked) or `sessionStorage` |
| Login · **Forgot password?** → Reset your password · **Send reset link** | `POST /api/v1/auth/forgot-password` `{identifier}` | US-01001 | public | **Wired**. Development builds return `resetToken`; the page then offers a development link to the reset screen |
| Reset link → Choose a new password · **Set new password** | `POST /api/v1/auth/reset-password` `{token,newPassword,confirmPassword}` | US-01002 | public | **Wired** (page and validation checked; submit not exercised to keep seed passwords) |
| Forced first login (`mustChangePassword`) → **Update password** | `PUT /api/v1/auth/change-password` | US-01004 | the change-only token | **Wired**. Every other route redirects to `/change-password`; after the change the user signs in again for a full token |
| Settings · Security & audit · **Change password** | `PUT /api/v1/auth/change-password` | US-01003 | any signed-in user | **Wired** |
| Toolbar · account name / role / initials | data from the login response (`/api/v1/auth/me` is wrapped in `authService.me`) | US-00000 | signed-in | **Wired**. The response has no first/last name, so the display name is derived from the email (`mahesh.iyer@…` → "Mahesh Iyer"). Overview and Help greetings use it |
| Toolbar · **Sign out** | — | — | — | **Client-only**: authservice has no logout endpoint; the JWT is discarded and expires on its own (`jwt.expiration`) |
| Any API call returning **401** with a token / JWT `exp` reached | — | — | — | **Client-only**: session cleared, "Your session has expired" on the login page |

## Workspace chrome

| Screen · action | Method & endpoint | Story | Roles | Status |
|---|---|---|---|---|
| Sidebar · **campus switcher** | `GET /api/v1/tenants/{tenantId}/branches` | US-00009 | SUPER_ADMIN | **Wired**. Lists the tenant's branches; selection kept per browser. Other roles see the static "Main campus" label |
| Layout (every page after sign-in) · **regional preferences** | `GET /api/v1/tenants/{tenantId}/regional-settings` | – | any signed-in user of the tenant (SUPER_ADMIN: any tenant) | **Wired**. `{timeZone, currency, dateFormat, language, saved, updatedAt, updatedBy}`; defaults (Asia/Kolkata, INR, DD MMM YYYY, en-IN, `saved:false`) when the school never saved any. Loaded into `regional.js` on sign-in / reload; the copy in `localStorage` (`oakridge.regional.<tenantId>`) is a cache and the offline fallback. Another tenant → 403 |

## Settings → General tab (`/settings`)

| Screen · action | Method & endpoint | Story | Roles | Status |
|---|---|---|---|---|
| Regional preferences · **Save preferences** / page **Save changes** | `PUT /api/v1/tenants/{tenantId}/regional-settings` `{timeZone, currency, dateFormat, language}` | – | SUPER_ADMIN, TRUSTEE, SCHOOL_PRINCIPAL, PRINCIPAL, IT_SYSTEM_ADMIN | **Wired**. Values must be in the option lists of `regional.js` (23 IANA zones, 19 ISO 4217 currencies, 8 date patterns, 13 locales), else 400 `VALIDATION_FAILED` with one error per field; another tenant → 403 (SUPER_ADMIN may cross); audit entry `UPDATE_REGIONAL_SETTINGS`. Other roles see the values read-only (selects disabled, no Save) |
| School profile · Save | — | — | — | **Gap**: the tenant profile has no update API |

## Settings → Users & permissions tab (`/settings?tab=users`)

| Screen · action | Method & endpoint | Story | Roles | Status |
|---|---|---|---|---|
| Roles table | `GET /api/v1/roles` | US-00002 | TRUSTEE, SUPER_ADMIN | **Wired** (other roles see a role notice) |
| **Edit role** → permission matrix | `GET /api/v1/roles/{roleId}/permissions` | US-00002 | TRUSTEE, SUPER_ADMIN | **Wired** |
| Edit role · **Save permissions** | `POST /api/v1/roles/{roleId}/permissions` `{permissions:[{screenName,canRead,canWrite,canDelete,canExport}]}` | US-00002 | TRUSTEE, SUPER_ADMIN | **Wired**. Upsert per screen, so the UI sends every row; unticking all four boxes removes access (there is no delete endpoint) |
| Roles table · "Users" count column | — | — | — | **Gap**: no endpoint counts users per role; column removed |
| **Invite user** | — | — | — | **Gap**: authservice has no user-provisioning / invitation endpoint (only super-admin self-registration). Button disabled with an explanation |
| "Manage users →" | `GET /api/v1/tenants/{tenantId}/users?branchId=` | – | SUPER_ADMIN | **API available, screen not built**: staff with roles and account state (active / locked / must change password), no credential data. Used today by the admission workflow checker (`/dev/admission-workflow.html`) |

## Settings → Security & audit tab (`/settings?tab=security`)

| Screen · action | Method & endpoint | Story | Roles | Status |
|---|---|---|---|---|
| "Two-factor authentication enabled" pill | `GET /api/v1/mfa/config?tenantId=` | US-00003 | PRINCIPAL, SUPER_ADMIN | **Wired**. Shows methods (authenticator app / SMS) and whether sensitive actions need a second factor |
| "Session timeout" | `GET /api/v1/security/session-config?tenantId=` | US-00004 | IT_SYSTEM_ADMIN, SUPER_ADMIN | **Wired**. Idle timeout, max duration, concurrent sessions |
| **View audit log** | `GET /api/v1/audit/logs?userId=&ipAddress=&from=&to=` | US-00005 | SECURITY_AUDITOR, SUPER_ADMIN | **Wired**. Lists the 100 newest events; "Filter by user ID" → Apply sends `userId`. The 500 that every filter combination used to return is fixed in authservice: `AuditLogRepository` now builds the optional filters as JPA Specifications, because the old `(:param IS NULL OR …)` sent untyped nulls that PostgreSQL rejected |
| Settings · **Save changes** / Discard (school profile, academic year) | — | — | — | **Gap**: school profile and term settings are not authservice data (tenant profile has no update API). Regional preferences are saved, see the General tab |

## Staff → Add / Edit staff → Access & permissions

| Screen · action | Method & endpoint | Story | Roles | Status |
|---|---|---|---|---|
| **System role** dropdown | `GET /api/v1/roles` | US-00002 | TRUSTEE, SUPER_ADMIN | **Wired** for those roles; others keep the static list |
| Staff portal access / Finance administration access checkboxes, **Save changes** | — | — | — | **Gap**: creating a login, assigning a role (`user_roles`) or activating a user has no authservice endpoint; staff records belong to the HR service, which does not exist yet |

## authservice capabilities with no screen yet

These endpoints exist but the prototype has no screen for them. Suggested homes in brackets.

| Capability | Endpoints | Suggested screen |
|---|---|---|
| Unlock account, admin password reset (US-01005) | `POST /api/v1/auth/{userId}/unlock`, `POST /api/v1/auth/{userId}/admin-reset-password` | Staff profile · "Reset access" |
| View / revoke a user's sessions (US-00014) | `GET`, `POST /api/v1/auth/{userId}/sessions[/revoke]` | Staff profile · Security tab |
| Role cloning (US-00011), role delegation (US-00006) | `POST /api/v1/roles/{roleId}/clone`, `/api/v1/roles/delegations` | Settings · Users & permissions |
| IP whitelist, lockout and password policy (US-00012/13/17) | `/api/v1/security/ip-whitelist`, `/lockout-policy`, `/password-policy` | Settings · Security & audit tab |
| MFA and session config **updates** | `PUT /api/v1/mfa/config`, `PUT /api/v1/security/session-config` | Settings · Security & audit tab ("Save changes") |
| API tokens (US-00007) | `/api/v1/integrations/api-tokens` | Settings · Integrations tab |
| Tenant isolation, SSL (US-00001/16), branch provisioning (US-00009) | `/api/v1/tenants/{tenantId}/…` | Super-admin console |
| Society directory: all societies with campuses, staff with roles | `GET /api/v1/tenants`, `GET /api/v1/tenants/{tenantId}/users` | Super-admin console · Settings → Users & permissions ("Manage users") |
| Privacy anonymization, field encryption (US-00008/19) | `/api/v1/compliance/…` | Settings · Security & audit |
| Backups (US-00010), alert rules (US-00020), high-privilege audit (US-00015) | `/api/v1/disaster-recovery/backups`, `/api/v1/security/alert-rules`, `/api/v1/audit/high-privilege-logs` | Settings · Security & audit |

## Test accounts (local seed)

Seeded by `authservice/src/main/resources/db/seed/module01_auth_seed.sql`, password `Password@123`:
`superadmin_mahesh` (SVKM, SUPER_ADMIN: every Settings card), `principal_george` (forced password change),
`teacher_farhan` (locked out for 25 minutes after the seed runs), `teacher_neeraj` (inactive).
