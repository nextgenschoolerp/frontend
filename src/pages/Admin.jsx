import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Download, Plus, Upload, Check, ChevronLeft, ChevronRight, Search, FileText, Users, ClipboardCheck, Wallet,
  GraduationCap, FolderOpen, Settings as Cog, ShieldCheck, Folder, Bold, Italic, Underline, AlignLeft, Paperclip, Send,
} from 'lucide-react';
import {
  PageHeader, Metrics, Card, SectionHead, Tabs, SearchBox, Select, DataTable, Pager, Pill, Footer, Field, FieldGrid, KV, downloadFile, downloadCsv, schoolDay, todayIso,
} from '../components/ui.jsx';
import { AttendanceChart } from './Overview.jsx';
import { RolesCard, SecurityCard } from '../components/AuthSettings.jsx';
import { useAuth } from '../auth.jsx';

const act = (t) => <span className="act">{t}</span>;

/* ---------- Calendar ---------- */
const WEEKS = [
  [28, 29, 30, 1, 2, 3, 4], [5, 6, 7, 8, 9, 10, 11], [12, 13, 14, 15, 16, 17, 18], [19, 20, 21, 22, 23, 24, 25], [26, 27, 28, 29, 30, 31, 1],
];
const EVENTS = {
  19: ['15:30 · Parent–teacher meetings', ''],
  21: ['09:00 · Autumn sports day', 'green'],
  23: ['16:00 · Reports due', 'amber'],
};

