# UI → admissionservice API mapping

This lists every UI action that belongs to **admissionservice** (Module 02): the endpoint it calls, who may use it, and its status.
In development, the Vite dev server proxies `/api/v1/admissions/*` to admissionservice at `http://localhost:8083/admissionservice` (its context path).
It sends every other `/api/*` call to authservice at `http://localhost:8082/authservice`. To point elsewhere, set `ADMISSION_SERVICE_URL` / `AUTH_SERVICE_URL`.

Code:
- [`src/api/admissionService.js`](../src/api/admissionService.js): one function per endpoint, plus status labels.
- [`src/pages/Admissions.jsx`](../src/pages/Admissions.jsx): the Admissions workspace (`/admissions`): pipeline flow, walk-in registration, counseling log and callbacks.
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
| Metric **Admission applications** ("Awaiting review", opens `/admissions`) | `GET /api/v1/admissions/enquiries?tenantId=&branchId=` | US-02001 | FRONT_OFFICE_COUNSELOR, ADMISSION_OFFICER, REGISTRAR, ENTRANCE_EXAM_EVALUATOR, FINANCE_CASHIER, SCHOOL_PRINCIPAL, SUPER_ADMIN | **Wired**. Counts applications in an open status (new, contacted, assessment scheduled/passed, offer issued) |
| Tab **Admissions (n)** → applications table | same as above | US-02001 | same | **Wired**. Newest first. Columns: applicant and application number, grade and academic year, guardian, source, received date, status pill. The tab is kept in the URL (`/students?tab=admissions`) |
| Admissions card · "*n* new applications" | same as above | US-02001 | same | **Wired**: counts `NEW_INQUIRY` and `CONTACTED` |
| Admissions card · "*n* with documents pending" | `GET /api/v1/admissions/document-follow-ups?tenantId=&branchId=&status=OPEN` | US-02011 | REGISTRAR, ADMISSION_OFFICER, FRONT_OFFICE_COUNSELOR, SUPER_ADMIN | **Wired** |
| Admissions card · **Open admissions workspace →** | — | — | — | Opens `/admissions` |
| Table row · **Review application** → modal header and details | uses the list row (`GET /api/v1/admissions/enquiries/{id}` is wrapped as `getEnquiry`) | US-02001 | as above | **Wired** |
| Review modal · **Documents** | `GET /api/v1/admissions/enquiries/{id}/documents` | US-02004 | ENTRANCE_EXAM_EVALUATOR, REGISTRAR, ADMISSION_OFFICER, SUPER_ADMIN | **Wired / Role-gated** (a counselor sees "Not available for your role.") |
| Review modal · **Assessments** | `GET /api/v1/admissions/enquiries/{id}/evaluations` | US-02003 | REGISTRAR, ADMISSION_OFFICER, SUPER_ADMIN | **Wired / Role-gated** |
| Review modal · **Offers** | `GET /api/v1/admissions/enquiries/{id}/offers` | US-02006 | FINANCE_CASHIER, ADMISSION_OFFICER, SCHOOL_PRINCIPAL, SUPER_ADMIN | **Wired / Role-gated** |
| Review modal · **Calls** | `GET /api/v1/admissions/enquiries/{id}/calls` | US-02015 | FRONT_OFFICE_COUNSELOR, ADMISSION_OFFICER, MARKETING_MANAGER, SUPER_ADMIN | **Wired / Role-gated** |
| Review modal · Documents → **Verify** / **Reject** (pending documents) | `PATCH /api/v1/admissions/documents/{documentId}/verification` | US-02004 | REGISTRAR, ADMISSION_OFFICER, SUPER_ADMIN | **Wired / Role-gated** |
| **Export list** (All students / Archived tab) | — | — | — | Exports the tab as CSV (studentservice data, built in the browser) |
| **Export list** (Admissions tab) | same list as the tab | US-02001 | as for the list | **Wired**: `admission-applications-<date>.csv` built in the browser; disabled for roles without the list |

## Admissions workspace (`/admissions`)

A page of its own for the front desk and the admissions team. It is linked from the **Admission applications** card and the Admissions tab on Students, from the Overview "Needs your attention" row, the sidebar (**Admissions**) and the global search.
Code: [`src/pages/Admissions.jsx`](../src/pages/Admissions.jsx). It reuses the list hook, review modal and status pills from `Admissions.jsx`.

