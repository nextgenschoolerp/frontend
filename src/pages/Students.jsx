import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Download, Plus, ArrowLeft, Upload, Pencil, Check, Circle } from 'lucide-react';
import {
  PageHeader, Metrics, Card, SectionHead, Tabs, SearchBox, Select, DataTable, Pager, Person, Actions,
  Pill, FieldGrid, Field, Footer, KV, Docs,
} from '../components/ui.jsx';

export const STUDENTS = [
  ['Amara Thompson', 'ST-2024-106', 'Year 10A', 'Sarah Thompson', '97.8%', 'Active'],
  ['Oliver Bennett', 'ST-2024-107', 'Year 10A', 'James Bennett', '96.2%', 'Active'],
  ['Isla Patel', 'ST-2023-082', 'Year 9B', 'Priya Patel', '98.4%', 'Active'],
  ['Noah Williams', 'ST-2024-118', 'Year 10B', 'Emma Williams', '94.6%', 'Active'],
  ['Freya Clarke', 'ST-2025-041', 'Year 8A', 'Daniel Clarke', '99.1%', 'Active'],
  ['Leo Ahmed', 'ST-2024-129', 'Year 10A', 'Nadia Ahmed', '95.3%', 'Active'],
  ['Sophie Wilson', 'ST-2026-018', 'Year 7C', 'Helen Wilson', '96.8%', 'Needs update'],
  ['Theo Martin', 'ST-2023-064', 'Year 9A', 'Rachel Martin', '97.2%', 'Active'],
].map(([name, id, cls, guardian, att, status]) => ({ name, id, cls, guardian, att, status }));

