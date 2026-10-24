import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Plus, QrCode, ShieldAlert, LoaderCircle, Check, Send } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { useApi } from '../api/useApi.js';
import * as comm from '../api/communicationService.js';
import { PageHeader, Metrics, scrollToId, Card, Tabs, DataTable, Pill, todayIso, useTabParam } from './ui.jsx';
import { Modal } from './AuthSettings.jsx';
import { ApiErr, ApiNote } from './Admissions.jsx';
import { formatDate, formatDateTime, formatTime } from '../regional.js';

/* Communications workspace, live from communicationservice (Module 09): circulars, messages, gate passes, visitors,
   grievances, absence alerts and the signed-in user's alert preferences. */

const { ROLES } = comm;
const TABS = ['Circulars', 'Messages', 'Gate passes', 'Visitors', 'Grievances', 'Absence alerts', 'Preferences'];
const Loading = () => <p className="xs muted"><LoaderCircle size={12} className="spin" /> Loading…</p>;
const Ok = ({ children }) => <div className="api-note ok" style={{ marginBottom: 12 }}><Check size={14} style={{ flex: 'none' }} /><span>{children}</span></div>;
/** "IN_PROGRESS" → "In progress" */
const label = (code) => (code ? code.charAt(0) + code.slice(1).toLowerCase().replace(/_/g, ' ') : '—');
const when = (t) => (t ? formatDateTime(t, { year: false }) : '—');
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

const CHANNELS = [['MULTI_CHANNEL', 'WhatsApp, SMS & app push'], ['WHATSAPP', 'WhatsApp'], ['SMS', 'SMS'], ['PUSH', 'App push'], ['EMAIL', 'Email']];
const AUDIENCES = [['ALL_PARENTS', 'All parents & guardians'], ['ALL_STAKEHOLDERS', 'All parents, students & staff'], ['ALL_TEACHERS', 'All teaching staff'],
  ['GRADE_10', 'Class 10 families'], ['TRANSPORT_COMMUTERS', 'School bus families']];
const PRIORITIES = [['NORMAL', 'Normal'], ['URGENT', 'Urgent']];
const CATEGORIES = [['TRANSPORT', 'Transport & bus routes'], ['ACADEMIC', 'Academics & teaching'], ['FEES', 'Fees & payments'], ['FACILITY', 'Facilities & cafeteria']];
const text = (list, code) => list.find(([c]) => c === code)?.[1] || label(code);
const tone = {
  delivery: { DELIVERED: 'green', READ: 'green', SENT: '', FAILED: 'red' },
  pass: { ISSUED: 'amber', VERIFIED: 'purple', DEPARTED: 'green', CANCELLED: '' },
  ticket: { OPEN: 'amber', IN_PROGRESS: 'purple', ESCALATED: 'red', RESOLVED: 'green' },
  visitor: { SCHEDULED: 'amber', CHECKED_IN: 'green', CHECKED_OUT: '' },
};

