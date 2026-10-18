import { NavLink, Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import {
  School, Building2, ChevronsUpDown, LayoutDashboard, GraduationCap, Users, BookOpen,
  ClipboardCheck, Wallet, CalendarDays, Megaphone, ChartNoAxesCombined, FolderOpen,
  Settings as SettingsIcon, CircleHelp, ChevronRight, ChevronDown, Search, CalendarRange, Bell, LogOut, Menu, X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../auth.jsx';
import { listBranches } from '../api/authService.js';
import { useApi } from '../api/useApi.js';
import ThemePicker from './ThemePicker.jsx';

const GROUPS = [
  ['WORKSPACE', [
    ['/', 'Overview', LayoutDashboard, true],
    ['/students', 'Students', GraduationCap],
    ['/staff', 'Staff & faculty', Users],
    ['/academics', 'Academics', BookOpen],
    ['/attendance', 'Attendance', ClipboardCheck],
    ['/fees', 'Fees & payments', Wallet],
  ]],
  ['SCHOOL MANAGEMENT', [
    ['/calendar', 'Calendar', CalendarDays],
    ['/communications', 'Communications', Megaphone, false, 3],
    ['/reports', 'Reports', ChartNoAxesCombined],
    ['/documents', 'Documents', FolderOpen],
  ]],
];

const SECTION = {
  students: 'Students', staff: 'Staff & faculty', academics: 'Academics', attendance: 'Attendance',
  fees: 'Fees & payments', calendar: 'Calendar', communications: 'Communications', reports: 'Reports',
  documents: 'Documents', settings: 'Settings', help: 'Help & support',
};

function crumbsFor(pathname) {
  const [seg, id, tail] = pathname.split('/').filter(Boolean);
  if (!seg) return ['Overview'];
  const out = [SECTION[seg] || 'Overview'];
  const person = seg === 'students' ? 'Amara Thompson' : seg === 'staff' ? 'Eleanor Hughes' : null;
  if (id === 'new') out.push(seg === 'students' ? 'Add student' : 'Add staff member');
  else if (id && person) out.push(tail === 'edit' ? `${person} / Edit` : person);
  return out;
}

/** Campus switcher. Super admins pick from GET /api/v1/tenants/{tenantId}/branches (US-00009). */
function CampusSwitcher() {
  const { user, hasRole, pickedBranch, selectBranch } = useAuth();
  const canList = hasRole('SUPER_ADMIN');
  const { data: branches } = useApi(() => listBranches(user.tenantId), [user.tenantId], canList && !!user.tenantId);
  const current = branches?.find((b) => b.branchCode === pickedBranch) || branches?.find((b) => b.branchCode === user.branchId) || branches?.[0];
  // Make the shown campus the active one for branch-scoped screens (admissions)
  useEffect(() => { if (current && current.branchCode !== pickedBranch) selectBranch(current.branchCode); }, [current?.branchCode]);
  return (
    <div className="campus" title={current ? `${current.branchCode} · ${current.affiliationBoard}` : user.branchId || undefined}>
      <Building2 size={16} />
      <div><b>{current?.branchName || user.branchId || 'Main campus'}</b><small>{current ? `${current.affiliationBoard} · ${current.status.toLowerCase()}` : 'School administration'}</small></div>
      <ChevronsUpDown size={13} />
      {branches?.length > 1 && (
        <select aria-label="Switch campus" value={current?.branchCode} onChange={(e) => selectBranch(e.target.value)}>
          {branches.map((b) => <option key={b.branchCode} value={b.branchCode}>{b.branchName}</option>)}
        </select>
      )}
    </div>
  );
}

export default function Layout() {
  const { pathname } = useLocation();
  const crumbs = crumbsFor(pathname);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [navOpen, setNavOpen] = useState(false);
  const logout = () => { signOut(); navigate('/login', { replace: true }); };
  useEffect(() => { window.scrollTo(0, 0); document.title = `Oakridge Academy – ${crumbs[crumbs.length - 1]}`; }, [pathname]);

  useEffect(() => setNavOpen(false), [pathname]);
  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e) => e.key === 'Escape' && setNavOpen(false);
    document.addEventListener('keydown', onKey);
    document.body.classList.add('noscroll');
    return () => { document.removeEventListener('keydown', onKey); document.body.classList.remove('noscroll'); };
  }, [navOpen]);

  // Cards below the fold slide up as they scroll into view; the rest come in with the page entrance.
  useEffect(() => {
    const below = [...document.querySelectorAll('.page .card')].filter((el) => el.getBoundingClientRect().top > window.innerHeight);
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-revealed'); observer.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    below.forEach((el) => { el.classList.add('reveal'); observer.observe(el); });
    return () => observer.disconnect();
  }, [pathname]);

  return (
    <div className="app">
      {navOpen && <div className="backdrop" onClick={() => setNavOpen(false)} />}
      <aside className={'sidebar' + (navOpen ? ' open' : '')} id="sidebar">
        <div className="brand">
          <div className="crest"><School size={22} /></div>
          <div><b>Oakridge</b><small>ACADEMY</small></div>
          <button className="navclose" onClick={() => setNavOpen(false)} aria-label="Close menu"><X size={18} /></button>
        </div>
        <CampusSwitcher />
        {GROUPS.map(([label, items]) => (
          <div className="navgroup" key={label}>
            <h6>{label}</h6>
            <nav className="navlinks">
              {items.map(([to, text, Icon, end, count]) => (
                <NavLink key={to} to={to} end={!!end} className={({ isActive }) => 'navitem' + (isActive ? ' active' : '')}>
                  <Icon size={18} />{text}{count ? <span className="count">{count}</span> : null}
                </NavLink>
              ))}
            </nav>
          </div>
        ))}
        <div className="sidebottom">
          <div className="support">
            <NavLink to="/settings" className={({ isActive }) => (isActive ? 'active' : '')}><SettingsIcon size={18} />Settings</NavLink>
            <NavLink to="/help" className={({ isActive }) => (isActive ? 'active' : '')}><CircleHelp size={18} />Help & support</NavLink>
          </div>
        </div>
      </aside>
      <div className="main">
        <header className="toolbar">
          <button className="menubtn" onClick={() => setNavOpen(true)} aria-label="Open menu" aria-controls="sidebar" aria-expanded={navOpen}><Menu size={20} /></button>
          <div className="crumbs">
            <Link to="/">Workspace</Link>
            {crumbs.map((c, i) => (
              <span key={c} style={{ display: 'contents' }}>
                <ChevronRight size={12} />
                <span className={i === crumbs.length - 1 ? 'cur' : ''}>{c}</span>
              </span>
            ))}
          </div>
          <div className="tools">
            <label className="gsearch"><Search size={15} /><input placeholder="Search students, staff, records..." /><small>⌘ K</small></label>
            <div className="year"><CalendarRange size={15} /><span>2026–2027</span><ChevronDown size={12} /></div>
            <ThemePicker />
            <div className="bell"><Bell size={19} /></div>
            <div className="account">
              <div className="avatar-s" title={`${user.name} · ${user.role} · ${user.email || user.username}`}>{user.initials}</div>
              <div><b>{user.name}</b><small>{user.role}</small></div>
              <button className="signout" onClick={logout} title="Sign out" aria-label="Sign out"><LogOut size={16} /></button>
            </div>
          </div>
        </header>
        <div className="page" key={pathname}><Outlet /></div>
      </div>
    </div>
  );
}
