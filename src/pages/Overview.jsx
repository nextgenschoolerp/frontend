import { Link } from 'react-router-dom';
import {
  Calendar as CalIcon, Download, Plus, GraduationCap, ClipboardCheck, Users, Wallet,
  ArrowUpRight, Send, CalendarDays, ShieldCheck, ChevronDown,
} from 'lucide-react';
import { PageHeader, Metrics, SectionHead, Pill, Card, Footer } from '../components/ui.jsx';

const POINTS = [94.1, 95.8, 94.7, 96.1, 95.2];
const DAYS = ['Mon 12', 'Tue 13', 'Wed 14', 'Thu 15', 'Fri 16'];

export function AttendanceChart() {
  const W = 675;
  const x = (i) => (i * W) / 4;
  const y = (v) => 4 + ((98 - v) / 6) * 102;
  const line = POINTS.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join('');
  const anchor = (i) => (i === 0 ? 'start' : i === 4 ? 'end' : 'middle');
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: 113, fontSize: 9, color: 'var(--fa)' }}>
        <span>98%</span><span>96%</span><span>94%</span><span>92%</span>
      </div>
      <svg viewBox={`-6 0 ${W + 12} 133`} style={{ flex: 1, minWidth: 0, height: 133, overflow: 'visible' }} preserveAspectRatio="none">
        {[4, 38, 72, 106].map((t) => <line key={t} x1="0" x2={W} y1={t} y2={t} style={{ stroke: 'var(--gl)' }} />)}
        <path d={`${line}L${W},106L0,106Z`} style={{ fill: 'var(--pr)' }} opacity=".08" />
        <line x1="0" x2={W} y1={y(95)} y2={y(95)} style={{ stroke: 'var(--fa)' }} strokeDasharray="3 3" />
        <path d={line} fill="none" style={{ stroke: 'var(--pr)' }} strokeWidth="1.5" />
        {POINTS.map((v, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(v)} r="3" style={{ fill: 'var(--card)', stroke: 'var(--pr)' }} />
            <text x={x(i)} y={y(v) - 8} fontSize="9" style={{ fill: 'var(--pr)' }} textAnchor={anchor(i)}>{v}%</text>
            <text x={x(i)} y="128" fontSize="9" style={{ fill: 'var(--mu)' }} textAnchor={anchor(i)}>{DAYS[i]}</text>
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

export default function Overview() {
  return (
    <>
      <PageHeader
        title="School overview"
        desc="Good morning, Sarah. Here’s how your school is doing today."
        actions={[
          { label: '16 Oct 2026', icon: <CalIcon size={15} /> },
          { label: 'Export report', icon: <Download size={15} /> },
          { label: 'Quick add', icon: <Plus size={15} />, primary: true, to: '/students/new' },
        ]}
      />
      <Metrics items={[
        ['Total students', '1,248', 'Across 44 classes', '+24 this term', true, GraduationCap],
        ['Student attendance', '95.2%', '1,188 of 1,248 present', '+0.5 pp vs last week', true, ClipboardCheck],
        ['Staff on campus', '86 / 92', 'All lessons covered', '6 on approved leave', false, Users],
        ['Term fees collected', '£846,000', '£114,000 outstanding', '88.1% of term billing', true, Wallet],
      ]} />

      <div className="cols ov">
        <Card>
          <div className="sh">
            <div><h3>Attendance trends</h3><p>Student attendance · 12–16 October</p></div>
            <span className="select" style={{ height: 27, fontSize: 11 }}>This week<ChevronDown size={13} /></span>
          </div>
          <div className="sumline">
            <b>95.2%</b><span className="muted small">weekly average</span>
            <span className="xs muted" style={{ marginLeft: 'auto' }}>— — Target 95%</span>
          </div>
          <AttendanceChart />
          <div className="legendrow">
            <span>TODAY</span>
            <span className="i"><i style={{ background: 'var(--gr)' }} />1,188 present</span>
            <span className="i"><i style={{ background: 'var(--chart-am)' }} />42 excused</span>
            <span className="i"><i style={{ background: 'var(--rd)' }} />18 unexcused</span>
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
                {WORK.map(([n, s, q, tone, st, team, act, to]) => (
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
