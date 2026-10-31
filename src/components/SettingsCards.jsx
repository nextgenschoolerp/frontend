import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Upload, Check, Plus, Trash2, Settings as Cog } from 'lucide-react';
import { Card, SectionHead, schoolDay, todayIso, useBackLink, useSchoolCalendar } from './ui.jsx';
import { Modal } from './AuthSettings.jsx';
import { ApiErr, ApiNote } from './Admissions.jsx';
import { useApi } from '../api/useApi.js';
import { useAuth } from '../auth.jsx';
import { getSchoolProfile, saveSchoolProfile, fetchSchoolCrest, uploadSchoolCrest } from '../api/authService.js';
import { getAcademicCalendar, updateAcademicSession, saveAcademicTerms, attendanceSettings, saveAttendanceSettings, ROLES as STUDENT_ROLES } from '../api/studentService.js';
import { getStaffAlerts, saveStaffAlerts } from '../api/communicationService.js';
import { formatDate } from '../regional.js';

/*
 * Settings cards that save themselves:
 *   School profile & crest  authservice   GET/PUT /api/v1/tenants/{tenantId}/school-profile, PUT/GET …/crest
 *   Academic setup & terms  studentservice GET /api/v1/academic/calendar, PUT /sessions/{id}, PUT /sessions/{id}/terms
 *   Notifications           communicationservice GET/PUT /api/v1/communication/staff-alerts/preferences
 */

// Who may change each card (the services enforce the same roles)
const PROFILE_EDITORS = ['SUPER_ADMIN', 'TRUSTEE', 'SCHOOL_PRINCIPAL', 'PRINCIPAL', 'IT_SYSTEM_ADMIN'];
const ACADEMIC_EDITORS = ['REGISTRAR', 'SUPER_ADMIN', 'SCHOOL_PRINCIPAL', 'PRINCIPAL'];

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const Saved = ({ children }) => <div className="api-note ok" style={{ marginTop: 10 }}><Check size={14} style={{ flex: 'none' }} /><span>{children}</span></div>;

/** Save / Discard buttons and the result of the last save. */
function SaveBar({ changed, busy, invalid, onSave, onDiscard, saved, error, canEdit, who }) {
  if (!canEdit) return <p className="xs muted" style={{ marginTop: 12 }}>Only {who} can change these settings.</p>;
  return (<>
    {saved && !changed && <Saved>{saved}</Saved>}
    {error && <ApiErr error={error} />}
    <div className="pills" style={{ marginTop: 12 }}>
      <button className="btn" disabled={!changed || busy} onClick={onDiscard}>Discard</button>
      <button className="btn primary" disabled={!changed || busy || invalid} onClick={onSave}><Check size={14} />{busy ? 'Saving…' : 'Save changes'}</button>
    </div>
  </>);
}

/** Runs a save and keeps its busy / error / confirmation state. */
function useSaver() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(null);
  const run = async (fn, message) => {
    setBusy(true); setError(null); setSaved(null);
    try { await fn(); setSaved(message); return true; } catch (e) { setError(e); return false; } finally { setBusy(false); }
  };
  return { busy, error, saved, run, reset: () => { setError(null); setSaved(null); } };
}

const box = (id, label, input) => <div className="field box" key={id}><label htmlFor={id}>{label}</label>{input}</div>;

/* ---------- General → School profile ---------- */
const PROFILE_FIELDS = [
  ['schoolName', 'SCHOOL NAME *', 'text'], ['schoolEmail', 'SCHOOL EMAIL *', 'email'], ['campusName', 'CAMPUS NAME *', 'text'],
  ['schoolPhone', 'SCHOOL PHONE *', 'tel'], ['schoolReference', 'SCHOOL REFERENCE', 'text'], ['website', 'WEBSITE', 'text'],
];
const EMPTY_PROFILE = { schoolName: '', campusName: '', schoolEmail: '', schoolPhone: '', schoolReference: '', website: '', address: '' };

