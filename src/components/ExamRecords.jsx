import { useEffect, useState } from 'react';
import { LoaderCircle, FileText, Pencil, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { useApi } from '../api/useApi.js';
import * as exam from '../api/examService.js';
import { Card, SectionHead, DataTable, Pill, KV } from './ui.jsx';
import { Modal } from './AuthSettings.jsx';
import { ApiErr, ApiNote } from './Admissions.jsx';
import { formatDate, formatDateTime, formatTime, formatNumber } from '../regional.js';

const { ROLES, RESULT, TREND, AREAS, pct } = exam;
const Loading = () => <p className="xs muted"><LoaderCircle size={12} className="spin" /> Loading…</p>;
const fmtDate = (d) => formatDate(d);
const pill = (map, code) => { const [t, c] = map[code] || [code, '']; return <Pill tone={c}>{t}</Pill>; };
// Trend pill: an arrow shows the direction, so the meaning does not rest on colour alone
const TREND_ICON = { IMPROVING: TrendingUp, DECLINING: TrendingDown, STEADY: Minus };
const trendPill = (code) => { const [t, c] = TREND[code] || [code, '']; return <Pill tone={c} icon={TREND_ICON[code] ?? false}>{t}</Pill>; };
const signed = (n) => (n === null || n === undefined ? '' : `${n > 0 ? '+' : ''}${Number(n).toFixed(1)} pts`);
/** Bar colours for up to three terms, oldest first. */
const SHADES = ['var(--mu)', 'var(--pr2, #9b8ce0)', 'var(--pr)'];

/** Student profile: GET /api/v1/academic/students/{id}/progress-trend (US-05013). */
export function useProgressTrend(studentId) {
  const { hasRole } = useAuth();
  const allowed = hasRole(...ROLES.studentProgress);
  const res = useApi(() => exam.progressTrend(studentId), [studentId], allowed && !!studentId);
  return { ...res, allowed };
}

/** Comparative bar chart: each subject's percentage in the last three terms. */
function SubjectBars({ terms }) {
  const shown = terms.slice(-3);
  const subjects = [...new Map(shown.flatMap((t) => t.subjects.map((s) => [s.subjectCode, s.subjectName]))).entries()];
  return (
    <div className="cmpbars">
      <div className="legend">{shown.map((t, i) => <span key={t.examTermId}><i style={{ background: SHADES[SHADES.length - shown.length + i] }} />{t.termName}</span>)}</div>
      {subjects.map(([code, name]) => (
        <div className="row" key={code}>
          <span className="name">{name}</span>
          <div className="bars">
            {shown.map((t, i) => {
              const p = t.subjects.find((s) => s.subjectCode === code);
              return (
                <div className="b" key={t.examTermId} title={`${t.termName}: ${p ? pct(p.percentage) : 'no marks'}`}>
                  <i style={{ width: `${p ? Math.max(2, Number(p.percentage)) : 0}%`, background: SHADES[SHADES.length - shown.length + i] }} />
                  <small>{p ? `${Math.round(p.percentage)}%${p.grade ? ` ${p.grade}` : ''}` : '—'}</small>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Profile · Academic progress card (Overview and Academics tab). */
export function AcademicProgressCard({ student, trend, detailed }) {
  const [open, setOpen] = useState(null);
  const d = trend.data;
  const latest = d?.terms?.[d.terms.length - 1];
  return (
    <Card>
      <SectionHead title="Academic progress" sub={latest ? `${latest.termName} · ${latest.className || d.className || ''}` : 'Assessment results by term'} />
      {!trend.allowed ? <div style={{ marginTop: 14 }}><ApiNote>Assessment results are visible to teachers, the exam controller, principals, registrars and the student's parent.</ApiNote></div>
        : trend.loading ? <div style={{ marginTop: 14 }}><Loading /></div>
          : trend.error ? <div style={{ marginTop: 14 }}><ApiErr error={trend.error} /></div>
            : !latest ? <div style={{ marginTop: 14 }}><ApiNote>No assessment results yet for this student.</ApiNote></div> : (<>
              <div className="row" style={{ marginTop: 16, gap: 18, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div><div className="bignum">{pct(latest.percentage)}</div>
                  <p className="xs muted" style={{ marginTop: 6 }}>{latest.termName}{latest.sectionRank ? ` · rank ${latest.sectionRank} in section` : ''}</p></div>
                <div className="pills">{latest.grade && <Pill tone="purple">Grade {latest.grade}</Pill>}{pill(RESULT, latest.result)}{trendPill(d.trend)}</div>
              </div>
              {d.weightedPercentage !== null && d.weightedPercentage !== undefined && (
                <p className="small muted" style={{ margin: '10px 0 0' }}>Year so far {pct(d.weightedPercentage)}{d.weightedGrade ? ` (${d.weightedGrade})` : ''} weighted by term
                  {latest.changeFromPrevious !== null && latest.changeFromPrevious !== undefined ? ` · ${signed(latest.changeFromPrevious)} on the previous term` : ''}</p>
              )}
              <div style={{ margin: '16px 0 12px' }}><SubjectBars terms={d.terms} /></div>
              {detailed && (
                <DataTable boxed cols={[
                  { label: 'Term', render: (t) => <span className="cell-id"><b>{t.termName}</b><small>{t.termType === 'FORMATIVE' ? 'Formative' : 'Summative'} · {t.weightagePercent}% of the year</small></span> },
                  { label: 'Score', className: 'num', render: (t) => <b>{pct(t.percentage)}</b> },
                  { label: 'Grade', render: (t) => t.grade || '—' },
                  { label: 'Rank', render: (t) => t.sectionRank ?? '—' },
                  { label: 'Change', render: (t) => signed(t.changeFromPrevious) || '—' },
                  { label: 'Result', render: (t) => <>{pill(RESULT, t.result)}{!t.published && <small className="xs muted"> not published</small>}</> },
                  { label: 'Action', render: (t) => <span className="act"><button type="button" className="link" onPointerEnter={() => prefetchCard(student.studentId, t.examTermId)} onFocus={() => prefetchCard(student.studentId, t.examTermId)} onClick={() => setOpen(t.examTermId)}><FileText size={13} />Progress card</button></span> },
                ]} rows={d.terms} />
              )}
              {!detailed && <div className="pills"><button className="btn" onPointerEnter={() => prefetchCard(student.studentId, latest.examTermId)} onFocus={() => prefetchCard(student.studentId, latest.examTermId)} onClick={() => setOpen(latest.examTermId)}><FileText size={14} />View progress card</button></div>}
            </>)}
      {open && <ProgressCardModal student={student} terms={d.terms} termId={open} onTerm={setOpen} onClose={() => setOpen(null)} onChanged={trend.reload} />}
    </Card>
  );
}

/**
 * Progress cards fetched in the last 30 s, keyed by student and term. Hovering or focusing a "Progress card" button
 * starts the request, so the modal usually opens with the card already loaded; the other terms are fetched once it is open.
 */
const cardCache = new Map();
const cardKey = (studentId, termId) => `${studentId}|${termId}`;
function loadCard(studentId, termId) {
  const key = cardKey(studentId, termId), hit = cardCache.get(key);
  if (hit && Date.now() - hit.at < 30_000) return hit.promise;
  const entry = { promise: exam.progressCard(studentId, termId), at: Date.now() };
  cardCache.set(key, entry);
  entry.promise.then((data) => { entry.data = data; }, () => cardCache.delete(key));
  return entry.promise;
}
/** The card if it has already arrived (shown on the first render, without a placeholder frame). */
const cachedCard = (studentId, termId) => { const hit = cardCache.get(cardKey(studentId, termId)); return hit && Date.now() - hit.at < 30_000 ? hit.data : undefined; };
const prefetchCard = (studentId, termId) => { loadCard(studentId, termId).catch(() => { /* shown when opened */ }); };

/** Placeholder with the card's shape (subject rows, totals), so the modal opens at its final size. */
function CardSkeleton({ rows }) {
  const line = (w) => <span className="skel" style={{ width: w }} />;
  return (
    <div aria-busy="true" aria-label="Loading progress card">
      <DataTable boxed cols={[{ label: 'Subject', render: () => line('60%') }, { label: 'Marks', className: 'num', render: () => line(56) }, { label: 'Grade', render: () => line(24) }, { label: '', render: () => null }]}
        rows={Array.from({ length: rows }, (_, i) => ({ i }))} />
      <KV rows={['Total', 'Grade', 'Result', 'Section rank', 'Published to parents'].map((k, i) => [k, line(i % 2 ? 90 : 130)])} />
    </div>
  );
}

/** Progress card: GET /api/v1/academic/students/{id}/progress-card (US-05009); remarks PUT …/remarks (US-05018). */
function ProgressCardModal({ student, terms, termId, onTerm, onClose, onChanged }) {
  const { hasRole } = useAuth();
  const card = useApi(() => loadCard(student.studentId, termId), [student.studentId, termId]);
  // Once open, fetch the other terms too so switching term is instant
  useEffect(() => { terms.forEach((t) => prefetchCard(student.studentId, t.examTermId)); }, [student.studentId, terms]);
  const subjectRows = terms.find((t) => String(t.examTermId) === String(termId))?.subjects?.length || 4;
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  // While the request settles, an already-fetched card for this term is shown at once; else the previous term's card (dimmed)
  const ready = card.loading ? cachedCard(student.studentId, termId) : undefined;
  const c = ready ?? card.data;
  const pending = card.loading && !ready;
  const save = async () => {
    setBusy(true); setError(null);
    try { await exam.saveRemarks(student.studentId, { examTermId: termId, remarks: text.trim() }); setEditing(false); cardCache.delete(cardKey(student.studentId, termId)); card.reload(); onChanged?.(); } catch (e) { setError(e); } finally { setBusy(false); }
  };
  return (
    <Modal title="Holistic progress card" sub={`${student.firstName} ${student.lastName}${c ? ` · ${c.className} · ${c.academicYear}` : ''}`} onClose={onClose}
      footer={<button className="btn primary" onClick={onClose}>Done</button>}>
      <div className="field box" style={{ marginBottom: 12 }}><label htmlFor="pc-term">TERM{c && pending && <LoaderCircle size={11} className="spin" style={{ marginLeft: 6, verticalAlign: -1 }} aria-label="Loading term" />}</label>
        <select id="pc-term" value={termId} onChange={(e) => { setEditing(false); onTerm(e.target.value); }}>
          {terms.map((t) => <option key={t.examTermId} value={t.examTermId}>{t.termName}</option>)}
        </select></div>
      {/* Switching term keeps the previous card on screen (dimmed) until the new one arrives, so the modal does not collapse to a spinner and jump */}
      {!c && pending ? <CardSkeleton rows={subjectRows} /> : card.error ? <ApiErr error={card.error} /> : (<div className="fade-in" aria-busy={pending} style={{ opacity: pending ? 0.5 : 1, transition: 'opacity 150ms ease', pointerEvents: pending ? 'none' : undefined }}>
        <DataTable boxed cols={[
          { label: 'Subject', render: (r) => r.subjectName },
          { label: 'Marks', className: 'num', render: (r) => (!r.entered ? '—' : r.absent ? 'AB' : `${Number(r.marksObtained)} / ${Number(r.maxMarks)}`) },
          { label: 'Grade', render: (r) => r.grade || '—' },
          { label: '', render: (r) => (r.entered && !r.passed ? <Pill tone="amber">Below pass</Pill> : null) },
        ]} rows={c.scholastic} />
        <KV rows={[
          ['Total', `${Number(c.totalObtained)} / ${Number(c.totalMax)} · ${pct(c.percentage)}`],
          ['Grade', `${c.grade || '—'}${c.gradePoint !== null && c.gradePoint !== undefined ? ` · grade point ${c.gradePoint}` : ''}`],
          ['Result', (RESULT[c.result] || [c.result])[0]],
          ['Section rank', c.sectionRank ? `${c.sectionRank} of ${c.sectionSize}` : '—'],
          ['Published to parents', c.published ? fmtDate(c.publishedAt) : 'Not yet'],
        ]} />
        <h4 style={{ fontSize: 13, fontWeight: 600, margin: '14px 0 8px' }}>Co-scholastic areas</h4>
        {c.coScholastic.length ? <div className="pills">{c.coScholastic.map((g) => <Pill key={g.area} tone={g.grade.startsWith('A') ? 'green' : ''}>{AREAS[g.area] || g.area}: {g.grade}{g.remarks ? ` · ${g.remarks}` : ''}</Pill>)}</div>
          : <p className="xs muted">Not graded for this term.</p>}
        <h4 style={{ fontSize: 13, fontWeight: 600, margin: '14px 0 8px' }}>Class teacher's remarks</h4>
        {editing ? (<>
          <div className="field box"><label htmlFor="pc-remarks">REMARKS *</label>
            <textarea id="pc-remarks" rows={3} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} /></div>
          {error && <ApiErr error={error} />}
          <div className="pills" style={{ marginTop: 8 }}>
            <button className="btn" onClick={() => setEditing(false)}>Cancel</button>
            <button className="btn primary" disabled={busy || !text.trim()} onClick={save}>{busy && <LoaderCircle size={14} className="spin" />}Save remarks</button>
          </div>
        </>) : (<>
          <p className="body-s">{c.teacherRemarks || <span className="muted">No remarks yet.</span>}</p>
          {c.remarksBy && <p className="xs muted">— {c.remarksBy}</p>}
          {hasRole(...ROLES.remarks) && !c.published && (
            <button className="btn" style={{ marginTop: 8 }} onClick={() => { setText(c.teacherRemarks || ''); setEditing(true); }}><Pencil size={14} />{c.teacherRemarks ? 'Edit remarks' : 'Add remarks'}</button>
          )}
        </>)}
      </div>)}
    </Modal>
  );
}
