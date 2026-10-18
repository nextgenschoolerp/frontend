import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Download, Plus, ArrowLeft, Pencil, Upload } from 'lucide-react';
import {
  PageHeader, Metrics, Card, SectionHead, Tabs, SearchBox, Select, DataTable, Pager, Person, Actions,
  Pill, FieldGrid, Field, Footer, KV, Docs, downloadCsv,
} from '../components/ui.jsx';
import { useRoleOptions, Modal } from '../components/AuthSettings.jsx';

const STAFF = [
  ['Eleanor Hughes', 'SF-2018-014', 'Head of Mathematics', 'Mathematics', 'Teaching', 'On campus'],
  ['James Carter', 'SF-2020-028', 'English teacher', 'English', 'Teaching', 'On campus'],
  ['Aisha Rahman', 'SF-2019-021', 'Science teacher', 'Science', 'Teaching', 'On campus'],
  ['Charlotte Evans', 'SF-2021-037', 'History teacher', 'Humanities', 'Teaching', 'Approved leave'],
  ['Michael Brooks', 'SF-2017-009', 'Head of year 10', 'Pastoral', 'Teaching', 'On campus'],
  ['Grace Taylor', 'SF-2022-043', 'School nurse', 'Student wellbeing', 'Support', 'On campus'],
  ['Daniel Foster', 'SF-2020-031', 'Finance officer', 'Administration', 'Support', 'On campus'],
  ['Lucy Morgan', 'SF-2023-056', 'Learning support assistant', 'Learning support', 'Support', 'On campus'],
].map(([name, id, role, dept, type, avail]) => ({ name, id, role, dept, type, avail }));

