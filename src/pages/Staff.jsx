import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Download, Plus, ArrowLeft, Pencil, Check, X, LoaderCircle, Upload } from 'lucide-react';
import {
  PageHeader, BackTitle, Metrics, scrollToId, useSort, sortRows, avatarTone, Card, SectionHead, Tabs, SearchBox, DataTable, Pager, Person, Actions,
  Pill, FieldGrid, Field, Footer, KV, downloadCsv, todayIso,
} from '../components/ui.jsx';
import { Modal } from '../components/AuthSettings.jsx';
import { ApiErr, ApiNote } from '../components/Admissions.jsx';
import { TimetableGrid } from '../components/TeachingLive.jsx';
import { useAuth } from '../auth.jsx';
import { useApi } from '../api/useApi.js';
import * as hr from '../api/hrService.js';
import * as lms from '../api/academicService.js';
import { formatDate, formatNumber, formatMoney } from '../regional.js';

const Loading = () => <p className="xs muted"><LoaderCircle size={12} className="spin" /> Loading…</p>;
const fullName = (s) => `${s.firstName} ${s.lastName}`;
const staffType = (s) => (hr.TEACHING_DEPARTMENTS.includes(s.department) ? 'Teaching' : 'Support');
const isCurrent = (s) => s.isActive !== false && !['RESIGNED', 'RETIRED', 'TERMINATED'].includes(s.employmentStatus);
/** Approved leave that covers `day` (yyyy-mm-dd) */
const onLeave = (leaves, staffId, day) => (leaves || []).find((l) => l.staffId === staffId && l.status === 'APPROVED' && l.startDate <= day && l.endDate >= day);
const dateRange = (l) => (l.startDate === l.endDate ? formatDate(l.startDate) : `${formatDate(l.startDate)} – ${formatDate(l.endDate)}`);
const days = (n) => `${formatNumber(Number(n))} ${Number(n) === 1 ? 'day' : 'days'}`;

/** Availability shown in the directory and on the profile: leave today, else the employment status. */
function availability(s, leaves, today) {
  if (!isCurrent(s)) return hr.EMPLOYMENT_STATUS[s.employmentStatus] || [s.employmentStatus, ''];
  const l = onLeave(leaves, s.staffId, today);
  if (l) return [`On ${hr.LEAVE_LABEL[l.leaveType]?.toLowerCase() || 'leave'}`, 'amber'];
  return s.employmentStatus === 'NOTICE_PERIOD' ? hr.EMPLOYMENT_STATUS.NOTICE_PERIOD : ['Available', 'green'];
}

/* ---------- directory (GET /api/v1/hr/employees, GET /api/v1/hr/leaves) ---------- */

const DIR_TABS = ['all', 'teaching', 'support', 'archived'];
const PAGE_SIZE = 10;

