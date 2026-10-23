import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Send, GraduationCap, Users, ClipboardCheck, Wallet, FolderOpen, Settings as Cog, LoaderCircle } from 'lucide-react';
import { PageHeader, Card, SectionHead, SearchBox, DataTable, Pill, Footer, KV, useBackLink } from './ui.jsx';
import { Modal } from './AuthSettings.jsx';
import { ApiErr, ApiNote } from './Admissions.jsx';
import { useApi } from '../api/useApi.js';
import { useAuth } from '../auth.jsx';
import * as comm from '../api/communicationService.js';
import { formatDateTime } from '../regional.js';

/*
 * Help & support: step-by-step guides (written here), support tickets (communicationservice
 * /api/v1/communication/support/tickets) and a live check of every backend service behind the Vite proxy.
 */

// Set per deployment (.env.*); the email and phone lines are hidden until they are set, tickets always work
const SUPPORT_EMAIL = (import.meta.env.VITE_SUPPORT_EMAIL || '').trim();
const SUPPORT_PHONE = (import.meta.env.VITE_SUPPORT_PHONE || '').trim();
const SUPPORT_HOURS = (import.meta.env.VITE_SUPPORT_HOURS || '').trim() || 'Mon–Fri · school hours';

const TOPICS = [
  ['students', GraduationCap, 'Students & admissions', 'Create records, enrol students and update guardians.'],
  ['staff', Users, 'Staff & faculty', 'Manage employment, teaching assignments and leave.'],
  ['attendance', ClipboardCheck, 'Attendance', 'Complete registers and follow up on absences.'],
  ['fees', Wallet, 'Fees & payments', 'Record payments, reconcile invoices and send reminders.'],
  ['academics', FolderOpen, 'Academics & reports', 'Build timetables, enter grades and export reports.'],
  ['settings', Cog, 'Settings & security', 'Manage users, permissions and school preferences.'],
];

// [id, topic, title, summary, steps, page]
const ARTICLES = [
  ['add-student', 'students', 'Add a student', 'Create a student record with placement, guardians and medical details.',
    ['Open Students and choose Add student.', 'Fill in the personal details; fields marked * are required.', 'Place the student in a class, section and house.', 'Add at least one guardian with a phone number and mark the primary contact.', 'Save. The student gets a permanent UID and appears in the directory.'], '/students/new'],
  ['admit-student', 'students', 'Admit a new student: step by step', 'Move an application from enquiry to enrolment.',
    ['Open Students → Admissions.', 'Review the application and its documents; request anything missing.', 'Record the interview or assessment result.', 'Approve the application and issue the offer.', 'Once fees are paid, enrol the student; the record moves to the directory.'], '/students?tab=admissions'],
  ['update-guardian', 'students', 'Update guardian details', 'Change phone numbers, emails or the primary contact.',
    ['Open the student profile from Students.', 'Choose Edit.', 'Change the guardian details and save. Messages use the primary contact.'], '/students'],
  ['add-staff', 'staff', 'Add a staff member', 'Create an employee record and assign a role.',
    ['Open Staff & faculty and choose Add staff member.', 'Enter employment details and the role.', 'Save; the staff member can then be given teaching assignments.'], '/staff/new'],
  ['approve-leave', 'staff', 'Approve a leave request', 'Review and approve or decline staff leave.',
    ['Open Staff & faculty; the Leave requests figure and the Leave & cover card show how many requests are pending.', 'Open the staff member’s profile (View profile) and choose the Leave & attendance tab.', 'Approve or decline the pending request. Cover for their lessons is arranged in Teaching & learning → Cover.'], '/staff'],
  ['correct-register', 'attendance', 'Correct an attendance register', 'Change a mark after the register was submitted.',
    ['Open Attendance → Daily register.', 'Pick the date, the class and the section, then the morning or afternoon register.', 'Change the student’s mark and save the register again.'], '/attendance'],
  ['absence-follow-up', 'attendance', 'Follow up an unexplained absence', 'Contact families about unexcused absences.',
    ['Open Attendance → Absence history and pick the class and dates.', 'Check which absences are unexcused.', 'Contact the families from Communications → Absence alerts.'], '/attendance?tab=absence-history'],
  ['record-payment', 'fees', 'Record a payment', 'Record a fee payment and issue a receipt.',
    ['Open Fees & payments and choose Record payment (or Record payment next to an account under Outstanding accounts).', 'Pick the student, then enter the amount and payment method.', 'Save. A receipt is issued, appears under Recent transactions and the balance updates.'], '/fees'],
  ['fee-reminders', 'fees', 'Follow up overdue fees', 'Find families with overdue balances and remind them.',
    ['Open Fees & payments and scroll to Outstanding accounts.', 'Filter by class to see each student’s overdue amount and installments.', 'Send the families a reminder as a circular from Communications → Circulars, and record payments as they come in.'], '/fees'],
  ['progress-reports', 'academics', 'Prepare mid-term progress reports', 'Collect grades and publish reports.',
    ['Open Academics and pick the assessment term, class and section.', 'Check Incomplete entries: publishing is blocked until every mark is in.', 'Open Broadsheet and choose Publish progress cards.'], '/academics?tab=broadsheet'],
  ['timetable', 'academics', 'Build a class timetable', 'Allocate teachers and generate the week’s periods.',
    ['Open Teaching & learning → Allocations and give each subject of the class a teacher.', 'Choose Generate timetables, pick the classes and run it (timetable in-charge).', 'Check the result in the Timetable tab, by class or by teacher.'], '/teaching?tab=allocations'],
  ['reset-access', 'settings', 'Reset a user’s access', 'Help a colleague who cannot sign in.',
    ['Ask them to use “Forgot password?” on the sign-in page to get a reset link.', 'After too many failed attempts the account locks for a short time and unlocks on its own; wait, then try again.', 'If access still looks wrong, check their roles in Settings → Users & permissions and the audit log in Settings → Security & audit.'], '/settings?tab=security'],
  ['regional', 'settings', 'Change time zone, currency or date format', 'Regional preferences for the whole school.',
    ['Open Settings → General and find Regional preferences.', 'Change the time zone, currency or date format.', 'Save; every screen uses the new settings.'], '/settings'],
  ['term-dates', 'settings', 'Set term dates and half-terms', 'Keep the academic calendar up to date.',
    ['Open Settings → Academic setup.', 'Choose Manage term dates.', 'Edit each term and its half-term, mark the current term and save.'], '/settings?tab=academic'],
].map(([id, topic, title, summary, steps, to]) => ({ id, topic, title, summary, steps, to }));
const article = (id) => ARTICLES.find((a) => a.id === id);
const POPULAR = ['add-student', 'record-payment', 'reset-access'];
const RECOMMENDED = ['admit-student', 'correct-register', 'fee-reminders', 'progress-reports'];

