import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowUpRight, Check, ArrowLeft, FileText, Search, ChevronDown, ChevronUp, ChevronsUpDown, Calendar, AlertTriangle, XCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { todayIso, formatDate, formatTime, timeZoneNames } from '../regional.js';

/* Status icons, so a pill's meaning does not depend on its colour alone. Set per tone by default. */
const TONE_ICON = { green: Check, amber: AlertTriangle, red: XCircle };
/** `icon` overrides the tone's icon (pass `false` for none). */
export const Pill = ({ tone = '', icon, children }) => {
  const Icon = icon === undefined ? TONE_ICON[tone] : icon || null;
  return <span className={`pill ${tone}`}>{Icon && <Icon size={11} strokeWidth={2.5} aria-hidden="true" className="pill-ic" />}{children}</span>;
};

/** Saves `content` as a file download (Export buttons build their files in the browser). */
export function downloadFile(name, content, type = 'text/csv') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
/** CSV with a header row; values are quoted. File names get today's date: "students-2026-10-18.csv". */
export function downloadCsv(base, header, rows) {
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [header, ...rows].map((r) => r.map(cell).join(',')).join(String.fromCharCode(13, 10));
  downloadFile(`${base}-${new Date().toISOString().slice(0, 10)}.csv`, `\uFEFF${csv}`);
}

/* ---------- school calendar and the date the pages are viewed for ---------- */

// Term 1 of 2026–2027 (Calendar / Settings → Academic setup): 31 Aug – 18 Dec 2026, half-term 26–30 Oct
const TERM = { name: 'Term 1', start: '2026-08-31', end: '2026-12-18', breaks: [['2026-10-26', '2026-10-30']] };
const atNoon = (iso) => new Date(`${iso}T12:00:00`);
const isoOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
// Today in the school's time zone (Settings → Regional preferences)
export { todayIso };
const inBreak = (iso) => TERM.breaks.some(([a, b]) => iso >= a && iso <= b);
/** Teaching weeks (Monday dates) of the term, half-term excluded. */
const termWeeks = () => {
  const weeks = [];
  for (let d = atNoon(TERM.start); isoOf(d) <= TERM.end; d.setDate(d.getDate() + 7)) if (!inBreak(isoOf(d))) weeks.push(isoOf(d));
  return weeks;
};
/** Term, week and whether school is open on a date: { date, week, weeks, status, open }. */
export function schoolDay(iso) {
  const d = atNoon(iso);
  const date = formatDate(iso, { weekday: 'long' });
  const weeks = termWeeks();
  const week = weeks.filter((w) => w <= iso).length;
  const inTerm = iso >= TERM.start && iso <= TERM.end;
  const status = !inTerm ? 'Outside term dates' : inBreak(iso) ? 'Half-term break' : d.getDay() % 6 === 0 ? 'Weekend · school closed' : 'School in session';
  return { date, week, weeks: weeks.length, inTerm, onBreak: inBreak(iso), status, open: status === 'School in session' };
}

/** Read-only "Today · 18 Oct 2026" with a calendar icon (Overview header). */
export function TodayLabel() {
  const short = formatDate(todayIso());
  return <span className="today-label"><Calendar size={15} />Today · {short}</span>;
}

/**
 * Click handler for a link to another page that lets that page offer "Back to <this page>".
 * The page is named after its heading, in title case ("Student profile" -> "Student Profile").
 */
export function useBackLink(to) {
  const location = useLocation();
  const navigate = useNavigate();
  return (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; // new tab / window: plain link
    e.preventDefault();
    const heading = document.querySelector('.pagehead h1')?.textContent.trim() || '';
    const fromTitle = heading.replace(/(^|\s)(\p{Ll})/gu, (m, sp, ch) => sp + ch.toUpperCase());
    navigate(to, { state: { from: location.pathname + location.search, fromTitle } });
  };
}

