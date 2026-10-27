import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SectionHead, Pill, Tabs, avatarTone } from './ui.jsx';
import { Modal } from './AuthSettings.jsx';
import { useAuth } from '../auth.jsx';
import { useApi } from '../api/useApi.js';
import * as studentApi from '../api/studentService.js';
import * as fin from '../api/financeService.js';
import * as exam from '../api/examService.js';
import { formatNumber, formatDate } from '../regional.js';

const { fullName, classLabel, LEFT_STATUSES, STUDENT_STATUS } = studentApi;

/** Local calendar date as yyyy-mm-dd (toISOString would shift it to UTC). */
const isoDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** The academic year starts on 1 April. */
const academicYearStart = (d) => new Date(d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1, 3, 1);
const plural = (n, word) => `${formatNumber(n)} ${word}${n === 1 ? '' : 's'}`;
const initials = (s) => `${s.firstName?.[0] || ''}${s.lastName?.[0] || ''}`.toUpperCase();

// Thresholds for the "needs attention" signals
const ABSENCE_DAYS = 30; // look-back window for unexcused absences
const ABSENCE_LIMIT = 3; // unexcused absences in that window
const MARK_LIMIT = 40; // overall percentage in the latest exam term

/* ---------- students needing attention ---------- */

/**
 * Students on roll flagged on attendance, fees, assessment or record gaps, those with several flags first.
 * Each signal is read only for roles that may see it; a signal that cannot be read is named, not hidden.
 */
export function AtRiskCard({ list }) {
  const { branchId, hasRole } = useAuth();
  const today = new Date();
  const from = new Date(today); from.setDate(from.getDate() - ABSENCE_DAYS);
  const canFees = hasRole(...fin.ROLES.staff);
  const canExam = hasRole(...exam.ROLES.view);
  const absences = useApi(() => studentApi.listAbsences({ branchId, status: 'UNEXCUSED', from: isoDate(from), to: isoDate(today) }),
    [branchId], !!branchId && list.live);
  const fees = useApi(() => fin.defaulters(branchId), [branchId], !!branchId && canFees && list.live);
  const terms = useApi(() => exam.listTerms(), [], canExam && list.live);
  // Latest exam term that has started
  const term = useMemo(() => (terms.data || []).filter((t) => t.startDate && t.startDate <= isoDate(today))
    .sort((a, b) => b.startDate.localeCompare(a.startDate))[0], [terms.data]);
  // The rank list is per grade (the service needs a gradeId or sectionId), so it is read for each grade with students on roll
  const gradeIds = [...new Set(list.current.map((s) => s.gradeId).filter(Boolean))];
  const ranks = useApi(() => Promise.all(gradeIds.map((gradeId) => exam.rankList(term.examTermId, { gradeId, branchId })
    // A grade without results for the term is skipped; a refusal for the role fails the whole signal
    .catch((e) => (e.status === 403 ? Promise.reject(e) : null))))
    .then((all) => ({ termName: term.termName, ranks: all.filter(Boolean).flatMap((r) => r.ranks || []) })),
  [term?.examTermId, branchId, gradeIds.join(',')], !!term && !!branchId && gradeIds.length > 0);

  const flagged = useMemo(() => {
    const onRoll = new Map(list.current.map((s) => [s.studentId, s]));
    const flags = new Map();
    const add = (id, kind, text) => {
      if (!onRoll.has(id)) return;
      flags.set(id, [...(flags.get(id) || []), { kind, text }]);
    };
    const absent = new Map();
    (absences.data || []).forEach((a) => absent.set(a.studentId, (absent.get(a.studentId) || 0) + 1));
    absent.forEach((n, id) => { if (n >= ABSENCE_LIMIT) add(id, 'attendance', `${n} unexcused absences`); });
    (fees.data?.classes || []).forEach((c) => c.defaulters.forEach((d) =>
      add(d.studentId, 'fees', `${fin.moneyShort(d.overdueAmount)} overdue · ${d.daysOverdue} days`)));
    (ranks.data?.ranks || []).forEach((r) => {
      if (r.percentage !== null && r.percentage !== undefined && Number(r.percentage) < MARK_LIMIT) {
        add(r.studentId, 'marks', `${Number(r.percentage).toFixed(0)}% in ${ranks.data.termName}`);
      }
    });
    list.incomplete.forEach((s) => add(s.studentId, 'record', 'Record incomplete'));
    return [...flags.entries()].map(([id, f]) => ({ student: onRoll.get(id), flags: f }))
      .sort((a, b) => b.flags.length - a.flags.length || fullName(a.student).localeCompare(fullName(b.student)));
  }, [list.current, list.incomplete, absences.data, fees.data, ranks.data]);

  const count = (kind) => flagged.filter((r) => r.flags.some((f) => f.kind === kind)).length;
  const multi = flagged.filter((r) => r.flags.length > 1).length;
  const loading = absences.loading || fees.loading || terms.loading || ranks.loading;
  // Signals the signed-in role may not read (403), and signals that failed for another reason, named under the list
  const refused = (r) => r.error?.status === 403;
  const failed = (r) => !!r.error && r.error.status !== 403;
  const unavailable = [
    refused(absences) && 'attendance',
    (!canFees || refused(fees)) && 'fees',
    (!canExam || refused(terms) || refused(ranks)) && 'assessment results',
  ].filter(Boolean);
  const notLoaded = [
    failed(absences) && 'attendance',
    failed(fees) && 'fees',
    (failed(terms) || failed(ranks)) && 'assessment results',
  ].filter(Boolean);
  const shown = flagged.slice(0, 8);
  const KIND = {
    attendance: ['Attendance', 'amber', `${ABSENCE_LIMIT}+ unexcused absences in ${ABSENCE_DAYS} days`],
    fees: ['Fees', 'red', 'Fees overdue'],
    marks: ['Results', 'purple', `Below ${MARK_LIMIT}% in the latest term`],
    record: ['Record', '', 'Guardian, emergency phone or blood group missing'],
  };

  if (!list.live) return null;
  return (
    <div className="pulse-panel">
      <SectionHead title="Students needing attention"
        sub={loading ? 'Checking attendance, fees, results and records…'
          : multi ? `${plural(multi, 'student')} flagged in two or more areas · ${plural(flagged.length, 'student')} in all`
            : flagged.length ? `${plural(flagged.length, 'student')} flagged in one area · none in two or more` : 'No student is flagged right now'} />
      <div className="riskchips">
        {Object.entries(KIND).map(([kind, [label, tone, hint]]) => (
          <span key={kind} title={hint}><Pill tone={count(kind) ? tone : ''}>{label} · {formatNumber(count(kind))}</Pill></span>
        ))}
      </div>
      {shown.length > 0 && (
        <ul className="risklist">
          {shown.map(({ student: s, flags }) => {
            const [bg, fg] = avatarTone(s.gradeName || '');
            return (
              <li key={s.studentId}>
                <span className="avatar-sm" style={{ background: bg, color: fg }} aria-hidden="true">{initials(s)}</span>
                <span className="risk-who"><Link to={`/students/${s.studentId}`}>{fullName(s)}</Link><small>{classLabel(s)}</small></span>
                <span className="risk-flags">{flags.map((f) => <Pill key={f.kind} tone={KIND[f.kind][1]}>{f.text}</Pill>)}</span>
              </li>
            );
          })}
        </ul>
      )}
      <p className="xs muted" style={{ marginTop: 10 }}>
        {flagged.length > shown.length ? `Showing ${shown.length} of ${flagged.length}, most flags first. ` : ''}
        Attendance: {ABSENCE_LIMIT}+ unexcused absences in the last {ABSENCE_DAYS} days · Results: below {MARK_LIMIT}% overall{term ? ` in ${term.termName}` : ''}.
        {unavailable.length ? ` Not included for your role: ${unavailable.join(', ')}.` : ''}
        {notLoaded.length ? ` Could not load: ${notLoaded.join(', ')}.` : ''}
      </p>
    </div>
  );
}

