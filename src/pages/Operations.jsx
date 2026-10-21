import { useState } from 'react';
import { Plus, Download, Check, Upload } from 'lucide-react';
import {
  PageHeader, Metrics, Card, SectionHead, Tabs, SearchBox, Select, DataTable, Pager, Person, Pill, Footer, downloadCsv,
} from '../components/ui.jsx';
import { useAuth } from '../auth.jsx';
import { ROLES as financeRoles } from '../api/financeService.js';
import { FeesLive } from '../components/FeesLive.jsx';
import { AssessmentsLive } from '../components/AssessmentsLive.jsx';
import { ROLES as examRoles } from '../api/examService.js';
import { ApiNote } from '../components/Admissions.jsx';
import { TeachingLive } from '../components/TeachingLive.jsx';
import { ROLES as lmsRoles } from '../api/academicService.js';
import { AttendanceLive, useAttendanceAllowed } from '../components/AttendanceLive.jsx';
import { formatMoney } from '../regional.js';

const cur = (text) => text.replace(/£([\d,]+(?:\.\d+)?)/g, (_, n) => formatMoney(Number(n.replace(/,/g, ''))));

const act = (t) => <span className="act">{t}</span>;

/* ---------- Academics ---------- */
/** Live assessments for teachers, exam staff, principals and registrars; other roles see the sample page. */
export function Academics() {
  const { hasRole } = useAuth();
  if (hasRole(...examRoles.view)) return <AssessmentsLive />;
  return (
    <>
      <PageHeader
        title="Academics"
        desc="Coordinate classes, curriculum, teaching schedules and assessment deadlines."
        actions={[{ label: 'View timetable', to: '/teaching' }, { label: 'Add class', icon: <Plus size={15} />, primary: true }]}
      />
      <Card><ApiNote>Sample data. Assessment terms, mark entry and results are shown to teachers, the exam controller, principals and registrars.</ApiNote></Card>
      <Metrics items={[
        ['Active classes', '44', '1,248 students enrolled'],
        ['Curriculum subjects', '18', 'Across Years 7–13'],
        ['Teaching staff', '68', 'All classes assigned'],
        ['Assessment window', '23 Oct', 'Mid-term progress reports due'],
      ]} />
      <div className="cols">
        <div className="stack">
          <Card>
            <SectionHead title="Classes" sub="2026–2027 · Main campus" link="Manage classes →" />
            <div className="filters" style={{ margin: '18px 0' }}>
              <SearchBox placeholder="Search class or tutor" width={300} /><Select>All year groups</Select><Select>Term 1</Select>
            </div>
            <div className="tablebox">
              <DataTable cols={[
                { label: 'Class', key: 'a', className: 'num' }, { label: 'Form tutor', key: 'b' }, { label: 'Students', key: 'c' },
                { label: 'Room', key: 'd' }, { label: 'Action', render: () => act('View class') },
              ]} rows={[
                { a: 'Year 10A', b: 'Eleanor Hughes', c: '28 / 30', d: 'M02' },
                { a: 'Year 10B', b: 'Michael Brooks', c: '29 / 30', d: 'P01' },
                { a: 'Year 9A', b: 'Charlotte Evans', c: '28 / 30', d: 'H04' },
                { a: 'Year 9B', b: 'Aisha Rahman', c: '30 / 30', d: 'S03' },
                { a: 'Year 8A', b: 'James Carter', c: '27 / 30', d: 'E01' },
              ]} />
              <Pager text="Showing 5 of 44 classes" />
            </div>
          </Card>
          <Card>
            <SectionHead title="Subjects & curriculum" sub="Core and elective subjects" link="View all 18 subjects →" />
            <div style={{ marginTop: 18 }}>
              <DataTable boxed cols={[
                { label: 'Subject', key: 'a' }, { label: 'Head of department', key: 'b' }, { label: 'Classes', key: 'c' },
                { label: 'Scheme', render: () => <Pill tone="green">Published</Pill> },
              ]} rows={[
                { a: 'Mathematics', b: 'Eleanor Hughes', c: 32 }, { a: 'English', b: 'James Carter', c: 30 },
                { a: 'Science', b: 'Aisha Rahman', c: 28 }, { a: 'Humanities', b: 'Charlotte Evans', c: 24 },
              ]} />
            </div>
          </Card>
        </div>
        <div className="stack">
          <Card>
            <SectionHead title="Today’s timetable" sub="Year 10A · Friday, 16 October" link="Open timetable →" />
            <div style={{ margin: '18px 0 16px' }}>
              <DataTable boxed cols={[{ label: 'Time', key: 'a' }, { label: 'Subject', key: 'b' }, { label: 'Room', key: 'c' }]} rows={[
                { a: '08:30', b: 'Registration', c: 'M02' }, { a: '09:00', b: 'Mathematics', c: 'M02' },
                { a: '10:20', b: 'English language', c: 'E01' }, { a: '11:20', b: 'Combined science', c: 'S02' },
                { a: '13:10', b: 'History', c: 'H04' }, { a: '14:10', b: 'Physical education', c: 'Gym' },
              ]} />
            </div>
            <Pill tone="green">No scheduling conflicts</Pill>
          </Card>
          <Card>
            <SectionHead title="Assessment & reporting" sub="Term 1 · Mid-term review" link="Assessment centre →" />
            <div className="row" style={{ margin: '18px 0 12px' }}><b style={{ fontWeight: 500, fontSize: 12 }}>Progress reports</b><Pill tone="amber">Due 23 Oct</Pill></div>
            <p className="body-s">32 of 44 classes have submitted grades. 12 class reports are still in progress.</p>
            <p className="xs muted" style={{ margin: '14px 0' }}>Deadline: Friday, 23 October at 16:00</p>
            <button className="btn">Review submissions</button>
          </Card>
        </div>
      </div>
      <Card className="notice">
        <h4>Half-term planning</h4>
        <p>Half-term runs 26–30 October. Review cover and publish any timetable changes before school reopens on Monday, 2 November.</p>
      </Card>
      <Footer />
    </>
  );
}

