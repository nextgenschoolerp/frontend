import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { Plus, X, KeyRound, ShieldAlert, LoaderCircle, Info, Check, Search, Pencil } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { useApi } from '../api/useApi.js';
import * as authApi from '../api/authService.js';
import { Card, SectionHead, DataTable, Pill, KV, SkeletonTable, IconAction } from './ui.jsx';
import { formatDate, formatDateTime, formatTime, formatNumber } from '../regional.js';

// Screens a role can be granted, matching the names already used by authservice role_permissions.
const SCREENS = ['ALL_SCREENS', 'STUDENT_PROFILE', 'STAFF_MANAGEMENT', 'ATTENDANCE_RECORD', 'EXAM_MARKS', 'FEE_COLLECTION', 'ROLE_MANAGEMENT',
  'TENANT_ISOLATION', 'BRANCH_PROVISIONING', 'SESSION_SECURITY', 'IP_WHITELIST', 'AUDIT_LOGS', 'ROLE_DELEGATION', 'API_TOKENS',
  'PRIVACY_COMPLIANCE', 'FIELD_ENCRYPTION', 'DISASTER_RECOVERY', 'ADMISSION_ENQUIRY', 'ENTRANCE_EXAM', 'APPLICANT_EVALUATION',
  'DOCUMENT_VAULT', 'OFFER_LETTER', 'FEE_DEPOSIT', 'MERIT_LIST', 'CRM_ANALYTICS', 'STUDENT_CONVERSION', 'APPLICANT_COMMUNICATION'];
const FLAGS = [['canRead', 'Read'], ['canWrite', 'Write'], ['canDelete', 'Delete'], ['canExport', 'Export']];

// Words written in capitals or spelt differently in role and screen names: IT_SYSTEM_ADMIN → "IT System Admin".
const WORDS = { it: 'IT', hr: 'HR', api: 'API', ip: 'IP', crm: 'CRM', lms: 'LMS', elearning: 'E-learning', incharge: 'In-charge' };
const label = (code) => code.toLowerCase().split('_').map((w) => WORDS[w] || w[0].toUpperCase() + w.slice(1)).join(' ');