/** A select or input in the standard boxed field. */
const Box = ({ id, label: l, required, children }) => <div className="field box"><label htmlFor={id}>{l.toUpperCase()}{required ? ' *' : ''}</label>{children}</div>;
const Choice = ({ id, value, onChange, options }) => (
  <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>{options.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
);

export default function CommunicationsLive() {
  const { user, hasRole } = useAuth();
  const tenantId = user.tenantId;
  const today = todayIso();
  const can = Object.fromEntries(Object.entries(ROLES).map(([k, roles]) => [k, hasRole(...roles)]));
  // Tabs the role can use at all; the rest are left out rather than shown with a refusal
  const tabs = TABS.filter((t) => ({
    Messages: can.messaging, 'Gate passes': can.gatePass || can.security, Visitors: can.reception,
    Grievances: can.reception || can.parent, Preferences: can.parent,
  })[t] ?? true);
  const [tab, setTab] = useTabParam(tabs);
  const [msg, setMsg] = useState(null);
  // Stat card → its tab (null when this role has no such tab, so the card stays plain)
  const toTab = (name) => { const i = tabs.indexOf(name); return i < 0 ? null : { onClick: () => { setTab(i); setMsg(null); scrollToId('comms-tabs'); }, hint: `Open ${name.toLowerCase()}`, active: tab === i }; };
  // Another page can open a prefilled circular (Calendar's "Message attendees")
  const draft = useLocation().state?.circular;
  const [modal, setModal] = useState(draft && can.broadcast ? 'circular' : null); // 'circular' | 'emergency' | 'scan'

  const active = useApi(() => comm.listBroadcasts(tenantId), [tenantId]);
  const absences = useApi(() => comm.listAbsenceAlerts(tenantId, today), [tenantId, today], can.attendanceAlerts);
  const grievances = useApi(() => comm.listGrievances(tenantId), [tenantId], can.reception);
  const visitors = useApi(() => comm.listVisitorAppointments(tenantId), [tenantId], can.reception);

  const live = (active.data || []).filter((b) => !b.isArchived);
  const openTickets = (grievances.data || []).filter((g) => g.status !== 'RESOLVED');
  const visitsToday = (visitors.data || []).filter((v) => String(v.appointmentTime || '').slice(0, 10) === today);
  const count = (r, n, allowed = true) => (!allowed || r.error ? '—' : r.data ? String(n) : '…');
  const sub = (r, allowed, text, fallback) => (!allowed ? 'Not available for your role' : r.data ? text : fallback);
  const done = (text) => { setMsg(text); setModal(null); };

  return (
    <>
      <PageHeader
        title="Communications"
        desc="Circulars, parent messages, gate passes, visitors and grievances for the school community."
        actions={[
          can.security && { label: 'Scan gate pass', icon: <QrCode size={15} />, onClick: () => setModal('scan') },
          can.leadership && { label: 'Emergency alert', icon: <ShieldAlert size={15} />, onClick: () => setModal('emergency') },
          can.broadcast && { label: 'New circular', icon: <Plus size={15} />, primary: true, onClick: () => setModal('circular') },
        ].filter(Boolean)}
      />
      <Metrics items={[
        ['Active circulars', count(active, live.length), active.data ? `${live.filter((b) => b.isPinned).length} pinned to the top of the parent app` : 'WhatsApp, SMS, app push & email', null, false, null, toTab('Circulars')],
        ['Absence alerts today', count(absences, absences.data?.length, can.attendanceAlerts),
          sub(absences, can.attendanceAlerts, `${(absences.data || []).filter((a) => a.escalated).length} escalated to the counselor`, 'Sent 30 minutes after registration'), null, false, null, toTab('Absence alerts')],
        ['Open grievances', count(grievances, openTickets.length, can.reception),
          sub(grievances, can.reception, `${openTickets.filter((g) => g.status === 'ESCALATED').length} escalated past their SLA`, 'Parent support tickets'), null, false, null, toTab('Grievances')],
        ['Visitors today', count(visitors, visitsToday.length, can.reception),
          sub(visitors, can.reception, `${visitsToday.filter((v) => v.status === 'CHECKED_IN').length} on site now`, 'Reception appointments'), null, false, null, toTab('Visitors')],
      ]} />
      {msg && <Ok>{msg}</Ok>}
      <Card id="comms-tabs">
        <Tabs items={tabs} value={tab} onChange={(i) => { setTab(i); setMsg(null); }} />
        <div style={{ marginTop: 16 }}>
          {tabs[tab] === 'Circulars' ? <CircularsTab active={active} onDone={setMsg} />
            : tabs[tab] === 'Messages' ? <MessagesTab />
              : tabs[tab] === 'Gate passes' ? <GatePassTab onDone={setMsg} />
                : tabs[tab] === 'Visitors' ? <VisitorsTab visitors={visitors} onDone={setMsg} />
                  : tabs[tab] === 'Grievances' ? <GrievancesTab grievances={grievances} onDone={setMsg} />
                    : tabs[tab] === 'Absence alerts' ? <AbsenceTab today={absences} onDone={setMsg} />
                      : <PreferencesTab onDone={setMsg} />}
        </div>
      </Card>
      {modal === 'circular' && <CircularModal initial={draft} onClose={() => setModal(null)} onSaved={(b) => { active.reload(); done(`“${b.title}” sent to ${text(AUDIENCES, b.targetAudience).toLowerCase()}.`); }} />}
      {modal === 'emergency' && <EmergencyModal onClose={() => setModal(null)} onSaved={(b) => { active.reload(); done(`Emergency alert “${b.title}” sent and pinned.`); }} />}
      {modal === 'scan' && <ScanModal onClose={() => setModal(null)} onSaved={(p) => done(`Pass ${p.qrCode} verified: ${p.studentName} may leave${p.exitTime ? ` (exit ${formatTime(p.exitTime)})` : ''}.`)} />}
    </>
  );
}

/* ---------- Circulars (US-09000, US-09010, US-09011, US-09018, US-09019) ---------- */
function CircularsTab({ active, onDone }) {
  const { user, hasRole } = useAuth();
  const manage = hasRole(...ROLES.broadcast);
  const pin = hasRole(...ROLES.leadership);
  const [view, setView] = useState('active');
  const pinned = useApi(() => comm.listPinnedBroadcasts(user.tenantId), [user.tenantId], view === 'pinned');
  const archived = useApi(() => comm.listArchivedBroadcasts(user.tenantId), [user.tenantId], view === 'archived');
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [logsFor, setLogsFor] = useState(null);
  const res = view === 'pinned' ? pinned : view === 'archived' ? archived : active;
  const rows = (res.data || []).filter((b) => view !== 'active' || !b.isArchived);
  const act = async (b, call, text) => {
    setBusy(b.broadcastId); setError(null);
    try { await call(); active.reload(); pinned.reload(); archived.reload(); onDone(text); } catch (e) { setError(e); } finally { setBusy(null); }
  };
  return (<>
    <div className="filters" style={{ marginBottom: 12 }}>
      <div className="seg">{[['active', 'Active'], ['pinned', 'Pinned'], ...(manage ? [['archived', 'Archived']] : [])].map(([v, t]) => (
        <button type="button" key={v} className={view === v ? 'on' : ''} onClick={() => setView(v)}>{t}</button>
      ))}</div>
    </div>
    {error && <div style={{ marginBottom: 12 }}><ApiErr error={error} /></div>}
    {res.error ? <ApiErr error={res.error} /> : res.loading || !res.data ? <Loading />
      : !rows.length ? <ApiNote>{view === 'active' ? 'No circulars yet. Use New circular to send the first one.' : `No ${view} circulars.`}</ApiNote>
        : rows.map((b) => (
          <div key={b.broadcastId} style={{ border: '1px solid var(--bd)', borderRadius: 10, padding: 16, marginTop: 12 }}>
            <div className="row">
              <span className="pills">
                {b.priority === 'EMERGENCY' ? <Pill tone="red">Emergency</Pill> : b.priority === 'URGENT' ? <Pill tone="amber">Urgent</Pill> : <Pill tone="purple">{text(CHANNELS, b.channel)}</Pill>}
                {b.isPinned && <Pill tone="purple">Pinned</Pill>}
                {b.isArchived && <Pill>Archived</Pill>}
              </span>
              <span className="xs muted">{text(AUDIENCES, b.targetAudience)}</span>
            </div>
            <h4 style={{ fontSize: 14, fontWeight: 600, margin: '10px 0 6px' }}>{b.title}</h4>
            <p className="body-s" style={{ whiteSpace: 'pre-line' }}>{b.messageBody}</p>
            <div className="row" style={{ marginTop: 10 }}>
              <span className="xs faint">{b.senderName || 'School office'}{b.createdAt ? ` · ${when(b.createdAt)}` : ''}</span>
              <span style={{ display: 'flex', gap: 6 }}>
                {manage && <button className="btn" onClick={() => setLogsFor(b)}>Delivery</button>}
                {pin && !b.isArchived && <button className="btn" disabled={busy === b.broadcastId} onClick={() => act(b, () => comm.pinBroadcast(b.broadcastId, { isPinned: !b.isPinned }), `“${b.title}” ${b.isPinned ? 'unpinned' : 'pinned to the top of the parent app'}.`)}>{b.isPinned ? 'Unpin' : 'Pin'}</button>}
                {manage && <button className="btn" disabled={busy === b.broadcastId} onClick={() => act(b, () => comm.archiveBroadcast(b.broadcastId, { isArchived: !b.isArchived }), `“${b.title}” ${b.isArchived ? 'restored' : 'archived'}.`)}>{b.isArchived ? 'Restore' : 'Archive'}</button>}
              </span>
            </div>
          </div>
        ))}
    {logsFor && <DeliveryModal broadcast={logsFor} onClose={() => setLogsFor(null)} />}
  </>);
}

function DeliveryModal({ broadcast, onClose }) {
  const logs = useApi(() => comm.getDeliveryLogs(broadcast.broadcastId), [broadcast.broadcastId]);
  const failed = (logs.data || []).filter((l) => l.fallbackTriggered).length;
  return (
    <Modal title="Delivery" sub={broadcast.title} onClose={onClose} footer={<button className="btn" onClick={onClose}>Close</button>}>
      {logs.error ? <ApiErr error={logs.error} /> : logs.loading || !logs.data ? <Loading />
        : !logs.data.length ? <ApiNote>No delivery records for this circular yet.</ApiNote> : (<>
          <p className="xs muted" style={{ marginBottom: 10 }}>{plural(logs.data.length, 'recipient')} · {failed} sent again by SMS after WhatsApp failed</p>
          <DataTable boxed cols={[
            { label: 'Recipient', render: (l) => <span className="cell-id"><b>{l.recipientPhone || l.recipientEmail || '—'}</b><small>{l.errorMessage || ''}</small></span> },
            { label: 'Channel', render: (l) => text(CHANNELS, l.channel) },
            { label: 'Status', render: (l) => <Pill tone={tone.delivery[l.deliveryStatus]}>{label(l.deliveryStatus)}</Pill> },
            { label: 'SMS fallback', render: (l) => (l.fallbackTriggered ? <Pill tone="amber">Yes</Pill> : <span className="muted">—</span>) },
          ]} rows={logs.data} />
        </>)}
    </Modal>
  );
}

function CircularModal({ initial, onClose, onSaved }) {
  const { user } = useAuth();
  const [f, setF] = useState({ title: '', messageBody: '', targetAudience: 'ALL_PARENTS', channel: 'MULTI_CHANNEL', priority: 'NORMAL', ...initial });
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const save = async () => {
    setBusy(true); setError(null);
    try { onSaved(await comm.createBroadcast({ tenantId: user.tenantId, senderUserId: user.userId, senderName: user.name, ...f, title: f.title.trim(), messageBody: f.messageBody.trim() })); } catch (e) { setError(e); } finally { setBusy(false); }
  };
  return (
    <Modal title="New circular" sub="Sent to every channel at once; SMS takes over when WhatsApp fails" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy || !f.title.trim() || !f.messageBody.trim()} onClick={save}>{busy ? <LoaderCircle size={14} className="spin" /> : <Send size={14} />}Send circular</button></>}>
      <Box id="cc-title" label="Title" required><input id="cc-title" maxLength={200} value={f.title} placeholder="e.g. Half-term break: 26–30 October" onChange={(e) => set('title')(e.target.value)} /></Box>
      <Box id="cc-audience" label="Audience" required><Choice id="cc-audience" value={f.targetAudience} onChange={set('targetAudience')} options={AUDIENCES.filter(([c]) => c !== 'ALL_STAKEHOLDERS')} /></Box>
      <Box id="cc-channel" label="Channel" required><Choice id="cc-channel" value={f.channel} onChange={set('channel')} options={CHANNELS} /></Box>
      <Box id="cc-priority" label="Priority"><Choice id="cc-priority" value={f.priority} onChange={set('priority')} options={PRIORITIES} /></Box>
      <Box id="cc-body" label="Message" required><textarea id="cc-body" rows={4} maxLength={4000} value={f.messageBody} onChange={(e) => set('messageBody')(e.target.value)} /></Box>
      {error && <ApiErr error={error} />}
    </Modal>
  );
}

