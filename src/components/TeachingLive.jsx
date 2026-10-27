import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, LoaderCircle, Wand2, UserX, Shuffle, Plus, Check, Send, CalendarPlus } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { useApi } from '../api/useApi.js';
import * as lms from '../api/academicService.js';
import * as hr from '../api/hrService.js';
import { PageHeader, Metrics, scrollToId, Card, Tabs, DataTable, Pill, Footer, SectionHead, downloadFile, todayIso, useTabParam } from './ui.jsx';
import { Modal } from './AuthSettings.jsx';
import { ApiErr, ApiNote } from './Admissions.jsx';
import { formatDate, formatDateTime, formatTime, formatNumber } from '../regional.js';

const { ROLES, DAYS, hhmm } = lms;
const Loading = () => <p className="xs muted"><LoaderCircle size={12} className="spin" /> Loading…</p>;
const TABS = ['Timetable', 'Allocations', 'Workload', 'Cover', 'Syllabus', 'Homework', 'Lesson plans', 'Labs'];
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
  const classes = useApi(() => lms.listClasses(), []);
  const [tab, setTab] = useTabParam(TABS);
  const [sectionId, setSectionId] = useState('');
  const [generating, setGenerating] = useState(false);
  const [pdf, setPdf] = useState(null);

  const schedule = (schedules.data || []).find((s) => s.active) || schedules.data?.[0];
  // Every class of the school in grade order (academicservice); only those with subject allocations can be timetabled
  const sections = useMemo(() => (classes.data || []).map((c) => [c.sectionId, c.className]), [classes.data]);
  const allocated = useMemo(() => (classes.data || []).filter((c) => c.allocatedSubjects > 0).map((c) => [c.sectionId, c.className]), [classes.data]);
  // Open on the first class that has a timetable, so the page does not start on an empty Nursery grid
  useEffect(() => {
    if (sectionId || !classes.data?.length) return;
    setSectionId((classes.data.find((c) => c.timetabledPeriods > 0) || classes.data.find((c) => c.allocatedSubjects > 0) || classes.data[0]).sectionId);
  }, [classes.data, sectionId]);
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
        ['Teachers', workloads.data ? String(teachers.length) : '…', workloads.data ? `Average load ${avgUse.toFixed(0)}% of weekly cap` : '', null, false, null,
          workloads.data && { onClick: () => { setTab(TABS.indexOf('Workload')); scrollToId('teaching-tabs'); }, hint: 'Open teacher workload', active: TABS[tab] === 'Workload' }],
        ['Classes', classes.data ? `${allocated.length} of ${sections.length}` : '…', 'With subject teachers allocated', null, false, null,
          classes.data && { onClick: () => { setTab(TABS.indexOf('Allocations')); scrollToId('teaching-tabs'); }, hint: 'Open class allocations', active: TABS[tab] === 'Allocations' }],
        [`Cover · ${t ? fmtDate(t.date) : '…'}`, t ? `${t.assigned} / ${t.periodsToCover}` : '…', t ? (t.periodsToCover ? `${t.absentTeachers} absent · ${t.uncovered} not covered` : 'No absences recorded') : '', null, false, null,
          t && { onClick: () => { setTab(TABS.indexOf('Cover')); scrollToId('teaching-tabs'); }, hint: 'Open cover and substitutions', active: TABS[tab] === 'Cover' }],
      ]} />
      <Card id="teaching-tabs">
        <Tabs items={TABS} value={tab} onChange={setTab} />
        <div style={{ marginTop: 16 }}>
          {schedules.error || classes.error ? <ApiErr error={schedules.error || classes.error} />
            : TABS[tab] === 'Timetable' ? <TimetableTab sections={sections} allocated={allocated} sectionId={sectionId} setSectionId={setSectionId} teachers={teachers} schedule={schedule} me={user.userId} />
              : TABS[tab] === 'Allocations' ? <AllocationsTab classes={classes.data || []} sectionId={sectionId} setSectionId={setSectionId} teachers={teachers} schedule={schedule}
                onChanged={() => { classes.reload(); allocations.reload(); workloads.reload(); }} />
              : TABS[tab] === 'Workload' ? <WorkloadTab workloads={workloads} canManage={hasRole(...ROLES.allocate)} />
                : TABS[tab] === 'Cover' ? <CoverTab teachers={teachers} onChanged={today.reload} />
                  : TABS[tab] === 'Syllabus' ? <SyllabusTab sections={sections} classes={classes.data || []} sectionId={sectionId} setSectionId={setSectionId} />
                    : TABS[tab] === 'Homework' ? <HomeworkTab sections={sections} sectionId={sectionId} setSectionId={setSectionId} allocations={allocations.data || []} />
                      : TABS[tab] === 'Lesson plans' ? <LessonPlansTab allocations={allocations.data || []} />
                        : <LabsTab sections={sections} />}
        </div>
      </Card>
      {generating && <GenerateModal schedule={schedule} classes={classes.data || []} onClose={() => setGenerating(false)} onDone={() => { workloads.reload(); today.reload(); classes.reload(); }} />}
      <Footer />
    </>
  );
}

