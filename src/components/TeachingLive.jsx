import { useEffect, useMemo, useState } from 'react';
import { Download, LoaderCircle, Wand2, UserX, Shuffle, Plus, Check, Send, CalendarPlus } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { useApi } from '../api/useApi.js';
import * as lms from '../api/academicService.js';
import { PageHeader, Metrics, Card, Tabs, DataTable, Pill, Footer, SectionHead, downloadFile, todayIso } from './ui.jsx';
import { Modal } from './AuthSettings.jsx';
import { ApiErr, ApiNote } from './Admissions.jsx';
import { formatDate, formatDateTime, formatTime, formatNumber } from '../regional.js';

const { ROLES, DAYS, hhmm } = lms;
const Loading = () => <p className="xs muted"><LoaderCircle size={12} className="spin" /> Loading…</p>;
const TABS = ['Timetable', 'Workload', 'Cover', 'Syllabus', 'Homework', 'Lesson plans', 'Labs'];
const pill = (map, code) => { const [t, c] = map[code] || [code, '']; return <Pill tone={c}>{t}</Pill>; };
const fmtDate = (d) => (d ? formatDate(String(d).slice(0, 10), { weekday: 'short' }) : '—');
const when = (t) => (t ? formatDateTime(t, { year: false }) : '—');
const isoPlus = (iso, days) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); };
/** Today, or the Monday after when today is a Sunday (the bell schedule runs Monday–Saturday). */
const nextSchoolDay = () => { const t = todayIso(); return new Date(`${t}T12:00:00`).getDay() === 0 ? isoPlus(t, 1) : t; };
const mondayOf = (iso) => { const d = new Date(`${iso}T12:00:00`); return isoPlus(iso, -((d.getDay() + 6) % 7)); };
const Picker = ({ label, value, onChange, options, empty }) => (
  <select className="select" aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
    {empty !== undefined && <option value="">{empty}</option>}
    {options.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
  </select>
);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const Ok = ({ children }) => <div className="api-note ok" style={{ marginBottom: 12 }}><Check size={14} style={{ flex: 'none' }} /><span>{children}</span></div>;

/** Teaching & learning workspace, live from academicservice (Module 06) for academic staff and principals. */
export function TeachingLive() {
  const { user, hasRole } = useAuth();
  const schedules = useApi(() => lms.listBellSchedules(), []);
  const allocations = useApi(() => lms.listAllocations(), []);
  const workloads = useApi(() => lms.listWorkloads(), []);
  const today = useApi(() => lms.daySheet(nextSchoolDay()), []);
  const [tab, setTab] = useState(0);
  const [sectionId, setSectionId] = useState('');
  const [generating, setGenerating] = useState(false);
  const [pdf, setPdf] = useState(null);

  const schedule = (schedules.data || []).find((s) => s.active) || schedules.data?.[0];
  // Classes come from the subject allocations: a section without allocations has nothing to timetable
  const sections = useMemo(() => {
    const seen = new Map();
    (allocations.data || []).forEach((a) => seen.set(a.sectionId, a.className));
    return [...seen].sort((a, b) => a[1].localeCompare(b[1], undefined, { numeric: true }));
  }, [allocations.data]);
  useEffect(() => { if (!sectionId && sections.length) setSectionId(sections[0][0]); }, [sections, sectionId]);
  const teachers = (workloads.data || []).slice().sort((a, b) => a.teacherName.localeCompare(b.teacherName));
  const avgUse = teachers.length ? teachers.reduce((n, t) => n + Number(t.utilisationPercent || 0), 0) / teachers.length : 0;
  const t = today.data;

  const downloadPdf = async () => {
    setPdf('busy');
    try { downloadFile('faculty-timetable.pdf', await lms.facultyPdf(schedule.bellScheduleId), 'application/pdf'); setPdf(null); } catch (e) { setPdf(e); }
  };

  return (
    <>
      <PageHeader
        title="Teaching & learning"
        desc="Timetables, cover, syllabus progress, homework, lesson plans and lab bookings."
        actions={[
          schedule && hasRole(...ROLES.exportPdf) && { label: 'Faculty timetable PDF', icon: pdf === 'busy' ? <LoaderCircle size={15} className="spin" /> : <Download size={15} />, onClick: downloadPdf, disabled: pdf === 'busy' },
          schedule && hasRole(...ROLES.generate) && { label: 'Generate timetables', icon: <Wand2 size={15} />, primary: true, onClick: () => setGenerating(true) },
        ].filter(Boolean)}
      />
      {pdf && pdf !== 'busy' && <Card><ApiErr error={pdf} /></Card>}
      <Metrics items={[
        ['Bell schedule', schedule ? schedule.scheduleName : schedules.loading ? '…' : 'None', schedule ? `${schedule.teachingPeriodsPerDay} periods a day · ${hhmm(schedule.schoolStart)}–${hhmm(schedule.schoolEnd)}` : ''],
        ['Teachers', workloads.data ? String(teachers.length) : '…', workloads.data ? `Average load ${avgUse.toFixed(0)}% of weekly cap` : ''],
        ['Classes', allocations.data ? String(sections.length) : '…', 'With subject teachers allocated'],
        [`Cover · ${t ? fmtDate(t.date) : '…'}`, t ? `${t.assigned} / ${t.periodsToCover}` : '…', t ? (t.periodsToCover ? `${t.absentTeachers} absent · ${t.uncovered} not covered` : 'No absences recorded') : ''],
      ]} />
      <Card>
        <Tabs items={TABS} value={tab} onChange={setTab} />
        <div style={{ marginTop: 16 }}>
          {schedules.error ? <ApiErr error={schedules.error} />
            : tab === 0 ? <TimetableTab sections={sections} sectionId={sectionId} setSectionId={setSectionId} teachers={teachers} schedule={schedule} me={user.userId} />
              : tab === 1 ? <WorkloadTab workloads={workloads} />
                : tab === 2 ? <CoverTab teachers={teachers} onChanged={today.reload} />
                  : tab === 3 ? <SyllabusTab sections={sections} sectionId={sectionId} setSectionId={setSectionId} />
                    : tab === 4 ? <HomeworkTab sections={sections} sectionId={sectionId} setSectionId={setSectionId} allocations={allocations.data || []} />
                      : tab === 5 ? <LessonPlansTab allocations={allocations.data || []} />
                        : <LabsTab sections={sections} />}
        </div>
      </Card>
      {generating && <GenerateModal schedule={schedule} sections={sections} onClose={() => setGenerating(false)} onDone={() => { workloads.reload(); today.reload(); }} />}
      <Footer />
    </>
  );
}

const SectionPicker = ({ sections, sectionId, setSectionId }) => (
  <Picker label="Class" value={sectionId} onChange={setSectionId} options={sections} />
);

/* ---------- Timetable (US-06002) ---------- */
function TimetableTab({ sections, sectionId, setSectionId, teachers, schedule, me }) {
  const [mode, setMode] = useState('class');
  const [teacherId, setTeacherId] = useState('');
  useEffect(() => { if (!teacherId && teachers.length) setTeacherId((teachers.find((x) => x.teacherId === me) || teachers[0]).teacherId); }, [teachers, teacherId, me]);
  const tt = useApi(() => (mode === 'class' ? lms.sectionTimetable(sectionId) : lms.teacherTimetable(teacherId)),
    [mode, sectionId, teacherId], mode === 'class' ? !!sectionId : !!teacherId);
  const bellId = tt.data?.bellScheduleId || schedule?.bellScheduleId;
  const bell = useApi(() => lms.getBellSchedule(bellId), [bellId], !!bellId);
  const d = tt.data;
  return (<>
    <div className="filters" style={{ marginBottom: 12 }}>
      <Picker label="View" value={mode} onChange={setMode} options={[['class', 'Class timetable'], ['teacher', 'Teacher timetable']]} />
      {mode === 'class' ? <SectionPicker sections={sections} sectionId={sectionId} setSectionId={setSectionId} />
        : <Picker label="Teacher" value={teacherId} onChange={setTeacherId} options={teachers.map((x) => [x.teacherId, x.teacherName])} />}
    </div>
    {tt.error ? <ApiErr error={tt.error} /> : bell.error ? <ApiErr error={bell.error} /> : tt.loading || bell.loading || !d ? <Loading /> : !bell.data ? <ApiNote>No bell schedule is set up yet.</ApiNote> : (<>
      <p className="xs muted" style={{ marginBottom: 10 }}>
        {mode === 'class' ? `${d.className} · ${d.periodsPerWeek} periods a week` : `${d.teacherName} · ${d.periodsPerWeek} of ${d.weeklyMaxPeriods ?? '—'} periods a week`} · {bell.data.scheduleName}
      </p>
      {!d.entries.length ? <ApiNote>No timetable yet. The timetable in-charge generates it with <b>Generate timetables</b>.</ApiNote>
        : <TimetableGrid bell={bell.data} entries={d.entries} show={mode === 'class' ? 'teacher' : 'class'} />}
    </>)}
  </>);
}

export function TimetableGrid({ bell, entries, show }) {
  const days = bell.workingDays;
  const at = (day, period) => entries.find((e) => e.dayOfWeek === day && e.periodNumber === period);
  return (
    <div className="tablebox"><div className="tablewrap">
      <table className="t ttgrid">
        <thead><tr><th>Period</th>{days.map((d) => <th key={d}>{DAYS[d]}</th>)}</tr></thead>
        <tbody>
          {bell.slots.map((s) => (s.slotType !== 'PERIOD'
            ? <tr key={s.sequenceNo} className="ttbreak"><td>{hhmm(s.startTime)}</td><td colSpan={days.length}>{s.label}</td></tr>
            : (
              <tr key={s.sequenceNo}>
                <td><span className="cell-id"><b>P{s.periodNumber}</b><small>{hhmm(s.startTime)}–{hhmm(s.endTime)}</small></span></td>
                {days.map((d) => {
                  const e = at(d, s.periodNumber);
                  return <td key={d}>{e ? <span className="cell-id"><b>{e.subjectName}</b><small>{show === 'teacher' ? e.teacherName : e.className}</small></span> : <span className="muted xs">Free</span>}</td>;
                })}
              </tr>
            )))}
        </tbody>
      </table>
    </div></div>
  );
}

function GenerateModal({ schedule, sections, onClose, onDone }) {
  const [picked, setPicked] = useState(() => sections.map(([id]) => id));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const run = async () => {
    setBusy(true); setError(null);
    try { setResult(await lms.generateTimetables({ bellScheduleId: schedule.bellScheduleId, sectionIds: picked })); onDone(); } catch (e) { setError(e); } finally { setBusy(false); }
  };
  const unplaced = result?.sections.flatMap((s) => s.unplaced.map((u) => ({ ...u, className: s.className }))) || [];
  return (
    <Modal title="Generate timetables" sub={schedule.scheduleName} onClose={onClose}
      footer={result ? <button className="btn primary" onClick={onClose}>Done</button> : <><button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={busy || !picked.length} onClick={run}>{busy ? <LoaderCircle size={14} className="spin" /> : <Wand2 size={14} />}Generate {picked.length} timetable{picked.length === 1 ? '' : 's'}</button></>}>
      {result ? (<>
        <Ok>{result.periodsPlaced} of {result.periodsRequired} periods placed in {result.sectionsScheduled} class{result.sectionsScheduled === 1 ? '' : 'es'}{result.conflictFree ? ', no teacher double-booked' : ''}.</Ok>
        {result.sections.map((s) => <p key={s.sectionId} className="body-s">{s.className}: {s.periodsPlaced}/{s.periodsRequired} placed, {s.freePeriods} free periods</p>)}
        {!!result.substitutionsCleared && <p className="xs muted" style={{ marginTop: 8 }}>{result.substitutionsCleared} upcoming cover assignment{result.substitutionsCleared === 1 ? ' was' : 's were'} cleared; run auto-assign again under <b>Cover</b>.</p>}
        {!!unplaced.length && <div style={{ marginTop: 10 }}><DataTable boxed cols={[
          { label: 'Class', key: 'className' }, { label: 'Subject', key: 'subjectCode' }, { label: 'Teacher', key: 'teacherName' },
          { label: 'Missing', key: 'missingPeriods' }, { label: 'Why', render: (u) => <small className="xs">{u.reason}</small> },
        ]} rows={unplaced} /></div>}
      </>) : (<>
        <p className="body-s" style={{ marginBottom: 10 }}>Builds each class's week from its subject allocations without double-booking a teacher. It replaces the class's current timetable and clears its upcoming cover.</p>
        <div className="pills">{sections.map(([id, name]) => (
          <label key={id} className="xs" style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={picked.includes(id)} onChange={() => toggle(id)} />{name}</label>
        ))}</div>
        {error && <div style={{ marginTop: 10 }}><ApiErr error={error} /></div>}
      </>)}
    </Modal>
  );
}

/* ---------- Workload (US-06001) ---------- */
function WorkloadTab({ workloads }) {
  if (workloads.error) return <ApiErr error={workloads.error} />;
  if (workloads.loading || !workloads.data) return <Loading />;
  return (<>
    <DataTable boxed cols={[
      { label: 'Teacher', render: (w) => <span className="cell-id"><b>{w.teacherName}</b><small>{w.qualifiedSubjectCodes.join(', ') || 'No subjects'}</small></span> },
      { label: 'Allocated', className: 'num', render: (w) => `${w.allocatedPeriods} / ${w.weeklyMaxPeriods}` },
      { label: 'Timetabled', className: 'num', key: 'timetabledPeriods' },
      { label: 'Daily cap', className: 'num', key: 'dailyMaxPeriods' },
      { label: 'Load', render: (w) => <Pill tone={Number(w.utilisationPercent) > 90 ? 'amber' : Number(w.utilisationPercent) ? 'green' : ''}>{Number(w.utilisationPercent).toFixed(0)}%</Pill> },
      { label: 'Classes', render: (w) => <small className="xs">{w.allocations.map((a) => `${a.className} ${a.subjectCode} ×${a.periodsPerWeek}`).join(' · ') || '—'}</small> },
    ]} rows={workloads.data.slice().sort((a, b) => a.teacherName.localeCompare(b.teacherName))} />
    <p className="xs muted" style={{ marginTop: 10 }}>Caps and allocations are set by the timetable in-charge (Postman › Workloads); an allocation to a teacher not qualified for the subject is refused.</p>
  </>);
}

/* ---------- Cover (US-06003) ---------- */
function CoverTab({ teachers, onChanged }) {
  const { hasRole } = useAuth();
  const [date, setDate] = useState(nextSchoolDay);
  const absences = useApi(() => lms.listAbsences(date), [date], !!date);
  const sheet = useApi(() => lms.daySheet(date), [date], !!date);
  const [marking, setMarking] = useState(false);
  const [msg, setMsg] = useState(null);
  const can = hasRole(...ROLES.substitution);
  useEffect(() => setMsg(null), [date]);
  const reload = () => { absences.reload(); sheet.reload(); onChanged(); };
  const assign = async () => {
    setMsg('busy');
    try { const r = await lms.autoAssign(date); setMsg({ ok: `${r.assigned} of ${r.periodsToCover} periods covered${r.uncovered ? `, ${r.uncovered} still need a teacher` : ''}.` }); reload(); } catch (e) { setMsg({ error: e }); }
  };
  const change = async (s, proxyTeacherId) => {
    setMsg('busy');
    try { await lms.reassignProxy(s.proxyId, proxyTeacherId ? { proxyTeacherId } : { cancel: true }); setMsg(null); reload(); } catch (e) { setMsg({ error: e }); }
  };
  const d = sheet.data;
  return (<>
    <div className="row" style={{ gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
      <input className="select" type="date" aria-label="Date" value={date} onChange={(e) => setDate(e.target.value)} />
      <span className="xs muted">{d ? `${d.dayName} · ${d.absentTeachers} absent · ${plural(d.periodsToCover, 'period')} to cover` : ''}</span>
      <span style={{ marginLeft: 'auto' }} />
      {can && <button className="btn" onClick={() => setMarking(true)}><UserX size={14} />Mark teacher absent</button>}
      {can && <button className="btn primary" disabled={msg === 'busy' || !d?.periodsToCover} onClick={assign}><Shuffle size={14} />Auto-assign cover</button>}
    </div>
    {msg?.ok && <Ok>{msg.ok}</Ok>}
    {msg?.error && <ApiErr error={msg.error} />}
    {absences.error ? <ApiErr error={absences.error} /> : sheet.error ? <ApiErr error={sheet.error} /> : absences.loading || sheet.loading || !absences.data || !d ? <Loading /> : (<>
      {!absences.data.length ? <ApiNote>No teacher is marked absent on {fmtDate(date)}.</ApiNote> : (
        <div className="pills" style={{ marginBottom: 12 }}>
          {absences.data.map((a) => <Pill key={a.absenceId} tone="amber">{a.teacherName} · {a.periodsAffected} period{a.periodsAffected === 1 ? '' : 's'}{a.reason ? ` · ${a.reason}` : ''}</Pill>)}
        </div>
      )}
      {!!d.substitutions.length && <DataTable boxed cols={[
        { label: 'Period', render: (s) => <span className="cell-id"><b>P{s.periodNumber}</b><small>{hhmm(s.startTime)}–{hhmm(s.endTime)}</small></span> },
        { label: 'Class', render: (s) => `${s.className} · ${s.subjectCode}` },
        { label: 'Absent', key: 'absentTeacherName' },
        { label: 'Cover', render: (s) => <>{(can && s.status !== 'CANCELLED'
          ? <select className="select" aria-label={`Cover for ${s.className} P${s.periodNumber}`} value={s.proxyTeacherId || ''} onChange={(e) => change(s, e.target.value)}>
              <option value="" disabled>Choose a teacher</option>
              {teachers.filter((x) => x.teacherId !== s.absentTeacherId).map((x) => <option key={x.teacherId} value={x.teacherId}>{x.teacherName}</option>)}
            </select>
          : <b style={{ fontWeight: 500 }}>{s.proxyTeacherName || '—'}</b>)}{s.matchReason && <small className="xs muted" style={{ display: 'block' }}>{s.matchReason}</small>}</> },
        { label: 'Status', render: (s) => <>{pill(lms.PROXY_STATUS, s.status)} {s.assignmentMode === 'MANUAL' && <small className="xs muted">manual</small>}</> },
        { label: 'Action', render: (s) => (can && s.status === 'ASSIGNED' ? <button type="button" className="link" onClick={() => change(s, null)}>Cancel</button> : null) },
      ]} rows={d.substitutions} />}
      {!d.substitutions.length && !!d.periodsToCover && <p className="xs muted">No cover assigned yet{can ? ': use Auto-assign cover' : ''}.</p>}
    </>)}
    {marking && <AbsenceModal date={date} teachers={teachers} onClose={() => setMarking(false)} onSaved={reload} />}
  </>);
}

function AbsenceModal({ date, teachers, onClose, onSaved }) {
  const [teacherId, setTeacherId] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const save = async () => {
    setBusy(true); setError(null);
    try { await lms.reportAbsence({ teacherId, absenceDate: date, reason: reason.trim() || undefined }); onSaved(); onClose(); } catch (e) { setError(e); } finally { setBusy(false); }
  };
  return (
    <Modal title="Mark teacher absent" sub={fmtDate(date)} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy || !teacherId} onClick={save}>{busy && <LoaderCircle size={14} className="spin" />}Mark absent</button></>}>
      <div className="field box"><label htmlFor="ab-teacher">TEACHER *</label>
        <select id="ab-teacher" value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
          <option value="" disabled>Choose a teacher</option>
          {teachers.map((x) => <option key={x.teacherId} value={x.teacherId}>{x.teacherName}</option>)}
        </select></div>
      <div className="field box"><label htmlFor="ab-reason">REASON</label><input id="ab-reason" maxLength={255} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Medical leave" /></div>
      {error && <ApiErr error={error} />}
    </Modal>
  );
}

/* ---------- Syllabus (US-06004) ---------- */
function SyllabusTab({ sections, sectionId, setSectionId }) {
  const { hasRole } = useAuth();
  const cov = useApi(() => lms.coverage(sectionId), [sectionId], !!sectionId);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const mark = async (topicId) => {
    setBusy(topicId); setError(null);
    try { await lms.markCovered(topicId, { sectionId, completedOn: todayIso() }); cov.reload(); } catch (e) { setError(e); } finally { setBusy(null); }
  };
  const c = cov.data;
  return (<>
    <div className="filters" style={{ marginBottom: 12 }}><SectionPicker sections={sections} sectionId={sectionId} setSectionId={setSectionId} /></div>
    {error && <ApiErr error={error} />}
    {cov.loading || !c ? (cov.error ? <ApiErr error={cov.error} /> : <Loading />) : !c.subjects.length ? <ApiNote>No syllabus plan for {c.className} yet. The academic coordinator sets chapters and target dates.</ApiNote>
      : c.subjects.map((s) => (
        <div key={s.subjectId} style={{ marginBottom: 18 }}>
          <SectionHead title={`${s.subjectName} · ${Number(s.completionPercent).toFixed(0)}% taught`}
            sub={`${s.completedTopics} of ${s.totalTopics} chapters · ${Number(s.expectedPercent).toFixed(0)}% expected by ${fmtDate(c.asOf)}${s.nextTopic ? ` · next: ${s.nextTopic}` : ''}`} />
          <div style={{ margin: '8px 0' }}>{pill(lms.COVERAGE, s.status)}</div>
          <DataTable boxed cols={[
            { label: '#', key: 'sequenceNo' },
            { label: 'Chapter', render: (t) => <b style={{ fontWeight: 500 }}>{t.chapterTitle}</b> },
            { label: 'Target', render: (t) => fmtDate(t.plannedCompletionDate) },
            { label: 'Taught', render: (t) => (t.completedOn ? <Pill tone="green">{fmtDate(t.completedOn)}</Pill> : t.overdue ? <Pill tone="amber">Overdue</Pill> : <span className="muted xs">Not yet</span>) },
            { label: 'Action', render: (t) => (!t.completedOn && hasRole(...ROLES.coverage)
              ? <button type="button" className="link" disabled={busy === t.topicId} onClick={() => mark(t.topicId)}>Mark taught today</button> : null) },
          ]} rows={s.topics} />
        </div>
      ))}
  </>);
}

/* ---------- Homework (US-06010, US-06008) ---------- */
/** A teacher sets homework for the subjects they teach in the class; others (class teacher, super admin) for any subject. */
const ownFirst = (rows, me) => (rows.some((a) => a.teacherId === me) ? rows.filter((a) => a.teacherId === me) : rows);
function HomeworkTab({ sections, sectionId, setSectionId, allocations }) {
  const { user, hasRole } = useAuth();
  const list = useApi(() => lms.listHomework(sectionId), [sectionId], !!sectionId);
  const [setting, setSetting] = useState(false);
  const [open, setOpen] = useState(null);
  useEffect(() => setOpen(null), [sectionId]);
  return (<>
    <div className="row" style={{ gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
      <SectionPicker sections={sections} sectionId={sectionId} setSectionId={setSectionId} />
      <span style={{ marginLeft: 'auto' }} />
      {hasRole(...ROLES.setHomework) && <button className="btn primary" onClick={() => setSetting(true)}><Plus size={14} />Set homework</button>}
    </div>
    {list.error ? <ApiErr error={list.error} /> : list.loading || !list.data ? <Loading /> : !list.data.length ? <ApiNote>No homework set for this class yet.</ApiNote> : (
      <DataTable boxed cols={[
        { label: 'Homework', render: (h) => <span className="cell-id"><b>{h.title}</b><small>{h.subjectName} · {h.teacherName}</small></span> },
        { label: 'Due', render: (h) => when(h.dueAt) },
        { label: 'Handed in', render: (h) => `${h.submitted} / ${h.studentsInSection}` },
        { label: 'Marked', className: 'num', key: 'evaluated' },
        { label: 'Missing', render: (h) => (h.missing ? <Pill tone={new Date(h.dueAt) < new Date() ? 'amber' : ''}>{h.missing}</Pill> : <Pill tone="green">0</Pill>) },
        { label: 'Action', render: (h) => <button type="button" className="link" onClick={() => setOpen(open === h.homeworkId ? null : h.homeworkId)}>{open === h.homeworkId ? 'Hide' : 'Submissions'}</button> },
      ]} rows={list.data} />
    )}
    {open && <div style={{ marginTop: 16 }}><Roster homeworkId={open} onChanged={list.reload} /></div>}
    {setting && <HomeworkModal sectionId={sectionId} className={sections.find(([id]) => id === sectionId)?.[1]}
      subjects={ownFirst(allocations.filter((a) => a.sectionId === sectionId), user.userId)} onClose={() => setSetting(false)} onSaved={list.reload} />}
  </>);
}

function Roster({ homeworkId, onChanged }) {
  const { hasRole } = useAuth();
  const roster = useApi(() => lms.homeworkRoster(homeworkId), [homeworkId]);
  const [marking, setMarking] = useState(null);
  if (roster.error) return <ApiErr error={roster.error} />;
  if (roster.loading || !roster.data) return <Loading />;
  const { homework: h, rows } = roster.data;
  const tone = { EVALUATED: 'green', SUBMITTED: 'purple', LATE: 'amber', MISSING: '' };
  return (<>
    <SectionHead title={h.title} sub={`${h.className} · ${h.subjectName} · out of ${h.maxMarks ?? '—'}`} />
    <div style={{ marginTop: 10 }}><DataTable boxed cols={[
      { label: 'Roll', render: (r) => r.rollNumber ?? '—' },
      { label: 'Student', render: (r) => <b style={{ fontWeight: 500 }}>{r.studentName}</b> },
      { label: 'Status', render: (r) => <Pill tone={tone[r.state]}>{r.state === 'MISSING' ? 'Not handed in' : r.state[0] + r.state.slice(1).toLowerCase()}</Pill> },
      { label: 'Handed in', render: (r) => when(r.submission?.submittedAt) },
      { label: 'Marks', render: (r) => (r.submission?.marksAwarded != null ? `${Number(r.submission.marksAwarded)} / ${r.submission.maxMarks ?? '—'}` : '—') },
      { label: 'Action', render: (r) => (r.submission && hasRole(...ROLES.evaluate)
        ? <button type="button" className="link" onClick={() => setMarking(r.submission)}>{r.state === 'EVALUATED' ? 'Edit marks' : 'Evaluate'}</button> : null) },
    ]} rows={rows} /></div>
    {marking && <EvaluateModal sub={marking} onClose={() => setMarking(null)} onSaved={() => { roster.reload(); onChanged(); }} />}
  </>);
}

function EvaluateModal({ sub, onClose, onSaved }) {
  const [marks, setMarks] = useState(sub.marksAwarded ?? '');
  const [feedback, setFeedback] = useState(sub.feedback || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const save = async () => {
    setBusy(true); setError(null);
    try { await lms.evaluateSubmission(sub.submissionId, { marksAwarded: marks === '' ? null : Number(marks), feedback: feedback.trim() || undefined }); onSaved(); onClose(); } catch (e) { setError(e); } finally { setBusy(false); }
  };
  return (
    <Modal title="Evaluate homework" sub={`${sub.studentName}${sub.late ? ' · handed in late' : ''}`} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy} onClick={save}>{busy && <LoaderCircle size={14} className="spin" />}Save evaluation</button></>}>
      {sub.submissionText && <p className="body-s" style={{ marginBottom: 10, whiteSpace: 'pre-wrap' }}>{sub.submissionText}</p>}
      <div className="field box"><label htmlFor="ev-marks">MARKS{sub.maxMarks ? ` (OUT OF ${sub.maxMarks})` : ''}</label>
        <input id="ev-marks" type="number" min="0" max={sub.maxMarks || undefined} step="0.5" value={marks} onChange={(e) => setMarks(e.target.value)} /></div>
      <div className="field box"><label htmlFor="ev-feedback">FEEDBACK</label>
        <textarea id="ev-feedback" rows={3} maxLength={2000} value={feedback} onChange={(e) => setFeedback(e.target.value)} /></div>
      {error && <ApiErr error={error} />}
    </Modal>
  );
}

function HomeworkModal({ sectionId, className, subjects, onClose, onSaved }) {
  const [subjectId, setSubjectId] = useState(subjects[0]?.subjectId || '');
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [due, setDue] = useState(() => `${isoPlus(todayIso(), 2)}T09:00`);
  const [maxMarks, setMaxMarks] = useState('10');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const save = async () => {
    setBusy(true); setError(null);
    try {
      await lms.createHomework({ sectionId, subjectId, title: title.trim(), instructions: instructions.trim() || undefined,
        dueAt: new Date(due).toISOString(), maxMarks: Number(maxMarks) });
      onSaved(); onClose();
    } catch (e) { setError(e); } finally { setBusy(false); }
  };
  return (
    <Modal title="Set homework" sub={className} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy || !subjectId || !title.trim() || !due || !maxMarks} onClick={save}>{busy ? <LoaderCircle size={14} className="spin" /> : <Send size={14} />}Publish</button></>}>
      <div className="field box"><label htmlFor="hw-subject">SUBJECT *</label>
        <select id="hw-subject" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
          {subjects.map((a) => <option key={a.subjectId} value={a.subjectId}>{a.subjectName}</option>)}
        </select></div>
      <div className="field box"><label htmlFor="hw-title">TITLE *</label><input id="hw-title" maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} /></div>
      <div className="field box"><label htmlFor="hw-instructions">INSTRUCTIONS</label><textarea id="hw-instructions" rows={3} maxLength={4000} value={instructions} onChange={(e) => setInstructions(e.target.value)} /></div>
      <div className="field box"><label htmlFor="hw-due">DUE *</label><input id="hw-due" type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} /></div>
      <div className="field box"><label htmlFor="hw-max">MAX MARKS *</label><input id="hw-max" type="number" min="1" max="100" value={maxMarks} onChange={(e) => setMaxMarks(e.target.value)} /></div>
      {error && <ApiErr error={error} />}
    </Modal>
  );
}