export function SchoolProfileCard() {
  const { user, hasRole } = useAuth();
  const canEdit = hasRole(...PROFILE_EDITORS);
  const profile = useApi(() => getSchoolProfile(user.tenantId), [user.tenantId]);
  const base = profile.data ? Object.fromEntries(Object.keys(EMPTY_PROFILE).map((k) => [k, profile.data[k] || ''])) : null;
  const [draft, setDraft] = useState(null);
  useEffect(() => { if (base) setDraft(base); }, [profile.data]);
  const save = useSaver();
  const crestInput = useRef(null);
  const [crestUrl, setCrestUrl] = useState(null);
  const [crestError, setCrestError] = useState(null);
  const [crestBusy, setCrestBusy] = useState(false);

  // The crest is served with the bearer token, so it is fetched as a blob
  useEffect(() => {
    let url = null;
    if (profile.data?.hasCrest) fetchSchoolCrest(user.tenantId).then((b) => { url = URL.createObjectURL(b); setCrestUrl(url); }).catch(() => setCrestUrl(null));
    else setCrestUrl(null);
    return () => url && URL.revokeObjectURL(url);
  }, [profile.data?.hasCrest, profile.data?.updatedAt]);

  if (profile.error) return <Card><div className="cardhead"><h3>School profile</h3></div><ApiErr error={profile.error} /></Card>;
  if (!draft) return <Card><div className="cardhead"><h3>School profile</h3></div><p className="xs muted" style={{ marginTop: 12 }}>Loading…</p></Card>;

  const set = (k) => (e) => setDraft({ ...draft, [k]: e.target.value });
  const changed = !same(draft, base);
  const missing = ['schoolName', 'campusName', 'schoolEmail', 'schoolPhone', 'address'].filter((k) => !draft[k].trim());
  const onCrest = async (file) => {
    if (!file) return;
    setCrestError(null);
    if (!['image/png', 'image/jpeg', 'image/svg+xml'].includes(file.type)) { setCrestError({ detail: 'Choose a PNG, JPEG or SVG image.' }); return; }
    if (file.size > 1024 * 1024) { setCrestError({ detail: 'The crest must be 1 MB or smaller.' }); return; }
    setCrestBusy(true);
    try { await uploadSchoolCrest(user.tenantId, file); profile.reload(); } catch (e) { setCrestError(e); } finally { setCrestBusy(false); }
  };

  return (
    <Card>
      <div className="cardhead"><h3>School profile</h3><p>Used across the parent portal, documents and communications.</p></div>
      <div className="photo">
        <div className="bigavatar" style={{ borderRadius: 14, overflow: 'hidden' }}>{crestUrl ? <img src={crestUrl} alt="School crest" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <Cog size={22} />}</div>
        <div>
          <button className="btn" disabled={!canEdit || !profile.data.saved || crestBusy} onClick={() => crestInput.current?.click()}
            title={!canEdit ? 'Only a principal, trustee or administrator can change the crest' : !profile.data.saved ? 'Save the school profile first' : undefined}>
            <Upload size={15} />{crestBusy ? 'Uploading…' : 'Change school crest'}</button>
          <input ref={crestInput} type="file" accept="image/png,image/jpeg,image/svg+xml" hidden onChange={(e) => { onCrest(e.target.files[0]); e.target.value = ''; }} />
          <small>SVG, PNG or JPEG · up to 1 MB · Recommended 256 × 256 px</small>
        </div>
      </div>
      {crestError && <ApiErr error={crestError} />}
      <div className="fieldgrid" style={{ '--cols': 2 }}>
        {PROFILE_FIELDS.map(([k, label, type]) => box(`sp-${k}`, label, <input id={`sp-${k}`} type={type} value={draft[k]} onChange={set(k)} disabled={!canEdit} />))}
      </div>
      {box('sp-address', 'SCHOOL ADDRESS *', <input id="sp-address" value={draft.address} onChange={set('address')} disabled={!canEdit} />)}
      {canEdit && changed && missing.length > 0 && <p className="xs" style={{ color: 'var(--rd)', marginTop: 8 }}>Fill in the required fields marked *.</p>}
      <SaveBar canEdit={canEdit} who="a principal, trustee or administrator" changed={changed} busy={save.busy || missing.length > 0} saved={save.saved} error={save.error}
        onDiscard={() => { setDraft(base); save.reset(); }}
        onSave={() => save.run(async () => {
          await saveSchoolProfile(user.tenantId, draft);
          profile.reload();
          window.dispatchEvent(new Event('school-profile:changed'));
        }, 'School profile saved.')} />
    </Card>
  );
}

