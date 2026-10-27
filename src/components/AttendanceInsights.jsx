import { useMemo, useState } from 'react';
import { Modal } from './AuthSettings.jsx';
import { SectionHead, Pill, Tabs, DataTable, schoolDay, todayIso } from './ui.jsx';
import { ApiErr, ApiNote } from './Admissions.jsx';
import { useApi } from '../api/useApi.js';
import * as studentApi from '../api/studentService.js';
import { formatNumber, formatDate } from '../regional.js';

// Thresholds for the signals in the outlook
const TARGET = 95; // school attendance target, %
const CHRONIC_PCT = 90; // a student attending less than this share of school days is chronically absent
const SEVERE_PCT = 85; // ... and severely so below this
const SLOW_DAYS = 3; // a follow-up still open this long is overdue
const WINDOW_DAYS = 56; // look-back for every tab: eight weeks

const DAY = 24 * 60 * 60 * 1000;
const isoOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const atNoon = (iso) => new Date(`${iso}T12:00:00`);
const addDays = (iso, n) => { const d = atNoon(iso); d.setDate(d.getDate() + n); return isoOf(d); };
const mondayOf = (iso) => addDays(iso, -((atNoon(iso).getDay() + 6) % 7));
const daysBetween = (a, b) => Math.round((atNoon(b) - atNoon(a)) / DAY);
const plural = (n, word) => `${formatNumber(n)} ${word}${n === 1 ? '' : 's'}`;
const mean = (list) => (list.length ? list.reduce((n, v) => n + v, 0) / list.length : null);
const pct = (v, digits = 1) => (v === null || v === undefined ? '—' : `${Number(v).toFixed(digits)}%`);
const tone = (rate) => (rate >= TARGET ? 'var(--gr, #2f855a)' : rate >= CHRONIC_PCT ? 'var(--am, #d69e2e)' : 'var(--rd, #c53030)');
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const isAbsent = (a) => a.status === 'EXCUSED' || a.status === 'UNEXCUSED';
const className = (a) => `${a.gradeName}-${a.sectionName}`;

/** Roles that may open the outlook: whoever can read school attendance. */
export const canOpenAttendanceOutlook = (hasRole) => hasRole(...studentApi.ROLES.attendanceView);

/**
 * The figure on the card: unexcused absences whose guardian has not yet been reached, from the follow-up list the page
 * already loads (last 7 days). Counts the ones waiting longer than SLOW_DAYS separately.
 */
export function followUpBacklog(list) {
  const open = (list || []).filter((a) => a.followUpStatus === 'OPEN');
  const slow = open.filter((a) => daysBetween(a.date, todayIso()) >= SLOW_DAYS);
  return { open, slow };
}

/* ---------- attendance trend and patterns ---------- */

