import { useEffect, useMemo, useState } from 'react';
import { Modal } from './AuthSettings.jsx';
import { SectionHead, Pill, Tabs, DataTable } from './ui.jsx';
import { ApiNote, gradeLabel } from './Admissions.jsx';
import { useStudents } from './StudentRecords.jsx';
import { useAuth } from '../auth.jsx';
import { useApi } from '../api/useApi.js';
import * as admissionApi from '../api/admissionService.js';
import * as studentApi from '../api/studentService.js';
import { formatNumber } from '../regional.js';

// Open applications that have not changed for this many days count as stuck
export const STUCK_DAYS = 7;
const STAGES = ['NEW_INQUIRY', 'CONTACTED', 'EVALUATION_SCHEDULED', 'EVALUATION_PASSED', 'OFFER_ISSUED', 'ENROLLED'];
const STAGE_TITLE = {
  NEW_INQUIRY: 'New enquiry', CONTACTED: 'Contacted', EVALUATION_SCHEDULED: 'Assessment scheduled', EVALUATION_PASSED: 'Assessment passed',
  OFFER_ISSUED: 'Offer issued', ENROLLED: 'Enrolled', REJECTED: 'Not offered', WITHDRAWN: 'Withdrawn',
};
const LOST = ['REJECTED', 'WITHDRAWN'];
// Call records and callbacks are readable by these roles only (CounselingCallController)
const CALL_READ = ['FRONT_OFFICE_COUNSELOR', 'ADMISSION_OFFICER', 'MARKETING_MANAGER', 'SUPER_ADMIN'];

const DAY = 24 * 60 * 60 * 1000;
const daysSince = (t) => Math.floor((Date.now() - new Date(t).getTime()) / DAY);
const isOpen = (e) => admissionApi.OPEN_STATUSES.includes(e.enquiryStatus);
const label = (code) => (code || 'Unknown').toLowerCase().split('_').map((w) => (w ? w[0].toUpperCase() + w.slice(1) : '')).join(' ');
/** "meera.counselor@dps.edu.in" -> "Meera" (counselors are stored by sign-in email). */
const counselorName = (id) => {
  if (!id) return 'Unassigned';
  const first = String(id).split('@')[0].split(/[._-]/)[0];
  return first ? first[0].toUpperCase() + first.slice(1) : id;
};
const pct = (n, d) => (d ? `${Math.round((n / d) * 100)}%` : '—');
const hoursLabel = (h) => (h === null ? '—' : h < 24 ? `${Math.round(h)} h` : `${(h / 24).toFixed(1)} days`);

/** Open applications with no change for STUCK_DAYS or more (time since the record last changed: stage dates are not stored). */
export const stuckApplications = (rows) => rows.filter((e) => isOpen(e) && daysSince(e.updatedAt || e.createdAt) >= STUCK_DAYS)
  .sort((a, b) => daysSince(b.updatedAt || b.createdAt) - daysSince(a.updatedAt || a.createdAt));

/**
 * Chance that an application now at each stage enrols, from the pipeline as it stands:
 * enrolled ÷ applications that reached the stage (closed applications are left out, their last stage is not stored).
 */
function enrolChance(rows) {
  const at = (i) => rows.filter((e) => STAGES.indexOf(e.enquiryStatus) >= i).length;
  const enrolled = at(STAGES.length - 1);
  return Object.fromEntries(STAGES.map((s, i) => [s, at(i) ? enrolled / at(i) : 0]));
}

/* ---------- seat demand by grade ---------- */

