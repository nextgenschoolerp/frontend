import { Link } from 'react-router-dom';
import {
  Calendar as CalIcon, Download, Plus, GraduationCap, ClipboardCheck, Users, Wallet,
  ArrowUpRight, Send, CalendarDays, ShieldCheck, ChevronDown,
} from 'lucide-react';
import { PageHeader, Metrics, SectionHead, Pill, Card, Footer, downloadCsv, TodayLabel, todayIso } from '../components/ui.jsx';
import { useAuth } from '../auth.jsx';
import { useApplications } from '../components/Admissions.jsx';
import { useStudents } from '../components/StudentRecords.jsx';
import { useState } from 'react';
import { useAttendanceWeek, ATTENDANCE_RANGES } from '../components/AttendanceLive.jsx';
import { useFeeOverview } from '../components/FeesLive.jsx';
import * as hr from '../api/hrService.js';
import { useApi } from '../api/useApi.js';
import { money, moneyShort } from '../api/financeService.js';
import { formatDate, formatDateTime, formatTime, formatNumber, getRegional } from '../regional.js';
import { listCalendarEvents, listBroadcasts } from '../api/communicationService.js';

// Upcoming events and the notice board: school calendar events and circulars (communicationservice)
const EVENT_TONE = { SPORTS: 'green', DEADLINE: 'grey' };
const AUDIENCE = { ALL_PARENTS: 'All parents', ALL_STAKEHOLDERS: 'Everyone', ALL_TEACHERS: 'All teaching staff', ALL_STAFF: 'All staff', TRANSPORT_COMMUTERS: 'School bus families' };
const audienceLabel = (a) => AUDIENCE[a] || String(a || 'Everyone').replace(/^GRADE_(\d+)$/, 'Class $1 families').replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
const NOTICE_TAG = { EMERGENCY: 'Emergency', URGENT: 'Action required' };
const atNoon = (iso) => new Date(`${iso}T12:00:00`);
const monthOf = (iso) => new Intl.DateTimeFormat(getRegional().language, { month: 'short' }).format(atNoon(iso)).toUpperCase();
const dayOf = (iso) => String(Number(iso.slice(8, 10)));
const eventLine = (e) => {
  const multi = e.endDate && e.endDate !== e.startDate;
  const when = multi ? `${formatDate(e.startDate, { year: false })} – ${formatDate(e.endDate, { year: false })}`
    : formatDate(e.startDate, { year: false, weekday: 'short' }).split(',')[0];
  const time = e.startTime ? (e.endTime ? `${e.startTime}–${e.endTime}` : `${e.startTime} deadline`) : 'All day';
  return [when, time, e.venue].filter(Boolean).join(' · ');
};

/** Daily present % with the 95% target line. `points`: [{ label, value }] (live from useAttendanceWeek); nothing without. */
export function AttendanceChart({ points = [], empty = 'No registers submitted yet this week.' }) {
  const W = 675;
  if (!points.length) return <p className="xs muted" style={{ height: 133, display: 'grid', placeItems: 'center' }}>{empty}</p>;
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
  // Longer ranges: every point keeps its hover title, but only about 7 day labels and the first / last values are written
  const every = Math.ceil(n / 7);
  const labelled = (i) => n <= 7 || i % every === 0 || i === n - 1;
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
            <title>{`${p.label}: ${p.value.toFixed(1)}% present`}</title>
            <circle cx={x(i)} cy={y(p.value)} r="3" style={{ fill: 'var(--card)', stroke: 'var(--pr)' }} />
            {(n <= 7 || i === 0 || i === n - 1) && <text x={x(i)} y={y(p.value) - 8} fontSize="9" style={{ fill: 'var(--pr)' }} textAnchor={anchor(i)}>{p.value.toFixed(1)}%</text>}
            {labelled(i) && <text x={x(i)} y="128" fontSize="9" style={{ fill: 'var(--mu)' }} textAnchor={anchor(i)}>{p.label}</text>}
          </g>
        ))}
      </svg>
    </div>
  );
}

