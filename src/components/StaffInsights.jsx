import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Modal } from './AuthSettings.jsx';
import { SectionHead, Pill, Tabs, DataTable, schoolDay, useSchoolCalendar } from './ui.jsx';
import { ApiNote } from './Admissions.jsx';
import { useAuth } from '../auth.jsx';
import { useApi } from '../api/useApi.js';
import * as hr from '../api/hrService.js';
import * as lms from '../api/academicService.js';
import { formatNumber, formatDate } from '../regional.js';

// Thresholds for the signals on the pulse
const OVERLOAD_PCT = 90; // a teacher at or above this share of the weekly cap is overloaded
const SPARE_PCT = 50; // below this share counts as spare capacity
const PROBATION_DAYS = 60; // probation ending within this many days is due for review
const WAITING_DAYS = 3; // a leave request waiting this long is slow
const NEW_HIRE_DAYS = 365; // staff longer than this without an appraisal are overdue one
const COVER_LOOKAHEAD = 7; // days ahead checked for teachers on leave

const DAY = 24 * 60 * 60 * 1000;
const isoOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const atNoon = (iso) => new Date(`${iso}T12:00:00`);
const addDays = (iso, n) => { const d = atNoon(iso); d.setDate(d.getDate() + n); return isoOf(d); };
const daysBetween = (fromIso, toIso) => Math.round((atNoon(toIso) - atNoon(fromIso)) / DAY);
const daysAgo = (t) => Math.max(0, Math.floor((Date.now() - new Date(t).getTime()) / DAY));
const academicYearStart = (d) => `${d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1}-04-01`;
const plural = (n, word) => `${formatNumber(n)} ${word}${n === 1 ? '' : 's'}`;
const fullName = (s) => `${s.firstName} ${s.lastName}`;
const isCurrent = (s) => s.isActive !== false && !['RESIGNED', 'RETIRED', 'TERMINATED'].includes(s.employmentStatus);
const todayIso = () => isoOf(new Date());

/** Next day school is in session, today included (a break or weekend moves on); today when none is found in two weeks. */
const nextOpenDay = () => { for (let i = 0; i < 15; i += 1) { const d = addDays(todayIso(), i); if (schoolDay(d).open) return d; } return todayIso(); };
/** Last day school was in session, today included. */
const lastOpenDay = () => { for (let i = 0; i < 15; i += 1) { const d = addDays(todayIso(), -i); if (schoolDay(d).open) return d; } return todayIso(); };
/** The approved leave overlapping the window [from, to], if any. */
const leaveIn = (leaves, staffId, from, to) => (leaves || []).find((l) => l.staffId === staffId && l.status === 'APPROVED' && l.startDate <= to && l.endDate >= from);

/** Roles that may open the pulse: school leadership and HR (the roles that can read the staff attendance summary). */
export const canOpenStaffPulse = (hasRole) => hasRole(...hr.HR_ROLES.attendance);

/**
 * The figure on the card: people in a transition that needs a decision, from the staff list and leave requests the page
 * already loads. Probation ending soon, staff serving notice, and leave requests waiting too long.
 */
export function staffAttention(staff, leaves) {
  const current = staff.filter(isCurrent);
  const today = todayIso();
  const probation = current.filter((s) => s.probationStatus !== 'CONFIRMED' && s.probationEndDate
    && daysBetween(today, s.probationEndDate) <= PROBATION_DAYS);
  const notice = current.filter((s) => s.employmentStatus === 'NOTICE_PERIOD');
  const slow = (leaves || []).filter((l) => l.status === 'PENDING' && daysAgo(l.createdAt) >= WAITING_DAYS && staff.some((s) => s.staffId === l.staffId));
  return { probation, notice, slow, total: probation.length + notice.length + slow.length };
}

/* ---------- teaching load and cover risk ---------- */

