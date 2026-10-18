# UI → financeservice API mapping

This lists every UI action that belongs to **financeservice** (Module 04, fees and billing): the endpoint it calls, who may use it, and its status.
In development, the Vite dev server proxies `/api/v1/finance/*` to financeservice at `http://localhost:8085/financeservice` (its context path).
To point elsewhere, set `FINANCE_SERVICE_URL`.

Code:
- [`src/api/financeService.js`](../src/api/financeService.js): one function per endpoint, the roles each action allows, status labels and rupee formatting.
- [`src/components/FeeRecords.jsx`](../src/components/FeeRecords.jsx): the student profile Fee status card and Fees & payments tab, receipts table, Record payment, Send receipt and Mark cheque as bounced dialogs.
- [`src/components/FeesLive.jsx`](../src/components/FeesLive.jsx): the live Fees & payments page.
- [`src/pages/Operations.jsx`](../src/pages/Operations.jsx): `/fees` shows `FeesLive` for finance staff and principals and the sample page for other roles.
- [`src/pages/Students.jsx`](../src/pages/Students.jsx): the profile uses `useFeeAccount`, `FeeStatusCard` and `FeeAccountDetail`.

The authservice JWT is accepted by financeservice (shared secret). The page works on the user's campus (`branchId`; super administrators: the campus picked in the sidebar); the institution comes from the token.
Amounts are shown in rupees with Indian grouping (₹2,71,000; headline figures ₹19.50 L).

Roles (BRD actor → role): Chief Accountant `CHIEF_ACCOUNTANT`, Finance Controller `FINANCE_CONTROLLER`, Accounts Clerk `ACCOUNTS_CLERK`, Fee Cashier `FINANCE_CASHIER`, Auditor `FINANCE_AUDITOR`, Trust Treasurer `TRUST_TREASURER`, School Principal `SCHOOL_PRINCIPAL`, Parent `APPLICANT_PARENT`. "Finance staff" below = those plus `FINANCE_OFFICER` and `SUPER_ADMIN`.

## Legend

| Status | Meaning |
|---|---|
| **Wired** | The UI calls the endpoint, and the call was checked against the running service (DPS-DELHI-NORTH, Module 04 seed) |
| **Role-gated** | Wired, but the UI shows a note or hides the button when the signed-in role is not allowed |
| **API only** | The endpoint exists (Postman, regression cases) but no screen calls it yet |
| **Gap** | The UI shows the action but no financeservice API backs it yet |

## Fees & payments (`/fees`)