/* ---------- Academic setup ---------- */
const WEEKS = [['MON_FRI', 'Monday–Friday'], ['MON_SAT', 'Monday–Saturday']];

export function AcademicSetupCard() {
  const { user, hasRole } = useAuth();
  const canEdit = hasRole(...ACADEMIC_EDITORS);
  const cal = useApi(() => getAcademicCalendar(user.tenantId), [user.tenantId]);
  useSchoolCalendar();
  const sessions = cal.data?.sessions || [];
  const active = sessions.find((s) => s.isActive) || sessions[sessions.length - 1];
  const [yearId, setYearId] = useState(null);
  const year = sessions.find((s) => s.academicYearId === yearId) || active;
  const terms = (cal.data?.terms || []).filter((t) => year && t.academicYearId === year.academicYearId);
  const base = year && { startDate: year.startDate, endDate: year.endDate, weekStructure: year.weekStructure || 'MON_FRI', isActive: !!year.isActive, currentTermId: terms.find((t) => t.isCurrent)?.termId || '' };
  const [draft, setDraft] = useState(null);
  useEffect(() => { if (base) setDraft(base); }, [cal.data, year?.academicYearId]);
  const [termsOpen, setTermsOpen] = useState(false);
  const save = useSaver();
  const toTerms = useBackLink('/calendar');

  if (cal.error) return <Card><SectionHead title="Academic year & term" /><ApiErr error={cal.error} /></Card>;
  if (!cal.data || !draft) return <Card><SectionHead title="Academic year & term" /><p className="xs muted" style={{ marginTop: 12 }}>Loading…</p></Card>;
  if (!year) return <Card><SectionHead title="Academic year & term" /><ApiNote>No academic years are set up for this school yet.</ApiNote></Card>;

  const set = (k) => (e) => setDraft({ ...draft, [k]: e.target.value });
  const changed = !same(draft, base);
  // The year must end after it starts, must not overlap another year, and its terms must still fit inside it
  const overlaps = sessions.find((s) => s.academicYearId !== year.academicYearId && draft.startDate <= s.endDate && draft.endDate >= s.startDate);
  const outside = terms.find((x) => x.startDate < draft.startDate || x.endDate > draft.endDate);
  const bad = draft.endDate < draft.startDate ? 'The year must end after it starts.'
    : overlaps ? `These dates overlap ${overlaps.sessionName} (${formatDate(overlaps.startDate)} – ${formatDate(overlaps.endDate)}).`
      : outside ? `${outside.termName} (${formatDate(outside.startDate)} – ${formatDate(outside.endDate)}) falls outside these dates. Change the term dates first.` : '';
  const current = terms.find((t) => t.termId === draft.currentTermId);
  const day = schoolDay(todayIso());
  // The current week only means something for the year (and term) today falls in
  const today = todayIso();
  const todayTerm = terms.find((x) => today >= x.startDate && today <= x.endDate);
  const weekText = todayTerm ? (day.week ? `Week ${day.week} of ${day.weeks}` : todayTerm.termName)
    : today < year.startDate ? 'Year not started' : today > year.endDate ? 'Year ended' : 'Between terms';
  const termPayload = (list, currentId) => list.map((t) => ({ termId: t.termId, termName: t.termName, startDate: t.startDate, endDate: t.endDate, halfTermStart: t.halfTermStart || null, halfTermEnd: t.halfTermEnd || null, isCurrent: t.termId === currentId }));

  return (
    <Card>
      <SectionHead title="Academic year & term" sub="Current school calendar and operational dates." link={canEdit || terms.length ? 'Manage term dates →' : undefined} onClick={() => setTermsOpen(true)} />
      <div className="fieldgrid">
        {box('ac-year', 'ACADEMIC YEAR *', <select id="ac-year" value={year.academicYearId} onChange={(e) => { setYearId(e.target.value); save.reset(); }}>
          {sessions.map((s) => <option key={s.academicYearId} value={s.academicYearId}>{s.sessionName}{s.isActive ? ' (current)' : ''}</option>)}</select>)}
        {box('ac-start', 'YEAR STARTS', <input id="ac-start" type="date" value={draft.startDate} onChange={set('startDate')} disabled={!canEdit} />)}
        {box('ac-end', 'YEAR ENDS', <input id="ac-end" type="date" value={draft.endDate} min={draft.startDate} onChange={set('endDate')} disabled={!canEdit} />)}
        {box('ac-term', 'CURRENT TERM', <select id="ac-term" value={draft.currentTermId} onChange={set('currentTermId')} disabled={!canEdit || !terms.length}>
          <option value="">{terms.length ? 'Not set' : 'No terms yet'}</option>{terms.map((t) => <option key={t.termId} value={t.termId}>{t.termName}</option>)}</select>)}
        {box('ac-week', 'CURRENT WEEK', <input id="ac-week" readOnly value={weekText} />)}
        {box('ac-struct', 'WEEK STRUCTURE', <select id="ac-struct" value={draft.weekStructure} onChange={set('weekStructure')} disabled={!canEdit}>{WEEKS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>)}
      </div>
      {canEdit && !year.isActive && (
        <label className="xs" style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12 }}>
          <input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} />Make {year.sessionName} the current academic year
        </label>
      )}
      {bad && <p className="xs" role="alert" style={{ color: 'var(--rd)', marginTop: 8 }}>{bad}</p>}
      {current?.halfTermStart && (
        <Card className="notice" style={{ marginTop: 16, padding: 14 }}>
          <h4>Half-term: {formatDate(current.halfTermStart)} – {formatDate(current.halfTermEnd)}</h4>
          <p>{current.termName} runs {formatDate(current.startDate)} – {formatDate(current.endDate)}. Attendance registers and recurring lessons pause during the break. <Link className="link" to="/calendar" onClick={toTerms}>Open the calendar →</Link></p>
        </Card>
      )}
      <SaveBar canEdit={canEdit} who="the registrar, a principal or a super administrator" changed={changed} busy={save.busy} invalid={!!bad} saved={save.saved} error={save.error}
        onDiscard={() => { setDraft(base); save.reset(); }}
        onSave={() => save.run(async () => {
          await updateAcademicSession(year.academicYearId, { startDate: draft.startDate, endDate: draft.endDate, weekStructure: draft.weekStructure, isActive: draft.isActive || undefined });
          if (draft.currentTermId !== base.currentTermId && terms.length) await saveAcademicTerms(year.academicYearId, termPayload(terms, draft.currentTermId));
          cal.reload();
          window.dispatchEvent(new Event('school-calendar:changed'));
        }, `${year.sessionName} saved.`)} />
      {termsOpen && <TermsModal year={year} terms={terms} canEdit={canEdit} onClose={() => setTermsOpen(false)}
        onSave={async (list) => { await saveAcademicTerms(year.academicYearId, list); cal.reload(); window.dispatchEvent(new Event('school-calendar:changed')); setTermsOpen(false); }} />}
    </Card>
  );
}

