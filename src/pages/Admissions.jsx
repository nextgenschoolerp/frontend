import { Fragment, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  UserPlus, Phone, CalendarClock, ClipboardCheck, FileText, GraduationCap, ChevronRight, Plus, Download, LoaderCircle,
  UserX, LogOut, MessageSquare, Eye, MessageSquarePlus,
} from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { useApi } from '../api/useApi.js';
import * as admissionApi from '../api/admissionService.js';
import { GENDERS } from '../api/studentService.js';
import {
  PageHeader, Metrics, Card, SectionHead, Tabs, DataTable, Pill, Person, Footer, SearchBox, Pager, FilterChips, EmptyState, SkeletonTable,
  Actions, IconAction, useSort, sortRows, scrollToId, useTabParam,
} from '../components/ui.jsx';
import { Modal } from '../components/AuthSettings.jsx';
import { ApplicationModal, ApplicantCell, ApiErr, ApiNote, statusPill, gradeLabel, useApplications, exportApplicationsCsv } from '../components/Admissions.jsx';
import { useCaptureAllowed, gradeCode, academicYearCode } from '../components/NewAdmission.jsx';
import { AdmissionsOutlookModal, stuckApplications, STUCK_DAYS } from '../components/AdmissionInsights.jsx';
import { formatDate, formatDateTime, formatNumber } from '../regional.js';

/* Admissions workspace (Module 02): walk-in enquiry registration, counseling session logs and the admission pipeline.
   Applications: GET /api/v1/admissions/enquiries (US-02001) · Register walk-in: POST /enquiries with referralSource WALK_IN
   Counseling: POST /enquiries/{id}/calls, GET /enquiries/{id}/calls, GET /callbacks (US-02015) */

const CALL_WRITE = ['FRONT_OFFICE_COUNSELOR', 'ADMISSION_OFFICER', 'SUPER_ADMIN'];
const CALL_READ = [...CALL_WRITE, 'MARKETING_MANAGER'];
const OPEN = admissionApi.OPEN_STATUSES;
const TABS = ['Applications', 'Counseling log', 'Callbacks'];
const label = (code) => (code || '').toLowerCase().split('_').map((w) => (w ? w[0].toUpperCase() + w.slice(1) : '')).join(' ');

/** The stages an application moves through, left to right. `tone` colours the node; counts are applications now at that stage. */
const STAGES = [
  { key: 'NEW_INQUIRY', title: 'New enquiry', hint: 'Registered, not yet contacted', icon: UserPlus, tone: 'purple' },
  { key: 'CONTACTED', title: 'Contacted', hint: 'Counseling call or visit logged', icon: Phone, tone: 'purple' },
  { key: 'EVALUATION_SCHEDULED', title: 'Assessment scheduled', hint: 'Admit card issued', icon: CalendarClock, tone: 'amber' },
  { key: 'EVALUATION_PASSED', title: 'Assessment passed', hint: 'Test and interview cleared', icon: ClipboardCheck, tone: 'green' },
  { key: 'OFFER_ISSUED', title: 'Offer issued', hint: 'Seat deposit pending or paid', icon: FileText, tone: 'green' },
  { key: 'ENROLLED', title: 'Enrolled', hint: 'Student record created', icon: GraduationCap, tone: 'green' },
];
const EXITS = [
  { key: 'REJECTED', title: 'Not offered', icon: UserX, tone: 'red' },
  { key: 'WITHDRAWN', title: 'Withdrawn', icon: LogOut, tone: 'grey' },
];
const STAGE_ORDER = [...STAGES, ...EXITS].map((s) => s.key);

const CLASSES = ['Nursery', 'LKG', 'UKG', ...Array.from({ length: 12 }, (_, i) => `Class ${i + 1}`)];
const YEARS = ['2026–2027', '2027–2028'];
const OUTCOME_TONE = { CONNECTED: 'green', CALLBACK_REQUESTED: 'amber', NOT_INTERESTED: 'red', NO_ANSWER: '', BUSY: '', WRONG_NUMBER: 'red' };
const localDateTime = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

