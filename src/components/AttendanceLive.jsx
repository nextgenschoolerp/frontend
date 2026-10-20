import { useEffect, useMemo, useState } from 'react';
import { Check, Download, LoaderCircle, Phone } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { useApi } from '../api/useApi.js';
import * as studentApi from '../api/studentService.js';
import { PageHeader, Metrics, Card, DataTable, Tabs, SectionHead, Pill, Person, KV, Footer, downloadCsv, todayIso } from './ui.jsx';
import { Modal } from './AuthSettings.jsx';
import { ApiErr, ApiNote } from './Admissions.jsx';

const { ROLES, ATTENDANCE_STATUS, FOLLOW_UP_STATUS } = studentApi;
const Loading = () => <p className="xs muted"><LoaderCircle size={12} className="spin" /> Loading…</p>;
const Ok = ({ children }) => <div className="api-note ok" style={{ marginBottom: 12 }}><Check size={14} style={{ flex: 'none' }} /><span>{children}</span></div>;
const Picker = ({ label, value, onChange, options, empty }) => (
  <select className="select" aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
    {empty !== undefined && <option value="">{empty}</option>}
    {options.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
  </select>
);
const statusPill = (code) => { if (!code) return <Pill tone="amber">Unmarked</Pill>; const [t, c] = ATTENDANCE_STATUS[code] || [code, '']; return <Pill tone={c}>{t}</Pill>; };
const followPill = (code) => { if (!code) return null; const [t, c] = FOLLOW_UP_STATUS[code] || [code, '']; return <Pill tone={c}>{t}</Pill>; };
const label = (code) => (code ? (ATTENDANCE_STATUS[code] || [code])[0] : 'Unmarked');
const dayLabel = (iso, opts = { day: 'numeric', month: 'short', year: 'numeric' }) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', opts);
const timeLabel = (t) => (t ? new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '');
const pctText = (v) => (v === null || v === undefined ? '—' : `${Number(v).toFixed(1)}%`);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const addDays = (iso, n) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const mondayOf = (iso) => { const d = new Date(`${iso}T12:00:00`); return addDays(iso, -((d.getDay() + 6) % 7)); };
const avg = (list) => (list.length ? list.reduce((n, d) => n + Number(d.presentRate || 0), 0) / list.length : null);
const TARGET = 95;
const CORRECTION_DAYS = 7;
const CLASS_KEY = 'oakridge.attendance.class';
const lastClass = () => { try { return JSON.parse(localStorage.getItem(CLASS_KEY)) || {}; } catch { return {}; } };
const rememberClass = (v) => { try { localStorage.setItem(CLASS_KEY, JSON.stringify(v)); } catch { /* storage unavailable */ } };

/** True when the signed-in user may read attendance (studentservice /api/v1/attendance). */
export function useAttendanceAllowed() {
  const { user, hasRole } = useAuth();
  return hasRole(...ROLES.attendanceView) && !!user?.tenantId;
}

/**
 * Today's school figure and this week's trend (Overview, Reports): GET /attendance/summary and /attendance/trend.
 * `live` is false for roles without attendance access, which keep the sample figures.
 */
export function useAttendanceWeek() {
  const { branchId } = useAuth();
  const allowed = useAttendanceAllowed();
  const today = todayIso();
  const monday = mondayOf(today);
  const summary = useApi(() => studentApi.attendanceSummary(today, branchId || undefined), [today, branchId], allowed);
  const trend = useApi(() => studentApi.attendanceTrend(addDays(monday, -7), today, branchId || undefined), [monday, today, branchId], allowed);
  const days = trend.data || [];
  const week = days.filter((d) => d.date >= monday);
  const lastWeek = days.filter((d) => d.date < monday);
  const weekAvg = avg(week), lastAvg = avg(lastWeek);
  return {
    allowed, live: allowed && !!summary.data && !!trend.data, loading: summary.loading || trend.loading, error: summary.error || trend.error,
    today: summary.data, week, weekAvg, change: weekAvg !== null && lastAvg !== null ? weekAvg - lastAvg : null,
    points: week.map((d) => ({ label: dayLabel(d.date, { weekday: 'short', day: 'numeric' }), value: Number(d.presentRate || 0) })),
    period: !week.length ? null : week.length === 1 ? dayLabel(week[0].date, { day: 'numeric', month: 'long', year: 'numeric' })
      : `${dayLabel(week[0].date, { day: 'numeric', month: 'short' })}–${dayLabel(week[week.length - 1].date, { day: 'numeric', month: 'long', year: 'numeric' })}`,
  };
}

/* ====================================================================================================
   Attendance page
   ==================================================================================================== */

/** Attendance page, live from studentservice: school figures, class register (AM / PM), follow-ups, absence history. */
export function AttendanceLive() {
  const { user, hasRole, branchId } = useAuth();
  const canMark = hasRole(...ROLES.attendanceMark);
  const canFollowUp = hasRole(...ROLES.attendanceFollowUp);
  const canClasses = hasRole(...ROLES.classes);
  const [date, setDate] = useState(todayIso());
  // The last class opened on this browser (a class teacher usually takes the same register every day)
  const [gradeId, setGradeId] = useState(() => lastClass().gradeId || '');
  const [sectionId, setSectionId] = useState(() => lastClass().sectionId || '');
  useEffect(() => { if (gradeId && sectionId) rememberClass({ gradeId, sectionId }); }, [gradeId, sectionId]);
  const [tab, setTab] = useState(0);
  const [notice, setNotice] = useState(null);

  const grades = useApi(() => studentApi.listGrades(user.tenantId), [user.tenantId], canClasses);
  const sections = useApi(() => studentApi.listSections(gradeId), [gradeId], canClasses && !!gradeId);
  const summary = useApi(() => studentApi.attendanceSummary(date, branchId || undefined), [date, branchId]);
  const followUps = useApi(() => studentApi.listFollowUps({ branchId: branchId || undefined }), [branchId]);
  const register = useApi(() => studentApi.getRegister(sectionId, date), [sectionId, date], !!sectionId);

  const gradeList = useMemo(() => [...(grades.data || [])].sort((a, b) => a.sequenceOrder - b.sequenceOrder), [grades.data]);
  const sectionList = useMemo(() => [...(sections.data || [])].sort((a, b) => a.sectionName.localeCompare(b.sectionName)), [sections.data]);
  useEffect(() => { if (gradeList.length && !gradeList.some((g) => g.gradeId === gradeId)) setGradeId(gradeList[0].gradeId); }, [gradeList, gradeId]);
  useEffect(() => { if (sectionList.length && !sectionList.some((s) => s.sectionId === sectionId)) setSectionId(sectionList[0].sectionId); }, [sectionList, sectionId]);

  const s = summary.data;
  const isToday = date === todayIso();
  const refresh = () => { register.reload(); summary.reload(); followUps.reload(); };
  const reg = register.data;
  const exportRegister = () => reg && downloadCsv(`attendance-${reg.gradeName}-${reg.sectionName}-${reg.date}`.replace(/\s+/g, '-'),
    ['Roll', 'Student', 'Student ID', 'AM', 'PM', 'Reason'],
    reg.students.map((r) => [r.rollNumber ?? '', r.fullName, r.studentUid, label(r.am?.status), label(r.pm?.status), [r.am?.reason, r.pm?.reason].filter(Boolean).join(' / ')]));

  return (
    <>
      <PageHeader
        title="Attendance"
        desc="Monitor daily attendance, complete registers and follow up on student absences."
        actions={[{ label: 'Export attendance', icon: <Download size={15} />, onClick: exportRegister, disabled: !reg }]}
      />
      {summary.error ? <ApiErr error={summary.error} /> : (
        <Metrics items={s ? [
          [isToday ? 'Present today' : `Present on ${dayLabel(date, { day: 'numeric', month: 'short' })}`, s.present.toLocaleString('en-IN'), s.unmarked === s.totalStudents ? `No registers in yet · ${s.totalStudents.toLocaleString('en-IN')} on roll`
            : `${pctText(s.presentRate)} of ${(s.totalStudents - s.unmarked).toLocaleString('en-IN')} marked${s.unmarked ? ` · ${s.unmarked.toLocaleString('en-IN')} not yet marked` : ''}`],
          ['Excused absences', s.excused, s.excused ? 'Reasons recorded' : 'None recorded'],
          ['Unexcused absences', s.unexcused, s.openFollowUps ? `${s.openFollowUps} awaiting guardian follow-up` : 'No follow-up pending'],
          ['Class registers', `${s.amRegistersSubmitted} / ${s.registersExpected}`, `Morning registers submitted · ${s.pmRegistersSubmitted} afternoon`],
        ] : [['Present today', '…', ''], ['Excused absences', '…', ''], ['Unexcused absences', '…', ''], ['Class registers', '…', '']]} />
      )}
      <div className="cols s354">
        <Card style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="sh"><div><h3>Class register</h3>
            <p>{reg ? `${reg.gradeName}-${reg.sectionName} · ${plural(reg.students.length, 'student')} · ${dayLabel(reg.date, { weekday: 'long', day: 'numeric', month: 'long' })}` : 'Choose a class'}</p></div></div>
          <div className="filters">
            <input type="date" className="select" aria-label="Date" value={date} max={todayIso()} onChange={(e) => e.target.value && setDate(e.target.value)} />
            {canClasses ? (<>
              <Picker label="Class" value={gradeId} onChange={(v) => { setGradeId(v); setSectionId(''); }} options={gradeList.map((g) => [g.gradeId, g.gradeName])} />
              <Picker label="Section" value={sectionId} onChange={setSectionId} options={sectionList.map((x) => [x.sectionId, `Section ${x.sectionName}`])} />
            </>) : <ApiNote>Class lists are not available for your role.</ApiNote>}
          </div>
          <Tabs items={['Daily register', 'Absence history', 'Staff attendance']} value={tab} onChange={(i) => { setTab(i); setNotice(null); }} />
          {notice && <Ok>{notice}</Ok>}
          {tab === 0 && (grades.error ? <ApiErr error={grades.error} /> : !sectionId ? (grades.loading || sections.loading ? <Loading /> : <ApiNote>No sections in this class.</ApiNote>)
            : register.error ? <ApiErr error={register.error} /> : !reg ? <Loading />
              : <RegisterEditor key={`${sectionId}|${date}`} reg={reg} busy={register.loading} canMark={canMark}
                  canLate={hasRole(...ROLES.attendanceLateCorrection)} onSaved={(msg) => { setNotice(msg); refresh(); }} />)}
          {tab === 1 && <AbsenceHistory sectionId={sectionId} className={reg ? `${reg.gradeName}-${reg.sectionName}` : ''} branchId={branchId} />}
          {tab === 2 && <ApiNote>Staff attendance comes from the HR & payroll module (Module 07), which is not connected yet.</ApiNote>}
        </Card>
        <div className="stack">
          <ClassSummary reg={reg} />
          <FollowUps res={followUps} canFollowUp={canFollowUp} onSaved={(msg) => { setNotice(msg); refresh(); }} />
        </div>
      </div>
      <Card className="notice">
        <h4>Attendance notes</h4>
        <p>Changes are recorded against the student and included in attendance reports.</p>
        <div className="row" style={{ marginTop: 10 }}>
          <span className="xs muted">Use “Excused” only when an absence reason is confirmed. Class teachers can correct a register for {CORRECTION_DAYS} days; after that a principal or vice principal corrects it.</span>
        </div>
      </Card>
      <Footer />
    </>
  );
}

/** One session of the register is edited at a time; the other shows its saved marks. */
function RegisterEditor({ reg, busy, canMark, canLate, onSaved }) {
  const old = reg.date < addDays(todayIso(), -CORRECTION_DAYS);
  const editable = canMark && (!old || canLate);
  const [session, setSession] = useState(() => (!reg.am.submitted || new Date().getHours() < 12 ? 'AM' : 'PM'));
  const key = session === 'AM' ? 'am' : 'pm';
  const fromServer = () => Object.fromEntries(reg.students.map((r) => [r.studentId, { status: r[key]?.status || '', reason: r[key]?.reason || '' }]));
  const [draft, setDraft] = useState(fromServer);
  const [filter, setFilter] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  // A new session or fresh data from the server resets the draft
  useEffect(() => { setDraft(fromServer()); setError(null); }, [reg, session]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (id, patch) => setDraft((d) => ({ ...d, [id]: { ...d[id], ...patch } }));
  const changed = reg.students.filter((r) => (draft[r.studentId]?.status || '') !== (r[key]?.status || '') || (draft[r.studentId]?.reason || '') !== (r[key]?.reason || ''));
  const unmarked = reg.students.filter((r) => !draft[r.studentId]?.status).length;
  const info = reg[key];
  const rows = reg.students.filter((r) => !filter || (filter === 'UNMARKED' ? !draft[r.studentId]?.status : draft[r.studentId]?.status === filter));

  const save = async () => {
    const entries = reg.students.filter((r) => draft[r.studentId]?.status)
      .map((r) => ({ studentId: r.studentId, status: draft[r.studentId].status, reason: draft[r.studentId].reason.trim() || null }));
    const missing = entries.filter((e) => e.status === 'EXCUSED' && !e.reason).map((e) => reg.students.find((r) => r.studentId === e.studentId).fullName);
    if (missing.length) { setError({ detail: `Add the reason for ${missing.join(', ')}: an excused absence needs one.` }); return; }
    if (!entries.length) { setError({ detail: 'Mark at least one student.' }); return; }
    setSaving(true); setError(null);
    try {
      await studentApi.saveRegister(reg.sectionId, { date: reg.date, session, entries });
      onSaved(`${session} register for ${reg.gradeName}-${reg.sectionName} saved · ${plural(entries.length, 'student')} marked${unmarked ? `, ${unmarked} unmarked` : ''}.`);
    } catch (e) { setError(e); } finally { setSaving(false); }
  };

  const cell = (r, s) => {
    const k = s === 'AM' ? 'am' : 'pm';
    if (s !== session || !editable) return statusPill(r[k]?.status);
    const v = draft[r.studentId]?.status || '';
    return (
      <select className={`mark ${(v || 'unmarked').toLowerCase()}`} aria-label={`${r.fullName} ${s}`} value={v} onChange={(e) => set(r.studentId, { status: e.target.value })}>
        <option value="" disabled>Unmarked</option>
        {Object.entries(ATTENDANCE_STATUS).map(([code, [t]]) => <option key={code} value={code}>{t}</option>)}
      </select>
    );
  };
  const reasonCell = (r) => {
    const d = draft[r.studentId] || {};
    if (editable && d.status && d.status !== 'PRESENT') {
      return <input className="select" style={{ width: '100%', minWidth: 140 }} aria-label={`${r.fullName} reason`} maxLength={500}
        placeholder={d.status === 'EXCUSED' ? 'Reason (required)' : 'Reason'} value={d.reason} onChange={(e) => set(r.studentId, { reason: e.target.value })} />;
    }
    const reasons = [r.am?.reason && `AM: ${r.am.reason}`, r.pm?.reason && `PM: ${r.pm.reason}`].filter(Boolean).join(' · ');
    return <span className="muted">{reasons || '—'}</span>;
  };

  const submitted = (s, i) => (i.submitted
    ? `${s} submitted at ${timeLabel(i.submittedAt)} by ${i.submittedBy}${i.lastChangedAt ? ` · changed ${timeLabel(i.lastChangedAt)} by ${i.lastChangedBy}` : ''}`
    : `${s} not submitted`);
  return (<>
    <div className="row" style={{ flexWrap: 'wrap' }}>
      <div className="pills" role="group" aria-label="Register session">
        {['AM', 'PM'].map((s) => <button key={s} type="button" className={`btn${session === s ? ' primary' : ''}`} onClick={() => setSession(s)}>{s === 'AM' ? 'Morning (AM)' : 'Afternoon (PM)'}{reg[s.toLowerCase()].submitted && <Check size={13} />}</button>)}
      </div>
      <Picker label="Status" value={filter} onChange={setFilter} empty="All statuses"
        options={[...Object.entries(ATTENDANCE_STATUS).map(([c, [t]]) => [c, t]), ['UNMARKED', 'Unmarked']]} />
    </div>
    {!canMark ? <ApiNote>You can view registers; class teachers, the academic head and principals mark them.</ApiNote>
      : old && !canLate && <ApiNote>This register is more than {CORRECTION_DAYS} days old: a principal or vice principal corrects it.</ApiNote>}
    {!reg.students.length ? <ApiNote>No students on the roll of this section.</ApiNote> : (
      <div className="tablebox" aria-busy={busy || saving} style={{ opacity: busy ? 0.6 : 1, transition: 'opacity 150ms ease' }}>
        <DataTable cols={[
          { label: 'Student', render: (r) => <Person name={r.fullName} sub={`${r.studentUid}${r.rollNumber ? ` · Roll ${r.rollNumber}` : ''}`} /> },
          { label: 'AM', render: (r) => cell(r, 'AM') },
          { label: 'PM', render: (r) => cell(r, 'PM') },
          { label: 'Absence reason', render: reasonCell },
          { label: 'Follow-up', render: (r) => followPill(r.am?.followUpStatus) || followPill(r.pm?.followUpStatus) || <span className="muted">—</span> },
        ]} rows={rows} />
        <div className="pager"><span>{rows.length === reg.students.length ? `${plural(reg.students.length, 'student')}` : `Showing ${rows.length} of ${reg.students.length}`} · {info.present} present · {info.late} late · {info.excused} excused · {info.unexcused} unexcused · {info.unmarked} unmarked ({session}, saved)</span></div>
      </div>
    )}
    {error && <ApiErr error={error} />}
    <div className="row" style={{ flexWrap: 'wrap' }}>
      <span className="xs muted">{submitted('AM', reg.am)} · {submitted('PM', reg.pm)}</span>
      {editable && reg.students.length > 0 && (
        <div className="pills">
          <button type="button" className="btn" disabled={!unmarked} onClick={() => setDraft((d) => Object.fromEntries(Object.entries(d).map(([id, m]) => [id, m.status ? m : { ...m, status: 'PRESENT' }])))}>Mark all present</button>
          <button type="button" className="btn primary" disabled={saving || (info.submitted && !changed.length)} onClick={save}>
            {saving ? <LoaderCircle size={14} className="spin" /> : <Check size={14} />}{info.submitted ? `Save changes (${changed.length})` : `Submit ${session} register`}
          </button>
        </div>
      )}
    </div>
  </>);
}

function ClassSummary({ reg }) {
  if (!reg) return <Card><h3 style={{ fontSize: 15, fontWeight: 600 }}>Class summary</h3><p className="small muted" style={{ marginTop: 4 }}>Choose a class.</p></Card>;
  const i = reg.am.submitted || !reg.pm.submitted ? reg.am : reg.pm;
  const session = i === reg.am ? 'AM' : 'PM';
  const total = reg.students.length;
  const rate = total ? ((i.present + i.late) / total) * 100 : null;
  return (
    <Card>
      <h3 style={{ fontSize: 15, fontWeight: 600 }}>Class summary</h3>
      <p className="small muted" style={{ margin: '4px 0 8px' }}>{reg.gradeName}-{reg.sectionName} · {dayLabel(reg.date, { day: 'numeric', month: 'short' })} · {session} register</p>
      {[['Present', i.present], ['Late', i.late], ['Excused', i.excused], ['Unexcused', i.unexcused], ['Unmarked', i.unmarked]].filter(([, n], k) => n || k === 0).map(([a, n]) => (
        <div className="attrow" key={a}><span>{a}</span><span className="muted small">{plural(n, 'student')}</span></div>
      ))}
      <p className="xs muted" style={{ marginTop: 8 }}>{rate === null ? 'No students on roll' : `${rate.toFixed(1)}% present · School target ${TARGET}%`}</p>
    </Card>
  );
}

function FollowUps({ res, canFollowUp, onSaved }) {
  const [all, setAll] = useState(false);
  const [open, setOpen] = useState(null);
  const list = res.data || [];
  const shown = all ? list : list.slice(0, 3);
  return (
    <Card>
      <SectionHead title="Needs follow-up" sub={res.data ? `${plural(list.length, 'unexcused absence')} in the last 7 days` : 'Unexcused absences'} />
      {res.error ? <div style={{ marginTop: 12 }}><ApiErr error={res.error} /></div> : !res.data ? <div style={{ marginTop: 12 }}><Loading /></div>
        : !list.length ? <p className="xs muted" style={{ marginTop: 12 }}>No unexcused absences waiting for a guardian follow-up.</p> : shown.map((a) => (
          <div key={a.attendanceId} style={{ marginTop: 18 }}>
            <div className="row" style={{ justifyContent: 'flex-start' }}><Person name={a.fullName} sub={`${a.gradeName}-${a.sectionName} · Absent ${a.session} · ${dayLabel(a.date, { day: 'numeric', month: 'short' })}`} /></div>
            <div style={{ margin: '10px 0 8px' }}>{followPill(a.followUpStatus)}</div>
            <p className="body-s">{a.followUpNote ? `${a.followUpNote} — ${a.followUpBy}` : 'Please contact the primary guardian and record the reason.'}</p>
            {a.emergencyContactPhone && <p className="xs muted" style={{ marginTop: 4 }}><Phone size={11} style={{ verticalAlign: -1 }} /> {a.emergencyContactPhone}</p>}
            {canFollowUp && <button className="btn" style={{ marginTop: 12 }} onClick={() => setOpen(a)}>{a.followUpStatus === 'OPEN' ? 'Contact guardian' : 'Update follow-up'}</button>}
          </div>
        ))}
      {list.length > 3 && <button type="button" className="link" style={{ marginTop: 14 }} onClick={() => setAll(!all)}>{all ? 'Show fewer' : `View all ${list.length} →`}</button>}
      {open && <FollowUpModal absence={open} onClose={() => setOpen(null)} onSaved={(msg) => { setOpen(null); onSaved(msg); }} />}
    </Card>
  );
}

function FollowUpModal({ absence, onClose, onSaved }) {
  const [status, setStatus] = useState(absence.followUpStatus === 'OPEN' ? 'GUARDIAN_CONTACTED' : 'RESOLVED');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const save = async () => {
    setBusy(true); setError(null);
    try {
      await studentApi.updateFollowUp(absence.attendanceId, { followUpStatus: status, note: note.trim() });
      onSaved(`Follow-up recorded for ${absence.fullName}: ${FOLLOW_UP_STATUS[status][0].toLowerCase()}.`);
    } catch (e) { setError(e); } finally { setBusy(false); }
  };
  return (
    <Modal title="Guardian follow-up" sub={`${absence.fullName} · ${absence.gradeName}-${absence.sectionName} · absent ${absence.session}, ${dayLabel(absence.date)}`} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={busy || !note.trim()} onClick={save}>{busy && <LoaderCircle size={14} className="spin" />}Save follow-up</button></>}>
      <KV rows={[['Emergency contact', absence.emergencyContactPhone || 'Not recorded'], ['Marked by', absence.markedBy || '—'],
        ...(absence.followUpNote ? [['Last note', `${absence.followUpNote} — ${absence.followUpBy}`]] : [])]} />
      <div className="field box" style={{ marginTop: 14 }}><label htmlFor="fu-status">OUTCOME *</label>
        <select id="fu-status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="GUARDIAN_CONTACTED">Guardian contacted · awaiting confirmation</option>
          <option value="RESOLVED">Resolved</option>
        </select></div>
      <div className="field box" style={{ marginTop: 10 }}><label htmlFor="fu-note">NOTE *</label>
        <textarea id="fu-note" rows={3} maxLength={1000} placeholder="Who you spoke to and what they said" value={note} onChange={(e) => setNote(e.target.value)} /></div>
      <p className="xs muted" style={{ marginTop: 8 }}>If the guardian confirms a reason, also mark the absence “Excused” with that reason in the class register.</p>
      {error && <div style={{ marginTop: 10 }}><ApiErr error={error} /></div>}
    </Modal>
  );
}

function AbsenceHistory({ sectionId, className, branchId }) {
  const [scope, setScope] = useState(sectionId ? 'class' : 'school');
  const [from, setFrom] = useState(addDays(todayIso(), -29));
  const [to, setTo] = useState(todayIso());
  const [status, setStatus] = useState('');
  const query = { from, to, status: status || undefined, branchId: branchId || undefined, sectionId: scope === 'class' ? sectionId : undefined };
  const res = useApi(() => studentApi.listAbsences(query), [JSON.stringify(query)], !!from && !!to && (scope === 'school' || !!sectionId));
  const rows = res.data || [];
  return (<>
    <div className="filters">
      <Picker label="Scope" value={scope} onChange={setScope} options={[...(sectionId ? [['class', `Class ${className}`]] : []), ['school', 'Whole school']]} />
      <input type="date" className="select" aria-label="From" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} />
      <input type="date" className="select" aria-label="To" value={to} min={from} max={todayIso()} onChange={(e) => e.target.value && setTo(e.target.value)} />
      <Picker label="Status" value={status} onChange={setStatus} empty="Late and absent" options={['LATE', 'EXCUSED', 'UNEXCUSED'].map((c) => [c, ATTENDANCE_STATUS[c][0]])} />
    </div>
    {res.error ? <ApiErr error={res.error} /> : !res.data ? <Loading /> : !rows.length ? <p className="xs muted">No late arrivals or absences in this period.</p> : (<>
      <DataTable boxed cols={[
        { label: 'Date', render: (a) => `${dayLabel(a.date, { day: '2-digit', month: 'short' })} · ${a.session}` },
        { label: 'Student', render: (a) => <span className="cell-id"><b>{a.fullName}</b><small>{a.studentUid} · {a.gradeName}-{a.sectionName}</small></span> },
        { label: 'Status', render: (a) => statusPill(a.status) },
        { label: 'Reason', render: (a) => <span className="muted">{a.reason || '—'}</span> },
        { label: 'Follow-up', render: (a) => followPill(a.followUpStatus) || <span className="muted">—</span> },
      ]} rows={rows} />
      <div className="row"><span className="xs muted">{plural(rows.length, 'record')} · {dayLabel(from)} – {dayLabel(to)}</span>
        <button type="button" className="link strong" onClick={() => downloadCsv(`absences-${from}-${to}`, ['Date', 'Session', 'Student', 'Student ID', 'Class', 'Status', 'Reason', 'Follow-up'],
          rows.map((a) => [a.date, a.session, a.fullName, a.studentUid, `${a.gradeName}-${a.sectionName}`, label(a.status), a.reason || '', a.followUpStatus ? FOLLOW_UP_STATUS[a.followUpStatus][0] : '']))}>
          <Download size={13} /> Export</button></div>
    </>)}
  </>);
}

