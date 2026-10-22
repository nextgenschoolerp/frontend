import { NavLink, Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import {
  School, Building2, ChevronsUpDown, LayoutDashboard, GraduationCap, Users, BookOpen,
  ClipboardCheck, Wallet, CalendarDays, Megaphone, ChartNoAxesCombined, FolderOpen,
  Settings as SettingsIcon, CircleHelp, CalendarClock, ChevronRight, ChevronDown, Search, CalendarRange, Bell, LogOut, Menu, X, Check,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth.jsx';
import { listBranches, getRegionalSettings } from '../api/authService.js';
import { useApi } from '../api/useApi.js';
import { THEMES, getTheme, applyTheme } from '../theme.js';
import { useRegional, version, applyServerRegional } from '../regional.js';
import { GlobalSearch, NotificationBell } from './ShellTools.jsx';

const GROUPS = [
  ['WORKSPACE', [
    ['/', 'Overview', LayoutDashboard, true],
    ['/students', 'Students', GraduationCap],
    ['/staff', 'Staff & faculty', Users],
    ['/academics', 'Academics', BookOpen],
    ['/teaching', 'Teaching & learning', CalendarClock],
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
  students: 'Students', staff: 'Staff & faculty', academics: 'Academics', teaching: 'Teaching & learning', attendance: 'Attendance',
  fees: 'Fees & payments', calendar: 'Calendar', communications: 'Communications', reports: 'Reports',
  documents: 'Documents', settings: 'Settings', help: 'Help & support',
};

function crumbsFor(pathname) {
  const [seg, id, tail] = pathname.split('/').filter(Boolean);
  if (!seg) return ['Overview'];
  const out = [SECTION[seg] || 'Overview'];
  // Live student records have UUID ids (studentservice); other ids are the static sample people. Staff records come from hrservice.
  const person = seg === 'students' ? (/^[0-9a-f]{8}-/i.test(id || '') ? 'Student profile' : 'Amara Thompson') : seg === 'staff' ? (id === 'me' ? 'My profile' : 'Staff profile') : null;
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

const SESSIONS = ['2025–2026', '2026–2027', '2027–2028'];
const SESSION_KEY = 'erp.academicSession';
const shortSession = (s) => s.replace(/^(\d{4})–\d{2}(\d{2})$/, '$1-$2'); // 2026–2027 → 2026-27
const readSession = () => { try { return localStorage.getItem(SESSION_KEY) || '2026–2027'; } catch { return '2026–2027'; } };

/** Account menu: the avatar opens the signed-in user's details, the academic session picker and sign out. */
function AccountMenu({ onSignOut }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState(readSession);
  const [expand, setExpand] = useState(null); // 'session' | 'theme'
  const [theme, setTheme] = useState(getTheme);
  const currentTheme = THEMES.find((t) => t.id === theme) || THEMES[0];
  const toggle = (k) => setExpand((v) => (v === k ? null : k));
  const pickTheme = (id) => { applyTheme(id); setTheme(id); };
  const ref = useRef(null);
  const pick = (s) => { setSession(s); try { localStorage.setItem(SESSION_KEY, s); } catch { /* storage unavailable */ } setOpen(false); };

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => { if (!open) setExpand(null); }, [open]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <div className="account" ref={ref}>
      <button className="avatar-s" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}
        title={`${user.name} · ${user.role} · Session ${shortSession(session)}`} aria-label="Account menu">
        {user.photoUrl ? <img src={user.photoUrl} alt="" /> : user.initials}
      </button>
      {open && (
        <div className="acctmenu" role="menu">
          <div className="acctmenu-head">
            <b>{user.name}</b>
            <small>{user.role}</small>
            <small>{user.email || user.username}</small>
          </div>
          <button className="acctmenu-session" onClick={() => toggle('session')} aria-expanded={expand === 'session'}>
            <CalendarRange size={13} /><span>Academic session – <b>{shortSession(session)}</b></span>
            <ChevronDown size={13} className={expand === 'session' ? 'flip' : ''} />
          </button>
          {expand === 'session' && SESSIONS.map((s) => (
            <button key={s} role="menuitemradio" aria-checked={s === session} className={'acctmenu-year' + (s === session ? ' on' : '')} onClick={() => pick(s)}>
              <span>{shortSession(s)}</span>{s === session && <Check size={14} />}
            </button>
          ))}
          <button className="acctmenu-session" onClick={() => toggle('theme')} aria-expanded={expand === 'theme'}>
            <i className="swatch" style={{ background: currentTheme.swatch }} /><span>Theme – <b>{currentTheme.name}</b></span>
            <ChevronDown size={13} className={expand === 'theme' ? 'flip' : ''} />
          </button>
          {expand === 'theme' && THEMES.map((t) => (
            <button key={t.id} role="menuitemradio" aria-checked={t.id === theme} className={'acctmenu-theme' + (t.id === theme ? ' on' : '')} onClick={() => pickTheme(t.id)}>
              <i className="swatch" style={{ background: t.swatch }} /><span>{t.name}</span>{t.id === theme && <Check size={14} />}
            </button>
          ))}
          <hr />
          <Link to="/settings" role="menuitem"><SettingsIcon size={15} />Settings</Link>
          <button role="menuitem" className="danger" onClick={onSignOut}><LogOut size={15} />Sign out</button>
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const { pathname } = useLocation();
  // Settings → Regional preferences: a change re-renders the page so every date, time and amount uses it
  const regional = version(useRegional());
  const crumbs = crumbsFor(pathname);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [navOpen, setNavOpen] = useState(false);
  const logout = () => { signOut(); navigate('/login', { replace: true }); };
  // The school's saved preferences replace this browser's cached copy; if authservice is unreachable the cache stays in force
  // (useApi, so StrictMode's double mount sends the request once; an error leaves the cache as it is)
  const { data: serverRegional } = useApi(() => getRegionalSettings(user.tenantId), [user?.tenantId], !!user?.tenantId);
  useEffect(() => { if (serverRegional) applyServerRegional(serverRegional); }, [serverRegional]);
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
            <GlobalSearch />
            <CampusSwitcher />
            <NotificationBell />
            <AccountMenu onSignOut={logout} />
          </div>
        </header>
        <div className="page" key={`${pathname}|${regional}`}><Outlet /></div>
      </div>
    </div>
  );
}
