import { Link } from 'react-router-dom';
import {
  Calendar as CalIcon, Download, Plus, GraduationCap, ClipboardCheck, Users, Wallet,
  ArrowUpRight, Send, CalendarDays, ShieldCheck, ChevronDown,
} from 'lucide-react';
import { PageHeader, Metrics, SectionHead, Pill, Card, Footer, downloadCsv, TodayLabel } from '../components/ui.jsx';
import { useAuth } from '../auth.jsx';
import { useApplications } from '../components/Admissions.jsx';
import { useStudents } from '../components/StudentRecords.jsx';
import { useAttendanceWeek } from '../components/AttendanceLive.jsx';

const SAMPLE = [94.1, 95.8, 94.7, 96.1, 95.2].map((value, i) => ({ value, label: ['Mon 12', 'Tue 13', 'Wed 14', 'Thu 15', 'Fri 16'][i] }));

/** Daily present % with the 95% target line. `points`: [{ label, value }] (live from useAttendanceWeek); the sample week without. */
export function AttendanceChart({ points = SAMPLE }) {
  const W = 675;
  if (!points.length) return <p className="xs muted" style={{ height: 133, display: 'grid', placeItems: 'center' }}>No registers submitted yet this week.</p>;
  const values = points.map((p) => p.value);
  // y range: 6 points around the data and the target, in steps of 2
  const top = Math.min(100, Math.ceil((Math.max(...values, 95) + 1) / 2) * 2);
  const bottom = Math.min(top - 6, Math.floor((Math.min(...values, 95) - 1) / 2) * 2);
  const span = top - bottom;
  const n = points.length;
  const x = (i) => (n === 1 ? W / 2 : (i * W) / (n - 1));
  const y = (v) => 4 + ((top - v) / span) * 102;
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.value)}`).join('');
  const anchor = (i) => (n === 1 ? 'middle' : i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle');
  const ticks = [0, 1, 2, 3].map((k) => top - (span * k) / 3);
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: 113, fontSize: 9, color: 'var(--fa)' }}>
        {ticks.map((t) => <span key={t}>{Math.round(t)}%</span>)}
      </div>
      <svg viewBox={`-6 0 ${W + 12} 133`} style={{ flex: 1, minWidth: 0, height: 133, overflow: 'visible' }} preserveAspectRatio="none" role="img" aria-label="Daily attendance">
        {[4, 38, 72, 106].map((t) => <line key={t} x1="0" x2={W} y1={t} y2={t} style={{ stroke: 'var(--gl)' }} />)}
        {n > 1 && <path d={`${line}L${W},106L0,106Z`} style={{ fill: 'var(--pr)' }} opacity=".08" />}
        <line x1="0" x2={W} y1={y(95)} y2={y(95)} style={{ stroke: 'var(--fa)' }} strokeDasharray="3 3" />
        <path d={line} fill="none" style={{ stroke: 'var(--pr)' }} strokeWidth="1.5" />
        {points.map((p, i) => (
          <g key={p.label}>
            <circle cx={x(i)} cy={y(p.value)} r="3" style={{ fill: 'var(--card)', stroke: 'var(--pr)' }} />
            <text x={x(i)} y={y(p.value) - 8} fontSize="9" style={{ fill: 'var(--pr)' }} textAnchor={anchor(i)}>{p.value.toFixed(1)}%</text>
            <text x={x(i)} y="128" fontSize="9" style={{ fill: 'var(--mu)' }} textAnchor={anchor(i)}>{p.label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

const WORK = [
  ['Admission applications', '2026–27 intake', 12, 'purple', 'Awaiting review', 'Admissions', 'Review', '/students'],
  ['Staff leave requests', 'For next week', 4, 'amber', 'Approval needed', 'Human resources', 'Approve', '/staff'],
  ['Overdue fee accounts', '£38,000 outstanding', 38, 'amber', 'Follow up', 'Finance', 'View', '/fees'],
  ['Incomplete student records', 'Emergency contacts missing', 3, '', 'Needs update', 'School office', 'Update', '/students'],
];

const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };

export default function Overview() {
  const { user } = useAuth();
  // "Admission applications" row: live count from GET /api/v1/admissions/enquiries (admissionservice)
  const apps = useApplications();
  const live = apps.canRead && !apps.missingBranch && !apps.error && apps.data;
  // "Total students" and "Incomplete student records": GET /api/v1/students (studentservice); static for other roles
  const students = useStudents();
  // "Student attendance" and "Attendance trends": GET /api/v1/attendance/summary and /trend (studentservice)
  const att = useAttendanceWeek();
  const t = att.today;
  const pp = (v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)} pp vs last week`;
  const work = WORK.map((row) => (row[0] === 'Admission applications'
    ? [row[0], row[1], live ? apps.open.length : (apps.loading ? '…' : '—'), row[3], row[4], row[5], row[6], '/students?tab=admissions']
    : row[0] === 'Incomplete student records' && students.live
      ? [row[0], 'Guardian, emergency phone or blood group missing', students.incomplete.length, row[3], row[4], row[5], row[6], row[7]]
      : row));
  const metrics = [
    students.live
      ? ['Total students', students.current.length.toLocaleString('en-GB'), `Across ${students.classCount} class sections`, `+${students.newThisYear.length} this year`, true, GraduationCap]
      : ['Total students', '1,248', 'Across 44 classes', '+24 this term', true, GraduationCap],
    att.live
      ? ['Student attendance', t.presentRate === null ? '—' : `${Number(t.presentRate).toFixed(1)}%`, `${t.present.toLocaleString('en-IN')} of ${(t.totalStudents - t.unmarked).toLocaleString('en-IN')} marked present`,
        att.change !== null ? pp(att.change) : `${t.amRegistersSubmitted} / ${t.registersExpected} registers in`, att.change === null || att.change >= 0, ClipboardCheck]
      : ['Student attendance', att.allowed ? '…' : '95.2%', att.allowed ? '' : '1,188 of 1,248 present', att.allowed ? '' : '+0.5 pp vs last week', true, ClipboardCheck],
    ['Staff on campus', '86 / 92', 'All lessons covered', '6 on approved leave', false, Users],
    ['Term fees collected', '£846,000', '£114,000 outstanding', '88.1% of term billing', true, Wallet],
  ];
  // "Export report": the figures and the attention list shown on this page, as CSV
  const exportReport = () => downloadCsv('school-overview', ['Section', 'Item', 'Value', 'Detail'], [
    ...metrics.map(([label, value, sub, ctx]) => ['Key figures', label, value, [sub, ctx].filter(Boolean).join(' · ')]),
    ...work.map(([item, sub, qty, , status, owner]) => ['Needs your attention', item, qty, `${sub} · ${status} · ${owner}`]),
  ]);
  return (
    <>
      <PageHeader
        title="School overview"
        desc={`${greeting()}, ${user.name.split(' ')[0]}. Here’s how your school is doing today.`}
        actions={[
          // Today's date (read only); the line under the title shows the school week and whether school is open
          { label: 'Today', render: () => <TodayLabel /> },
          { label: 'Export report', icon: <Download size={15} />, onClick: exportReport },
          { label: 'Quick add', icon: <Plus size={15} />, primary: true, to: '/students/new' },
        ]}
      />
      <Metrics items={metrics} />

      <div className="cols ov">
        <Card>
          <div className="sh">
            <div><h3>Attendance trends</h3><p>Student attendance · {att.live ? (att.period || 'this week') : '12–16 October'}</p></div>
            <span className="select" style={{ height: 27, fontSize: 11 }}>This week<ChevronDown size={13} /></span>
          </div>
          <div className="sumline">
            <b>{att.live ? (att.weekAvg === null ? '—' : `${att.weekAvg.toFixed(1)}%`) : '95.2%'}</b><span className="muted small">weekly average</span>
            <span className="xs muted" style={{ marginLeft: 'auto' }}>— — Target 95%</span>
          </div>
          {att.live ? <AttendanceChart points={att.points} /> : <AttendanceChart />}
          <div className="legendrow">
            <span>TODAY</span>
            <span className="i"><i style={{ background: 'var(--gr)' }} />{att.live ? t.present.toLocaleString('en-IN') : '1,188'} present</span>
            <span className="i"><i style={{ background: 'var(--chart-am)' }} />{att.live ? t.excused : 42} excused</span>
            <span className="i"><i style={{ background: 'var(--rd)' }} />{att.live ? t.unexcused : 18} unexcused</span>
            <Link to="/attendance" className="link"><ArrowUpRight size={14} /></Link>
          </div>
        </Card>

        <Card style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <SectionHead title="Fee collection" sub="Term 1 · September–December" link="View finance" to="/fees" />
          <div className="row" style={{ alignItems: 'flex-end' }}>
            <div>
              <div style={{ fontSize: 29, fontWeight: 600 }}>£846,000</div>
              <div className="small muted">of £960,000 billed this term</div>
            </div>
            <Pill tone="green">88.1% collected</Pill>
          </div>
          <div>
            <div className="collbar">
              <i style={{ width: '88.1%', background: 'var(--gr)' }} />
              <i style={{ width: '7.9%', background: 'var(--tint2)' }} />
              <i style={{ flex: 1, background: 'var(--chart-am)' }} />
            </div>
            <div className="row xs muted" style={{ marginTop: 8 }}><span>Collected</span><span>Outstanding £114,000</span></div>
          </div>
          <div className="two">
            <div><small>Not yet due</small><b>£76,000</b></div>
            <div><small>Overdue · 38 accounts</small><b style={{ color: 'var(--am)' }}>£38,000</b></div>
          </div>
          <div className="legendrow" style={{ marginTop: 0 }}>
            <span>Last reminder sent 14 Oct</span>
            <span className="link"><Send size={13} />Send reminders</span>
          </div>
        </Card>
      </div>

      <div className="cols ov">
        <Card flush>
          <SectionHead pad title="Needs your attention" sub="A clear queue for the day ahead" link="All tasks" />
          <div className="tablewrap">
            <table className="t">
              <thead><tr><th>Work item</th><th>Qty</th><th>Status</th><th>Assigned team</th><th>Action</th></tr></thead>
              <tbody>
                {work.map(([n, s, q, tone, st, team, act, to]) => (
                  <tr key={n}>
                    <td style={{ minWidth: 220 }}><b style={{ fontWeight: 500 }}>{n}</b><span className="sub">{s}</span></td>
                    <td className="num">{q}</td>
                    <td><Pill tone={tone}>{st}</Pill></td>
                    <td className="muted xs">{team}</td>
                    <td><Link to={to} className="act">{act}</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card style={{ display: 'flex', flexDirection: 'column', gap: 17 }}>
          <SectionHead title="Upcoming events" link="Calendar" to="/calendar" />
          {[['19', '', 'Year 10 parent–teacher meetings', 'Mon · 15:30–18:00 · Main hall'],
            ['21', 'green', 'Autumn sports day', 'Wed · 09:00–14:00 · Sports grounds'],
            ['23', 'grey', 'Mid-term progress reports due', 'Fri · 16:00 deadline · All teaching staff']].map(([d, tone, t, s]) => (
            <div className="event" key={d}>
              <div className={`eventdate ${tone}`}><small>OCT</small><b>{d}</b></div>
              <div><b className="t">{t}</b><span className="s">{s}</span></div>
            </div>
          ))}
        </Card>
      </div>

      <div>
        <div className="row" style={{ marginBottom: 12 }}>
          <div className="row" style={{ gap: 8 }}><h3 style={{ fontSize: 15, fontWeight: 600 }}>Notice board</h3><Pill>2 active</Pill></div>
          <Link to="/communications" className="link">View all notices →</Link>
        </div>
        <div className="notices">
          <Card className="notice-card">
            <div className="sym"><CalendarDays size={16} /></div>
            <div className="nc">
              <div className="nh">Half-term break: 26–30 October<span>School update</span></div>
              <p>School reopens Monday, 2 November. Please share with families.</p>
              <small>School office · All staff & parents · 15 Oct</small>
            </div>
          </Card>
          <Card className="notice-card">
            <div className="sym"><ShieldCheck size={16} /></div>
            <div className="nc">
              <div className="nh">Safeguarding refresher training<span>Action required</span></div>
              <p>All staff to complete the online module by Friday, 23 October.</p>
              <small>Principal’s office · All staff · 14 Oct</small>
            </div>
          </Card>
        </div>
      </div>
      <Footer />
    </>
  );
}