function SeatDemand({ rows }) {
  const { user } = useAuth();
  const students = useStudents();
  const grades = useApi(() => studentApi.listGrades(user.tenantId), [user?.tenantId], !!user?.tenantId);
  const gradeIds = (grades.data || []).map((g) => g.gradeId);
  const sections = useApi(() => Promise.all(gradeIds.map((id) => studentApi.listSections(id))).then((all) => all.flat()),
    [gradeIds.join(',')], gradeIds.length > 0);
  const chance = useMemo(() => enrolChance(rows), [rows]);

  const table = useMemo(() => (grades.data || []).slice().sort((a, b) => (a.sequenceOrder ?? 0) - (b.sequenceOrder ?? 0)).map((g) => {
    const seats = (sections.data || []).filter((s) => s.gradeId === g.gradeId).reduce((n, s) => n + (s.maxCapacity || 0), 0);
    const onRoll = students.live ? students.current.filter((s) => s.gradeId === g.gradeId).length : null;
    const free = onRoll === null ? null : Math.max(0, seats - onRoll);
    const open = rows.filter((e) => isOpen(e) && e.targetGradeId === g.gradeCode);
    const expected = open.reduce((n, e) => n + (chance[e.enquiryStatus] || 0), 0);
    const outlook = free === null ? ['', '']
      : !open.length ? ['No applications', '']
        : expected > free ? ['Over-subscribed', 'red']
          : open.length > free ? ['Waitlist likely', 'amber'] : ['Room for more', 'green'];
    return { grade: g.gradeName, seats, free, open: open.length, expected, outlook };
  }), [grades.data, sections.data, students.live, students.current, rows, chance]);

  if (grades.error || sections.error) return <ApiNote>Class seats are visible to registrars, principals and super administrators.</ApiNote>;
  if (!sections.data) return <p className="xs muted">Loading seats and applications…</p>;
  const withApps = table.filter((r) => r.open);
  const without = table.filter((r) => !r.open && (r.free ?? r.seats) > 0);
  const free = table.reduce((n, r) => n + (r.free ?? 0), 0);
  const expected = table.reduce((n, r) => n + r.expected, 0);
  return (
    <div className="pulse-panel">
      <SectionHead title="Seat demand by grade"
        sub={`${students.live ? `${formatNumber(free)} seats free` : `${formatNumber(table.reduce((n, r) => n + r.seats, 0))} seats`} · ${formatNumber(withApps.reduce((n, r) => n + r.open, 0))} open applications · about ${expected.toFixed(1)} expected to enrol at today's conversion`} />
      {withApps.length ? (
        <div style={{ marginTop: 12 }}><DataTable boxed cols={[
          { label: 'Grade', render: (r) => <b style={{ fontWeight: 600 }}>{r.grade}</b> },
          { label: 'Seats free', className: 'num', render: (r) => (r.free === null ? '—' : formatNumber(r.free)) },
          { label: 'Open applications', className: 'num', render: (r) => formatNumber(r.open) },
          { label: 'Expected to enrol', className: 'num', render: (r) => r.expected.toFixed(1) },
          { label: 'Outlook', render: (r) => (r.outlook[0] ? <Pill tone={r.outlook[1]}>{r.outlook[0]}</Pill> : '—') },
        ]} rows={withApps} /></div>
      ) : <p className="body-s" style={{ marginTop: 12 }}>No open applications in any grade.</p>}
      {without.length > 0 && (
        <p className="small" style={{ marginTop: 12 }}><b>No applications yet:</b> {without.map((r) => `${r.grade}${r.free !== null ? ` (${r.free} free)` : ''}`).join(' · ')}</p>
      )}
      <p className="xs muted" style={{ marginTop: 10 }}>
        Expected to enrol: each open application counts as the share of applications at its stage that went on to enrol.
        {!students.live && ' Seats free needs access to student records; total seats are shown instead.'}
      </p>
    </div>
  );
}

/* ---------- stuck and slow applications ---------- */