| Screen · action | Method & endpoint | Story | Roles | Status |
|---|---|---|---|---|
| **Pipeline flow** (a node per stage with the applications now there, the share that moved on between stages, and the Not offered / Withdrawn exits) | `GET /api/v1/admissions/enquiries?tenantId=&branchId=` | US-02001 | as for the list | **Wired**. Counts are grouped by `enquiryStatus`. The percentage between two stages is the share of applications that reached the first stage and are now at the next stage or later. Selecting a node filters the list (`?stage=NEW_INQUIRY` etc.) |
| Metric cards **Total enquiries**, **In progress**, **Walk-in enquiries** | same | US-02001 | as for the list | **Wired**. Each filters the list; walk-ins are applications with `referralSource` WALK_IN, with this month's count under the total (`?source=walk-in`) |
| Metric card **Callbacks scheduled** (others see **Enrolled**) | `GET /api/v1/admissions/callbacks?tenantId=` | US-02015 | FRONT_OFFICE_COUNSELOR, ADMISSION_OFFICER, MARKETING_MANAGER, SUPER_ADMIN | **Wired / Role-gated** |
| **Register walk-in** → modal | `POST /api/v1/admissions/enquiries` with `referralSource=WALK_IN` | US-02001 | FRONT_OFFICE_COUNSELOR, ADMISSION_OFFICER, SUPER_ADMIN (APPLICANT_PARENT can also capture, but the button is for staff) | **Wired**. Student, class and academic year, optional date of birth and gender, guardian name, relationship, mobile and email. The guardian email and mobile are required by the service; the mobile is checked as digits before the call |
| Register walk-in → **Log the counseling session held at the desk** | `POST /api/v1/admissions/enquiries/{id}/calls` (`direction=INBOUND`) | US-02015 | FRONT_OFFICE_COUNSELOR, ADMISSION_OFFICER, SUPER_ADMIN | **Wired**. Logged against the new application right after it is saved; a Connected session moves it to **Contacted**. If the session fails, the enquiry is still saved and the message says so |
| Applications tab · **Log session** (open applications) | `POST /api/v1/admissions/enquiries/{id}/calls` | US-02015 | as above | **Wired**: outcome, direction, duration, notes and callback time (only for a callback request) |
| Applications tab · **Review** | the review modal of Students → Admissions | US-02001 … US-02015 | as above | **Wired** (same modal, documents, assessments, offers, calls and next steps) |
| **Counseling log** tab | `GET /api/v1/admissions/enquiries/{id}/calls` for each of the 40 newest applications | US-02015 | FRONT_OFFICE_COUNSELOR, ADMISSION_OFFICER, MARKETING_MANAGER, SUPER_ADMIN | **Wired / Role-gated**. Loaded when the tab opens, newest session first |
| **Callbacks** tab | `GET /api/v1/admissions/callbacks?tenantId=` | US-02015 | as for the callbacks card | **Wired / Role-gated**. Overdue callbacks are marked |
| **Export applications** | the loaded list | US-02001 | as for the list | **Wired**: the filtered applications as CSV |

Not on this page: cancelling a callback (`PATCH /callbacks/{id}/cancellation`) has no screen yet.

## Review application → Next step (status changes)

The modal shows the action that moves the application to its next status. The stakeholder whose role the endpoint allows gets the button; everyone else sees "Done by …".
Each action reloads the modal and the list, so the status pill changes in place.

| Current status | Next step · stakeholder | Method & endpoint | Story | Roles | New status |
|---|---|---|---|---|---|
| New enquiry, Contacted | **Log a call** · counselor | `POST /api/v1/admissions/enquiries/{id}/calls` | US-02015 | FRONT_OFFICE_COUNSELOR, ADMISSION_OFFICER, SUPER_ADMIN | Connected / Callback requested → **Contacted**; Not interested → **Withdrawn** |
| New enquiry, Contacted | **Schedule entrance exam** · admission officer | `POST /api/v1/admissions/entrance-exams` (`enquiryIds: [id]`) | US-02002 | ADMISSION_OFFICER, SUPER_ADMIN | **Assessment scheduled** (admit card issued) |
| Assessment scheduled / passed | **Record assessment** · registrar (scores from the evaluator) | `GET /api/v1/admissions/evaluation-rubrics?evaluationType=`, `POST /api/v1/admissions/evaluations` | US-02003 | REGISTRAR, ADMISSION_OFFICER, SUPER_ADMIN | All assessments passed → **Assessment passed** |
| Assessment passed | **Issue offer** · admission officer or cashier | `POST /api/v1/admissions/offers` | US-02006 | FINANCE_CASHIER, ADMISSION_OFFICER, SUPER_ADMIN | **Offer issued** |
| Offer issued (not paid) | **Collect seat deposit** · cashier | `POST /api/v1/admissions/offers/{offerId}/deposits` | US-02008 | FINANCE_CASHIER, SCHOOL_PRINCIPAL, SUPER_ADMIN | offer **Accepted** (amount must equal the amount due) |
| Offer accepted (or passed with no offer) | **Enrol student** · registrar | `POST /api/v1/admissions/enquiries/{id}/student-conversion`, then `POST /api/v1/students` (studentservice) in the chosen section of the offered class. The conversion body may be empty: date of birth and gender default to the application's (400 when it has none) | US-02005 | REGISTRAR, ADMISSION_OFFICER, FRONT_OFFICE_COUNSELOR, APPLICANT_PARENT, SUPER_ADMIN | **Enrolled** (birth and transfer certificates must be verified) |
| Any open status | **Not offered / Withdrawn** · admission officer or principal | `PATCH /api/v1/admissions/enquiries/{id}/decision` **(new)** | – | ADMISSION_OFFICER, SCHOOL_PRINCIPAL, SUPER_ADMIN | **Not offered** (REJECTED) or **Withdrawn**; the reason and who decided are appended to the remarks; 409 when already closed |