| Screen · action | Method & endpoint | Story | Roles | Status |
|---|---|---|---|---|
| Page (live) | – | – | finance staff, principal | **Role-gated**: other roles see the sample page with a note |
| Metrics **Billed**, **Collected**, **Outstanding** | `GET /api/v1/finance/reports/head-wise-collection?branchId=&from=<1 Apr>&to=<today>` | US-04017 | finance staff, principal | **Wired** |
| Metric **Overdue** ("n students need follow-up") | `GET /api/v1/finance/reports/defaulters?branchId=` | US-04007 | same | **Wired** |
| **Recent transactions** table, search, payment method filter, pager | `GET /api/v1/finance/receipts?branchId=&from=<1 Apr>&to=<today>` | US-04013 | same | **Wired** (filtered and paged in the browser, 8 per page) |
| Receipt row **PDF** | `GET /api/v1/finance/receipts/{id}/pdf` | US-04004 | same, registrar, parent (own) | **Wired** (file download `RCPT-….pdf`) |
| Receipt row **Send** → dialog | `POST /api/v1/finance/receipts/{id}/dispatch` | US-04004 | FINANCE_CASHIER, CHIEF_ACCOUNTANT, ACCOUNTS_CLERK, APPLICANT_PARENT, SUPER_ADMIN | **Role-gated**; issued receipts only. The request is queued (no messaging gateway yet) |
| Receipt row **Bounced** → dialog | `PATCH /api/v1/finance/receipts/{id}/bounce` | US-04019 | FINANCE_AUDITOR, SCHOOL_PRINCIPAL, CHIEF_ACCOUNTANT, SUPER_ADMIN | **Role-gated**; issued cheque / DD receipts only |
| **Outstanding accounts** table and class filter | `GET /api/v1/finance/reports/defaulters?branchId=` | US-04007 | finance staff, principal | **Wired**: overdue since, days, installments, head-wise breakdown, overdue amount |
| Outstanding row **Record payment** | `POST /api/v1/finance/receipts/counter` | US-04013 | FINANCE_CASHIER, TRUST_TREASURER, CHIEF_ACCOUNTANT, SUPER_ADMIN | **Role-gated** (others see the total due) |
| Header **Record payment** → find student | `GET /api/v1/finance/fee-accounts?branchId=&q=` then `POST …/receipts/counter` | US-04013 | same | **Role-gated**. Cash, cheque or demand draft; the result dialog offers **Download receipt** |
| Header / card **Run late fees** → dialog | `POST /api/v1/finance/late-fees/accrue` | US-04005 | TRUST_TREASURER, FINANCE_CASHIER, CHIEF_ACCOUNTANT, SUPER_ADMIN | **Role-gated**; result shows installments charged and fine added |
| **Collection overview** card (per fee head, per payment mode) | head-wise collection | US-04017 | finance staff, principal | **Wired** |
| **Fee heads & ledgers** card | `GET /api/v1/finance/fee-heads` | US-04000 | finance staff, principal, registrar, parent | **Wired** |
| Fee head **Map ledger** / **Change** → dialog | `PATCH /api/v1/finance/fee-heads/{id}/ledger-mapping` | US-04018 | FINANCE_CONTROLLER, ACCOUNTS_CLERK, CHIEF_ACCOUNTANT, SUPER_ADMIN | **Role-gated** |
| **Export statement** | the loaded summary, receipts and defaulters | – | finance staff, principal | **Wired** as a CSV built in the browser |
| Create fee heads and class fee schedules, post demands | `POST /api/v1/finance/fee-heads`, `POST /api/v1/finance/fee-schedules`, `POST …/fee-schedules/{id}/demands` | US-04000 | CHIEF_ACCOUNTANT, FINANCE_CONTROLLER, SUPER_ADMIN | **API only** (seeded for every class) |
| Send reminders, import bank statement, concessions, refunds, Tally export | – | US-04016, US-04009, US-04001, US-04008, US-04006 | – | **Gap** (later Module 04 stories) |

## Student profile (`/students/:studentId`)

| Screen · action | Method & endpoint | Story | Roles | Status |
|---|---|---|---|---|
| Overview → **Fee status** card | `GET /api/v1/finance/students/{id}/fee-account` | US-04004 / US-04013 | finance staff, principal, registrar, parent (own) | **Wired / Role-gated**: outstanding, overdue, status pill (Paid in full / Due / Overdue), late fee, paid of total, next due. 404 → "No fees have been posted for this student yet." |
| Fee status **View account** | – | – | – | Opens the **Fees & payments** tab |
| Fee status **Record payment** | `POST /api/v1/finance/receipts/counter` | US-04013 | FINANCE_CASHIER, TRUST_TREASURER, CHIEF_ACCOUNTANT, SUPER_ADMIN | **Role-gated** (only when something is outstanding) |
| Tab **Fees & payments** → Installments | same fee account | – | same | **Wired**: fee head, installment, due date, amount, paid, balance, status (fine shown) |
| Tab **Fees & payments** → Receipts (PDF / Send / Bounced) | as on the Fees page | US-04004, US-04019 | as on the Fees page | **Wired / Role-gated** |

The registrar sees fees on the profile; finance roles cannot open student profiles (studentservice does not grant them), so they work from the Fees page.

## Student profile → Fee status → Raise fees

When a student has no fee account (404), chief accountants, finance controllers and super administrators see **Raise 2026-2027 fees · ₹…**: it finds the class's latest schedule (`GET /api/v1/finance/fee-schedules?branchId=`) and posts it to the student (`POST /api/v1/finance/fee-schedules/{id}/demands`, US-04000). Installments already due show as overdue straight away.

## Access rules (tools)

`GET /api/v1/finance/access-rules` (any signed-in user) lists every financeservice endpoint with the roles its `@PreAuthorize` allows, read from the running service (same contract as admissionservice's `GET /api/v1/admissions/access-rules`). Used by the student lifecycle runner (`/dev/student-lifecycle-workflow.html`) to check that a school's staff can do each step.