export function StaffDirectory() {
  const [q, setQ] = useState('');
  const rows = STAFF.filter((s) => `${s.name} ${s.id} ${s.role}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <PageHeader
        title="Staff & faculty"
        desc="Manage your teaching and support teams, assignments and employment records."
        actions={[
          { label: 'Export list', icon: <Download size={15} />, onClick: () => downloadCsv('staff', ['Name', 'Staff ID', 'Role', 'Department', 'Type', 'Availability'],
            rows.map((r) => [r.name, r.id, r.role, r.dept, r.type, r.avail])) },
          { label: 'Add staff member', icon: <Plus size={15} />, primary: true, to: '/staff/new' },
        ]}
      />
      <Metrics items={[
        ['Total staff', '92', '68 teaching · 24 support'],
        ['On campus today', '86', 'All lessons covered'],
        ['Approved leave', '6', 'Cover arrangements confirmed'],
        ['Leave requests', '4', 'Awaiting approval for next week'],
      ]} />
      <Card style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div className="sh"><div><h3>Staff directory</h3><p>Main campus · Active employees</p></div><span className="link">Manage columns</span></div>
        <Tabs items={['All staff (92)', 'Teaching (68)', 'Support (24)', 'Archived']} />
        <div className="filters">
          <SearchBox placeholder="Search name, staff ID or email" value={q} onChange={setQ} />
          <Select>All roles</Select><Select>All departments</Select><Select>All availability</Select>
          <button className="btn">More filters</button>
        </div>
        <div className="tablebox">
          <DataTable
            cols={[
              { label: 'Staff member', render: (s) => <Person name={s.name} sub={s.id} /> },
              { label: 'Role', key: 'role' },
              { label: 'Department', key: 'dept' },
              { label: 'Type', key: 'type' },
              { label: 'Availability', render: (s) => <Pill tone={s.avail === 'On campus' ? 'green' : 'amber'}>{s.avail}</Pill> },
              { label: 'Actions', render: (s) => (
                <Actions><Link to={`/staff/${s.id.toLowerCase()}`}>View profile</Link><Link to={`/staff/${s.id.toLowerCase()}/edit`}>Edit</Link></Actions>
              ) },
            ]}
            rows={rows}
          />
          <Pager text={`Showing 1–${rows.length} of 92 staff members`} />
        </div>
      </Card>
      <div className="cols eq">
        <Card>
          <SectionHead title="Leave & cover" link="Manage cover →" />
          <p className="body-s" style={{ marginTop: -6 }}>6 staff on approved leave today. All timetabled lessons have cover.</p>
          <div className="pills" style={{ marginTop: 14 }}><Pill tone="green">100% lessons covered</Pill><Pill tone="amber">4 requests pending</Pill></div>
        </Card>
        <Card>
          <SectionHead title="Staff compliance" link="View compliance →" />
          <p className="body-s" style={{ marginTop: -6 }}>Safeguarding refresher training is due Friday, 23 October.</p>
          <p className="small muted" style={{ marginTop: 14 }}>84 of 92 staff complete · 8 reminders scheduled</p>
        </Card>
      </div>
      <Footer />
    </>
  );
}

/* ---------- profile ---------- */

const LEAVE_TYPES = ['Annual leave', 'Sick leave', 'Training / CPD', 'Compassionate leave', 'Unpaid leave'];
const fmtDay = (d) => new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
/** School days (Mon–Fri) from `from` to `to`, inclusive; a half day counts 0.5. */
function leaveDays(from, to, half) {
  let n = 0;
  for (let d = new Date(`${from}T00:00:00`); d <= new Date(`${to}T00:00:00`); d.setDate(d.getDate() + 1)) if (d.getDay() % 6) n += 1;
  return half && n === 1 ? 0.5 : n;
}

/** Record leave dialog. There is no staff / HR service yet, so requests live in the page until it is reloaded. */
function RecordLeaveModal({ name, onClose, onSave }) {
  const today = new Date().toISOString().slice(0, 10);
  const [error, setError] = useState('');
  const submit = (e) => {
    e.preventDefault();
    const v = Object.fromEntries(new FormData(e.currentTarget));
    if (!v.type || !v.from || !v.to) { setError('Choose the leave type and both dates.'); return; }
    if (v.to < v.from) { setError('The last day cannot be before the first day.'); return; }
    const days = leaveDays(v.from, v.to, v.half === 'on');
    if (!days) { setError('The dates fall on a weekend; choose at least one school day.'); return; }
    onSave({ type: v.type, from: v.from, to: v.to, days, reason: v.reason.trim(), status: 'Pending approval' });
    onClose();
  };
  return (
    <Modal title="Record leave" sub={name} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" form="leave-form">Record leave</button></>}>
      <form id="leave-form" className="fieldlist" noValidate onSubmit={submit}>
        <div className="field box"><label htmlFor="leave-type">LEAVE TYPE *</label>
          <select id="leave-type" name="type" defaultValue=""><option value="" disabled>Select leave type</option>{LEAVE_TYPES.map((t) => <option key={t}>{t}</option>)}</select></div>
        <div className="field box"><label htmlFor="leave-from">FIRST DAY *</label><input id="leave-from" name="from" type="date" defaultValue={today} /></div>
        <div className="field box"><label htmlFor="leave-to">LAST DAY *</label><input id="leave-to" name="to" type="date" defaultValue={today} /></div>
        <label className="check"><input type="checkbox" name="half" />Half day (single-day leave only)</label>
        <div className="field box"><label htmlFor="leave-reason">REASON / COVER NOTES</label><input id="leave-reason" name="reason" placeholder="Optional" /></div>
        {error && <div className="api-error"><span>{error}</span></div>}
        <p className="xs muted">Requests are kept on this page only until the staff service is connected.</p>
      </form>
    </Modal>
  );
}

// One section per tab, kept in the URL (/staff/:id?tab=timetable); Overview shows the whole summary
const STAFF_TABS = [
  ['overview', 'Overview'], ['teaching', 'Teaching assignments'], ['timetable', 'Timetable'],
  ['leave', 'Leave & attendance'], ['documents', 'Documents'],
];

export function StaffProfile() {
  const [params, setParams] = useSearchParams();
  const index = Math.max(0, STAFF_TABS.findIndex(([key]) => key === params.get('tab')));
  const tab = STAFF_TABS[index][0];
  const setTab = (i) => setParams(i === 0 ? {} : { tab: STAFF_TABS[i][0] }, { replace: true });
  const [leaves, setLeaves] = useState([]);
  const [recording, setRecording] = useState(false);
  const upcoming = leaves.filter((l) => l.to >= new Date().toISOString().slice(0, 10)).sort((a, b) => a.from.localeCompare(b.from));

  const assignmentsCard = (
    <Card>
      <SectionHead title="Teaching assignments" sub="2026–2027 · Term 1" link="Manage assignments →" />
      <div style={{ margin: '18px 0 14px' }}>
        <DataTable boxed cols={[
          { label: 'Class', key: 'a' }, { label: 'Subject', key: 'b' }, { label: 'Students', key: 'c' },
          { label: 'Lessons / week', key: 'd' }, { label: 'Room', key: 'e' },
        ]} rows={[
          { a: 'Year 10A', b: 'Mathematics', c: 28, d: 4, e: 'M02' },
          { a: 'Year 10B', b: 'Mathematics', c: 29, d: 4, e: 'M02' },
          { a: 'Year 11A', b: 'Further mathematics', c: 22, d: 4, e: 'M02' },
          { a: 'Year 9C', b: 'Mathematics', c: 27, d: 4, e: 'M03' },
        ]} />
      </div>
      <p className="xs muted">Form tutor: Year 10A · 16 teaching periods per week</p>
    </Card>
  );
  const timetableCard = (
    <Card>
      <SectionHead title="Today’s timetable" sub="Friday, 16 October · Week A" link="Full timetable →" to="/academics" />
      <div style={{ marginTop: 18 }}>
        <DataTable boxed cols={[
          { label: 'Time', key: 'a' }, { label: 'Lesson', key: 'b' }, { label: 'Class', key: 'c' }, { label: 'Room', key: 'd' },
        ]} rows={[
          { a: '08:30–08:50', b: 'Registration', c: '10A', d: 'M02' },
          { a: '09:00–10:00', b: 'Mathematics', c: '10A', d: 'M02' },
          { a: '10:20–11:20', b: 'Further mathematics', c: '11A', d: 'M02' },
          { a: '11:20–12:20', b: 'Planning & preparation', c: '—', d: 'Staff room' },
          { a: '13:10–14:10', b: 'Mathematics', c: '9C', d: 'M03' },
        ]} />
      </div>
    </Card>
  );
  const qualificationsCard = (
    <Card>
      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Qualifications & professional development</h3>
      <KV rows={[
        ['Qualifications', 'BSc Mathematics · University of Bristol, 2013'],
        ['Teaching status', 'PGCE Secondary Mathematics · QTS, 2014'],
        ['Latest training', 'Safeguarding refresher · Completed 12 Oct 2026'],
      ]} />
    </Card>
  );
  const employmentCard = (
    <Card>
      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Employment & contact</h3>
      <KV rows={[
        ['Department', 'Mathematics'], ['Line manager', 'Dr Helen Morris · Deputy head'], ['Contract', 'Permanent · 1.0 FTE'],
        ['Emergency contact', 'Thomas Hughes · Spouse'], ['Emergency phone', '+44 7700 900 215'],
      ]} />
    </Card>
  );
  const leaveCard = (
    <Card>
      <SectionHead title="Leave & attendance" sub="Academic year 2026–2027" link="Leave history →" />
      <div className="row" style={{ justifyContent: 'flex-start', gap: 40, margin: '18px 0 14px', alignItems: 'flex-start' }}>
        <div><div style={{ fontSize: 26, fontWeight: 600 }}>2 days</div><div className="xs muted">Approved leave taken</div></div>
        <div><div style={{ fontSize: 26, fontWeight: 600 }}>{leaves.length}</div><div className="xs muted">Pending requests</div></div>
      </div>
      {upcoming.length
        ? <Pill tone="amber">Upcoming: {upcoming[0].type} from {fmtDay(upcoming[0].from)}</Pill>
        : <Pill tone="green">No upcoming leave</Pill>}
      {leaves.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <DataTable boxed cols={[
            { label: 'Leave', render: (l) => <span className="cell-id"><b>{l.type}</b><small>{l.reason || '—'}</small></span> },
            { label: 'Dates', render: (l) => (l.from === l.to ? fmtDay(l.from) : `${fmtDay(l.from)} – ${fmtDay(l.to)}`) },
            { label: 'Days', key: 'days', className: 'num' },
            { label: 'Status', render: (l) => <Pill tone="amber">{l.status}</Pill> },
          ]} rows={leaves} />
        </div>
      )}
      <div style={{ marginTop: 16 }}><button type="button" className="btn" onClick={() => setRecording(true)}><Plus size={15} />Record leave</button></div>
    </Card>
  );
  const documentsCard = (
    <Card>
      <SectionHead title="Documents" sub="Restricted · Human resources" link="View all →" />
      <div style={{ marginTop: 14 }}>
        <Docs items={[['Employment contract.pdf', '412 KB · 01 Sep 2018 · Verified'], ['QTS certificate.pdf', '268 KB · 01 Sep 2018 · Verified'], ['DBS confirmation.pdf', '182 KB · Reviewed 01 Sep 2026 · Verified']]} />
      </div>
    </Card>
  );
  return (
    <>
      <PageHeader
        title="Staff profile"
        desc="Employment details, teaching responsibilities and staff records in one place."
        actions={[
          { label: 'Back to staff', icon: <ArrowLeft size={15} />, to: '/staff' },
          { label: 'Message staff' },
          { label: 'Edit staff details', icon: <Pencil size={14} />, primary: true, to: 'edit' },
        ]}
      />
      <Card className="summary">
        <div className="bigavatar">EH</div>
        <div className="id">
          <h2>Eleanor Hughes</h2>
          <p>SF-2018-014 · Head of Mathematics · Mathematics department</p>
          <div className="pills"><Pill tone="green">On campus</Pill><Pill tone="purple">Full-time · Permanent</Pill></div>
        </div>
        <div className="side">
          <span className="link strong">e.hughes@oakridge.ac.uk</span>
          <span>+44 7700 900 214 · Extension 204</span><span>Joined 01 September 2018</span>
        </div>
      </Card>
      <Tabs items={STAFF_TABS.map(([, label]) => label)} value={index} onChange={setTab} />
      {tab === 'overview' && (
        <div className="cols">
          <div className="stack">{assignmentsCard}{timetableCard}{qualificationsCard}</div>
          <div className="stack">{employmentCard}{leaveCard}{documentsCard}</div>
        </div>
      )}
      {tab === 'teaching' && <div className="stack">{assignmentsCard}{qualificationsCard}</div>}
      {tab === 'timetable' && <div className="stack">{timetableCard}</div>}
      {tab === 'leave' && <div className="stack">{leaveCard}</div>}
      {tab === 'documents' && <div className="stack">{documentsCard}</div>}
      {recording && <RecordLeaveModal name="Eleanor Hughes" onClose={() => setRecording(false)} onSave={(l) => setLeaves((all) => [...all, l])} />}
      <Footer />
    </>
  );
}

/* ---------- edit / add ---------- */

export function StaffForm() {
  const nav = useNavigate();
  const isNew = useLocation().pathname.endsWith('/new');
  const v = (a) => (isNew ? '' : a);
  // Role list comes from authservice GET /api/v1/roles (US-00002) when the user may read roles
  const roleOptions = useRoleOptions(['Head of department', 'Teacher', 'Finance officer', 'Administrator']);
  const back = isNew ? '/staff' : '/staff/sf-2018-014';
  return (
    <form onSubmit={(e) => { e.preventDefault(); nav(back); }} style={{ display: 'contents' }}>
      <PageHeader
        title={isNew ? 'Add staff member' : 'Edit staff details'}
        desc={isNew ? 'Create a staff record with employment and access details.' : 'Maintain Eleanor Hughes’s personal, employment and teaching information.'}
        actions={[{ label: isNew ? 'Back to staff' : 'Back to profile', icon: <ArrowLeft size={15} />, to: back }]}
      />
      <div className="cols s404">
        <div className="stack">
          <Card>
            <div className="cardhead"><h3>Personal & contact details</h3><p>Required fields are marked with an asterisk.</p></div>
            <div className="photo">
              <div className="bigavatar">{isNew ? '+' : 'EH'}</div>
              <button type="button" className="btn"><Upload size={15} />{isNew ? 'Upload photo' : 'Change photo'}</button>
              {!isNew && <Pill tone="purple">SF-2018-014</Pill>}
            </div>
            <FieldGrid cols={[
              [{ label: 'First name', required: true, value: v('Eleanor'), placeholder: 'Enter first name' }, { label: 'Work email', required: true, value: v('e.hughes@oakridge.ac.uk'), placeholder: 'Enter work email' }],
              [{ label: 'Last name', required: true, value: v('Hughes'), placeholder: 'Enter last name' }, { label: 'Mobile number', required: true, value: v('+44 7700 900 214'), placeholder: 'Enter mobile number' }],
              [{ label: 'Date of birth', required: true, select: true, value: v('18 February 1991'), placeholder: 'Select date' }, { label: 'Extension', value: v('204'), placeholder: 'Enter extension' }],
            ]} />
            <Field box label="Home address" value={v('18 Beech Road, Oxford, OX3 8HT')} placeholder="Enter street address, town and postcode" />
            <FieldGrid cols={[
              [{ label: 'Emergency contact', required: true, value: v('Thomas Hughes'), placeholder: 'Enter full name' }],
              [{ label: 'Relationship', select: true, value: v('Spouse'), placeholder: 'Select relationship', options: ['Spouse', 'Parent', 'Sibling', 'Friend', 'Other'] }],
              [{ label: 'Emergency phone', required: true, value: v('+44 7700 900 215'), placeholder: 'Enter emergency number' }],
            ]} />
          </Card>
          <Card>
            <div className="cardhead"><h3>Employment information</h3></div>
            <FieldGrid cols={[
              [
                { label: 'Staff ID', value: v('SF-2018-014'), placeholder: 'Assigned on creation' },
                { label: 'Department', required: true, select: true, value: v('Mathematics'), placeholder: 'Select department', options: ['Mathematics', 'English', 'Science', 'Humanities', 'Administration'] },
                { label: 'Contract type', required: true, select: true, value: v('Permanent'), placeholder: 'Select contract', options: ['Permanent', 'Fixed-term', 'Casual'] },
              ],
              [
                { label: 'Role / job title', required: true, value: v('Head of Mathematics'), placeholder: 'Enter job title' },
                { label: 'Line manager', required: true, select: true, value: v('Dr Helen Morris'), placeholder: 'Select line manager', options: ['Dr Helen Morris', 'Michael Brooks'] },
                { label: 'Working pattern', select: true, value: v('Full-time · 1.0 FTE'), placeholder: 'Select pattern', options: ['Full-time · 1.0 FTE', 'Part-time'] },
              ],
              [
                { label: 'Staff type', required: true, select: true, value: v('Teaching'), placeholder: 'Select type', options: ['Teaching', 'Support'] },
                { label: 'Start date', required: true, select: true, value: v('01 September 2018'), placeholder: 'Select date' },
                { label: 'Employment status', select: true, value: v('Active'), placeholder: 'Select status', options: ['Active', 'On leave', 'Archived'] },
              ],
            ]} />
          </Card>
          <Card>
            <SectionHead title="Teaching assignments" sub="2026–2027 · Term 1" link="Add assignment +" />
            <FieldGrid cols={[
              [{ label: 'Primary subject', required: true, select: true, value: v('Mathematics'), placeholder: 'Select subject' }],
              [{ label: 'Form tutor class', select: true, value: v('Year 10A'), placeholder: 'Select class' }],
              [{ label: 'Teaching room', select: true, value: v('M02'), placeholder: 'Select room' }],
            ]} />
            <div style={{ marginTop: 18 }}>
              <DataTable boxed cols={[
                { label: 'Class', key: 'a' }, { label: 'Subject', key: 'b' }, { label: 'Periods / week', key: 'c' },
                { label: 'Action', render: () => <span className="act">Remove</span> },
              ]} rows={isNew ? [] : [
                { a: 'Year 10A', b: 'Mathematics', c: 4 }, { a: 'Year 10B', b: 'Mathematics', c: 4 },
                { a: 'Year 11A', b: 'Further mathematics', c: 4 }, { a: 'Year 9C', b: 'Mathematics', c: 4 },
              ]} />
            </div>
          </Card>
        </div>
        <div className="stack">
          <Card className="notice">
            <h4>{isNew ? 'New staff record' : 'Existing staff record'}</h4>
            <p>{isNew ? 'A staff ID is assigned when the record is created.' : 'Updates apply to Eleanor Hughes. Staff ID, employment history and previous assignments are retained.'}</p>
          </Card>
          <Card>
            <h3 style={{ fontSize: 15, fontWeight: 600 }}>Qualifications</h3>
            <div className="fieldlist">
              <Field box label="Highest qualification" required value={v('BSc Mathematics · Bristol, 2013')} placeholder="Enter qualification" />
              <Field box label="Teaching qualification" value={v('PGCE Secondary Mathematics, 2014')} placeholder="Enter qualification" />
              <Field box label="QTS / teacher reference" value={v('QTS verified · TRN 14/58362')} placeholder="Enter reference" />
              <Field box label="Professional development" value={v('Safeguarding refresher · 12 Oct 2026')} placeholder="Enter latest training" />
            </div>
          </Card>
          <Card>
            <div className="cardhead"><h3>Compliance & documents</h3><p>Only HR and school administrators can access these files.</p></div>
            <div style={{ margin: '14px 0' }}>
              {!isNew && <Docs items={[['Employment contract.pdf', '412 KB · Signed 01 Sep 2018 · Verified'], ['QTS certificate.pdf', '268 KB · Verified · Verified'], ['DBS confirmation.pdf', '182 KB · Reviewed 01 Sep 2026 · Verified']]} />}
            </div>
            <button type="button" className="btn"><Upload size={15} />Upload document</button>
          </Card>
          <Card>
            <h3 style={{ fontSize: 15, fontWeight: 600 }}>Access & permissions</h3>
            <div className="fieldlist">
              <Field key={roleOptions.join()} box label="System role" select value={v(roleOptions.includes('Head of department') ? 'Head of department' : 'Department Head')} placeholder="Select role" options={roleOptions} />
              <Field box label="Record visibility" select value={v('Assigned classes & department')} placeholder="Select visibility" options={['Assigned classes & department', 'Whole school']} />
            </div>
            <label className="check"><input type="checkbox" defaultChecked />Staff portal access enabled</label>
            <label className="check"><input type="checkbox" defaultChecked />Receive operational notices</label>
            <label className="check"><input type="checkbox" />Finance administration access</label>
            <div style={{ marginTop: 16 }}><Pill>Permission changes are audited</Pill></div>
          </Card>
        </div>
      </div>
      <div className="formbar">
        <span>{isNew ? 'Draft not yet saved' : 'Last updated 12 Oct 2026 by Sarah Williams'}</span>
        <div className="actions">
          <Link to={back} className="btn">Cancel</Link>
          <button type="submit" className="btn primary">Save changes</button>
        </div>
      </div>
      <Footer />
    </form>
  );
}