Backend changes for this:
- New `PATCH /enquiries/{enquiryId}/decision` (`EnquiryDecisionRequest`: `decision` REJECTED | WITHDRAWN, `reason` required). No API set REJECTED before.
- `GET /enquiries` and `GET /enquiries/{id}` now also allow REGISTRAR, ENTRANCE_EXAM_EVALUATOR, FINANCE_CASHIER and SCHOOL_PRINCIPAL (read only), so every stakeholder can open the applications they act on.

Regression: `scripts/cases/admissionservice.json` ADM-19 … ADM-48 walk one application through every step as its stakeholder, with a role negative (403) and a validation negative (400) for each action and the 409 cases.

## Students → Add student (`/students/new`)

A student record in admissionservice is created only by converting an application that has passed every step (US-02010).
So "Add student" records an **application** (an enquiry) in the admissions pipeline.
Registrars and office clerks instead get **Enrol student**, which creates the student master record in studentservice straight away (see `studentservice-api-mapping.md`).

| Screen · action | Method & endpoint | Story | Roles | Status |
|---|---|---|---|---|
| **Save draft** | `POST /api/v1/admissions/enquiries` | US-02001 | FRONT_OFFICE_COUNSELOR, ADMISSION_OFFICER, APPLICANT_PARENT, SUPER_ADMIN | **Wired**. Form → `CaptureEnquiryRequest`: first and last name; class → `targetGradeId` (`Class 7` → `GRADE-07`, `Nursery` → `GRADE-NURSERY`); section and year group are kept in `remarks`; academic year → `academicYearId` (`2026–2027` → `AY-2026-27`); primary guardian, guardian email and mobile number → guardian fields; relationship is kept in `remarks`; `referralSource=WALK_IN`. Missing required fields or a bad phone number are reported before the call, and service validation messages are shown. On success it stays on the page with "Application APP-… saved" |
| **Add student** | same as above | US-02001 | same | **Wired**: saves, then opens `/admissions` |
| Documents panel · **Upload document** (type and file) | `POST /api/v1/admissions/enquiries/{id}/documents?documentType=` (multipart `file`) | US-02004 | ENTRANCE_EXAM_EVALUATOR, SCHOOL_PRINCIPAL, ADMISSION_OFFICER, SUPER_ADMIN | **Wired / Role-gated**. Enabled once the application is saved; PDF, JPG or PNG up to 5 MB. The list reloads from `GET …/documents` |
| Date of birth, gender, guardian relationship | `POST /api/v1/admissions/enquiries` (`candidateDateOfBirth`, `candidateGender`, `guardianRelationship`, all optional) | US-02001 | as above | **Wired**. Kept on the application and shown in the review modal; **Enrol student** reuses them (it only asks when the application has none) and passes the relationship to the studentservice record |
| Upload student photo, house, class placement, medical fields, emergency contact | — | — | — | **Gap** for applications: `CaptureEnquiryRequest` has no fields for these. They are entered but not sent; class placement comes later (US-02012). **Enrol student** (studentservice) sends all of them except the photo |

## Overview

| Screen · action | Method & endpoint | Story | Roles | Status |
|---|---|---|---|---|
| Needs your attention · **Admission applications** quantity → Review | `GET /api/v1/admissions/enquiries?tenantId=&branchId=` | US-02001 | as for the list | **Wired**. Shows the live open count and links to `/admissions`; for other roles it shows the static figure |

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

Enrol student also creates the student master record in studentservice (section picker from `GET /api/v1/academic/sections?gradeId=`; class `GRADE-07` → `Class 7`), so the new student appears in the directory, fees and exams. If the role cannot add students (403), the application is still enrolled and the message says a registrar can add the student from Add student.