/* ====================================================================================================
   Student profile
   ==================================================================================================== */

/** Student profile attendance card (and the Attendance tab with `detailed`): GET /attendance/students/{id}. */
export function StudentAttendanceCard({ student, detailed }) {
  const allowed = useAttendanceAllowed();
  const res = useApi(() => studentApi.studentAttendance(student.studentId), [student.studentId], allowed);
  const a = res.data;
  const today = a?.todayAm || a?.todayPm;
  const todayPill = !a ? null : !today ? <Pill>Not marked yet today</Pill>
    : ['PRESENT', 'LATE'].includes(today) ? <Pill tone={today === 'LATE' ? 'amber' : 'green'}>{today === 'LATE' ? 'Late today' : 'Present today'}</Pill>
      : <Pill tone={today === 'UNEXCUSED' ? 'red' : ''}>Absent today · {label(today).toLowerCase()}</Pill>;
  const rate = a?.attendanceRate;
  return (
    <Card>
      <SectionHead title="Attendance" sub={a ? `${a.periodLabel ? `${a.periodLabel} session` : 'Last 90 days'} to date` : 'Session to date'} link="Register →" to="/attendance" />
      {!allowed ? <div style={{ marginTop: 14 }}><ApiNote>Attendance is visible to class teachers, the academic head, principals, the registrar and the school office.</ApiNote></div>
        : res.error ? <div style={{ marginTop: 14 }}><ApiErr error={res.error} /></div> : !a ? <div style={{ marginTop: 14 }}><Loading /></div>
          : !a.sessionsMarked ? <div style={{ marginTop: 14 }}><ApiNote>No attendance marked for {student.firstName} yet this session.</ApiNote><div style={{ marginTop: 12 }}>{todayPill}</div></div> : (<>
            <div className="bignum" style={{ marginTop: 18 }}>{pctText(rate)}</div>
            <div className="bar" style={{ margin: '14px 0 12px' }}><i style={{ width: `${Math.min(100, Number(rate || 0))}%`, background: Number(rate) < 90 ? 'var(--rd)' : undefined }} /></div>
            <p className="xs muted" style={{ marginBottom: 14 }}>{a.present} present · {a.late} late · {a.excused} excused · {a.unexcused} unexcused <span title="Each school day has an AM and a PM register">({plural(a.sessionsMarked, 'session')})</span></p>
            {todayPill}
            {detailed && (
              <div style={{ marginTop: 18 }}>
                <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Late arrivals and absences</h4>
                {!a.absences.length ? <p className="xs muted">None this session.</p> : (
                  <DataTable boxed cols={[
                    { label: 'Date', render: (x) => `${dayLabel(x.date, { weekday: 'short', day: '2-digit', month: 'short' })} · ${x.session}` },
                    { label: 'Status', render: (x) => statusPill(x.status) },
                    { label: 'Reason', render: (x) => <span className="muted">{x.reason || '—'}</span> },
                    { label: 'Follow-up', render: (x) => followPill(x.followUpStatus) || <span className="muted">—</span> },
                  ]} rows={a.absences} />
                )}
              </div>
            )}
          </>)}
    </Card>
  );
}
