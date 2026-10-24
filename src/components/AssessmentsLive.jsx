import { useEffect, useState } from 'react';
import { Lock, Download, LoaderCircle, Save, Unlock, Send, Check } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { useApi } from '../api/useApi.js';
import * as exam from '../api/examService.js';
import * as studentApi from '../api/studentService.js';
import { PageHeader, Metrics, scrollToId, Card, SectionHead, Tabs, DataTable, Pill, Footer, downloadCsv, useTabParam } from './ui.jsx';
import { Modal } from './AuthSettings.jsx';
import { ApiErr, ApiNote } from './Admissions.jsx';
import { formatDate, formatDateTime, formatTime, formatNumber } from '../regional.js';

const { ROLES, RESULT, pct } = exam;
const Loading = () => <p className="xs muted"><LoaderCircle size={12} className="spin" /> Loading…</p>;
const when = (t) => formatDateTime(t);
const TABS = ['Mark entry', 'Broadsheet', 'Rank list', 'Incomplete entries', 'Unlock tickets'];
const resultPill = (code) => { const [t, c] = RESULT[code] || [code, '']; return <Pill tone={c}>{t}</Pill>; };
const Picker = ({ label, value, onChange, options, empty }) => (
  <select className="select" aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
    {empty && <option value="">{empty}</option>}
    {options.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
  </select>
);

/** Academics → assessments workspace, live from studentservice (Module 05) for teachers, exam staff and principals. */
export function AssessmentsLive() {
  const { user, hasRole, branchId } = useAuth();
  const terms = useApi(() => exam.listTerms(), []);
  const grades = useApi(() => studentApi.listGrades(user.tenantId), [user?.tenantId], !!user?.tenantId);
  const [termId, setTermId] = useState('');
  const [gradeId, setGradeId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [tab, setTab] = useTabParam(TABS);
  const sections = useApi(() => studentApi.listSections(gradeId), [gradeId], !!gradeId);
  const term = (terms.data || []).find((t) => t.examTermId === termId);
  const overall = useApi(() => exam.completeness(termId, { branchId }), [termId, branchId], !!termId);
  const tickets = useApi(() => exam.listTickets(termId), [termId], !!termId);
  const [locking, setLocking] = useState(null);

  // Defaults: the latest term that has started, the first class with exams, its first section
  useEffect(() => {
    if (!termId && terms.data?.length) {
      const started = terms.data.filter((t) => new Date(t.startDate) <= new Date());
      setTermId((started[started.length - 1] || terms.data[0]).examTermId);
    }
  }, [terms.data, termId]);
  useEffect(() => {
    if (!gradeId && grades.data?.length) setGradeId((grades.data.find((g) => g.sequenceOrder >= 4) || grades.data[0]).gradeId);
  }, [grades.data, gradeId]);
  useEffect(() => { setSectionId(''); }, [gradeId]);
  // Only sections of the chosen class (the previous class's list is still loaded right after a change)
  const classSections = (sections.data || []).filter((s) => s.gradeId === gradeId).sort((a, b) => a.sectionName.localeCompare(b.sectionName));
  useEffect(() => {
    if (!sectionId && classSections.length) setSectionId(classSections[0].sectionId);
  }, [classSections, sectionId]);

  const lock = async () => {
    setLocking('busy');
    try { await exam.lockTerm(termId); terms.reload(); setLocking(null); } catch (e) { setLocking(e); }
  };
  const pending = (tickets.data || []).filter((t) => t.status === 'PENDING').length;
  const o = overall.data;
  const ready = term && gradeId && classSections.some((s) => s.sectionId === sectionId);

  return (
    <>
      <PageHeader
        title="Academics"
        desc="Assessment terms, mark entry, results and progress cards."
        actions={[
          term && !term.locked && hasRole(...ROLES.configure) && { label: 'Lock mark entry', icon: <Lock size={15} />, onClick: lock, disabled: locking === 'busy' },
        ].filter(Boolean)}
      />
      {locking && locking !== 'busy' && <Card><ApiErr error={locking} /></Card>}
      <Metrics items={[
        ['Term', term ? term.termName : '…', term ? `${term.termType === 'FORMATIVE' ? 'Formative' : 'Summative'} · ${term.weightagePercent}% of the year` : ''],
        ['Mark entry', term ? (term.locked ? 'Locked' : 'Open') : '…', term ? (term.locked ? (term.lockedAt ? `Locked ${when(term.lockedAt)}` : `Closed ${when(term.markEntryDeadline)} (T_lock)`) : `Closes ${when(term.markEntryDeadline)}`) : '', null, false, null,
          term && { onClick: () => { setTab(0); scrollToId('academics-tabs'); }, hint: 'Open mark entry', active: tab === 0 }],
        ['Entries complete', o ? `${o.enteredEntries} / ${o.expectedEntries}` : '…', o ? (o.complete ? 'Ready for report cards' : `${o.missingEntries} still missing`) : '', null, false, null,
          o && { onClick: () => { setTab(3); scrollToId('academics-tabs'); }, hint: 'Open incomplete entries', active: tab === 3 }],
        ['Unlock tickets', tickets.data ? String(pending) : '…', pending ? 'Waiting for a decision' : 'None pending', null, false, null,
          tickets.data && { onClick: () => { setTab(4); scrollToId('academics-tabs'); }, hint: 'Open unlock tickets', active: tab === 4 }],
      ]} />
      <Card id="academics-tabs">
        <div className="filters" style={{ marginBottom: 14 }}>
          {terms.error ? <ApiErr error={terms.error} /> : <Picker label="Term" value={termId} onChange={setTermId} options={(terms.data || []).map((t) => [t.examTermId, `${t.termName} · ${t.sessionName}`])} />}
          {grades.error ? <ApiErr error={grades.error} /> : <Picker label="Class" value={gradeId} onChange={setGradeId} options={(grades.data || []).filter((g) => g.sequenceOrder >= 4).map((g) => [g.gradeId, g.gradeName])} />}
          <Picker label="Section" value={sectionId} onChange={setSectionId} options={classSections.map((s) => [s.sectionId, `Section ${s.sectionName}`])} />
        </div>
        <Tabs items={TABS.map((t, i) => (i === 4 && pending ? `${t} (${pending})` : t))} value={tab} onChange={setTab} />
        <div style={{ marginTop: 16 }}>
          {!ready ? <Loading />
            : tab === 0 ? <MarkEntryTab term={term} gradeId={gradeId} sectionId={sectionId} branchId={branchId} onChanged={() => { overall.reload(); tickets.reload(); }} />
              : tab === 1 ? <BroadsheetTab term={term} sectionId={sectionId} branchId={branchId} />
                : tab === 2 ? <RankTab term={term} gradeId={gradeId} branchId={branchId} />
                  : tab === 3 ? <IncompleteTab data={overall} />
                    : <TicketsTab tickets={tickets} onChanged={() => { tickets.reload(); }} />}
        </div>
      </Card>
      <Footer />
    </>
  );
}

/** Mark entry grid: GET / PUT /api/v1/academic/exam-terms/{id}/marks (US-05003), T_lock (US-05005), unlock ticket (US-05006). */
function MarkEntryTab({ term, gradeId, sectionId, branchId, onChanged }) {
  const { hasRole } = useAuth();
  const subjects = useApi(() => exam.listSubjects(term.examTermId, gradeId), [term.examTermId, gradeId]);
  const [code, setCode] = useState('');
  useEffect(() => { if (subjects.data?.length && !subjects.data.some((s) => s.subjectCode === code)) setCode(subjects.data[0].subjectCode); }, [subjects.data, code]);
  const sheet = useApi(() => exam.markSheet(term.examTermId, sectionId, code, branchId), [term.examTermId, sectionId, code, branchId], !!code);
  const [draft, setDraft] = useState({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [asking, setAsking] = useState(false);
  useEffect(() => { setDraft({}); }, [sheet.data]);
  useEffect(() => { setMsg(null); }, [term.examTermId, sectionId, code]);

  if (subjects.loading) return <Loading />;
  if (subjects.error) return <ApiErr error={subjects.error} />;
  if (!subjects.data.length) return <ApiNote>No subjects are set up for this class in {term.termName}.</ApiNote>;
  const s = sheet.data;
  const canEdit = hasRole(...ROLES.enterMarks) && s && !s.locked;
  const value = (r) => draft[r.studentId] ?? (r.absent ? { absent: true, marks: '' } : { absent: false, marks: r.marksObtained ?? '' });
  const set = (id, v) => setDraft((d) => ({ ...d, [id]: { ...value({ studentId: id, ...(s.rows.find((r) => r.studentId === id)) }), ...v } }));
  const changed = Object.keys(draft);
  const save = async () => {
    const entries = changed.map((id) => ({ studentId: id, ...(draft[id].absent ? { absent: true } : { marksObtained: draft[id].marks === '' ? null : Number(draft[id].marks) }) }))
      .filter((e) => e.absent || e.marksObtained !== null);
    if (!entries.length) return;
    setBusy(true); setMsg(null);
    try {
      await exam.saveMarks(term.examTermId, { sectionId, subjectCode: code, entries }, branchId);
      setMsg({ ok: `${entries.length} mark${entries.length === 1 ? '' : 's'} saved.` }); sheet.reload(); onChanged();
    } catch (e) { setMsg({ error: e }); } finally { setBusy(false); }
  };
  return (<>
    <div className="filters" style={{ marginBottom: 12 }}>
      <Picker label="Subject" value={code} onChange={setCode} options={subjects.data.map((x) => [x.subjectCode, `${x.subjectName} (out of ${Number(x.maxMarks)})`])} />
    </div>
    {sheet.loading || !s ? <Loading /> : sheet.error ? <ApiErr error={sheet.error} /> : (<>
      {s.locked ? (
        <div className="api-note" style={{ marginBottom: 12 }}><Lock size={14} style={{ flex: 'none' }} />
          <span>{s.lockReason}. {hasRole(...ROLES.requestUnlock) ? 'Ask the principal to reopen it if marks need correcting.' : ''}</span>
          {hasRole(...ROLES.requestUnlock) && <button className="btn" style={{ marginLeft: 'auto' }} onClick={() => setAsking(true)}><Unlock size={14} />Request unlock</button>}
        </div>
      ) : s.lockReason ? <ApiNote>{s.lockReason}</ApiNote> : null}
      <p className="xs muted" style={{ marginBottom: 10 }}>{s.className} · {s.subjectName} · out of {Number(s.maxMarks)}, pass {Number(s.passMarks)} · {s.enteredCount} entered, {s.missingCount} missing</p>
      <DataTable boxed cols={[
        { label: 'Roll', render: (r) => r.rollNumber ?? '—' },
        { label: 'Student', render: (r) => <span className="cell-id"><b>{r.studentName}</b><small>{r.studentUid}</small></span> },
        { label: 'Marks', render: (r) => {
          const v = value(r);
          return canEdit
            ? <input className="markinput" type="number" min="0" max={Number(s.maxMarks)} step="0.5" aria-label={`Marks for ${r.studentName}`} disabled={v.absent}
                value={v.marks} onChange={(e) => set(r.studentId, { marks: e.target.value, absent: false })} />
            : <b>{r.absent ? 'AB' : r.entered ? Number(r.marksObtained) : '—'}</b>;
        } },
        { label: 'Absent', render: (r) => (canEdit
          ? <input type="checkbox" aria-label={`${r.studentName} absent`} checked={value(r).absent} onChange={(e) => set(r.studentId, { absent: e.target.checked, marks: '' })} />
          : r.absent ? 'Yes' : '') },
        { label: 'Status', render: (r) => (draft[r.studentId] ? <Pill tone="purple">Unsaved</Pill>
          : !r.entered ? <Pill tone="amber">Missing</Pill> : !r.absent && Number(r.marksObtained) < Number(s.passMarks) ? <Pill tone="amber">Below pass</Pill> : <Pill tone="green">Entered</Pill>) },
      ]} rows={s.rows} />
      {canEdit && (
        <div className="row" style={{ marginTop: 12, gap: 12 }}>
          <button className="btn primary" disabled={busy || !changed.length} onClick={save}>{busy ? <LoaderCircle size={14} className="spin" /> : <Save size={14} />}Save marks{changed.length ? ` (${changed.length})` : ''}</button>
          {msg?.ok && <span className="xs" style={{ color: 'var(--gr)' }}>{msg.ok}</span>}
        </div>
      )}
      {msg?.error && <div style={{ marginTop: 10 }}><ApiErr error={msg.error} /></div>}
      {!hasRole(...ROLES.enterMarks) && <p className="xs muted" style={{ marginTop: 10 }}>Marks are entered by subject teachers, class teachers and the exam controller.</p>}
    </>)}
    {asking && <UnlockModal term={term} sheet={s} onClose={() => setAsking(false)} onSaved={onChanged} />}
  </>);
}

function UnlockModal({ term, sheet, onClose, onSaved }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const submit = async () => {
    setBusy(true); setError(null);
    try { await exam.requestUnlock(term.examTermId, { sectionId: sheet.sectionId, subjectCode: sheet.subjectCode, reason: reason.trim() }); setDone(true); onSaved(); } catch (e) { setError(e); } finally { setBusy(false); }
  };
  return (
    <Modal title="Request unlock" sub={`${term.termName} · ${sheet.className} · ${sheet.subjectName}`} onClose={onClose}
      footer={done ? <button className="btn primary" onClick={onClose}>Done</button> : <><button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={busy || !reason.trim()} onClick={submit}>{busy ? <LoaderCircle size={14} className="spin" /> : <Send size={14} />}Send request</button></>}>
      {done ? <p className="body-s">Request sent. The principal or exam controller decides it under <b>Unlock tickets</b>.</p> : (<>
        <div className="field box"><label htmlFor="ul-reason">REASON *</label>
          <textarea id="ul-reason" rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Which marks need correcting and why" /></div>
        {error && <ApiErr error={error} />}
      </>)}
    </Modal>
  );
}

/** Broadsheet: GET …/broadsheet (US-05007); Publish (US-05010). */
function BroadsheetTab({ term, sectionId, branchId }) {
  const { hasRole } = useAuth();
  const sheet = useApi(() => exam.broadsheet(term.examTermId, sectionId, branchId), [term.examTermId, sectionId, branchId]);
  const [pub, setPub] = useState(null);
  if (sheet.loading) return <Loading />;
  if (sheet.error) return <ApiErr error={sheet.error} />;
  const b = sheet.data;
  const publish = async () => {
    setPub('busy');
    try { const r = await exam.publish(term.examTermId, sectionId, branchId); setPub({ ok: `${r.published} progress card${r.published === 1 ? '' : 's'} published${r.alreadyPublished ? `, ${r.alreadyPublished} already published` : ''}.` }); } catch (e) { setPub({ error: e }); }
  };
  const exportCsv = () => downloadCsv(`broadsheet-${term.termName}-${b.className}`.replace(/\s+/g, '-').toLowerCase(),
    ['Roll', 'Student UID', 'Student', ...b.subjects.map((x) => `${x.subjectName} (${Number(x.maxMarks)})`), 'Total', 'Percentage', 'Grade', 'Result', 'Rank'],
    b.rows.map((r) => [r.rollNumber ?? '', r.studentUid, r.studentName, ...r.marks.map((m) => (!m.entered ? '' : m.absent ? 'AB' : Number(m.marksObtained))),
      `${Number(r.totalObtained)}/${Number(r.totalMax)}`, r.percentage ?? '', r.grade ?? '', r.result, r.rank ?? '']));
  return (<>
    <div className="row" style={{ gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
      <span className="xs muted">{b.className} · class average {pct(b.classAveragePercent)}</span>
      <span style={{ marginLeft: 'auto' }} />
      <button className="btn" onClick={exportCsv}><Download size={14} />Export CSV</button>
      {hasRole(...ROLES.publish) && <button className="btn primary" disabled={pub === 'busy'} onClick={publish}><Send size={14} />Publish progress cards</button>}
    </div>
    {pub?.ok && <div className="api-note ok"><Check size={14} style={{ flex: 'none' }} /><span>{pub.ok}</span></div>}
    {pub?.error && <ApiErr error={pub.error} />}
    <DataTable boxed cols={[
      { label: 'Student', render: (r) => <span className="cell-id"><b>{r.studentName}</b><small>Roll {r.rollNumber ?? '—'}</small></span> },
      ...b.subjects.map((x) => ({ label: x.subjectCode, className: 'num', render: (r) => { const m = r.marks.find((c) => c.subjectCode === x.subjectCode); return !m?.entered ? <span className="muted">—</span> : m.absent ? 'AB' : Number(m.marksObtained); } })),
      { label: '%', className: 'num', render: (r) => <b>{pct(r.percentage)}</b> },
      { label: 'Grade', render: (r) => r.grade || '—' },
      { label: 'Result', render: (r) => resultPill(r.result) },
      { label: 'Rank', render: (r) => r.rank ?? '—' },
    ]} rows={b.rows} />
    <p className="xs muted" style={{ marginTop: 10 }}>{b.subjects.map((x) => `${x.subjectName}: avg ${x.averageMarks ?? '—'}, top ${x.highestMarks ?? '—'}, ${x.failed} below pass`).join(' · ')}</p>
  </>);
}

/** Rank list of the whole class: GET …/rank-list?gradeId (US-05011). */
function RankTab({ term, gradeId, branchId }) {
  const ranks = useApi(() => exam.rankList(term.examTermId, { gradeId, branchId }), [term.examTermId, gradeId, branchId]);
  if (ranks.loading) return <Loading />;
  if (ranks.error) return <ApiErr error={ranks.error} />;
  const r = ranks.data;
  return (<>
    <SectionHead title={`Rank list · ${r.scope}`} sub={`${r.rankedStudents} students ranked`} />
    <div style={{ margin: '12px 0' }} className="pills">
      {r.subjectToppers.filter((t) => t.topMarks !== null).map((t) => <Pill key={t.subjectCode} tone="purple">{t.subjectName}: {t.students.join(', ')} ({Number(t.topMarks)}/{Number(t.maxMarks)})</Pill>)}
    </div>
    <DataTable boxed cols={[
      { label: 'Rank', render: (e) => <b>{e.rank}</b> },
      { label: 'Student', render: (e) => <span className="cell-id"><b>{e.studentName}</b><small>{e.studentUid} · {e.className}</small></span> },
      { label: '%', className: 'num', render: (e) => pct(e.percentage) },
      { label: 'Grade', render: (e) => e.grade || '—' },
      { label: 'Band', render: (e) => <Pill tone={e.percentileBand === 'Top 10%' ? 'green' : e.percentileBand === 'Below median' ? '' : 'purple'}>{e.percentileBand}</Pill> },
    ]} rows={r.ranks} />
  </>);
}

/** Incomplete entries of the term: GET …/completeness (US-05016). */
function IncompleteTab({ data }) {
  if (data.loading || !data.data) return <Loading />;
  if (data.error) return <ApiErr error={data.error} />;
  const d = data.data;
  if (d.complete) return <ApiNote>Every mark of {d.termName} is entered ({d.enteredEntries} entries); report cards can be compiled.</ApiNote>;
  return (<>
    <p className="xs muted" style={{ marginBottom: 10 }}>{d.missingEntries} of {d.expectedEntries} entries missing in {d.termName}. Publishing is blocked for these sections.</p>
    <DataTable boxed cols={[
      { label: 'Class', render: (i) => i.className },
      { label: 'Subject', render: (i) => i.subjectName },
      { label: 'Entered', render: (i) => `${i.entered} / ${i.expected}` },
      { label: 'Missing', render: (i) => <small className="xs">{i.missing.map((m) => m.studentName).join(', ')}</small> },
    ]} rows={d.items} />
  </>);
}

/** Unlock tickets: GET …/unlock-tickets, PATCH /unlock-tickets/{id}/decision (US-05006). */
function TicketsTab({ tickets, onChanged }) {
  const { hasRole } = useAuth();
  const [deciding, setDeciding] = useState(null);
  if (tickets.loading) return <Loading />;
  if (tickets.error) return <ApiErr error={tickets.error} />;
  if (!tickets.data.length) return <p className="xs muted">No unlock tickets for this term.</p>;
  return (<>
    <DataTable boxed cols={[
      { label: 'Class · subject', render: (t) => <span className="cell-id"><b>{t.className} · {t.subjectName}</b><small>{when(t.createdAt)} by {t.requestedBy}</small></span> },
      { label: 'Reason', render: (t) => <small className="xs">{t.reason}</small> },
      { label: 'Status', render: (t) => <>{<Pill tone={t.status === 'APPROVED' ? 'green' : t.status === 'REJECTED' ? '' : 'amber'}>{t.status === 'PENDING' ? 'Pending' : t.status === 'APPROVED' ? 'Approved' : 'Rejected'}</Pill>}
        {t.unlockedUntil && <small className="xs muted"> open until {when(t.unlockedUntil)}</small>}{t.decisionRemarks && <small className="xs muted"> · {t.decisionRemarks}</small>}</> },
      { label: 'Action', render: (t) => (t.status === 'PENDING' && hasRole(...ROLES.decideUnlock)
        ? <span className="act"><button type="button" className="link" onClick={() => setDeciding({ t, decision: 'APPROVED' })}>Approve</button>
            <button type="button" className="link" onClick={() => setDeciding({ t, decision: 'REJECTED' })}>Reject</button></span> : null) },
    ]} rows={tickets.data} />
    {deciding && <DecisionModal {...deciding} onClose={() => setDeciding(null)} onSaved={onChanged} />}
  </>);
}

function DecisionModal({ t, decision, onClose, onSaved }) {
  const [remarks, setRemarks] = useState('');
  const [hours, setHours] = useState('24');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const approve = decision === 'APPROVED';
  const submit = async () => {
    setBusy(true); setError(null);
    try {
      await exam.decideTicket(t.ticketId, { decision, remarks: remarks.trim() || undefined, ...(approve ? { unlockHours: Number(hours) } : {}) });
      onSaved(); onClose();
    } catch (e) { setError(e); } finally { setBusy(false); }
  };
  return (
    <Modal title={approve ? 'Approve unlock' : 'Reject unlock'} sub={`${t.className} · ${t.subjectName}`} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={busy || (!approve && !remarks.trim())} onClick={submit}>{busy && <LoaderCircle size={14} className="spin" />}{approve ? 'Approve' : 'Reject'}</button></>}>
      <p className="body-s" style={{ marginBottom: 10 }}>{t.reason}</p>
      {approve && <div className="field box"><label htmlFor="dc-hours">KEEP OPEN FOR (HOURS)</label>
        <input id="dc-hours" type="number" min="1" max="72" value={hours} onChange={(e) => setHours(e.target.value)} /></div>}
      <div className="field box"><label htmlFor="dc-remarks">REMARKS{approve ? '' : ' *'}</label>
        <input id="dc-remarks" value={remarks} maxLength={500} onChange={(e) => setRemarks(e.target.value)} /></div>
      {error && <ApiErr error={error} />}
    </Modal>
  );
}