/* ---------- capacity by class ---------- */

/** Seats filled against section capacity, per grade, from the grades and sections set up for the school. */
export function CapacityCard({ list }) {
  const { user } = useAuth();
  const grades = useApi(() => studentApi.listGrades(user.tenantId), [user?.tenantId], !!user?.tenantId && list.live);
  const gradeIds = (grades.data || []).map((g) => g.gradeId);
  const sections = useApi(() => Promise.all(gradeIds.map((id) => studentApi.listSections(id))).then((all) => all.flat()),
    [gradeIds.join(',')], gradeIds.length > 0);
  const rows = useMemo(() => {
    const enrolled = new Map();
    list.current.forEach((s) => { if (s.sectionId) enrolled.set(s.sectionId, (enrolled.get(s.sectionId) || 0) + 1); });
    return (grades.data || []).slice().sort((a, b) => (a.sequenceOrder ?? 0) - (b.sequenceOrder ?? 0)).map((g) => {
      const own = (sections.data || []).filter((s) => s.gradeId === g.gradeId);
      const seats = own.reduce((n, s) => n + (s.maxCapacity || 0), 0);
      const filled = own.reduce((n, s) => n + (enrolled.get(s.sectionId) || 0), 0);
      const full = own.filter((s) => s.maxCapacity && (enrolled.get(s.sectionId) || 0) >= s.maxCapacity).length;
      return { grade: g.gradeName, sections: own.length, seats, filled, full, pct: seats ? (filled / seats) * 100 : 0 };
    });
  }, [grades.data, sections.data, list.current]);
  const seats = rows.reduce((n, r) => n + r.seats, 0);
  const filled = rows.reduce((n, r) => n + r.filled, 0);
  const tight = rows.filter((r) => r.pct >= 90).length;
  const empty = rows.filter((r) => r.seats && !r.filled).length;
  const tone = (p) => (p >= 100 ? 'var(--rd, #c53030)' : p >= 90 ? 'var(--am, #b7791f)' : 'var(--pr)');

  if (!list.live) return null;
  return (
    <div className="pulse-panel">
      <SectionHead title="Capacity by class"
        sub={grades.error || sections.error ? 'Class capacity is not available for your role'
          : !sections.data ? 'Loading classes…'
            : `${formatNumber(filled)} of ${formatNumber(seats)} seats filled (${seats ? ((filled / seats) * 100).toFixed(1) : 0}%) · ${plural(tight, 'grade')} at 90% or more · ${plural(empty, 'grade')} with no students`} />
      {sections.data && (
        <div className="capbars">
          {rows.map((r) => (
            <div key={r.grade} className="caprow" title={`${r.grade}: ${r.filled} of ${r.seats} seats in ${r.sections} sections${r.full ? ` · ${r.full} section${r.full === 1 ? '' : 's'} full` : ''}`}>
              <span className="capname">{r.grade}</span>
              <span className="track"><i style={{ width: `${Math.min(100, r.pct)}%`, background: tone(r.pct) }} /></span>
              <span className="capnum">{r.filled}/{r.seats}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- year-on-year movement ---------- */

/**
 * Joined and left this academic year (from 1 April), with joiners compared against the same point last year.
 * Joining is the admission date (or the record's creation); leaving is when a transferred or graduated record last changed.
 */
export function movementSummary(list) {
  const today = new Date();
  const start = academicYearStart(today);
  const lastStart = new Date(start.getFullYear() - 1, 3, 1);
  const sameDayLastYear = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
  const joinedOn = (s) => (s.admissionDate ? new Date(s.admissionDate) : s.createdAt ? new Date(s.createdAt) : null);
  const joined = list.rows.filter((s) => { const d = joinedOn(s); return d && d >= start; });
  const joinedLastYear = list.rows.filter((s) => { const d = joinedOn(s); return d && d >= lastStart && d <= sameDayLastYear; });
  const left = list.rows.filter((s) => LEFT_STATUSES.includes(s.studentStatus) && s.updatedAt && new Date(s.updatedAt) >= start);
  const byReason = LEFT_STATUSES.map((code) => [STUDENT_STATUS[code]?.[0] || code, left.filter((s) => s.studentStatus === code).length]).filter(([, n]) => n);
  const net = joined.length - left.length;
  return { start, joined, joinedLastYear, left, byReason, net, diff: joined.length - joinedLastYear.length, rollAtStart: list.current.length - net };
}

export function MovementCard({ list }) {
  const { start, joined, joinedLastYear, left, byReason, net, diff, rollAtStart } = movementSummary(list);

  if (!list.live) return null;
  return (
    <div className="pulse-panel">
      <SectionHead title="Movement this academic year" sub={`Since ${formatDate(isoDate(start))} · on roll ${formatNumber(rollAtStart)} then, ${formatNumber(list.current.length)} now`} />
      <dl className="movegrid">
        <div>
          <dt>Joined</dt><dd>{formatNumber(joined.length)}</dd>
          <small>{diff === 0 ? 'Same as this time last year' : `${diff > 0 ? '+' : ''}${diff} vs this time last year (${joinedLastYear.length})`}</small>
        </div>
        <div>
          <dt>Left</dt><dd>{formatNumber(left.length)}</dd>
          <small>{byReason.length ? byReason.map(([label, n]) => `${n} ${label.toLowerCase()}`).join(' · ') : 'No transfers or graduations'}</small>
        </div>
        <div>
          <dt>Net change</dt><dd className={net > 0 ? 'up' : net < 0 ? 'down' : ''}>{net > 0 ? '+' : ''}{formatNumber(net)}</dd>
          <small>{rollAtStart ? `${net >= 0 ? '+' : ''}${((net / rollAtStart) * 100).toFixed(1)}% on the start of the year` : 'No students at the start of the year'}</small>
        </div>
      </dl>
      <p className="xs muted" style={{ marginTop: 10 }}>Joined uses the admission date; left counts transferred and graduated students whose record changed this year.</p>
    </div>
  );
}

/* ---------- School pulse pop-up (Students page, last stat card) ---------- */

const PULSE_TABS = ['Needs attention', 'Capacity by class', 'Movement'];

/** The leader views in one pop-up; each tab reads its data from the services when it opens. */
export function SchoolPulseModal({ list, onClose }) {
  const [tab, setTab] = useState(0);
  return (
    <Modal title="School pulse" sub="Students needing attention, class capacity and movement this academic year" onClose={onClose}
      footer={<button className="btn primary" onClick={onClose}>Done</button>}>
      <Tabs items={PULSE_TABS} value={tab} onChange={setTab} />
      <div style={{ marginTop: 16 }}>
        {tab === 0 ? <AtRiskCard list={list} /> : tab === 1 ? <CapacityCard list={list} /> : <MovementCard list={list} />}
      </div>
    </Modal>
  );
}