const In = ({ label: l, name, required, ...rest }) => (
  <div className="field box"><label htmlFor={`adm-${name}`}>{l.toUpperCase()}{required ? ' *' : ''}</label><input id={`adm-${name}`} name={name} {...rest} /></div>
);
const Sel = ({ label: l, name, options, defaultValue, required, placeholder }) => (
  <div className="field box"><label htmlFor={`adm-${name}`}>{l.toUpperCase()}{required ? ' *' : ''}</label>
    <select id={`adm-${name}`} name={name} defaultValue={defaultValue ?? ''}>
      {placeholder && <option value="" disabled>{placeholder}</option>}
      {options.map((o) => (Array.isArray(o) ? <option key={o[0]} value={o[0]}>{o[1]}</option> : <option key={o}>{o}</option>))}
    </select></div>
);

/** The call form fields shared by "Register walk-in" (optional first session) and "Log session". */
function SessionFields({ defaultDirection = 'INBOUND', defaultMinutes = 15, prefix = '' }) {
  const soon = new Date(); soon.setDate(soon.getDate() + 2); soon.setHours(11, 0, 0, 0);
  return (
    <>
      <Sel label="Outcome" name={`${prefix}outcome`} defaultValue="CONNECTED"
        options={[['CONNECTED', 'Connected, counseled'], ['CALLBACK_REQUESTED', 'Family asked for a callback'], ['NO_ANSWER', 'No answer'], ['BUSY', 'Busy'],
          ['NOT_INTERESTED', 'Not interested (withdraws the application)'], ['WRONG_NUMBER', 'Wrong number']]} />
      <Sel label="Direction" name={`${prefix}direction`} defaultValue={defaultDirection}
        options={[['INBOUND', 'Family came or called in'], ['OUTBOUND', 'We reached out']]} />
      <In label="Duration (minutes)" name={`${prefix}minutes`} type="number" min="0" max="120" defaultValue={String(defaultMinutes)} required />
      <In label="Callback at" name={`${prefix}callbackAt`} type="datetime-local" defaultValue={localDateTime(soon)} />
      <In label="Session notes" name={`${prefix}notes`} placeholder="Fees discussed, school tour, documents to bring…" />
    </>
  );
}

/** POST /enquiries/{id}/calls from the session fields (callback time only for a callback request). */
const callBody = (v, prefix = '') => ({
  direction: v[`${prefix}direction`], outcome: v[`${prefix}outcome`], durationSeconds: Math.round(Number(v[`${prefix}minutes`] || 0) * 60),
  notes: String(v[`${prefix}notes`] || '').trim() || undefined,
  callbackAt: v[`${prefix}outcome`] === 'CALLBACK_REQUESTED' && v[`${prefix}callbackAt`] ? new Date(v[`${prefix}callbackAt`]).toISOString() : undefined,
});