/** Page title with a back arrow beside it: `<BackTitle to="/students" label="Back to students">Krish Pandey</BackTitle>`. */
export const BackTitle = ({ to, label, children }) => (
  <span className="titlerow">
    <Link to={to} className="iconbtn" aria-label={label} title={label}><ArrowLeft size={16} /></Link>
    {children}
  </span>
);

/** Secondary actions behind one button: `{ more: [{ label, icon, onClick, disabled, title }] }` in PageHeader's actions. */
function MoreActions({ label, items }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const outside = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', outside); document.removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <div className="actionmenu" ref={ref}>
      <button type="button" className="btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>{label}<ChevronDown size={14} aria-hidden="true" /></button>
      {open && (
        <div className="actionmenu-list" role="menu">
          {items.map((i) => (
            <button type="button" role="menuitem" key={i.label} className="actionmenu-item" disabled={i.disabled} title={i.title}
              onClick={() => { setOpen(false); i.onClick(); }}>{i.icon}{i.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

export function PageHeader({ title, desc, actions = [], context = true }) {
  // Opened from a link on another page (see useBackLink): offer a way back unless the page already has one
  const { state } = useLocation();
  if (state?.from && !actions.some((a) => a.label.startsWith('Back'))) {
    actions = [{ label: `Back to ${state.fromTitle || 'previous page'}`, icon: <ArrowLeft size={15} />, to: state.from }, ...actions];
  }
  return (
    <>
      <div className="pagehead">
        <div><h1>{title}</h1><p>{desc}</p></div>
        <div className="actions">
          {actions.map((a) => {
            if (a.more) return <MoreActions key={a.label} label={a.label} items={a.more} />;
            if (a.render) return <span key={a.label}>{a.render()}</span>;
            const cls = 'btn' + (a.primary ? ' primary' : '');
            const inner = <>{a.icon}{a.label}</>;
            return a.to
              ? <Link key={a.label} to={a.to} className={cls}>{inner}</Link>
              : <button key={a.label} className={cls} onClick={a.onClick} disabled={a.disabled} title={a.title}>{inner}</button>;
          })}
        </div>
      </div>
      {context && <DayContext />}
    </>
  );
}

/** "Term 1 · Week 7 of 15 / Sunday, 18 October 2026 / Weekend · school closed" for today. */
function DayContext() {
  const day = schoolDay(todayIso());
  return (
    <div className="context">
      <span className={`dot${day.open ? '' : ' off'}`} />{!day.inTerm ? '2026–2027' : day.onBreak ? `${TERM.name} · Half-term` : `${TERM.name} · Week ${Math.max(day.week, 1)} of ${day.weeks}`}
      <span className="sep">/</span>{day.date}
      <span className="sep">/</span><span className={day.open ? 'ok' : 'off'}>{day.status}</span>
    </div>
  );
}

/** Smoothly scroll to the element with this id (stat cards that point at a section of the same page). */
export const scrollToId = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

/** Stat cards: [label, value, sub, ctx, good, Icon, go]. `go` makes the card clickable: a route string (link) or a function (button);
    pass `{ to | onClick, hint, active }` to also set the tooltip and mark the card as the one currently showing (tinted, ✓). Omit it (or `null`) for a plain card. */
export const Metrics = ({ items }) => (
  <div className="grid4">
    {items.map(([label, value, sub, ctx, good, Icon, go]) => {
      const body = (
        <>
          <div className="mt">{label}{go ? (go.active ? <Check size={15} className="go" aria-hidden="true" /> : <ArrowUpRight size={15} className="go" aria-hidden="true" />) : Icon ? <Icon size={17} style={{ color: 'var(--pr)' }} /> : null}</div>
          <div className="mv">{value}</div>
          <div className={'mc' + (good ? ' good' : '')}>{ctx || sub}{ctx && <small>{sub}</small>}</div>
        </>
      );
      if (!go) return <div className="card metric" key={label}>{body}</div>;
      const { to, onClick, hint, active } = typeof go === 'string' ? { to: go } : typeof go === 'function' ? { onClick: go } : go;
      const title = hint || `Open ${label.toLowerCase()}`;
      return to
        ? <Link className={'card metric clickable' + (active ? ' on' : '')} key={label} to={to} title={title} aria-current={active ? 'true' : undefined} aria-label={`${label}: ${value}. ${title}`}>{body}</Link>
        : <button type="button" className={'card metric clickable' + (active ? ' on' : '')} key={label} onClick={onClick} title={title} aria-pressed={!!active} aria-label={`${label}: ${value}. ${title}`}>{body}</button>;
    })}
  </div>
);

export const SectionHead = ({ title, sub, link, to, onClick, pad }) => {
  const onBack = useBackLink(to);
  const L = link && (to
    ? <Link to={to} onClick={onBack} className="link">{link}<ArrowUpRight size={13} /></Link>
    : onClick ? <button type="button" className="link" onClick={onClick}>{link}</button>
      : <span className="link">{link}<ArrowUpRight size={13} /></span>);
  return (
    <div className={'sh' + (pad ? ' pad' : '')}>
      <div><h3>{title}</h3>{sub && <p>{sub}</p>}</div>
      {L}
    </div>
  );
};

/** Uncontrolled by default; pass `value` + `onChange` to control the selected tab. */
/** Tab state that opens on the tab named by ?tab= (its label as a slug, e.g. /attendance?tab=absence-history), so guides and other pages can link to a tab. */
export function useTabParam(labels) {
  const [params] = useSearchParams();
  const slug = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return useState(() => Math.max(0, labels.findIndex((t) => slug(t) === params.get('tab'))));
}

export function Tabs({ items, initial = 0, value, onChange }) {
  const [own, setOwn] = useState(initial);
  const on = value ?? own;
  const pick = (i) => { setOwn(i); onChange?.(i); };
  return (
    <div className="tabs" role="tablist">
      {items.map((t, i) => <button type="button" role="tab" aria-selected={i === on} key={t} className={i === on ? 'on' : ''} onClick={() => pick(i)}>{t}</button>)}
    </div>
  );
}

export const SearchBox = ({ placeholder, value, onChange, width }) => (
  <label className="search" style={width ? { width } : null}>
    <Search size={14} />
    <input placeholder={placeholder} value={value} onChange={onChange ? (e) => onChange(e.target.value) : undefined} />
  </label>
);

export const Select = ({ children }) => <span className="select">{children}<ChevronDown size={12} /></span>;

/** cols: [{ label, key, render?, className? }]  rows: array of objects */
/**
 * Column sorting. Keep `sort` in the page (`const sort = useSort()`), sort the rows before paging
 * (`sortRows(rows, cols, sort)`), and give sortable columns a `sortBy: (row) => value`.
 * Clicking a header sorts ascending, then descending, then back to the original order.
 */
export function useSort() {
  const [sort, setSort] = useState({ key: null, dir: 'asc' });
  const toggle = (key) => setSort((s) => (s.key !== key ? { key, dir: 'asc' } : s.dir === 'asc' ? { key, dir: 'desc' } : { key: null, dir: 'asc' }));
  return { ...sort, toggle };
}

export function sortRows(rows, cols, sort) {
  const col = cols.find((c) => c.sortBy && c.label === sort.key);
  if (!col) return rows;
  const blank = (v) => v == null || v === '';
  const dir = sort.dir === 'asc' ? 1 : -1;
  return rows.map((r, i) => [r, i]).sort(([a, i], [b, j]) => {
    const x = col.sortBy(a); const y = col.sortBy(b);
    // Blank values sort last in both directions; ties keep the original order
    if (blank(x) || blank(y)) return blank(x) === blank(y) ? i - j : blank(x) ? 1 : -1;
    const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true, sensitivity: 'base' });
    return c * dir || i - j;
  }).map(([r]) => r);
}

function SortHead({ label, sort }) {
  const active = sort.key === label;
  const Icon = !active ? ChevronsUpDown : sort.dir === 'asc' ? ChevronUp : ChevronDown;
  return (
    <button type="button" className={'sorth' + (active ? ' on' : '')} onClick={() => sort.toggle(label)}>
      {label}<Icon size={11} aria-hidden="true" />
    </button>
  );
}

/**
 * `cards`: on phones and tablets each row becomes a card (labelled fields, no sideways scrolling).
 * A column with `hideOnCards` is left out of the card; the first column is the card's title.
 */
export function DataTable({ cols, rows, boxed, sort, cards }) {
  const t = (
    <div className="tablewrap">
      <table className={'t' + (cards ? ' cards' : '')}>
        <thead><tr>{cols.map((c) => (
          <th key={c.label} className={c.hideOnCards ? 'hide-card' : undefined}
            aria-sort={sort && c.sortBy && sort.key === c.label ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
            {sort && c.sortBy ? <SortHead label={c.label} sort={sort} /> : c.label}
          </th>
        ))}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{cols.map((c) => (
              <td key={c.label} className={[c.className, c.hideOnCards ? 'hide-card' : ''].filter(Boolean).join(' ') || undefined} data-label={c.label}>
                {c.render ? c.render(r) : r[c.key]}
              </td>
            ))}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  return boxed ? <div className="tablebox">{t}</div> : t;
}

/**
 * Table footer. With `pages` and `onPage` it pages for real (Previous / numbers / Next, at most 5 numbers around the
 * current page, hidden when everything fits on one page); without them it is the static sample footer.
 */
export function Pager({ text, page, pages, onPage, pageSize, onPageSize }) {
  if (!onPage) {
    return (
      <div className="pager">
        <span>{text}</span>
        <span className="pages"><span>← Previous</span><b className="on">1</b><b>2</b><b>3</b><span>Next →</span></span>
      </div>
    );
  }
  const first = Math.max(1, Math.min(page - 2, pages - 4));
  const numbers = Array.from({ length: Math.min(5, pages) }, (_, i) => first + i);
  return (
    <div className="pager">
      <span>{text}</span>
      {onPageSize && (
        <label className="pagesize">Rows per page
          <select value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))} aria-label="Rows per page">
            {[10, 25, 50].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      )}
      {pages > 1 && (
        <nav className="pages" aria-label="Pages">
          <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)}>← Previous</button>
          {numbers.map((n) => (
            <button type="button" key={n} className={`num${n === page ? ' on' : ''}`} aria-current={n === page ? 'page' : undefined} onClick={() => onPage(n)}>{n}</button>
          ))}
          <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next →</button>
        </nav>
      )}
    </div>
  );
}

/** Placeholder table while a list loads: the real header labels over shimmering rows, so the layout does not jump. */
export function SkeletonTable({ cols, rows = 6 }) {
  return (
    <div className="tablebox" role="status" aria-busy="true" aria-label="Loading">
      <div className="tablewrap">
        <table className="t">
          <thead><tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
          <tbody>
            {Array.from({ length: rows }, (_, i) => (
              <tr key={i}>{cols.map((c, j) => <td key={c}><span className="skel" style={{ width: `${[70, 55, 40, 65, 45, 50, 60][j % 7]}%` }} /></td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Nothing to show: a title, an optional hint, and an optional action button. */
export const EmptyState = ({ title, children, action }) => (
  <div className="emptystate">
    <b>{title}</b>
    {children && <p className="xs muted">{children}</p>}
    {action}
  </div>
);

/** Applied filters as removable chips + "Clear all". `chips`: [[label, onRemove], …]; `extra` sits after "Clear all". Renders nothing when empty. */
export const FilterChips = ({ chips, onClear, save, end }) => (chips.length || end || save ? (
  <div className="fchips" role="group" aria-label="Applied filters">
    {chips.map(([label, remove]) => (
      <span className="fchip" key={label}>{label}<button type="button" onClick={remove} aria-label={`Remove filter ${label}`}>✕</button></span>
    ))}
    {chips.length > 0 && <button type="button" className="link" onClick={onClear}>Clear all</button>}
    {save && <span className="fchips-save">{save}</span>}
    {/* Right-aligned: saved views */}
    {end && <span className="fchips-end">{end}</span>}
  </div>
) : null);

/* Avatar colours for the initials, one pair per class so a class reads as a block when scanning. [background, text] */
const AVATAR_TONES = [['#e8eefb', '#2f5aa8'], ['#e7f5ee', '#1f7a57'], ['#fbeee6', '#a4531f'], ['#f3ebfa', '#6b3fa0'],
  ['#fdf3d9', '#8a6410'], ['#e6f4f7', '#1d6a7a'], ['#fbe9ee', '#a0325a'], ['#eef0e6', '#55652a']];
/** Same group (class, department) → same colour; the hash keeps it stable between reloads. */
export const avatarTone = (key) => AVATAR_TONES[[...String(key || '')].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 0) % AVATAR_TONES.length];

export const Person = ({ name, sub, initials }) => (
  <>
    <span className="avatar-sm">{initials || name.split(' ').map((w) => w[0]).join('').slice(0, 2)}</span>
    <span className="cell-id"><b>{name}</b><small>{sub}</small></span>
  </>
);

export const Actions = ({ children }) => <span className="act">{children}</span>;

export const KV = ({ rows }) => (
  <div className="kv">{rows.map(([k, v]) => <div className="detail" key={k}>{k}<span>·</span><b>{v}</b></div>)}</div>
);

export const Docs = ({ items }) => (
  <div className="docs">
    {items.map(([name, meta]) => (
      <div className="doc" key={name}><FileText size={20} /><div><b>{name}</b><small>{meta}</small></div></div>
    ))}
  </div>
);

export const Footer = () => (
  <div className="footnote">
    <span>All times in {timeZoneNames().long} ({timeZoneNames().short})</span>
    <span className="live"><i />Last synced today at {formatTime(new Date())}</span>
  </div>
);

export const Card = ({ children, flush, className = '', style, id }) => (
  <section id={id} className={`card${flush ? ' flush' : ''} ${className}`} style={style}>{children}</section>
);

/* form helpers */
export function Field({ label, required, value, placeholder, select, options, type = 'text', box, max, onChange, readOnly }) {
  const id = label.toLowerCase().replace(/[^a-z]+/g, '-');
  const lab = <label htmlFor={id}>{label.toUpperCase()}{required ? ' *' : ''}</label>;
  const control = select ? (
    <select id={id} name={id} defaultValue={value || ''} onChange={onChange}>
      {!value && <option value="" disabled>{placeholder}</option>}
      {(options || [value]).filter(Boolean).map((o) => <option key={o}>{o}</option>)}
    </select>
  ) : <input id={id} name={id} type={type} defaultValue={value} placeholder={placeholder} max={max} onChange={onChange} readOnly={readOnly}
    // required on an empty date makes it :invalid, which styles its dd/mm/yyyy hint grey (forms use noValidate)
    required={type === 'date' && required ? true : undefined} />;
  return <div className={'field' + (box ? ' box' : '')}>{lab}{control}</div>;
}

/**
 * cols: one array of fields per column. Fields are laid out row by row (row 1 of every column, then row 2, …)
 * so that when the columns stack on narrow screens the reading order stays First name, Last name, Preferred name, …
 */
export function FieldGrid({ cols }) {
  const rows = Math.max(...cols.map((c) => c.length));
  const cells = [];
  for (let r = 0; r < rows; r++) {
    cols.forEach((col, c) => {
      if (!col[r]) { cells.push(<div key={`gap-${r}-${c}`} />); return; }
      const { key, ...field } = col[r];
      cells.push(<Field key={key || field.label} {...field} />);
    });
  }
  return <div className="fieldgrid" style={{ '--cols': cols.length }}>{cells}</div>;
}
