import { Link } from 'react-router-dom';
import { ArrowUpRight, FileText, Search, ChevronDown } from 'lucide-react';
import { useState } from 'react';

export const Pill = ({ tone = '', children }) => <span className={`pill ${tone}`}>{children}</span>;

export function PageHeader({ title, desc, actions = [], context = true }) {
  return (
    <>
      <div className="pagehead">
        <div><h1>{title}</h1><p>{desc}</p></div>
        <div className="actions">
          {actions.map((a) => {
            const cls = 'btn' + (a.primary ? ' primary' : '');
            const inner = <>{a.icon}{a.label}</>;
            return a.to
              ? <Link key={a.label} to={a.to} className={cls}>{inner}</Link>
              : <button key={a.label} className={cls} onClick={a.onClick}>{inner}</button>;
          })}
        </div>
      </div>
      {context && (
        <div className="context">
          <span className="dot" />Term 1 · Week 7 of 14<span className="sep">/</span>Friday, 16 October 2026
          <span className="sep">/</span><span className="ok">School in session</span>
        </div>
      )}
    </>
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
  const L = link && (to
    ? <Link to={to} className="link">{link}<ArrowUpRight size={13} /></Link>
    : <span className="link">{link}<ArrowUpRight size={13} /></span>);
  return (
    <div className={'sh' + (pad ? ' pad' : '')}>
      <div><h3>{title}</h3>{sub && <p>{sub}</p>}</div>
      {L}
    </div>
  );
};

export function Tabs({ items, initial = 0 }) {
  const [on, setOn] = useState(initial);
  return (
    <div className="tabs">
      {items.map((t, i) => <button key={t} className={i === on ? 'on' : ''} onClick={() => setOn(i)}>{t}</button>)}
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

export const Pager = ({ text }) => (
  <div className="pager">
    <span>{text}</span>
    <span className="pages"><span>← Previous</span><b className="on">1</b><b>2</b><b>3</b><span>Next →</span></span>
  </div>
);

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
    <span>All times in British Summer Time (BST)</span>
    <span className="live"><i />Last synced today at 09:42 · Next update in 5 min</span>
  </div>
);

export const Card = ({ children, flush, className = '', style }) => (
  <section className={`card${flush ? ' flush' : ''} ${className}`} style={style}>{children}</section>
);

/* form helpers */
export function Field({ label, required, value, placeholder, select, options, type = 'text', box }) {
  const id = label.toLowerCase().replace(/[^a-z]+/g, '-');
  const lab = <label htmlFor={id}>{label.toUpperCase()}{required ? ' *' : ''}</label>;
  const control = select ? (
    <select id={id} defaultValue={value || ''}>
      {!value && <option value="" disabled>{placeholder}</option>}
      {(options || [value]).filter(Boolean).map((o) => <option key={o}>{o}</option>)}
    </select>
  ) : <input id={id} type={type} defaultValue={value} placeholder={placeholder} />;
  return <div className={'field' + (box ? ' box' : '')}>{lab}{control}</div>;
}

export const FieldGrid = ({ cols }) => (
  <div className="fieldgrid">{cols.map((col, i) => <div className="fieldcol" key={i}>{col.map((f) => <Field key={f.label} {...f} />)}</div>)}</div>
);