function EmergencyModal({ onClose, onSaved }) {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const save = async () => {
    setBusy(true); setError(null);
    try {
      onSaved(await comm.sendEmergencyAlert({ tenantId: user.tenantId, senderUserId: user.userId, senderName: user.name, title: title.trim(), messageBody: body.trim(), targetAudience: 'ALL_STAKEHOLDERS' }));
    } catch (e) { setError(e); } finally { setBusy(false); }
  };
  return (
    <Modal title="Emergency alert" sub="Goes to every parent, student and staff member, ignores quiet hours and is pinned to the top of the app" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy || !title.trim() || !body.trim()} onClick={save}>{busy ? <LoaderCircle size={14} className="spin" /> : <ShieldAlert size={14} />}Send emergency alert</button></>}>
      <ApiNote>Use this only for closures and safety incidents: it cannot be held until morning.</ApiNote>
      <Box id="em-title" label="Headline" required><input id="em-title" maxLength={200} value={title} placeholder="e.g. School closed today: heavy rain" onChange={(e) => setTitle(e.target.value)} /></Box>
      <Box id="em-body" label="Message" required><textarea id="em-body" rows={3} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} /></Box>
      {error && <ApiErr error={error} />}
    </Modal>
  );
}

/* ---------- Messages (US-09004) ---------- */
function MessagesTab() {
  const { user } = useAuth();
  const inbox = useApi(() => comm.getUserInbox(user.userId), [user.userId]);
  const [open, setOpen] = useState(null);
  if (inbox.error) return <ApiErr error={inbox.error} />;
  if (inbox.loading || !inbox.data) return <Loading />;
  const rows = inbox.data.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return (<>
    <p className="xs muted" style={{ marginBottom: 10 }}>Private conversations between parents and teachers. {plural(rows.filter((m) => !m.isRead).length, 'unread message')}.</p>
    {!rows.length ? <ApiNote>Your inbox is empty.</ApiNote> : <DataTable boxed cols={[
      { label: 'From', render: (m) => <span className="cell-id"><b>{m.senderName}</b><small>{label(String(m.senderRole || '').replace(/^ROLE_/, ''))}</small></span> },
      { label: 'Message', render: (m) => <span><b style={{ fontWeight: m.isRead ? 400 : 600 }}>{m.subject}</b> <span className="muted">{m.content}</span></span> },
      { label: 'Received', render: (m) => when(m.createdAt) },
      { label: '', render: (m) => <button className="btn" onClick={() => setOpen(m)}>Open</button> },
    ]} rows={rows} />}
    {open && <ThreadModal first={open} onClose={() => { setOpen(null); inbox.reload(); }} />}
  </>);
}

