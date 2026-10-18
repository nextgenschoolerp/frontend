import { useEffect, useMemo, useState } from 'react';
import { LoaderCircle, Check } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { useApi } from '../api/useApi.js';
import * as studentApi from '../api/studentService.js';
import * as exam from '../api/examService.js';
import { Pill, DataTable } from './ui.jsx';
import { Modal } from './AuthSettings.jsx';
import { ApiErr, ApiNote } from './Admissions.jsx';

const { fullName } = studentApi;
const today = () => new Date().toISOString().slice(0, 10);
/** "2026-2027" → "2027-2028" */
const nextSessionName = (name) => name.replace(/(\d{4})-(\d{4})/, (_, a, b) => `${Number(a) + 1}-${Number(b) + 1}`);

/**
 * Students → Promote class (US-03005). The class's students move up one class, keeping their section letter, but only
 * those who passed the year: the result comes from the examservice broadsheet of the final term (US-05007).
 * Calls POST /api/v1/academic/batch-promotion; creates the next academic session first if it does not exist yet.
 */
export function PromoteClassModal({ students, onClose, onDone }) {
  const { user, branchId } = useAuth();
  const grades = useApi(() => studentApi.listGrades(user.tenantId), [user.tenantId]);
  const sessions = useApi(() => studentApi.listSessions(user.tenantId), [user.tenantId]);
  const terms = useApi(() => exam.listTerms(), []);
  const ordered = useMemo(() => (grades.data || []).slice().sort((a, b) => a.sequenceOrder - b.sequenceOrder), [grades.data]);
  const withStudents = ordered.filter((g, i) => i < ordered.length - 1 && students.some((s) => s.gradeId === g.gradeId));
  const [gradeId, setGradeId] = useState('');
  const [termId, setTermId] = useState('');
  useEffect(() => { if (!gradeId && withStudents[0]) setGradeId(withStudents[0].gradeId); }, [withStudents.length]);
  // The final assessment of the year decides the result: the last summative term
  const summative = (terms.data || []).filter((t) => t.termType === 'SUMMATIVE').sort((a, b) => b.startDate.localeCompare(a.startDate));
  useEffect(() => { if (!termId && summative[0]) setTermId(summative[0].examTermId); }, [summative.length]);

  const from = ordered.find((g) => g.gradeId === gradeId);
  const to = from && ordered[ordered.indexOf(from) + 1];
  const roster = students.filter((s) => s.gradeId === gradeId);
  const sectionIds = [...new Set(roster.map((s) => s.sectionId).filter(Boolean))];
  const sheets = useApi(() => Promise.all(sectionIds.map((id) => exam.broadsheet(termId, id, branchId))),
    [termId, sectionIds.join(','), branchId], !!termId && sectionIds.length > 0);
  const results = useMemo(() => {
    const m = {};
    (sheets.data || []).forEach((b) => b.rows.forEach((r) => { m[r.studentId] = r; }));
    return m;
  }, [sheets.data]);

  const current = (sessions.data || []).find((s) => s.startDate <= today() && today() <= s.endDate)
    || (sessions.data || []).slice().sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
  const next = current && (sessions.data || []).find((s) => s.sessionName === nextSessionName(current.sessionName));

  const [picked, setPicked] = useState({});
  useEffect(() => {
    const p = {};
    roster.forEach((s) => { p[s.studentId] = results[s.studentId]?.result === 'PASS'; });
    setPicked(p);
  }, [gradeId, sheets.data]);
  const chosen = roster.filter((s) => picked[s.studentId]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);
  const promote = async () => {
    setBusy(true); setError(null);
    try {
      let nextYear = next;
      if (!nextYear) {
        const [y1, y2] = nextSessionName(current.sessionName).split('-');
        nextYear = await studentApi.createSession({ tenantId: user.tenantId, sessionName: `${y1}-${y2}`,
          startDate: `${y1}-04-01`, endDate: `${y2}-03-31`, isActive: false });
      }
      const r = await studentApi.promoteBatch({ currentAcademicYearId: current.academicYearId, nextAcademicYearId: nextYear.academicYearId,
        fromGradeId: from.gradeId, toGradeId: to.gradeId, studentIds: chosen.map((s) => s.studentId) });
      setDone(`${r.totalPromoted} student${r.totalPromoted === 1 ? '' : 's'} promoted from ${from.gradeName} to ${to.gradeName} for ${nextYear.sessionName}.`);
      onDone();
    } catch (err) { setError(err); } finally { setBusy(false); }
  };

  const loading = grades.loading || sessions.loading || terms.loading;
  const term = (terms.data || []).find((t) => t.examTermId === termId);
  return (
    <Modal title="Promote class" sub="Students who passed the year move up one class and keep their section"
      onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>{done ? 'Close' : 'Cancel'}</button>
        {!done && <button className="btn primary" onClick={promote} disabled={busy || !to || !current || !chosen.length}>
          {busy && <LoaderCircle size={14} className="spin" />}Promote {chosen.length} to {to?.gradeName || '…'}</button>}</>}>
      {loading ? <p className="xs muted"><LoaderCircle size={12} className="spin" /> Loading…</p>
        : grades.error || sessions.error ? <ApiErr error={grades.error || sessions.error} />
          : done ? <div className="api-note ok"><Check size={14} style={{ flex: 'none' }} /><span>{done}</span></div> : (
            <div className="fieldlist">
              <div className="field box"><label htmlFor="pr-class">CLASS *</label>
                <select id="pr-class" value={gradeId} onChange={(e) => setGradeId(e.target.value)}>
                  {withStudents.map((g) => <option key={g.gradeId} value={g.gradeId}>{g.gradeName} → {ordered[ordered.indexOf(g) + 1].gradeName}</option>)}
                </select></div>
              <div className="field box"><label htmlFor="pr-term">RESULT FROM *</label>
                <select id="pr-term" value={termId} onChange={(e) => setTermId(e.target.value)}>
                  {summative.map((t) => <option key={t.examTermId} value={t.examTermId}>{t.termName}</option>)}
                </select></div>
              <p className="xs muted">
                {current ? `${current.sessionName} → ${next ? next.sessionName : `${nextSessionName(current.sessionName)} (created on promotion)`}` : 'No academic session is set up.'}
              </p>
              {terms.error && <ApiNote>Exam results are not available for your role, so nobody can be selected.</ApiNote>}
              {sheets.loading ? <p className="xs muted"><LoaderCircle size={12} className="spin" /> Loading {term?.termName} results…</p>
                : sheets.error ? <ApiErr error={sheets.error} /> : (
                  <DataTable boxed rows={roster} cols={[
                    { label: 'Promote', render: (s) => <input type="checkbox" aria-label={`Promote ${fullName(s)}`} checked={!!picked[s.studentId]}
                      disabled={results[s.studentId]?.result !== 'PASS'} onChange={(e) => setPicked({ ...picked, [s.studentId]: e.target.checked })} /> },
                    { label: 'Student', render: (s) => <span className="cell-id"><b>{fullName(s)}</b><small>{s.studentUid}</small></span> },
                    { label: 'Class', render: (s) => studentApi.classLabel(s) },
                    { label: term?.termName || 'Score', className: 'num', render: (s) => (results[s.studentId]?.percentage != null ? `${Number(results[s.studentId].percentage).toFixed(1)}%` : '—') },
                    { label: 'Result', render: (s) => (results[s.studentId]?.result === 'PASS' ? <Pill tone="green">Passed</Pill>
                      : results[s.studentId]?.result === 'FAIL' ? <Pill tone="amber">Repeats the class</Pill> : <Pill>Result incomplete</Pill>) },
                  ]} />)}
              {error && <ApiErr error={error} />}
            </div>)}
    </Modal>
  );
}
