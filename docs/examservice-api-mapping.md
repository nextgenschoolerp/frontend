# UI → examservice API mapping

This lists every UI action that belongs to **examservice** (Module 05, examinations, grading and NEP 2020 progress cards): the endpoint it calls, who may use it, and its status.
In development, the Vite dev server proxies `/api/v1/exams/*` to examservice at `http://localhost:8086/examservice` (its context path); set `EXAM_SERVICE_URL` to point elsewhere.
Classes and sections for the pickers still come from studentservice (`GET /api/v1/academic/grades`, `/sections`), which also lets the exam roles read them.

Code:
- [`src/api/examService.js`](../src/api/examService.js): one function per endpoint, the roles each action allows, labels.
- [`src/components/ExamRecords.jsx`](../src/components/ExamRecords.jsx): student profile Academic progress card (comparative bars, term table) and the progress card dialog with remarks.
- [`src/components/AssessmentsLive.jsx`](../src/components/AssessmentsLive.jsx): the Academics page workspace (mark entry, broadsheet, rank list, incomplete entries, unlock tickets).
- [`src/pages/Operations.jsx`](../src/pages/Operations.jsx): `/academics` shows the workspace for exam roles, the sample page otherwise.

Roles (BRD actor → role): Exam Controller `EXAM_CONTROLLER`, Subject Teacher / Evaluator `SUBJECT_TEACHER`, Class Teacher `CLASS_TEACHER`, Academic Principal `SCHOOL_PRINCIPAL` (`VICE_PRINCIPAL` reads), Academic Auditor `ACADEMIC_AUDITOR`, Parent `APPLICANT_PARENT`. "Teaching staff" = those staff roles plus `SUPER_ADMIN`; the registrar can read.

| Status | Meaning |
|---|---|
| **Wired** | Calls the endpoint; checked against the running service with the Module 05 seed |
| **Role-gated** | Wired; hidden or replaced by a note for roles that may not use it |
| **API only** | Endpoint exists (Postman, regression cases), no screen yet |

## Academics (`/academics`)

| Screen · action | Method & endpoint | Story | Roles | Status |
|---|---|---|---|---|
| Page (live) | – | – | teaching staff, registrar | **Role-gated**: others see the sample page with a note |
| Term picker, metric **Term** | `GET /api/v1/exams/terms` | US-05000 | same + parent | **Wired**; defaults to the latest started term |
| Metric **Mark entry** (Open / Locked, T_lock time) | same | US-05005 | same | **Wired** |
| Metric **Entries complete**, tab **Incomplete entries** | `GET /api/v1/exams/terms/{id}/completeness?branchId=` | US-05016 | teaching staff, registrar | **Wired** |
| Metric / tab **Unlock tickets** | `GET /api/v1/exams/terms/{id}/unlock-tickets` | US-05006 | same | **Wired** |
| Ticket **Approve** / **Reject** | `PATCH /api/v1/exams/unlock-tickets/{id}/decision` | US-05006 | SCHOOL_PRINCIPAL, EXAM_CONTROLLER | **Role-gated** |
| Header **Lock mark entry** | `POST /api/v1/exams/terms/{id}/lock` | US-05005 | EXAM_CONTROLLER, SCHOOL_PRINCIPAL | **Role-gated**; only while open |
| Tab **Mark entry**: subject picker | `GET /api/v1/exams/terms/{id}/subjects?gradeId=` | US-05000 | teaching staff, registrar | **Wired** |
| Mark grid | `GET /api/v1/exams/terms/{id}/marks?sectionId&subjectCode&branchId` | US-05003 | same | **Wired**; locked banner with the reason |
| **Save marks** | `PUT /api/v1/exams/terms/{id}/marks?branchId=` | US-05003 | SUBJECT_TEACHER, CLASS_TEACHER, EXAM_CONTROLLER | **Role-gated**; read-only grid for other roles and when locked |
| **Request unlock** (locked banner) | `POST /api/v1/exams/terms/{id}/unlock-tickets` | US-05006 | SUBJECT_TEACHER, CLASS_TEACHER | **Role-gated** |
| Tab **Broadsheet**, **Export CSV** | `GET /api/v1/exams/terms/{id}/broadsheet?sectionId&branchId` | US-05007 | teaching staff, registrar | **Wired** (CSV built in the browser) |
| **Publish progress cards** | `POST /api/v1/exams/terms/{id}/publish?branchId=` | US-05010 | CLASS_TEACHER, SCHOOL_PRINCIPAL, EXAM_CONTROLLER | **Role-gated**; 409 message while entries are missing |
| Tab **Rank list** (whole class, toppers, bands) | `GET /api/v1/exams/terms/{id}/rank-list?gradeId&branchId` | US-05011 | teaching staff, registrar | **Wired** |
| Create scales, terms, subjects; co-scholastic grades | `POST …/grading-scales`, `POST …/terms`, `POST …/terms/{id}/subjects`, `PUT …/terms/{id}/co-scholastic` | US-05000, US-05008 | see the wiki | **API only** (seeded) |

## Student profile (`/students/:studentId`)

| Screen · action | Method & endpoint | Story | Roles | Status |
|---|---|---|---|---|
| Overview / Academics → **Academic progress** card | `GET /api/v1/exams/students/{id}/progress-trend` | US-05013 | teaching staff, registrar, parent (published terms) | **Wired / Role-gated**: latest %, grade, result, trend, rank, year-weighted %, per-subject comparative bars for the last three terms; Academics tab adds the term table |
| **View progress card** / **Progress card** | `GET /api/v1/exams/students/{id}/progress-card?examTermId=` | US-05009 | same | **Wired**: scholastic marks and grades, total, grade point, rank, co-scholastic grades, remarks, publication |
| **Add / Edit remarks** (dialog) | `PUT /api/v1/exams/students/{id}/progress-card/remarks` | US-05018 | CLASS_TEACHER, SCHOOL_PRINCIPAL | **Role-gated**; only before publishing |

Office clerks and school nurses can open profiles but not results; they see "Assessment results are visible to …".

## Access rules (tools)

`GET /api/v1/exams/access-rules` (any signed-in user) lists every examservice endpoint with the roles its `@PreAuthorize` allows, read from the running service (same contract as admissionservice's `GET /api/v1/admissions/access-rules`). Used by the student lifecycle runner (`/dev/student-lifecycle-workflow.html`) to check that a school's staff can do each step.