function ThreadModal({ first, onClose }) {
  const { user } = useAuth();
  const thread = useApi(() => comm.getThreadMessages(first.threadId), [first.threadId]);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const mine = (m) => m.senderId === user.userId;
  const send = async () => {
    setBusy(true); setError(null);
    try {
      await comm.sendMessage({ tenantId: user.tenantId, senderId: user.userId, senderName: user.name, senderRole: user.roles[0], recipientId: first.senderId,
        recipientName: first.senderName, studentId: first.studentId, threadId: first.threadId, subject: first.subject, content: reply.trim() });
      setReply(''); thread.reload();
    } catch (e) { setError(e); } finally { setBusy(false); }
  };
  (thread.data || []).filter((m) => !m.isRead && !mine(m)).forEach((m) => comm.markMessageRead(m.messageId).catch(() => {}));
  return (
    <Modal title={first.subject} sub={`With ${first.senderName}`} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Close</button><button className="btn primary" disabled={busy || !reply.trim()} onClick={send}>{busy ? <LoaderCircle size={14} className="spin" /> : <Send size={14} />}Send reply</button></>}>
      {thread.error ? <ApiErr error={thread.error} /> : thread.loading || !thread.data ? <Loading /> : (
        <div style={{ display: 'grid', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
          {thread.data.map((m) => (
            <div key={m.messageId} className={mine(m) ? 'notice' : ''} style={{ border: '1px solid var(--bd)', borderRadius: 10, padding: '10px 12px', justifySelf: mine(m) ? 'end' : 'start', maxWidth: '85%' }}>
              <div className="xs muted" style={{ marginBottom: 4 }}><b>{mine(m) ? 'You' : m.senderName}</b> · {when(m.createdAt)}</div>
              <p className="body-s">{m.content}</p>
            </div>
          ))}
        </div>
      )}
      <Box id="msg-reply" label="Reply" required><textarea id="msg-reply" rows={3} maxLength={4000} value={reply} onChange={(e) => setReply(e.target.value)} /></Box>
      {error && <ApiErr error={error} />}
    </Modal>
  );
}

/* ---------- Gate passes and gate audit (US-09005, US-09006, US-09017) ---------- */
function GatePassTab({ onDone }) {
  const { user, hasRole } = useAuth();
  const security = hasRole(...ROLES.security);
  const audits = useApi(() => comm.getGateAuditLogs(user.tenantId), [user.tenantId], security);
  const [issued, setIssued] = useState([]);
  const [adding, setAdding] = useState(false);
  return (<>
    {hasRole(...ROLES.gatePass) && <div className="filters" style={{ marginBottom: 12 }}>
      <button className="btn primary" onClick={() => setAdding(true)}><Plus size={14} />Issue gate pass</button>
    </div>}
    {!!issued.length && (<div style={{ marginBottom: 16 }}>
      <p className="xs muted" style={{ marginBottom: 8 }}>Issued in this session</p>
      <DataTable boxed cols={[
        { label: 'Student', render: (p) => <span className="cell-id"><b>{p.studentName}</b><small>Class {p.grade}-{p.section}</small></span> },
        { label: 'Collected by', render: (p) => <span className="cell-id"><b>{p.pickupPersonName}</b><small>{p.pickupPersonPhone}</small></span> },
        { label: 'Pass code', render: (p) => <code>{p.qrCode}</code> },
        { label: 'Status', render: (p) => <Pill tone={tone.pass[p.status]}>{label(p.status)}</Pill> },
      ]} rows={issued} />
    </div>)}
    {security && <p className="xs muted" style={{ marginBottom: 8 }}>Gate log: scans, exits and refused attempts</p>}
    {!security ? (!issued.length && <ApiNote>Passes you issue appear here; security scans them at the gate.</ApiNote>) : audits.error ? <ApiErr error={audits.error} /> : audits.loading || !audits.data ? <Loading />
      : !audits.data.length ? <ApiNote>No gate scans recorded yet.</ApiNote> : <DataTable boxed cols={[
        { label: 'Time', render: (a) => when(a.timestamp) },
        { label: 'Gate', render: (a) => a.gateName || label(a.gateId) },
        { label: 'Person', render: (a) => <span className="cell-id"><b>{a.personName}</b><small>{a.notes || ''}</small></span> },
        { label: 'Event', render: (a) => label(a.eventType) },
        { label: 'Outcome', render: (a) => <Pill tone={a.outcome === 'GRANTED' ? 'green' : 'red'}>{label(a.outcome)}</Pill> },
      ]} rows={audits.data.slice().sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)))} />}
    {adding && <GatePassModal onClose={() => setAdding(false)} onSaved={(p) => { setIssued((x) => [p, ...x]); setAdding(false); onDone(`Gate pass ${p.qrCode} issued for ${p.studentName}; security scans it at the gate.`); }} />}
  </>);
}