export function StaffDirectory() {
  const { branchId, hasRole } = useAuth();
  const today = todayIso();
  const staff = useApi(() => hr.listEmployees(branchId ? { branchId } : {}), [branchId]);
  const leaves = useApi(() => hr.listLeaves(), []);
  const canSummary = hasRole(...hr.HR_ROLES.attendance);
  const summary = useApi(() => hr.attendanceSummary(today), [today], canSummary);
  const [q, setQ] = useState('');
  const [tab, setTab] = useState(0);
  const [dept, setDept] = useState('');
  const [avail, setAvail] = useState('');
  const [page, setPage] = useState(1);
  const sort = useSort();

  const all = staff.data || [];
  const current = all.filter(isCurrent);
  const teaching = current.filter((s) => staffType(s) === 'Teaching');
  const leaveToday = current.filter((s) => onLeave(leaves.data, s.staffId, today));
  const pending = (leaves.data || []).filter((l) => l.status === 'PENDING' && all.some((s) => s.staffId === l.staffId));
  const departments = [...new Set(all.map((s) => s.department))].sort();
  const reviewsDue = current.filter((s) => s.probationStatus !== 'CONFIRMED' && s.probationEndDate);

  const inTab = { all: current, teaching, support: current.filter((s) => staffType(s) === 'Support'), archived: all.filter((s) => !isCurrent(s)) }[DIR_TABS[tab]];
  const rows = inTab
    .filter((s) => `${fullName(s)} ${s.employeeCode} ${s.designation} ${s.email || ''}`.toLowerCase().includes(q.toLowerCase()))
    .filter((s) => !dept || s.department === dept)
    .filter((s) => !avail || (avail === 'leave' ? !!onLeave(leaves.data, s.staffId, today) : !onLeave(leaves.data, s.staffId, today)))
    .map((s) => ({ ...s, name: fullName(s), type: staffType(s), avail: availability(s, leaves.data, today) }));
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  // Columns of the directory table: sorted before paging
  const cols = [
    // Initials on a colour per department, so each team reads as a block when scanning (staff have no photos yet)
    { label: 'Staff member', sortBy: (s) => s.name, render: (s) => (
      <>
        <span className="avatar-sm" style={{ background: avatarTone(s.department)[0], color: avatarTone(s.department)[1] }} aria-hidden="true">
          {s.name.split(' ').map((w) => w[0]).join('').slice(0, 2)}
        </span>
        <span className="cell-id"><b>{s.name}</b><small>{s.employeeCode}</small></span>
      </>
    ) },
    { label: 'Role', sortBy: (s) => s.designation, key: 'designation' },
    { label: 'Department', sortBy: (s) => s.department, key: 'department', hideOnCards: true },
    { label: 'Type', sortBy: (s) => s.type, key: 'type', hideOnCards: true },
    { label: 'Availability', sortBy: (s) => s.avail[0], render: (s) => <Pill tone={s.avail[1]}>{s.avail[0]}</Pill> },
    { label: 'Actions', render: (s) => (
      <Actions>
        <Link to={`/staff/${s.staffId}`}>View profile</Link>
        {hasRole(...hr.HR_ROLES.manage) && <Link to={`/staff/${s.staffId}/edit`}>Edit</Link>}
      </Actions>
    ) },
  ];
  const shown = sortRows(rows, cols, sort).slice((Math.min(page, pages) - 1) * PAGE_SIZE, Math.min(page, pages) * PAGE_SIZE);
  const n = (v) => (staff.data ? formatNumber(v) : staff.loading ? '…' : '—');
  const reset = (fn) => (v) => { fn(v); setPage(1); };

  return (
    <>
      <PageHeader
        title="Staff & faculty"
        desc="Manage your teaching and support teams, leave and employment records."
        actions={[
          { label: 'Export list', icon: <Download size={15} />, disabled: !rows.length, onClick: () => downloadCsv('staff', ['Name', 'Employee code', 'Role', 'Department', 'Type', 'Availability', 'Email', 'Phone'],
            rows.map((r) => [r.name, r.employeeCode, r.designation, r.department, r.type, r.avail[0], r.email || '', r.phone || ''])) },
          hasRole(...hr.HR_ROLES.manage) && { label: 'Add staff member', icon: <Plus size={15} />, primary: true, to: '/staff/new' },
        ].filter(Boolean)}
      />
      <Metrics items={[
        ['Total staff', n(current.length), `${n(teaching.length)} teaching · ${n(current.length - teaching.length)} support`, null, false, null,
          staff.data && { onClick: () => { setTab(0); setDept(''); setAvail(''); setQ(''); setPage(1); scrollToId('staff-directory'); }, hint: 'Show all current staff', active: tab === 0 && !dept && !avail && !q }],
        ['On campus today', summary.data ? formatNumber(summary.data.presentCount) : canSummary && summary.loading ? '…' : '—',
          summary.data ? `${formatNumber(summary.data.attendancePercentage)}% punched in` : 'Biometric attendance · principal and HR', null, false, null,
          summary.data && { to: '/attendance?tab=staff-attendance', hint: 'Open staff attendance' }],
        ['On leave today', leaves.data ? formatNumber(leaveToday.length) : '…', 'Approved leave', null, false, null,
          leaves.data && { onClick: () => { setTab(0); setAvail('leave'); setPage(1); scrollToId('staff-directory'); }, hint: 'Show staff on leave today', active: avail === 'leave' }],
        ['Leave requests', leaves.data ? formatNumber(pending.length) : '…', 'Awaiting approval', null, false, null,
          leaves.data && { onClick: () => scrollToId('staff-leave'), hint: 'Jump to leave and cover' }],
      ]} />
      <Card id="staff-directory" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div className="sh"><div><h3>Staff directory</h3><p>{branchId || 'All campuses'} · from HR records</p></div></div>
        <Tabs items={[`All staff (${n(current.length)})`, `Teaching (${n(teaching.length)})`, `Support (${n(current.length - teaching.length)})`, `Archived (${n(all.length - current.length)})`]}
          value={tab} onChange={reset(setTab)} />
        <div className="filters">
          <SearchBox placeholder="Search name, employee code, role or email" value={q} onChange={reset(setQ)} />
          <select className="select" aria-label="Department" value={dept} onChange={(e) => reset(setDept)(e.target.value)}>
            <option value="">All departments</option>{departments.map((d) => <option key={d}>{d}</option>)}
          </select>
          <select className="select" aria-label="Availability" value={avail} onChange={(e) => reset(setAvail)(e.target.value)}>
            <option value="">All availability</option><option value="available">Available</option><option value="leave">On leave today</option>
          </select>
        </div>
        {staff.error ? <ApiErr error={staff.error} /> : staff.loading ? <Loading /> : (
          <div className="tablebox">
            <DataTable
              cols={cols}
              sort={sort}
              cards
              rows={shown}
            />
            {!rows.length && <p className="small muted" style={{ padding: 16 }}>No staff match these filters.</p>}
            <Pager text={rows.length ? `Showing ${(Math.min(page, pages) - 1) * PAGE_SIZE + 1}–${(Math.min(page, pages) - 1) * PAGE_SIZE + shown.length} of ${rows.length} staff members` : 'No staff members'}
              page={Math.min(page, pages)} pages={pages} onPage={setPage} />
          </div>
        )}
      </Card>
      <div className="cols eq">
 <Card id="staff-leave">
          <SectionHead title="Leave & cover" link="Manage cover →" to="/teaching" />
          {leaves.error ? <ApiErr error={leaves.error} /> : !leaves.data ? <Loading /> : (<>
            <p className="body-s" style={{ marginTop: -6 }}>
              {leaveToday.length ? `${leaveToday.length} staff on approved leave today.` : 'Nobody is on leave today.'}
            </p>
            {leaveToday.map((s) => {
              const l = onLeave(leaves.data, s.staffId, today);
              return <p className="small" key={s.staffId} style={{ marginTop: 8 }}><b>{fullName(s)}</b> · {hr.LEAVE_LABEL[l.leaveType]} · {dateRange(l)}{l.proxyNotes ? ` · ${l.proxyNotes}` : ''}</p>;
            })}
            <div className="pills" style={{ marginTop: 14 }}>
              <Pill tone={pending.length ? 'amber' : 'green'}>{pending.length ? `${pending.length} requests pending` : 'No requests pending'}</Pill>
            </div>
          </>)}
        </Card>
        <Card>
          <SectionHead title="Probation & reviews" />
          {staff.data && (<>
            <p className="body-s" style={{ marginTop: -6 }}>{reviewsDue.length ? `${reviewsDue.length} staff on probation.` : 'All current staff are confirmed.'}</p>
            {reviewsDue.map((s) => (
              <p className="small" key={s.staffId} style={{ marginTop: 8 }}>
                <Link to={`/staff/${s.staffId}`}>{fullName(s)}</Link> · {hr.PROBATION[s.probationStatus]} · review due {formatDate(s.probationEndDate)}
              </p>
            ))}
          </>)}
        </Card>
      </div>
      <Footer />
    </>
  );
}

