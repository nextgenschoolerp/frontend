import { PageHeader, Card, Footer } from '../components/ui.jsx';
import { useAuth } from '../auth.jsx';
import { ROLES as financeRoles } from '../api/financeService.js';
import { FeesLive } from '../components/FeesLive.jsx';
import { AssessmentsLive } from '../components/AssessmentsLive.jsx';
import { ROLES as examRoles } from '../api/examService.js';
import { ApiNote } from '../components/Admissions.jsx';
import { TeachingLive } from '../components/TeachingLive.jsx';
import { ROLES as lmsRoles } from '../api/academicService.js';
import { AttendanceLive, useAttendanceAllowed } from '../components/AttendanceLive.jsx';

/* ---------- Academics ---------- */
/** Live assessments for teachers, exam staff, principals and registrars; other roles see a note. */
export function Academics() {
  const { hasRole } = useAuth();
  if (hasRole(...examRoles.view)) return <AssessmentsLive />;
  return (
    <>
      <PageHeader title="Academics" desc="Coordinate classes, curriculum, teaching schedules and assessment deadlines." />
      <Card><ApiNote>Assessment terms, mark entry and results are shown to teachers, the exam controller, principals and registrars.</ApiNote></Card>
      <Footer />
    </>
  );
}

/* ---------- Teaching & learning ---------- */
/** Live from academicservice (Module 06) for academic staff and principals; other roles see a note. */
export function Teaching() {
  const { hasRole } = useAuth();
  if (hasRole(...lmsRoles.view)) return <TeachingLive />;
  return (
    <>
      <PageHeader title="Teaching & learning" desc="Timetables, cover, syllabus progress, homework, lesson plans and lab bookings." />
      <Card><ApiNote>Timetables, cover, syllabus progress, homework and lesson plans are shown to teachers, the academic coordinator, the timetable and substitution in-charges, e-learning admins and principals.</ApiNote></Card>
      <Footer />
    </>
  );
}

/* ---------- Attendance ---------- */
// Live from studentservice (/api/v1/attendance): registers, absences and follow-ups; other roles see a note
export function Attendance() {
  const allowed = useAttendanceAllowed();
  if (allowed) return <AttendanceLive />;
  return (
    <>
      <PageHeader title="Attendance" desc="Monitor daily attendance, complete registers and follow up on student absences." />
      <Card><ApiNote>Attendance registers are shown to class teachers, the academic head, principals, the registrar and the school office.</ApiNote></Card>
      <Footer />
    </>
  );
}

/* ---------- Fees ---------- */
/** Live from financeservice for finance staff and principals; other roles see a note. */
export function Fees() {
  const { hasRole } = useAuth();
  if (hasRole(...financeRoles.staff)) return <FeesLive />;
  return (
    <>
      <PageHeader title="Fees & payments" desc="Track term billing, reconcile payments and follow up on outstanding accounts." />
      <Card><ApiNote>Fee accounts, receipts and defaulter lists are shown to finance staff, principals and super administrators.</ApiNote></Card>
      <Footer />
    </>
  );
}

