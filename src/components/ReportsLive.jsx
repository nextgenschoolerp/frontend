import { useMemo, useState } from 'react';
import {
  Download, Plus, Play, LoaderCircle, Check, GraduationCap, ClipboardCheck, Wallet, Users, BarChart3, LineChart, PieChart, Table2,
} from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { useApi } from '../api/useApi.js';
import * as analytics from '../api/analyticService.js';
import { PageHeader, Card, SectionHead, SearchBox, DataTable, Pill, KV, Metrics, downloadCsv } from './ui.jsx';
import { Modal } from './AuthSettings.jsx';
import { ApiErr, ApiNote } from './Admissions.jsx';
import { AttendanceChart } from '../pages/Overview.jsx';
import { useAttendanceWeek } from './AttendanceLive.jsx';
import { formatDateTime, formatNumber } from '../regional.js';

/* Reports workspace, live from analyticservice (Module 10): saved custom reports (US-10009) that run on demand,
   and the trustee KPI dashboard (US-10014). The weekly attendance preview comes from studentservice. */

const { ROLES, CATEGORIES, CHART_TYPES } = analytics;
const Loading = () => <p className="xs muted"><LoaderCircle size={12} className="spin" /> Loading…</p>;
const Ok = ({ children }) => <div className="api-note ok" style={{ marginBottom: 12 }}><Check size={14} style={{ flex: 'none' }} /><span>{children}</span></div>;
const text = (list, code) => list.find(([c]) => c === code)?.[1] || code || '—';
const pct = (n) => (n === null || n === undefined ? '—' : `${formatNumber(n, 1)}%`);
const when = (t) => (t ? formatDateTime(t, { year: false }) : '—');

const CARDS = [
  ['ACADEMIC', GraduationCap, 'Student reports', 'Enrolment, admissions & academic targets'],
  ['ATTENDANCE', ClipboardCheck, 'Attendance', 'Daily registers, trends & persistent absence'],
  ['FINANCE', Wallet, 'Finance', 'Fee collection, outstanding balances & billing'],
  ['STAFF_HR', Users, 'Staff & HR', 'Staffing, cover and workforce metrics'],
];
const CHART_ICON = { BAR: BarChart3, LINE: LineChart, PIE: PieChart, TABLE: Table2 };
const CATEGORY_TONE = { FINANCE: 'green', ATTENDANCE: 'amber', ACADEMIC: 'purple', STAFF_HR: '' };

/** '["grade","fee_head"]' → "grade, fee head" */
function fields(json) {
  try {
    const v = JSON.parse(json || '[]');
    return Array.isArray(v) && v.length ? v.map((s) => String(s).replace(/_/g, ' ')).join(', ') : '—';
  } catch { return json || '—'; }
}
const cell = (v) => (typeof v === 'number' ? formatNumber(v) : v ?? '—');