function TeachingLoad({ staff, leaves }) {
  const workloads = useApi(() => lms.listWorkloads(), []);
  const subjects = useApi(() => lms.listSubjects(), []);
  const calendar = useSchoolCalendar();
  const coverDay = useMemo(nextOpenDay, [calendar]);
  const sheet = useApi(() => lms.daySheet(coverDay), [coverDay]);
  const today = todayIso();
  const until = addDays(today, COVER_LOOKAHEAD);

  // A teacher's id in the workload list is the staff member's sign-in account id
  const staffByUser = useMemo(() => new Map(staff.filter((s) => s.userId).map((s) => [s.userId, s])), [staff]);
  const rows = useMemo(() => (workloads.data || []).map((w) => {
    const person = staffByUser.get(w.teacherId);
    const leave = person ? leaveIn(leaves, person.staffId, today, until) : null;
    return { ...w, load: Number(w.utilisationPercent) || 0, leave };
  }).sort((a, b) => b.load - a.load), [workloads.data, staffByUser, leaves]);

  const over = rows.filter((r) => r.load >= OVERLOAD_PCT);
  const spare = rows.filter((r) => r.load < SPARE_PCT);
  const sparePeriods = spare.reduce((n, r) => n + Math.max(0, r.weeklyMaxPeriods - r.allocatedPeriods), 0);
  const average = rows.length ? rows.reduce((n, r) => n + r.load, 0) / rows.length : 0;
  const away = rows.filter((r) => r.leave);

  // Subjects only one teacher can take (a teacher with no listed subjects can take any)
  const single = useMemo(() => (subjects.data || []).map((sub) => {
    const able = rows.filter((r) => !r.qualifiedSubjectCodes.length || r.qualifiedSubjectCodes.includes(sub.subjectCode));
    return { sub, able };
  }).filter(({ able }) => able.length <= 1), [subjects.data, rows]);

  if (workloads.error?.status === 403) return <ApiNote>Teaching load is visible to the timetable in-charge, academic coordinator, principals and super administrators.</ApiNote>;
  if (!workloads.data) return <p className="xs muted">Loading teachers and cover…</p>;
  const cover = sheet.data;
  return (
    <div className="pulse-panel">
      <SectionHead title="Teaching load and cover risk"
        sub={`${plural(rows.length, 'teacher')} · average load ${average.toFixed(0)}% of weekly caps · ${over.length} at ${OVERLOAD_PCT}% or more · ${formatNumber(sparePeriods)} spare periods a week`} />
      <dl className="movegrid">
        <div><dt>Overloaded</dt><dd className={over.length ? 'down' : ''}>{formatNumber(over.length)}</dd>
          <small>{over.length ? over.map((r) => r.teacherName).join(', ') : `Nobody at ${OVERLOAD_PCT}% or more`}</small></div>
        <div><dt>Spare capacity</dt><dd>{formatNumber(sparePeriods)}</dd>
          <small>periods a week across {plural(spare.length, 'teacher')} under {SPARE_PCT}%</small></div>
        <div><dt>Cover on {formatDate(coverDay)}</dt><dd className={cover?.uncovered ? 'down' : ''}>{cover ? formatNumber(cover.periodsToCover) : '…'}</dd>
          <small>{cover ? `${formatNumber(cover.assigned)} assigned · ${formatNumber(cover.uncovered)} uncovered · ${plural(cover.absentTeachers, 'teacher')} absent` : 'Loading cover'}</small></div>
      </dl>
      <h4 style={{ fontSize: 13, fontWeight: 600, margin: '18px 0 8px' }}>Subjects with a single point of failure</h4>
      {single.length ? (
        <div className="riskchips">
          {single.map(({ sub, able }) => {
            const t = able[0];
            const tone = !t ? 'red' : t.leave ? 'red' : 'amber';
            return <span key={sub.subjectId} title={t ? `${t.teacherName}${t.leave ? ` is on leave ${formatDate(t.leave.startDate)} to ${formatDate(t.leave.endDate)}` : ''}` : 'No teacher can take this subject'}>
              <Pill tone={tone}>{sub.subjectName} · {t ? t.teacherName : 'nobody'}{t?.leave ? ' · on leave soon' : ''}</Pill></span>;
          })}
        </div>
      ) : <p className="body-s">Every subject has at least two teachers who can take it.</p>}
      <h4 style={{ fontSize: 13, fontWeight: 600, margin: '18px 0 8px' }}>Teachers by load</h4>
      <DataTable boxed cols={[
        { label: 'Teacher', render: (r) => <span className="cell-id"><b>{r.teacherName}</b><small>{r.qualifiedSubjectCodes.join(', ') || 'Any subject'}</small></span> },
        { label: 'Allocated', className: 'num', render: (r) => `${r.allocatedPeriods} / ${r.weeklyMaxPeriods}` },
        { label: 'Load', render: (r) => <Pill tone={r.load >= OVERLOAD_PCT ? 'red' : r.load < SPARE_PCT ? '' : 'green'}>{r.load.toFixed(0)}%</Pill> },
        { label: `Leave in the next ${COVER_LOOKAHEAD} days`, render: (r) => (r.leave ? <Pill tone="amber">{formatDate(r.leave.startDate)} – {formatDate(r.leave.endDate)}</Pill> : '—') },
      ]} rows={rows} />
      {away.length > 0 && <p className="xs muted" style={{ marginTop: 10 }}>{plural(away.length, 'teacher')} on approved leave in the next {COVER_LOOKAHEAD} days: {away.map((r) => r.teacherName).join(', ')}.</p>}
      <p className="xs muted" style={{ marginTop: 6 }}>Load is allocated periods against the weekly cap. A teacher with no subjects listed counts as able to take any subject.</p>
    </div>
  );
}