function TrendPatterns({ days, absences }) {
  const weeks = useMemo(() => {
    const m = new Map();
    days.forEach((d) => { const k = mondayOf(d.date); m.set(k, [...(m.get(k) || []), Number(d.presentRate)]); });
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([monday, rates]) => ({ monday, rate: mean(rates), days: rates.length }));
  }, [days]);
  const last4 = weeks.slice(-4), prev4 = weeks.slice(-8, -4);
  const recent = mean(last4.map((w) => w.rate)), before = mean(prev4.map((w) => w.rate));
  const change = recent !== null && before !== null ? recent - before : null;
  const lastDay = days[days.length - 1];
  const below = days.filter((d) => Number(d.presentRate) < TARGET).length;

  const byWeekday = useMemo(() => {
    const m = new Map();
    days.forEach((d) => { const k = atNoon(d.date).getDay(); m.set(k, [...(m.get(k) || []), Number(d.presentRate)]); });
    return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([k, rates]) => ({ name: WEEKDAYS[k], rate: mean(rates), n: rates.length }));
  }, [days]);
  const worst = byWeekday.length ? byWeekday.reduce((a, b) => (b.rate < a.rate ? b : a)) : null;

  // Sessions: students absent in the afternoon but present in the morning leave early or skip the second half
  const sessions = useMemo(() => {
    const key = (a) => `${a.studentId}|${a.date}`;
    const am = new Set(), pm = new Set();
    absences.filter(isAbsent).forEach((a) => (a.session === 'AM' ? am : pm).add(key(a)));
    return { am: am.size, pm: pm.size, pmOnly: [...pm].filter((k) => !am.has(k)).length };
  }, [absences]);
  const late = absences.filter((a) => a.status === 'LATE');
  const lateBy = useMemo(() => {
    const m = new Map();
    late.forEach((a) => m.set(className(a), (m.get(className(a)) || 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [late]);

  if (!days.length) return <ApiNote>No registers have been submitted on school days in the last eight weeks.</ApiNote>;
  return (
    <div className="pulse-panel">
      <SectionHead title="Attendance trend and patterns"
        sub={`${plural(days.length, 'school day')} with registers since ${formatDate(days[0].date)} · target ${TARGET}%`} />
      <dl className="movegrid">
        <div><dt>Last school day</dt><dd className={Number(lastDay.presentRate) < TARGET ? 'down' : 'up'}>{pct(lastDay.presentRate)}</dd>
          <small>{formatDate(lastDay.date, { weekday: 'short' })} · {Number(lastDay.presentRate) >= TARGET ? 'on target' : `${(TARGET - Number(lastDay.presentRate)).toFixed(1)} points below target`}</small></div>
        <div><dt>{last4.length < 4 ? `Last ${plural(last4.length, 'week')}` : 'Last 4 weeks'}</dt><dd className={change !== null && change < 0 ? 'down' : ''}>{pct(recent)}</dd>
          <small>{change === null ? 'Not enough earlier weeks to compare' : `${change >= 0 ? '▲' : '▼'} ${Math.abs(change).toFixed(1)} points against the 4 weeks before`}</small></div>
        <div><dt>Days below target</dt><dd className={below ? 'down' : 'up'}>{below}</dd>
          <small>of {plural(days.length, 'school day')}</small></div>
      </dl>

      <h4 style={{ fontSize: 13, fontWeight: 600, margin: '18px 0 0' }}>Week by week</h4>
      <div className="capbars">
        {weeks.slice(-8).map((w) => (
          <div className="caprow" key={w.monday} style={{ gridTemplateColumns: '92px 1fr 64px' }}>
            <span className="capname">Week of {formatDate(w.monday, { year: false })}</span>
            <span className="track"><i style={{ width: `${Math.max(0, Math.min(100, w.rate))}%`, background: tone(w.rate) }} /></span>
            <span className="capnum">{pct(w.rate)}</span>
          </div>
        ))}
      </div>

      <h4 style={{ fontSize: 13, fontWeight: 600, margin: '18px 0 0' }}>By day of the week</h4>
      <div className="capbars">
        {byWeekday.map((d) => (
          <div className="caprow" key={d.name} style={{ gridTemplateColumns: '92px 1fr 64px' }}>
            <span className="capname">{d.name}</span>
            <span className="track"><i style={{ width: `${Math.max(0, Math.min(100, d.rate))}%`, background: tone(d.rate) }} /></span>
            <span className="capnum">{pct(d.rate)}</span>
          </div>
        ))}
      </div>
      {worst && byWeekday.length > 1 && <p className="xs muted" style={{ marginTop: 8 }}>{worst.name}s are the weakest day, averaging {pct(worst.rate)} over {plural(worst.n, 'day')}.</p>}

      <h4 style={{ fontSize: 13, fontWeight: 600, margin: '18px 0 8px' }}>Mornings, afternoons and late arrivals</h4>
      <dl className="movegrid" style={{ marginTop: 0 }}>
        <div><dt>Morning absences</dt><dd>{formatNumber(sessions.am)}</dd><small>student-days absent in the AM register</small></div>
        <div><dt>Left after morning</dt><dd className={sessions.pmOnly ? 'down' : ''}>{formatNumber(sessions.pmOnly)}</dd>
          <small>{sessions.pmOnly ? 'present in the morning, absent in the afternoon' : 'nobody absent in the afternoon only'}</small></div>
        <div><dt>Late arrivals</dt><dd>{formatNumber(late.length)}</dd>
          <small>{lateBy.length ? `Most in ${lateBy.map(([c, n]) => `${c} (${n})`).join(', ')}` : 'None recorded'}</small></div>
      </dl>
    </div>
  );
}

/* ---------- chronic absence ---------- */

function ChronicAbsence({ days, absences }) {
  const schoolDays = days.length;
  const students = useMemo(() => {
    const m = new Map();
    absences.filter(isAbsent).forEach((a) => {
      const s = m.get(a.studentId) || { id: a.studentId, name: a.fullName, uid: a.studentUid, cls: className(a), dates: new Set(), unexcused: new Set() };
      s.dates.add(a.date);
      if (a.status === 'UNEXCUSED') s.unexcused.add(a.date);
      m.set(a.studentId, s);
    });
    return [...m.values()].map((s) => {
      const absent = s.dates.size;
      const rate = schoolDays ? Math.max(0, 100 - (absent / schoolDays) * 100) : null;
      return { ...s, absent, unexcusedDays: s.unexcused.size, rate };
    }).sort((a, b) => b.absent - a.absent || a.name.localeCompare(b.name));
  }, [absences, schoolDays]);
  const chronic = students.filter((s) => s.rate !== null && s.rate < CHRONIC_PCT);
  const severe = chronic.filter((s) => s.rate < SEVERE_PCT);
  const mostlyUnexcused = chronic.filter((s) => s.unexcusedDays * 2 > s.absent);
  const byClass = useMemo(() => {
    const m = new Map();
    chronic.forEach((s) => m.set(s.cls, (m.get(s.cls) || 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [chronic]);
  const max = byClass.length ? byClass[0][1] : 1;

  if (!schoolDays) return <ApiNote>No registers have been submitted on school days in the last eight weeks.</ApiNote>;
  return (
    <div className="pulse-panel">
      <SectionHead title="Chronic absence"
        sub={`Students absent on more than ${100 - CHRONIC_PCT}% of the ${plural(schoolDays, 'school day')} in the last eight weeks`} />
      <dl className="movegrid">
        <div><dt>Below {CHRONIC_PCT}% attendance</dt><dd className={chronic.length ? 'down' : 'up'}>{formatNumber(chronic.length)}</dd>
          <small>{chronic.length ? 'students to review with the class teacher' : 'no student is chronically absent'}</small></div>
        <div><dt>Below {SEVERE_PCT}%</dt><dd className={severe.length ? 'down' : ''}>{formatNumber(severe.length)}</dd>
          <small>{severe.length ? 'need a guardian meeting' : 'none this severe'}</small></div>
        <div><dt>Mostly unexcused</dt><dd className={mostlyUnexcused.length ? 'down' : ''}>{formatNumber(mostlyUnexcused.length)}</dd>
          <small>{mostlyUnexcused.length ? 'of those below the line, no reason given' : 'every long absence has a reason'}</small></div>
      </dl>

      {byClass.length > 0 && (<>
        <h4 style={{ fontSize: 13, fontWeight: 600, margin: '18px 0 0' }}>Where they are</h4>
        <div className="capbars">
          {byClass.slice(0, 8).map(([cls, n]) => (
            <div className="caprow" key={cls}>
              <span className="capname">{cls}</span>
              <span className="track"><i style={{ width: `${(n / max) * 100}%`, background: 'var(--rd, #c53030)' }} /></span>
              <span className="capnum">{plural(n, 'student')}</span>
            </div>
          ))}
        </div>
      </>)}

      <h4 style={{ fontSize: 13, fontWeight: 600, margin: '18px 0 8px' }}>{chronic.length ? 'Students to review' : 'Most absences'}</h4>
      <DataTable boxed cols={[
        { label: 'Student', render: (s) => <><b style={{ fontWeight: 600 }}>{s.name}</b><br /><small className="muted">{s.uid}</small></> },
        { label: 'Class', render: (s) => s.cls },
        { label: 'Days absent', className: 'num', render: (s) => s.absent },
        { label: 'Unexcused', className: 'num', render: (s) => (s.unexcusedDays ? <Pill tone="red">{s.unexcusedDays}</Pill> : '0') },
        { label: 'Attendance', render: (s) => <Pill tone={s.rate < SEVERE_PCT ? 'red' : s.rate < CHRONIC_PCT ? 'amber' : 'green'}>{pct(s.rate, 0)}</Pill> },
      ]} rows={(chronic.length ? chronic : students).slice(0, 12)} />
      <p className="xs muted" style={{ marginTop: 10 }}>
        A day counts as absent when either register is marked excused or unexcused. Attendance is measured against the school days with registers in the last eight weeks.
      </p>
    </div>
  );
}

/* ---------- follow-up and register compliance ---------- */

function FollowUpCompliance({ days, followUps, absences }) {
  const today = todayIso();
  const open = followUps.filter((a) => a.followUpStatus === 'OPEN');
  const contacted = followUps.filter((a) => a.followUpStatus === 'GUARDIAN_CONTACTED');
  const resolved = followUps.filter((a) => a.followUpStatus === 'RESOLVED');
  const overdue = open.filter((a) => daysBetween(a.date, today) >= SLOW_DAYS).sort((a, b) => a.date.localeCompare(b.date));
  const handled = contacted.length + resolved.length;
  const waits = [...contacted, ...resolved].filter((a) => a.followUpAt).map((a) => Math.max(0, daysBetween(a.date, isoOf(new Date(a.followUpAt)))));
  const avgWait = mean(waits);

  const reasons = useMemo(() => {
    const m = new Map();
    absences.filter((a) => a.status === 'EXCUSED').forEach((a) => {
      const r = (a.reason || 'No reason written').trim();
      m.set(r, (m.get(r) || 0) + 1);
    });
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [absences]);

  const expected = days.reduce((n, d) => n + d.registersExpected, 0);
  const am = days.reduce((n, d) => n + d.amRegistersSubmitted, 0);
  const pm = days.reduce((n, d) => n + d.pmRegistersSubmitted, 0);
  const gaps = days.filter((d) => d.amRegistersSubmitted < d.registersExpected || d.pmRegistersSubmitted < d.registersExpected).slice(-6).reverse();

  return (
    <div className="pulse-panel">
      <SectionHead title="Follow-up and register compliance"
        sub={`${plural(followUps.length, 'unexcused absence')} needing a guardian call in the last eight weeks · ${plural(days.length, 'school day')} of registers`} />
      <dl className="movegrid">
        <div><dt>Not yet reached</dt><dd className={open.length ? 'down' : 'up'}>{formatNumber(open.length)}</dd>
          <small>{overdue.length ? `${overdue.length} waiting ${SLOW_DAYS}+ days` : open.length ? 'none overdue yet' : 'every guardian reached'}</small></div>
        <div><dt>Follow-up rate</dt><dd className={followUps.length && handled / followUps.length < 0.8 ? 'down' : 'up'}>{followUps.length ? pct((handled / followUps.length) * 100, 0) : '—'}</dd>
          <small>{followUps.length ? `${handled} of ${followUps.length} contacted or resolved${avgWait === null ? '' : avgWait < 0.5 ? ' · usually the same day' : ` · about ${avgWait.toFixed(1)} days to reach`}` : 'Nothing to follow up'}</small></div>
        <div><dt>Register compliance</dt><dd className={expected && am / expected < 1 ? 'down' : 'up'}>{expected ? pct((am / expected) * 100, 0) : '—'}</dd>
          <small>{expected ? `${pct((pm / expected) * 100, 0)} for afternoon registers` : 'No registers expected'}</small></div>
      </dl>

      <h4 style={{ fontSize: 13, fontWeight: 600, margin: '18px 0 8px' }}>{overdue.length ? 'Waiting the longest' : 'Open follow-ups'}</h4>
      {open.length ? (
        <DataTable boxed cols={[
          { label: 'Student', render: (a) => <><b style={{ fontWeight: 600 }}>{a.fullName}</b><br /><small className="muted">{className(a)}</small></> },
          { label: 'Absent', render: (a) => `${formatDate(a.date, { year: false })} · ${a.session}` },
          { label: 'Waiting', render: (a) => { const d = daysBetween(a.date, today); return <Pill tone={d >= SLOW_DAYS ? 'red' : 'amber'}>{plural(d, 'day')}</Pill>; } },
          { label: 'Call', render: (a) => a.emergencyContactPhone || '—' },
        ]} rows={[...open].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8)} />
      ) : <p className="xs muted">No unexcused absence is waiting for a guardian call.</p>}

      <h4 style={{ fontSize: 13, fontWeight: 600, margin: '18px 0 8px' }}>Days with missing registers</h4>
      {gaps.length ? (
        <DataTable boxed cols={[
          { label: 'Day', render: (d) => formatDate(d.date, { weekday: 'short' }) },
          { label: 'Morning', className: 'num', render: (d) => <Pill tone={d.amRegistersSubmitted < d.registersExpected ? 'amber' : 'green'}>{d.amRegistersSubmitted} / {d.registersExpected}</Pill> },
          { label: 'Afternoon', className: 'num', render: (d) => <Pill tone={d.pmRegistersSubmitted < d.registersExpected ? 'amber' : 'green'}>{d.pmRegistersSubmitted} / {d.registersExpected}</Pill> },
        ]} rows={gaps} />
      ) : <p className="xs muted">Every class submitted both registers on every school day.</p>}

      {reasons.length > 0 && (<>
        <h4 style={{ fontSize: 13, fontWeight: 600, margin: '18px 0 0' }}>Reasons given for excused absences</h4>
        <div className="capbars">
          {reasons.map(([r, n]) => (
            <div className="caprow" key={r} style={{ gridTemplateColumns: '1fr 1fr 40px' }}>
              <span className="capname" style={{ whiteSpace: 'normal' }}>{r}</span>
              <span className="track"><i style={{ width: `${(n / reasons[0][1]) * 100}%`, background: 'var(--pr)' }} /></span>
              <span className="capnum">{n}</span>
            </div>
          ))}
        </div>
      </>)}
    </div>
  );
}

/* ---------- the pop-up ---------- */

const TABS = ['Trend and patterns', 'Chronic absence', 'Follow-up and registers'];

export function AttendanceOutlookModal({ branchId, onClose }) {
  const [tab, setTab] = useState(0);
  const today = todayIso();
  const from = addDays(today, -WINDOW_DAYS);
  const branch = branchId || undefined;
  const trend = useApi(() => studentApi.attendanceTrend(from, today, branch), [from, today, branch]);
  const absences = useApi(() => studentApi.listAbsences({ from, to: today, branchId: branch }), [from, today, branch]);
  const followUps = useApi(() => studentApi.listFollowUps({ from, to: today, branchId: branch, includeResolved: true }), [from, today, branch]);
  const error = trend.error || absences.error || followUps.error;
  const ready = trend.data && absences.data && followUps.data;
  // Only days school was open and registers came in: weekends and breaks never count against the school
  const days = useMemo(() => (trend.data || []).filter((d) => schoolDay(d.date).open && d.presentRate !== null && d.presentRate !== undefined)
    .sort((a, b) => a.date.localeCompare(b.date)), [trend.data]);
  return (
    <Modal title="Attendance outlook" sub="Attendance trend and patterns, chronic absence, and follow-up and register compliance" onClose={onClose}
      footer={<button className="btn primary" onClick={onClose}>Done</button>}>
      <Tabs items={TABS} value={tab} onChange={setTab} />
      <div style={{ marginTop: 16 }}>
        {error ? <ApiErr error={error} /> : !ready ? <p className="xs muted">Loading attendance…</p>
          : tab === 0 ? <TrendPatterns days={days} absences={absences.data} />
            : tab === 1 ? <ChronicAbsence days={days} absences={absences.data} />
              : <FollowUpCompliance days={days} followUps={followUps.data} absences={absences.data} />}
      </div>
    </Modal>
  );
}
