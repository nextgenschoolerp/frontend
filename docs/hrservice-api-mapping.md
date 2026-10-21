# UI → hrservice API mapping

This lists every UI action that belongs to **hrservice** (Module 07, staff HR, biometric attendance and payroll): the endpoint it calls, who may use it, and its status.
In development, the Vite dev server proxies `/api/v1/hr/*` to hrservice at `http://localhost:8088/hrservice` (its context path); set `HR_SERVICE_URL` to point elsewhere.

Code:
- [`src/api/hrService.js`](../src/api/hrService.js): one function per endpoint, the roles each action allows (`HR_ROLES`), labels.
- [`src/pages/Staff.jsx`](../src/pages/Staff.jsx): Staff & faculty directory (`/staff`), profile (`/staff/:staffId`, `/staff/me`), add / edit (`/staff/new`, `/staff/:staffId/edit`).
- The profile's timetable cards call academicservice (`GET /api/v1/lms/timetables/teachers/{userId}`), see [academicservice-api-mapping.md](academicservice-api-mapping.md).

How the data maps onto the rest of the system:
- A staff profile (`staff_profiles`) is linked to its sign-in account by `userId` = authservice `users.user_id`. That is how `/staff/me` finds the signed-in person, how a teacher may apply for their own leave, and how the profile finds the teacher's Module 06 timetable (academicservice keys teachers by the same user ID).
- `branchId` is the campus code (`DPS-DELHI-NORTH`), the same value as the sign-in response's `branchId` and every other service's branch. The directory lists the campus picked in the sidebar.
- The seed (`hrservice/src/main/resources/db/seed/module07_hr_payroll_seed.sql`) gives every seeded DPS staff account a profile; see [environment.md](../../.agents/skills/test-ui/references/environment.md).

Roles: hrservice accepts the BRD role names and the role codes authservice issues (`HrRoles.java`).
"School staff" = every staff role (teachers `SUBJECT_TEACHER` / `CLASS_TEACHER` / `HOUSE_MASTER` / `TEACHER`, office `ADMIN_CLERK` / `OFFICE_CLERK`, principals `PRINCIPAL` / `SCHOOL_PRINCIPAL` / `VICE_PRINCIPAL`, HR, finance, admissions, exam and academic roles, `SUPER_ADMIN`); parents are refused.
**Pay and identity fields** (basic salary, PAN, Aadhaar, PF UAN, ESI, bank) are only returned to `HR_MANAGER`, `PAYROLL_ACCOUNTANT`, `SCHOOL_PRINCIPAL`, `PRINCIPAL`, `SUPER_ADMIN` and to the employee on their own profile; everyone else gets them as `null`.

| Status | Meaning |
|---|---|
| **Wired** | Calls the endpoint; checked against the running service with the Module 07 seed |
| **Role-gated** | Wired; hidden or read-only for roles that may not use it |
| **API only** | Endpoint exists (Postman, regression cases), no screen yet |
| **Gap** | The screen shows something hrservice has no endpoint for |

## Staff & faculty directory (`/staff`)

| Screen · action | Method & endpoint | Story | Roles | Status |
|---|---|---|---|---|
| Directory table, tabs **All / Teaching / Support / Archived**, search, department filter, **Export list** | `GET /api/v1/hr/employees?branchId=` | US-07000 | school staff | **Wired**. Sorted by name. Teaching = subject departments (Mathematics, Science, English, Hindi, Social Science, Computer Science, Physical Education); Archived = resigned / retired / inactive. 10 per page |
| Column **Availability**, filter, metric **On leave today**, card **Leave & cover** | `GET /api/v1/hr/leaves` | US-07003 | school staff | **Wired**: approved leave covering today, with cover notes |
| Metric **Leave requests** | `GET /api/v1/hr/leaves` | US-07004 | school staff | **Wired**: pending applications of the listed staff |
| Metric **On campus today** | `GET /api/v1/hr/attendance/summary?date=` | US-07013 | principals, `HR_MANAGER`, `DEPARTMENT_HEAD`, `COMPLIANCE_OFFICER`, `SUPER_ADMIN` | **Role-gated** (others see "—"): staff with a biometric punch today |
| Card **Probation & reviews** | `GET /api/v1/hr/employees` | US-07010 | school staff | **Wired**: staff not yet confirmed, with the review date |
| **Add staff member**, row **Edit** | – | – | `HR_MANAGER`, `SCHOOL_PRINCIPAL`, `PRINCIPAL`, `SUPER_ADMIN` | **Role-gated**: hidden for everyone else |
| Directory for a parent | `GET /api/v1/hr/employees` | – | – | 403 → role note |

## Staff profile (`/staff/:staffId`, `/staff/me`; tabs in `?tab=`)

