import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Download, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { PageHeader, Card, SectionHead, DataTable, Pill, Footer, KV, downloadFile, downloadCsv, todayIso, useBackLink } from './ui.jsx';
import { Modal } from './AuthSettings.jsx';
import { ApiErr, ApiNote } from './Admissions.jsx';
import * as commApi from '../api/communicationService.js';
import { getAcademicCalendar } from '../api/studentService.js';
import { useApi } from '../api/useApi.js';
import { useAuth } from '../auth.jsx';
import { formatDate, getRegional } from '../regional.js';

/*
 * Calendar: school events from communicationservice (GET/POST/PUT /api/v1/communication/community/calendar-events),
 * parent–teacher bookings from its appointment slots, and term dates from studentservice (GET /api/v1/academic/calendar).
 * When the services cannot be reached the page shows the sample month below.
 */

// Event type -> legend group and chip colour
const GROUPS = [['school', 'School events', 'purple'], ['sports', 'Sports & activities', 'green'], ['deadline', 'Deadlines', 'amber'], ['closed', 'School closed', 'grey']];
const groupOf = (type) => ({ SPORTS: 'sports', EXAM: 'deadline', EXAMINATION: 'deadline', DEADLINE: 'deadline', HOLIDAY: 'closed' }[type] || 'school');
const TYPES = [['MEETING', 'Meeting'], ['ACADEMIC', 'Academic'], ['CULTURAL', 'Cultural'], ['SPORTS', 'Sports'], ['EXAM', 'Examination'], ['DEADLINE', 'Deadline'], ['HOLIDAY', 'Holiday / school closed']];
const AUDIENCES = [['ALL', 'Everyone'], ['ALL_STUDENTS', 'All students'], ['ALL_PARENTS', 'All parents'], ['ALL_STAFF', 'All staff'], ['ALL_TEACHERS', 'Teaching staff'],
  ['GRADE_10', 'Year 10 families & teachers'], ['GRADE_11', 'Year 11 families & teachers'], ['PUBLIC', 'Public']];
const audienceLabel = (code) => AUDIENCES.find(([c]) => c === code)?.[1] || code || 'Everyone';
// Circular audiences (Communications) for "Message attendees"
const CIRCULAR_AUDIENCE = { GRADE_10: 'GRADE_10', ALL_TEACHERS: 'ALL_TEACHERS', ALL_STAFF: 'ALL_TEACHERS' };

const SAMPLE = [
  { eventId: 'sample-1', title: 'Year 10 parent–teacher meetings', eventType: 'MEETING', startDate: '2026-10-19', endDate: '2026-10-19', startTime: '15:30', endTime: '18:00',
    venue: 'Main hall', organiser: 'Michael Brooks', targetAudience: 'GRADE_10', description: 'Meet subject teachers to discuss progress, learning goals and support before the mid-term reports are published.' },
  { eventId: 'sample-2', title: 'Autumn sports day', eventType: 'SPORTS', startDate: '2026-10-21', endDate: '2026-10-21', startTime: '09:00', endTime: '14:00', venue: 'Sports grounds', organiser: 'James Reid', targetAudience: 'ALL' },
  { eventId: 'sample-3', title: 'Mid-term progress reports due', eventType: 'DEADLINE', startDate: '2026-10-23', endDate: '2026-10-23', startTime: '16:00', venue: 'All teaching staff', organiser: 'Helen Morris', targetAudience: 'ALL_TEACHERS' },
  { eventId: 'sample-4', title: 'Half-term break', eventType: 'HOLIDAY', startDate: '2026-10-26', endDate: '2026-10-30', venue: 'Campus', targetAudience: 'ALL' },
];
const SAMPLE_SLOTS = [
  ['15:30', 'Patel family', 'Ms Sarah Collins (English)'], ['15:30', 'Okafor family', 'Mr David Chen (Mathematics)'], ['15:40', 'Williams family', 'Dr Amira Hassan (Science)'],
  ['15:40', 'Nowak family', 'Ms Sarah Collins (English)'], ['15:50', 'Thompson family', 'Mr James Reid (History)'], ['15:50', 'Garcia family', 'Mr David Chen (Mathematics)'],
  ['16:00', 'Ahmed family', 'Ms Laura Bennett (French)'], ['16:00', 'Murphy family', 'Dr Amira Hassan (Science)'],
].map(([startTime, bookedByParentName, hostName], i) => ({ slotId: `s${i}`, slotDate: '2026-10-19', startTime, hostName, bookedByParentName, isBooked: true }));
const SAMPLE_TERM = { termName: 'Term 1', startDate: '2026-08-31', endDate: '2026-12-18', halfTermStart: '2026-10-26', halfTermEnd: '2026-10-30' };