function Delays({ rows, calls, callbacks, canReadCalls }) {
  const stuck = stuckApplications(rows);
  const firstCall = useMemo(() => {
    const m = new Map();
    (calls.data || []).forEach(([id, cs]) => {
      const first = cs.map((c) => new Date(c.calledAt).getTime()).sort((a, b) => a - b)[0];
      if (first) m.set(id, first);
    });
    return m;
  }, [calls.data]);
  const waits = rows.filter((e) => firstCall.has(e.enquiryId)).map((e) => (firstCall.get(e.enquiryId) - new Date(e.createdAt).getTime()) / 3600000)
    .filter((h) => h >= 0).sort((a, b) => a - b);
  const median = waits.length ? waits[Math.floor(waits.length / 2)] : null;
  const neverContacted = calls.data ? rows.filter((e) => isOpen(e) && !firstCall.has(e.enquiryId)).length : null;
  const overdue = callbacks.data ? callbacks.data.filter((c) => c.overdue).length : null;
  const noCalls = 'Call records: counselors, admission officers and the marketing manager';

  return (
    <div className="pulse-panel">
      <SectionHead title="Stuck and slow applications" sub={`${formatNumber(stuck.length)} open application${stuck.length === 1 ? '' : 's'} with no change for ${STUCK_DAYS}+ days`} />
      <dl className="movegrid">
        <div><dt>Median first response</dt><dd>{canReadCalls ? (calls.loading ? '…' : hoursLabel(median)) : '—'}</dd>
          <small>{canReadCalls ? `Enquiry to first counseling call · ${formatNumber(waits.length)} with a call` : noCalls}</small></div>
        <div><dt>Never contacted</dt><dd className={neverContacted ? 'down' : ''}>{canReadCalls ? (neverContacted ?? '…') : '—'}</dd>
          <small>{canReadCalls ? 'Open applications with no call logged' : noCalls}</small></div>
        <div><dt>Overdue callbacks</dt><dd className={overdue ? 'down' : ''}>{canReadCalls ? (overdue ?? '…') : '—'}</dd>
          <small>{canReadCalls ? 'Promised calls past their time' : noCalls}</small></div>
      </dl>
      {stuck.length ? (
        <div style={{ marginTop: 14 }}><DataTable boxed cols={[
          { label: 'Applicant', render: (e) => <span className="cell-id"><b>{e.candidateFirstName} {e.candidateLastName}</b><small>{e.applicationNumber} · {gradeLabel(e.targetGradeId)}</small></span> },
          { label: 'Stage', render: (e) => STAGE_TITLE[e.enquiryStatus] || label(e.enquiryStatus) },
          { label: 'Counselor', render: (e) => <span title={e.assignedCounselorId || ''}>{counselorName(e.assignedCounselorId)}</span> },
          { label: 'No change for', render: (e) => { const d = daysSince(e.updatedAt || e.createdAt); return <Pill tone={d >= 14 ? 'red' : 'amber'}>{d} days</Pill>; } },
        ]} rows={stuck} /></div>
      ) : <p className="body-s" style={{ marginTop: 14 }}>Every open application has moved in the last {STUCK_DAYS} days.</p>}
      <p className="xs muted" style={{ marginTop: 10 }}>"No change for" counts from the application's last update, as the date each stage was reached is not stored.</p>
    </div>
  );
}

/* ---------- source and counselor effectiveness ---------- */

