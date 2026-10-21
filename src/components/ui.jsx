import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowUpRight, ArrowLeft, FileText, Search, ChevronDown, Calendar } from 'lucide-react';
import { useState } from 'react';
import { todayIso, formatDate, formatTime, timeZoneNames } from '../regional.js';

export const Pill = ({ tone = '', children }) => <span className={`pill ${tone}`}>{children}</span>;

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

export const Metrics = ({ items }) => (
  <div className="grid4">
    {items.map(([label, value, sub, ctx, good, Icon]) => (
      <div className="card metric" key={label}>
        <div className="mt">{label}{Icon ? <Icon size={17} style={{ color: 'var(--pr)' }} /> : null}</div>
        <div className="mv">{value}</div>
        <div className={'mc' + (good ? ' good' : '')}>{ctx || sub}{ctx && <small>{sub}</small>}</div>
      </div>
    ))}
  </div>
);

export const SectionHead = ({ title, sub, link, to, pad }) => {
  const onBack = useBackLink(to);
  const L = link && (to
    ? <Link to={to} onClick={onBack} className="link">{link}<ArrowUpRight size={13} /></Link>
    : <span className="link">{link}<ArrowUpRight size={13} /></span>);
  return (
    <div className={'sh' + (pad ? ' pad' : '')}>
      <div><h3>{title}</h3>{sub && <p>{sub}</p>}</div>
      {L}
    </div>
  );
};

/** Uncontrolled by default; pass `value` + `onChange` to control the selected tab. */
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
export function DataTable({ cols, rows, boxed }) {
  const t = (
    <div className="tablewrap">
      <table className="t">
        <thead><tr>{cols.map((c) => <th key={c.label}>{c.label}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{cols.map((c) => <td key={c.label} className={c.className}>{c.render ? c.render(r) : r[c.key]}</td>)}</tr>
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
export function Pager({ text, page, pages, onPage }) {
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

export const Card = ({ children, flush, className = '', style }) => (
  <section className={`card${flush ? ' flush' : ''} ${className}`} style={style}>{children}</section>
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
  for (let r = 0; r < rows; r++) cols.forEach((col, c) => cells.push(col[r] ? <Field key={col[r].key || col[r].label} {...col[r]} /> : <div key={`gap-${r}-${c}`} />));
  return <div className="fieldgrid" style={{ '--cols': cols.length }}>{cells}</div>;
}