// Two dropdowns, grade then section ("Class 6" then "C"), so a long list of class-sections is not one long menu.
// `sections` is [sectionId, "Grade-Section"] pairs, e.g. ["…", "Class 6-C"].
const SectionPicker = ({ sections, sectionId, setSectionId }) => {
  const parsed = sections.map(([id, label]) => { const i = label.lastIndexOf('-'); return { id, grade: label.slice(0, i), section: label.slice(i + 1) }; });
  const current = parsed.find((p) => p.id === sectionId) || parsed[0];
  const grades = [...new Set(parsed.map((p) => p.grade))];
  const inGrade = parsed.filter((p) => p.grade === current?.grade);
  return (<>
    <Picker label="Grade" value={current?.grade || ''} onChange={(g) => setSectionId(parsed.find((p) => p.grade === g)?.id)} options={grades.map((g) => [g, g])} />
    <Picker label="Section" value={current?.id || ''} onChange={setSectionId} options={inGrade.map((p) => [p.id, p.section])} />
  </>);
};

/* ---------- Timetable (US-06002) ---------- */
function TimetableTab({ sections, allocated, sectionId, setSectionId, teachers, schedule, me }) {
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
      {!d.entries.length && mode === 'class' && !allocated.some(([id]) => id === sectionId)
        ? <ApiNote>No subject teachers are allocated to {d.className} yet, so there is nothing to timetable.</ApiNote>
        : !d.entries.length ? <ApiNote>No timetable yet. The timetable in-charge generates it with <b>Generate timetables</b>.</ApiNote>
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

function GenerateModal({ schedule, classes, onClose, onDone }) {
  // Every class, by grade; only classes with subject allocations have periods to place
  const ready = classes.filter((c) => c.allocatedSubjects > 0);
  const byGrade = useMemo(() => {
    const m = new Map();
    classes.forEach((c) => m.set(c.gradeId, [...(m.get(c.gradeId) || []), c]));
    return [...m.values()];
  }, [classes]);
  // Section letters across the school (A, B, C, D, E), the matrix's columns
  const letters = useMemo(() => [...new Set(classes.map((c) => c.sectionName))].sort(), [classes]);
  const [picked, setPicked] = useState(() => ready.map((c) => c.sectionId));
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
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
          <span className="xs muted">{ready.length} of {classes.length} classes have subject teachers allocated · <b>{picked.length} selected</b></span>
          <button type="button" className="btn" disabled={!ready.length} onClick={() => setPicked(ready.map((c) => c.sectionId))}>Select all ready</button>
          <button type="button" className="btn" disabled={!picked.length} onClick={() => setPicked([])}>Clear</button>
        </div>
        {!!picked.length && (
          <p className="body-s" style={{ marginBottom: 10 }}>
            <b>Selected:</b> {byGrade.map((group) => {
              const names = group.filter((c) => picked.includes(c.sectionId)).map((c) => c.sectionName);
              return names.length ? `${group[0].gradeName}: ${names.join(', ')}` : null;
            }).filter(Boolean).join(' · ')}
          </p>
        )}
        {/* One row per grade, one column per section: every class is visible at once, without scrolling */}
        <div className="gmatrix" role="group" aria-label="Classes by grade and section">
          <div className="gm-row gm-head" aria-hidden="true">
            <span>Grade</span>{letters.map((l) => <span key={l}>{l}</span>)}<span />
          </div>
          {byGrade.map((group) => {
            const readyIds = group.filter((c) => c.allocatedSubjects > 0).map((c) => c.sectionId);
            const allOn = readyIds.length > 0 && readyIds.every((id) => picked.includes(id));
            const toggleGrade = () => setPicked((p) => (allOn ? p.filter((id) => !readyIds.includes(id)) : [...new Set([...p, ...readyIds])]));
            return (
              <div key={group[0].gradeId} className="gm-row">
                <span className="gm-grade">{group[0].gradeName}<small className="muted">{readyIds.length}/{group.length}</small></span>
                {letters.map((letter) => {
                  const c = group.find((x) => x.sectionName === letter);
                  if (!c) return <span key={letter} />;
                  const ok = c.allocatedSubjects > 0;
                  const on = picked.includes(c.sectionId);
                  return (
                    <label key={letter} className={`gm-cell${on ? ' on' : ''}${ok ? '' : ' off'}`}
                      title={ok ? `${c.allocatedSubjects} subjects · ${c.allocatedPeriodsPerWeek} periods a week` : 'No subject teachers allocated yet'}>
                      <input type="checkbox" disabled={!ok} checked={on} onChange={() => toggle(c.sectionId)} />
                      <span>{letter}</span>
                      {ok && <small>{c.allocatedPeriodsPerWeek}p</small>}
                    </label>
                  );
                })}
                <button type="button" className="link gm-all" disabled={!readyIds.length} onClick={toggleGrade}>{allOn ? 'Clear' : 'All ready'}</button>
              </div>
            );
          })}
        </div>
        {ready.length < classes.length && <p className="xs muted" style={{ marginTop: 8 }}>Greyed-out classes have no subject teachers allocated, so there is nothing to place yet.</p>}
        {error && <div style={{ marginTop: 10 }}><ApiErr error={error} /></div>}
      </>)}
    </Modal>
  );
}