/* ---------- leave and attendance patterns ---------- */

function LeavePatterns({ staff, leaves }) {
  const { hasRole } = useAuth();
  const canSummary = hasRole(...hr.HR_ROLES.attendance);
  const calendar = useSchoolCalendar();
  const day = useMemo(lastOpenDay, [calendar]);
  const summary = useApi(() => hr.attendanceSummary(day), [day], canSummary);
  const current = staff.filter(isCurrent);
  const byId = useMemo(() => new Map(staff.map((s) => [s.staffId, s])), [staff]);
  const yearStart = academicYearStart(new Date());
  const taken = (leaves || []).filter((l) => l.status === 'APPROVED' && l.startDate >= yearStart && byId.has(l.staffId));
  const days = (rows) => rows.reduce((n, l) => n + Number(l.totalDays || 0), 0);
  const byType = hr.LEAVE_TYPES.map(([code, name]) => [name, days(taken.filter((l) => l.leaveType === code))]).filter(([, n]) => n);
  const pending = (leaves || []).filter((l) => l.status === 'PENDING' && byId.has(l.staffId)).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  const oldest = pending[0] ? daysAgo(pending[0].createdAt) : null;

  const depts = useMemo(() => {
    const m = new Map();
    current.forEach((s) => m.set(s.department, { department: s.department, staff: 0, days: 0, pending: 0, present: null }));
    current.forEach((s) => { m.get(s.department).staff += 1; });
    taken.forEach((l) => { const d = m.get(byId.get(l.staffId).department); if (d) d.days += Number(l.totalDays || 0); });
    pending.forEach((l) => { const d = m.get(byId.get(l.staffId).department); if (d) d.pending += 1; });
    Object.entries(summary.data?.departmentPresentCounts || {}).forEach(([name, n]) => { if (m.has(name)) m.get(name).present = n; });
    return [...m.values()].map((d) => ({ ...d, perHead: d.staff ? d.days / d.staff : 0 })).sort((a, b) => b.perHead - a.perHead);
  }, [staff, leaves, summary.data]);
  const top = depts[0];
  const s = summary.data;

  return (
    <div className="pulse-panel">
      <SectionHead title="Leave and attendance patterns"
        sub={`${days(taken).toFixed(1)} leave days taken since ${formatDate(yearStart)} · ${plural(pending.length, 'request')} waiting${oldest !== null ? `, the oldest ${plural(oldest, 'day')}` : ''}`} />
      <dl className="movegrid">
        <div><dt>Presence on {formatDate(day)}</dt>
          <dd>{s ? `${Number(s.attendancePercentage).toFixed(0)}%` : canSummary ? '…' : '—'}</dd>
          <small>{s ? `${formatNumber(s.presentCount)} of ${formatNumber(s.totalStaff)} punched in · ${formatNumber(s.absentCount)} absent · ${formatNumber(s.onLeaveCount)} on leave`
            : canSummary ? 'Loading biometric attendance' : 'Biometric attendance: principals and HR'} · last day school was in session</small></div>
        <div><dt>Leave taken</dt><dd>{days(taken).toFixed(1)}</dd>
          <small>{byType.length ? byType.map(([name, n]) => `${name.replace(' leave', '')} ${n.toFixed(1)}`).join(' · ') : 'No approved leave this year'}</small></div>
        <div><dt>Waiting for approval</dt><dd className={oldest >= WAITING_DAYS ? 'down' : ''}>{formatNumber(pending.length)}</dd>
          <small>{pending.length ? `Oldest waiting ${plural(oldest, 'day')}` : 'Nothing waiting'}</small></div>
      </dl>
      <h4 style={{ fontSize: 13, fontWeight: 600, margin: '18px 0 8px' }}>By department</h4>
      <DataTable boxed cols={[
        { label: 'Department', render: (d) => <b style={{ fontWeight: 600 }}>{d.department}</b> },
        { label: 'Staff', className: 'num', render: (d) => formatNumber(d.staff) },
        { label: 'Leave days', className: 'num', render: (d) => d.days.toFixed(1) },
        { label: 'Per person', render: (d) => <Pill tone={top && d === top && d.perHead > 0 ? 'amber' : ''}>{d.perHead.toFixed(1)}</Pill> },
        { label: 'Waiting', className: 'num', render: (d) => (d.pending ? <Pill tone="amber">{d.pending}</Pill> : '0') },
        { label: `Present ${formatDate(day)}`, render: (d) => (d.present === null ? '—' : `${d.present} of ${d.staff}`) },
      ]} rows={depts} />
      {pending.length > 0 && (<>
        <h4 style={{ fontSize: 13, fontWeight: 600, margin: '18px 0 8px' }}>Requests waiting</h4>
        <DataTable boxed cols={[
          { label: 'Staff member', render: (l) => <b style={{ fontWeight: 500 }}>{fullName(byId.get(l.staffId))}</b> },
          { label: 'Type', render: (l) => hr.LEAVE_LABEL[l.leaveType] || l.leaveType },
          { label: 'Dates', render: (l) => (l.startDate === l.endDate ? formatDate(l.startDate) : `${formatDate(l.startDate)} – ${formatDate(l.endDate)}`) },
          { label: 'Waiting', render: (l) => { const d = daysAgo(l.createdAt); return <Pill tone={d >= WAITING_DAYS ? 'amber' : ''}>{plural(d, 'day')}</Pill>; } },
        ]} rows={pending} />
      </>)}
      <p className="xs muted" style={{ marginTop: 10 }}>
        Leave days are approved leave starting this academic year (from 1 April). {canSummary && <Link className="link" to="/attendance?tab=staff-attendance">Open staff attendance →</Link>}
      </p>
    </div>
  );
}