export function StudentsDirectory() {
  const [q, setQ] = useState('');
  const rows = STUDENTS.filter((s) => `${s.name} ${s.id} ${s.guardian}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <PageHeader
        title="Students"
        desc="Manage admissions, student records and class placement across your school."
        actions={[
          { label: 'Export list', icon: <Download size={15} /> },
          { label: 'Add student', icon: <Plus size={15} />, primary: true, to: '/students/new' },
        ]}
      />
      <Metrics items={[
        ['Total students', '1,248', 'Across 44 classes'],
        ['New this term', '24', '2026–2027 admissions'],
        ['Admission applications', '12', 'Awaiting review'],
        ['Incomplete records', '3', 'Emergency contacts missing'],
      ]} />
      <Card style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div className="sh">
          <div><h3>Student directory</h3><p>All enrolled students · Main campus</p></div>
          <span className="link">Manage columns</span>
        </div>
        <Tabs items={['All students (1,248)', 'Admissions (12)', 'Archived']} />
        <div className="filters">
          <SearchBox placeholder="Search name, student ID or guardian" value={q} onChange={setQ} />
          <Select>All year groups</Select><Select>All classes</Select><Select>All statuses</Select>
          <button className="btn">More filters</button>
        </div>
        <div className="tablebox">
          <DataTable
            cols={[
              { label: 'Student', render: (s) => <Person name={s.name} sub={s.id} /> },
              { label: 'Class', key: 'cls' },
              { label: 'Primary guardian', key: 'guardian' },
              { label: 'Attendance', key: 'att' },
              { label: 'Status', render: (s) => <Pill tone={s.status === 'Active' ? 'green' : 'amber'}>{s.status}</Pill> },
              { label: 'Actions', render: (s) => (
                <Actions><Link to={`/students/${s.id.toLowerCase()}`}>View profile</Link><Link to={`/students/${s.id.toLowerCase()}/edit`}>Edit</Link></Actions>
              ) },
            ]}
            rows={rows}
          />
          <Pager text={`Showing 1–${rows.length} of 1,248 students`} />
        </div>
      </Card>
      <div className="cols eq">
        <Card>
          <SectionHead title="Admissions for 2026–2027" link="Review applications →" />
          <p className="body-s" style={{ marginTop: -6 }}>12 applications are ready for your team to review.</p>
          <div className="pills" style={{ marginTop: 14 }}><Pill tone="purple">8 new applications</Pill><Pill tone="amber">4 documents pending</Pill></div>
        </Card>
        <Card>
          <SectionHead title="Record health" link="Review 3 records →" />
          <p className="body-s" style={{ marginTop: -6 }}>Keep safeguarding and contact information up to date.</p>
          <p className="small muted" style={{ marginTop: 14 }}>1,245 complete records · 99.8% completion</p>
        </Card>
      </div>
      <Footer />
    </>
  );
}

/* ---------- add / edit form ---------- */

const DOCS_ADD = [
  ['Birth certificate', 'Identity and date of birth · Required'],
  ['Proof of address', 'Dated within the last 3 months · Required'],
  ['Previous school report', 'Academic history · Optional · Pending'],
];
const DOCS_EDIT = [
  ['Birth certificate.pdf', '284 KB · Verified 02 Sep 2024 · Verified'],
  ['Proof of address.pdf', '196 KB · Verified 02 Sep 2024 · Verified'],
  ['Medical care plan.pdf', '312 KB · Updated 01 Sep 2026 · Verified'],
];

export function StudentForm({ mode }) {
  const edit = mode === 'edit';
  const nav = useNavigate();
  const { id } = useParams();
  const v = (a, b) => (edit ? a : b);
  const back = edit ? `/students/${id}` : '/students';
  const submit = (e, to) => { e.preventDefault(); nav(to); };

  return (
    <form onSubmit={(e) => submit(e, edit ? back : '/students')} style={{ display: 'contents' }}>
      <PageHeader
        title={edit ? 'Edit student' : 'Add student'}
        desc={edit ? 'Update Amara Thompson’s information, contacts and supporting documents.' : 'Create a student record and prepare a new admission to Oakridge Academy.'}
        actions={[{ label: edit ? 'Back to profile' : 'Back to students', icon: <ArrowLeft size={15} />, to: back }]}
      />
      <div className="cols s404">
        <div className="stack">
          <Card>
            <div className="cardhead"><h3>Student & admission information</h3><p>Required fields are marked with an asterisk.</p></div>
            <div className="photo">
              <div className="bigavatar">{edit ? 'AT' : '+'}</div>
              <div>
                <button type="button" className="btn"><Upload size={15} />{edit ? 'Change photo' : 'Upload student photo'}</button>
                <small>JPG or PNG · Maximum 5 MB</small>
              </div>
              {edit && <Pill tone="green">Active student</Pill>}
            </div>
            <FieldGrid cols={[
              [
                { label: 'First name', required: true, value: v('Amara'), placeholder: 'Enter first name' },
                { label: 'Date of birth', required: true, select: true, value: v('12 May 2011'), placeholder: 'Select date' },
                { label: 'Admission date', required: true, select: true, value: v('02 September 2024'), placeholder: 'Select admission date' },
              ],
              [
                { label: 'Last name', required: true, value: v('Thompson'), placeholder: 'Enter last name' },
                { label: 'Gender', select: true, value: v('Female'), placeholder: 'Select gender', options: ['Female', 'Male', 'Non-binary', 'Prefer not to say'] },
                { label: 'Admission number', value: v('OA-2024-106'), placeholder: 'Enter admission number' },
              ],
              [
                { label: 'Preferred name', value: v('Amara'), placeholder: 'Enter preferred name' },
                { label: 'Student ID', value: v('ST-2024-106'), placeholder: 'Assigned on admission' },
                { label: 'Nationality', select: true, value: v('British'), placeholder: 'Select nationality', options: ['British', 'Irish', 'Other'] },
              ],
            ]} />
          </Card>

          <Card>
            <div className="cardhead"><h3>Class placement</h3><p>Assign the student to the current academic year.</p></div>
            <FieldGrid cols={[
              [
                { label: 'Academic year', required: true, select: true, value: '2026–2027' },
                { label: 'Form tutor', value: v('Eleanor Hughes'), placeholder: 'Assigned from class' },
              ],
              [
                { label: 'Year group', required: true, select: true, value: v('Year 10'), placeholder: 'Select year group', options: ['Year 7', 'Year 8', 'Year 9', 'Year 10', 'Year 11'] },
                { label: 'House', select: true, value: v('Willow'), placeholder: 'Select house', options: ['Willow', 'Oak', 'Ash', 'Elm'] },
              ],
              [
                { label: 'Class', required: true, select: true, value: v('10A'), placeholder: 'Select class', options: ['10A', '10B', '9A', '9B'] },
                { label: 'Enrolment status', select: true, value: v('Active', 'Pending admission'), options: ['Active', 'Pending admission'] },
              ],
            ]} />
          </Card>

          <Card>
            <div className="cardhead"><h3>Guardian & emergency contacts</h3><p>At least one guardian and one emergency contact are required.</p></div>
            <FieldGrid cols={[
              [
                { label: 'Primary guardian', required: true, value: v('Sarah Thompson'), placeholder: 'Enter full name' },
                { label: 'Email address', required: true, value: v('s.thompson@example.com'), placeholder: 'Enter email address' },
                { label: 'Emergency contact', required: true, value: v('David Thompson'), placeholder: 'Enter emergency contact' },
              ],
              [
                { label: 'Relationship', required: true, select: true, value: v('Mother'), placeholder: 'Select relationship', options: ['Mother', 'Father', 'Guardian', 'Other'] },
                { label: 'Secondary guardian', value: v('David Thompson · Father'), placeholder: 'Enter full name & relationship' },
                { label: 'Emergency phone', required: true, value: v('+44 7700 900 143'), placeholder: 'Enter emergency number' },
              ],
              [
                { label: 'Mobile number', required: true, value: v('+44 7700 900 142'), placeholder: 'Enter mobile number' },
                { label: 'Secondary phone', value: v('+44 7700 900 143'), placeholder: 'Enter mobile number' },
                { label: 'Collection permission', select: true, value: v('Both guardians authorised'), placeholder: 'Select authorised contacts', options: ['Both guardians authorised', 'Primary guardian only'] },
              ],
            ]} />
            <Field box label="Home address" required value={v('24 Willow Lane, Oxford, OX2 7AB')} placeholder="Enter street address, town and postcode" />
            <label className="check"><input type="checkbox" defaultChecked />Primary guardian receives school notices and fee reminders.</label>
          </Card>
        </div>

        <div className="stack">
          <Card className="notice">
            <h4>{edit ? 'Editing Amara Thompson' : 'New student admission'}</h4>
            <p>{edit
              ? 'Changes update the existing student record. The student ID and admission history are retained.'
              : 'Create a complete record before confirming admission. You can save a draft at any time.'}</p>
          </Card>
          <Card>
            <div className="cardhead"><h3>Medical information</h3><p>Restricted to authorised staff.</p></div>
            <div className="fieldlist">
              <Field box label="Medical conditions" value={v('Mild asthma')} placeholder="Enter conditions or “None”" />
              <Field box label="Allergies" value={v('No known allergies')} placeholder="Enter allergies or “None”" />
              <Field box label="Medication / care instructions" value={v('Salbutamol inhaler held at school office.')} placeholder="Enter medication and care instructions" />
              <Field box label="GP / surgery contact" value={v('Willow Medical Centre · 01865 555 210')} placeholder="Enter surgery name and phone" />
            </div>
            <div style={{ marginTop: 18 }}><Pill tone="purple">Restricted · Safeguarding team</Pill></div>
          </Card>
          <Card>
            <div className="cardhead"><h3>Documents</h3><p>PDF, JPG or PNG · Up to 10 MB per file.</p></div>
            <div style={{ margin: '14px 0' }}><Docs items={edit ? DOCS_EDIT : DOCS_ADD} /></div>
            <button type="button" className="btn"><Upload size={15} />Upload documents</button>
          </Card>
          <Card>
            <h3 style={{ fontSize: 15, fontWeight: 600 }}>Record checklist</h3>
            <div className="checklist">
              {(edit
                ? ['Student & admission information', 'Class and form tutor assigned', 'Guardian and emergency contacts', 'Medical information reviewed', 'Supporting documents verified']
                : ['Student & admission information', 'Class placement', 'Guardian and emergency contacts', 'Medical declaration', 'Required documents']
              ).map((t) => (
                <div key={t} className={edit ? 'ok' : ''} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {edit ? <Check size={13} /> : <Circle size={11} />}<span style={{ color: 'var(--mu)' }}>{t}</span>
                </div>
              ))}
            </div>
            <p className="xs muted" style={{ marginTop: 18 }}>Only authorised staff can access personal information. Changes are recorded in the audit log.</p>
          </Card>
        </div>
      </div>

      <div className="formbar">
        <span>{edit ? 'Last updated 09 Oct 2026 by Sarah Williams' : 'Draft not yet saved · Required fields must be completed before admission'}</span>
        <div className="actions">
          <Link to={back} className="btn">Cancel</Link>
          {edit
            ? <><button type="button" className="btn">Save changes</button><button type="submit" className="btn primary">Save & view profile</button></>
            : <><button type="button" className="btn">Save draft</button><button type="submit" className="btn primary"><Plus size={15} />Add student</button></>}
        </div>
      </div>
      <Footer />
    </form>
  );
}

/* ---------- profile ---------- */

export function StudentProfile() {
  const { id } = useParams();
  return (
    <>
      <PageHeader
        title="Student profile"
        desc="A complete view of student progress, wellbeing and school records."
        actions={[
          { label: 'Download record', icon: <Download size={15} /> },
          { label: 'Edit student', icon: <Pencil size={14} />, primary: true, to: `/students/${id}/edit` },
        ]}
      />
      <Card className="summary">
        <div className="bigavatar">AT</div>
        <div className="id">
          <h2>Amara Thompson</h2>
          <p>ST-2024-106 · Year 10A · Willow house</p>
          <div className="pills"><Pill tone="green">Active</Pill><Pill tone="purple">Medical care plan</Pill></div>
        </div>
        <div className="side">
          <span>Form tutor: Eleanor Hughes</span><span>Admitted 02 September 2024</span>
          <span className="link strong">Message guardian →</span>
        </div>
      </Card>
      <Tabs items={['Overview', 'Academics', 'Attendance', 'Fees & payments', 'Guardians', 'Documents']} />
      <div className="cols">
        <div className="stack">
          <Card>
            <SectionHead title="Academic progress" sub="Term 1 · Latest assessment results" link="View academics →" to="/academics" />
            <div style={{ margin: '18px 0 14px' }}>
              <DataTable boxed cols={[
                { label: 'Subject', key: 'a' }, { label: 'Teacher', key: 'b' }, { label: 'Grade', key: 'c', className: 'num' },
                { label: 'Progress', render: (r) => <span style={{ color: r.d === 'Above expected' ? 'var(--gr)' : 'var(--pr)', fontWeight: 500 }}>{r.d}</span> },
              ]} rows={[
                { a: 'Mathematics', b: 'Eleanor Hughes', c: '8', d: 'Above expected' },
                { a: 'English language', b: 'James Carter', c: '7', d: 'On track' },
                { a: 'Combined science', b: 'Aisha Rahman', c: '8–8', d: 'Above expected' },
                { a: 'History', b: 'Charlotte Evans', c: '7', d: 'On track' },
              ]} />
            </div>
            <p className="xs muted">Mid-term progress reports due Friday, 23 October at 16:00.</p>
          </Card>
          <div className="cols eq">
            <Card>
              <SectionHead title="Attendance" sub="Term 1 to date" link="Register →" to="/attendance" />
              <div className="bignum" style={{ marginTop: 18 }}>97.8%</div>
              <div className="bar" style={{ margin: '14px 0 12px' }}><i style={{ width: '85%' }} /></div>
              <p className="xs muted" style={{ marginBottom: 14 }}>44 present · 1 excused · 0 unexcused</p>
              <Pill tone="green">Present today</Pill>
            </Card>
            <Card>
              <SectionHead title="Fee status" sub="Term 1 · 2026–2027" link="View account →" to="/fees" />
              <div className="bignum" style={{ marginTop: 18 }}>£0.00</div>
              <p className="xs muted" style={{ margin: '14px 0 12px' }}>Outstanding balance</p>
              <Pill tone="green">Paid in full</Pill>
              <p className="xs muted" style={{ marginTop: 12 }}>£2,400 received · 05 September 2026</p>
            </Card>
          </div>
          <Card>
            <SectionHead title="Guardians & emergency contacts" link="Manage contacts →" />
            <div className="contacts" style={{ marginTop: 18 }}>
              <div><h4>Sarah Thompson</h4><Pill tone="purple">Mother · Primary contact</Pill><p>+44 7700 900 142</p><p className="link" style={{ display: 'block' }}>s.thompson@example.com</p></div>
              <div><h4>David Thompson</h4><Pill>Father · Emergency contact</Pill><p>+44 7700 900 143</p><p>Authorised for collection</p></div>
            </div>
          </Card>
        </div>
        <div className="stack">
          <Card>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Personal information</h3>
            <KV rows={[['Date of birth', '12 May 2011 · Age 15'], ['Gender', 'Female'], ['Nationality', 'British'], ['Admission number', 'OA-2024-106'], ['Address', '24 Willow Lane, Oxford, OX2 7AB']]} />
          </Card>
          <Card>
            <div className="cardhead"><h3>Medical & wellbeing</h3><p>Restricted · Authorised staff only</p></div>
            <div style={{ margin: '14px 0' }}><Pill tone="amber">Mild asthma</Pill></div>
            <p className="body-s">Salbutamol inhaler held at the school office. No known allergies. Care plan reviewed 01 September 2026.</p>
            <KV rows={[['GP surgery', 'Willow Medical Centre']]} />
          </Card>
          <Card>
            <SectionHead title="Documents" link="View all →" />
            <div style={{ marginTop: 14 }}>
              <Docs items={[['Birth certificate.pdf', '284 KB · 02 Sep 2024 · Verified'], ['Proof of address.pdf', '196 KB · 02 Sep 2024 · Verified'], ['Medical care plan.pdf', '312 KB · 01 Sep 2026 · Verified']]} />
            </div>
          </Card>
        </div>
      </div>
      <Footer />
    </>
  );
}
