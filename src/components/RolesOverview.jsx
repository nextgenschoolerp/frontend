import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, UserX, Users, UserRound, Layers, Search, ChevronRight } from 'lucide-react';
import { Card, SectionHead, Pill, Tabs, DataTable, Person, SkeletonTable } from './ui.jsx';
import { ApiErr, ApiNote } from './Admissions.jsx';
import { useAuth } from '../auth.jsx';
import { useApi } from '../api/useApi.js';
import * as authApi from '../api/authService.js';
import * as hr from '../api/hrService.js';
import { formatNumber } from '../regional.js';

/*
 * Settings → Roles & staff: who holds which role, and what each role is responsible for.
 *   By role  – roles grouped by area (leadership, academics, admissions, finance …); each opens to show its responsibility,
 *              the screens it may use (read / write / delete / export) and the staff who hold it.
 *   By staff – every account with its job title, campus, roles and status.
 * Gaps are called out: roles nobody holds, roles held by one person only, people with several roles, accounts that need attention.
 * Data: GET /api/v1/roles, GET /api/v1/roles/{id}/permissions, GET /api/v1/tenants/{id}/users (authservice), employees (hrservice).
 */

const AREAS = [
  ['Leadership & governance', ['SUPER_ADMIN', 'TRUSTEE', 'PRINCIPAL', 'SCHOOL_PRINCIPAL', 'VICE_PRINCIPAL']],
  ['Teaching & academics', ['TEACHER', 'SUBJECT_TEACHER', 'CLASS_TEACHER', 'DEPARTMENT_HEAD', 'ACADEMIC_COORDINATOR', 'ACADEMIC_AUDITOR', 'EXAM_CONTROLLER',
    'TIMETABLE_INCHARGE', 'SUBSTITUTION_INCHARGE', 'ELEARNING_ADMIN', 'HOUSE_MASTER']],
  ['Admissions & student services', ['ADMISSION_OFFICER', 'FRONT_OFFICE_COUNSELOR', 'REGISTRAR', 'ENTRANCE_EXAM_EVALUATOR', 'OFFICE_CLERK', 'ADMIN_CLERK', 'RECEPTIONIST',
    'SCHOOL_NURSE', 'ALUMNI_COORDINATOR', 'MARKETING_MANAGER', 'PUBLIC_RELATIONS_OFFICER', 'APPLICANT_PARENT']],
  ['Finance & accounts', ['FINANCE_OFFICER', 'FINANCE_CASHIER', 'FINANCE_AUDITOR', 'FINANCE_CONTROLLER', 'TRUST_TREASURER', 'CHIEF_ACCOUNTANT', 'ACCOUNTS_CLERK', 'AUDITOR', 'PAYROLL_ACCOUNTANT']],
  ['People & HR', ['HR_MANAGER']],
  ['IT, security & compliance', ['IT_SYSTEM_ADMIN', 'SECURITY_AUDITOR', 'COMPLIANCE_OFFICER', 'SECURITY_GUARD']],
];
const AREA_OF = Object.fromEntries(AREAS.flatMap(([area, codes]) => codes.map((c) => [c, area])));
const WORDS = { it: 'IT', hr: 'HR', api: 'API', ip: 'IP', crm: 'CRM', lms: 'LMS', elearning: 'E-learning', incharge: 'In-charge' };
const label = (code) => String(code).toLowerCase().split('_').map((w) => WORDS[w] || w[0].toUpperCase() + w.slice(1)).join(' ');
const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
const FLAGS = [['canRead', 'R', 'Read'], ['canWrite', 'W', 'Write'], ['canDelete', 'D', 'Delete'], ['canExport', 'E', 'Export']];
const STATE_TONE = { Active: 'green', Inactive: '', Locked: 'amber', 'Must change password': 'amber' };

function toPerson(u, employees) {
  const emp = employees.get(u.userId);
  const name = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username;
  return {
    id: u.userId, name, username: u.username, email: u.email, branch: u.branchId || '',
    title: [emp?.designation, emp?.department].filter(Boolean).join(' · '),
    roles: [...new Set((u.roles || []).map((r) => r.replace(/^ROLE_/, '')))].sort(),
    state: !u.active ? 'Inactive' : u.locked ? 'Locked' : u.mustChangePassword ? 'Must change password' : 'Active',
  };
}

