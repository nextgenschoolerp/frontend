import { useEffect, useMemo, useState } from 'react';
import { Modal } from './AuthSettings.jsx';
import { SectionHead, Pill, Tabs, DataTable } from './ui.jsx';
import { ApiErr, ApiNote } from './Admissions.jsx';
import { useAuth } from '../auth.jsx';
import { useApi } from '../api/useApi.js';
import * as exam from '../api/examService.js';
import { formatNumber } from '../regional.js';

// Thresholds for the signals on the outlook
const DECLINE_PTS = 5; // a student whose overall percentage fell by this many points since the previous term
const LOW_PCT = 40; // overall percentage below this is low
const WEAK_CLASS_PTS = 5; // a class this many points under the school average is flagged

const isoOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const mean = (a) => (a.length ? a.reduce((n, x) => n + x, 0) / a.length : null);
const num = (v) => (v === null || v === undefined ? null : Number(v));
const plural = (n, word) => `${formatNumber(n)} ${word}${n === 1 ? '' : 's'}`;
const pts = (v) => (v === null || v === undefined ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(1)} pts`);
const toneOfDelta = (v) => (v === null || v === undefined || Math.abs(v) < 0.05 ? '' : v > 0 ? 'green' : 'amber');
const pct1 = (v) => (v === null || v === undefined ? '—' : `${v.toFixed(1)}%`);

/** Roles that may open the outlook (school leadership and the exam controller; ExamRoles.SCHOOL_RESULTS). */
export const canOpenAcademicOutlook = (hasRole) => hasRole(...exam.ROLES.schoolResults);

/** The latest term that has started, and the one before it. */
export const startedTerms = (terms) => (terms || []).filter((t) => t.startDate && t.startDate <= isoOf(new Date()))
  .sort((a, b) => b.startDate.localeCompare(a.startDate));

/** Numbers behind the three tabs for one term, from the broadsheets of every section. */
function summarise(sheets) {
  const rows = (sheets || []).flatMap((s) => s.rows.map((r) => ({ ...r, className: s.className, sectionId: s.sectionId })));
  const scored = rows.filter((r) => num(r.percentage) !== null && r.result !== 'INCOMPLETE');
  const pass = scored.filter((r) => r.result === 'PASS').length;
  const fail = scored.filter((r) => r.result === 'FAIL').length;
  const grades = new Map();
  scored.forEach((r) => grades.set(r.grade || '—', (grades.get(r.grade || '—') || 0) + 1));
  // Subject results across the school, each class weighted by the students who have marks
  const subjects = new Map();
  (sheets || []).forEach((s) => s.subjects.forEach((sub) => {
    if (num(sub.averageMarks) === null || !num(sub.maxMarks)) return;
    const n = sub.passed + sub.failed;
    const cur = subjects.get(sub.subjectCode) || { code: sub.subjectCode, name: sub.subjectName, n: 0, sum: 0, passed: 0, failed: 0 };
    cur.n += n; cur.sum += (num(sub.averageMarks) / num(sub.maxMarks)) * 100 * n; cur.passed += sub.passed; cur.failed += sub.failed;
    subjects.set(sub.subjectCode, cur);
  }));
  return {
    sheets: sheets || [], rows, scored, pass, fail, incomplete: rows.length - scored.length,
    average: mean(scored.map((r) => num(r.percentage))),
    passRate: pass + fail ? (pass / (pass + fail)) * 100 : null,
    grades: [...grades.entries()].sort((a, b) => a[0].localeCompare(b[0])),
    subjects: [...subjects.values()].map((s) => ({ ...s, average: s.n ? s.sum / s.n : null, passRate: s.n ? (s.passed / s.n) * 100 : null })),
  };
}

/* ---------- results and trend ---------- */

function Results({ cur, prev, term, prevTerm }) {
  const dAvg = cur.average !== null && prev?.average !== null && prev ? cur.average - prev.average : null;
  const dPass = cur.passRate !== null && prev?.passRate !== null && prev ? cur.passRate - prev.passRate : null;
  const bySubject = cur.subjects.filter((s) => s.average !== null).sort((a, b) => b.average - a.average);
  const byClass = cur.sheets.filter((s) => num(s.classAveragePercent) !== null).sort((a, b) => num(b.classAveragePercent) - num(a.classAveragePercent));
  const failedClasses = cur.sheets.map((s) => [s.className, s.rows.filter((r) => r.result === 'FAIL').length]).filter(([, n]) => n);
  const vs = prevTerm ? ` vs ${prevTerm.termName}` : '';

  if (!cur.scored.length) return <ApiNote>No marks have been entered for {term.termName} yet.</ApiNote>;
  return (
    <div className="pulse-panel">
      <SectionHead title={`Results: ${term.termName}`}
        sub={`${plural(cur.scored.length, 'student')} scored in ${formatNumber(cur.sheets.length)} ${cur.sheets.length === 1 ? 'class' : 'classes'}${cur.incomplete ? ` · ${cur.incomplete} with marks still missing` : ''}`} />
      <dl className="movegrid">
        <div><dt>School average</dt><dd>{pct1(cur.average)}</dd>
          <small>{prev ? `${pts(dAvg)}${vs}` : 'No earlier term to compare'}</small></div>
        <div><dt>Pass rate</dt><dd className={cur.fail ? 'down' : ''}>{pct1(cur.passRate)}</dd>
          <small>{cur.fail ? `${plural(cur.fail, 'student')} below the pass mark` : 'Nobody below the pass mark'}{prev && dPass !== null ? ` · ${pts(dPass)}${vs}` : ''}</small></div>
        <div><dt>Top grade</dt><dd>{cur.grades[0]?.[0] ?? '—'}</dd>
          <small>{cur.grades[0] ? `${plural(cur.grades[0][1], 'student')} · ${Math.round((cur.grades[0][1] / cur.scored.length) * 100)}% of those scored` : ''}</small></div>
      </dl>
      <h4 style={{ fontSize: 13, fontWeight: 600, margin: '18px 0 8px' }}>Grade distribution</h4>
      <div className="capbars">
        {cur.grades.map(([grade, n]) => (
          <div key={grade} className="caprow" style={{ gridTemplateColumns: '48px 1fr 76px' }}>
            <span className="capname">{grade}</span>
            <span className="track"><i style={{ width: `${(n / cur.scored.length) * 100}%`, background: 'var(--pr)' }} /></span>
            <span className="capnum">{n} · {Math.round((n / cur.scored.length) * 100)}%</span>
          </div>
        ))}
      </div>
      <h4 style={{ fontSize: 13, fontWeight: 600, margin: '18px 0 8px' }}>What stands out</h4>
      <ul className="body-s" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4 }}>
        {bySubject.length > 1 && <li><b>Strongest subject:</b> {bySubject[0].name} ({pct1(bySubject[0].average)}) · <b>weakest:</b> {bySubject.at(-1).name} ({pct1(bySubject.at(-1).average)})</li>}
        {byClass.length > 1 && <li><b>Highest class average:</b> {byClass[0].className} ({pct1(num(byClass[0].classAveragePercent))}) · <b>lowest:</b> {byClass.at(-1).className} ({pct1(num(byClass.at(-1).classAveragePercent))})</li>}
        {failedClasses.length > 0 && <li><b>Below the pass mark:</b> {failedClasses.map(([c, n]) => `${c} (${n})`).join(', ')}</li>}
        {!failedClasses.length && <li>Every class passed in every subject.</li>}
      </ul>
      <p className="xs muted" style={{ marginTop: 10 }}>Percentages are each student's total marks across subjects. Comparison is with the previous term that has started{prevTerm ? `: ${prevTerm.termName}` : ''}.</p>
    </div>
  );
}

/* ---------- classes and subjects ---------- */

function Comparison({ cur, prev, term, prevTerm }) {
  const prevBySection = new Map((prev?.sheets || []).map((s) => [s.sectionId, s]));
  const prevSubject = new Map((prev?.subjects || []).map((s) => [s.code, s]));
  const classes = cur.sheets.map((s) => {
    const scored = s.rows.filter((r) => num(r.percentage) !== null && r.result !== 'INCOMPLETE');
    const pcts = scored.map((r) => num(r.percentage));
    const p = prevBySection.get(s.sectionId);
    const avg = num(s.classAveragePercent);
    const before = p ? num(p.classAveragePercent) : null;
    return {
      className: s.className, students: scored.length, average: avg, change: avg !== null && before !== null ? avg - before : null,
      pass: scored.length ? (scored.filter((r) => r.result === 'PASS').length / scored.length) * 100 : null,
      low: pcts.length ? Math.min(...pcts) : null, high: pcts.length ? Math.max(...pcts) : null,
    };
  }).filter((c) => c.average !== null).sort((a, b) => a.average - b.average);
  const subjects = cur.subjects.filter((s) => s.average !== null).sort((a, b) => a.average - b.average);
  const weakBelow = cur.average !== null ? cur.average - WEAK_CLASS_PTS : null;

  if (!cur.scored.length) return <ApiNote>No marks have been entered for {term.termName} yet.</ApiNote>;
  return (
    <div className="pulse-panel">
      <SectionHead title="Classes and subjects" sub={`${term.termName}, weakest first · school average ${pct1(cur.average)}`} />
      <h4 style={{ fontSize: 13, fontWeight: 600, margin: '14px 0 8px' }}>By class</h4>
      <DataTable boxed cols={[
        { label: 'Class', render: (c) => <b style={{ fontWeight: 600 }}>{c.className}</b> },
        { label: 'Students', className: 'num', render: (c) => formatNumber(c.students) },
        { label: 'Average', render: (c) => <Pill tone={weakBelow !== null && c.average < weakBelow ? 'amber' : ''}>{pct1(c.average)}</Pill> },
        { label: `Change${prevTerm ? ` vs ${prevTerm.termName}` : ''}`, render: (c) => (c.change === null ? '—' : <Pill tone={toneOfDelta(c.change)}>{pts(c.change)}</Pill>) },
        { label: 'Pass rate', render: (c) => (c.pass === null ? '—' : `${Math.round(c.pass)}%`) },
        { label: 'Range', render: (c) => (c.low === null ? '—' : `${c.low.toFixed(0)}–${c.high.toFixed(0)}%`) },
      ]} rows={classes} />
      <h4 style={{ fontSize: 13, fontWeight: 600, margin: '18px 0 8px' }}>By subject</h4>
      <DataTable boxed cols={[
        { label: 'Subject', render: (s) => <b style={{ fontWeight: 600 }}>{s.name}</b> },
        { label: 'Average', render: (s) => pct1(s.average) },
        { label: 'Pass rate', render: (s) => (s.passRate === null ? '—' : <Pill tone={s.failed ? 'amber' : 'green'}>{Math.round(s.passRate)}%</Pill>) },
        { label: 'Below pass mark', className: 'num', render: (s) => (s.failed ? <Pill tone="amber">{s.failed}</Pill> : '0') },
        { label: `Change${prevTerm ? ` vs ${prevTerm.termName}` : ''}`, render: (s) => {
          const before = prevSubject.get(s.code);
          const d = before && before.average !== null ? s.average - before.average : null;
          return d === null ? '—' : <Pill tone={toneOfDelta(d)}>{pts(d)}</Pill>;
        } },
      ]} rows={subjects} />
      <p className="xs muted" style={{ marginTop: 10 }}>
        A class is flagged when its average is {WEAK_CLASS_PTS} or more points under the school average. Range is the lowest and highest student percentage in the class.
        Each class counts in a subject by the students who have marks.
      </p>
    </div>
  );
}

/* ---------- students needing support ---------- */

function Support({ cur, prev, term, prevTerm }) {
  const prevById = new Map((prev?.rows || []).map((r) => [r.studentId, r]));
  const flagged = useMemo(() => {
    const list = [];
    cur.sheets.forEach((sheet) => {
      const info = new Map(sheet.subjects.map((s) => [s.subjectCode, s]));
      sheet.rows.forEach((r) => {
        const p = num(r.percentage);
        if (p === null || r.result === 'INCOMPLETE') return;
        const reasons = [];
        // Subjects marked below the pass mark, with the shortfall
        (r.marks || []).forEach((c) => {
          const sub = info.get(c.subjectCode);
          if (!sub || !c.entered) return;
          if (c.absent) { reasons.push({ kind: 'below', tone: 'red', text: `Absent in ${sub.subjectName}` }); return; }
          const need = num(sub.passMarks);
          if (need !== null && num(c.marksObtained) < need) {
            reasons.push({ kind: 'below', tone: 'red', text: `${sub.subjectName}: ${num(c.marksObtained)} of ${need} to pass` });
          }
        });
        if (r.result === 'FAIL' && !reasons.some((x) => x.kind === 'below')) reasons.push({ kind: 'below', tone: 'red', text: 'Below the pass mark' });
        if (p < LOW_PCT) reasons.push({ kind: 'low', tone: 'amber', text: `${p.toFixed(0)}% overall` });
        const before = prevById.get(r.studentId);
        const bp = before ? num(before.percentage) : null;
        if (bp !== null && bp - p >= DECLINE_PTS) reasons.push({ kind: 'decline', tone: 'amber', text: `Down ${(bp - p).toFixed(0)} pts from ${prevTerm.termName}` });
        if (reasons.length) list.push({ student: r, className: sheet.className, percentage: p, change: bp === null ? null : p - bp, reasons });
      });
    });
    return list.sort((a, b) => b.reasons.length - a.reasons.length || a.percentage - b.percentage);
  }, [cur, prev]);

  const count = (kind) => flagged.filter((f) => f.reasons.some((r) => r.kind === kind)).length;
  const byClass = Object.entries(flagged.reduce((m, f) => ({ ...m, [f.className]: (m[f.className] || 0) + 1 }), {})).sort((a, b) => b[1] - a[1]);
  const shown = flagged.slice(0, 12);

  if (!cur.scored.length) return <ApiNote>No marks have been entered for {term.termName} yet.</ApiNote>;
  return (
    <div className="pulse-panel">
      <SectionHead title="Students needing support"
        sub={flagged.length ? `${plural(flagged.length, 'student')} flagged from ${term.termName} · ${plural(count('below'), 'student')} below the pass mark` : `No student is flagged in ${term.termName}`} />
      <div className="riskchips">
        <Pill tone={count('below') ? 'red' : ''}>Below pass mark · {count('below')}</Pill>
        <Pill tone={count('decline') ? 'amber' : ''}>Declining · {count('decline')}</Pill>
        <Pill tone={count('low') ? 'amber' : ''}>Under {LOW_PCT}% overall · {count('low')}</Pill>
      </div>
      {shown.length > 0 && (
        <div style={{ marginTop: 14 }}><DataTable boxed cols={[
          { label: 'Student', render: (f) => <span className="cell-id"><b>{f.student.studentName}</b><small>{f.student.studentUid} · {f.className}</small></span> },
          { label: term.termName, render: (f) => pct1(f.percentage) },
          { label: `Change${prevTerm ? ` vs ${prevTerm.termName}` : ''}`, render: (f) => (f.change === null ? '—' : <Pill tone={toneOfDelta(f.change)}>{pts(f.change)}</Pill>) },
          { label: 'Why', render: (f) => <span className="risk-flags">{f.reasons.map((r) => <Pill key={r.text} tone={r.tone}>{r.text}</Pill>)}</span> },
        ]} rows={shown} /></div>
      )}
      {byClass.length > 0 && <p className="body-s" style={{ marginTop: 14 }}><b>By class:</b> {byClass.map(([c, n]) => `${c} (${n})`).join(' · ')}</p>}
      <p className="xs muted" style={{ marginTop: 10 }}>
        {flagged.length > shown.length ? `Showing ${shown.length} of ${flagged.length}, most reasons first. ` : ''}
        Flagged when marks are below a subject's pass mark, the overall percentage is under {LOW_PCT}%, or it fell {DECLINE_PTS}+ points since {prevTerm ? prevTerm.termName : 'the previous term'}.
      </p>
    </div>
  );
}

/* ---------- the pop-up ---------- */

const OUTLOOK_TABS = ['Results and trend', 'Classes and subjects', 'Needs support'];

/**
 * Academic outlook (last stat card on the Academics page). Opening it reads the school-wide results of the latest scored
 * term and the term before it from examservice (one request each), so the figures are current.
 */
export function AcademicOutlookModal({ terms, onClose }) {
  const { branchId } = useAuth();
  const [tab, setTab] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { terms.reload(); }, []);
  const started = useMemo(() => startedTerms(terms.data), [terms.data]);
  const term = started[0];
  const prevTerm = started[1];
  const latest = useApi(() => exam.schoolResults(term.examTermId, branchId), [term?.examTermId, branchId], !!term && !!branchId);
  const previous = useApi(() => exam.schoolResults(prevTerm.examTermId, branchId), [prevTerm?.examTermId, branchId], !!prevTerm && !!branchId);
  const cur = useMemo(() => (latest.data ? summarise(latest.data) : null), [latest.data]);
  const prev = useMemo(() => (previous.data ? summarise(previous.data) : null), [previous.data]);

  const body = () => {
    if (terms.error) return <ApiErr error={terms.error} />;
    if (!term && !terms.loading) return <ApiNote>No assessment term has started yet.</ApiNote>;
    if (latest.error) return <ApiErr error={latest.error} onRetry={latest.reload} />;
    if (!cur) return <p className="xs muted">Loading school results…</p>;
    const props = { cur, prev: prev && !previous.error ? prev : null, term, prevTerm: prev && !previous.error ? prevTerm : null };
    return tab === 0 ? <Results {...props} /> : tab === 1 ? <Comparison {...props} /> : <Support {...props} />;
  };
  return (
    <Modal title="Academic outlook" sub="Results and trend against the previous term, class and subject comparison, and students needing support" onClose={onClose}
      footer={<button className="btn primary" onClick={onClose}>Done</button>}>
      <Tabs items={OUTLOOK_TABS} value={tab} onChange={setTab} />
      <div style={{ marginTop: 16 }}>{body()}</div>
    </Modal>
  );
}