/* ---------- profile (GET /employees/{id} or /employees/me, leaves, quotas, CPD; timetable from academicservice) ---------- */

/** Record leave dialog: POST /api/v1/hr/leaves. Staff apply for themselves; HR, principals and heads for anyone. */
function RecordLeaveModal({ staff, onClose, onSaved }) {
  const today = todayIso();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    const v = Object.fromEntries(new FormData(e.currentTarget));
    if (!v.type || !v.from || !v.to) { setError('Choose the leave type and both dates.'); return; }
    if (v.to < v.from) { setError('The last day cannot be before the first day.'); return; }
    if (!v.reason.trim()) { setError('Give a reason for the leave.'); return; }
    setBusy(true);
    setError('');
    try {
      await hr.applyLeave({ staffId: staff.staffId, leaveType: v.type, startDate: v.from, endDate: v.to, reason: v.reason.trim(), proxyNotes: v.proxy.trim() || undefined });
      onSaved();
      onClose();
    } catch (err) {
      setError(err.status === 403 ? 'You can only apply for leave on your own profile.' : err.detail);
      setBusy(false);
    }
  };
  return (
    <Modal title="Record leave" sub={fullName(staff)} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" form="leave-form" disabled={busy}>{busy ? 'Saving…' : 'Record leave'}</button></>}>
      <form id="leave-form" className="fieldlist" noValidate onSubmit={submit}>
        <div className="field box"><label htmlFor="leave-type">LEAVE TYPE *</label>
          <select id="leave-type" name="type" defaultValue=""><option value="" disabled>Select leave type</option>{hr.LEAVE_TYPES.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></div>
        <div className="field box"><label htmlFor="leave-from">FIRST DAY *</label><input id="leave-from" name="from" type="date" defaultValue={today} /></div>
        <div className="field box"><label htmlFor="leave-to">LAST DAY *</label><input id="leave-to" name="to" type="date" defaultValue={today} /></div>
        <div className="field box"><label htmlFor="leave-reason">REASON *</label><input id="leave-reason" name="reason" placeholder="Why the leave is needed" /></div>
        <div className="field box"><label htmlFor="leave-proxy">COVER NOTES</label><input id="leave-proxy" name="proxy" placeholder="Optional: who covers the lessons" /></div>
        {error && <div className="api-error" role="alert"><span>{error}</span></div>}
        <p className="xs muted">The request goes to HR for approval. Days are counted from the first to the last day, inclusive.</p>
      </form>
    </Modal>
  );
}

const STAFF_TABS = [
  ['overview', 'Overview'], ['teaching', 'Teaching assignments'], ['timetable', 'Timetable'],
  ['leave', 'Leave & attendance'], ['documents', 'Documents'],
];