function TermsModal({ year, terms, canEdit, onClose, onSave }) {
  const [rows, setRows] = useState(terms.length ? terms.map((t) => ({ ...t, halfTermStart: t.halfTermStart || '', halfTermEnd: t.halfTermEnd || '' }))
    : [{ termName: 'Term 1', startDate: year.startDate, endDate: year.startDate, halfTermStart: '', halfTermEnd: '', isCurrent: true }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (i, k) => (e) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: e.target.value } : r)));
  const sorted = [...rows].sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)));
  const problem = rows.some((r) => !r.termName.trim() || !r.startDate || !r.endDate) ? 'Every term needs a name, a start and an end.'
    : rows.some((r) => r.endDate < r.startDate) ? 'A term must end after it starts.'
      : rows.some((r) => !!r.halfTermStart !== !!r.halfTermEnd) ? 'Give both half-term dates or neither.'
        : rows.some((r) => r.halfTermStart && (r.halfTermStart < r.startDate || r.halfTermEnd > r.endDate || r.halfTermEnd < r.halfTermStart)) ? 'Each half-term must fall inside its term.'
          : sorted.some((r, i) => i > 0 && r.startDate <= sorted[i - 1].endDate) ? 'Terms may not overlap.'
            : rows.some((r) => r.startDate < year.startDate || r.endDate > year.endDate)
              ? `Every term must fall inside ${year.sessionName} (${formatDate(year.startDate)} – ${formatDate(year.endDate)}).` : null;
  const submit = async () => {
    setBusy(true); setError(null);
    try {
      await onSave(sorted.map((r) => ({ termId: r.termId, termName: r.termName.trim(), startDate: r.startDate, endDate: r.endDate, halfTermStart: r.halfTermStart || null, halfTermEnd: r.halfTermEnd || null, isCurrent: !!r.isCurrent })));
    } catch (e) { setError(e); } finally { setBusy(false); }
  };
  return (
    <Modal title="Term dates" sub={`${year.sessionName} · ${formatDate(year.startDate)} – ${formatDate(year.endDate)}`} onClose={onClose}
      footer={canEdit ? <><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy || !!problem} onClick={submit}>{busy ? 'Saving…' : 'Save term dates'}</button></>
        : <button className="btn primary" onClick={onClose}>Done</button>}>
      {rows.map((r, i) => (
        <div key={i} className="fieldgrid" style={{ '--cols': 3, marginTop: i ? 12 : 0 }}>
          {box(`t-name-${i}`, 'TERM', <input id={`t-name-${i}`} value={r.termName} maxLength={50} onChange={set(i, 'termName')} disabled={!canEdit} />)}
          {box(`t-start-${i}`, 'STARTS', <input id={`t-start-${i}`} type="date" value={r.startDate} min={year.startDate} max={year.endDate} onChange={set(i, 'startDate')} disabled={!canEdit} />)}
          {box(`t-end-${i}`, 'ENDS', <input id={`t-end-${i}`} type="date" value={r.endDate} min={r.startDate || year.startDate} max={year.endDate} onChange={set(i, 'endDate')} disabled={!canEdit} />)}
          {box(`t-hs-${i}`, 'HALF-TERM STARTS', <input id={`t-hs-${i}`} type="date" value={r.halfTermStart} min={r.startDate} max={r.endDate} onChange={set(i, 'halfTermStart')} disabled={!canEdit} />)}
          {box(`t-he-${i}`, 'HALF-TERM ENDS', <input id={`t-he-${i}`} type="date" value={r.halfTermEnd} min={r.halfTermStart || r.startDate} max={r.endDate} onChange={set(i, 'halfTermEnd')} disabled={!canEdit} />)}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <label className="xs" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="radio" name="current-term" checked={!!r.isCurrent} disabled={!canEdit} onChange={() => setRows(rows.map((x, j) => ({ ...x, isCurrent: j === i })))} />Current term</label>
            {canEdit && rows.length > 1 && <button type="button" className="iconbtn" aria-label={`Remove ${r.termName}`} onClick={() => setRows(rows.filter((_, j) => j !== i))}><Trash2 size={14} /></button>}
          </div>
        </div>
      ))}
      {canEdit && rows.length < 6 && (
        <button type="button" className="btn" style={{ marginTop: 12 }} onClick={() => setRows([...rows, { termName: `Term ${rows.length + 1}`, startDate: '', endDate: '', halfTermStart: '', halfTermEnd: '', isCurrent: false }])}>
          <Plus size={14} />Add term</button>
      )}
      {problem && <p className="xs" style={{ color: 'var(--rd)', marginTop: 10 }}>{problem}</p>}
      {error && <ApiErr error={error} />}
    </Modal>
  );
}