/* ---------- Lesson plans (US-06013) ---------- */
function LessonPlansTab({ allocations }) {
  const { user, hasRole } = useAuth();
  const reviewer = hasRole(...ROLES.reviewPlan);
  const writer = hasRole(...ROLES.writePlan);
  // Reviewers start on the plans waiting for them; teachers on their own plans
  const [status, setStatus] = useState(reviewer ? 'SUBMITTED' : '');
  const plans = useApi(() => lms.listLessonPlans({ status, teacherId: reviewer ? undefined : user.userId }), [status, reviewer, user.userId]);
  const from = mondayOf(todayIso());
  const compliance = useApi(() => lms.lessonPlanCompliance(from, isoPlus(from, 5)), [from], reviewer);
  const [writing, setWriting] = useState(false);
  const [reviewing, setReviewing] = useState(null);
  const [error, setError] = useState(null);
  const submit = async (p) => { setError(null); try { await lms.submitLessonPlan(p.lessonPlanId); plans.reload(); } catch (e) { setError(e); } };
  const mine = allocations.filter((a) => a.teacherId === user.userId);
  return (<>
    <div className="row" style={{ gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
      <Picker label="Status" value={status} onChange={setStatus} empty="All statuses" options={Object.entries(lms.PLAN_STATUS).map(([k, [t]]) => [k, t])} />
      <span style={{ marginLeft: 'auto' }} />
      {writer && <button className="btn primary" disabled={!mine.length && !hasRole('SUPER_ADMIN')} title={mine.length ? undefined : 'You have no classes allocated'} onClick={() => setWriting(true)}><Plus size={14} />New lesson plan</button>}
    </div>
    {error && <ApiErr error={error} />}
    {plans.error ? <ApiErr error={plans.error} /> : plans.loading || !plans.data ? <Loading /> : !plans.data.length ? <ApiNote>No lesson plans{status ? ` with status “${lms.PLAN_STATUS[status][0]}”` : ''}.</ApiNote> : (
      <DataTable boxed cols={[
        { label: 'Date', render: (p) => fmtDate(p.planDate) },
        { label: 'Class · subject', render: (p) => <span className="cell-id"><b>{p.className} · {p.subjectCode}</b><small>{p.teacherName}{p.chapterTitle ? ` · ${p.chapterTitle}` : ''}</small></span> },
        { label: 'Objectives', render: (p) => <small className="xs">{p.objectives || '—'}</small> },
        { label: 'Status', render: (p) => <>{pill(lms.PLAN_STATUS, p.status)}{p.reviewRemarks && <small className="xs muted"> {p.reviewRemarks}</small>}</> },
        { label: 'Action', render: (p) => (p.status === 'SUBMITTED' && reviewer
          ? <span className="act"><button type="button" className="link" onClick={() => setReviewing({ p, decision: 'APPROVED' })}>Approve</button>
              <button type="button" className="link" onClick={() => setReviewing({ p, decision: 'RETURNED' })}>Return</button></span>
          : (p.status === 'DRAFT' || p.status === 'RETURNED') && p.teacherId === user.userId ? <button type="button" className="link" onClick={() => submit(p)}>Submit</button> : null) },
      ]} rows={plans.data} />
    )}
    {reviewer && (
      <div style={{ marginTop: 18 }}>
        <SectionHead title="Submission compliance" sub={`This week · ${fmtDate(from)} – ${fmtDate(isoPlus(from, 5))}`} />
        <div style={{ marginTop: 10 }}>
          {compliance.error ? <ApiErr error={compliance.error} /> : compliance.loading || !compliance.data ? <Loading /> : (
            <DataTable boxed cols={[
              { label: 'Teacher', key: 'teacherName' },
              { label: 'Teaching days', className: 'num', key: 'teachingDays' },
              { label: 'Submitted', className: 'num', key: 'plansSubmitted' },
              { label: 'Approved', className: 'num', key: 'approved' },
              { label: 'Waiting', className: 'num', key: 'pendingReview' },
              { label: 'Missing days', className: 'num', key: 'missingDays' },
              { label: 'Compliance', render: (c) => (!c.teachingDays ? <span className="muted xs">No classes</span> : <Pill tone={Number(c.compliancePercent) >= 80 ? 'green' : 'amber'}>{Number(c.compliancePercent).toFixed(0)}%</Pill>) },
            ]} rows={compliance.data.teachers} />
          )}
        </div>
      </div>
    )}
    {writing && <LessonPlanModal allocations={mine.length ? mine : allocations} onClose={() => setWriting(false)} onSaved={plans.reload} />}
    {reviewing && <ReviewModal {...reviewing} onClose={() => setReviewing(null)} onSaved={plans.reload} />}
  </>);
}

function LessonPlanModal({ allocations, onClose, onSaved }) {
  const [allocationId, setAllocationId] = useState(allocations[0]?.allocationId || '');
  const [planDate, setPlanDate] = useState(nextSchoolDay);
  const [objectives, setObjectives] = useState('');
  const [activities, setActivities] = useState('');
  const [assessment, setAssessment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const a = allocations.find((x) => x.allocationId === allocationId);
  const save = async (submit) => {
    setBusy(true); setError(null);
    try {
      await lms.createLessonPlan({ sectionId: a.sectionId, subjectId: a.subjectId, planDate, objectives: objectives.trim() || undefined,
        activities: activities.trim() || undefined, assessment: assessment.trim() || undefined, submit });
      onSaved(); onClose();
    } catch (e) { setError(e); } finally { setBusy(false); }
  };
  return (
    <Modal title="New lesson plan" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn" disabled={busy || !a} onClick={() => save(false)}>Save draft</button>
        <button className="btn primary" disabled={busy || !a || !objectives.trim()} onClick={() => save(true)}>{busy ? <LoaderCircle size={14} className="spin" /> : <Send size={14} />}Submit for review</button></>}>
      <div className="field box"><label htmlFor="lp-class">CLASS · SUBJECT *</label>
        <select id="lp-class" value={allocationId} onChange={(e) => setAllocationId(e.target.value)}>
          {allocations.map((x) => <option key={x.allocationId} value={x.allocationId}>{x.className} · {x.subjectName}</option>)}
        </select></div>
      <div className="field box"><label htmlFor="lp-date">DATE *</label><input id="lp-date" type="date" value={planDate} onChange={(e) => setPlanDate(e.target.value)} /></div>
      <div className="field box"><label htmlFor="lp-obj">OBJECTIVES</label><textarea id="lp-obj" rows={2} maxLength={2000} value={objectives} onChange={(e) => setObjectives(e.target.value)} /></div>
      <div className="field box"><label htmlFor="lp-act">ACTIVITIES</label><textarea id="lp-act" rows={3} maxLength={4000} value={activities} onChange={(e) => setActivities(e.target.value)} /></div>
      <div className="field box"><label htmlFor="lp-ass">ASSESSMENT</label><textarea id="lp-ass" rows={2} maxLength={2000} value={assessment} onChange={(e) => setAssessment(e.target.value)} /></div>
      {error && <ApiErr error={error} />}
    </Modal>
  );
}

function ReviewModal({ p, decision, onClose, onSaved }) {
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const approve = decision === 'APPROVED';
  const save = async () => {
    setBusy(true); setError(null);
    try { await lms.reviewLessonPlan(p.lessonPlanId, { decision, remarks: remarks.trim() || undefined }); onSaved(); onClose(); } catch (e) { setError(e); } finally { setBusy(false); }
  };
  return (
    <Modal title={approve ? 'Approve lesson plan' : 'Return lesson plan'} sub={`${p.teacherName} · ${p.className} · ${fmtDate(p.planDate)}`} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy || (!approve && !remarks.trim())} onClick={save}>{busy && <LoaderCircle size={14} className="spin" />}{approve ? 'Approve' : 'Return'}</button></>}>
      {p.objectives && <p className="body-s" style={{ marginBottom: 6 }}><b>Objectives:</b> {p.objectives}</p>}
      {p.activities && <p className="body-s" style={{ marginBottom: 10 }}><b>Activities:</b> {p.activities}</p>}
      <div className="field box"><label htmlFor="rv-remarks">REMARKS{approve ? '' : ' *'}</label><input id="rv-remarks" maxLength={500} value={remarks} onChange={(e) => setRemarks(e.target.value)} /></div>
      {error && <ApiErr error={error} />}
    </Modal>
  );
}

