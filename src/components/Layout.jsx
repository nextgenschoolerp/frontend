import { NavLink, Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import {
  School, Building2, ChevronsUpDown, LayoutDashboard, GraduationCap, Users, BookOpen,
  ClipboardCheck, Wallet, CalendarDays, Megaphone, ChartNoAxesCombined, FolderOpen,
  Settings as SettingsIcon, CircleHelp, ChevronRight, ChevronDown, Search, CalendarRange, Bell, LogOut,
} from 'lucide-react';
import { useEffect } from 'react';
import { useAuth } from '../auth.jsx';
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

export default function Layout() {
  const { pathname } = useLocation();
  const crumbs = crumbsFor(pathname);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const logout = () => { signOut(); navigate('/login', { replace: true }); };
  useEffect(() => { window.scrollTo(0, 0); document.title = `Oakridge Academy – ${crumbs[crumbs.length - 1]}`; }, [pathname]);

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
      <aside className="sidebar">
        <div className="brand">
          <div className="crest"><School size={22} /></div>
          <div><b>Oakridge</b><small>ACADEMY</small></div>
        </div>
        <div className="campus">
          <Building2 size={16} />
          <div><b>Main campus</b><small>School administration</small></div>
          <ChevronsUpDown size={13} />
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
            <div className="year"><CalendarRange size={15} />2026–2027<ChevronDown size={12} /></div>
            <ThemePicker />
            <div className="bell"><Bell size={19} /></div>
            <div className="account">
              <div className="avatar-s" title={`${user.name} · ${user.role}`}>{user.initials}</div>
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