export function Modal({ title, sub, onClose, children, footer }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  // Portal to <body>: the animated page container has a transform, which would anchor position:fixed to it
  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <div><h3>{title}</h3>{sub && <p>{sub}</p>}</div>
          <button className="btn" onClick={onClose} aria-label="Close"><X size={15} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

const ApiNote = ({ children }) => <div className="api-note"><Info size={14} style={{ flex: 'none', marginTop: 1 }} /><span>{children}</span></div>;
const ApiErr = ({ error }) => <div className="api-error"><ShieldAlert size={14} style={{ flex: 'none' }} /><span>{error.detail}</span></div>;
const Loading = () => <p className="xs muted"><LoaderCircle size={12} className="spin" /> Loading…</p>;

/** Settings → User roles & permissions: GET /api/v1/roles, GET|POST /api/v1/roles/{id}/permissions (US-00002). */
export function RolesCard() {
  const { hasRole } = useAuth();
  const allowed = hasRole('TRUSTEE', 'SUPER_ADMIN');
  const { data: roles, error } = useApi(() => authApi.listRoles(), [], allowed);
  const [editing, setEditing] = useState(null);
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const shown = (roles || []).filter((r) => !q || label(r.name).toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q));

  return (
    <Card>
      <SectionHead title="User roles & permissions" sub="Role-based access protects student, staff and financial records." />
      <div style={{ margin: '18px 0' }}>
        {!allowed && <ApiNote>Role management is available to Trustees and Super administrators.</ApiNote>}
        {error && <ApiErr error={error} />}
        {allowed && !roles && !error && <SkeletonTable cols={['Role', 'Description', 'Status', 'Action']} rows={8} />}
        {roles && (
          <>
            <div className="row" style={{ gap: 12, marginBottom: 12, justifyContent: 'space-between' }}>
              <label className="search" style={{ width: 300 }}>
                <Search size={14} />
                <input placeholder="Search roles" aria-label="Search roles" value={query} onChange={(e) => setQuery(e.target.value)} />
              </label>
              <span className="xs muted">{q ? `${shown.length} of ${roles.length} roles` : `${roles.length} roles`}</span>
            </div>
            {shown.length ? (
              <DataTable boxed cols={[
                { label: 'Role', render: (r) => <b style={{ fontWeight: 500 }}>{label(r.name)}</b> },
                { label: 'Description', render: (r) => <span className="xs muted">{r.description}</span> },
                { label: 'Status', render: (r) => <Pill tone={r.active ? 'green' : ''}>{r.active ? 'Active' : 'Inactive'}</Pill> },
                { label: 'Action', render: (r) => <IconAction icon={Pencil} label={`Edit role ${label(r.name)}`} onClick={() => setEditing(r)} /> },
              ]} rows={shown} />
            ) : <ApiNote>No role matches “{query.trim()}”.</ApiNote>}
          </>
        )}
      </div>
      <button className="btn" disabled title="authservice has no user-invitation endpoint yet"><Plus size={15} />Invite user</button>
      <p className="xs muted" style={{ marginTop: 8 }}>Inviting users needs a user-provisioning API, which authservice does not offer yet.</p>
      {editing && <RolePermissionsModal role={editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}

const pick = ({ screenName, canRead, canWrite, canDelete, canExport }) => ({ screenName, canRead, canWrite, canDelete, canExport });
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Screen permissions of one role. Write, Delete and Export include Read, so ticking one ticks Read and unticking Read
 * clears the row; a screen with no box ticked is removed from the role when saved.
 */
function RolePermissionsModal({ role, onClose }) {
  const { data, error } = useApi(() => authApi.getRolePermissions(role.id), [role.id]);
  const [base, setBase] = useState(null);
  const [rows, setRows] = useState([]);
  const [adding, setAdding] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

  const load = (list) => { const r = list.map(pick); setBase(r); setRows(r); };
  useEffect(() => { if (data) load(data); }, [data]);

  const dirty = base !== null && !same(rows, base);
  const changed = rows.filter((r) => !same(r, base?.find((b) => b.screenName === r.screenName)));
  const edit = (fn) => { setSaved(false); setSaveError(null); setConfirmClose(false); setRows(fn); };
  const toggle = (screen, flag) => edit((rs) => rs.map((r) => {
    if (r.screenName !== screen) return r;
    const on = !r[flag];
    if (flag === 'canRead' && !on) return { ...r, canRead: false, canWrite: false, canDelete: false, canExport: false };
    return { ...r, [flag]: on, canRead: r.canRead || on };
  }));
  const remove = (screen) => edit((rs) => (base.some((b) => b.screenName === screen)
    ? rs.map((r) => (r.screenName === screen ? { ...r, canRead: false, canWrite: false, canDelete: false, canExport: false } : r))
    : rs.filter((r) => r.screenName !== screen)));
  const add = () => {
    if (!adding) return;
    // a screen marked for removal comes back with Read only
    edit((rs) => (rs.some((r) => r.screenName === adding)
      ? rs.map((r) => (r.screenName === adding ? { ...r, canRead: true } : r))
      : [...rs, { screenName: adding, canRead: true, canWrite: false, canDelete: false, canExport: false }]));
    setAdding('');
  };
  const close = () => (dirty && !confirmClose ? setConfirmClose(true) : onClose());

  async function save() {
    setSaving(true);
    setSaveError(null);
    try {
      load(await authApi.assignRolePermissions(role.id, changed));
      setSaved(true);
      setConfirmClose(false);
    } catch (err) {
      setSaveError(err);
    } finally {
      setSaving(false);
    }
  }

  const removing = rows.filter((r) => !r.canRead && base?.some((b) => b.screenName === r.screenName)).length;
  return (
    <Modal title={`Edit role · ${label(role.name)}`}
      sub="Tick what this role may do on each screen. Write, Delete and Export include Read; a screen with no box ticked is removed when you save."
      onClose={close}
      footer={<>
        {saved && !dirty && <Pill tone="green">Saved · change recorded in the audit log</Pill>}
        {dirty && !confirmClose && <span className="xs muted">{changed.length} unsaved {changed.length === 1 ? 'change' : 'changes'}{removing ? ` · ${removing} to remove` : ''}</span>}
        {confirmClose && <span className="xs" style={{ color: 'var(--amber, #b45309)' }}>Discard unsaved changes?</span>}
        <button className="btn" onClick={confirmClose ? onClose : close}>{confirmClose ? 'Discard' : 'Close'}</button>
        <button className="btn primary" onClick={save} disabled={saving || !dirty}>{saving ? <LoaderCircle size={15} className="spin" /> : <Check size={15} />}Save permissions</button>
      </>}>
      {!data && !error && <SkeletonTable cols={['Screen', 'Read', 'Write', 'Delete', 'Export']} rows={3} />}
      {error && <ApiErr error={error} />}
      {saveError && <div style={{ marginBottom: 12 }}><ApiErr error={saveError} /></div>}
      {data && (
        <>
          {rows.length === 0 && <ApiNote>This role has no screen permissions yet. Add a screen below.</ApiNote>}
          {rows.length > 0 && (
            <DataTable boxed cols={[
              { label: 'Screen', render: (r) => <span style={{ opacity: r.canRead ? 1 : 0.55 }}>{label(r.screenName)}{!r.canRead && <span className="xs muted"> · removed on save</span>}</span> },
              ...FLAGS.map(([flag, text]) => ({
                label: text, render: (r) => <input type="checkbox" aria-label={`${text} ${label(r.screenName)}`} checked={r[flag]} onChange={() => toggle(r.screenName, flag)} />,
              })),
              { label: '', render: (r) => (r.canRead || !base.some((b) => b.screenName === r.screenName)
                ? <button className="link danger" aria-label={`Remove ${label(r.screenName)}`} title={`Remove ${label(r.screenName)}`} onClick={() => remove(r.screenName)}><X size={13} /></button>
                : null) },
            ]} rows={rows} />
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <select value={adding} onChange={(e) => setAdding(e.target.value)} aria-label="Screen to add" style={{ flex: 1 }}>
              <option value="">Add a screen…</option>
              {SCREENS.filter((s) => !rows.some((r) => r.screenName === s && r.canRead)).map((s) => <option key={s} value={s}>{label(s)}</option>)}
            </select>
            <button className="btn" onClick={add} disabled={!adding}><Plus size={15} />Add screen</button>
          </div>
          <p className="xs muted" style={{ marginTop: 12 }}>
            These screen permissions are stored for the role and recorded in the audit log. What a user can open in the app today is still decided by their role itself.
          </p>
        </>
      )}
    </Modal>
  );
}

/**
 * Settings → Security & audit:
 * GET /api/v1/mfa/config (US-00003), GET /api/v1/security/session-config (US-00004), GET /api/v1/audit/logs (US-00005).
 */
export function SecurityCard() {
  const { user, hasRole } = useAuth();
  const canMfa = hasRole('PRINCIPAL', 'SUPER_ADMIN');
  const canSession = hasRole('IT_SYSTEM_ADMIN', 'SUPER_ADMIN');
  const canAudit = hasRole('SECURITY_AUDITOR', 'SUPER_ADMIN');
  const mfa = useApi(() => authApi.getMfaConfig(user.tenantId), [user.tenantId], canMfa);
  const session = useApi(() => authApi.getSessionConfig(user.tenantId), [user.tenantId], canSession);
  const [auditOpen, setAuditOpen] = useState(false);

  const twoFactor = mfa.data ? (mfa.data.totpEnabled || mfa.data.smsEnabled) : null;
  const methods = mfa.data ? [mfa.data.totpEnabled && 'authenticator app', mfa.data.smsEnabled && 'SMS'].filter(Boolean).join(' + ') : '';

  return (
    <Card>
      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Security & audit</h3>
      {canMfa ? (
        mfa.loading ? <Loading /> : mfa.error ? <ApiErr error={mfa.error} />
          : <Pill tone={twoFactor ? 'green' : 'amber'}>{twoFactor ? `Two-factor authentication enabled · ${methods}` : 'Two-factor authentication off'}</Pill>
      ) : <Pill>Two-factor settings: Principal or Super administrator</Pill>}
      <KV rows={[
        ['Session timeout', canSession ? (session.data ? `${session.data.idleTimeoutMinutes} minutes idle · ${Math.round(session.data.maxSessionDurationMinutes / 60)} h max` : session.error ? 'Unavailable' : '…') : 'IT administrator only'],
        ['Concurrent sessions', canSession && session.data ? (session.data.concurrentSessionsAllowed ? `Up to ${session.data.maxConcurrentSessions}` : 'One at a time') : '—'],
        ['Sensitive actions', mfa.data ? (mfa.data.mandatoryForSensitiveTransactions ? 'Require a second factor' : 'Password only') : '—'],
      ]} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '10px 0 14px' }}>
        <button className="btn" onClick={() => setAuditOpen(true)} disabled={!canAudit} title={canAudit ? undefined : 'Security auditors and Super administrators only'}>View audit log</button>
        <Link className="btn" to="/change-password"><KeyRound size={15} />Change password</Link>
      </div>
      <p className="xs muted">Signed in as {user.email || user.username}. All security changes are logged.</p>
      {auditOpen && <AuditLogModal onClose={() => setAuditOpen(false)} />}
    </Card>
  );
}

function AuditLogModal({ onClose }) {
  const [userId, setUserId] = useState('');
  const [filter, setFilter] = useState({});
  const { data, error, loading } = useApi(() => authApi.queryAuditLogs(filter), [JSON.stringify(filter)]);
  const rows = (data || []).slice().sort((a, b) => String(b.eventTime).localeCompare(String(a.eventTime))).slice(0, 100);
  const fmt = (t) => (t ? formatDateTime(t, { year: false }) : '');

  return (
    <Modal title="Audit log" sub="Most recent 100 events from authservice (GET /api/v1/audit/logs)." onClose={onClose}>
      <form style={{ display: 'flex', gap: 8, marginBottom: 14 }} onSubmit={(e) => { e.preventDefault(); setFilter(userId ? { userId } : {}); }}>
        <input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="Filter by user ID" style={{ flex: 1 }} aria-label="User ID" />
        <button className="btn">Apply</button>
      </form>
      {loading && <Loading />}
      {error && <ApiErr error={error} />}
      {data && !rows.length && <ApiNote>No audit events match.</ApiNote>}
      {rows.length > 0 && (
        <DataTable boxed cols={[
          { label: 'When', render: (r) => <span className="xs">{fmt(r.eventTime)}</span> },
          { label: 'Action', render: (r) => <b style={{ fontWeight: 500 }}>{r.action}</b> },
          { label: 'Outcome', render: (r) => <Pill tone={r.outcome === 'SUCCESS' ? 'green' : 'red'}>{r.outcome}</Pill> },
          { label: 'User / IP', render: (r) => <span className="xs muted">{r.userId}<br />{r.ipAddress}</span> },
          { label: 'Details', render: (r) => <span className="xs">{r.details}</span> },
        ]} rows={rows} />
      )}
    </Modal>
  );
}

/** Role options for staff forms: GET /api/v1/roles when the signed-in user may list roles, else the fallback list. */
export function useRoleOptions(fallback) {
  const { hasRole } = useAuth();
  const { data } = useApi(() => authApi.listRoles(), [], hasRole('TRUSTEE', 'SUPER_ADMIN'));
  return data ? data.filter((r) => r.active).map((r) => label(r.name)) : fallback;
}