/** "Export calendar": the month's events as an iCalendar file (Outlook, Google Calendar, Apple Calendar). */
function exportCalendar() {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const events = Object.entries(EVENTS).map(([day, [text]]) => {
    const [time, title] = text.split(' · ');
    const [h, m] = time.split(':');
    const start = `202610${String(day).padStart(2, '0')}T${h}${m}00`;
    return ['BEGIN:VEVENT', `UID:oakridge-202610${day}@school-erp`, `DTSTAMP:${stamp}`, `DTSTART:${start}`, `DURATION:PT1H`, `SUMMARY:${title}`, 'LOCATION:Main campus', 'END:VEVENT'].join('\r\n');
  });
  downloadFile('oakridge-calendar-2026-10.ics',
    ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Oakridge Academy//School ERP//EN', ...events, 'END:VCALENDAR'].join('\r\n'), 'text/calendar');
}

export function Calendar() {
  const [sel, setSel] = useState(19);
  return (
    <>
      <PageHeader
        title="Calendar"
        desc="Plan school events, deadlines and term dates across Main campus."
        actions={[{ label: 'Export calendar', icon: <Download size={15} />, onClick: exportCalendar }, { label: 'Add event', icon: <Plus size={15} />, primary: true }]}
      />
      <div className="cols s354">
        <Card style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="row">
            <div className="row" style={{ gap: 12 }}>
              <button className="iconbtn"><ChevronLeft size={15} /></button>
              <b style={{ fontSize: 20, fontWeight: 600 }}>October 2026</b>
              <button className="iconbtn"><ChevronRight size={15} /></button>
              <button className="btn">Today</button>
            </div>
            <div className="filters"><Select>All event types</Select><Select>Main campus</Select>
              <span className="seg"><button className="on">Month</button><button>Week</button><button>List</button></span>
            </div>
          </div>
          <div className="calgrid">
            {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((d) => <div className="dow" key={d}>{d}</div>)}
            {WEEKS.flat().map((n, i) => {
              const off = (i < 3 && n > 20) || (i > 28 && n < 10);
              const day = off ? null : n;
              const today = day === 16;
              const ev = day && EVENTS[day];
              const half = day && day >= 26 && day <= 30;
              return (
                <div key={i} className={`cell${off ? ' off' : ''}${today ? ' today' : ''}${sel === day ? ' sel' : ''}`} onClick={() => day && setSel(day)}>
                  <span className="n">{n}</span>
                  {today && <span className="chip green">Today</span>}
                  {ev && <span className={`chip ${ev[1]}`}>{ev[0]}</span>}
                  {half && <span className="chip">Half-term</span>}
                </div>
              );
            })}
          </div>
          <div className="pills"><Pill tone="purple">School events</Pill><Pill tone="green">Sports & activities</Pill><Pill tone="amber">Deadlines</Pill><Pill>School closed</Pill></div>
        </Card>
        <div className="stack">
          <Card>
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <div><h3 style={{ fontSize: 15, fontWeight: 600 }}>Year 10 parent–teacher meetings</h3><p className="small muted" style={{ marginTop: 4 }}>Monday, 19 October 2026</p></div>
              <span className="link">Edit</span>
            </div>
            <div style={{ margin: '14px 0 4px' }}><Pill tone="purple">School event</Pill></div>
            <KV rows={[['Time', '15:30–18:00 BST'], ['Location', 'Main hall'], ['Audience', 'Year 10 families & teachers'], ['Organiser', 'Michael Brooks']]} />
            <p className="body-s" style={{ margin: '8px 0 14px' }}>Meet subject teachers to discuss progress, learning goals and support before the mid-term reports are published.</p>
            <div className="pills"><Pill tone="green">84 families confirmed</Pill><Pill>16 teachers</Pill></div>
            <button className="btn primary" style={{ marginTop: 16 }}>View appointments</button>
            <div style={{ marginTop: 14 }}><span className="link">Message attendees →</span></div>
          </Card>
          <Card>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Term dates</h3>
            <KV rows={[['Half-term', '26–30 October'], ['School reopens', 'Monday, 2 November'], ['Term ends', 'Friday, 18 December']]} />
            <span className="link" style={{ marginTop: 10 }}>View academic year →</span>
          </Card>
        </div>
      </div>
      <Card>
        <SectionHead title="Coming up" sub="School events and deadlines" link="View all events →" />
        <div style={{ marginTop: 18 }}>
          <DataTable boxed cols={[
            { label: 'Date', key: 0 }, { label: 'Event', key: 1, className: 'num' }, { label: 'Time', key: 2 }, { label: 'Location / audience', key: 3 },
          ]} rows={[
            ['19 Oct · Mon', 'Year 10 parent–teacher meetings', '15:30–18:00', 'Main hall'],
            ['21 Oct · Wed', 'Autumn sports day', '09:00–14:00', 'Sports grounds'],
            ['23 Oct · Fri', 'Mid-term progress reports due', '16:00', 'All teaching staff'],
          ]} />
        </div>
      </Card>
      <Footer />
    </>
  );
}

/* ---------- Communications ---------- */
export function Communications() {
  return (
    <>
      <PageHeader
        title="Communications"
        desc="Keep families, students and staff informed with timely school updates."
        actions={[{ label: 'Message inbox' }, { label: 'New announcement', icon: <Plus size={15} />, primary: true }]}
      />
      <Metrics items={[
        ['Active notices', '2', 'Published to school audiences'],
        ['Unread messages', '3', 'School office inbox'],
        ['Scheduled', '2', 'Next send: 19 Oct at 08:00'],
        ['Notice delivery', '99.4%', 'Last 30 days · Email & portal'],
      ]} />
      <div className="cols">
        <div className="stack">
          <Card>
            <SectionHead title="Notice board" sub="Published school announcements" link="View all notices →" />
            <div style={{ margin: '18px 0' }}><Tabs items={['Published (2)', 'Scheduled (2)', 'Drafts (1)']} /></div>
            <div className="filters" style={{ marginBottom: 14 }}><SearchBox placeholder="Search notices" width={300} /><Select>All audiences</Select></div>
            {[['School update', 'purple', 'All staff & parents', 'Half-term break: 26–30 October', 'School reopens Monday, 2 November. Please share with families and check the updated term calendar.', 'School office · 15 Oct 2026', '1,326 recipients · 98% delivered'],
              ['Action required', 'purple', 'All staff', 'Safeguarding refresher training', 'All staff to complete the online module by Friday, 23 October. Certificates should be uploaded to your staff record.', 'Principal’s office · 14 Oct 2026', '92 recipients · 100% delivered']].map(([tag, tone, aud, t, body, by, stat]) => (
              <div key={t} style={{ border: '1px solid var(--bd)', borderRadius: 10, padding: 16, marginTop: 12 }}>
                <div className="row"><Pill tone={tone}>{tag}</Pill><span className="xs muted">{aud}</span></div>
                <h4 style={{ fontSize: 14, fontWeight: 600, margin: '10px 0 6px' }}>{t}</h4>
                <p className="body-s">{body}</p>
                <div className="row" style={{ marginTop: 10 }}><span className="xs faint">{by}</span><span className="link">View notice →</span></div>
                <span className="xs" style={{ color: 'var(--gr)' }}>{stat}</span>
              </div>
            ))}
          </Card>
          <Card>
            <SectionHead title="School office inbox" sub="3 unread messages" link="Open inbox →" />
            <div style={{ marginTop: 18 }}>
              <DataTable boxed cols={[
                { label: 'From', key: 0 }, { label: 'Message', render: (r) => <span><b style={{ fontWeight: 500 }}>{r[1]}</b> <span className="muted">{r[2]}</span></span> }, { label: 'Received', key: 3 },
              ]} rows={[
                ['Sarah Thompson · Parent · Year 10A', 'Parent–teacher appointment', 'Can we confirm our 16:00 slot?', '09:18'],
                ['Eleanor Hughes · Mathematics', 'Year 10 assessment schedule', 'Updated marks are ready to review.', '08:54'],
                ['James Bennett · Parent · Year 10A', 'Sports day permission', 'Consent form attached. Thank you.', '08:41'],
              ]} />
            </div>
          </Card>
        </div>
        <div className="stack">
          <Card>
            <h3 style={{ fontSize: 15, fontWeight: 600 }}>Compose announcement</h3>
            <p className="small muted" style={{ margin: '4px 0 14px' }}>Draft · Only visible to you</p>
            <div className="fieldlist">
              <Field box label="Title" required value="Autumn sports day: final reminders" />
              <Field box label="Audience" required select value="All parents & students" options={['All parents & students', 'All staff', 'Year 10 families']} />
            </div>
            <div className="pills" style={{ margin: '14px 0' }}><Pill tone="purple">✓ Parent portal</Pill><Pill tone="purple">✓ Email</Pill></div>
            <b style={{ fontSize: 12 }}>Message *</b>
            <div className="editor" style={{ marginTop: 8 }}>
              <div className="tb"><Bold size={14} /><Italic size={14} /><Underline size={14} /><AlignLeft size={14} /><span className="link">Add link</span></div>
              <textarea defaultValue={'Our Autumn sports day takes place on Wednesday, 21 October, from 09:00–14:00 at the Sports grounds.\n\nPlease ensure students bring their PE kit, a water bottle and a packed lunch. We look forward to a great day together.'} />
            </div>
            <span className="link" style={{ margin: '14px 0' }}><Paperclip size={13} />Attach file</span>
            <Field box label="Publish" select value="Send now" options={['Send now', 'Schedule for later']} />
            <p className="xs muted" style={{ margin: '14px 0' }}>Estimated audience: 1,248 students and their primary guardians. Preview before publishing.</p>
            <div className="actions"><button className="btn">Save draft</button><button className="btn primary"><Send size={14} />Preview & publish</button></div>
          </Card>
          <Card>
            <SectionHead title="Audience groups" link="Manage →" />
            {[['All staff', '92'], ['Year 10 families', '116'], ['All parents & guardians', '1,326']].map(([a, b]) => (
              <div className="attrow" key={a}><span>{a}</span><Pill>{b}</Pill></div>
            ))}
          </Card>
        </div>
      </div>
      <Footer />
    </>
  );
}

/* ---------- Reports ---------- */
export function Reports() {
  const cats = [[GraduationCap, 'Student reports', 'Enrolment, admissions & demographics', 8], [ClipboardCheck, 'Attendance', 'Daily registers, trends & persistent absence', 6],
    [Wallet, 'Finance', 'Fee collection, outstanding balances & billing', 5], [Users, 'Staff & academics', 'Staffing, class performance & assessments', 7]];
  return (
    <>
      <PageHeader
        title="Reports"
        desc="Turn school information into clear, shareable reports for confident decisions."
        actions={[{ label: 'Scheduled reports' }, { label: 'Create report', icon: <Plus size={15} />, primary: true }]}
      />
      <Card>
        <div className="filters"><SearchBox placeholder="Search reports" width={300} /><Select>2026–2027</Select><Select>Term 1</Select><Select>12–16 October 2026</Select><Select>Main campus</Select></div>
      </Card>
      <div className="grid4">
        {cats.map(([Icon, t, d, n]) => (
          <Card key={t} className="reportcard"><div className="sym"><Icon size={16} /></div><b>{t}</b><span className="xs muted">{d}</span><span className="link" style={{ marginTop: 6 }}>{n} reports · Browse →</span></Card>
        ))}
      </div>
      <div className="cols s404">
        <Card>
          <SectionHead title="Weekly attendance report" sub="Preview · 12–16 October 2026 · Main campus" link="Open full report →" />
          <div className="row" style={{ justifyContent: 'flex-start', gap: 50, margin: '18px 0 20px', alignItems: 'flex-end' }}>
            <div><div className="bignum">95.2%</div><span className="small muted">Weekly average</span></div>
            <div><div style={{ fontSize: 24, fontWeight: 600, color: 'var(--gr)' }}>+0.5 pp</div><span className="small muted">Compared with last week</span></div>
            <Pill tone="green">Above 95% target</Pill>
          </div>
          <AttendanceChart />
          <div style={{ marginTop: 18 }}>
            <DataTable boxed cols={[{ label: 'Today’s status', key: 0 }, { label: 'Students', key: 1 }, { label: 'Proportion', key: 2 }]}
              rows={[['Present', '1,188', '95.2%'], ['Excused', '42', '3.4%'], ['Unexcused', '18', '1.4%']]} />
          </div>
        </Card>
        <div className="stack">
          <Card>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Report options</h3>
            <KV rows={[['Period', '12–16 October 2026'], ['Audience', 'All year groups'], ['Data source', 'Daily attendance registers'], ['Updated', '16 Oct 2026 · 09:42']]} />
            <div className="actions" style={{ margin: '12px 0' }}>
              {/* PDF: the browser's print dialog ("Save as PDF"); CSV: the preview figures */}
              <button className="btn primary" onClick={() => window.print()}><Download size={14} />Export PDF</button>
              <button className="btn" onClick={() => downloadCsv('weekly-attendance-12-16-oct-2026', ['Status', 'Students', 'Proportion'],
                [['Present', '1188', '95.2%'], ['Excused', '42', '3.4%'], ['Unexcused', '18', '1.4%'], ['Weekly average', '', '95.2%'], ['Change vs last week', '', '+0.5 pp']])}>
                <Download size={14} />CSV</button>
            </div>
            <button className="btn">Schedule weekly email</button>
            <p className="xs muted" style={{ marginTop: 14 }}>Reports respect your role permissions. Personal student data is only included for authorised users.</p>
          </Card>
          <Card>
            <SectionHead title="Saved reports" link="Manage →" />
            {[['Term 1 fee collection →', 'Saved by Sarah Williams · 14 Oct'], ['Year 10 academic progress →', 'Saved by Michael Brooks · 12 Oct']].map(([a, b]) => (
              <div key={a} style={{ marginTop: 14 }}><span className="link">{a}</span><p className="xs muted">{b}</p></div>
            ))}
          </Card>
        </div>
      </div>
      <Card>
        <SectionHead title="Recently generated" link="View report history →" />
        <div style={{ marginTop: 18 }}>
          <DataTable boxed cols={[
            { label: 'Report', key: 0, className: 'num' }, { label: 'Generated by', key: 1 }, { label: 'Date', key: 2 }, { label: 'Format', key: 3 }, { label: 'Action', render: () => act('Download') },
          ]} rows={[
            ['Term 1 fee collection summary', 'Sarah Williams', '15 Oct 2026', 'PDF'],
            ['Staff leave & cover report', 'Sarah Williams', '14 Oct 2026', 'XLSX'],
            ['Year 10 student progress', 'Michael Brooks', '12 Oct 2026', 'PDF'],
          ]} />
        </div>
      </Card>
      <Footer />
    </>
  );
}

/* ---------- Documents ---------- */
const FILES = [
  ['Safeguarding policy 2026.pdf', 'Helen Morris', '01 Sep 2026', 'All staff', '1.2 MB'],
  ['Staff handbook 2026–27.pdf', 'Michael Brooks', '28 Aug 2026', 'Staff & parents', '684 KB'],
  ['Autumn term newsletter.pdf', 'Sarah Williams', '15 Oct 2026', 'Public', '248 KB'],
  ['Behaviour policy.pdf', 'Sarah Williams', '01 Sep 2026', 'All staff', '892 KB'],
  ['Admissions policy.pdf', 'Michael Brooks', '02 Sep 2026', 'Staff & parents', '764 KB'],
  ['First aid procedures.pdf', 'Grace Taylor', '05 Sep 2026', 'All staff', '2.4 MB'],
  ['Attendance policy.pdf', 'Sarah Williams', '10 Oct 2026', 'All staff', '86 KB'],
];

export function Documents() {
  const [sel, setSel] = useState(0);
  const f = FILES[sel];
  return (
    <>
      <PageHeader
        title="Documents"
        desc="Organise school files, control access and keep essential records easy to find."
        actions={[{ label: 'New folder' }, { label: 'Upload files', icon: <Upload size={15} />, primary: true }]}
        context
      />
      <div className="grid4">
        {[['Student records', '1,248 folders'], ['Staff records', '92 folders'], ['School policies', '24 documents'], ['Finance & billing', '186 documents']].map(([a, b]) => (
          <Card key={a}><div className="row" style={{ justifyContent: 'flex-start', gap: 12 }}><div className="sym" style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--tint)', color: 'var(--pr)', display: 'grid', placeItems: 'center' }}><Folder size={16} /></div><div><b style={{ fontSize: 13 }}>{a}</b><div className="xs muted">{b}</div></div></div></Card>
        ))}
      </div>
      <div className="cols s354">
        <Card style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="sh"><div><h3>School policies</h3><p>School documents / School policies</p></div><span className="link">Folder settings</span></div>
          <Tabs items={['All files', 'Recent', 'Shared with me', 'Archived']} />
          <div className="filters"><SearchBox placeholder="Search file name or owner" width={300} /><Select>All file types</Select><Select>All permissions</Select></div>
          <div className="tablebox">
            <DataTable cols={[
              { label: 'Name', render: (r) => <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><FileText size={16} style={{ color: 'var(--pr)' }} /><b style={{ fontWeight: 500 }}>{r[0]}</b></span> },
              { label: 'Owner', key: 1 }, { label: 'Modified', key: 2 }, { label: 'Access', key: 3 }, { label: 'Size', key: 4 },
              { label: 'Action', render: (r) => <span className="act" onClick={() => setSel(FILES.indexOf(r))}>Open</span> },
            ]} rows={FILES} />
            <Pager text="Showing 1–7 of 24 documents" />
          </div>
        </Card>
        <div className="stack">
          <Card>
            <h3 style={{ fontSize: 15, fontWeight: 600 }}>Document details</h3>
            <p className="small muted" style={{ marginTop: 4 }}>{f[0]}</p>
            <div style={{ margin: '16px 0', border: '1px solid var(--bd)', borderRadius: 8, padding: 24, background: 'var(--sb)', textAlign: 'center' }}>
              <FileText size={28} style={{ color: 'var(--pr)' }} /><b style={{ display: 'block', margin: '8px 0 2px', fontSize: 12 }}>Oakridge Academy</b><span className="xs muted">{f[0].replace('.pdf', '')}<br />2026–2027</span>
            </div>
            <KV rows={[['File type', 'PDF document'], ['Size', f[4]], ['Owner', f[1]], ['Modified', f[2]], ['Version', '3.0 · Current']]} />
            <div className="actions" style={{ marginTop: 14 }}><button className="btn primary"><Download size={14} />Download</button><button className="btn">Share</button></div>
          </Card>
          <Card>
            <SectionHead title="Permissions" link="Manage →" />
            <div className="pills" style={{ margin: '14px 0 10px', flexDirection: 'column', alignItems: 'flex-start' }}><Pill tone="purple">{f[3]} · Can view</Pill><Pill>School administrators · Can edit</Pill></div>
            <p className="body-s">External access is disabled. This file is included in staff induction and safeguarding training.</p>
            <span className="link" style={{ marginTop: 12 }}>View access history →</span>
          </Card>
        </div>
      </div>
      <Card className="notice" style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <ShieldCheck size={18} style={{ color: 'var(--pr)' }} />
        <div><h4>Secure by default</h4><p>Student and staff records are restricted to authorised teams. Shared links respect existing permissions and access is logged.</p></div>
      </Card>
      <Footer />
    </>
  );
}