function GatePassModal({ onClose, onSaved }) {
  const { user } = useAuth();
  const [f, setF] = useState({ studentName: '', grade: '', section: '', guardianName: '', pickupPersonName: '', pickupPersonPhone: '', reason: '' });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const ok = f.studentName.trim() && f.pickupPersonName.trim() && f.pickupPersonPhone.trim() && f.reason.trim();
  const save = async () => {
    setBusy(true); setError(null);
    try { onSaved(await comm.generateGatePass({ tenantId: user.tenantId, guardianId: user.userId, ...f })); } catch (e) { setError(e); } finally { setBusy(false); }
  };
  return (
    <Modal title="Issue gate pass" sub="Early departure: security scans the pass code at the gate" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy || !ok} onClick={save}>{busy && <LoaderCircle size={14} className="spin" />}Issue pass</button></>}>
      <Box id="gp-student" label="Student" required><input id="gp-student" value={f.studentName} onChange={set('studentName')} /></Box>
      <Box id="gp-grade" label="Class"><input id="gp-grade" placeholder="e.g. 10" value={f.grade} onChange={set('grade')} /></Box>
      <Box id="gp-section" label="Section"><input id="gp-section" placeholder="e.g. A" value={f.section} onChange={set('section')} /></Box>
      <Box id="gp-guardian" label="Guardian"><input id="gp-guardian" value={f.guardianName} onChange={set('guardianName')} /></Box>
      <Box id="gp-pickup" label="Collected by" required><input id="gp-pickup" value={f.pickupPersonName} onChange={set('pickupPersonName')} /></Box>
      <Box id="gp-phone" label="Their mobile" required><input id="gp-phone" value={f.pickupPersonPhone} onChange={set('pickupPersonPhone')} /></Box>
      <Box id="gp-reason" label="Reason" required><textarea id="gp-reason" rows={2} maxLength={500} value={f.reason} onChange={set('reason')} /></Box>
      {error && <ApiErr error={error} />}
    </Modal>
  );
}

function ScanModal({ onClose, onSaved }) {
  const { user } = useAuth();
  const [code, setCode] = useState('');
  const [gate, setGate] = useState('MAIN_GATE');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const save = async () => {
    setBusy(true); setError(null);
    try { onSaved(await comm.verifyGatePass({ qrCode: code.trim(), securityGuardName: user.name, gateId: gate })); } catch (e) { setError(e); } finally { setBusy(false); }
  };
  return (
    <Modal title="Scan gate pass" sub="Scan the code on the parent's phone or type it in" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy || !code.trim()} onClick={save}>{busy && <LoaderCircle size={14} className="spin" />}Verify and allow exit</button></>}>
      <Box id="sc-code" label="Pass code" required><input id="sc-code" autoFocus value={code} placeholder="GP-…" onChange={(e) => setCode(e.target.value)} /></Box>
      <Box id="sc-gate" label="Gate"><Choice id="sc-gate" value={gate} onChange={setGate} options={[['MAIN_GATE', 'Main gate'], ['WEST_GATE', 'West gate'], ['BUS_BAY', 'Bus bay']]} /></Box>
      {error && <ApiErr error={error} />}
    </Modal>
  );
}