/* ---------- Workload (US-06001) ---------- */
function WorkloadTab({ workloads, canManage }) {
  const [editing, setEditing] = useState(null); // {} = a new teacher, or the workload being changed
  const subjects = useApi(() => lms.listSubjects(), []);
  if (workloads.error) return <ApiErr error={workloads.error} />;
  if (workloads.loading || !workloads.data) return <Loading />;
  return (<>
    {canManage && (
      <div className="filters" style={{ marginBottom: 12, justifyContent: 'flex-end' }}>
        <button className="btn primary" onClick={() => setEditing({})}><Plus size={14} />Add teacher workload</button>
      </div>
    )}
    <DataTable boxed cols={[
      { label: 'Teacher', render: (w) => <span className="cell-id"><b>{w.teacherName}</b><small>{w.qualifiedSubjectCodes.join(', ') || 'Any subject'}</small></span> },
      { label: 'Allocated', className: 'num', render: (w) => `${w.allocatedPeriods} / ${w.weeklyMaxPeriods}` },
      { label: 'Timetabled', className: 'num', key: 'timetabledPeriods' },
      { label: 'Daily cap', className: 'num', key: 'dailyMaxPeriods' },
      { label: 'Load', render: (w) => <Pill tone={Number(w.utilisationPercent) > 90 ? 'amber' : Number(w.utilisationPercent) ? 'green' : ''}>{Number(w.utilisationPercent).toFixed(0)}%</Pill> },
      { label: 'Classes', render: (w) => <small className="xs">{w.allocations.map((a) => `${a.className} ${a.subjectCode} ×${a.periodsPerWeek}`).join(' · ') || '—'}</small> },
      ...(canManage ? [{ label: '', render: (w) => <button type="button" className="link" onClick={() => setEditing(w)}>Edit caps</button> }] : []),
    ]} rows={workloads.data.slice().sort((a, b) => a.teacherName.localeCompare(b.teacherName))} />
    <p className="xs muted" style={{ marginTop: 10 }}>Caps and subjects are set here; classes are allocated under <b>Allocations</b>.</p>
    {editing && (
      <WorkloadModal workload={editing.teacherId ? editing : null} takenIds={workloads.data.map((w) => w.teacherId)} subjects={subjects.data || []}
        onClose={() => setEditing(null)} onSaved={() => { setEditing(null); workloads.reload(); }} />
    )}
  </>);
}