/* ---------- Notifications ---------- */
const ALERTS = [
  ['attendanceAlerts', 'Attendance alerts', 'Unexcused absences and late registers'], ['feeReminders', 'Fee reminders', 'Overdue accounts and reconciliations'],
  ['leaveRequests', 'Leave requests', 'New staff requests awaiting approval'], ['dailyDigest', 'Daily school digest', 'A summary at 16:30 each school day'],
];

/* ---------- Academic setup → Attendance registers ---------- */
const ATTENDANCE_MODES = [
  ['DAILY', 'One register a day', 'Each class is marked once a day. Figures count students: "46 of 52 present".'],
  ['AM_PM', 'Morning and afternoon registers', 'Each class is marked twice a day (AM and PM). Figures count half-day sessions, so a student counts twice: "91 of 104 half-days present".'],
];

/** One register a day or morning and afternoon registers (studentservice GET|PUT /api/v1/attendance/settings). */
export function AttendanceModeCard() {
  const { hasRole } = useAuth();
  const canEdit = hasRole(...STUDENT_ROLES.attendanceSettings);
  const res = useApi(() => attendanceSettings(), []);
  const [mode, setMode] = useState(null);
  const saver = useSaver();
  useEffect(() => { if (res.data) setMode(res.data.mode); }, [res.data]);
  const current = res.data?.mode;
  const changed = !!mode && mode !== current;
  const save = () => saver.run(async () => { await saveAttendanceSettings(mode); await res.reload(); },
    mode === 'DAILY' ? 'Saved. Classes now take one register a day.' : 'Saved. Classes now take a morning and an afternoon register.');
  return (
    <Card>
      <SectionHead title="Attendance registers" sub="How often each class is marked. The registers, the attendance figures and the reports follow this choice." />
      {res.error ? <div style={{ marginTop: 12 }}><ApiErr error={res.error} /></div> : !res.data ? <p className="xs muted" style={{ marginTop: 12 }}>Loading…</p> : (<>
        <div className="modechoice" role="radiogroup" aria-label="Attendance registers">
          {ATTENDANCE_MODES.map(([value, title, help]) => (
            <label key={value} className={`modeopt${mode === value ? ' on' : ''}${canEdit ? '' : ' ro'}`}>
              <input type="radio" name="attendance-mode" value={value} checked={mode === value} disabled={!canEdit || saver.busy}
                onChange={() => { setMode(value); saver.reset(); }} />
              <span><b>{title}</b>{current === value && <em className="xs"> · in use</em>}<small>{help}</small></span>
            </label>
          ))}
        </div>
        {changed && (
          <div style={{ marginTop: 12 }}><ApiNote>{mode === 'DAILY'
            ? 'Marks already taken are kept. From now on the figures use the morning (or day) register only; afternoon marks stay on record but are not counted.'
            : 'Marks already taken are kept. Days marked once count as morning only, so their afternoon shows as not marked.'}</ApiNote></div>
        )}
        {res.data.updatedAt && <p className="xs muted" style={{ marginTop: 10 }}>Last changed {formatDate(res.data.updatedAt)} by {res.data.updatedBy}.</p>}
        <SaveBar changed={changed} busy={saver.busy} onSave={save} onDiscard={() => { setMode(current); saver.reset(); }} saved={saver.saved} error={saver.error}
          canEdit={canEdit} who="a principal or a super administrator" />
      </>)}
    </Card>
  );
}