function Effectiveness({ rows, calls, callbacks, canReadCalls }) {
  const group = (key) => {
    const m = new Map();
    rows.forEach((e) => {
      const k = key(e);
      const g = m.get(k) || { key: k, total: 0, open: 0, enrolled: 0, lost: 0, stuck: 0, ids: [] };
      g.total += 1; g.ids.push(e.enquiryId);
      if (isOpen(e)) g.open += 1;
      if (e.enquiryStatus === 'ENROLLED') g.enrolled += 1;
      if (LOST.includes(e.enquiryStatus)) g.lost += 1;
      if (isOpen(e) && daysSince(e.updatedAt || e.createdAt) >= STUCK_DAYS) g.stuck += 1;
      m.set(k, g);
    });
    return [...m.values()].sort((a, b) => b.total - a.total);
  };
  const sources = group((e) => e.referralSource || 'UNKNOWN');
  const counselors = group((e) => e.assignedCounselorId || '');
  const callCount = new Map((calls.data || []).map(([id, cs]) => [id, cs.length]));
  const overdueBy = (who) => (callbacks.data || []).filter((c) => c.overdue && c.assignedTo === who).length;
  const best = sources.filter((s) => s.enrolled).sort((a, b) => b.enrolled / b.total - a.enrolled / a.total)[0];

  return (
    <div className="pulse-panel">
      <SectionHead title="What converts" sub={best ? `Best converting source: ${label(best.key)} (${pct(best.enrolled, best.total)} of its enquiries enrolled)` : 'No enrolments yet to compare sources'} />
      <div style={{ marginTop: 12 }}><DataTable boxed cols={[
        { label: 'Source', render: (s) => <b style={{ fontWeight: 600 }}>{label(s.key)}</b> },
        { label: 'Enquiries', className: 'num', render: (s) => formatNumber(s.total) },
        { label: 'In progress', className: 'num', render: (s) => formatNumber(s.open) },
        { label: 'Enrolled', className: 'num', render: (s) => formatNumber(s.enrolled) },
        { label: 'Lost', className: 'num', render: (s) => formatNumber(s.lost) },
        { label: 'Conversion', render: (s) => <Pill tone={s.enrolled ? 'green' : ''}>{pct(s.enrolled, s.total)}</Pill> },
      ]} rows={sources} /></div>
      <h4 style={{ fontSize: 13, fontWeight: 600, margin: '18px 0 8px' }}>By counselor</h4>
      <DataTable boxed cols={[
        { label: 'Counselor', render: (c) => <span className="cell-id"><b>{counselorName(c.key)}</b><small>{c.key || 'No counselor assigned'}</small></span> },
        { label: 'Assigned', className: 'num', render: (c) => formatNumber(c.total) },
        { label: 'Enrolled', className: 'num', render: (c) => formatNumber(c.enrolled) },
        { label: 'Stuck', className: 'num', render: (c) => (c.stuck ? <Pill tone="amber">{c.stuck}</Pill> : '0') },
        { label: 'Calls logged', className: 'num', render: (c) => (canReadCalls && calls.data ? formatNumber(c.ids.reduce((n, id) => n + (callCount.get(id) || 0), 0)) : '—') },
        { label: 'Overdue callbacks', className: 'num', render: (c) => (canReadCalls && callbacks.data ? formatNumber(overdueBy(c.key)) : '—') },
        { label: 'Conversion', render: (c) => pct(c.enrolled, c.total) },
      ]} rows={counselors} />
      <p className="xs muted" style={{ marginTop: 10 }}>
        Conversion is enrolled ÷ all enquiries from that source or counselor, including those still in progress.
        {!canReadCalls && ' Calls and callbacks are visible to counselors, admission officers and the marketing manager.'}
      </p>
    </div>
  );
}

/* ---------- the pop-up ---------- */

const OUTLOOK_TABS = ['Seat demand', 'Stuck and slow', 'What converts'];

/**
 * Admissions outlook (last stat card on the Admissions page). Opening it reloads the applications and reads calls,
 * callbacks, seats and students from the services, so the figures are current.
 */
export function AdmissionsOutlookModal({ apps, onClose }) {
  const { user, hasRole } = useAuth();
  const [tab, setTab] = useState(0);
  const canReadCalls = hasRole(...CALL_READ);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { apps.reload(); }, []);
  const rows = apps.rows;
  const ids = rows.slice(0, 80).map((e) => e.enquiryId);
  const calls = useApi(() => Promise.all(ids.map((id) => admissionApi.listCalls(id).then((cs) => [id, cs]))),
    [ids.join(',')], canReadCalls && ids.length > 0);
  const callbacks = useApi(() => admissionApi.dueCallbacks(user.tenantId), [user?.tenantId], canReadCalls && !!user?.tenantId);
  return (
    <Modal title="Admissions outlook" sub="Seat demand by grade, applications that are stuck or slow, and which sources and counselors convert" onClose={onClose}
      footer={<button className="btn primary" onClick={onClose}>Done</button>}>
      <Tabs items={OUTLOOK_TABS} value={tab} onChange={setTab} />
      <div style={{ marginTop: 16 }}>
        {!apps.data ? <p className="xs muted">Loading applications…</p>
          : tab === 0 ? <SeatDemand rows={rows} />
            : tab === 1 ? <Delays rows={rows} calls={calls} callbacks={callbacks} canReadCalls={canReadCalls} />
              : <Effectiveness rows={rows} calls={calls} callbacks={callbacks} canReadCalls={canReadCalls} />}
      </div>
    </Modal>
  );
}
