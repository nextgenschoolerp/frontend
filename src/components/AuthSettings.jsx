import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { Plus, X, KeyRound, ShieldAlert, LoaderCircle, Info, Check } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { useApi } from '../api/useApi.js';
import * as authApi from '../api/authService.js';
import { Card, SectionHead, DataTable, Pill, KV } from './ui.jsx';

// Screens a role can be granted, matching the names already used by authservice role_permissions.
const SCREENS = ['ALL_SCREENS', 'STUDENT_PROFILE', 'STAFF_MANAGEMENT', 'ATTENDANCE_RECORD', 'EXAM_MARKS', 'FEE_COLLECTION', 'ROLE_MANAGEMENT',
  'TENANT_ISOLATION', 'BRANCH_PROVISIONING', 'SESSION_SECURITY', 'IP_WHITELIST', 'AUDIT_LOGS', 'ROLE_DELEGATION', 'API_TOKENS',
  'PRIVACY_COMPLIANCE', 'FIELD_ENCRYPTION', 'DISASTER_RECOVERY', 'ADMISSION_ENQUIRY', 'ENTRANCE_EXAM', 'APPLICANT_EVALUATION',
  'DOCUMENT_VAULT', 'OFFER_LETTER', 'FEE_DEPOSIT', 'MERIT_LIST', 'CRM_ANALYTICS', 'STUDENT_CONVERSION', 'APPLICANT_COMMUNICATION'];
const FLAGS = [['canRead', 'Read'], ['canWrite', 'Write'], ['canDelete', 'Delete'], ['canExport', 'Export']];

const label = (code) => code.toLowerCase().split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');

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
  const { data: roles, error, loading, reload } = useApi(() => authApi.listRoles(), [], allowed);
  const [editing, setEditing] = useState(null);

  return (
    <Card>
      <SectionHead title="User roles & permissions" sub="Role-based access protects student, staff and financial records." />
      <div style={{ margin: '18px 0' }}>
        {!allowed && <ApiNote>Role management is available to Trustees and Super administrators.</ApiNote>}
        {loading && <Loading />}
        {error && <ApiErr error={error} />}
        {roles && (
          <DataTable boxed cols={[
            { label: 'Role', render: (r) => <b style={{ fontWeight: 500 }}>{label(r.name)}</b> },
            { label: 'Description', render: (r) => <span className="xs muted">{r.description}</span> },
            { label: 'Status', render: (r) => <Pill tone={r.active ? 'green' : ''}>{r.active ? 'Active' : 'Inactive'}</Pill> },
            { label: 'Action', render: (r) => <button className="link" onClick={() => setEditing(r)}>Edit role</button> },
          ]} rows={roles} />
        )}
      </div>
      <button className="btn" disabled title="authservice has no user-invitation endpoint yet"><Plus size={15} />Invite user</button>
      <p className="xs muted" style={{ marginTop: 8 }}>Inviting users needs a user-provisioning API, which authservice does not offer yet.</p>
      {editing && <RolePermissionsModal role={editing} onClose={() => setEditing(null)} onSaved={reload} />}
    </Card>
  );
}

function RolePermissionsModal({ role, onClose, onSaved }) {
  const { data, error, loading } = useApi(() => authApi.getRolePermissions(role.id), [role.id]);
  const [rows, setRows] = useState([]);
  const [adding, setAdding] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => { if (data) setRows(data.map(({ screenName, canRead, canWrite, canDelete, canExport }) => ({ screenName, canRead, canWrite, canDelete, canExport }))); }, [data]);

  const toggle = (screen, flag) => { setSaved(false); setRows((rs) => rs.map((r) => (r.screenName === screen ? { ...r, [flag]: !r[flag] } : r))); };
  const add = () => {
    if (!adding || rows.some((r) => r.screenName === adding)) return;
    setRows((rs) => [...rs, { screenName: adding, canRead: true, canWrite: false, canDelete: false, canExport: false }]);
    setAdding('');
    setSaved(false);
  };
  async function save() {
    setSaving(true);
    setSaveError(null);
    try {
      await authApi.assignRolePermissions(role.id, rows);
      setSaved(true);
      onSaved();
    } catch (err) {
      setSaveError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={`Edit role · ${label(role.name)}`} sub="Screen permissions are saved per screen. Untick every box to remove access to a screen." onClose={onClose}
      footer={<>
        {saved && <Pill tone="green">Saved · change recorded in the audit log</Pill>}
        <button className="btn" onClick={onClose}>Close</button>
        <button className="btn primary" onClick={save} disabled={saving || !rows.length}>{saving ? <LoaderCircle size={15} className="spin" /> : <Check size={15} />}Save permissions</button>
      </>}>
      {loading && <Loading />}
      {error && <ApiErr error={error} />}
      {saveError && <div style={{ marginBottom: 12 }}><ApiErr error={saveError} /></div>}
      {!loading && !error && (
        <>
          {rows.length === 0 && <ApiNote>This role has no screen permissions yet. Add a screen below.</ApiNote>}
          {rows.length > 0 && (
            <DataTable boxed cols={[
              { label: 'Screen', render: (r) => label(r.screenName) },
              ...FLAGS.map(([flag, text]) => ({
                label: text, render: (r) => <input type="checkbox" aria-label={`${text} ${r.screenName}`} checked={r[flag]} onChange={() => toggle(r.screenName, flag)} />,
              })),
            ]} rows={rows} />
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <select value={adding} onChange={(e) => setAdding(e.target.value)} aria-label="Screen to add" style={{ flex: 1 }}>
              <option value="">Add a screen…</option>
              {SCREENS.filter((s) => !rows.some((r) => r.screenName === s)).map((s) => <option key={s} value={s}>{label(s)}</option>)}
            </select>
            <button className="btn" onClick={add} disabled={!adding}><Plus size={15} />Add screen</button>
          </div>
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
  const fmt = (t) => (t ? new Date(t).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');

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