export function RolesOverview() {
  const { user, hasRole } = useAuth();
  const canUsers = hasRole('SUPER_ADMIN');
  const roles = useApi(() => authApi.listRoles(), []);
  const users = useApi(() => authApi.listTenantUsers(user.tenantId), [user.tenantId], canUsers);
  const employees = useApi(() => hr.listEmployees(), [], canUsers);
  const [view, setView] = useState(0);
  const [q, setQ] = useState('');
  const [campus, setCampus] = useState('');
  const [focus, setFocus] = useState('all'); // all | none | single

  const empByUser = useMemo(() => new Map((employees.data || []).filter((e) => e.userId).map((e) => [e.userId, e])), [employees.data]);
  const people = useMemo(() => (users.data || []).map((u) => toPerson(u, empByUser)).sort((a, b) => a.name.localeCompare(b.name)), [users.data, empByUser]);
  const campuses = useMemo(() => [...new Set(people.map((p) => p.branch).filter(Boolean))].sort(), [people]);
  const scoped = campus ? people.filter((p) => p.branch === campus) : people;
  const query = q.trim().toLowerCase();

  const rows = useMemo(() => (roles.data || []).map((r) => ({
    ...r, area: AREA_OF[r.name] || 'Other roles', holders: scoped.filter((p) => p.roles.includes(r.name)),
  })), [roles.data, scoped]);

  const stats = {
    roles: rows.length, used: rows.filter((r) => r.holders.length).length,
    none: rows.filter((r) => !r.holders.length), single: rows.filter((r) => r.holders.length === 1),
    many: scoped.filter((p) => p.roles.length > 2), attention: scoped.filter((p) => p.state !== 'Active'),
  };

  const loading = roles.loading || (canUsers && users.loading);
  const error = roles.error || users.error;

  return (
    <div className="stack">
      <Card>
        <SectionHead title="Roles & responsibilities" sub="Who holds which role, what each role is responsible for, and where the gaps are." />
        {!canUsers && <div style={{ marginTop: 12 }}><ApiNote>Staff names per role are shown to super administrators. You can see each role and its responsibilities.</ApiNote></div>}
        {error && <div style={{ marginTop: 12 }}><ApiErr error={error} /></div>}

        {canUsers && (
          <div className="rs-tiles">
            <Tile icon={Layers} tone="" value={`${formatNumber(stats.used)} / ${formatNumber(stats.roles)}`} title="Roles in use" note={`${formatNumber(scoped.length)} accounts${campus ? ` at ${campus}` : ''}`} />
            <Tile icon={UserX} tone={stats.none.length ? 'amber' : 'green'} value={formatNumber(stats.none.length)} title="Roles nobody holds"
              note={stats.none.length ? 'Show them' : 'Every role is covered'} active={focus === 'none'} onClick={stats.none.length ? () => { setFocus(focus === 'none' ? 'all' : 'none'); setView(0); } : undefined} />
            <Tile icon={ShieldAlert} tone={stats.single.length ? 'amber' : 'green'} value={formatNumber(stats.single.length)} title="Held by one person only"
              note={stats.single.length ? 'No cover if they are away' : 'Everything has cover'} active={focus === 'single'} onClick={stats.single.length ? () => { setFocus(focus === 'single' ? 'all' : 'single'); setView(0); } : undefined} />
            <Tile icon={Users} tone="" value={formatNumber(stats.many.length)} title="People with 3+ roles" note="Check they need them all" />
            <Tile icon={UserRound} tone={stats.attention.length ? 'amber' : 'green'} value={formatNumber(stats.attention.length)} title="Accounts needing attention" note="Inactive, locked or temporary password" />
          </div>
        )}

        <div className="rs-bar">
          {canUsers && <Tabs items={['By role', 'By staff']} value={view} onChange={setView} />}
          <label className="search" style={{ width: 280 }}><Search size={14} /><input placeholder="Search role, name or username" aria-label="Search roles and staff" value={q} onChange={(e) => setQ(e.target.value)} /></label>
          {canUsers && campuses.length > 1 && (
            <select aria-label="Campus" value={campus} onChange={(e) => setCampus(e.target.value)} className="rs-select">
              <option value="">All campuses</option>{campuses.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>)}
          {focus !== 'all' && <button className="link" onClick={() => setFocus('all')}>Clear filter ({focus === 'none' ? 'roles nobody holds' : 'one holder'})</button>}
        </div>
      </Card>

      {loading && <Card><SkeletonTable cols={['Role', 'Responsibility', 'Holders']} rows={8} /></Card>}
      {!loading && !error && view === 0 && <ByRole rows={rows} query={query} focus={focus} canUsers={canUsers} />}
      {!loading && !error && view === 1 && canUsers && <ByStaff people={scoped} query={query} />}
      {!loading && !error && view === 1 && !canUsers && <Card><ApiNote>The staff view is available to super administrators.</ApiNote></Card>}
    </div>
  );
}

function Tile({ icon: Icon, value, title, note, tone, onClick, active }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag className={`rs-tile${onClick ? ' click' : ''}${active ? ' on' : ''}`} onClick={onClick} type={onClick ? 'button' : undefined}>
      <span className={`rs-ico ${tone}`}><Icon size={15} /></span>
      <b>{value}</b><span className="rs-title">{title}</span><small className={tone === 'amber' ? 'amber' : ''}>{note}</small>
    </Tag>
  );
}