const WORK = [
  ['Admission applications', '2026–27 intake', 12, 'purple', 'Awaiting review', 'Admissions', 'Review', '/students'],
  ['Staff leave requests', 'For next week', 4, 'amber', 'Approval needed', 'Human resources', 'Approve', '/staff'],
  ['Overdue fee accounts', 'Overdue balances', 38, 'amber', 'Follow up', 'Finance', 'View', '/fees'],
  ['Incomplete student records', 'Emergency contacts missing', 3, '', 'Needs update', 'School office', 'Update', '/students'],
];

const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };

export default function Overview() {
  const { user, hasRole } = useAuth();
  // "Admission applications" row: live count from GET /api/v1/admissions/enquiries (admissionservice)
  const apps = useApplications();
  const live = apps.canRead && !apps.missingBranch && !apps.error && apps.data;
  // "Total students" and "Incomplete student records": GET /api/v1/students (studentservice); static for other roles
  const students = useStudents();
  // Staff on campus: live from hrservice (staff records and today's biometric summary); only roles that can read them see it
  const today = new Date().toISOString().slice(0, 10);
  const canStaff = hasRole(...hr.HR_ROLES.attendance);
  const staff = useApi(() => hr.listEmployees(user.branchId ? { branchId: user.branchId } : {}), [user.branchId], canStaff);
  const staffToday = useApi(() => hr.attendanceSummary(today), [today], canStaff);
  const leaves = useApi(() => hr.listLeaves(), [], canStaff);
  const pendingLeave = (leaves.data || []).filter((l) => l.status === 'PENDING').length;
  const staffCount = (staff.data || []).filter((s) => s.isActive !== false && !['RESIGNED', 'RETIRED', 'TERMINATED'].includes(s.employmentStatus)).length;
  // "Student attendance" and "Attendance trends": GET /api/v1/attendance/summary and /trend (studentservice)
  const att = useAttendanceWeek();
  const t = att.today;
  // "Upcoming events": the next three school events still to happen; "Notice board": the latest active circulars
  const calendar = useApi(() => listCalendarEvents(user.tenantId), [user.tenantId]);
  const circulars = useApi(() => listBroadcasts(user.tenantId), [user.tenantId]);
  const upcoming = (calendar.data || []).filter((e) => e.isPublished !== false && (e.endDate || e.startDate) >= todayIso())
    .sort((a, b) => `${a.startDate}${a.startTime || ''}`.localeCompare(`${b.startDate}${b.startTime || ''}`)).slice(0, 3);
  const notices = (circulars.data || []).filter((b) => !b.isArchived && b.status === 'ACTIVE')
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  // "Attendance trends" range: This week / Last week / Last 4 weeks
  const [rangeKey, setRangeKey] = useState('week');
  const r = att.live ? att.range(rangeKey) : null;
  // "Term fees collected", "Fee collection" and "Overdue fee accounts": financeservice reports (academic year to date), finance roles only
  const fees = useFeeOverview();
  const fee = fees.live ? fees : null;
  const feeState = fees.allowed ? (fees.error ? 'Could not load fee figures' : '') : 'Not available for your role';
  const pp = (v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)} pp vs last week`;
  const work = WORK.map((row) => (row[0] === 'Admission applications'
    ? [row[0], row[1], live ? apps.open.length : (apps.loading ? '…' : '—'), row[3], row[4], row[5], row[6], '/admissions']
    : row[0] === 'Staff leave requests'
      ? [row[0], row[1], canStaff && leaves.data ? pendingLeave : (canStaff && leaves.loading ? '…' : '—'),
        canStaff && leaves.data && pendingLeave === 0 ? 'green' : 'amber',
        canStaff && leaves.data ? (pendingLeave ? 'Approval needed' : 'All clear') : 'Not available for your role', row[5], row[6], row[7]]
    : row[0] === 'Overdue fee accounts'
      ? [row[0], fee ? `${moneyShort(fee.overdue)} overdue` : 'Overdue balances', fee ? fee.accounts : (fees.allowed && !fees.error ? '…' : '—'), fee ? row[3] : '', fee ? row[4] : feeState, row[5], row[6], row[7]]
    : row[0] === 'Incomplete student records' && students.live
      ? [row[0], 'Guardian, emergency phone or blood group missing', students.incomplete.length, row[3], row[4], row[5], row[6], row[7]]
    : row[0] === 'Incomplete student records'
      ? [row[0], 'Guardian, emergency phone or blood group missing', students.canRead && !students.error ? '…' : '—', '', students.canRead && !students.error ? '' : 'Not available for your role', row[5], row[6], row[7]]
      : row));
  const metrics = [
    students.live
      ? ['Total students', formatNumber(students.current.length), `Across ${students.classCount} class sections`, `+${students.newThisYear.length} this year`, true, GraduationCap, '/students']
      : ['Total students', students.canRead && !students.error ? '…' : '—', students.canRead && !students.error ? '' : 'Not available for your role', '', true, GraduationCap, students.canRead && '/students'],
    att.live
      ? ['Student attendance', t.presentRate === null ? '—' : `${Number(t.presentRate).toFixed(1)}%`, `${formatNumber(t.present)} of ${formatNumber(t.totalStudents - t.unmarked)} marked present`,
        att.change !== null ? pp(att.change) : `${t.amRegistersSubmitted} / ${t.registersExpected} registers in`, att.change === null || att.change >= 0, ClipboardCheck, '/attendance']
      : ['Student attendance', att.allowed && !att.error ? '…' : '—', att.allowed ? (att.error ? 'Could not load attendance' : '') : 'Not available for your role', '', true, ClipboardCheck, att.allowed && '/attendance'],
    canStaff && staff.data && staffToday.data
      ? ['Staff on campus', `${formatNumber(staffToday.data.presentCount)} / ${formatNumber(staffCount)}`,
        staffCount ? `${formatNumber(staffToday.data.attendancePercentage)}% punched in` : 'No staff records yet', '', false, Users, '/staff']
      : ['Staff on campus', canStaff && (staff.loading || staffToday.loading) ? '…' : '—', canStaff ? '' : 'Not available for your role', '', false, Users, canStaff && '/staff'],
    !fee
      ? ['Fees collected', fees.allowed && !fees.error ? '…' : '—', feeState, '', true, Wallet]
      : ['Fees collected', moneyShort(fee.collected), `${moneyShort(fee.outstanding)} outstanding`, `${fee.collectedPct.toFixed(1)}% of billing`, fee.collectedPct >= 85, Wallet, '/fees'],
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
            <div><h3>Attendance trends</h3><p>Student attendance{r ? ` · ${r.period || r.label.toLowerCase()}` : ''}</p></div>
            {r ? (
              <select className="select" aria-label="Attendance period" style={{ height: 27, fontSize: 11 }} value={rangeKey} onChange={(e) => setRangeKey(e.target.value)}>
                {ATTENDANCE_RANGES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
            ) : null}
          </div>
          {!r ? <p className="xs muted" style={{ height: 133, display: 'grid', placeItems: 'center' }}>{att.allowed ? (att.error ? 'Could not load attendance.' : 'Loading attendance…') : 'Not available for your role.'}</p> : (<>
          <div className="sumline">
            <b>{r.avg === null ? '—' : `${r.avg.toFixed(1)}%`}</b>
            <span className="muted small">{rangeKey === 'month' ? 'average' : 'weekly average'}</span>
            {r.change !== null && <span className="xs" style={{ color: r.change >= 0 ? 'var(--gr)' : 'var(--rd)' }}>{`${r.change >= 0 ? '+' : ''}${r.change.toFixed(1)} pp vs ${r.versus}`}</span>}
            <span className="xs muted" style={{ marginLeft: 'auto' }}>— — Target 95%</span>
          </div>
          <AttendanceChart points={r.points} empty={`No registers submitted ${r.label.toLowerCase() === 'this week' ? 'yet this week' : `in ${r.label.toLowerCase()}`}.`} />
          <div className="legendrow">
            <span>TODAY</span>
            <span className="i"><i style={{ background: 'var(--gr)' }} />{formatNumber(t.present)} present</span>
            <span className="i"><i style={{ background: 'var(--chart-am)' }} />{t.excused} excused</span>
            <span className="i"><i style={{ background: 'var(--rd)' }} />{t.unexcused} unexcused</span>
            <Link to="/attendance" className="link"><ArrowUpRight size={14} /></Link>
          </div></>)}
        </Card>

        <Card style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <SectionHead title="Fee collection" sub="Academic year to date" link="View finance" to="/fees" />
          {!fee ? <p className="xs muted" style={{ height: 133, display: 'grid', placeItems: 'center' }}>{fees.allowed && !fees.error ? 'Loading fee figures…' : (feeState || 'Not available for your role')}.</p> : (<>
          <div className="row" style={{ alignItems: 'flex-end' }}>
            <div>
              <div style={{ fontSize: 29, fontWeight: 600 }}>{money(fee.collected)}</div>
              <div className="small muted">of {money(fee.billed)} billed</div>
            </div>
            <Pill tone={fee.collectedPct >= 85 ? 'green' : 'amber'}>{fee.collectedPct.toFixed(1)}% collected</Pill>
          </div>
          <div>
            <div className="collbar">
              <i style={{ width: `${fee.collectedPct}%`, background: 'var(--gr)' }} />
              <i style={{ width: `${fee.notYetDuePct}%`, background: 'var(--tint2)' }} />
              <i style={{ width: `${fee.overduePct}%`, background: 'var(--chart-am)' }} />
            </div>
            <div className="row xs muted" style={{ marginTop: 8 }}><span>Collected</span><span>Outstanding {money(fee.outstanding)}</span></div>
          </div>
          <div className="two">
            <div><small>Not yet due</small><b>{money(fee.notYetDue)}</b></div>
            <div><small>Overdue · {fee.accounts} account{fee.accounts === 1 ? '' : 's'}</small><b style={{ color: 'var(--am)' }}>{money(fee.overdue)}</b></div>
          </div>
          <div className="legendrow" style={{ marginTop: 0 }}>
            <span>{`${fee.receipts} receipts this academic year`}</span>
            <Link to="/fees" className="link"><Send size={13} />Follow up overdue accounts</Link>
          </div></>)}
        </Card>
      </div>

      <div className="cols ov">
        <Card flush>
          <SectionHead pad title="Needs your attention" sub="A clear queue for the day ahead" link="Export tasks"
            onClick={() => downloadCsv('tasks', ['Work item', 'Detail', 'Quantity', 'Status', 'Assigned team'], work.map(([n, s, q, , st, team]) => [n, s, q, st, team]))} />
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
          {calendar.error ? <p className="xs muted">Events are not available for your role.</p>
            : !calendar.data ? <p className="xs muted">Loading events…</p>
              : !upcoming.length ? <p className="xs muted">No events are scheduled. Add one from the calendar.</p>
                : upcoming.map((e) => (
                  <div className="event" key={e.eventId}>
                    <div className={`eventdate ${EVENT_TONE[e.eventType] || ''}`}><small>{monthOf(e.startDate)}</small><b>{dayOf(e.startDate)}</b></div>
                    <div><b className="t">{e.title}</b><span className="s">{eventLine(e)}</span></div>
                  </div>
                ))}
        </Card>
      </div>

      <div>
        <div className="row" style={{ marginBottom: 12 }}>
          <div className="row" style={{ gap: 8 }}><h3 style={{ fontSize: 15, fontWeight: 600 }}>Notice board</h3>{circulars.data && <Pill>{notices.length} active</Pill>}</div>
          <Link to="/communications" className="link">View all notices →</Link>
        </div>
        {circulars.error ? <p className="xs muted">Notices are not available for your role.</p>
          : !circulars.data ? <p className="xs muted">Loading notices…</p>
            : !notices.length ? <p className="xs muted">No active notices. Send one from Communications.</p>
              : (
                <div className="notices">
                  {notices.slice(0, 2).map((b) => {
                    const Icon = b.priority === 'NORMAL' ? CalendarDays : ShieldCheck;
                    return (
                      <Card className="notice-card" key={b.broadcastId}>
                        <div className="sym"><Icon size={16} /></div>
                        <div className="nc">
                          <div className="nh">{b.title}<span>{NOTICE_TAG[b.priority] || 'School update'}</span></div>
                          <p>{b.messageBody}</p>
                          <small>{b.senderName} · {audienceLabel(b.targetAudience)} · {formatDate(b.createdAt, { year: false })}</small>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
      </div>
      <Footer />
    </>
  );
}