/* ---------- Teaching & learning ---------- */
/** Live from academicservice (Module 06) for academic staff and principals; other roles see a note. */
export function Teaching() {
  const { hasRole } = useAuth();
  if (hasRole(...lmsRoles.view)) return <TeachingLive />;
  return (
    <>
      <PageHeader title="Teaching & learning" desc="Timetables, cover, syllabus progress, homework, lesson plans and lab bookings." />
      <Card><ApiNote>Timetables, cover, syllabus progress, homework and lesson plans are shown to teachers, the academic coordinator, the timetable and substitution in-charges, e-learning admins and principals.</ApiNote></Card>
      <Footer />
    </>
  );
}

/* ---------- Attendance ---------- */
// Live from studentservice (/api/v1/attendance): registers, absences and follow-ups; other roles see a note
export function Attendance() {
  const allowed = useAttendanceAllowed();
  if (allowed) return <AttendanceLive />;
  return (
    <>
      <PageHeader title="Attendance" desc="Monitor daily attendance, complete registers and follow up on student absences." />
      <Card><ApiNote>Attendance registers are shown to class teachers, the academic head, principals, the registrar and the school office.</ApiNote></Card>
      <Footer />
    </>
  );
}

// Sample amounts are written in pounds and shown in the school currency (Settings → Regional preferences)
const TRANSACTIONS = () => [
  ['Oliver Bennett', 'PAY-261016-04', '16 Oct 2026', 'Bank transfer', cur('£800.00')],
  ['Isla Patel', 'PAY-261016-03', '16 Oct 2026', 'Card', cur('£1,200.00')],
  ['Leo Ahmed', 'PAY-261015-12', '15 Oct 2026', 'Bank transfer', cur('£600.00')],
  ['Freya Clarke', 'PAY-261015-11', '15 Oct 2026', 'Direct debit', cur('£800.00')],
  ['Amara Thompson', 'PAY-260905-06', '05 Sep 2026', 'Bank transfer', cur('£2,400.00')],
];
const OUTSTANDING = () => [
  ['Noah Williams · 10B', 'INV-26-0418', '16 days', cur('£1,200.00'), '14 Oct'],
  ['Theo Martin · 9A', 'INV-26-0364', '16 days', cur('£800.00'), '14 Oct'],
  ['Emily Harris · 8B', 'INV-26-0281', '9 days', cur('£1,000.00'), '14 Oct'],
  ['Archie Green · 7A', 'INV-26-0142', '9 days', cur('£600.00'), '14 Oct'],
];
/** "Export statement": term summary, transactions and overdue accounts in one CSV. */
const exportStatement = () => downloadCsv('fee-statement-term1', ['Section', 'Student / account', 'Reference', 'Date / overdue', 'Detail', 'Amount'], [
  ['Summary', 'Term 1 billing', '', '', '', cur('£960,000')], ['Summary', 'Collected', '', '', '88.1%', cur('£846,000')],
  ['Summary', 'Not yet due', '', '02 Nov 2026', '', cur('£76,000')], ['Summary', 'Overdue', '', '', '38 accounts', cur('£38,000')],
  ...TRANSACTIONS().map(([n, ref, d, m, a]) => ['Payment', n, ref, d, m, a]),
  ...OUTSTANDING().map(([n, inv, od, bal, rem]) => ['Overdue', n, inv, od, `Last reminder ${rem}`, bal]),
]);

