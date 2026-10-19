# UI → academicservice API mapping

This lists every UI action that belongs to **academicservice** (Module 06, academics and LMS: timetables, cover, syllabus, homework, lesson plans, labs): the endpoint it calls, who may use it, and its status.
In development, the Vite dev server proxies `/api/v1/lms/*` to academicservice at `http://localhost:8087/academicservice` (its context path); set `ACADEMIC_SERVICE_URL` to point elsewhere.
The prefix is `/api/v1/lms`, not `/api/v1/academics`: the proxy matches by prefix and `/api/v1/academic` already goes to studentservice.
Class pickers come from academicservice's own subject allocations (`GET /api/v1/lms/allocations`), so the Module 06 roles need no studentservice access.

Code:
- [`src/api/academicService.js`](../src/api/academicService.js): one function per endpoint, the roles each action allows, labels.
- [`src/components/TeachingLive.jsx`](../src/components/TeachingLive.jsx): the Teaching & learning workspace (seven tabs and their dialogs).
- [`src/pages/Operations.jsx`](../src/pages/Operations.jsx): `/teaching` shows the workspace for academic staff and a note for everyone else; the Academics sample page's **View timetable** links to it.

Roles (BRD actor → role): Academic Coordinator `ACADEMIC_COORDINATOR`, Timetable In-Charge `TIMETABLE_INCHARGE`, Substitution In-Charge `SUBSTITUTION_INCHARGE`, E-Learning Admin `ELEARNING_ADMIN`, Subject Teacher `SUBJECT_TEACHER`, Class Teacher `CLASS_TEACHER`, Principal `SCHOOL_PRINCIPAL` / `VICE_PRINCIPAL`, Parent `APPLICANT_PARENT`.
"Academic staff" = all of those except the parent, plus `SUPER_ADMIN` (`AcademicRoles.STAFF_VIEW`).

| Status | Meaning |
|---|---|
| **Wired** | Calls the endpoint; checked against the running service with the Module 06 seed |
| **Role-gated** | Wired; hidden for roles that may not use it |
| **API only** | Endpoint exists (Postman, regression cases), no screen yet |

## Teaching & learning (`/teaching`)

