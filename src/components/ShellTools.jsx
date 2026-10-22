import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Bell, GraduationCap, Users, ArrowRight, Megaphone } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { useApi } from '../api/useApi.js';
import { listStudents } from '../api/studentService.js';
import { listEmployees } from '../api/hrService.js';
import { listBroadcasts } from '../api/communicationService.js';
import { formatDateTime } from '../regional.js';

/* Top bar tools: global search (⌘K / Ctrl+K) and the notifications bell. */

const PAGES = [
  ['Overview', '/'], ['Students', '/students'], ['Add student', '/students/new'], ['Admissions', '/students?tab=admissions'],
  ['Staff & faculty', '/staff'], ['Add staff member', '/staff/new'], ['Academics', '/academics'], ['Teaching & learning', '/teaching'],
  ['Attendance', '/attendance'], ['Fees & payments', '/fees'], ['Calendar', '/calendar'], ['Communications', '/communications'],
  ['Reports', '/reports'], ['Documents', '/documents'], ['Settings', '/settings'], ['Academic setup', '/settings?tab=academic'],
  ['Users & permissions', '/settings?tab=users'], ['Help & support', '/help'],
];

/** Click outside or Escape closes a popover. */
function useDismiss(ref, open, close) {
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (!ref.current?.contains(e.target)) close(); };
    const onKey = (e) => e.key === 'Escape' && close();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);
}

export function GlobalSearch() {
  const { user, pickedBranch } = useAuth();
  const branchId = pickedBranch || user.branchId;
  const navigate = useNavigate();
  const box = useRef(null);
  const input = useRef(null);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [used, setUsed] = useState(false); // load people only once search is first used
  const students = useApi(() => listStudents(user.tenantId, branchId), [user.tenantId, branchId], used && !!user.tenantId && !!branchId);
  const staff = useApi(() => listEmployees(), [], used);
  useDismiss(box, open, () => setOpen(false));

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); input.current?.focus(); setOpen(true); setUsed(true); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const needle = q.trim().toLowerCase();
  const has = (...parts) => parts.filter(Boolean).join(' ').toLowerCase().includes(needle);
  const results = !needle ? [] : [
    ...(Array.isArray(students.data) ? students.data : []).filter((s) => has(s.firstName, s.lastName, s.admissionNumber))
      .slice(0, 5).map((s) => ({ key: s.studentId, icon: GraduationCap, title: `${s.firstName} ${s.lastName}`, sub: `Student${s.admissionNumber ? ` · ${s.admissionNumber}` : ''}`, to: `/students/${s.studentId}` })),
    ...(Array.isArray(staff.data) ? staff.data : []).filter((s) => has(s.firstName, s.lastName, s.employeeCode, s.designation))
      .slice(0, 5).map((s) => ({ key: s.staffId, icon: Users, title: `${s.firstName} ${s.lastName}`, sub: [s.designation, s.employeeCode].filter(Boolean).join(' · '), to: `/staff/${s.staffId}` })),
    ...PAGES.filter(([t]) => t.toLowerCase().includes(needle)).slice(0, 5).map(([t, to]) => ({ key: to, icon: ArrowRight, title: t, sub: 'Page', to })),
  ];
  const loading = needle && (students.loading || staff.loading);
  const go = (r) => { navigate(r.to); setQ(''); setOpen(false); input.current?.blur(); };
  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && results[active]) go(results[active]);
  };

  return (
    <div className="gsearch-wrap" ref={box}>
      <label className="gsearch"><Search size={15} />
        <input ref={input} placeholder="Search students, staff, records..." value={q} aria-label="Search" aria-expanded={open && !!needle}
          onFocus={() => { setOpen(true); setUsed(true); }} onChange={(e) => { setQ(e.target.value); setActive(0); setOpen(true); }} onKeyDown={onKeyDown} />
        <small>{navigator.platform.includes('Mac') ? '⌘ K' : 'Ctrl K'}</small></label>
      {open && needle && (
        <div className="acctmenu searchmenu" role="listbox">
          {results.map((r, i) => (
            <button type="button" key={r.key} role="option" aria-selected={i === active} className={i === active ? 'on' : ''} onMouseEnter={() => setActive(i)} onClick={() => go(r)}>
              <r.icon size={15} /><span><b>{r.title}</b><small>{r.sub}</small></span>
            </button>
          ))}
          {!results.length && <p className="xs muted" style={{ padding: '8px 10px' }}>{loading ? 'Searching…' : `No students, staff or pages match “${q.trim()}”.`}</p>}
        </div>
      )}
    </div>
  );
}

const SEEN_KEY = 'erp.notifications.seenAt';
const readSeen = () => { try { return Number(localStorage.getItem(SEEN_KEY)) || 0; } catch { return 0; } };

/** Latest circulars from communicationservice; unread = newer than the last time this browser opened the list. */
export function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const box = useRef(null);
  const [open, setOpen] = useState(false);
  const [seenAt, setSeenAt] = useState(readSeen);
  const feed = useApi(() => listBroadcasts(user.tenantId), [user.tenantId], !!user.tenantId);
  useDismiss(box, open, () => setOpen(false));
  const items = (Array.isArray(feed.data) ? feed.data : []).filter((b) => !b.isArchived)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 6);
  const unread = items.filter((b) => new Date(b.createdAt).getTime() > seenAt).length;
  const markRead = () => { const now = Date.now(); setSeenAt(now); try { localStorage.setItem(SEEN_KEY, String(now)); } catch { /* private window */ } };

  return (
    <div className="bellwrap" ref={box}>
      <button type="button" className={'bell' + (unread ? ' unread' : '')} aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'} aria-expanded={open}
        onClick={() => setOpen((o) => !o)}><Bell size={19} /></button>
      {open && (
        <div className="acctmenu notifmenu">
          <div className="acctmenu-head row"><b>Notifications</b>{unread > 0 && <button type="button" className="link" onClick={markRead}>Mark all read</button>}</div>
          {feed.error && <p className="xs muted" style={{ padding: '8px 10px' }}>Notifications could not be loaded.</p>}
          {!feed.error && !items.length && <p className="xs muted" style={{ padding: '8px 10px' }}>{feed.loading ? 'Loading…' : 'You’re all caught up.'}</p>}
          {items.map((b) => (
            <button type="button" key={b.broadcastId} onClick={() => { markRead(); setOpen(false); navigate('/communications'); }}>
              <Megaphone size={15} /><span><b>{new Date(b.createdAt).getTime() > seenAt && <i className="dot" />}{b.title}</b>
                <small>{b.senderName || 'School office'} · {formatDateTime(b.createdAt, { year: false })}</small></span>
            </button>
          ))}
          <button type="button" className="link" style={{ justifyContent: 'center' }} onClick={() => { markRead(); setOpen(false); navigate('/communications'); }}>View all in Communications →</button>
        </div>
      )}
    </div>
  );
}