/* ---------- Settings ---------- */
// One section per tab; the tab is kept in the URL (/settings?tab=academic) so it survives reloads and can be linked to.
const SETTINGS_TABS = [
  ['general', 'General'], ['academic', 'Academic setup'], ['users', 'Users & permissions'],
  ['notifications', 'Notifications'], ['security', 'Security & audit'], ['integrations', 'Integrations'],
];
// Tabs whose fields are saved with the page-level Save / Discard buttons (the others save inside their cards)
const FORM_TABS = ['general', 'academic', 'notifications'];

export function Settings() {
  const [params, setParams] = useSearchParams();
  const index = Math.max(0, SETTINGS_TABS.findIndex(([key]) => key === params.get('tab')));
  const tab = SETTINGS_TABS[index][0];
  const setTab = (i) => setParams(i === 0 ? {} : { tab: SETTINGS_TABS[i][0] }, { replace: true });

  return (
    <>
      <PageHeader
        title="Settings"
        desc="Manage your school profile, academic setup and workspace preferences."
        actions={FORM_TABS.includes(tab) ? [{ label: 'Discard changes' }, { label: 'Save changes', icon: <Check size={15} />, primary: true }] : []}
      />
      <Tabs items={SETTINGS_TABS.map(([, label]) => label)} value={index} onChange={setTab} />

      {tab === 'general' && (
        <div className="cols s404">
          <div className="stack">
            <Card>
              <div className="cardhead"><h3>School profile</h3><p>Used across the parent portal, documents and communications.</p></div>
              <div className="photo"><div className="bigavatar" style={{ borderRadius: 14 }}><Cog size={22} /></div>
                <div><button className="btn"><Upload size={15} />Change school crest</button><small>SVG or PNG · Recommended 256 × 256 px</small></div></div>
              <FieldGrid cols={[
                [{ label: 'School name', required: true, value: 'Oakridge Academy' }, { label: 'School email', required: true, value: 'office@oakridge.ac.uk' }],
                [{ label: 'Campus name', required: true, value: 'Main campus' }, { label: 'School phone', required: true, value: '+44 1865 555 100' }],
                [{ label: 'School reference', value: 'OA-00482' }, { label: 'Website', value: 'www.oakridge.ac.uk' }],
              ]} />
              <Field box label="School address" required value="12 Oakridge Road, Oxford, OX2 7AA, United Kingdom" />
            </Card>
          </div>
          <div className="stack">
            <Card>
              <h3 style={{ fontSize: 15, fontWeight: 600 }}>Regional preferences</h3>
              <div className="fieldlist">
                <Field box label="Time zone" select value="Europe/London (BST)" />
                <Field box label="Currency" select value="GBP · British pound (£)" />
                <Field box label="Date format" select value="DD MMM YYYY" />
                <Field box label="Language" select value="English (United Kingdom)" />
              </div>
            </Card>
          </div>
        </div>
      )}

      {tab === 'academic' && (
        <div className="stack">
          <Card>
            <SectionHead title="Academic year & term" sub="Current school calendar and operational dates." link="Manage term dates →" />
            <FieldGrid cols={[
              [{ label: 'Academic year', required: true, select: true, value: '2026–2027' }, { label: 'Year starts', select: true, value: '01 September 2026' }],
              [{ label: 'Current term', required: true, select: true, value: 'Term 1', options: ['Term 1', 'Term 2', 'Term 3'] }, { label: 'Year ends', select: true, value: '23 July 2027' }],
              [{ label: 'Current week', value: `Week ${schoolDay(todayIso()).week} of ${schoolDay(todayIso()).weeks}` }, { label: 'Week structure', select: true, value: 'Monday–Friday' }],
            ]} />
            <Card className="notice" style={{ marginTop: 16, padding: 14 }}><h4>Half-term: 26–30 October</h4><p>School reopens Monday, 2 November. Attendance registers and recurring lessons pause during the break.</p></Card>
          </Card>
        </div>
      )}

      {/* authservice: GET /api/v1/roles, GET|POST /api/v1/roles/{roleId}/permissions */}
      {tab === 'users' && <div className="stack"><RolesCard /></div>}

      {tab === 'notifications' && (
        <div className="stack">
          <Card>
            <div className="cardhead"><h3>Notifications</h3><p>Your administrator notification preferences.</p></div>
            {[['Attendance alerts', 'Unexcused absences and late registers'], ['Fee reminders', 'Overdue accounts and reconciliations'], ['Leave requests', 'New staff requests awaiting approval'], ['Daily school digest', 'A summary at 16:30 each school day']].map(([a, b]) => (
              <div className="attrow" key={a}><div><b style={{ fontWeight: 500 }}>{a}</b><div className="xs muted">{b}</div></div><span className="toggle" /></div>
            ))}
            <span className="link" style={{ marginTop: 10 }}>Manage school-wide notifications →</span>
          </Card>
        </div>
      )}

      {/* authservice: GET /api/v1/mfa/config, GET /api/v1/security/session-config, GET /api/v1/audit/logs */}
      {tab === 'security' && <div className="stack"><SecurityCard /></div>}

      {tab === 'integrations' && (
        <div className="stack">
          <Card>
            <div className="cardhead"><h3>Integrations</h3><p>Connect payment gateways, SMS providers and other systems.</p></div>
            <p className="body-s muted" style={{ marginTop: 12 }}>No integrations are configured for this school yet. API tokens for third-party systems are issued by authservice (US-00007) and will be managed here.</p>
          </Card>
        </div>
      )}
      <Footer />
    </>
  );
}

