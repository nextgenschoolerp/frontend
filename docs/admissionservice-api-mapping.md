# UI → admissionservice API mapping

This lists every UI action that belongs to **admissionservice** (Module 02): the endpoint it calls, who may use it, and its status.
In development, the Vite dev server proxies `/api/v1/admissions/*` to admissionservice at `http://localhost:8083/admissionservice` (its context path).
It sends every other `/api/*` call to authservice at `http://localhost:8082/authservice`. To point elsewhere, set `ADMISSION_SERVICE_URL` / `AUTH_SERVICE_URL`.

Code:
- [`src/api/admissionService.js`](../src/api/admissionService.js): one function per endpoint, plus status labels.
- [`src/components/Admissions.jsx`](../src/components/Admissions.jsx): the applications list, the review modal and the shared hooks.
- [`src/components/NewAdmission.jsx`](../src/components/NewAdmission.jsx): Add student → application, and the document upload.
- [`src/api/client.js`](../src/api/client.js): the JWT, the error envelope and the multipart `upload`.

Authentication uses the authservice JWT; admissionservice validates it with the shared secret.
Every list is scoped to `tenantId` (from the login response) and `branchId`. The branch is the user's own `branchId`, which is new in the authservice login response.
For super administrators it is the campus picked in the sidebar switcher.

## Legend

| Status | Meaning |
|---|---|
| **Wired** | The UI calls the endpoint, and the call was checked against the running service (admission officer `admissions_deepak`, campus DPS-DELHI-NORTH) |
| **Role-gated** | Wired, but the UI shows a note instead of calling when the signed-in role is not allowed (a 403 also renders "Not available for your role.") |
| **Gap** | The UI shows the action but there is no matching admissionservice API, or the screen is still static |

## Students → directory

| Screen · action | Method & endpoint | Story | Roles | Status |
|---|---|---|---|---|
| Metric **Admission applications** ("Awaiting review") | `GET /api/v1/admissions/enquiries?tenantId=&branchId=` | US-02001 | FRONT_OFFICE_COUNSELOR, ADMISSION_OFFICER, SUPER_ADMIN | **Wired**. Counts applications in an open status (new, contacted, assessment scheduled/passed, offer issued) |
| Tab **Admissions (n)** → applications table | same as above | US-02001 | same | **Wired**. Newest first. Columns: applicant and application number, grade and academic year, guardian, source, received date, status pill. The tab is kept in the URL (`/students?tab=admissions`) |
| Admissions card · "*n* new applications" | same as above | US-02001 | same | **Wired**: counts `NEW_INQUIRY` and `CONTACTED` |
| Admissions card · "*n* with documents pending" | `GET /api/v1/admissions/document-follow-ups?tenantId=&branchId=&status=OPEN` | US-02011 | REGISTRAR, ADMISSION_OFFICER, FRONT_OFFICE_COUNSELOR, SUPER_ADMIN | **Wired** |
| Admissions card · **Review applications →** | — | — | — | Switches to the Admissions tab |
| Table row · **Review application** → modal header and details | uses the list row (`GET /api/v1/admissions/enquiries/{id}` is wrapped as `getEnquiry`) | US-02001 | as above | **Wired** |
| Review modal · **Documents** | `GET /api/v1/admissions/enquiries/{id}/documents` | US-02004 | ENTRANCE_EXAM_EVALUATOR, REGISTRAR, ADMISSION_OFFICER, SUPER_ADMIN | **Wired / Role-gated** (a counselor sees "Not available for your role.") |
| Review modal · **Assessments** | `GET /api/v1/admissions/enquiries/{id}/evaluations` | US-02003 | REGISTRAR, ADMISSION_OFFICER, SUPER_ADMIN | **Wired / Role-gated** |
| Review modal · **Offers** | `GET /api/v1/admissions/enquiries/{id}/offers` | US-02006 | FINANCE_CASHIER, ADMISSION_OFFICER, SCHOOL_PRINCIPAL, SUPER_ADMIN | **Wired / Role-gated** |
| Review modal · **Calls** | `GET /api/v1/admissions/enquiries/{id}/calls` | US-02015 | FRONT_OFFICE_COUNSELOR, ADMISSION_OFFICER, MARKETING_MANAGER, SUPER_ADMIN | **Wired / Role-gated** |
| **Export list** | — | — | — | **Gap**: there is no export endpoint |

## Students → Add student (`/students/new`)

A student record in admissionservice is created only by converting an application that has passed every step (US-02010).
So "Add student" records an **application** (an enquiry) in the admissions pipeline.