| Screen · action | Method & endpoint | Story | Roles | Status |
|---|---|---|---|---|
| Summary card, **Employment & contact** | `GET /api/v1/hr/employees/{staffId}` | US-07000 | school staff | **Wired** (404 → "not found") |
| `/staff/me` | `GET /api/v1/hr/employees/me` | US-07000 | school staff | **Wired**: the signed-in user's profile by the token's `userId`; 404 → "no HR record linked to your account" |
| **Pay & statutory details** card | same | US-07000 | pay viewers or the employee | **Role-gated**: only rendered when hrservice returns the salary; bank account shown as the last 4 digits |
| **Qualifications & professional development** | `GET /api/v1/hr/development/cpd/{staffId}` | US-07009 | school staff | **Wired**: latest course, hours and credits |
| **Leave & attendance**: taken, pending, balances, list | `GET /api/v1/hr/leaves?staffId=`, `GET /api/v1/hr/leaves/quotas?staffId=` | US-07003, US-07017 | school staff | **Wired** (current year's quotas) |
| **Apply for leave** (own profile) / **Record leave** (someone else) | `POST /api/v1/hr/leaves` `{staffId, leaveType, startDate, endDate, reason, proxyNotes}` | US-07003 | own profile: school staff; others: `HR_MANAGER`, `PAYROLL_ACCOUNTANT`, principals, `DEPARTMENT_HEAD`, `SUPER_ADMIN` | **Wired**. 403 for someone else's profile; days are counted inclusive (calendar days, weekends included) |
| Pending leave · **Approve** / **Reject** | `PUT /api/v1/hr/leaves/{applicationId}/review` `{status, reviewComments}` | US-07004 | `HR_MANAGER`, `DEPARTMENT_HEAD`, principals, `SUPER_ADMIN` (not on their own profile) | **Role-gated**. Approval deducts the quota |
| **Teaching assignments**, **Today's timetable**, tab **Timetable** | academicservice `GET /api/v1/lms/timetables/teachers/{userId}`, `GET /api/v1/lms/bell-schedules/{id}` | US-06002 | academic staff (academicservice) | **Wired** for teaching departments with a linked account; HR roles outside academicservice see the role note |
| **Message staff** | `mailto:` | – | – | Client-only |
| **Documents** tab | – | – | – | **Gap**: hrservice has no document vault endpoint |
| **Edit staff details** | – | – | manage roles | **Role-gated** |

## Add / edit staff (`/staff/new`, `/staff/:staffId/edit`)

| Screen · action | Method & endpoint | Story | Roles | Status |
|---|---|---|---|---|
| Edit form load | `GET /api/v1/hr/employees/{staffId}` | US-07000 | manage roles | **Wired** |
| **Save changes** (new) | `POST /api/v1/hr/employees` `{employeeCode, firstName, lastName, department, designation, basicSalary, joiningDate, branchId, userId?, email?, phone?, contractTerms?, qualifications?, probationEndDate?}` | US-07000 | `HR_MANAGER`, `SCHOOL_PRINCIPAL`, `PRINCIPAL`, `SUPER_ADMIN` | **Wired**. 400 `VALIDATION_FAILED` / `BRANCH_REQUIRED`, 409 duplicate employee code; starts on probation (6 months unless given) |
| **Save changes** (edit) | `PUT /api/v1/hr/employees/{staffId}` | US-07000 | same | **Wired**. PAN, Aadhaar, PF/ESI and bank fields left out of the request are kept |
| Other roles | – | – | – | Form read-only with a note; Save disabled |
| Photo, emergency contact, date of birth, line manager | – | – | – | **Gap**: not in the staff profile model (removed from the form) |
| Teaching assignments, system role | – | – | – | Managed in Teaching & learning (academicservice) and Settings → Users & permissions (authservice) |

## hrservice capabilities with no screen yet

| Capability | Endpoint | Story |
|---|---|---|
| Biometric scan ingest / list | `POST /api/v1/hr/attendance/scans`, `GET /api/v1/hr/attendance/scans/{staffId}` | US-07001 |
| Shifts and assignments | `POST/GET /api/v1/hr/attendance/shifts`, `POST /api/v1/hr/attendance/shifts/assignments` | US-07002 |
| Punch anomalies and regularisation | `GET /api/v1/hr/attendance/anomalies`, `POST …/anomalies/{staffId}`, `PUT …/anomalies/{id}/regularise` | US-07015 |
| Leave quota configuration | `POST /api/v1/hr/leaves/quotas` | US-07017 |
| Appraisals | `POST /api/v1/hr/employees/appraisals`, `GET /api/v1/hr/employees/{staffId}/appraisals` | US-07010 |
| Resignation / NOC, archive | `POST /api/v1/hr/employees/resignations`, `PUT …/{id}/clearance`, `POST/GET /api/v1/hr/employees/archives` | US-07016, US-07019 |
| Payroll, LWP, statutory returns, payslips, bank payouts, tax declarations, forecasts, settlements | `/api/v1/hr/payroll/**`, `/api/v1/hr/development/settlement/**` | US-07005 … US-07018 |

## Known gaps in hrservice

- `GET /attendance/summary` always returns `onLeaveCount: 0` and counts the day in UTC; the directory counts leave from `GET /leaves` instead.
- Leave days include weekends (calendar days); the UI says so in the dialog.
- `GET /leaves` without `staffId` returns the whole tenant (no paging).
- The sign-in token has no `branchId` claim, so a new profile's campus comes from the form (defaulting to the user's campus).

## Test accounts (local seed)

All `Password@123`, tenant DPS. HR: `hr_priya` (HR_MANAGER), `accountant_vikram` (PAYROLL_ACCOUNTANT), `auditor_mehta` (AUDITOR), `compliance_singh` (COMPLIANCE_OFFICER). Every other seeded DPS staff account has a profile: for example `teacher_kavya` (on probation, pending leave, maternity quota), `teacher_deepa` (sick leave today), `teacher_farhan` (late today, rejected leave), `viceprincipal_kiran` (approves leave, sees pay fields), `teacher_neeraj` (resigned, NOC issued). `principal_sunita` is the only DPS-DELHI-SOUTH profile.