/* ---------- Fees ---------- */
/** Live from financeservice for finance staff and principals; other roles see the sample page. */
export function Fees() {
  const { hasRole } = useAuth();
  if (hasRole(...financeRoles.staff)) return <FeesLive />;
  return (
    <>
      <PageHeader
        title="Fees & payments"
        desc="Track term billing, reconcile payments and follow up on outstanding accounts."
        actions={[{ label: 'Export statement', icon: <Download size={15} />, onClick: exportStatement }, { label: 'Record payment', icon: <Plus size={15} />, primary: true }]}
      />
      <Card><ApiNote>Sample data. Live fee accounts, receipts and defaulter lists are shown to finance staff, principals and super administrators.</ApiNote></Card>
      <Metrics items={[
        ['Term billing', cur('£960,000'), 'Term 1 · September–December'],
        ['Collected', cur('£846,000'), '88.1% of term billing'],
        ['Not yet due', cur('£76,000'), 'Next due date 02 November'],
        ['Overdue', cur('£38,000'), '38 accounts require follow-up'],
      ]} />
      <div className="cols s404">
        <div className="stack">
          <Card>
            <SectionHead title="Recent transactions" sub="Payments received and reconciled" link="View all transactions →" />
            <div className="filters" style={{ margin: '18px 0' }}><SearchBox placeholder="Search student or reference" width={300} /><Select>Term 1</Select><Select>All payment methods</Select></div>
            <DataTable boxed cols={[
              { label: 'Student / reference', render: (r) => <span className="cell-id"><b>{r[0]}</b><small>{r[1]}</small></span> },
              { label: 'Date', key: '2' }, { label: 'Method', key: '3' }, { label: 'Amount', key: '4', className: 'num' },
              { label: 'Status', render: () => <Pill tone="green">Reconciled</Pill> }, { label: 'Action', render: () => act('Receipt') },
            ].map((c) => (c.key ? { ...c, key: Number(c.key) } : c))} rows={TRANSACTIONS()} />
          </Card>
          <Card>
            <SectionHead title="Outstanding accounts" sub={`38 overdue accounts · ${cur('£38,000')} total`} link="Send reminders →" />
            <div className="filters" style={{ margin: '18px 0' }}><Select>Overdue accounts</Select><Select>All year groups</Select></div>
            <DataTable boxed cols={[
              { label: 'Student', key: 0 }, { label: 'Invoice', key: 1 }, { label: 'Overdue', key: 2 },
              { label: 'Balance', key: 3, className: 'num' }, { label: 'Last reminder', key: 4 }, { label: 'Action', render: () => act('Record payment') },
            ]} rows={OUTSTANDING()} />
          </Card>
        </div>
        <div className="stack">
          <Card>
            <h3 style={{ fontSize: 15, fontWeight: 600 }}>Collection overview</h3>
            <p className="small muted" style={{ margin: '4px 0 14px' }}>Term 1 · 2026–2027</p>
            <div className="bignum">{cur('£846,000')}</div>
            <div style={{ margin: '14px 0' }}><Pill tone="green">88.1% collected</Pill></div>
            {[['Billed', cur('£960,000')], ['Outstanding', cur('£114,000')], ['Not yet due', cur('£76,000')], ['Overdue', `${cur('£38,000')} · 38 accounts`]].map(([a, b]) => (
              <div className="detail" key={a}>{a}<span>·</span><b>{b}</b></div>
            ))}
          </Card>
          <Card>
            <h3 style={{ fontSize: 15, fontWeight: 600 }}>Payment recording</h3>
            <p className="small muted" style={{ margin: '4px 0 16px' }}>Keep the school ledger up to date.</p>
            <div className="stack" style={{ gap: 10, alignItems: 'stretch' }}>
              <button className="btn primary"><Plus size={15} />Record payment</button>
              <button className="btn"><Upload size={15} />Import bank statement</button>
              <button className="btn">Create invoice</button>
            </div>
            <p className="xs muted" style={{ marginTop: 14 }}>Receipts are sent automatically to the billing guardian after reconciliation.</p>
          </Card>
          <Card>
            <h3 style={{ fontSize: 15, fontWeight: 600 }}>Reminder schedule</h3>
            <div style={{ margin: '12px 0' }}><Pill>Last sent 14 October</Pill></div>
            <p className="body-s">Next reminder: 21 October at 09:00. Only accounts with an overdue balance will be contacted.</p>
            <span className="link" style={{ marginTop: 14 }}>Manage reminder settings →</span>
          </Card>
        </div>
      </div>
      <Footer />
    </>
  );
}