| Screen · action | Method & endpoint | Story | Roles | Status |
|---|---|---|---|---|
| **Save draft** | `POST /api/v1/admissions/enquiries` | US-02001 | FRONT_OFFICE_COUNSELOR, ADMISSION_OFFICER, APPLICANT_PARENT, SUPER_ADMIN | **Wired**. Form → `CaptureEnquiryRequest`: first and last name; class → `targetGradeId` (`Class 7` → `GRADE-07`, `Nursery` → `GRADE-NURSERY`); section and year group are kept in `remarks`; academic year → `academicYearId` (`2026–2027` → `AY-2026-27`); primary guardian, guardian email and mobile number → guardian fields; relationship is kept in `remarks`; `referralSource=WALK_IN`. Missing required fields or a bad phone number are reported before the call, and service validation messages are shown. On success it stays on the page with "Application APP-… saved" |
| **Add student** | same as above | US-02001 | same | **Wired**: saves, then opens `/students?tab=admissions` |
| Documents panel · **Upload document** (type and file) | `POST /api/v1/admissions/enquiries/{id}/documents?documentType=` (multipart `file`) | US-02004 | ENTRANCE_EXAM_EVALUATOR, SCHOOL_PRINCIPAL, ADMISSION_OFFICER, SUPER_ADMIN | **Wired / Role-gated**. Enabled once the application is saved; PDF, JPG or PNG up to 5 MB. The list reloads from `GET …/documents` |
| Upload student photo, date of birth, gender, house, class, medical fields, emergency contact | — | — | — | **Gap**: `CaptureEnquiryRequest` has no fields for these. They are entered but not sent; class placement comes later (US-02012) |

## Overview

| Screen · action | Method & endpoint | Story | Roles | Status |
|---|---|---|---|---|
| Needs your attention · **Admission applications** quantity → Review | `GET /api/v1/admissions/enquiries?tenantId=&branchId=` | US-02001 | as for the list | **Wired**. Shows the live open count and links to `/students?tab=admissions`; for other roles it shows the static figure |

## Verified (built-in browser, Vite → admissionservice through the proxy)

- The Admissions tab lists the 9 seeded DPS-DELHI-NORTH applications. The metric shows 7 awaiting review: 2 new and 5 with documents pending.
- Review modal for Aarav Sharma: 3 verified documents, 2 passed assessments, 1 accepted offer, and "No calls logged yet."
- Add student → Save draft created application `APP-2026-…` with status New enquiry. The PDF upload was then listed as *pending*, and the Overview count went from 7 to 8.
- The test application and its document were deleted afterwards.

## admissionservice capabilities with no screen yet

The UI has no pages for these yet. All of them are in the Postman collection `School_ERP_AdmissionService.postman_collection.json` (100 story folders).

| Area | Endpoints |
|---|---|
| Document verification and follow-ups | `PATCH /documents/{id}/verification`, `POST /document-follow-ups/scan`, `PATCH /document-follow-ups/{id}/resolution`, `POST /enquiries/{id}/transfer-certificate/verifications`, `GET` same |
| Entrance exams and evaluations | `POST /entrance-exams`, `GET /entrance-exams/{id}`, `GET /entrance-exams/{id}/admit-cards`, `GET /evaluation-rubrics`, `POST /evaluations`, `GET /evaluations/{id}`, `POST /reminders/entrance-evaluations` |
| Merit lists | `POST /merit-lists`, `GET /merit-lists/{id}`, `GET /merit-lists/{id}/pdf` |
| Offers, deposits and waivers | `POST /offers`, `GET /offers/{id}`, `POST /offers/{id}/deposits`, `GET /deposits/receipts/{receiptNumber}`, `POST /offers/{id}/fee-waivers`, `PATCH /fee-waivers/{id}/decision`, `GET /fee-waivers`, `GET /fee-waivers/{id}`, `POST /acceptance-notifications` |
| Enrolment and placement | `POST /enquiries/{id}/student-conversion`, `GET /students/{id}`, `PUT`/`GET /grade-sections`, `POST /grade-sections/auto-placement`, `PUT /students/{id}/placement` |
| Waitlists | `PUT /waitlists/rules`, `GET /waitlists`, `POST /waitlists/entries`, `DELETE /waitlists/entries/{id}`, `POST /waitlists/escalation` |
| Counseling | `POST /enquiries/{id}/calls`, `GET /callbacks`, `PATCH /callbacks/{id}/cancellation` |
| Marketing and analytics | `POST`/`GET /marketing-campaigns`, `PATCH /marketing-campaigns/{id}`, `GET /analytics/cost-per-acquisition`, `GET /analytics/conversion-rates`, `POST /lead-archives`, `GET /analytics/archived-lead-trends` |

All paths above are relative to `/api/v1/admissions`.