// --- dates (ISO yyyy-mm-dd, at noon so time zones never shift the day) ---
const atNoon = (iso) => new Date(`${iso}T12:00:00`);
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (s, n) => { const d = atNoon(s); d.setDate(d.getDate() + n); return iso(d); };
const mondayOf = (s) => { const d = atNoon(s); return addDays(s, -((d.getDay() + 6) % 7)); };
const fmt = (s, opts) => new Intl.DateTimeFormat(getRegional().language, opts).format(atNoon(s));
const longDate = (s) => fmt(s, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const onDay = (e, day) => e.startDate <= day && (e.endDate || e.startDate) >= day;
const timeLabel = (e) => (e.startTime ? (e.endTime ? `${e.startTime}–${e.endTime}` : e.startTime) : 'All day');
const range = (e) => (e.endDate && e.endDate !== e.startDate ? `${fmt(e.startDate, { day: 'numeric', month: 'short' })} – ${formatDate(e.endDate)}` : formatDate(e.startDate));
const blank = (date) => ({ title: '', eventType: 'MEETING', startDate: date, endDate: date, startTime: '', endTime: '', venue: '', organiser: '', targetAudience: 'ALL', description: '' });

/** "Export calendar": the events as an iCalendar file (Outlook, Google Calendar, Apple Calendar). */
function exportIcs(events) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const day = (s) => s.replace(/-/g, '');
  const text = (s) => String(s || '').replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');
  const lines = events.map((e) => [
    'BEGIN:VEVENT', `UID:${e.eventId}@school-erp`, `DTSTAMP:${stamp}`,
    ...(e.startTime
      ? [`DTSTART:${day(e.startDate)}T${e.startTime.replace(':', '')}00`, `DTEND:${day(e.endDate || e.startDate)}T${(e.endTime || e.startTime).replace(':', '')}00`]
      : [`DTSTART;VALUE=DATE:${day(e.startDate)}`, `DTEND;VALUE=DATE:${day(addDays(e.endDate || e.startDate, 1))}`]),
    `SUMMARY:${text(e.title)}`, `LOCATION:${text(e.venue)}`, `DESCRIPTION:${text(e.description)}`, 'END:VEVENT',
  ].join('\r\n'));
  downloadFile('school-calendar.ics', ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//School ERP//Calendar//EN', ...lines, 'END:VCALENDAR'].join('\r\n'), 'text/calendar');
}

export function Calendar() {
  const { user, hasRole } = useAuth();
  const tenantId = user.tenantId;
  const canManage = hasRole(...commApi.ROLES.broadcast);
  const navigate = useNavigate();
  const location = useLocation();
  const toAcademicYear = useBackLink('/settings?tab=academic');
  const today = todayIso();

  const events = useApi(() => commApi.listCalendarEvents(tenantId), [tenantId]);
  const live = Array.isArray(events.data);
  const [sampleEvents, setSampleEvents] = useState(SAMPLE);
  const all = (live ? events.data : sampleEvents).slice().sort((a, b) => `${a.startDate}${a.startTime || ''}`.localeCompare(`${b.startDate}${b.startTime || ''}`));
  const academic = useApi(() => getAcademicCalendar(tenantId), [tenantId]);

  const [sel, setSel] = useState(today);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [view, setView] = useState('month');
  const [group, setGroup] = useState('');
  const [picked, setPicked] = useState(0); // which of the selected day's events the card shows
  const [modal, setModal] = useState(null); // 'add' | 'edit' | 'appointments' | 'all'
  const [notice, setNotice] = useState(null);

  const shown = all.filter((e) => !group || groupOf(e.eventType) === group);
  const first = `${month}-01`;
  const lastDay = atNoon(first); lastDay.setMonth(lastDay.getMonth() + 1, 0);
  const last = iso(lastDay);
  const gridStart = mondayOf(first);
  const days = [];
  for (let d = gridStart; d <= last || days.length % 7; d = addDays(d, 1)) days.push(d);
  const weekStart = mondayOf(sel);
  const week = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const monthEvents = shown.filter((e) => e.startDate <= last && (e.endDate || e.startDate) >= first);

  const dayEvents = shown.filter((e) => onDay(e, sel));
  const featured = dayEvents[Math.min(picked, dayEvents.length - 1)];
  const slots = useApi(() => commApi.getAvailableSlots(tenantId, featured.startDate), [tenantId, featured?.startDate], live && !!featured);
  const booked = (live ? (slots.data || []) : (featured?.startDate === '2026-10-19' ? SAMPLE_SLOTS : [])).filter((s) => s.isBooked);
  const teachers = new Set(booked.map((s) => s.hostName)).size;

  const goMonth = (n) => { const d = atNoon(first); d.setMonth(d.getMonth() + n); const m = iso(d).slice(0, 7); setMonth(m); };
  const pick = (day) => { setSel(day); setPicked(0); if (day.slice(0, 7) !== month) setMonth(day.slice(0, 7)); };
  const goToday = () => pick(today);
  const reload = () => events.reload();

  const messageAttendees = (e) => navigate('/communications', {
    state: {
      from: location.pathname + location.search, fromTitle: 'Calendar',
      circular: { title: e.title, targetAudience: CIRCULAR_AUDIENCE[e.targetAudience] || 'ALL_PARENTS', messageBody: `${e.title}: ${longDate(e.startDate)}, ${timeLabel(e)}${e.venue ? `, ${e.venue}` : ''}.\n\n` },
    },
  });
  const save = async (draft) => {
    const body = { ...draft, tenantId, startTime: draft.startTime || null, endTime: draft.endTime || null, title: draft.title.trim() };
    if (live) {
      if (draft.eventId) await commApi.updateCalendarEvent(draft.eventId, body);
      else await commApi.createCalendarEvent({ ...body, isPublished: true });
      reload();
    } else {
      setSampleEvents((list) => (draft.eventId ? list.map((e) => (e.eventId === draft.eventId ? { ...e, ...body } : e)) : [...list, { ...body, eventId: `sample-${Date.now()}` }]));
    }
    pick(draft.startDate);
    setNotice(`“${body.title}” ${draft.eventId ? 'updated' : 'added to the calendar'}.`);
    setModal(null);
  };

  // Term dates: the current academic year's current term (else the term containing today), with its half-term
  const sessions = academic.data?.sessions || [];
  const year = sessions.find((s) => s.isActive) || sessions[sessions.length - 1];
  const terms = (academic.data?.terms || []).filter((t) => !year || t.academicYearId === year.academicYearId);
  const term = academic.data ? (terms.find((t) => t.isCurrent) || terms.find((t) => t.startDate <= today && t.endDate >= today) || terms[0]) : SAMPLE_TERM;
  let reopens = term?.halfTermEnd ? addDays(term.halfTermEnd, 1) : null;
  while (reopens && [0, 6].includes(atNoon(reopens).getDay())) reopens = addDays(reopens, 1);

  const upcoming = shown.filter((e) => (e.endDate || e.startDate) >= today);
  const row = (e) => [range(e), e.title, timeLabel(e), `${e.venue || 'Campus'} · ${audienceLabel(e.targetAudience)}`];
  const COLS = [{ label: 'Date', key: 0 }, { label: 'Event', key: 1, className: 'num' }, { label: 'Time', key: 2 }, { label: 'Location / audience', key: 3 }];
  const chip = (e) => {
    const [, , tone] = GROUPS.find(([g]) => g === groupOf(e.eventType));
    return <span key={e.eventId} className={`chip ${tone === 'purple' ? '' : tone}`} title={e.title}>{e.startTime && e.startDate === e.endDate ? `${e.startTime} · ` : ''}{e.title}</span>;
  };

  return (
    <>
      <PageHeader
        title="Calendar"
        desc="Plan school events, deadlines and term dates across the campus."
        actions={[
          { label: 'Export calendar', icon: <Download size={15} />, onClick: () => exportIcs(all) },
          canManage && { label: 'Add event', icon: <Plus size={15} />, primary: true, onClick: () => setModal('add') },
        ].filter(Boolean)}
      />
      {!live && events.error && <ApiNote>Showing a sample month: school events could not be loaded ({events.error.detail}).</ApiNote>}
      {notice && <div className="api-note ok"><span>{notice}</span></div>}
      <div className="cols s354">
        <Card style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="row">
            <div className="row" style={{ gap: 12 }}>
              <button className="iconbtn" onClick={() => goMonth(-1)} aria-label="Previous month"><ChevronLeft size={15} /></button>
              <b style={{ fontSize: 20, fontWeight: 600, minWidth: 150, textAlign: 'center' }}>{fmt(first, { month: 'long', year: 'numeric' })}</b>
              <button className="iconbtn" onClick={() => goMonth(1)} aria-label="Next month"><ChevronRight size={15} /></button>
              <button className="btn" onClick={goToday} disabled={sel === today && month === today.slice(0, 7)}>Today</button>
            </div>
            <div className="filters">
              <select className="select" aria-label="Event type" value={group} onChange={(e) => setGroup(e.target.value)}>
                <option value="">All event types</option>{GROUPS.map(([g, l]) => <option key={g} value={g}>{l}</option>)}
              </select>
              <span className="seg" role="tablist">
                {[['month', 'Month'], ['week', 'Week'], ['list', 'List']].map(([v, l]) => <button key={v} role="tab" aria-selected={view === v} className={view === v ? 'on' : ''} onClick={() => setView(v)}>{l}</button>)}
              </span>
            </div>
          </div>
          {view === 'month' && (
            <div className="calgrid">
              {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((d) => <div className="dow" key={d}>{d}</div>)}
              {days.map((day) => {
                const off = day.slice(0, 7) !== month;
                const list = shown.filter((e) => onDay(e, day));
                return (
                  <div key={day} role="button" tabIndex={0} aria-label={longDate(day)} aria-pressed={sel === day}
                    className={`cell${off ? ' off' : ''}${day === today ? ' today' : ''}${sel === day ? ' sel' : ''}`}
                    onClick={() => pick(day)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), pick(day))}>
                    <span className="n">{Number(day.slice(8))}</span>
                    {day === today && <span className="chip green">Today</span>}
                    {list.slice(0, 2).map(chip)}
                    {list.length > 2 && <span className="xs muted">+{list.length - 2} more</span>}
                  </div>
                );
              })}
            </div>
          )}
          {view === 'week' && (
            <div className="tablebox">
              <DataTable cols={[
                { label: 'Day', render: (d) => <button type="button" className="link" onClick={() => pick(d)}>{fmt(d, { weekday: 'short', day: 'numeric', month: 'short' })}{d === today ? ' · Today' : ''}</button> },
                { label: 'Events', render: (d) => { const list = shown.filter((e) => onDay(e, d)); return list.length ? <span className="pills">{list.map(chip)}</span> : <span className="xs muted">No events</span>; } },
              ]} rows={week} />
            </div>
          )}
          {view === 'list' && (
            monthEvents.length
              ? <DataTable boxed cols={[...COLS.slice(0, 3), { label: 'Action', render: (r) => <button type="button" className="act" onClick={() => pick(r.e.startDate)}>Open</button> }]
                .map((c) => (c.key !== undefined ? { ...c, render: (r) => r.cells[c.key] } : c))} rows={monthEvents.map((e) => ({ e, cells: row(e) }))} />
              : <ApiNote>No events in {fmt(first, { month: 'long', year: 'numeric' })}{group ? ' for this event type' : ''}.</ApiNote>
          )}
          <div className="pills">
            {GROUPS.map(([g, l, tone]) => (
              <button type="button" key={g} className={`pill ${tone === 'grey' ? '' : tone}`} aria-pressed={group === g} onClick={() => setGroup(group === g ? '' : g)}
                style={{ border: group === g ? '1px solid currentColor' : '1px solid transparent', cursor: 'pointer' }}>{l}</button>
            ))}
          </div>
        </Card>
        <div className="stack">
          <Card>
            {featured ? (<>
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <div><h3 style={{ fontSize: 15, fontWeight: 600 }}>{featured.title}</h3><p className="small muted" style={{ marginTop: 4 }}>{featured.endDate && featured.endDate !== featured.startDate ? `${longDate(featured.startDate)} – ${longDate(featured.endDate)}` : longDate(featured.startDate)}</p></div>
                {canManage && <button className="link" onClick={() => setModal('edit')}>Edit</button>}
              </div>
              {dayEvents.length > 1 && (
                <div className="pills" style={{ marginTop: 10 }}>{dayEvents.map((e, i) => <button type="button" key={e.eventId} className={`pill ${i === picked ? 'purple' : ''}`} onClick={() => setPicked(i)}>{e.title}</button>)}</div>
              )}
              <div style={{ margin: '14px 0 4px' }}><Pill tone={GROUPS.find(([g]) => g === groupOf(featured.eventType))[2] === 'grey' ? '' : GROUPS.find(([g]) => g === groupOf(featured.eventType))[2]}>{GROUPS.find(([g]) => g === groupOf(featured.eventType))[1]}</Pill></div>
              <KV rows={[['Time', timeLabel(featured)], ['Location', featured.venue || '—'], ['Audience', audienceLabel(featured.targetAudience)], ['Organiser', featured.organiser || '—']]} />
              {featured.description && <p className="body-s" style={{ margin: '8px 0 14px' }}>{featured.description}</p>}
              {booked.length > 0 && <div className="pills"><Pill tone="green">{booked.length} {booked.length === 1 ? 'family' : 'families'} booked</Pill><Pill>{teachers} {teachers === 1 ? 'teacher' : 'teachers'}</Pill></div>}
              <div className="actions" style={{ marginTop: 16, alignItems: 'center', gap: 16 }}>
                {booked.length > 0 && <button className="btn primary" onClick={() => setModal('appointments')}>View appointments</button>}
                {canManage && <button className="link" onClick={() => messageAttendees(featured)}>Message attendees →</button>}
              </div>
            </>) : (<>
              <h3 style={{ fontSize: 15, fontWeight: 600 }}>{longDate(sel)}</h3>
              <p className="body-s muted" style={{ margin: '10px 0 14px' }}>No events{group ? ' of this type' : ''} on this day.</p>
              {canManage && <button className="btn" onClick={() => setModal('add')}><Plus size={14} />Add event on this day</button>}
            </>)}
          </Card>
          <Card>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Term dates</h3>
            {academic.loading && !academic.data ? <p className="xs muted">Loading…</p> : term ? (
              <KV rows={[
                ...(term.halfTermStart ? [['Half-term', `${fmt(term.halfTermStart, { day: 'numeric' })}–${fmt(term.halfTermEnd, { day: 'numeric', month: 'long' })}`], ['School reopens', fmt(reopens, { weekday: 'long', day: 'numeric', month: 'long' })]] : []),
                [`${term.termName} ends`, fmt(term.endDate, { weekday: 'long', day: 'numeric', month: 'long' })],
              ]} />
            ) : <p className="xs muted">No terms have been set up for this academic year.</p>}
            <Link to="/settings?tab=academic" onClick={toAcademicYear} className="link" style={{ marginTop: 10 }}>View academic year →</Link>
          </Card>
        </div>
      </div>
      <Card>
        <SectionHead title="Coming up" sub="School events and deadlines" link="View all events →" onClick={() => setModal('all')} />
        <div style={{ marginTop: 18 }}>
          {upcoming.length ? <DataTable boxed cols={COLS} rows={upcoming.slice(0, 5).map(row)} /> : <ApiNote>No upcoming events{group ? ' of this type' : ''}.</ApiNote>}
        </div>
      </Card>
      {modal === 'all' && (
        <Modal title="All events" sub={`${shown.length} ${shown.length === 1 ? 'event' : 'events'}${group ? ` · ${GROUPS.find(([g]) => g === group)[1]}` : ''}`} onClose={() => setModal(null)}
          footer={<><button className="btn" onClick={() => downloadCsv('school-events', ['Date', 'Event', 'Time', 'Location / audience'], shown.map(row))}><Download size={14} />CSV</button><button className="btn primary" onClick={() => setModal(null)}>Done</button></>}>
          <DataTable boxed cols={COLS} rows={shown.map(row)} />
        </Modal>
      )}
      {modal === 'appointments' && featured && (
        <Modal title="Appointments" sub={`${featured.title} · ${longDate(featured.startDate)}`} onClose={() => setModal(null)}
          footer={<><button className="btn" onClick={() => downloadCsv('appointments', ['Time', 'Family', 'Teacher'], booked.map((s) => [s.startTime, s.bookedByParentName, s.hostName]))}><Download size={14} />CSV</button>
            <button className="btn primary" onClick={() => setModal(null)}>Done</button></>}>
          <DataTable boxed cols={[{ label: 'Time', key: 'startTime' }, { label: 'Family', key: 'bookedByParentName' }, { label: 'Teacher', key: 'hostName' }]} rows={booked} />
        </Modal>
      )}
      {(modal === 'add' || (modal === 'edit' && featured)) && (
        <EventModal initial={modal === 'edit' ? { ...blank(featured.startDate), ...featured, startTime: featured.startTime || '', endTime: featured.endTime || '' } : blank(sel)}
          onClose={() => setModal(null)} onSave={save} />
      )}
      <Footer />
    </>
  );
}