function WalkInModal({ onClose, onSaved, canLog }) {
  const { user, branchId } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [withSession, setWithSession] = useState(canLog);
  const submit = async (e) => {
    e.preventDefault();
    const v = Object.fromEntries(new FormData(e.currentTarget));
    const get = (k) => String(v[k] || '').trim();
    const missing = [['first', 'first name'], ['last', 'last name'], ['klass', 'class'], ['guardian', 'guardian name'], ['phone', 'mobile number'], ['email', 'email']]
      .filter(([k]) => !get(k)).map(([, t]) => t);
    if (missing.length) { setError({ detail: `Complete the required fields: ${missing.join(', ')}.` }); return; }
    const phone = get('phone').replace(/[\s().-]/g, '');
    if (!/^\+?[0-9]{7,20}$/.test(phone)) { setError({ detail: 'Enter the mobile number as digits, optionally starting with +.' }); return; }
    if (!user.tenantId || !branchId) { setError({ detail: 'Your account has no campus assigned; pick a campus in the sidebar.' }); return; }
    setBusy(true); setError(null);
    let enquiry;
    try {
      enquiry = await admissionApi.captureEnquiry({
        tenantId: user.tenantId, branchId, candidateFirstName: get('first'), candidateLastName: get('last'), targetGradeId: gradeCode(get('klass')),
        academicYearId: academicYearCode(get('year')), guardianName: get('guardian'), guardianEmail: get('email'), guardianPhone: phone,
        candidateDateOfBirth: get('dob') || undefined, candidateGender: GENDERS[get('gender')] || undefined, guardianRelationship: get('relationship') || undefined,
        referralSource: 'WALK_IN', remarks: 'Walk-in enquiry registered at the front desk',
      });
    } catch (err) { setError(err); setBusy(false); return; }
    // The first counseling session is logged against the new application; if it fails the enquiry is still saved
    let session = '';
    if (withSession) {
      try { const c = await admissionApi.logCall(enquiry.enquiryId, callBody(v, 's-')); session = ` Session logged (${label(c.outcome)}).`; }
      catch (err) { session = ` The counseling session could not be logged (${err.detail || err.message}); log it from the application.`; }
    }
    onSaved(`Walk-in registered: ${enquiry.applicationNumber}.${session}`);
  };
  return (
    <Modal title="Register walk-in enquiry" sub="A family visiting the front desk. The enquiry joins the pipeline as a new enquiry." onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" form="walkin-form" type="submit" disabled={busy}>{busy ? <LoaderCircle size={14} className="spin" /> : <Plus size={14} />}Register enquiry</button></>}>
      {error && <div style={{ marginBottom: 12 }}><ApiErr error={error} /></div>}
      <form id="walkin-form" onSubmit={submit} noValidate>
        <h4 className="formhead">Student</h4>
        <div className="fieldlist">
          <In label="First name" name="first" required placeholder="Enter first name" autoFocus />
          <In label="Last name" name="last" required placeholder="Enter last name" />
          <Sel label="Applying for" name="klass" required placeholder="Select class" options={CLASSES} />
          <Sel label="Academic year" name="year" required defaultValue={YEARS[0]} options={YEARS} />
          <In label="Date of birth" name="dob" type="date" max={new Date().toISOString().slice(0, 10)} />
          <Sel label="Gender" name="gender" placeholder="Select gender" options={['Female', 'Male', 'Non-binary', 'Prefer not to say']} />
        </div>
        <h4 className="formhead">Guardian</h4>
        <div className="fieldlist">
          <In label="Guardian name" name="guardian" required placeholder="Enter full name" />
          <Sel label="Relationship" name="relationship" placeholder="Select relationship" options={['Mother', 'Father', 'Guardian', 'Other']} />
          <In label="Mobile number" name="phone" required placeholder="+91 98111 00114" />
          <In label="Email" name="email" type="email" required placeholder="parent@example.com" />
        </div>
        {canLog && (
          <>
            <label className="checkrow"><input type="checkbox" checked={withSession} onChange={(e) => setWithSession(e.target.checked)} />Log the counseling session held at the desk</label>
            {withSession && <div className="fieldlist"><SessionFields prefix="s-" /></div>}
          </>
        )}
      </form>
    </Modal>
  );
}

function LogSessionModal({ enquiry, onClose, onSaved }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const submit = async (e) => {
    e.preventDefault();
    const v = Object.fromEntries(new FormData(e.currentTarget));
    setBusy(true); setError(null);
    try { const c = await admissionApi.logCall(enquiry.enquiryId, callBody(v)); onSaved(`Session logged for ${enquiry.candidateFirstName} ${enquiry.candidateLastName} (${label(c.outcome)}).`); }
    catch (err) { setError(err); setBusy(false); }
  };
  return (
    <Modal title="Log counseling session" sub={`${enquiry.candidateFirstName} ${enquiry.candidateLastName} · ${enquiry.applicationNumber}`} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" form="session-form" type="submit" disabled={busy}>{busy ? <LoaderCircle size={14} className="spin" /> : <MessageSquare size={14} />}Save session</button></>}>
      {error && <div style={{ marginBottom: 12 }}><ApiErr error={error} /></div>}
      <form id="session-form" onSubmit={submit} noValidate><div className="fieldlist"><SessionFields /></div></form>
    </Modal>
  );
}