const CATEGORIES = [['ACCOUNT_ACCESS', 'Account access'], ['STUDENTS', 'Students & admissions'], ['ATTENDANCE', 'Attendance'], ['FEES', 'Finance & billing'], ['ACADEMICS', 'Academics & reports'], ['OTHER', 'Something else']];
const categoryLabel = (c) => CATEGORIES.find(([v]) => v === c)?.[1] || c;
const STATUS = { OPEN: ['Open', 'amber'], IN_PROGRESS: ['In progress', 'purple'], RESOLVED: ['Resolved', 'green'] };
const statusPill = (s) => <Pill tone={(STATUS[s] || [s, ''])[1]}>{(STATUS[s] || [s])[0]}</Pill>;

// Services behind the Vite proxy, each probed on an endpoint every signed-in role may call; a service is up when it answers 2xx
const SERVICES = [
  ['Sign-in & settings', 'authservice', '/api/v1/auth/me'], ['Admissions', 'admissionservice', '/api/v1/admissions/access-rules'],
  ['Student records & attendance', 'studentservice', '/api/v1/academic/access-rules'], ['Fees & payments', 'financeservice', '/api/v1/finance/access-rules'],
  ['Examinations', 'examservice', '/api/v1/exams/access-rules'], ['Teaching & learning', 'academicservice', '/api/v1/lms/access-rules'],
  ['Staff & HR', 'hrservice', '/api/v1/hr/access-rules'], ['Communications & documents', 'communicationservice', (u) => `/api/v1/communication/support/tickets?requesterUserId=${encodeURIComponent(u.userId)}`],
];
async function probe(path, tenantId) {
  const token = (() => { try { const k = Object.keys(localStorage).concat(Object.keys(sessionStorage)).find((x) => { try { return JSON.parse(localStorage.getItem(x) || sessionStorage.getItem(x))?.token; } catch { return false; } }); return JSON.parse(localStorage.getItem(k) || sessionStorage.getItem(k)).token; } catch { return null; } })();
  const started = performance.now();
  try {
    const res = await fetch(`${path}${path.includes('?') ? '&' : '?'}tenantId=${encodeURIComponent(tenantId)}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    return { up: res.ok, ms: Math.round(performance.now() - started) };
  } catch {
    return { up: false, ms: null };
  }
}

export function Help() {
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null); // article id
  const [topic, setTopic] = useState(null);
  const [modal, setModal] = useState(null); // 'new' | 'conversation' | 'tickets' | 'status' | ticketId
  const [notice, setNotice] = useState(null);
  const tickets = useApi(() => comm.listSupportTickets(user.tenantId, user.userId), [user.tenantId, user.userId]);
  const mine = Array.isArray(tickets.data) ? tickets.data : [];
  const [status, setStatus] = useState(null); // { [service]: { up, ms } }
  const checkStatus = async () => {
    setStatus(null);
    const results = await Promise.all(SERVICES.map(([, svc, path]) => probe(typeof path === 'function' ? path(user) : path, user.tenantId).then((r) => [svc, r])));
    setStatus(Object.fromEntries(results));
  };
  useEffect(() => { checkStatus(); }, []);
  const down = status ? SERVICES.filter(([, svc]) => !status[svc].up) : [];

  const needle = q.trim().toLowerCase();
  const results = needle ? ARTICLES.filter((a) => `${a.title} ${a.summary} ${a.steps.join(' ')}`.toLowerCase().includes(needle)) : [];
  const ticketCols = [
    { label: 'Ticket / subject', render: (t) => <span className="cell-id"><b>{t.subject}</b><small>#{t.ticketNumber} · {categoryLabel(t.category)}</small></span> },
    { label: 'Status', render: (t) => statusPill(t.status) },
    { label: 'Updated', render: (t) => formatDateTime(t.lastActivityAt, { year: false }) },
    { label: 'Action', render: (t) => <button type="button" className="act" onClick={() => setModal(t.ticketId)}>View ticket</button> },
  ];
  const created = (t) => { tickets.reload(); setModal(t.ticketId); setNotice(`Ticket #${t.ticketNumber} created. We usually reply within 2 hours.`); };

  return (
    <>
      <PageHeader title="Help & support" desc="Find answers, learn school workflows and get help from our support team."
        actions={[{ label: 'Create support ticket', icon: <Plus size={15} />, primary: true, onClick: () => setModal('new') }]} />
      {notice && <div className="api-note ok"><span>{notice}</span></div>}
      <div className="cols s404">
        <div className="stack">
          <Card className="helphero">
            <h2>How can we help you, {user.name.split(' ')[0]}?</h2>
            <p className="small muted">Search step-by-step guides for your school workspace.</p>
            <SearchBox placeholder="Search help articles, workflows or a question..." value={q} onChange={setQ} />
            {needle ? (
              <div style={{ marginTop: 8 }}>
                {results.length ? results.map((a) => <div key={a.id} style={{ marginTop: 6 }}><button type="button" className="link" onClick={() => setOpen(a.id)}>{a.title} →</button><span className="xs muted"> · {a.summary}</span></div>)
                  : <p className="small muted">No guides match “{q.trim()}”. <button type="button" className="link" onClick={() => setModal('new')}>Ask the support team →</button></p>}
              </div>
            ) : (
              <p className="small muted">Popular: {POPULAR.map((id, i) => <span key={id}>{i > 0 && ' · '}<button type="button" className="link" onClick={() => setOpen(id)}>{article(id).title}</button></span>)}</p>
            )}
          </Card>
          <Card>
            <div className="cardhead"><h3>Browse help topics</h3><p>Practical guides for your school’s day-to-day work</p></div>
            <div className="topics">
              {TOPICS.map(([key, Icon, t, d]) => {
                const n = ARTICLES.filter((a) => a.topic === key).length;
                return <div className="topic" key={key}><div className="sym"><Icon size={16} /></div><div><b>{t}</b><p>{d}</p><button type="button" className="link" onClick={() => setTopic(key)}>{n} {n === 1 ? 'article' : 'articles'} →</button></div></div>;
              })}
            </div>
          </Card>
          <Card>
            <SectionHead title="Your support tickets" sub="Track requests from the school office." link={mine.length > 3 ? 'View all tickets →' : undefined} onClick={() => setModal('tickets')} />
            <div style={{ marginTop: 18 }}>
              {tickets.error ? <ApiErr error={tickets.error} />
                : !tickets.data ? <p className="xs muted">Loading…</p>
                  : mine.length ? <DataTable boxed cols={ticketCols} rows={mine.slice(0, 3)} />
                    : <ApiNote>You have no support tickets. Use Create support ticket when you need help.</ApiNote>}
            </div>
          </Card>
        </div>
        <div className="stack">
          <Card>
            <h3 style={{ fontSize: 15, fontWeight: 600 }}>Contact support</h3>
            <p className="small muted" style={{ margin: '4px 0 14px' }}>Our team is here to help.</p>
            <Pill tone="green">Support team online</Pill>
            <KV rows={[['Hours', SUPPORT_HOURS], ['Response time', 'Usually within 2 hours']]} />
            {SUPPORT_EMAIL && <a className="link" style={{ display: 'block', margin: '8px 0 4px' }} href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>}
            {SUPPORT_PHONE && <a className="small muted" href={`tel:${SUPPORT_PHONE.replace(/[^\d+]/g, '')}`}>{SUPPORT_PHONE}</a>}
            {!SUPPORT_EMAIL && !SUPPORT_PHONE && <p className="small muted" style={{ marginTop: 8 }}>Create a support ticket or start a conversation; replies arrive here and by email.</p>}
            <button className="btn primary" style={{ margin: '16px 0 14px', display: 'flex' }} onClick={() => setModal('conversation')}>Start a conversation</button>
            <p className="xs muted">For urgent safeguarding concerns, follow your school’s safeguarding policy and contact the designated lead.</p>
          </Card>
          <Card>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Recommended guides</h3>
            {RECOMMENDED.map((id) => <div key={id} style={{ marginTop: 12 }}><button type="button" className="link" onClick={() => setOpen(id)}>{article(id).title} →</button></div>)}
          </Card>
          <Card>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>System status</h3>
            {!status ? <Pill><LoaderCircle size={12} className="spin" /> Checking services…</Pill>
              : down.length ? <Pill tone="amber">{down.length} of {SERVICES.length} services unavailable</Pill> : <Pill tone="green">All systems operational</Pill>}
            <p className="body-s" style={{ margin: '12px 0' }}>{!status ? 'Checking each service now.' : down.length ? `${down.map(([n]) => n).join(', ')} ${down.length === 1 ? 'is' : 'are'} not responding.` : 'Student records, payments and communications are running normally.'}</p>
            <button type="button" className="link" onClick={() => setModal('status')}>View service status →</button>
          </Card>
        </div>
      </div>
      {open && <ArticleModal a={article(open)} onClose={() => setOpen(null)} onHelp={() => { setOpen(null); setModal('new'); }} />}
      {topic && (
        <Modal title={TOPICS.find(([k]) => k === topic)[2]} sub="Help articles" onClose={() => setTopic(null)} footer={<button className="btn primary" onClick={() => setTopic(null)}>Done</button>}>
          {ARTICLES.filter((a) => a.topic === topic).map((a) => (
            <div key={a.id} style={{ marginTop: 10 }}><button type="button" className="link" onClick={() => { setTopic(null); setOpen(a.id); }}>{a.title} →</button><p className="xs muted">{a.summary}</p></div>
          ))}
        </Modal>
      )}
      {modal === 'tickets' && (
        <Modal title="Your support tickets" sub={`${mine.length} tickets`} onClose={() => setModal(null)} footer={<button className="btn primary" onClick={() => setModal(null)}>Done</button>}>
          <DataTable boxed cols={ticketCols} rows={mine} />
        </Modal>
      )}
      {modal === 'status' && (
        <Modal title="Service status" sub="Each service is checked from this browser" onClose={() => setModal(null)}
          footer={<><button className="btn" onClick={checkStatus}>Check again</button><button className="btn primary" onClick={() => setModal(null)}>Done</button></>}>
          <DataTable boxed cols={[
            { label: 'Area', key: 0 }, { label: 'Service', render: (r) => <span className="xs muted">{r[1]}</span> },
            { label: 'Status', render: (r) => (!status ? '…' : status[r[1]].up ? <Pill tone="green">Operational</Pill> : <Pill tone="red">Not responding</Pill>) },
            { label: 'Response', render: (r) => (status?.[r[1]]?.ms != null ? `${status[r[1]].ms} ms` : '—') },
          ]} rows={SERVICES} />
        </Modal>
      )}
      {(modal === 'new' || modal === 'conversation') && (
        <NewTicketModal conversation={modal === 'conversation'} onClose={() => setModal(null)} onCreated={created} />
      )}
      {modal && !['new', 'conversation', 'tickets', 'status'].includes(modal) && (
        <TicketModal ticketId={modal} onClose={() => setModal(null)} onChanged={tickets.reload} />
      )}
      <Footer />
    </>
  );
}

function ArticleModal({ a, onClose, onHelp }) {
  const go = useBackLink(a.to);
  return (
    <Modal title={a.title} sub={a.summary} onClose={onClose}
      footer={<><button className="btn" onClick={onHelp}>Still stuck? Ask support</button><Link className="btn primary" to={a.to} onClick={(e) => { onClose(); go(e); }}>Go to the page</Link></>}>
      <ol style={{ paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 8 }} className="body-s">
        {a.steps.map((s) => <li key={s}>{s}</li>)}
      </ol>
    </Modal>
  );
}

function NewTicketModal({ conversation, onClose, onCreated }) {
  const { user } = useAuth();
  const [f, setF] = useState({ subject: '', category: conversation ? 'OTHER' : 'ACCOUNT_ACCESS', priority: 'NORMAL', description: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const ok = f.subject.trim() && f.description.trim();
  const submit = async () => {
    setBusy(true); setError(null);
    try {
      onCreated(await comm.createSupportTicket({ tenantId: user.tenantId, requesterUserId: user.userId, requesterName: user.name, requesterEmail: user.email,
        ...f, subject: f.subject.trim(), description: f.description.trim() }));
    } catch (e) { setError(e); } finally { setBusy(false); }
  };
  return (
    <Modal title={conversation ? 'Start a conversation' : 'Create support ticket'} sub="The support team replies here and by email" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!ok || busy} onClick={submit}>{busy ? <LoaderCircle size={14} className="spin" /> : <Send size={14} />}{conversation ? 'Send message' : 'Create ticket'}</button></>}>
      <div className="field box"><label htmlFor="st-subject">SUBJECT *</label><input id="st-subject" maxLength={200} value={f.subject} onChange={set('subject')} autoFocus placeholder="e.g. Cannot export the fee statement" /></div>
      <div className="fieldgrid" style={{ '--cols': 2 }}>
        <div className="field box"><label htmlFor="st-cat">TOPIC</label><select id="st-cat" value={f.category} onChange={set('category')}>{CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        <div className="field box"><label htmlFor="st-pri">PRIORITY</label><select id="st-pri" value={f.priority} onChange={set('priority')}><option value="NORMAL">Normal</option><option value="URGENT">Urgent</option></select></div>
      </div>
      <div className="field box"><label htmlFor="st-desc">{conversation ? 'MESSAGE *' : 'WHAT DO YOU NEED HELP WITH? *'}</label><textarea id="st-desc" rows={5} maxLength={4000} value={f.description} onChange={set('description')} /></div>
      {error && <ApiErr error={error} />}
    </Modal>
  );
}

function TicketModal({ ticketId, onClose, onChanged }) {
  const { user } = useAuth();
  const t = useApi(() => comm.getSupportTicket(ticketId), [ticketId]);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const act = async (fn) => {
    setBusy(true); setError(null);
    try { await fn(); t.reload(); onChanged(); } catch (e) { setError(e); } finally { setBusy(false); }
  };
  const d = t.data;
  return (
    <Modal title={d ? d.subject : 'Support ticket'} sub={d ? `#${d.ticketNumber} · ${categoryLabel(d.category)}${d.priority === 'URGENT' ? ' · Urgent' : ''}` : ''} onClose={onClose}
      footer={d && <>
        {d.status === 'RESOLVED'
          ? <button className="btn" disabled={busy} onClick={() => act(() => comm.setSupportTicketStatus(ticketId, 'OPEN'))}>Reopen ticket</button>
          : <button className="btn" disabled={busy} onClick={() => act(() => comm.setSupportTicketStatus(ticketId, 'RESOLVED'))}>Mark as resolved</button>}
        <button className="btn primary" disabled={busy || !reply.trim()} onClick={() => act(async () => { await comm.replySupportTicket(ticketId, { authorName: user.name, body: reply.trim() }); setReply(''); })}><Send size={14} />Send reply</button>
      </>}>
      {t.error ? <ApiErr error={t.error} /> : !d ? <p className="xs muted">Loading…</p> : (<>
        <div style={{ marginBottom: 12 }}>{statusPill(d.status)}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {d.messages.map((m) => (
            <div key={m.messageId} className="card" style={{ padding: 12, background: m.authorRole === 'SUPPORT' ? 'var(--tint)' : 'var(--sb)' }}>
              <div className="row"><b style={{ fontSize: 12 }}>{m.authorName}{m.authorRole === 'SUPPORT' ? ' · Support team' : ''}</b><span className="xs muted">{formatDateTime(m.sentAt, { year: false })}</span></div>
              <p className="body-s" style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>{m.body}</p>
            </div>
          ))}
        </div>
        <div className="field box"><label htmlFor="st-reply">{d.status === 'RESOLVED' ? 'REPLY (REOPENS THE TICKET)' : 'REPLY'}</label><textarea id="st-reply" rows={3} maxLength={4000} value={reply} onChange={(e) => setReply(e.target.value)} /></div>
      </>)}
      {error && <ApiErr error={error} />}
    </Modal>
  );
}