| Screen · action | Method & endpoint | Story | Roles | Status |
|---|---|---|---|---|
| Page (live) | – | – | academic staff | **Role-gated**: other roles see a note |
| Metric **Bell schedule** | `GET /api/v1/lms/bell-schedules` | US-06000 | academic staff | **Wired**; the active schedule |
| Metric **Teachers**, tab **Workload** | `GET /api/v1/lms/workloads` | US-06001 | academic staff | **Wired**: caps, allocated / timetabled periods, load %, classes |
| Metric **Classes**, class pickers | `GET /api/v1/lms/allocations` | US-06001 | academic staff | **Wired** |
| Metric **Cover** (today, or Monday on a Sunday) | `GET /api/v1/lms/substitutions?date=` | US-06003 | academic staff | **Wired** |
| Header **Faculty timetable PDF** | `GET /api/v1/lms/timetables/faculty/pdf?bellScheduleId=` | US-06015 | principal, vice principal, timetable / substitution in-charge, coordinator | **Role-gated**; downloads `faculty-timetable.pdf` (one page per teacher) |
| Header **Generate timetables** (dialog: pick classes, result with unplaced periods) | `POST /api/v1/lms/timetables/generate` | US-06002 | timetable in-charge, coordinator | **Role-gated**; replaces the classes' timetables and clears their upcoming cover (`substitutionsCleared`) |
| Tab **Timetable** · Class timetable grid | `GET /api/v1/lms/timetables/sections/{sectionId}` + `GET /api/v1/lms/bell-schedules/{id}` | US-06002, US-06000 | academic staff | **Wired**: periods × working days, assembly / recess / lunch rows |
| Tab **Timetable** · Teacher timetable | `GET /api/v1/lms/timetables/teachers/{teacherId}` | US-06002 | academic staff | **Wired**; defaults to the signed-in teacher |
| Tab **Cover** · absences and day sheet for a date | `GET /api/v1/lms/substitutions/absences?date=`, `GET /api/v1/lms/substitutions?date=` | US-06003 | academic staff | **Wired** |
| **Mark teacher absent** (dialog) | `POST /api/v1/lms/substitutions/absences` | US-06003 | substitution in-charge, timetable in-charge, vice principal | **Role-gated** |
| **Auto-assign cover** | `POST /api/v1/lms/substitutions/auto-assign` | US-06003 | same | **Role-gated**; reason shown under each proxy |
| Cover picker / **Cancel** per period | `PUT /api/v1/lms/substitutions/{proxyId}` | US-06003 | same | **Role-gated**; a busy teacher is refused with the clash |
| Tab **Syllabus** · coverage per subject, chapters, status | `GET /api/v1/lms/syllabus/coverage?sectionId=` | US-06004 | academic staff | **Wired**: % taught vs % expected, On track / Ahead / Behind plan, overdue chapters |
| **Mark taught today** | `POST /api/v1/lms/syllabus/topics/{topicId}/coverage` | US-06004 | subject / class teacher, coordinator | **Role-gated** |
| Tab **Homework** · list for a class | `GET /api/v1/lms/homework?sectionId=` | US-06010 | academic staff | **Wired**: due, handed in, marked, missing |
| **Set homework** (dialog) | `POST /api/v1/lms/homework` | US-06010 | subject / class teacher | **Role-gated**; a teacher picks from their own subjects in the class |
| **Submissions** roster | `GET /api/v1/lms/homework/{id}/submissions` | US-06008 | academic staff | **Wired** |
| **Evaluate** / **Edit marks** (dialog) | `PUT /api/v1/lms/homework/submissions/{id}/evaluation` | US-06008 | subject / class teacher, coordinator | **Role-gated** |
| Tab **Lesson plans** · list (reviewers: awaiting review; teachers: their own) | `GET /api/v1/lms/lesson-plans?status=&teacherId=` | US-06013 | academic staff | **Wired** |
| **New lesson plan** (dialog: save draft / submit) · **Submit** | `POST /api/v1/lms/lesson-plans`, `POST /api/v1/lms/lesson-plans/{id}/submit` | US-06013 | subject / class teacher | **Role-gated**; classes from the teacher's allocations |
| **Approve** / **Return** (dialog) | `POST /api/v1/lms/lesson-plans/{id}/review` | US-06013 | principal, vice principal, coordinator | **Role-gated**; remarks required to return |
| **Submission compliance** (this week) | `GET /api/v1/lms/lesson-plans/compliance?from&to` | US-06013 | same | **Role-gated** |
| Tab **Labs** · rooms, bookings for two weeks | `GET /api/v1/lms/labs`, `GET /api/v1/lms/labs/{roomId}/reservations?from&to` | US-06011 | academic staff | **Wired** |
| **Book slot** (dialog) | `POST /api/v1/lms/labs/{roomId}/reservations` | US-06011 | teachers, substitution / timetable in-charge, coordinator | **Role-gated**; overlapping booking refused with who holds it |
| **Cancel** booking | `POST /api/v1/lms/labs/reservations/{id}/cancel` | US-06011 | own bookings; coordinator / timetable in-charge any | **Role-gated** |

## API only (no screen yet)

| Area | Endpoints | Stories |
|---|---|---|
| Set-up: bell schedules, subjects, workload caps, allocations, moving a period | `POST /bell-schedules`, `POST /bell-schedules/{id}/activate`, `POST /subjects`, `PUT /workloads`, `POST`/`DELETE /allocations`, `PUT /timetables/entries/{id}` | US-06000–06002 |
| Syllabus plan authoring | `PUT /syllabus/plans`, `GET /syllabus/plans` | US-06004 |
| E-learning assets, watch time | `/assets…` | US-06005, US-06018 |
| Quizzes, question generator, proctored attempts | `/quizzes…`, `/attempts…` | US-06006, US-06007, US-06014 |
| Skill analytics, leaderboards, badges, remedial sessions | `/analytics…`, `/leaderboards…`, `/badges…`, `/remedial…` | US-06009, US-06012, US-06017 |
| Overdue homework alerts | `POST /homework/overdue-alerts/run`, `GET /homework/overdue-alerts` | US-06016 |
| Year archive | `POST /archives`, `GET /archives/…` | US-06019 |
| Parent app (child's timetable, coverage, homework, hand-in) | `GET /timetables/students/{id}`, `GET /syllabus/students/{id}/coverage`, `GET /homework/students/{id}`, `POST /homework/{id}/submissions` | US-06002, US-06004, US-06010 |

## Access rules (tools)

`GET /api/v1/lms/access-rules` (any signed-in user) lists every academicservice endpoint with the roles its `@PreAuthorize` allows, read from the running service (same contract as the other services' `…/access-rules`).