/* ---------- people risks ---------- */

function PeopleRisks({ staff }) {
  const current = useMemo(() => staff.filter(isCurrent), [staff]);
  const today = todayIso();
  // Appraisals on file per current staff member: one request each, read when this tab opens
  const ids = current.map((s) => s.staffId);
  const appraisals = useApi(() => Promise.all(ids.map((id) => hr.listAppraisals(id).then((a) => [id, a.length]))),
    [ids.join(',')], ids.length > 0);
  const filed = new Map(appraisals.data || []);
  const known = !!appraisals.data;

  const probation = current.filter((s) => s.probationStatus !== 'CONFIRMED' && s.probationEndDate)
    .map((s) => ({ ...s, left: daysBetween(today, s.probationEndDate) })).sort((a, b) => a.left - b.left);
  const dueSoon = probation.filter((s) => s.left <= PROBATION_DAYS);
  const unreviewed = known ? dueSoon.filter((s) => !filed.get(s.staffId)) : [];
  const veterans = current.filter((s) => s.joiningDate && daysBetween(s.joiningDate, today) >= NEW_HIRE_DAYS);
  const noAppraisal = known ? veterans.filter((s) => !filed.get(s.staffId)) : [];
  const withAppraisal = known ? current.filter((s) => filed.get(s.staffId)).length : 0;
  const notice = current.filter((s) => s.employmentStatus === 'NOTICE_PERIOD');
  const left = staff.filter((s) => !isCurrent(s));
  const noAccount = current.filter((s) => !s.userId);
  const noEmail = current.filter((s) => !s.email);
  const noPhone = current.filter((s) => !s.phone);
  const tenure = [['Under 1 year', (s) => daysBetween(s.joiningDate, today) < 365], ['1 to 3 years', (s) => daysBetween(s.joiningDate, today) >= 365 && daysBetween(s.joiningDate, today) < 1095],
    ['3 to 5 years', (s) => daysBetween(s.joiningDate, today) >= 1095 && daysBetween(s.joiningDate, today) < 1825], ['5+ years', (s) => daysBetween(s.joiningDate, today) >= 1825]]
    .map(([name, test]) => [name, current.filter((s) => s.joiningDate && test(s)).length]);
  const names = (rows, max = 6) => `${rows.slice(0, max).map(fullName).join(', ')}${rows.length > max ? ` and ${rows.length - max} more` : ''}`;

  return (
    <div className="pulse-panel">
      <SectionHead title="People risks"
        sub={`${plural(current.length, 'current staff member')} · ${plural(dueSoon.length, 'probation review')} due within ${PROBATION_DAYS} days · ${formatNumber(notice.length)} in a notice period`} />
      <dl className="movegrid">
        <div><dt>Probation due</dt><dd className={unreviewed.length ? 'down' : ''}>{formatNumber(dueSoon.length)}</dd>
          <small>{dueSoon.length ? (known ? `${unreviewed.length} without an appraisal on file` : 'Checking appraisals…') : `None ending within ${PROBATION_DAYS} days`}</small></div>
        <div><dt>Appraisals on file</dt><dd>{known ? `${withAppraisal} of ${current.length}` : '…'}</dd>
          <small>{known ? `${noAppraisal.length} with over a year of service and none` : 'Loading appraisals'}</small></div>
        <div><dt>Notice period</dt><dd className={notice.length ? 'down' : ''}>{formatNumber(notice.length)}</dd>
          <small>{notice.length ? names(notice) : `No resignations in progress · ${formatNumber(left.length)} left or retired`}</small></div>
      </dl>
      {probation.length > 0 && (<>
        <h4 style={{ fontSize: 13, fontWeight: 600, margin: '18px 0 8px' }}>On probation</h4>
        <DataTable boxed cols={[
          { label: 'Staff member', render: (s) => <span className="cell-id"><b>{fullName(s)}</b><small>{s.designation}</small></span> },
          { label: 'Probation ends', render: (s) => formatDate(s.probationEndDate) },
          { label: 'Days left', render: (s) => <Pill tone={s.left < 0 ? 'red' : s.left <= PROBATION_DAYS ? 'amber' : ''}>{s.left < 0 ? `${-s.left} overdue` : s.left}</Pill> },
          { label: 'Appraisal', render: (s) => (known ? <Pill tone={filed.get(s.staffId) ? 'green' : s.left <= PROBATION_DAYS ? 'red' : ''}>{filed.get(s.staffId) ? 'On file' : 'None yet'}</Pill> : '…') },
        ]} rows={probation} />
      </>)}
      {noAppraisal.length > 0 && <p className="body-s" style={{ marginTop: 14 }}><b>No appraisal on file after a year or more:</b> {names(noAppraisal, 8)}</p>}
      <h4 style={{ fontSize: 13, fontWeight: 600, margin: '18px 0 8px' }}>Records to fix</h4>
      <div className="riskchips">
        <span title={noAccount.length ? names(noAccount) : ''}><Pill tone={noAccount.length ? 'amber' : ''}>No sign-in account · {noAccount.length}</Pill></span>
        <span title={noEmail.length ? names(noEmail) : ''}><Pill tone={noEmail.length ? 'amber' : ''}>No work email · {noEmail.length}</Pill></span>
        <span title={noPhone.length ? names(noPhone) : ''}><Pill tone={noPhone.length ? 'amber' : ''}>No phone · {noPhone.length}</Pill></span>
      </div>
      {noAccount.length > 0 && <p className="xs muted" style={{ marginTop: 8 }}>Without a sign-in account, {names(noAccount, 4)} cannot see their own profile, leave or timetable.</p>}
      <h4 style={{ fontSize: 13, fontWeight: 600, margin: '18px 0 8px' }}>Years of service</h4>
      <div className="capbars">
        {tenure.map(([name, n]) => (
          <div key={name} className="caprow" style={{ gridTemplateColumns: '96px 1fr 40px' }}>
            <span className="capname">{name}</span>
            <span className="track"><i style={{ width: `${current.length ? (n / current.length) * 100 : 0}%`, background: 'var(--pr)' }} /></span>
            <span className="capnum">{n}</span>
          </div>
        ))}
      </div>
      <p className="xs muted" style={{ marginTop: 10 }}>Appraisal checks count the appraisals recorded on each profile. Probation reviews are due when probation ends within {PROBATION_DAYS} days.</p>
    </div>
  );
}

/* ---------- the pop-up ---------- */

const PULSE_TABS = ['Teaching load', 'Leave and attendance', 'People risks'];

/**
 * Staff pulse (a stat card on the Staff & faculty page). Opening it reloads the staff list and leave requests, and each
 * tab reads its own data (workloads and cover, biometric attendance, appraisals) from the services.
 */
export function StaffPulseModal({ staff, leaves, onClose }) {
  const [tab, setTab] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { staff.reload(); leaves.reload(); }, []);
  const ready = staff.data && leaves.data;
  return (
    <Modal title="Staff pulse" sub="Teaching load and cover risk, leave and attendance patterns, and people risks" onClose={onClose}
      footer={<button className="btn primary" onClick={onClose}>Done</button>}>
      <Tabs items={PULSE_TABS} value={tab} onChange={setTab} />
      <div style={{ marginTop: 16 }}>
        {!ready ? <p className="xs muted">Loading staff and leave…</p>
          : tab === 0 ? <TeachingLoad staff={staff.data} leaves={leaves.data} />
            : tab === 1 ? <LeavePatterns staff={staff.data} leaves={leaves.data} />
              : <PeopleRisks staff={staff.data} />}
      </div>
    </Modal>
  );
}