/* ---------- Visitors (US-09007, US-09016) ---------- */
function VisitorsTab({ visitors, onDone }) {
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const act = async (v, call, text) => {
    setBusy(v.appointmentId); setError(null);
    try { await call(); visitors.reload(); onDone(text); } catch (e) { setError(e); } finally { setBusy(null); }
  };
  const rows = (visitors.data || []).slice().sort((a, b) => String(b.appointmentTime).localeCompare(String(a.appointmentTime)));
  return (<>
    <div className="filters" style={{ marginBottom: 12 }}><button className="btn primary" onClick={() => setAdding(true)}><Plus size={14} />Register visitor</button></div>
    {error && <div style={{ marginBottom: 12 }}><ApiErr error={error} /></div>}
    {visitors.error ? <ApiErr error={visitors.error} /> : visitors.loading || !visitors.data ? <Loading />
      : !rows.length ? <ApiNote>No visitor appointments yet.</ApiNote> : <DataTable boxed cols={[
        { label: 'Visitor', render: (v) => <span className="cell-id"><b>{v.visitorName}</b><small>{v.visitorPhone}</small></span> },
        { label: 'Purpose', render: (v) => <span className="cell-id"><b style={{ fontWeight: 400 }}>{v.purpose}</b><small>Meeting {v.hostStaffName || '—'}</small></span> },
        { label: 'Appointment', render: (v) => when(v.appointmentTime) },
        { label: 'Badge', render: (v) => v.badgeNumber || <span className="muted">—</span> },
        { label: 'Status', render: (v) => <Pill tone={tone.visitor[v.status]}>{label(v.status)}</Pill> },
        { label: '', render: (v) => (v.status === 'SCHEDULED'
          ? <button className="btn" disabled={busy === v.appointmentId} onClick={() => act(v, () => comm.checkInVisitor(v.appointmentId, { badgeNumber: v.badgeNumber || undefined }), `${v.visitorName} checked in.`)}>Check in</button>
          : v.status === 'CHECKED_IN'
            ? <button className="btn" disabled={busy === v.appointmentId} onClick={() => act(v, () => comm.checkOutVisitor(v.appointmentId), `${v.visitorName} checked out.`)}>Check out</button>
            : null) },
      ]} rows={rows} />}
    {adding && <VisitorModal onClose={() => setAdding(false)} onSaved={(v) => { setAdding(false); visitors.reload(); onDone(`${v.visitorName} registered for ${when(v.appointmentTime)}.`); }} />}
  </>);
}

function VisitorModal({ onClose, onSaved }) {
  const { user } = useAuth();
  const [f, setF] = useState({ visitorName: '', visitorPhone: '', purpose: '', hostStaffName: '', time: '' });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const ok = f.visitorName.trim() && f.visitorPhone.trim() && f.purpose.trim() && f.time;
  const save = async () => {
    setBusy(true); setError(null);
    try {
      onSaved(await comm.registerVisitor({ tenantId: user.tenantId, visitorName: f.visitorName.trim(), visitorPhone: f.visitorPhone.trim(), purpose: f.purpose.trim(),
        hostStaffName: f.hostStaffName.trim() || undefined, appointmentTime: new Date(f.time).toISOString() }));
    } catch (e) { setError(e); } finally { setBusy(false); }
  };
  return (
    <Modal title="Register visitor" sub="The badge is issued at check-in" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy || !ok} onClick={save}>{busy && <LoaderCircle size={14} className="spin" />}Register</button></>}>
      <Box id="vi-name" label="Visitor name" required><input id="vi-name" value={f.visitorName} onChange={set('visitorName')} /></Box>
      <Box id="vi-phone" label="Mobile" required><input id="vi-phone" value={f.visitorPhone} onChange={set('visitorPhone')} /></Box>
      <Box id="vi-purpose" label="Purpose" required><input id="vi-purpose" placeholder="e.g. Admission enquiry" value={f.purpose} onChange={set('purpose')} /></Box>
      <Box id="vi-host" label="Meeting"><input id="vi-host" placeholder="Staff member" value={f.hostStaffName} onChange={set('hostStaffName')} /></Box>
      <Box id="vi-time" label="Appointment" required><input id="vi-time" type="datetime-local" value={f.time} onChange={set('time')} /></Box>
      {error && <ApiErr error={error} />}
    </Modal>
  );
}