function EventModal({ initial, onClose, onSave }) {
  const [d, setD] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (k) => (e) => setD({ ...d, [k]: e.target.value });
  const problem = !d.title.trim() ? 'Give the event a title.'
    : d.endDate < d.startDate ? 'The event must end on or after its start date.'
      : d.startTime && d.endTime && d.startDate === d.endDate && d.endTime < d.startTime ? 'The end time must be after the start time.' : null;
  const submit = async (e) => {
    e.preventDefault();
    if (problem) return;
    setBusy(true); setError(null);
    try { await onSave(d); } catch (err) { setError(err); } finally { setBusy(false); }
  };
  const box = (id, label, input) => <div className="field box"><label htmlFor={id}>{label}</label>{input}</div>;
  return (
    <Modal title={d.eventId ? 'Edit event' : 'Add event'} sub="Published to the school calendar" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" form="event-form" type="submit" disabled={busy || !!problem}>{d.eventId ? 'Save changes' : 'Add event'}</button></>}>
      <form id="event-form" onSubmit={submit} noValidate>
        {box('ev-title', 'TITLE *', <input id="ev-title" maxLength={200} value={d.title} onChange={set('title')} placeholder="e.g. Science fair" autoFocus />)}
        <div className="fieldgrid" style={{ '--cols': 2 }}>
          {box('ev-type', 'TYPE', <select id="ev-type" value={d.eventType} onChange={set('eventType')}>{TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>)}
          {box('ev-aud', 'AUDIENCE', <select id="ev-aud" value={d.targetAudience} onChange={set('targetAudience')}>{AUDIENCES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>)}
          {box('ev-start', 'START DATE *', <input id="ev-start" type="date" value={d.startDate} onChange={(e) => setD({ ...d, startDate: e.target.value, endDate: d.endDate < e.target.value ? e.target.value : d.endDate })} />)}
          {box('ev-end', 'END DATE *', <input id="ev-end" type="date" value={d.endDate} min={d.startDate} onChange={set('endDate')} />)}
          {box('ev-st', 'START TIME', <input id="ev-st" type="time" value={d.startTime} onChange={set('startTime')} />)}
          {box('ev-et', 'END TIME', <input id="ev-et" type="time" value={d.endTime} onChange={set('endTime')} />)}
          {box('ev-venue', 'LOCATION', <input id="ev-venue" maxLength={150} value={d.venue || ''} onChange={set('venue')} placeholder="e.g. Main hall" />)}
          {box('ev-org', 'ORGANISER', <input id="ev-org" maxLength={150} value={d.organiser || ''} onChange={set('organiser')} />)}
        </div>
        {box('ev-desc', 'DESCRIPTION', <textarea id="ev-desc" rows={3} value={d.description || ''} onChange={set('description')} />)}
        <p className="xs muted" style={{ marginTop: 8 }}>Leave the times empty for an all-day event.</p>
        {problem && d.title && <p className="xs" style={{ color: 'var(--rd)', marginTop: 6 }}>{problem}</p>}
        {error && <ApiErr error={error} />}
      </form>
    </Modal>
  );
}