export function StaffProfile() {
  const { id } = useParams();
  const { user, hasRole } = useAuth();
  const [params, setParams] = useSearchParams();
  const index = Math.max(0, STAFF_TABS.findIndex(([key]) => key === params.get('tab')));
  const tab = STAFF_TABS[index][0];
  const setTab = (i) => setParams(i === 0 ? {} : { tab: STAFF_TABS[i][0] }, { replace: true });
  const today = todayIso();

  const emp = useApi(() => (id === 'me' ? hr.getMyProfile() : hr.getEmployee(id)), [id]);
  const s = emp.data;
  const staffId = s?.staffId;
  const leaves = useApi(() => hr.listLeaves({ staffId }), [staffId], !!staffId);
  const quotas = useApi(() => hr.listQuotas(staffId), [staffId], !!staffId);
  const cpd = useApi(() => hr.listCpd(staffId), [staffId], !!staffId);
  const teaches = s && staffType(s) === 'Teaching' && !!s.userId;
  const tt = useApi(() => lms.teacherTimetable(s.userId), [s?.userId], !!teaches);
  // The teacher timetable does not name its bell schedule: use the school's active one (as Teaching & learning does)
  const schedules = useApi(() => lms.listBellSchedules(), [], !!teaches && !!tt.data && !tt.data.bellScheduleId);
  const bellId = tt.data?.bellScheduleId || ((schedules.data || []).find((b) => b.active) || schedules.data?.[0])?.bellScheduleId;
  const bell = useApi(() => lms.getBellSchedule(bellId), [bellId], !!bellId);
  const [recording, setRecording] = useState(false);
  const [reviewing, setReviewing] = useState('');
  const [reviewError, setReviewError] = useState('');

  const self = !!s?.userId && s.userId === user.userId;
  const canRecord = s && isCurrent(s) && (self || hasRole(...hr.HR_ROLES.hrOfficer));
  const canApprove = hasRole(...hr.HR_ROLES.approveLeave) && !self;
  const review = async (l, status) => {
    setReviewing(l.applicationId);
    setReviewError('');
    try {
      await hr.reviewLeave(l.applicationId, { status, reviewComments: `${status === 'APPROVED' ? 'Approved' : 'Rejected'} from the staff profile` });
      leaves.reload(); quotas.reload();
    } catch (err) { setReviewError(err.detail); }
    setReviewing('');
  };

  const assignments = useMemo(() => {
    const by = {};
    for (const e of tt.data?.entries || []) {
      const k = `${e.className}|${e.subjectName}`;
      by[k] = by[k] || { cls: e.className, subject: e.subjectName, periods: 0 };
      by[k].periods += 1;
    }
    return Object.values(by).sort((a, b) => a.cls.localeCompare(b.cls) || a.subject.localeCompare(b.subject));
  }, [tt.data]);
  const isoDay = ((new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7) + 1; // Monday = 1
  const todayLessons = (tt.data?.entries || []).filter((e) => e.dayOfWeek === isoDay).sort((a, b) => a.periodNumber - b.periodNumber);
  const slotOf = (p) => bell.data?.slots.find((x) => x.slotType === 'PERIOD' && x.periodNumber === p);

  if (emp.error) {
    return (<>
      <PageHeader context={false} title={<BackTitle to="/staff" label="Back to staff">Staff profile</BackTitle>} desc="Employment details, teaching responsibilities and staff records in one place." />
      {emp.error.status === 404 ? <ApiNote>{id === 'me' ? 'There is no HR record linked to your account yet. Ask HR to add one.' : 'This staff member was not found.'}</ApiNote> : <ApiErr error={emp.error} />}
      <Footer />
    </>);
  }
  if (!s) return (<><PageHeader context={false} title="Staff profile" desc="Employment details, teaching responsibilities and staff records in one place." /><Loading /></>);

  const name = fullName(s);
  const [availText, availTone] = availability(s, leaves.data, today);
  const approved = (leaves.data || []).filter((l) => l.status === 'APPROVED');
  const pendingLeave = (leaves.data || []).filter((l) => l.status === 'PENDING');
  const upcoming = (leaves.data || []).filter((l) => l.status !== 'REJECTED' && l.status !== 'CANCELLED' && l.endDate >= today).sort((a, b) => a.startDate.localeCompare(b.startDate));
  const latestCpd = [...(cpd.data || [])].sort((a, b) => b.completionDate.localeCompare(a.completionDate))[0];

  const timetableNote = !teaches
    ? <ApiNote>{s.userId ? 'Support staff have no teaching timetable.' : 'No sign-in account is linked to this record, so the timetable cannot be looked up.'}</ApiNote>
    : tt.error ? (tt.error.status === 404 ? <ApiNote>No timetable has been generated for this teacher yet.</ApiNote> : <ApiErr error={tt.error} />)
      : tt.loading ? <Loading /> : null;

  const assignmentsCard = (
    <Card>
      <SectionHead title="Teaching assignments" sub="From the generated timetable (Teaching & learning)" link="Full timetable →" to="/teaching" />
      {timetableNote || (!assignments.length ? <ApiNote>No lessons are timetabled for this teacher.</ApiNote> : (<>
        <div style={{ margin: '18px 0 14px' }}>
          <DataTable boxed cols={[{ label: 'Class', key: 'cls' }, { label: 'Subject', key: 'subject' }, { label: 'Lessons / week', key: 'periods', className: 'num' }]}
            rows={assignments} />
        </div>
        <p className="xs muted">{tt.data.periodsPerWeek} of {tt.data.weeklyMaxPeriods ?? '—'} teaching periods per week</p>
      </>))}
    </Card>
  );
  const timetableCard = (
    <Card>
      <SectionHead title="Today’s timetable" sub={formatDate(today, { weekday: 'long', year: false })} link="Full timetable →" to="/teaching" />
      <div style={{ marginTop: 18 }}>
        {timetableNote || (!todayLessons.length ? <ApiNote>No lessons today.</ApiNote> : (
          <DataTable boxed cols={[
            { label: 'Time', render: (e) => { const x = slotOf(e.periodNumber); return x ? `${lms.hhmm(x.startTime)}–${lms.hhmm(x.endTime)}` : `P${e.periodNumber}`; } },
            { label: 'Lesson', key: 'subjectName' }, { label: 'Class', key: 'className' },
          ]} rows={todayLessons} />
        ))}
      </div>
    </Card>
  );
  const weekCard = (
    <Card>
      <SectionHead title="Weekly timetable" sub={tt.data ? `${tt.data.periodsPerWeek} periods a week` : undefined} />
      <div style={{ marginTop: 14 }}>
        {timetableNote || (bell.error ? <ApiErr error={bell.error} /> : schedules.error ? <ApiErr error={schedules.error} />
          : !bellId && !schedules.loading ? <ApiNote>No bell schedule is set up yet.</ApiNote>
            : !bell.data ? <Loading /> : <TimetableGrid bell={bell.data} entries={tt.data.entries} show="class" />)}
      </div>
    </Card>
  );
  const qualificationsCard = (
    <Card>
      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Qualifications & professional development</h3>
      <KV rows={[
        ['Qualifications', s.qualifications || '—'],
        ['Latest training', latestCpd ? `${latestCpd.courseTitle} · ${latestCpd.conductingAgency} · ${formatDate(latestCpd.completionDate)}` : cpd.loading ? '…' : 'None recorded'],
        ['CPD this year', cpd.data ? `${formatNumber(cpd.data.reduce((t, c) => t + Number(c.trainingHours), 0))} hours · ${formatNumber(cpd.data.reduce((t, c) => t + Number(c.creditsEarned), 0))} credits` : '…'],
      ]} />
    </Card>
  );
  const employmentCard = (
    <Card>
      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Employment & contact</h3>
      <KV rows={[
        ['Department', s.department], ['Role', s.designation], ['Contract', s.contractTerms || '—'],
        ['Probation', `${hr.PROBATION[s.probationStatus] || '—'}${s.probationEndDate ? ` · ${s.probationStatus === 'CONFIRMED' ? 'ended' : 'ends'} ${formatDate(s.probationEndDate)}` : ''}`],
        ['Campus', s.branchId], ['Joined', formatDate(s.joiningDate)],
      ]} />
    </Card>
  );
  // Only returned to HR, payroll, the principal and the employee themself (hrservice masks it for everyone else)
  const payCard = s.basicSalary != null && (
    <Card>
      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Pay & statutory details</h3>
      <KV rows={[
        ['Basic salary', `${formatMoney(s.basicSalary)} a month`], ['PAN', s.panNumber || '—'], ['PF UAN', s.pfUan || '—'],
        ['Bank', s.bankName ? `${s.bankName} · ••••${(s.bankAccountNumber || '').slice(-4)} · ${s.bankIfsc}` : '—'],
      ]} />
      <p className="xs muted" style={{ marginTop: 8 }}>Visible to HR, payroll, the principal and {self ? 'you' : 'the employee'}.</p>
    </Card>
  );
  const leaveCard = (
    <Card>
      <SectionHead title="Leave & attendance" sub={`Leave year ${today.slice(0, 4)}`} />
      {leaves.error ? <ApiErr error={leaves.error} /> : !leaves.data ? <Loading /> : (<>
        <div className="row" style={{ justifyContent: 'flex-start', gap: 40, margin: '18px 0 14px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div><div style={{ fontSize: 26, fontWeight: 600 }}>{days(approved.filter((l) => l.startDate.startsWith(today.slice(0, 4))).reduce((t, l) => t + Number(l.totalDays), 0))}</div><div className="xs muted">Approved leave taken</div></div>
          <div><div style={{ fontSize: 26, fontWeight: 600 }}>{pendingLeave.length}</div><div className="xs muted">Pending requests</div></div>
          {(quotas.data || []).map((qt) => (
            <div key={qt.leaveType}><div style={{ fontSize: 26, fontWeight: 600 }}>{formatNumber(Number(qt.balanceDays))}</div><div className="xs muted">{hr.LEAVE_LABEL[qt.leaveType]} left of {formatNumber(Number(qt.totalEntitled))}</div></div>
          ))}
        </div>
        {upcoming.length
          ? <Pill tone="amber">Upcoming: {hr.LEAVE_LABEL[upcoming[0].leaveType]} from {formatDate(upcoming[0].startDate)}</Pill>
          : <Pill tone="green">No upcoming leave</Pill>}
        {leaves.data.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <DataTable boxed cols={[
              { label: 'Leave', render: (l) => <span className="cell-id"><b>{hr.LEAVE_LABEL[l.leaveType]}</b><small>{l.reason}{l.proxyNotes ? ` · ${l.proxyNotes}` : ''}</small></span> },
              { label: 'Dates', render: dateRange },
              { label: 'Days', render: (l) => formatNumber(Number(l.totalDays)), className: 'num' },
              { label: 'Status', render: (l) => {
                const [t, tone] = hr.LEAVE_STATUS[l.status] || [l.status, ''];
                if (l.status !== 'PENDING' || !canApprove) return <span className="cell-id"><Pill tone={tone}>{t}</Pill>{l.reviewComments && l.reviewComments !== t && <small>{l.reviewComments}</small>}</span>;
                return (
                  <span className="pills">
                    <button type="button" className="btn" disabled={!!reviewing} onClick={() => review(l, 'APPROVED')}><Check size={13} />Approve</button>
                    <button type="button" className="btn" disabled={!!reviewing} onClick={() => review(l, 'REJECTED')}><X size={13} />Reject</button>
                  </span>
                );
              } },
            ]} rows={leaves.data} />
          </div>
        )}
        {reviewError && <div className="api-error" role="alert" style={{ marginTop: 10 }}><span>{reviewError}</span></div>}
        {canRecord && <div style={{ marginTop: 16 }}><button type="button" className="btn" onClick={() => setRecording(true)}><Plus size={15} />{self ? 'Apply for leave' : 'Record leave'}</button></div>}
      </>)}
    </Card>
  );
  const documentsCard = (
    <Card>
      <SectionHead title="Documents" sub="Restricted · Human resources" />
      <div style={{ marginTop: 14 }}>
        <ApiNote>hrservice has no document vault endpoint yet, so contracts and certificates cannot be listed here.</ApiNote>
      </div>
    </Card>
  );

  return (
    <>
      <PageHeader context={false}
        title={<BackTitle to="/staff" label="Back to staff">{name}</BackTitle>}
        desc="Employment details, teaching responsibilities and staff records in one place."
        actions={[
          s.email && { label: 'More actions', more: [{ label: 'Message staff', onClick: () => { window.location.href = `mailto:${s.email}`; } }] },
          hasRole(...hr.HR_ROLES.manage) && { label: 'Edit staff details', icon: <Pencil size={14} />, primary: true, to: `/staff/${s.staffId}/edit` },
        ].filter(Boolean)}
      />
      <Card className="summary">
        <StaffPhoto staff={s} />
        <div className="id">
          <h2>{name}</h2>
          <p>{s.employeeCode} · {s.designation} · {s.department}</p>
          <div className="pills"><Pill tone={availTone}>{availText}</Pill>{s.contractTerms && <Pill tone="purple">{s.contractTerms}</Pill>}
            {s.probationStatus !== 'CONFIRMED' && <Pill tone="amber">{hr.PROBATION[s.probationStatus]}</Pill>}</div>
        </div>
        <div className="side">
          {s.email && <a className="link strong" href={`mailto:${s.email}`}>{s.email}</a>}
          {s.phone && <span>{s.phone}</span>}<span>Joined {formatDate(s.joiningDate)}</span>
        </div>
      </Card>
      <Tabs items={STAFF_TABS.map(([, label]) => label)} value={index} onChange={setTab} />
      {tab === 'overview' && (
        <div className="cols">
          <div className="stack">{assignmentsCard}{timetableCard}{qualificationsCard}</div>
          <div className="stack">{employmentCard}{leaveCard}{payCard}</div>
        </div>
      )}
      {tab === 'teaching' && <div className="stack">{assignmentsCard}{qualificationsCard}</div>}
      {tab === 'timetable' && <div className="stack">{timetableCard}{weekCard}</div>}
      {tab === 'leave' && <div className="stack">{leaveCard}</div>}
      {tab === 'documents' && <div className="stack">{documentsCard}{payCard}</div>}
      {recording && <RecordLeaveModal staff={s} onClose={() => setRecording(false)} onSaved={() => { leaves.reload(); quotas.reload(); }} />}
      <Footer />
    </>
  );
}

/* ---------- staff photo (POST /employees/{id}/photo, GET /employees/{id}/photo/file) ---------- */

/** The staff photo, or initials when none is on file; with `canChange`, a button to upload a JPEG or PNG. */
function StaffPhoto({ staff, canChange = false, onChanged, onError }) {
  const [url, setUrl] = useState(null);
  const [busy, setBusy] = useState(false);
  const inputId = `staff-photo-${staff.staffId}`;
  const initials = `${staff.firstName[0]}${staff.lastName[0]}`.toUpperCase();
  useEffect(() => {
    if (!staff.hasPhoto) { setUrl(null); return undefined; }
    let cancelled = false;
    let objectUrl = null;
    hr.employeePhotoBlob(staff.staffId)
      .then((blob) => { if (!cancelled) { objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); } })
      .catch(() => { if (!cancelled) setUrl(null); });
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [staff]);
  const choose = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    // Checked here, before sending, so a file the server would refuse gets a clear message, not a dropped connection
    const problem = !['image/jpeg', 'image/png'].includes(file.type) ? 'Choose a JPEG or PNG photo.'
      : file.size > 5 * 1024 * 1024 ? `This photo is ${(file.size / (1024 * 1024)).toFixed(1)} MB. The limit is 5 MB.` : null;
    if (problem) { onError?.({ detail: problem }); return; }
    setBusy(true); onError?.(null);
    try { await hr.uploadEmployeePhoto(staff.staffId, file); onChanged?.(); } catch (err) { onError?.(err); } finally { setBusy(false); }
  };
  return (
    <>
      <div className="bigavatar">{url ? <img src={url} alt={`Photo of ${staff.firstName} ${staff.lastName}`} className="avatar-img" /> : initials}</div>
      {canChange && (
        <div>
          <label className="btn" htmlFor={inputId} aria-disabled={busy}>
            {busy ? <LoaderCircle size={14} className="spin" /> : <Upload size={15} />}{staff.hasPhoto ? 'Change photo' : 'Add photo'}
          </label>
          <input id={inputId} type="file" accept="image/jpeg,image/png" hidden disabled={busy} onChange={choose} />
          <small>JPEG or PNG · Maximum 5 MB</small>
        </div>
      )}
    </>
  );
}

/* ---------- edit / add (POST /employees, PUT /employees/{id}) ---------- */

const DEPARTMENTS = ['Mathematics', 'Science', 'English', 'Hindi', 'Social Science', 'Computer Science', 'Physical Education',
  'Academics', 'Examinations', 'Leadership', 'Administration', 'Accounts', 'Admissions', 'IT', 'Student Wellbeing'];

export function StaffForm() {
  const nav = useNavigate();
  const { id } = useParams();
  const isNew = useLocation().pathname.endsWith('/new');
  const { branchId, hasRole } = useAuth();
  const canManage = hasRole(...hr.HR_ROLES.manage);
  const emp = useApi(() => hr.getEmployee(id), [id], !isNew);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [photoError, setPhotoError] = useState(null);
  const s = isNew ? {} : emp.data;
  const back = isNew ? '/staff' : `/staff/${id}`;

  const submit = async (e) => {
    e.preventDefault();
    const v = Object.fromEntries(new FormData(e.currentTarget));
    const body = {
      employeeCode: isNew ? v['employee-code']?.trim() : s.employeeCode,
      firstName: v['first-name']?.trim(), lastName: v['last-name']?.trim(), email: v['work-email']?.trim() || undefined,
      phone: v['mobile-number']?.trim() || undefined, department: v.department, designation: v['role-job-title']?.trim(),
      basicSalary: v['basic-salary-month'] ? Number(v['basic-salary-month']) : undefined, joiningDate: v['start-date'] || undefined,
      contractTerms: v.contract || undefined, qualifications: v.qualifications?.trim() || undefined,
      probationEndDate: v['probation-ends'] || undefined, branchId: v.campus?.trim() || undefined, userId: v['sign-in-account-id']?.trim() ?? undefined,
    };
    const missing = [['employeeCode', 'Employee code'], ['firstName', 'First name'], ['lastName', 'Last name'], ['department', 'Department'],
      ['designation', 'Role / job title'], ['basicSalary', 'Basic salary'], ['joiningDate', 'Start date'], ['branchId', 'Campus']].filter(([k]) => !body[k]);
    if (missing.length) { setError({ detail: `Fill in: ${missing.map(([, l]) => l).join(', ')}.` }); return; }
    setBusy(true);
    setError(null);
    try {
      const saved = isNew ? await hr.createEmployee(body) : await hr.updateEmployee(id, body);
      nav(`/staff/${saved.staffId}`);
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  };

  if (!isNew && (emp.error || !s)) {
    return (<>
      <PageHeader context={false} title={<BackTitle to="/staff" label="Back to staff">Edit staff details</BackTitle>} desc="Maintain personal, employment and contract information." />
      {emp.error ? <ApiErr error={emp.error} /> : <Loading />}
    </>);
  }

  return (
    <form onSubmit={submit} noValidate style={{ display: 'contents' }} key={s.staffId || 'new'}>
      <PageHeader context={false}
        title={<BackTitle to={back} label={isNew ? 'Back to staff' : 'Back to profile'}>{isNew ? 'Add staff member' : 'Edit staff details'}</BackTitle>}
        desc={isNew ? 'Create an HR record with employment and contract details.' : `Maintain ${fullName(s)}’s personal, employment and contract information.`}
      />
      {!canManage && <ApiNote>Only HR, the principal or a super administrator can add or edit staff records.</ApiNote>}
      <div className="cols s404">
        <div className="stack">
          <Card>
            <div className="cardhead"><h3>Personal & contact details</h3><p>Required fields are marked with an asterisk.</p></div>
            <div className="photo">
              {isNew ? <div className="bigavatar">+</div> : <StaffPhoto staff={s} canChange={canManage} onChanged={emp.reload} onError={setPhotoError} />}
              {!isNew && <Pill tone="purple">{s.employeeCode}</Pill>}
            </div>
            {photoError && <div style={{ marginTop: 10 }}><ApiErr error={photoError} /></div>}
            <FieldGrid cols={[
              [{ label: 'First name', required: true, value: s.firstName, placeholder: 'Enter first name' }, { label: 'Work email', value: s.email, placeholder: 'name@school.edu.in' }],
              [{ label: 'Last name', required: true, value: s.lastName, placeholder: 'Enter last name' }, { label: 'Mobile number', value: s.phone, placeholder: '+91…' }],
            ]} />
          </Card>
          <Card>
            <div className="cardhead"><h3>Employment information</h3></div>
            <FieldGrid cols={[
              [
                isNew ? { label: 'Employee code', required: true, placeholder: 'e.g. DPS-EMP-1050' } : { label: 'Employee code', value: s.employeeCode, readOnly: true },
                { label: 'Department', required: true, select: true, value: s.department, placeholder: 'Select department', options: DEPARTMENTS.includes(s.department) || !s.department ? DEPARTMENTS : [s.department, ...DEPARTMENTS] },
                { label: 'Basic salary / month', required: true, type: 'number', value: s.basicSalary ?? '', placeholder: 'e.g. 45000' },
                { label: 'Contract', select: true, value: s.contractTerms, placeholder: 'Select contract', options: [...new Set([s.contractTerms, 'Permanent Full-Time', 'Probationary Contract', 'Fixed-Term', 'Part-Time 0.7 FTE'].filter(Boolean))] },
                isNew ? { label: 'Probation ends', type: 'date', placeholder: 'Default: 6 months after the start date' } : { label: 'Probation', value: hr.PROBATION[s.probationStatus], readOnly: true },
              ],
              [
                { label: 'Role / job title', required: true, value: s.designation, placeholder: 'e.g. TGT Mathematics' },
                { label: 'Start date', required: true, type: 'date', value: s.joiningDate },
                { label: 'Campus', required: true, value: s.branchId || branchId, placeholder: 'e.g. DPS-DELHI-NORTH' },
                { label: 'Sign-in account ID', value: s.userId || '', placeholder: 'authservice user ID (optional)' },
              ],
            ]} />
          </Card>
          <Card>
            <h3 style={{ fontSize: 15, fontWeight: 600 }}>Teaching assignments & access</h3>
            <p className="small muted" style={{ marginTop: 6 }}>Classes and periods come from the timetable (Teaching & learning); system roles are managed in Settings → Users & permissions.</p>
          </Card>
        </div>
        <div className="stack">
          <Card className="notice">
            <h4>{isNew ? 'New staff record' : 'Existing staff record'}</h4>
            <p>{isNew ? 'The record starts on probation. Link the sign-in account so the person can see their own profile, leave and timetable.'
              : 'PAN, Aadhaar, PF/ESI and bank details are kept as they are; payroll maintains them.'}</p>
          </Card>
          <Card>
            <h3 style={{ fontSize: 15, fontWeight: 600 }}>Qualifications</h3>
            <div className="fieldlist">
              <Field box label="Qualifications" value={s.qualifications} placeholder="e.g. M.Sc Mathematics, B.Ed" />
            </div>
          </Card>
        </div>
      </div>
      {error && <div className="api-error" role="alert"><span>{error.validationErrors?.length ? error.validationErrors.map((x) => x.message).join(' · ') : error.detail}</span></div>}
      <div className="formbar">
        <span>{isNew ? 'Draft not yet saved' : `Employee ${s.employeeCode}`}</span>
        <div className="actions">
          <Link to={back} className="btn">Cancel</Link>
          <button type="submit" className="btn primary" disabled={!canManage || busy}>{busy ? 'Saving…' : 'Save changes'}</button>
        </div>
      </div>
      <Footer />
    </form>
  );
}