/** Add a teacher to the workload list, or change an existing teacher's caps and subjects. */
function WorkloadModal({ workload, takenIds, subjects, onClose, onSaved }) {
  const { user } = useAuth();
  const staff = useApi(() => hr.listEmployees({}), [], !workload);
  // Teachers are staff with a sign-in account who do not have a workload yet
  const people = (staff.data || []).filter((p) => p.userId && !takenIds.includes(p.userId)
    && !['RESIGNED', 'RETIRED', 'TERMINATED'].includes(p.employmentStatus));
  const [teacherId, setTeacherId] = useState(workload?.teacherId || '');
  const [weekly, setWeekly] = useState(workload ? String(workload.weeklyMaxPeriods) : '30');
  const [daily, setDaily] = useState(workload ? String(workload.dailyMaxPeriods) : '6');
  const [codes, setCodes] = useState(workload?.qualifiedSubjectCodes || []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const person = people.find((p) => p.userId === teacherId);
  const teacherName = workload ? workload.teacherName : person ? `${person.firstName} ${person.lastName}` : '';
  const weeklyOk = Number(weekly) >= 1 && Number(weekly) <= 60;
  const dailyOk = Number(daily) >= 1 && Number(daily) <= 12 && Number(daily) <= Number(weekly);
  const valid = !!teacherId && weeklyOk && dailyOk;
  const toggle = (code) => setCodes((c) => (c.includes(code) ? c.filter((x) => x !== code) : [...c, code]));
  const save = async () => {
    setBusy(true); setError(null);
    try {
      await lms.saveWorkload({
        teacherId, teacherName, branchId: workload?.branchId || person?.branchId || user.branchId,
        weeklyMaxPeriods: Number(weekly), dailyMaxPeriods: Number(daily), qualifiedSubjectCodes: codes,
      });
      onSaved();
    } catch (e) { setError(e); } finally { setBusy(false); }
  };
  return (
    <Modal title={workload ? 'Edit workload' : 'Add teacher workload'} sub={teacherName || 'Choose a teacher'} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={busy || !valid} onClick={save}>{busy && <LoaderCircle size={14} className="spin" />}Save workload</button></>}>
      {!workload && (
        <div className="field box" style={{ marginBottom: 12 }}><label htmlFor="wl-teacher">TEACHER *</label>
          <select id="wl-teacher" value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
            <option value="">{staff.loading ? 'Loading staff…' : people.length ? 'Select teacher' : 'Every staff member already has a workload'}</option>
            {people.map((p) => <option key={p.userId} value={p.userId}>{p.firstName} {p.lastName} · {p.designation}</option>)}
          </select></div>
      )}
      <div className="fieldgrid" style={{ marginBottom: 12 }}>
        <div className="field box"><label htmlFor="wl-weekly">WEEKLY CAP *</label>
          <input id="wl-weekly" type="number" min={1} max={60} value={weekly} onChange={(e) => setWeekly(e.target.value)} /></div>
        <div className="field box"><label htmlFor="wl-daily">DAILY CAP *</label>
          <input id="wl-daily" type="number" min={1} max={12} value={daily} onChange={(e) => setDaily(e.target.value)} /></div>
      </div>
      {!dailyOk && <p className="xs muted" style={{ marginBottom: 10 }}>Daily cap must be between 1 and 12, and no more than the weekly cap.</p>}
      <p className="xs" style={{ marginBottom: 6 }}><b>Subjects the teacher can take</b></p>
      <p className="xs muted" style={{ marginBottom: 8 }}>With none selected, the teacher is offered for any subject.</p>
      <div className="genchips-matrix">
        {subjects.map((s) => {
          const on = codes.includes(s.subjectCode);
          return (
            <label key={s.subjectId} className={`gm-cell${on ? ' on' : ''}`}>
              <input type="checkbox" checked={on} onChange={() => toggle(s.subjectCode)} />
              <span>{s.subjectName}</span>
            </label>
          );
        })}
      </div>
      {error && <div style={{ marginTop: 10 }}><ApiErr error={error} /></div>}
    </Modal>
  );
}