export default function ReportsLive() {
  const { user, hasRole } = useAuth();
  const tenantId = user.tenantId;
  const canBuild = hasRole(...ROLES.reportBuilder);
  const canKpi = hasRole(...ROLES.analyticsView);

  const reports = useApi(() => analytics.listCustomReports(tenantId), [tenantId], canBuild);
  const kpis = useApi(() => analytics.listTrusteeKpis(tenantId), [tenantId], canKpi);

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [modal, setModal] = useState(null); // 'report' | 'kpi'
  const [msg, setMsg] = useState(null);
  const [running, setRunning] = useState(null); // report id being executed
  const [result, setResult] = useState(null);
  const [runError, setRunError] = useState(null);

  const all = reports.data || [];
  const counts = useMemo(() => Object.fromEntries(CARDS.map(([c]) => [c, all.filter((r) => r.category === c).length])), [all]);
  const shown = all.filter((r) => (!category || r.category === category) && r.reportName.toLowerCase().includes(query.trim().toLowerCase()));

  async function run(report) {
    setRunning(report.id);
    setRunError(null);
    try {
      setResult(await analytics.executeReport(report.id));
      document.getElementById('report-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) { setRunError(e); } finally { setRunning(null); }
  }

  const actions = [
    ...(canKpi ? [{ label: 'Record KPI snapshot', onClick: () => setModal('kpi') }] : []),
    ...(canBuild ? [{ label: 'Create report', icon: <Plus size={15} />, primary: true, onClick: () => setModal('report') }] : []),
  ];

  return (
    <>
      <PageHeader title="Reports" desc="Turn school information into clear, shareable reports for confident decisions." actions={actions} />
      {msg && <Ok>{msg}</Ok>}

      {canBuild && (
        <Card>
          <div className="filters">
            <SearchBox placeholder="Search saved reports" width={300} value={query} onChange={setQuery} />
            <select className="select" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Report category">
              <option value="">All categories</option>
              {CATEGORIES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </select>
          </div>
        </Card>
      )}

      <div className="grid4">
        {CARDS.map(([code, Icon, title, desc]) => (
          <button key={code} type="button" className={'card reportcard' + (category === code ? ' on' : '')} disabled={!canBuild}
            onClick={() => setCategory(category === code ? '' : code)} aria-pressed={category === code}>
            <div className="sym"><Icon size={16} /></div><b>{title}</b><span className="xs muted">{desc}</span>
            {canBuild && <span className="link" style={{ marginTop: 6 }}>
              {reports.loading ? 'Loading…' : `${counts[code]} saved report${counts[code] === 1 ? '' : 's'}`}{category === code ? ' · Showing' : ' · Browse →'}
            </span>}
          </button>
        ))}
      </div>

      <div className="cols s404">
        <WeeklyAttendance />
        <Card>
          <SectionHead title="Saved reports" sub={canBuild ? 'Custom report definitions · run any to see the latest figures' : undefined} />
          <div style={{ marginTop: 14 }}>
            {!canBuild && <ApiNote>Custom reports are available to data analysts, system integrators and administrators.</ApiNote>}
            {canBuild && reports.loading && <Loading />}
            {canBuild && reports.error && <ApiErr error={reports.error} />}
            {canBuild && reports.data && !shown.length && (
              <p className="xs muted">{all.length ? 'No saved reports match this search.' : 'No saved reports yet. Use Create report to define one.'}</p>
            )}
            <div className="savedlist">
              {shown.map((r) => {
                const Chart = CHART_ICON[r.chartType] || Table2;
                return (
                  <div key={r.id} className="saved">
                    <div className="sym"><Chart size={15} /></div>
                    <div className="sv">
                      <b>{r.reportName}</b>
                      <span className="xs muted">{fields(r.dimensionsJson)} · {when(r.createdAt)}</span>
                      <Pill tone={CATEGORY_TONE[r.category]}>{text(CATEGORIES, r.category)}</Pill>
                    </div>
                    <button className="btn" onClick={() => run(r)} disabled={running === r.id} aria-label={`Run ${r.reportName}`}>
                      {running === r.id ? <LoaderCircle size={14} className="spin" /> : <Play size={14} />}Run
                    </button>
                  </div>
                );
              })}
            </div>
            {runError && <div style={{ marginTop: 12 }}><ApiErr error={runError} /></div>}
          </div>
        </Card>
      </div>

      <div id="report-result">{result && <ReportResult result={result} onClose={() => setResult(null)} />}</div>

      <TrusteeKpis allowed={canKpi} kpis={kpis} />

      {modal === 'report' && (
        <CreateReportModal tenantId={tenantId} userId={user.userId} onClose={() => setModal(null)}
          onSaved={(r) => { setModal(null); setMsg(`Saved “${r.reportName}”. Run it from Saved reports.`); setCategory(''); setQuery(''); reports.reload(); }} />
      )}
      {modal === 'kpi' && (
        <KpiModal tenantId={tenantId} onClose={() => setModal(null)}
          onSaved={(k) => { setModal(null); setMsg(`Recorded the ${k.periodName} KPI snapshot.`); kpis.reload(); }} />
      )}
    </>
  );
}

/* Weekly attendance report: GET /api/v1/attendance/summary and /trend (studentservice); other roles are told it is not available */
function WeeklyAttendance() {
  const att = useAttendanceWeek();
  const t = att.live ? att.today : null;
  // shares of the marks possible today: students (one register a day) or half-day sessions (AM and PM)
  const share = (n) => (t && t.possible ? `${((n / t.possible) * 100).toFixed(1)}%` : '—');
  if (!att.live) {
    return (
      <Card>
        <SectionHead title="Weekly attendance report" sub="Preview" link="Open full report →" to="/attendance" />
        <p className="xs muted" style={{ margin: '18px 0 4px' }}>{att.allowed ? (att.error ? 'Could not load attendance.' : 'Loading attendance…') : 'Not available for your role.'}</p>
      </Card>
    );
  }
  const week = { period: att.period || 'This week', avg: att.weekAvg === null ? '—' : `${att.weekAvg.toFixed(1)}%`,
    change: att.change === null ? '—' : `${att.change >= 0 ? '+' : ''}${att.change.toFixed(1)} pp`, up: att.change === null || att.change >= 0,
    onTarget: att.weekAvg !== null && att.weekAvg >= 95,
    rows: [['Present', formatNumber(t.present), share(t.present)], ['Excused', String(t.excused), share(t.excused)], ['Unexcused', String(t.unexcused), share(t.unexcused)],
      ['Not yet marked', String(t.unmarked), share(t.unmarked)]],
    updated: formatDateTime(new Date()) };
  return (
    <Card>
      <SectionHead title="Weekly attendance report" sub={`Preview · ${week.period}`} link="Open full report →" to="/attendance" />
      <div className="row" style={{ justifyContent: 'flex-start', gap: 50, margin: '18px 0 20px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div><div className="bignum">{week.avg}</div><span className="small muted">Weekly average</span></div>
        <div><div style={{ fontSize: 24, fontWeight: 600, color: week.up ? 'var(--gr)' : 'var(--rd)' }}>{week.change}</div><span className="small muted">Compared with last week</span></div>
        <Pill tone={week.onTarget ? 'green' : 'amber'}>{week.onTarget ? 'Above 95% target' : 'Below 95% target'}</Pill>
      </div>
      <AttendanceChart points={att.points} />
      <div style={{ marginTop: 18 }}>
        <DataTable boxed cols={[{ label: 'Today’s status', key: 0 }, { label: 'Students', key: 1 }, { label: 'Proportion', key: 2 }]} rows={week.rows} />
      </div>
      <div className="actions" style={{ marginTop: 14 }}>
        {/* PDF: the browser's print dialog ("Save as PDF"); CSV: the preview figures */}
        <button className="btn" onClick={() => window.print()}><Download size={14} />Export PDF</button>
        <button className="btn" onClick={() => downloadCsv('weekly-attendance', ['Status', 'Students', 'Proportion'],
          [...week.rows.map(([a, b, c]) => [a, b.replace(/,/g, ''), c]), ...att.week.map((d) => [`Present ${d.date}`, String(d.present), `${Number(d.presentRate || 0).toFixed(1)}%`]),
            ['Weekly average', '', week.avg], ['Change vs last week', '', week.change]])}>
          <Download size={14} />CSV</button>
      </div>
      <p className="xs muted" style={{ marginTop: 10 }}>Updated {week.updated}. Personal student data is only included for authorised users.</p>
    </Card>
  );
}

/* POST /reports/custom/{id}/execute result: column headers + rows */
function ReportResult({ result, onClose }) {
  const headers = result.columnHeaders || [];
  const cols = headers.map((h) => ({ label: h, key: h, render: (r) => cell(r[h]) }));
  return (
    <Card>
      <SectionHead title={result.reportName} sub={`${text(CATEGORIES, result.category)} · ${result.rowCount} row${result.rowCount === 1 ? '' : 's'} · run ${when(result.executedAt)} in ${result.executionDurationMs ?? 0} ms`} />
      <div style={{ marginTop: 16 }}>
        {result.rows?.length ? <DataTable boxed cols={cols} rows={result.rows} /> : <p className="xs muted">The report returned no rows.</p>}
      </div>
      <div className="actions" style={{ marginTop: 14 }}>
        <button className="btn primary" onClick={() => downloadCsv(result.reportName.toLowerCase().replace(/[^a-z0-9]+/g, '-'), headers, (result.rows || []).map((r) => headers.map((h) => r[h] ?? '')))}>
          <Download size={14} />Download CSV</button>
        <button className="btn" onClick={onClose}>Close results</button>
      </div>
    </Card>
  );
}

/* GET /reports/trustee/kpi: the latest period as headline figures, all periods in a table */
function TrusteeKpis({ allowed, kpis }) {
  // Newest period first: by financial year and quarter in the name ("Q3 FY 2026-27"), then by when it was recorded
  const periodKey = (k) => { const m = /Q(\d)\D*(\d{4})/i.exec(k.periodName || ''); return m ? Number(m[2]) * 10 + Number(m[1]) : 0; };
  const list = [...(kpis.data || [])].sort((a, b) => periodKey(b) - periodKey(a) || String(b.createdAt).localeCompare(String(a.createdAt)));
  const latest = list[0];
  return (
    <Card>
      <SectionHead title="Trustee KPI dashboard" sub={latest ? `Latest period · ${latest.periodName}` : 'Institutional performance for trustees and leadership'} />
      <div style={{ marginTop: 16 }}>
        {!allowed && <ApiNote>The trustee KPI dashboard is available to trustees, principals, data analysts and administrators.</ApiNote>}
        {allowed && kpis.loading && <Loading />}
        {allowed && kpis.error && <ApiErr error={kpis.error} />}
        {allowed && kpis.data && !list.length && <p className="xs muted">No KPI snapshots yet. Use Record KPI snapshot to add the first period.</p>}
        {latest && (
          <>
            <Metrics items={[
              ['Fee collection', pct(latest.feeCollectionPct), 'Of billed fees collected', null, latest.feeCollectionPct >= 95, Wallet],
              ['Average attendance', pct(latest.averageAttendancePct), 'Across all classes', null, latest.averageAttendancePct >= 95, ClipboardCheck],
              ['Enrolment', latest.studentEnrollmentCount == null ? '—' : formatNumber(latest.studentEnrollmentCount), `Teacher : student 1 : ${latest.teacherStudentRatio ?? '—'}`, null, false, Users],
              ['Board pass rate', pct(latest.boardPassPercentage), 'Latest board results', null, latest.boardPassPercentage >= 95, GraduationCap],
            ]} />
            {latest.summaryNotes && <div style={{ marginTop: 14 }}><KV rows={[['Summary', latest.summaryNotes]]} /></div>}
            {list.length > 1 && (
              <div style={{ marginTop: 16 }}>
                <DataTable boxed cols={[
                  { label: 'Period', key: 'periodName', className: 'num' },
                  { label: 'Fee collection', render: (k) => pct(k.feeCollectionPct) },
                  { label: 'Attendance', render: (k) => pct(k.averageAttendancePct) },
                  { label: 'Enrolment', render: (k) => (k.studentEnrollmentCount == null ? '—' : formatNumber(k.studentEnrollmentCount)) },
                  { label: 'Teacher : student', render: (k) => (k.teacherStudentRatio == null ? '—' : `1 : ${k.teacherStudentRatio}`) },
                  { label: 'Board pass', render: (k) => pct(k.boardPassPercentage) },
                ]} rows={list} />
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}

const Box = ({ id, label, required, children }) => <div className="field box"><label htmlFor={id}>{label.toUpperCase()}{required ? ' *' : ''}</label>{children}</div>;
/** "grade, fee head" → '["grade","fee_head"]' (null when empty) */
const toJsonList = (s) => {
  const v = s.split(',').map((x) => x.trim().replace(/\s+/g, '_')).filter(Boolean);
  return v.length ? JSON.stringify(v) : null;
};

/* POST /reports/custom */
function CreateReportModal({ tenantId, userId, onClose, onSaved }) {
  const [f, setF] = useState({ reportName: '', category: 'FINANCE', chartType: 'TABLE', dimensions: '', metrics: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function save() {
    if (!f.reportName.trim()) { setError({ detail: 'Give the report a name.' }); return; }
    setBusy(true);
    setError(null);
    try {
      onSaved(await analytics.createCustomReport({
        tenantId, reportName: f.reportName.trim(), category: f.category, chartType: f.chartType, createdByUserId: userId,
        dimensionsJson: toJsonList(f.dimensions), metricsJson: toJsonList(f.metrics),
      }));
    } catch (e) { setError(e); setBusy(false); }
  }
  return (
    <Modal title="Create report" sub="Save a report definition. Run it any time from Saved reports." onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={save} disabled={busy}>{busy ? <LoaderCircle size={14} className="spin" /> : <Check size={14} />}Save report</button></>}>
      {error && <div style={{ marginBottom: 12 }}><ApiErr error={error} /></div>}
      <div className="fieldlist">
        <Box id="rp-name" label="Report name" required><input id="rp-name" value={f.reportName} onChange={set('reportName')} placeholder="e.g. Term 2 fee collection by class" autoFocus /></Box>
        <Box id="rp-cat" label="Category" required>
          <select id="rp-cat" value={f.category} onChange={set('category')}>{CATEGORIES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
        </Box>
        <Box id="rp-chart" label="Display as">
          <select id="rp-chart" value={f.chartType} onChange={set('chartType')}>{CHART_TYPES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
        </Box>
        <Box id="rp-dims" label="Group by (comma separated)"><input id="rp-dims" value={f.dimensions} onChange={set('dimensions')} placeholder="grade, section" /></Box>
        <Box id="rp-metrics" label="Measures (comma separated)"><input id="rp-metrics" value={f.metrics} onChange={set('metrics')} placeholder="sum(collected_amount)" /></Box>
      </div>
    </Modal>
  );
}

/* POST /reports/trustee/kpi */
function KpiModal({ tenantId, onClose, onSaved }) {
  const [f, setF] = useState({ periodName: '', feeCollectionPct: '', averageAttendancePct: '', studentEnrollmentCount: '', teacherStudentRatio: '', boardPassPercentage: '', summaryNotes: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const num = (v) => (v === '' ? null : Number(v));
  async function save() {
    if (!f.periodName.trim()) { setError({ detail: 'Enter the reporting period, for example Q3 FY 2026-27.' }); return; }
    setBusy(true);
    setError(null);
    try {
      onSaved(await analytics.recordTrusteeKpi({
        tenantId, periodName: f.periodName.trim(), feeCollectionPct: num(f.feeCollectionPct), averageAttendancePct: num(f.averageAttendancePct),
        studentEnrollmentCount: f.studentEnrollmentCount === '' ? null : parseInt(f.studentEnrollmentCount, 10), teacherStudentRatio: num(f.teacherStudentRatio),
        boardPassPercentage: num(f.boardPassPercentage), summaryNotes: f.summaryNotes.trim() || null,
      }));
    } catch (e) { setError(e); setBusy(false); }
  }
  const pctField = (k, id, l) => <Box id={id} label={l}><input id={id} type="number" min="0" max="100" step="0.1" value={f[k]} onChange={set(k)} /></Box>;
  return (
    <Modal title="Record KPI snapshot" sub="Add one reporting period to the trustee dashboard." onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={save} disabled={busy}>{busy ? <LoaderCircle size={14} className="spin" /> : <Check size={14} />}Record snapshot</button></>}>
      {error && <div style={{ marginBottom: 12 }}><ApiErr error={error} /></div>}
      <div className="fieldlist">
        <Box id="kpi-period" label="Period" required><input id="kpi-period" value={f.periodName} onChange={set('periodName')} placeholder="Q3 FY 2026-27" autoFocus /></Box>
        {pctField('feeCollectionPct', 'kpi-fee', 'Fee collection %')}
        {pctField('averageAttendancePct', 'kpi-att', 'Average attendance %')}
        <Box id="kpi-enrol" label="Students enrolled"><input id="kpi-enrol" type="number" min="0" step="1" value={f.studentEnrollmentCount} onChange={set('studentEnrollmentCount')} /></Box>
        <Box id="kpi-ratio" label="Students per teacher"><input id="kpi-ratio" type="number" min="0" step="0.1" value={f.teacherStudentRatio} onChange={set('teacherStudentRatio')} /></Box>
        {pctField('boardPassPercentage', 'kpi-board', 'Board pass %')}
        <Box id="kpi-notes" label="Summary notes"><input id="kpi-notes" value={f.summaryNotes} onChange={set('summaryNotes')} /></Box>
      </div>
    </Modal>
  );
}