/* ---------- Help ---------- */
export function Help() {
  const { user } = useAuth();
  const topics = [[GraduationCap, 'Students & admissions', 'Create records, enrol students and update guardians.', 12], [Users, 'Staff & faculty', 'Manage employment, teaching assignments and leave.', 9],
    [ClipboardCheck, 'Attendance', 'Complete registers and follow up on absences.', 8], [Wallet, 'Fees & payments', 'Record payments, reconcile invoices and send reminders.', 11],
    [FolderOpen, 'Academics & reports', 'Build timetables, enter grades and export reports.', 14], [Cog, 'Settings & security', 'Manage users, permissions and school preferences.', 7]];
  return (
    <>
      <PageHeader title="Help & support" desc="Find answers, learn school workflows and get help from our support team."
        actions={[{ label: 'Create support ticket', icon: <Plus size={15} />, primary: true }]} />
      <div className="cols s404">
        <div className="stack">
          <Card className="helphero">
            <h2>How can we help you, {user.name.split(' ')[0]}?</h2>
            <p className="small muted">Search step-by-step guides for your Oakridge Academy workspace.</p>
            <SearchBox placeholder="Search help articles, workflows or a question..." />
            <p className="small muted">Popular: <span className="link">Add a student</span> · <span className="link">Record a payment</span> · <span className="link">Reset a user’s access</span></p>
          </Card>
          <Card>
            <div className="cardhead"><h3>Browse help topics</h3><p>Practical guides for your school’s day-to-day work</p></div>
            <div className="topics">
              {topics.map(([Icon, t, d, n]) => (
                <div className="topic" key={t}><div className="sym"><Icon size={16} /></div><div><b>{t}</b><p>{d}</p><span className="link">{n} articles →</span></div></div>
              ))}
            </div>
          </Card>
          <Card>
            <SectionHead title="Your support tickets" sub="Track requests from the school office." link="View all tickets →" />
            <div style={{ marginTop: 18 }}>
              <DataTable boxed cols={[
                { label: 'Ticket / subject', render: (r) => <span className="cell-id"><b>{r[0]}</b><small>{r[1]}</small></span> },
                { label: 'Status', render: (r) => <Pill tone={r[2] === 'Resolved' ? 'green' : 'purple'}>{r[2]}</Pill> },
                { label: 'Updated', key: 3 }, { label: 'Action', render: () => act('View ticket') },
              ]} rows={[
                ['Fee statement export formatting', '#SUP-1048 · Finance & billing', 'In progress', 'Today · 09:12'],
                ['Update parent portal email', '#SUP-1032 · Account access', 'Resolved', '14 Oct 2026'],
              ]} />
            </div>
          </Card>
        </div>
        <div className="stack">
          <Card>
            <h3 style={{ fontSize: 15, fontWeight: 600 }}>Contact support</h3>
            <p className="small muted" style={{ margin: '4px 0 14px' }}>Our team is here to help.</p>
            <Pill tone="green">Support team online</Pill>
            <KV rows={[['Hours', 'Mon–Fri · 08:00–18:00 BST'], ['Response time', 'Usually within 2 hours']]} />
            <p className="link" style={{ display: 'block', margin: '8px 0 4px' }}>support@schoolworkspace.co.uk</p>
            <p className="small muted">+44 20 7946 0320</p>
            <button className="btn primary" style={{ margin: '16px 0 14px' }}>Start a conversation</button>
            <p className="xs muted">For urgent safeguarding concerns, follow your school’s safeguarding policy and contact the designated lead.</p>
          </Card>
          <Card>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Recommended guides</h3>
            {['Admit a new student: step by step →', 'Correct an attendance register →', 'Set up term fee reminders →', 'Prepare mid-term progress reports →'].map((g) => (
              <div key={g} style={{ marginTop: 12 }}><span className="link">{g}</span></div>
            ))}
          </Card>
          <Card>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>System status</h3>
            <Pill tone="green">All systems operational</Pill>
            <p className="body-s" style={{ margin: '12px 0' }}>Student records, payments and communications are running normally.</p>
            <span className="link">View service status →</span>
          </Card>
        </div>
      </div>
      <Footer />
    </>
  );
}