/* ---------- Allocations (US-06001): which teacher teaches which subject to a class, and how often ---------- */
function AllocationsTab({ classes, sectionId, setSectionId, teachers, schedule, onChanged }) {
  const { hasRole } = useAuth();
  const can = hasRole(...ROLES.allocate);
  const list = useApi(() => lms.listAllocations(sectionId), [sectionId], !!sectionId);
  const subjects = useApi(() => lms.listSubjects(), []);
  const [editing, setEditing] = useState(null); // {} = new, or the allocation being changed
  const [removing, setRemoving] = useState(null);
  const [error, setError] = useState(null);
  const [msg, setMsg] = useState(null);
  useEffect(() => { setMsg(null); setError(null); }, [sectionId]);
  const cls = classes.find((c) => c.sectionId === sectionId);
  const rows = (list.data || []).slice().sort((a, b) => a.subjectCode.localeCompare(b.subjectCode));
  const total = rows.reduce((n, a) => n + a.periodsPerWeek, 0);
  const capacity = schedule?.teachingPeriodsPerWeek;
  const refresh = (text) => { setMsg(text); list.reload(); onChanged(); };
  // Confirmed in the app's own dialog: native confirm() boxes can be suppressed in the desktop app, which made Remove do nothing
  const [toRemove, setToRemove] = useState(null);
  const remove = async () => {
    const a = toRemove;
    setRemoving(a.allocationId); setError(null);
    try { await lms.deleteAllocation(a.allocationId); setToRemove(null); refresh(`${a.subjectName} removed from ${a.className}.`); }
    catch (e) { setToRemove(null); setError(e); }
    finally { setRemoving(null); }
  };
  return (<>
    <div className="filters" style={{ marginBottom: 12 }}>
      <SectionPicker sections={classes.map((c) => [c.sectionId, c.className])} sectionId={sectionId} setSectionId={setSectionId} />
      {can && <button className="btn primary" style={{ marginLeft: 'auto' }} disabled={!sectionId || !subjects.data} onClick={() => setEditing({})}><Plus size={14} />Allocate subject</button>}
    </div>
    {cls && <p className="xs muted" style={{ marginBottom: 10 }}>
      {cls.className} · {plural(rows.length, 'subject')} · {total}{capacity ? ` of ${capacity}` : ''} periods a week allocated · {cls.timetabledPeriods} timetabled
    </p>}
    {capacity && total > capacity && <ApiNote>{cls?.className} has more periods allocated ({total}) than the bell schedule has in a week ({capacity}); the generator will leave some unplaced.</ApiNote>}
    {msg && <Ok>{msg}{cls && total !== cls.timetabledPeriods ? <> Run <b>Generate timetables</b> to rebuild the class's week.</> : null}</Ok>}
    {error && <div style={{ marginBottom: 12 }}><ApiErr error={error} /></div>}
    {/* Only the first load shows the placeholder; a reload after a change keeps the table on screen (dimmed) so the page does not flicker */}
    {list.error ? <ApiErr error={list.error} /> : !list.data ? <Loading />
      : !rows.length ? <ApiNote>No subject teachers are allocated to {cls?.className || 'this class'} yet.{can ? <> Use <b>Allocate subject</b> to add the first.</> : ' The timetable in-charge allocates them.'}</ApiNote>
        : <div aria-busy={list.loading} style={{ opacity: list.loading ? 0.6 : 1, transition: 'opacity 150ms ease' }}><DataTable boxed cols={[
          { label: 'Subject', render: (a) => <span className="cell-id"><b>{a.subjectName}</b><small>{a.subjectCode}</small></span> },
          { label: 'Teacher', key: 'teacherName' },
          { label: 'Periods a week', className: 'num', key: 'periodsPerWeek' },
          ...(can ? [{ label: '', render: (a) => (
            <span style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setEditing(a)}>Change</button>
              <button className="btn" disabled={removing === a.allocationId} onClick={() => setToRemove(a)}>{removing === a.allocationId && <LoaderCircle size={14} className="spin" />}Remove</button>
            </span>) }] : []),
        ]} rows={rows} /></div>}
    {toRemove && (
      <Modal title="Remove subject" sub={toRemove.className} onClose={() => setToRemove(null)}
        footer={<><button className="btn" onClick={() => setToRemove(null)}>Cancel</button>
          <button className="btn danger" disabled={!!removing} onClick={remove}>{removing && <LoaderCircle size={14} className="spin" />}Remove</button></>}>
        <p className="body-s">Remove <b>{toRemove.subjectName}</b> ({toRemove.teacherName}) from {toRemove.className}? Its periods stay in the current timetable until it is generated again.</p>
      </Modal>
    )}
    {editing && <AllocationModal cls={cls} allocation={editing.allocationId ? editing : null} subjects={subjects.data || []} taken={rows} teachers={teachers}
      onClose={() => setEditing(null)} onSaved={(a, isNew) => refresh(`${a.subjectName}: ${a.teacherName}, ${plural(a.periodsPerWeek, 'period')} a week ${isNew ? 'allocated to' : 'saved for'} ${a.className}.`)} />}
  </>);
}

function AllocationModal({ cls, allocation, subjects, taken, teachers, onClose, onSaved }) {
  const free = subjects.filter((s) => !taken.some((a) => a.subjectId === s.subjectId));
  const [subjectId, setSubjectId] = useState(allocation?.subjectId || free[0]?.subjectId || '');
  const [teacherId, setTeacherId] = useState(allocation?.teacherId || '');
  const [periods, setPeriods] = useState(String(allocation?.periodsPerWeek || 5));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const subject = subjects.find((s) => s.subjectId === subjectId);
  // Teachers qualified for the subject (no listed subjects = any), with the periods they have left under their weekly cap
  const options = teachers.filter((t) => !t.qualifiedSubjectCodes.length || t.qualifiedSubjectCodes.includes(subject?.subjectCode)).map((t) => {
    const mine = t.allocations.find((a) => a.allocationId === allocation?.allocationId)?.periodsPerWeek || 0;
    return { ...t, left: t.weeklyMaxPeriods - t.allocatedPeriods + mine };
  });
  useEffect(() => { if (teacherId && !options.some((t) => t.teacherId === teacherId)) setTeacherId(''); }, [subjectId]); // eslint-disable-line react-hooks/exhaustive-deps
  const n = Number(periods);
  const valid = subjectId && teacherId && Number.isInteger(n) && n >= 1 && n <= 12;
  const save = async () => {
    setBusy(true); setError(null);
    try { onSaved(await lms.allocate({ sectionId: cls.sectionId, subjectId, teacherId, periodsPerWeek: n }), !allocation); onClose(); } catch (e) { setError(e); } finally { setBusy(false); }
  };
  return (
    <Modal title={allocation ? 'Change allocation' : 'Allocate subject'} sub={cls?.className} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy || !valid} onClick={save}>{busy && <LoaderCircle size={14} className="spin" />}Save</button></>}>
      <div className="field box"><label htmlFor="al-subject">SUBJECT *</label>
        <select id="al-subject" value={subjectId} disabled={!!allocation} onChange={(e) => setSubjectId(e.target.value)}>
          {!subjectId && <option value="">{free.length ? 'Select subject' : 'Every subject is allocated'}</option>}
          {(allocation ? subjects.filter((s) => s.subjectId === allocation.subjectId) : free).map((s) => <option key={s.subjectId} value={s.subjectId}>{s.subjectName} ({s.subjectCode})</option>)}
        </select></div>
      <div className="field box"><label htmlFor="al-teacher">TEACHER *</label>
        <select id="al-teacher" value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
          <option value="">{options.length ? 'Select teacher' : 'No teacher is qualified for this subject'}</option>
          {options.map((t) => <option key={t.teacherId} value={t.teacherId}>{t.teacherName} · {t.left} of {t.weeklyMaxPeriods} periods free</option>)}
        </select></div>
      <div className="field box"><label htmlFor="al-periods">PERIODS A WEEK *</label>
        <input id="al-periods" type="number" min={1} max={12} value={periods} onChange={(e) => setPeriods(e.target.value)} /></div>
      <p className="xs muted">Only teachers whose workload lists the subject are shown. A teacher's weekly cap is checked when you save.</p>
      {error && <ApiErr error={error} />}
    </Modal>
  );
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
function SyllabusTab({ sections, classes, sectionId, setSectionId }) {
  const { hasRole } = useAuth();
  const cov = useApi(() => lms.coverage(sectionId), [sectionId], !!sectionId);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  // A plan belongs to the grade (every section of the class), set by the academic coordinator
  const [planning, setPlanning] = useState(null); // { subjectId } to open the plan dialog
  const canPlan = hasRole(...ROLES.syllabusPlan);
  const cls = classes.find((x) => x.sectionId === sectionId);
  const mark = async (topicId) => {
    setBusy(topicId); setError(null);
    try { await lms.markCovered(topicId, { sectionId, completedOn: todayIso() }); cov.reload(); } catch (e) { setError(e); } finally { setBusy(null); }
  };
  const c = cov.data;
  return (<>
    <div className="filters" style={{ marginBottom: 12 }}>
      <SectionPicker sections={sections} sectionId={sectionId} setSectionId={setSectionId} />
      {canPlan && cls && <button className="btn primary" style={{ marginLeft: 'auto' }} onClick={() => setPlanning({})}><Plus size={14} />Set syllabus plan</button>}
    </div>
    {error && <ApiErr error={error} />}
    {cov.loading || !c ? (cov.error ? <ApiErr error={cov.error} /> : <Loading />) : !c.subjects.length
      ? <ApiNote>No syllabus plan for {c.className} yet. {canPlan ? <>Use <b>Set syllabus plan</b> to add chapters and target dates; the plan applies to every section of {cls?.gradeName || 'the class'}.</> : 'The academic coordinator sets chapters and target dates.'}</ApiNote>
      : c.subjects.map((s) => (
        <div key={s.subjectId} style={{ marginBottom: 18 }}>
          <SectionHead title={`${s.subjectName} · ${Number(s.completionPercent).toFixed(0)}% taught`}
            link={canPlan ? 'Edit plan' : undefined} onClick={canPlan ? () => setPlanning({ subjectId: s.subjectId }) : undefined}
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
    {planning && cls && <SyllabusPlanModal gradeId={cls.gradeId} gradeName={cls.gradeName} initialSubjectId={planning.subjectId || ''}
      onClose={() => setPlanning(null)} onSaved={() => { setPlanning(null); cov.reload(); }} />}
  </>);
}

/** Sets or replaces the annual syllabus plan of a grade and subject: chapters in teaching order with target dates. */
function SyllabusPlanModal({ gradeId, gradeName, initialSubjectId, onClose, onSaved }) {
  const subjects = useApi(() => lms.listSubjects(), []);
  const [subjectId, setSubjectId] = useState(initialSubjectId);
  const plan = useApi(() => lms.listPlans(gradeId, subjectId), [gradeId, subjectId], !!subjectId);
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const nextKey = useRef(0);
  const blank = (date = '') => ({ key: nextKey.current++, title: '', date, periods: '' });
  // Start from the saved chapters of the chosen subject (or one empty row)
  useEffect(() => {
    if (!plan.data) return;
    const topics = (plan.data.find((p) => p.subjectId === subjectId)?.topics) || [];
    setRows(topics.length ? topics.map((t) => ({ key: nextKey.current++, title: t.chapterTitle, date: t.plannedCompletionDate, periods: t.plannedPeriods ?? '' })) : [blank()]);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.data, subjectId]);
  const taught = ((plan.data || []).find((p) => p.subjectId === subjectId)?.topics || []).some((t) => t.completedOn);
  const set = (key, patch) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const add = () => setRows((rs) => [...rs, blank(rs.at(-1)?.date ? isoPlus(rs.at(-1).date, 30) : '')]);
  const filled = rows.filter((r) => r.title.trim() || r.date);
  const problem = !subjectId ? 'Choose a subject.' : !filled.length ? 'Add at least one chapter.'
    : filled.some((r) => !r.title.trim()) ? 'Every chapter needs a title.'
      : filled.some((r) => !r.date) ? 'Every chapter needs a target date.'
        : filled.some((r, i) => i && r.date < filled[i - 1].date) ? 'List chapters in teaching order: target dates cannot go backwards.'
          : filled.some((r) => r.periods !== '' && (Number(r.periods) < 1 || Number(r.periods) > 200)) ? 'Planned periods must be between 1 and 200.' : null;
  const save = async () => {
    setBusy(true); setError(null);
    try {
      await lms.savePlan({ gradeId, subjectId, topics: filled.map((r) => ({ chapterTitle: r.title.trim(), plannedCompletionDate: r.date, plannedPeriods: r.periods === '' ? null : Number(r.periods) })) });
      onSaved();
    } catch (e) { setError(e); } finally { setBusy(false); }
  };
  return (
    <Modal title="Set syllabus plan" sub={`${gradeName} · applies to every section of the class`} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={busy || !!problem || taught} onClick={save}>{busy && <LoaderCircle size={14} className="spin" />}Save plan</button></>}>
      <div className="field box" style={{ marginBottom: 12 }}><label htmlFor="sp-subject">SUBJECT *</label>
        <select id="sp-subject" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
          <option value="">{subjects.loading ? 'Loading subjects…' : 'Select subject'}</option>
          {(subjects.data || []).map((s) => <option key={s.subjectId} value={s.subjectId}>{s.subjectName}</option>)}
        </select></div>
      {taught && <ApiNote>Some chapters of this plan are already marked as taught, so the plan can no longer be replaced.</ApiNote>}
      {subjectId && (plan.loading && !plan.data ? <Loading /> : (<>
        <div className="splan">
          <div className="splan-head" aria-hidden="true"><span>#</span><span>Chapter</span><span>Target date</span><span>Periods</span><span /></div>
          {rows.map((r, i) => (
            <div className="splan-row" key={r.key}>
              <span className="muted xs">{i + 1}</span>
              <input aria-label={`Chapter ${i + 1} title`} maxLength={200} value={r.title} placeholder="e.g. Fractions" disabled={taught} onChange={(e) => set(r.key, { title: e.target.value })} />
              <input aria-label={`Chapter ${i + 1} target date`} type="date" value={r.date} disabled={taught} onChange={(e) => set(r.key, { date: e.target.value })} />
              <input aria-label={`Chapter ${i + 1} planned periods`} type="number" min={1} max={200} value={r.periods} placeholder="—" disabled={taught} onChange={(e) => set(r.key, { periods: e.target.value })} />
              <button type="button" className="link" disabled={taught || rows.length === 1} onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} aria-label={`Remove chapter ${i + 1}`}>Remove</button>
            </div>
          ))}
        </div>
        <button type="button" className="btn" style={{ marginTop: 10 }} disabled={taught || rows.length >= 60} onClick={add}><Plus size={14} />Add chapter</button>
        {problem && filled.length > 0 && <p className="xs muted" style={{ marginTop: 10 }}>{problem}</p>}
      </>))}
      {error && <div style={{ marginTop: 10 }}><ApiErr error={error} /></div>}
    </Modal>
  );
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
  // Homework is set for a subject the class has a teacher for; a class with none allocated cannot be given homework yet
  const subjectsHere = ownFirst(allocations.filter((a) => a.sectionId === sectionId), user.userId);
  const className = sections.find(([id]) => id === sectionId)?.[1];
  const canSet = hasRole(...ROLES.setHomework);
  return (<>
    <div className="row" style={{ gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
      <SectionPicker sections={sections} sectionId={sectionId} setSectionId={setSectionId} />
      <span style={{ marginLeft: 'auto' }} />
      {canSet && <button className="btn primary" disabled={!subjectsHere.length} title={subjectsHere.length ? undefined : `No subject teachers are allocated to ${className || 'this class'} yet`}
        onClick={() => setSetting(true)}><Plus size={14} />Set homework</button>}
    </div>
    {list.error ? <ApiErr error={list.error} /> : list.loading || !list.data ? <Loading /> : !list.data.length
      ? <ApiNote>No homework set for {className || 'this class'} yet. {canSet
        ? (subjectsHere.length ? <>Use <b>Set homework</b> to add the first.</> : <>Subject teachers must be allocated to the class first (Allocations tab).</>)
        : 'Subject teachers and class teachers set homework.'}</ApiNote> : (
      <DataTable boxed cols={[
        // A teacher name that is only an ID (no faculty record) is not shown as if it were a name
        { label: 'Homework', render: (h) => <span className="cell-id"><b>{h.title}</b><small>{h.subjectName} · {/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(h.teacherName || '') ? 'Teacher not on record' : h.teacherName}</small></span> },
        { label: 'Due', render: (h) => <span className="cell-id"><b>{when(h.dueAt)}</b>{h.missing > 0 && new Date(h.dueAt) < new Date() && <span><Pill tone="amber">Overdue</Pill></span>}</span> },
        { label: 'Handed in', render: (h) => `${h.submitted} / ${h.studentsInSection}` },
        { label: 'Marked', className: 'num', key: 'evaluated' },
        { label: 'Missing', render: (h) => (h.missing ? <Pill tone={new Date(h.dueAt) < new Date() ? 'amber' : ''}>{h.missing}</Pill> : <Pill tone="green">0</Pill>) },
        { label: 'Action', render: (h) => <button type="button" className="link" onClick={() => setOpen(open === h.homeworkId ? null : h.homeworkId)}>{open === h.homeworkId ? 'Hide' : 'Submissions'}</button> },
      ]} rows={list.data} />
    )}
    {open && <div style={{ marginTop: 16 }}><Roster homeworkId={open} onChanged={list.reload} /></div>}
    {setting && <HomeworkModal sectionId={sectionId} className={className} subjects={subjectsHere} onClose={() => setSetting(false)} onSaved={list.reload} />}
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
        { label: 'Status', render: (p) => <span className="resultstack">{pill(lms.PLAN_STATUS, p.status)}{p.reviewRemarks && <small className="xs muted">{p.reviewRemarks}</small>}</span> },
        { label: 'Action', render: (p) => (p.status === 'SUBMITTED' && reviewer
          ? <span className="act"><button type="button" className="link" onClick={() => setReviewing({ p, decision: 'APPROVED' })}>Approve</button>
              <button type="button" className="link" onClick={() => setReviewing({ p, decision: 'RETURNED' })}>Return</button></span>
          : (p.status === 'DRAFT' || p.status === 'RETURNED') && p.teacherId === user.userId ? <button type="button" className="link" onClick={() => submit(p)}>Submit</button> : <span className="muted xs">—</span>) },
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