/* ---------- Grievances (US-09009) ---------- */
function GrievancesTab({ grievances, onDone }) {
  const { hasRole } = useAuth();
  const desk = hasRole(...ROLES.reception);
  const [adding, setAdding] = useState(false);
  const [resolving, setResolving] = useState(null);
  const rows = (grievances.data || []).slice().sort((a, b) => (a.status === 'RESOLVED') - (b.status === 'RESOLVED') || String(b.createdAt).localeCompare(String(a.createdAt)));
  return (<>
    {hasRole(...ROLES.parent) && <div className="filters" style={{ marginBottom: 12 }}><button className="btn primary" onClick={() => setAdding(true)}><Plus size={14} />Log grievance</button></div>}
    {!desk ? <ApiNote>The reception desk answers grievances; you are told when yours is resolved.</ApiNote> : grievances.error ? <ApiErr error={grievances.error} /> : grievances.loading || !grievances.data ? <Loading />
      : !rows.length ? <ApiNote>No grievances logged.</ApiNote> : <DataTable boxed cols={[
        { label: 'Ticket', render: (g) => <span className="cell-id"><b>{g.subject}</b><small>{g.parentName}{g.studentName ? ` · ${g.studentName}` : ''}</small></span> },
        { label: 'Category', render: (g) => text(CATEGORIES, g.category) },
        { label: 'Priority', render: (g) => <Pill tone={g.priority === 'URGENT' || g.priority === 'HIGH' ? 'red' : ''}>{label(g.priority)}</Pill> },
        { label: 'Logged', render: (g) => <span className="cell-id"><b style={{ fontWeight: 400 }}>{when(g.createdAt)}</b><small>SLA {g.slaDueHours ?? '—'} h</small></span> },
        { label: 'Status', render: (g) => <Pill tone={tone.ticket[g.status]}>{label(g.status)}</Pill> },
        { label: '', render: (g) => (g.status !== 'RESOLVED' ? <button className="btn" onClick={() => setResolving(g)}>Resolve</button> : null) },
      ]} rows={rows} />}
    {adding && <GrievanceModal onClose={() => setAdding(false)} onSaved={(g) => { setAdding(false); grievances.reload(); onDone(`Ticket “${g.subject}” logged; it escalates after ${g.slaDueHours} hours.`); }} />}
    {resolving && <ResolveModal ticket={resolving} onClose={() => setResolving(null)} onSaved={() => { setResolving(null); grievances.reload(); onDone(`“${resolving.subject}” resolved.`); }} />}
  </>);
}

function GrievanceModal({ onClose, onSaved }) {
  const { user } = useAuth();
  const [f, setF] = useState({ subject: '', studentName: '', category: 'TRANSPORT', priority: 'MEDIUM', description: '', slaDueHours: '24' });
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const ok = f.subject.trim() && f.description.trim() && Number(f.slaDueHours) > 0;
  const save = async () => {
    setBusy(true); setError(null);
    try {
      onSaved(await comm.createGrievance({ tenantId: user.tenantId, parentUserId: user.userId, parentName: user.name, ...f, subject: f.subject.trim(),
        studentName: f.studentName.trim() || undefined, description: f.description.trim(), slaDueHours: Number(f.slaDueHours) }));
    } catch (e) { setError(e); } finally { setBusy(false); }
  };
  return (
    <Modal title="Log grievance" sub="Escalates automatically when the SLA runs out" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy || !ok} onClick={save}>{busy && <LoaderCircle size={14} className="spin" />}Log ticket</button></>}>
      <Box id="gr-subject" label="Subject" required><input id="gr-subject" maxLength={200} placeholder="e.g. Bus 14 late at the pickup point" value={f.subject} onChange={(e) => set('subject')(e.target.value)} /></Box>
      <Box id="gr-student" label="Student"><input id="gr-student" value={f.studentName} onChange={(e) => set('studentName')(e.target.value)} /></Box>
      <Box id="gr-category" label="Category" required><Choice id="gr-category" value={f.category} onChange={set('category')} options={CATEGORIES} /></Box>
      <Box id="gr-priority" label="Priority"><Choice id="gr-priority" value={f.priority} onChange={set('priority')} options={['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((p) => [p, label(p)])} /></Box>
      <Box id="gr-sla" label="SLA (hours)" required><input id="gr-sla" type="number" min={1} max={720} value={f.slaDueHours} onChange={(e) => set('slaDueHours')(e.target.value)} /></Box>
      <Box id="gr-desc" label="Details" required><textarea id="gr-desc" rows={3} maxLength={4000} value={f.description} onChange={(e) => set('description')(e.target.value)} /></Box>
      {error && <ApiErr error={error} />}
    </Modal>
  );
}

function ResolveModal({ ticket, onClose, onSaved }) {
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const save = async () => {
    setBusy(true); setError(null);
    try { await comm.updateGrievance(ticket.ticketId, { status: 'RESOLVED', resolutionNotes: notes.trim() }); onSaved(); } catch (e) { setError(e); } finally { setBusy(false); }
  };
  return (
    <Modal title="Resolve grievance" sub={ticket.subject} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy || !notes.trim()} onClick={save}>{busy && <LoaderCircle size={14} className="spin" />}Resolve</button></>}>
      <p className="body-s" style={{ marginBottom: 10 }}>{ticket.description}</p>
      <Box id="rs-notes" label="Resolution" required><textarea id="rs-notes" rows={3} maxLength={2000} placeholder="What was done and who told the parent" value={notes} onChange={(e) => setNotes(e.target.value)} /></Box>
      {error && <ApiErr error={error} />}
    </Modal>
  );
}