/** The pipeline as a flow: a node per stage with the applications now there, and the share that moved on to the next stage. */
function PipelineFlow({ counts, total, scope, stage, onPick, loading }) {
  // "Reached" counts everyone now at this stage or later, so the connector shows how many of those who got here moved on
  const reached = STAGES.map((_, i) => STAGES.slice(i).reduce((n, s) => n + (counts[s.key] || 0), 0));
  // Each stage card: icon and count on one row, the stage name below. The description moves to the tooltip.
  const node = (s, extra = '') => {
    const n = counts[s.key] || 0;
    const Icon = s.icon;
    return (
      <button type="button" className={`flownode ${s.tone} ${extra}${stage === s.key ? ' on' : ''}`} aria-pressed={stage === s.key}
        onClick={() => onPick(stage === s.key ? '' : s.key)} title={`${s.title}${s.hint ? ` · ${s.hint}` : ''}. ${stage === s.key ? 'Showing these applications' : 'Show these applications'}`}>
        <span className="flowtop">
          <span className="flowicon"><Icon size={16} aria-hidden="true" /></span>
          <b className="flowcount">{loading ? '…' : formatNumber(n)}</b>
        </span>
        <span className="flowlabel">{s.title}</span>
      </button>
    );
  };
  return (
    <Card id="admission-pipeline">
      <SectionHead title="Admission pipeline" sub={`${scope ? `${scope} · ` : ''}Applications now at each stage · select a stage to filter the list · percentages show how many moved on to the next stage`} />
      <ol className="flow" aria-label="Admission pipeline stages">
        {STAGES.map((s, i) => (
          <Fragment key={s.key}>
            <li>{node(s)}</li>
            {i < STAGES.length - 1 && (
              <li className="flowarrow" aria-hidden="true">
                <ChevronRight size={18} />
                {!loading && !!reached[i] && <span className="flowpill">{`${Math.round((reached[i + 1] / reached[i]) * 100)}%`}</span>}
              </li>
            )}
          </Fragment>
        ))}
      </ol>
      <div className="flowexits">
        <span className="flowexitlabel">Left the pipeline</span>
        <div className="flowexitrow">
          {EXITS.map((s) => <Fragment key={s.key}>{node(s, 'exit')}</Fragment>)}
        </div>
      </div>
    </Card>
  );
}