function ByRole({ rows, query, focus, canUsers }) {
  const shown = rows
    .filter((r) => focus === 'all' || (focus === 'none' ? !r.holders.length : r.holders.length === 1))
    .filter((r) => !query || [r.name, label(r.name), r.description, r.holders.map((p) => `${p.name} ${p.username}`).join(' ')].join(' ').toLowerCase().includes(query));
  if (!shown.length) return <Card><ApiNote>No role matches.</ApiNote></Card>;
  const areas = [...AREAS.map(([a]) => a), 'Other roles'].map((area) => [area, shown.filter((r) => r.area === area).sort((a, b) => b.holders.length - a.holders.length || a.name.localeCompare(b.name))]).filter(([, list]) => list.length);
  return areas.map(([area, list]) => (
    <Card key={area}>
      <div className="rs-area"><h3>{area}</h3><span className="xs muted">{list.length} role{list.length === 1 ? '' : 's'}{canUsers ? ` · ${list.reduce((n, r) => n + r.holders.length, 0)} assignments` : ''}</span></div>
      <div className="rs-roles">{list.map((r) => <RoleRow key={r.id} role={r} canUsers={canUsers} openByDefault={!!query && r.holders.length > 0} />)}</div>
    </Card>
  ));
}

function RoleRow({ role, canUsers, openByDefault }) {
  const [open, setOpen] = useState(openByDefault);
  const perms = useApi(() => authApi.getRolePermissions(role.id), [role.id], open);
  const n = role.holders.length;
  return (
    <div className={`rs-role${open ? ' open' : ''}`}>
      <button className="rs-head" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <ChevronRight size={15} className="rs-chev" />
        <span className="rs-name"><b>{label(role.name)}</b><small>{role.description || 'No responsibility text yet'}</small></span>
        {canUsers && <span className="rs-avas">{role.holders.slice(0, 4).map((p) => <span key={p.id} className="rs-ava" title={p.name}>{initials(p.name)}</span>)}{n > 4 && <span className="rs-ava more">+{n - 4}</span>}</span>}
        {canUsers && <Pill tone={n === 0 ? 'amber' : ''}>{n === 0 ? 'Nobody' : n === 1 ? '1 person' : `${n} people`}</Pill>}
      </button>
      {open && (
        <div className="rs-body">
          <div>
            <h4>Responsibility</h4>
            <p className="body-s">{role.description || '—'}</p>
            <h4 style={{ marginTop: 14 }}>Can use these screens</h4>
            {perms.loading && <p className="xs muted">Loading…</p>}
            {perms.error && <p className="xs muted">Screen permissions are shown to trustees and super administrators.</p>}
            {perms.data && !perms.data.length && <p className="xs muted">No screen permissions set yet. This role works through the access rules built into each service.</p>}
            {perms.data && perms.data.length > 0 && (
              <ul className="rs-perms">{perms.data.map((p) => (
                <li key={p.screenName}><span>{label(p.screenName)}</span>
                  <span className="rs-flags">{FLAGS.map(([k, short, long]) => <i key={k} className={p[k] ? 'on' : ''} title={`${long}: ${p[k] ? 'yes' : 'no'}`}>{short}</i>)}</span></li>))}</ul>)}
            <Link className="link xs" to="/settings?tab=users" style={{ display: 'inline-block', marginTop: 10 }}>Change permissions →</Link>
          </div>
          <div>
            <h4>Assigned staff</h4>
            {!canUsers ? <p className="xs muted">Shown to super administrators.</p> : n === 0 ? <p className="xs muted">Nobody holds this role.</p> : (
              <ul className="rs-people">{role.holders.map((p) => (
                <li key={p.id}><span className="rs-person"><Person name={p.name} sub={p.title || p.username} initials={initials(p.name)} /></span>
                  <span className="xs muted">{p.branch}</span><Pill tone={STATE_TONE[p.state]}>{p.state}</Pill></li>))}</ul>)}
          </div>
        </div>
      )}
    </div>
  );
}

function ByStaff({ people, query }) {
  const shown = people.filter((p) => !query || [p.name, p.username, p.email, p.title, p.roles.map(label).join(' ')].join(' ').toLowerCase().includes(query));
  return (
    <Card>
      <DataTable cols={[
        { label: 'Staff', render: (p) => <span className="rs-person"><Person name={p.name} sub={p.username} initials={initials(p.name)} /></span> },
        { label: 'Job', render: (p) => <span className="xs">{p.title || '—'}</span> },
        { label: 'Campus', render: (p) => <span className="xs">{p.branch || '—'}</span> },
        { label: 'Role(s)', render: (p) => (p.roles.length ? p.roles.map((r) => <span key={r} className="rs-chip">{label(r)}</span>) : <Pill tone="amber">No role</Pill>) },
        { label: 'Account', render: (p) => <Pill tone={STATE_TONE[p.state]}>{p.state}</Pill> },
      ]} rows={shown} />
      <p className="xs muted" style={{ marginTop: 8 }}>{formatNumber(shown.length)} of {formatNumber(people.length)} accounts</p>
    </Card>
  );
}