/* ---------- Labs (US-06011) ---------- */
function LabsTab({ sections }) {
  const { user, hasRole } = useAuth();
  const rooms = useApi(() => lms.listLabs(), []);
  const [roomId, setRoomId] = useState('');
  useEffect(() => { if (!roomId && rooms.data?.length) setRoomId(rooms.data[0].roomId); }, [rooms.data, roomId]);
  const from = todayIso();
  const to = isoPlus(from, 13);
  const res = useApi(() => lms.labReservations(roomId, from, to), [roomId, from], !!roomId);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState(null);
  const can = hasRole(...ROLES.bookLab);
  const cancel = async (r) => { setError(null); try { await lms.cancelReservation(r.reservationId, 'Cancelled from the timetable screen'); res.reload(); } catch (e) { setError(e); } };
  if (rooms.error) return <ApiErr error={rooms.error} />;
  if (rooms.loading || !rooms.data) return <Loading />;
  if (!rooms.data.length) return <ApiNote>No lab rooms are registered for this campus.</ApiNote>;
  const room = rooms.data.find((r) => r.roomId === roomId);
  return (<>
    <div className="row" style={{ gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
      <Picker label="Room" value={roomId} onChange={setRoomId} options={rooms.data.map((r) => [r.roomId, `${r.roomName} · ${lms.ROOM_TYPE[r.roomType] || r.roomType}`])} />
      <span className="xs muted">{room ? `Seats ${room.capacity} · bookings ${fmtDate(from)} – ${fmtDate(to)}` : ''}</span>
      <span style={{ marginLeft: 'auto' }} />
      {can && <button className="btn primary" disabled={!room} onClick={() => setBooking(true)}><CalendarPlus size={14} />Book slot</button>}
    </div>
    {error && <ApiErr error={error} />}
    {res.error ? <ApiErr error={res.error} /> : res.loading || !res.data ? <Loading /> : !res.data.length ? <ApiNote>No bookings in the next two weeks.</ApiNote> : (
      <DataTable boxed cols={[
        { label: 'When', render: (r) => <span className="cell-id"><b>{fmtDate(r.reservationDate)}</b><small>{hhmm(r.startTime)}–{hhmm(r.endTime)}</small></span> },
        { label: 'Class', render: (r) => r.className || '—' },
        { label: 'Teacher', key: 'teacherName' },
        { label: 'Purpose', render: (r) => <small className="xs">{r.purpose || '—'}</small> },
        { label: 'Status', render: (r) => (r.status === 'BOOKED' ? <Pill tone="green">Booked</Pill> : <Pill>Cancelled</Pill>) },
        { label: 'Action', render: (r) => (r.status === 'BOOKED' && can && (r.teacherId === user.userId || hasRole('ACADEMIC_COORDINATOR', 'TIMETABLE_INCHARGE', 'SUPER_ADMIN'))
          ? <button type="button" className="link" onClick={() => cancel(r)}>Cancel</button> : null) },
      ]} rows={res.data} />
    )}
    {booking && <BookingModal room={room} sections={sections} onClose={() => setBooking(false)} onSaved={res.reload} />}
  </>);
}

function BookingModal({ room, sections, onClose, onSaved }) {
  const [date, setDate] = useState(nextSchoolDay);
  const [start, setStart] = useState('10:00');
  const [end, setEnd] = useState('10:40');
  const [sectionId, setSectionId] = useState('');
  const [purpose, setPurpose] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const save = async () => {
    setBusy(true); setError(null);
    try { await lms.reserveLab(room.roomId, { reservationDate: date, startTime: start, endTime: end, sectionId: sectionId || undefined, purpose: purpose.trim() || undefined }); onSaved(); onClose(); } catch (e) { setError(e); } finally { setBusy(false); }
  };
  return (
    <Modal title="Book lab slot" sub={room.roomName} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy || !date || !start || !end} onClick={save}>{busy && <LoaderCircle size={14} className="spin" />}Book</button></>}>
      <div className="field box"><label htmlFor="lb-date">DATE *</label><input id="lb-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      <div className="field box"><label htmlFor="lb-start">FROM *</label><input id="lb-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} /></div>
      <div className="field box"><label htmlFor="lb-end">TO *</label><input id="lb-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
      <div className="field box"><label htmlFor="lb-class">CLASS</label>
        <select id="lb-class" value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
          <option value="">No class</option>{sections.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select></div>
      <div className="field box"><label htmlFor="lb-purpose">PURPOSE</label><input id="lb-purpose" maxLength={255} value={purpose} onChange={(e) => setPurpose(e.target.value)} /></div>
      {error && <ApiErr error={error} />}
    </Modal>
  );
}