/* ---------- Absence alerts and daily bulletins (US-09001, US-09013) ---------- */
function AbsenceTab({ today, onDone }) {
  const { user, hasRole } = useAuth();
  const allowed = hasRole(...ROLES.attendanceAlerts);
  const [date, setDate] = useState(todayIso);
  const own = useApi(() => comm.listAbsenceAlerts(user.tenantId, date), [user.tenantId, date], allowed && date !== todayIso());
  const alerts = date === todayIso() ? today : own;
  const bulletins = useApi(() => comm.listDailyBulletins(user.tenantId, date), [user.tenantId, date]);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const escalate = async (a) => {
    setBusy(a.alertId); setError(null);
    try { await comm.escalateAbsenceAlert(a.alertId); alerts.reload(); onDone(`${a.studentName}'s absence escalated to the counselor.`); } catch (e) { setError(e); } finally { setBusy(null); }
  };
  return (<>
    <div className="filters" style={{ marginBottom: 12 }}>
      <input className="select" type="date" aria-label="Date" value={date} max={todayIso()} onChange={(e) => setDate(e.target.value)} />
    </div>
    {error && <div style={{ marginBottom: 12 }}><ApiErr error={error} /></div>}
    <p className="xs muted" style={{ marginBottom: 8 }}>Guardians are messaged 30 minutes after the morning register when a student is absent without notice</p>
    {!allowed ? <ApiNote>Absence alerts are handled by the attendance office.</ApiNote> : alerts.error ? <ApiErr error={alerts.error} /> : alerts.loading || !alerts.data ? <Loading />
      : !alerts.data.length ? <ApiNote>No absence alerts on {formatDate(date)}.</ApiNote> : <DataTable boxed cols={[
        { label: 'Student', render: (a) => <span className="cell-id"><b>{a.studentName}</b><small>{a.guardianName || ''}</small></span> },
        { label: 'Guardian mobile', key: 'guardianPhone' },
        { label: 'Sent', render: (a) => <span className="cell-id"><b style={{ fontWeight: 400 }}>{when(a.createdAt)}</b><small>{text(CHANNELS, a.alertChannel)}</small></span> },
        { label: 'Delivery', render: (a) => <Pill tone={tone.delivery[a.deliveryStatus]}>{label(a.deliveryStatus)}</Pill> },
        { label: 'Escalation', render: (a) => (a.escalated ? <Pill tone="red">Escalated</Pill> : <button className="btn" disabled={busy === a.alertId} onClick={() => escalate(a)}>Escalate</button>) },
      ]} rows={alerts.data} />}
    <p className="xs muted" style={{ margin: '18px 0 8px' }}>Daily bulletins: menus and bus notices</p>
    {bulletins.error ? <ApiErr error={bulletins.error} /> : bulletins.loading || !bulletins.data ? <Loading />
      : !bulletins.data.length ? <ApiNote>No bulletins for {formatDate(date)}.</ApiNote>
        : bulletins.data.map((b) => (
          <div className="attrow" key={b.bulletinId}>
            <span className="cell-id"><b>{b.title}</b><small>{b.contentDetails}</small></span>
            <Pill tone="purple">{b.busRouteNumber ? `Route ${b.busRouteNumber}` : label(b.mealType || b.bulletinType)}</Pill>
          </div>
        ))}
  </>);
}

/* ---------- Alert preferences of the signed-in user (US-09012) ---------- */
function PreferencesTab({ onDone }) {
  const { user } = useAuth();
  const prefs = useApi(() => comm.getPreferences(user.tenantId, user.userId), [user.tenantId, user.userId]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const p = { whatsappEnabled: true, smsEnabled: true, emailEnabled: true, pushEnabled: true, quietHoursStart: '22:00', quietHoursEnd: '07:00', ...(prefs.data || {}) };
  const save = async (change) => {
    setSaving(true); setError(null);
    try { await comm.configurePreferences({ tenantId: user.tenantId, userId: user.userId, ...p, ...change }); prefs.reload(); onDone('Alert preferences saved.'); } catch (e) { setError(e); } finally { setSaving(false); }
  };
  if (prefs.loading) return <Loading />;
  return (<>
    {prefs.error && prefs.error.status !== 404 && <div style={{ marginBottom: 12 }}><ApiErr error={prefs.error} /></div>}
    {error && <div style={{ marginBottom: 12 }}><ApiErr error={error} /></div>}
    <p className="xs muted" style={{ marginBottom: 4 }}>How you receive school alerts. Emergency alerts always come through.</p>
    {[['whatsappEnabled', 'WhatsApp', 'Circulars and alerts on WhatsApp'], ['smsEnabled', 'SMS', 'Text messages, and the fallback when WhatsApp fails'],
      ['emailEnabled', 'Email', 'Newsletters, statements and documents'], ['pushEnabled', 'App notifications', 'Notifications on the school app']].map(([k, t, d]) => (
      <div className="attrow" key={k}>
        <span className="cell-id"><b>{t}</b><small>{d}</small></span>
        <label className="check" style={{ marginTop: 0 }}><input type="checkbox" disabled={saving} checked={!!p[k]} onChange={() => save({ [k]: !p[k] })} />{p[k] ? 'On' : 'Off'}</label>
      </div>
    ))}
    <div className="attrow">
      <span className="cell-id"><b>Quiet hours</b><small>Non-urgent messages wait until the morning</small></span>
      <span className="body-s">{p.quietHoursStart} – {p.quietHoursEnd}</span>
    </div>
  </>);
}
