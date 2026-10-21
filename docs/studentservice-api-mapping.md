# UI → studentservice API mapping

This lists every UI action that belongs to **studentservice** (Module 03, Student Information System and student lifecycle): the endpoint it calls, who may use it, and its status.
In development, the Vite dev server proxies `/api/v1/students/*`, `/api/v1/academic/*` and `/api/v1/alumni/*` to studentservice at `http://localhost:8084/studentservice` (its context path).
To point elsewhere, set `STUDENT_SERVICE_URL`. The other services are unchanged: `/api/v1/admissions/*` goes to admissionservice and every other `/api/*` call to authservice.

Code:
- [`src/api/studentService.js`](../src/api/studentService.js): one function per endpoint, the roles each action allows, and status labels.
- [`src/components/StudentRecords.jsx`](../src/components/StudentRecords.jsx): the student list and its hooks, CSV export, and the profile cards and dialogs (medical, ID card, certificates, conduct).
- [`src/pages/Students.jsx`](../src/pages/Students.jsx): the directory, Add / Edit student and the profile.
- [`src/pages/Overview.jsx`](../src/pages/Overview.jsx): the "Total students" and "Incomplete student records" figures.

Authentication uses the authservice JWT; studentservice validates it with the shared secret.
Lists are scoped to `tenantId` (from the login response) and `branchId` (the user's campus; for super administrators, the campus picked in the sidebar).
Student ids are UUIDs, so `/students/<uuid>` opens a live record. The old static sample (`/students/st-2024-106`) still renders, for screens no service backs yet.

## Legend

| Status | Meaning |
|---|---|
| **Wired** | The UI calls the endpoint, and the call was checked against the running service (DPS-DELHI-NORTH, Module 03 seed) |
| **Role-gated** | Wired, but the UI shows a note or hides the button when the signed-in role is not allowed (a 403 also renders "Not available for your role.") |
| **Gap** | The UI shows the action but there is no matching studentservice API, or the data belongs to another module |

## Students → directory (`/students`)

| Screen · action | Method & endpoint | Story | Roles | Status |
|---|---|---|---|---|
| Tab **All students (n)** → table | `GET /api/v1/students?tenantId=&branchId=` | US-03000 | REGISTRAR, OFFICE_CLERK, CLASS_TEACHER, SCHOOL_PRINCIPAL, SCHOOL_NURSE (read-only), SUPER_ADMIN | **Wired / Role-gated**. Students on roll, ordered by class, section and roll number. Columns: name and UID, class-section and roll number, house, primary guardian, medical alert, status ("Needs update" when the record is incomplete), View profile / Edit. Other roles see a note |
| Search, class, section and house filters | same list | – | same | **Wired** (filtered in the browser) |
| Tab **Archived (n)** (`?tab=archived`) | same list, `studentStatus` TRANSFERRED or GRADUATED | US-03006, US-03009 | same | **Wired** |
| Metrics **Total students**, **New this year**, **Incomplete records** | same list | US-03000 | same | **Wired**. Total = on roll, "Across n class sections"; new = created since 1 April; incomplete = no guardian, emergency phone or blood group |
| **Record health** card | same list | US-03001 | same | **Wired**: completion percentage and a link to each incomplete record's Edit page |
| **Export list** | same list | – | same | **Wired** as a CSV built in the browser from the loaded tab (there is no export endpoint) |
| Tab **Admissions** | admissionservice | – | – | See `admissionservice-api-mapping.md` |

## Students → Student profile (`/students/:studentId?tab=…`)

| Screen · action | Method & endpoint | Story | Roles | Status |
|---|---|---|---|---|
| Summary, **Personal information**, **Guardians & emergency contacts**, **Medical & wellbeing** | `GET /api/v1/students/{studentId}` | US-03000, US-03001 | REGISTRAR, OFFICE_CLERK, CLASS_TEACHER, SCHOOL_PRINCIPAL, SCHOOL_NURSE, SUPER_ADMIN | **Wired / Role-gated**. The response now includes `guardians` (primary contact first) |
| Medical → **Update medical information** | `PUT /api/v1/students/{studentId}/medical` | US-03001 | SCHOOL_NURSE, REGISTRAR, SUPER_ADMIN | **Wired / Role-gated**. Blood group, alerts and emergency phone are all required; "None" counts as no alert |
| Header **ID card** | `GET /api/v1/students/{studentId}/id-card` | US-03004 | OFFICE_CLERK, REGISTRAR, CLASS_TEACHER, SUPER_ADMIN | **Wired / Role-gated**: a dialog with name, UID, class, house, barcode and QR verification URL (no printable card yet) |
| Tab **Documents** → certificates | `GET /api/v1/students/{studentId}/certificates` | US-03006, US-03007 | REGISTRAR, OFFICE_CLERK, SCHOOL_PRINCIPAL, CLASS_TEACHER, SUPER_ADMIN | **Wired / Role-gated** |
| Documents → **Issue certificate** (bonafide or character) | `POST /api/v1/students/{studentId}/certificates/bonafide` | US-03007 | REGISTRAR, OFFICE_CLERK, SCHOOL_PRINCIPAL, SUPER_ADMIN | **Wired / Role-gated** |
| Documents → **Issue transfer certificate** | `POST /api/v1/students/{studentId}/certificates/transfer` | US-03006 | SCHOOL_PRINCIPAL, VICE_PRINCIPAL, REGISTRAR, SUPER_ADMIN | **Wired / Role-gated**. The signed-in user signs first and names a different second signatory; the student becomes Transferred and moves to Archived |
| Tab **Conduct** (new) | `GET /api/v1/students/{studentId}/disciplinary` | US-03008 | CLASS_TEACHER, SCHOOL_PRINCIPAL, VICE_PRINCIPAL, SUPER_ADMIN | **Wired / Role-gated** |
| Conduct → **Record incident** | `POST /api/v1/students/{studentId}/disciplinary` | US-03008 | same | **Wired / Role-gated** |
| **Attendance** card (Overview tab) and **Attendance** tab | `GET /api/v1/attendance/students/{studentId}` (default: active academic session to date) | US-03018 | CLASS_TEACHER, ACADEMIC_HEAD, VICE_PRINCIPAL, SCHOOL_PRINCIPAL, REGISTRAR, OFFICE_CLERK, SUPER_ADMIN | **Wired / Role-gated** (new endpoint). Rate = (present + late) ÷ sessions marked (AM and PM each count); counts by status; today's mark; the tab adds the late arrivals and absences with reasons and follow-up. Other roles see a note |
| Academic progress card, Academics tab | examservice `GET /api/v1/exams/students/{id}/progress-trend` | US-05013 | teaching staff, registrar | **Wired**, see `examservice-api-mapping.md` |
| Fee status card, Fees & payments tab | financeservice `GET /api/v1/finance/students/{id}/fee-account` | US-04004 | finance staff, principal, registrar | **Wired**, see `financeservice-api-mapping.md` |
| Summary photo | `GET /api/v1/students/{studentId}/photo/file` (fetched with the token) | US-03014 | as for the profile | **Wired**: initials when there is no photo |
| Documents tab → files on the record, **Download** | `GET /api/v1/students/{studentId}/documents`, `GET /api/v1/students/documents/{documentId}/file` | – | REGISTRAR, OFFICE_CLERK, CLASS_TEACHER, SCHOOL_PRINCIPAL, SCHOOL_NURSE, SUPER_ADMIN | **Wired** (new endpoints) |
| **Download record** | uses the loaded record | – | – | **Wired**: CSV built in the browser |
| Message guardian | – | – | – | **Gap** |

## Students → Add student (`/students/new`)

| Screen · action | Method & endpoint | Story | Roles | Status |
|---|---|---|---|---|
| **Enrol student** (registrar, office clerk) / **Enrol directly** (super administrator) | `POST /api/v1/students` | US-03000 | REGISTRAR, OFFICE_CLERK, SUPER_ADMIN | **Wired / Role-gated**. Form → `EnrollStudentRequest`: names, date of birth, gender (Non-binary / Prefer not to say → OTHER), blood group, medical conditions + allergies → `medicalAlerts`, emergency phone, class and section → `gradeId` / `sectionId`, house → `houseId`, primary guardian, relationship, mobile and email. Required: names, date of birth, gender, class, section. Opens the new profile with its permanent UID |
| Class, Section, House options | `GET /api/v1/academic/grades?tenantId=`, `GET /api/v1/academic/sections?gradeId=`, `GET /api/v1/academic/houses?tenantId=` | US-03003 | grades and sections: REGISTRAR, OFFICE_CLERK, SCHOOL_PRINCIPAL, CLASS_TEACHER, SUPER_ADMIN, and for the Academics pickers SUBJECT_TEACHER, EXAM_CONTROLLER, VICE_PRINCIPAL, ACADEMIC_AUDITOR; houses: REGISTRAR, OFFICE_CLERK, SCHOOL_PRINCIPAL, CLASS_TEACHER, HOUSE_MASTER, SUPER_ADMIN | **Wired**. The Class options are the school's grades in `sequenceOrder`. The Section options are the chosen class's sections, reloaded and cleared when the class changes. The house list comes from the API too. The static lists are used only when the role cannot read grades (the same applies on Edit student) |
| Save draft / **Add student** (application) | admissionservice | US-02001 | – | Unchanged; see `admissionservice-api-mapping.md` |

## Students → Edit student (`/students/:studentId/edit`)

| Screen · action | Method & endpoint | Story | Roles | Status |
|---|---|---|---|---|
| Form values | `GET /api/v1/students/{studentId}` | US-03000 | as for the profile | **Wired** |
| **Save changes** / **Save & view profile**: blood group, medical conditions + allergies, emergency phone | `PUT /api/v1/students/{studentId}/medical` | US-03001 | SCHOOL_NURSE, REGISTRAR, SUPER_ADMIN | **Wired / Role-gated**. Sent only when changed |
| same: class, section, house | `PUT /api/v1/students/{studentId}/allocation` | US-03003 | REGISTRAR, CLASS_TEACHER, HOUSE_MASTER, SUPER_ADMIN | **Wired / Role-gated**. Sent only when changed; the roll number is kept |
| **Change photo** | `POST /api/v1/students/{studentId}/photo/upload` (multipart `file`, JPEG or PNG, 5 MB) | US-03014 | REGISTRAR, OFFICE_CLERK, SUPER_ADMIN | **Wired / Role-gated** (new endpoint). The record's `profilePhotoUrl` becomes `vault:<path>`; other roles see the button disabled with "Changed by the registrar or office clerk". US-03014's `POST /{studentId}/photo` (a JSON photo URL) is unchanged and such URLs are shown as they are |
| **Upload documents** (type + file) | `POST /api/v1/students/{studentId}/documents?documentType=` (multipart `file`, PDF/JPEG/PNG, 10 MB) | – | REGISTRAR, OFFICE_CLERK, SCHOOL_NURSE, SUPER_ADMIN | **Wired / Role-gated** (new endpoint). Types: BIRTH_CERTIFICATE, PROOF_OF_ADDRESS, TRANSFER_CERTIFICATE, REPORT_CARD, MEDICAL_CARE_PLAN, IDENTITY_DOCUMENT, OTHER. The list reloads after the upload |
| Names, date of birth, gender, guardians, address | – | – | – | **Gap**: no update endpoint after enrolment |

## Attendance (`/attendance`) — new, studentservice `/api/v1/attendance`

Daily student attendance is a studentservice feature built on the class roll list (US-03018): two registers a day per section (AM and PM),
one mark per student per register: **Present**, **Late**, **Excused** (reason required) or **Unexcused** (opens a guardian follow-up).
Staff attendance belongs to Module 07 (HR & payroll), which has no service yet: the **Staff attendance** tab says so.

| Screen · action | Method & endpoint | Roles | Status |
|---|---|---|---|
| Metrics **Present today**, **Excused**, **Unexcused**, **Class registers** | `GET /api/v1/attendance/summary?date=&branchId=` | CLASS_TEACHER, ACADEMIC_HEAD, VICE_PRINCIPAL, SCHOOL_PRINCIPAL, REGISTRAR, OFFICE_CLERK, SUPER_ADMIN | **Wired**. From the morning registers: present (incl. late), rate = present ÷ students marked (open registers don't pull it down), "n not yet marked", AM / PM registers in of the sections with students, open follow-ups |
| Class register filters: date, class, section | `GET /api/v1/academic/grades`, `GET /api/v1/academic/sections` | as for grades / sections (ACADEMIC_HEAD added) | **Wired**. Future dates can't be picked; the last class opened is remembered on the browser |
| **Daily register** table (AM, PM, absence reason, follow-up) | `GET /api/v1/attendance/sections/{sectionId}/register?date=` | view roles above | **Wired**. Students on roll in roll-number order; the session being edited (Morning / Afternoon) shows selects, the other its saved marks; status filter; counts and who submitted / changed each register |
| **Mark all present**, **Submit AM / PM register**, **Save changes (n)** | `PUT /api/v1/attendance/sections/{sectionId}/register` `{date, session, entries[{studentId, status, reason}]}` | CLASS_TEACHER, ACADEMIC_HEAD, VICE_PRINCIPAL, SCHOOL_PRINCIPAL, SUPER_ADMIN | **Wired / Role-gated**. 400: future date, excused without a reason (also checked in the browser), student not on the section's roll, a student twice. 403: a register older than 7 days unless principal / vice principal. Unexcused → follow-up OPEN; changing it to another status clears the follow-up |
| **Class summary** card | same register | view roles | **Wired** (AM register, or PM once only PM is in) |
| **Needs follow-up** card, **View all** | `GET /api/v1/attendance/follow-ups?from=&to=&includeResolved=` (default last 7 days, open and contacted) | view roles | **Wired**: student, class, session, follow-up state, last note, emergency phone |
| **Contact guardian / Update follow-up** dialog | `PATCH /api/v1/attendance/records/{attendanceId}/follow-up` `{followUpStatus: GUARDIAN_CONTACTED or RESOLVED, note}` | CLASS_TEACHER, OFFICE_CLERK, VICE_PRINCIPAL, SCHOOL_PRINCIPAL, SUPER_ADMIN | **Wired / Role-gated**. Note required; 409 for a mark that is not an unexcused absence |
| **Absence history** tab (scope class / whole school, from–to, status), **Export** | `GET /api/v1/attendance/absences?from=&to=&sectionId=&gradeId=&status=` (default last 30 days) | view roles | **Wired**; CSV built in the browser |
| **Export attendance** (header) | the loaded register | – | **Wired**: CSV of the class register |
| **Staff attendance** tab | – | – | **Gap**: Module 07 HR (biometric attendance, leave) has no service yet |
| Other roles | – | – | Page shows a role note instead of sample data |

## Overview

| Screen · action | Method & endpoint | Story | Roles | Status |
|---|---|---|---|---|
| Metric **Total students** ("+n this year") | `GET /api/v1/students?tenantId=&branchId=` | US-03000 | as for the list | **Wired**; the static figure is shown for other roles |
| Needs your attention · **Incomplete student records** | same | US-03001 | same | **Wired** |
| Metric **Student attendance**, card **Attendance trends** (weekly average, daily line, today's present / excused / unexcused) | `GET /api/v1/attendance/summary`, `GET /api/v1/attendance/trend?from=&to=` (school days = days with an AM register) | attendance view roles | **Wired**; change vs last week when last week has registers; sample figures for other roles |
| Reports → **Weekly attendance report** (preview, options, CSV) | same | same | **Wired**: this week's average and change, chart, today's status with "Not yet marked"; CSV adds each day |

## Verified (built-in browser and `api-regression.mjs`, Vite → studentservice through the proxy)

- The registrar sees 10 DPS North students on roll and 2 archived, with 7 class sections and 1 incomplete record. The counselor gets the role note.
- Kabir Singh's profile shows two guardians, the asthma alert and the ID card. A character certificate and a medical update were saved from the profile.
- Myra Kapoor was moved to 6-C, Raman house from Edit student.
- Enrol student created `STU-2026-0…` in Class 4-B, Shivaji house, and opened the new profile. A class teacher recorded a conduct incident.
- `node scripts/api-regression.mjs --service studentservice`: 29 of 29 cases pass, including role negatives, validation, the dual sign-off TC and the context path. All 71 cases across the three services pass.
- Test rows were removed with `db.ps1 -Cleanup` and the Module 03 seed was re-applied.

## Backend changes made for the UI

- `server.servlet.context-path` is `/studentservice` (port 8084); the Postman `baseUrl` was updated to match.
- `StudentResponse.guardians`: the profile and the directory need guardian names and phones.
- `JpaAuditConfig` (`@EnableCoreJpaAuditing`), as admissionservice has. Without it, `created_at` and `created_by` were never written, so "Record created" and "New this year" had no data.
- Seed `db/seed/module03_student_seed.sql`: the Module 03 roles, five DPS staff accounts (nurse, office clerk, class teacher, house master, alumni coordinator), VICE_PRINCIPAL for `viceprincipal_kiran`, DPS classes, sections, houses and sessions, and 14 students with certificates, incidents and an alumni record.

## Student files (new in studentservice)

- `StudentFileController`, `StudentFileService`, `StudentFileStorage`, entity `StudentDocument` (table `student_documents`): new files only, so the US-03014 work in `StudentController` is untouched.
- Files are kept in `student.file-vault.base-path` (default `./student-vault`, git-ignored) as `<tenant>/<studentId>/<random>.<ext>`. The size, the declared type and the file signature are checked first; every call checks the caller's tenant.
- Multipart limits in `application.yml`: 10 MB per file.
- Tests: `StudentFileControllerIntegrationTest` (upload, read back, wrong type, fake signature, role and tenant refusals) and the regression cases STU-30 … STU-38.

## Students → Promote class (end of year)

| Screen · action | Method & endpoint | Story | Roles | Status |
|---|---|---|---|---|
| **Promote class** (page header) → class picker "Class 7 → Class 8" | `GET /api/v1/academic/grades?tenantId=` (next class by `sequenceOrder`) | US-03003 | REGISTRAR, SCHOOL_PRINCIPAL, SUPER_ADMIN | **Wired / Role-gated** |
| Result column (Passed / Repeats the class / Result incomplete) | `GET /api/v1/exams/terms` (last summative term, e.g. Annual) and `GET /api/v1/exams/terms/{id}/broadsheet?sectionId=` per section | US-05007 | as above | **Wired**. Only students whose result is PASS can be ticked; they are pre-selected |
| Session line "2026-2027 → 2027-2028" | `GET /api/v1/academic/sessions?tenantId=`; `POST /api/v1/academic/sessions` creates the next year on promotion when missing | US-03003 | REGISTRAR, SUPER_ADMIN (create) | **Wired** |
| **Promote *n* to Class 8** | `POST /api/v1/academic/batch-promotion` (`studentIds` = ticked students) | US-03005 | REGISTRAR, SCHOOL_PRINCIPAL, SUPER_ADMIN | **Wired**. Students move to the same section letter of the next class (7-A → 8-A) and become **Promoted** |

Backend changes for this (studentservice `StudentService.batchPromoteStudents`): the caller's tenant is checked against the grades; only ACTIVE or PROMOTED students of the class move; each keeps their section letter in the next class (before, the section still pointed at the old class). examservice keeps a term's results on the class they were earned in (the section recorded with the marks) and treats PROMOTED students as on roll.

## studentservice capabilities with no screen yet

| Area | Endpoints |
|---|---|
| Sibling linking (US-03002) | `POST /api/v1/students/{id}/siblings` |
| Lookup by UID | `GET /api/v1/students/uid/{studentUid}` |
| Alumni registry (US-03009) | `POST /api/v1/alumni/archive`, `GET /api/v1/alumni/{studentUid}` (there is no list endpoint, so the Archived tab uses the student list) |
| Academic structure setup (Settings → Academic setup) | `POST`/`GET /api/v1/academic/sessions`, `POST /grades`, `POST /sections`, `POST /houses` |

## Notes for the backend

All three issues below are fixed in studentservice (covered by `TenantIsolationIntegrationTest`):

- **Fixed:** SCHOOL_NURSE may now call `GET /api/v1/students` (read-only), so a nurse can find students from the list instead of needing a direct profile link.
- **Fixed:** tenant isolation. The per-student endpoints (`/api/v1/students/{id}`, `/uid/{uid}`, `/medical`, `/siblings`, `/allocation`, `/id-card`, `/certificates…`, `/disciplinary`) and `GET /api/v1/alumni/{studentUid}` check the student against the `tenantId` claim of the JWT and answer 404 for another tenant's student. `GET /api/v1/students?tenantId=` answers 403 for a tenant other than the caller's. SUPER_ADMIN may cross tenants; a token without a `tenantId` claim reaches no student.
- **Fixed:** certificate numbers. The counter still restarts at 1001 on every start, but certificate numbers now skip numbers already in the database (as the UID already did), so a restart no longer causes a unique-key error.

## Access rules (tools)

`GET /api/v1/academic/access-rules` (any signed-in user) lists every studentservice endpoint with the roles its `@PreAuthorize` allows, read from the running service (same contract as admissionservice's `GET /api/v1/admissions/access-rules`). Used by the student lifecycle runner (`/dev/student-lifecycle-workflow.html`) to check that a school's staff can do each step.