export function AlertPreferencesCard() {
  const { user } = useAuth();
  const prefs = useApi(() => getStaffAlerts(user.tenantId, user.userId), [user.tenantId, user.userId]);
  const base = prefs.data && Object.fromEntries(ALERTS.map(([k]) => [k, !!prefs.data[k]]));
  const [draft, setDraft] = useState(null);
  useEffect(() => { if (base) setDraft(base); }, [prefs.data]);
  const save = useSaver();
  const toComms = useBackLink('/communications');

  return (
    <Card>
      <div className="cardhead"><h3>Notifications</h3><p>The school alerts you receive. Saved for your account only.</p></div>
      {prefs.error ? <ApiErr error={prefs.error} /> : !draft ? <p className="xs muted" style={{ marginTop: 12 }}>Loading…</p> : (<>
        {ALERTS.map(([k, a, b]) => (
          <div className="attrow" key={k}>
            <div><b style={{ fontWeight: 500 }}>{a}</b><div className="xs muted">{b}</div></div>
            <button type="button" role="switch" aria-checked={draft[k]} aria-label={a} className={'toggle' + (draft[k] ? '' : ' off')} onClick={() => { setDraft({ ...draft, [k]: !draft[k] }); save.reset(); }} />
          </div>
        ))}
        <SaveBar canEdit changed={!same(draft, base)} busy={save.busy} saved={save.saved} error={save.error}
          onDiscard={() => { setDraft(base); save.reset(); }}
          onSave={() => save.run(async () => { await saveStaffAlerts({ tenantId: user.tenantId, userId: user.userId, ...draft }); prefs.reload(); }, 'Notification settings saved.')} />
      </>)}
      <Link to="/communications" onClick={toComms} className="link" style={{ marginTop: 14 }}>Manage school-wide notifications →</Link>
      <p className="xs muted" style={{ marginTop: 4 }}>Circulars, emergency alerts and absence alerts to families are sent from Communications.</p>
    </Card>
  );
}