export default function AdmissionsWorkspace() {
  const { user, hasRole } = useAuth();
  const apps = useApplications();
  const canCapture = useCaptureAllowed();
  const canLog = hasRole(...CALL_WRITE);
  const canReadCalls = hasRole(...CALL_READ);
  const [params, setParams] = useSearchParams();
  const stage = params.get('stage') || '';
  const walkInsOnly = params.get('source') === 'walk-in';
  const setFilter = (patch) => setParams((p) => {
    const n = new URLSearchParams(p);
    Object.entries(patch).forEach(([k, v]) => (v ? n.set(k, v) : n.delete(k)));
    return n;
  }, { replace: true });
  const [tab, setTab] = useTabParam(TABS);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const sort = useSort();
  const [modal, setModal] = useState(null); // 'walkin' | { session: enquiry }
  const [viewing, setViewing] = useState(null);
  const [outlookOpen, setOutlookOpen] = useState(false);
  const [msg, setMsg] = useState(null);

  const loading = apps.loading && !apps.data;
  const live = apps.canRead && !apps.missingBranch && !apps.error;
  const all = apps.rows;
  // The pipeline counts the applications the list shows (the walk-in filter applies to both), so the numbers always agree
  const scoped = useMemo(() => (walkInsOnly ? all.filter((e) => e.referralSource === 'WALK_IN') : all), [all, walkInsOnly]);
  const counts = useMemo(() => scoped.reduce((m, e) => ({ ...m, [e.enquiryStatus]: (m[e.enquiryStatus] || 0) + 1 }), {}), [scoped]);
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const walkIns = all.filter((e) => e.referralSource === 'WALK_IN');
  const walkInsThisMonth = walkIns.filter((e) => new Date(e.createdAt) >= monthStart).length;

  const callbacks = useApi(() => admissionApi.dueCallbacks(user.tenantId), [user?.tenantId], canReadCalls && !!user?.tenantId);
  const recent = all.slice(0, 40);
  const log = useApi(async () => {
    const lists = await Promise.all(recent.map((e) => admissionApi.listCalls(e.enquiryId).then((cs) => cs.map((c) => ({ ...c, enquiry: e })))));
    return lists.flat().sort((a, b) => String(b.calledAt).localeCompare(String(a.calledAt)));
  }, [recent.map((e) => e.enquiryId).join(',')], canReadCalls && live && recent.length > 0 && tab === 1);

  // A callback can belong to an application outside this campus's list, so it is fetched by id when it is not loaded
  const withEnquiry = async (enquiryId, then) => {
    const loaded = all.find((x) => x.enquiryId === enquiryId);
    if (loaded) { then(loaded); return; }
    try { then(await admissionApi.getEnquiry(enquiryId)); } catch (err) { setMsg(`Could not open the application: ${err.detail || err.message}`); }
  };

  const refresh = (note) => { setModal(null); setMsg(note || null); apps.reload(); callbacks.reload(); log.reload(); };

  const rows = all.filter((e) => (!stage || (stage === 'open' ? OPEN.includes(e.enquiryStatus) : e.enquiryStatus === stage))
    && (!walkInsOnly || e.referralSource === 'WALK_IN')
    && `${e.candidateFirstName} ${e.candidateLastName} ${e.applicationNumber} ${e.guardianName} ${e.guardianPhone}`.toLowerCase().includes(q.trim().toLowerCase()));
  const stageTitle = stage === 'open' ? 'In progress' : [...STAGES, ...EXITS].find((s) => s.key === stage)?.title;
  const chips = [
    stage && [`Stage: ${stageTitle}`, () => setFilter({ stage: '' })],
    walkInsOnly && ['Walk-ins only', () => setFilter({ source: '' })],
    q.trim() && [`Search: “${q.trim()}”`, () => setQ('')],
  ].filter(Boolean);
  const clearAll = () => { setFilter({ stage: '', source: '' }); setQ(''); setPage(1); };
  const toApplications = () => { setTab(0); scrollToId('admission-list'); };

  const cols = [
    { label: 'Applicant', sortBy: (e) => `${e.candidateFirstName} ${e.candidateLastName}`, render: (e) => <ApplicantCell enquiry={e} /> },
    { label: 'Applying for', sortBy: (e) => gradeLabel(e.targetGradeId), render: (e) => `${gradeLabel(e.targetGradeId)} · ${e.academicYearId}` },
    { label: 'Guardian', hideOnCards: true, render: (e) => <span className="cell-id"><b>{e.guardianName}</b><small>{e.guardianPhone}</small></span> },
    { label: 'Source', hideOnCards: true, sortBy: (e) => e.referralSource,
      render: (e) => (e.referralSource === 'WALK_IN' ? <Pill tone="purple" icon={UserPlus}>Walk-in</Pill> : <Pill>{label(e.referralSource) || '—'}</Pill>) },
    { label: 'Received', hideOnCards: true, sortBy: (e) => e.createdAt, render: (e) => formatDate(e.createdAt) },
    { label: 'Status', sortBy: (e) => STAGE_ORDER.indexOf(e.enquiryStatus), render: (e) => statusPill(e.enquiryStatus) },
    { label: 'Actions', render: (e) => (
      <Actions>
        <IconAction icon={Eye} label={`Review ${e.candidateFirstName || 'application'}`} onClick={() => setViewing(e)} />
        {canLog && OPEN.includes(e.enquiryStatus) && <IconAction icon={MessageSquarePlus} label={`Log a counselling session for ${e.candidateFirstName || 'this applicant'}`} onClick={() => setModal({ session: e })} />}
      </Actions>
    ) },
  ];
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pages);
  const shown = sortRows(rows, cols, sort).slice((current - 1) * pageSize, current * pageSize);

  const callbackCount = callbacks.data?.length;
  const noAccess = 'Not available for your role';
  const metrics = [
    ['Total enquiries', loading ? '…' : formatNumber(all.length), live ? 'All sources, this campus' : noAccess, null, false, null,
      live && { onClick: () => { clearAll(); toApplications(); }, hint: 'Show every application', active: !stage && !walkInsOnly }],
    ['In progress', loading ? '…' : formatNumber(all.filter((e) => OPEN.includes(e.enquiryStatus)).length), live ? 'Awaiting a decision' : noAccess, null, false, null,
      live && { onClick: () => { setFilter({ stage: 'open', source: '' }); toApplications(); }, hint: 'Show applications still open', active: stage === 'open' && !walkInsOnly }],
    ['Walk-in enquiries', loading ? '…' : formatNumber(walkIns.length), live ? `${formatNumber(walkInsThisMonth)} registered this month` : noAccess, null, false, null,
      live && { onClick: () => { setFilter({ stage: '', source: 'walk-in' }); toApplications(); }, hint: 'Show walk-in enquiries', active: walkInsOnly && !stage }],
    // Leader view: open applications that have stalled; opens seat demand, delays and what converts (read from the services on open)
    ['Admissions outlook', loading ? '…' : formatNumber(stuckApplications(all).length),
      live ? `Open applications with no change for ${STUCK_DAYS}+ days · seats, delays and what converts` : noAccess, null, false, null,
      live && { onClick: () => setOutlookOpen(true), hint: 'Open the admissions outlook: seat demand, stuck applications and conversion by source and counselor' }],
  ];

  const tabItems = [`Applications${live ? ` (${formatNumber(rows.length)})` : ''}`, `Counseling log${log.data ? ` (${formatNumber(log.data.length)})` : ''}`,
    `Callbacks${callbackCount !== undefined ? ` (${formatNumber(callbackCount)})` : ''}`];

  return (
    <>
      <PageHeader
        title="Admissions"
        desc="Register walk-in enquiries, log counseling sessions and follow every application through the pipeline."
        actions={[
          { label: 'More actions', more: [{ label: 'Export applications', icon: <Download size={15} />, disabled: !live, onClick: () => exportApplicationsCsv(rows) }] },
          canCapture && { label: 'Register walk-in', icon: <Plus size={15} />, primary: true, onClick: () => setModal('walkin') },
        ].filter(Boolean)}
      />
      {msg && <div className="api-note ok" style={{ marginBottom: 12 }}><span>{msg}</span></div>}
      {!apps.canRead
        ? <Card><ApiNote>Admission applications are visible to admissions staff: counselors, admission officers, registrars, evaluators, cashiers, principals and super administrators.</ApiNote></Card>
        : apps.missingBranch ? <Card><ApiNote>Select a campus to see its admissions.</ApiNote></Card>
          : (
            <>
              <Metrics items={metrics} />
              {outlookOpen && <AdmissionsOutlookModal apps={apps} onClose={() => setOutlookOpen(false)} />}
              {apps.error ? <Card><ApiErr error={apps.error} onRetry={apps.reload} /></Card>
                : <PipelineFlow counts={counts} total={scoped.length} scope={walkInsOnly ? 'Walk-ins only' : ''} stage={stage} loading={loading} onPick={(k) => { setFilter({ stage: k }); toApplications(); }} />}
              <Card id="admission-list" style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 28 }}>
                <Tabs items={tabItems} value={tab} onChange={setTab} />
                {tab === 0 && (
                  <>
                    <div className="filters">
                      <SearchBox placeholder="Search name, application number or guardian" value={q} onChange={(v) => { setQ(v); setPage(1); }} />
                    </div>
                    <FilterChips chips={chips} onClear={clearAll} />
                    {loading ? <SkeletonTable cols={['Applicant', 'Applying for', 'Guardian', 'Source', 'Received', 'Status', 'Actions']} />
                      : !all.length ? <EmptyState title="No enquiries yet" action={canCapture && <button type="button" className="btn primary" onClick={() => setModal('walkin')}><Plus size={15} />Register walk-in</button>}>Register the first walk-in enquiry to start the pipeline.</EmptyState>
                        : !rows.length ? <EmptyState title="No applications match" action={<button type="button" className="btn" onClick={clearAll}>Clear filters</button>}>Try a different search or stage. {formatNumber(all.length)} applications in total.</EmptyState>
                          : (
                            <div className="tablebox">
                              <DataTable cols={cols} sort={sort} cards rows={shown} />
                              <Pager page={current} pages={pages} onPage={setPage} pageSize={pageSize} onPageSize={(n) => { setPageSize(n); setPage(1); }}
                                text={`Showing ${(current - 1) * pageSize + 1}–${(current - 1) * pageSize + shown.length} of ${rows.length} application${rows.length === 1 ? '' : 's'}${rows.length < all.length ? ` (filtered from ${all.length})` : ''}`} />
                            </div>
                          )}
                  </>
                )}
                {tab === 1 && (!canReadCalls ? <ApiNote>Counseling logs are visible to counselors, admission officers and the marketing manager.</ApiNote>
                  : log.loading ? <SkeletonTable cols={['When', 'Applicant', 'Outcome', 'Notes']} />
                    : log.error ? <ApiErr error={log.error} onRetry={log.reload} />
                      : !(log.data || []).length ? <EmptyState title="No counseling sessions logged yet">Sessions logged from an application or when registering a walk-in appear here.</EmptyState>
                        : (
                          <div className="tablebox">
                            <DataTable cards cols={[
                              // Direction and duration sit under the time, so the table keeps its Review action on screen
                              { label: 'When', render: (c) => <span className="cell-id"><b>{formatDateTime(c.calledAt)}</b><small>{label(c.direction)} · {Math.round((c.durationSeconds || 0) / 60)} min</small></span> },
                              { label: 'Applicant', render: (c) => <Person name={`${c.enquiry.candidateFirstName} ${c.enquiry.candidateLastName}`} sub={c.applicationNumber} /> },
                              { label: 'Outcome', render: (c) => <Pill tone={OUTCOME_TONE[c.outcome]}>{label(c.outcome)}</Pill> },
                              { label: 'Notes', hideOnCards: true, render: (c) => <span className="xs logNotes" title={c.notes || undefined}>{c.notes || '—'}</span> },
                              { label: 'Actions', render: (c) => <Actions><IconAction icon={Eye} label={`Review ${c.enquiry?.candidateFirstName || 'application'}`} onClick={() => setViewing(c.enquiry)} /></Actions> },
                            ]} rows={log.data} />
                          </div>
                        ))}
                {tab === 2 && (!canReadCalls ? <ApiNote>Callbacks are visible to counselors, admission officers and the marketing manager.</ApiNote>
                  : callbacks.loading ? <SkeletonTable cols={['Applicant', 'Guardian', 'Scheduled', 'Status', 'Reason']} />
                    : callbacks.error ? <ApiErr error={callbacks.error} onRetry={callbacks.reload} />
                      : !(callbacks.data || []).length ? <EmptyState title="No callbacks scheduled">A callback is scheduled when a family asks to be called back during a session.</EmptyState>
                        : (
                          <div className="tablebox">
                            <DataTable cards cols={[
                              { label: 'Applicant', render: (c) => <span className="cell-id"><b>{c.candidateName}</b><small>{c.applicationNumber}</small></span> },
                              { label: 'Guardian', hideOnCards: true, render: (c) => <span className="cell-id"><b>{c.guardianName}</b><small>{c.guardianPhone}</small></span> },
                              { label: 'Scheduled', render: (c) => formatDateTime(c.scheduledAt) },
                              { label: 'Status', render: (c) => (c.overdue ? <Pill tone="red">Overdue</Pill> : <Pill tone="amber" icon={CalendarClock}>Scheduled</Pill>) },
                              { label: 'Reason', hideOnCards: true, render: (c) => <span className="xs">{c.reason || '—'}</span> },
                              { label: 'Actions', render: (c) => (
                                <Actions>
                                  <IconAction icon={Eye} label={`Review ${c.candidateName || 'application'}`} onClick={() => withEnquiry(c.enquiryId, setViewing)} />
                                  {canLog && <IconAction icon={MessageSquarePlus} label={`Log a counselling session for ${c.candidateName || 'this applicant'}`} onClick={() => withEnquiry(c.enquiryId, (e) => setModal({ session: e }))} />}
                                </Actions>
                              ) },
                            ]} rows={callbacks.data} />
                          </div>
                        ))}
              </Card>
            </>
          )}
      {modal === 'walkin' && <WalkInModal canLog={canLog} onClose={() => setModal(null)} onSaved={refresh} />}
      {modal?.session && <LogSessionModal enquiry={modal.session} onClose={() => setModal(null)} onSaved={refresh} />}
      {viewing && <ApplicationModal enquiry={all.find((e) => e.enquiryId === viewing.enquiryId) || viewing} onClose={() => setViewing(null)} onChanged={() => refresh()} />}
      <Footer />
    </>
  );
}
