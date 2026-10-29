import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Download, Plus, Upload, Check, ChevronLeft, ChevronRight, Search, FileText, Users,
  FolderOpen, Settings as Cog, ShieldCheck, Folder, Bold, Italic, Underline, AlignLeft, Paperclip, Send,
} from 'lucide-react';
import {
  PageHeader, Metrics, Card, SectionHead, useBackLink, Tabs, SearchBox, Select, DataTable, Pager, Pill, Footer, Field, FieldGrid, KV, downloadFile, downloadCsv, schoolDay, todayIso,
} from '../components/ui.jsx';
import { ApiErr, ApiNote } from '../components/Admissions.jsx';
import { SchoolProfileCard, AcademicSetupCard, AlertPreferencesCard } from '../components/SettingsCards.jsx';
import { RolesCard, SecurityCard, Modal } from '../components/AuthSettings.jsx';
import CommunicationsLive from '../components/CommunicationsLive.jsx';
import ReportsLive from '../components/ReportsLive.jsx';
import * as commApi from '../api/communicationService.js';
import { useApi } from '../api/useApi.js';
import { useAuth } from '../auth.jsx';
import { useSchoolName } from '../useSchoolName.js';
import { formatDate, formatDateTime, formatTime } from '../regional.js';
import { getRegional, applyServerRegional, version, zoneName, TIME_ZONES, CURRENCIES, DATE_FORMATS, LANGUAGES, DEFAULT_REGIONAL } from '../regional.js';
import { saveRegionalSettings } from '../api/authService.js';
import { DataImportCard, canImportData } from '../components/DataImport.jsx';
import { ClassStructureCard } from '../components/AcademicStructure.jsx';

const act = (t) => <span className="act">{t}</span>;

/* ---------- Calendar ---------- */
export { Calendar } from '../components/CalendarPage.jsx';

/* ---------- Communications ---------- */
export function Communications() {
  return (
    <>
      <CommunicationsLive />
      <Footer />
    </>
  );
}

/* ---------- Reports ---------- */
export function Reports() {
  return (
    <>
      <ReportsLive />
      <Footer />
    </>
  );
}

/* ---------- Documents ---------- */
// Sample library, shown when communicationservice's document library cannot be reached (same rows as its module09 seed)
const ACCESS = ['All staff', 'Staff & parents', 'Public', 'School administrators'];
const PER_PAGE = 7;
const FOLDERS = [
  { name: 'Student records', sub: '1,248 folders', access: 'School administrators' },
  { name: 'Staff records', sub: '92 folders', access: 'School administrators' },
  { name: 'School policies', sub: '24 documents', access: 'All staff' },
  { name: 'Finance & billing', sub: '186 documents', access: 'School administrators' },
];
const doc = (id, folder, name, owner, modified, access, size, extra) => ({ id, folder, name, owner, modified, access, size, version: '1.0', ...extra });
const POLICIES = [
  ['Safeguarding policy 2026.pdf', 'Helen Morris', '2026-09-01', 'All staff', '1.2 MB', { version: '3.0', shared: true }],
  ['Staff handbook 2026–27.pdf', 'Michael Brooks', '2026-08-28', 'Staff & parents', '684 KB', { version: '2.1' }],
  ['Autumn term newsletter.pdf', 'Sarah Williams', '2026-10-15', 'Public', '248 KB', { shared: true }],
  ['Behaviour policy.pdf', 'Sarah Williams', '2026-09-01', 'All staff', '892 KB', { version: '2.0' }],
  ['Admissions policy.pdf', 'Michael Brooks', '2026-09-02', 'Staff & parents', '764 KB'],
  ['First aid procedures.pdf', 'Grace Taylor', '2026-09-05', 'All staff', '2.4 MB', { shared: true }],
  ['Attendance policy.pdf', 'Sarah Williams', '2026-10-10', 'All staff', '86 KB', { version: '1.4' }],
  ['Anti-bullying policy.pdf', 'Helen Morris', '2026-09-03', 'Staff & parents', '412 KB'],
  ['Online safety policy.pdf', 'David Chen', '2026-09-12', 'Staff & parents', '538 KB', { shared: true }],
  ['Data protection policy.pdf', 'Michael Brooks', '2026-08-30', 'All staff', '1.1 MB', { version: '4.0' }],
  ['Equality and diversity policy.pdf', 'Grace Taylor', '2026-09-08', 'Public', '356 KB'],
  ['Health and safety policy.pdf', 'James Reid', '2026-09-15', 'All staff', '1.8 MB'],
  ['SEND policy.pdf', 'Laura Bennett', '2026-09-20', 'Staff & parents', '944 KB', { shared: true }],
  ['Uniform policy.pdf', 'Sarah Williams', '2026-08-25', 'Public', '212 KB'],
  ['Homework policy.pdf', 'David Chen', '2026-09-24', 'Staff & parents', '178 KB'],
  ['Complaints procedure.pdf', 'Michael Brooks', '2026-09-10', 'Public', '298 KB'],
  ['Whistleblowing policy.pdf', 'Helen Morris', '2026-08-29', 'All staff', '264 KB'],
  ['Exams policy 2026–27.pdf', 'James Reid', '2026-10-02', 'Staff & parents', '622 KB', { version: '1.2' }],
  ['Educational visits policy.pdf', 'Laura Bennett', '2026-09-18', 'All staff', '476 KB'],
  ['Mobile phone policy.pdf', 'Sarah Williams', '2026-10-06', 'Staff & parents', '134 KB', { shared: true }],
  ['Staff code of conduct.pdf', 'Helen Morris', '2026-08-27', 'All staff', '388 KB', { version: '2.0' }],
  ['Fire evacuation plan.pdf', 'James Reid', '2026-09-28', 'All staff', '1.5 MB'],
  ['Policy review schedule.csv', 'Michael Brooks', '2026-10-12', 'School administrators', '18 KB'],
  ['Medicines in school policy.pdf', 'Grace Taylor', '2026-10-08', 'Staff & parents', '402 KB'],
  ['Behaviour policy 2025.pdf', 'Sarah Williams', '2025-09-01', 'All staff', '860 KB', { archived: true }],
  ['Safeguarding policy 2025.pdf', 'Helen Morris', '2025-09-01', 'All staff', '1.1 MB', { archived: true, version: '2.0' }],
  ['Staff handbook 2025–26.pdf', 'Michael Brooks', '2025-08-28', 'Staff & parents', '652 KB', { archived: true }],
];
const DOCS = [
  ...POLICIES.map(([n, o, m, a, s, x], i) => doc(`pol-${i + 1}`, 'School policies', n, o, m, a, s, x)),
  doc('stu-1', 'Student records', 'Admissions register 2026–27.csv', 'Michael Brooks', '2026-10-14', 'School administrators', '96 KB'),
  doc('stu-2', 'Student records', 'Year 10 options summary.pdf', 'David Chen', '2026-10-05', 'All staff', '312 KB', { shared: true }),
  doc('stu-3', 'Student records', 'Consent forms tracker.csv', 'Grace Taylor', '2026-09-22', 'School administrators', '41 KB'),
  doc('stf-1', 'Staff records', 'Staff training log 2026.csv', 'Helen Morris', '2026-10-09', 'School administrators', '58 KB'),
  doc('stf-2', 'Staff records', 'DBS check register.pdf', 'Helen Morris', '2026-09-04', 'School administrators', '204 KB'),
  doc('fin-1', 'Finance & billing', 'Term 1 fee schedule.pdf', 'Michael Brooks', '2026-08-20', 'Staff & parents', '146 KB', { shared: true }),
  doc('fin-2', 'Finance & billing', 'Outstanding balances October.csv', 'Michael Brooks', '2026-10-16', 'School administrators', '72 KB'),
];
const TYPES = { pdf: 'PDF document', csv: 'Spreadsheet', xlsx: 'Spreadsheet', xls: 'Spreadsheet', doc: 'Word document', docx: 'Word document', png: 'Image', jpg: 'Image', jpeg: 'Image' };
const typeOf = (name) => TYPES[name.split('.').pop().toLowerCase()] || 'Other file';
const sizeOf = (bytes) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
const ascii = (t) => t.replace(/[–—]/g, '-').replace(/[^\x20-\x7e]/g, '');

/** A one-page PDF with a title and a few lines (stands in for the sample documents' contents). */
function samplePdf(title, lines) {
  const stream = [title, ...lines].map((t, i) => `BT /F1 ${i ? 11 : 16} Tf 72 ${740 - i * 22} Td (${ascii(t).replace(/[\\()]/g, '\\$&')}) Tj ET`).join('\n');
  const objs = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 5 0 R /Resources << /Font << /F1 4 0 R >> >> >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
  let out = '%PDF-1.4\n';
  const offsets = objs.map((o, i) => { const at = out.length; out += `${i + 1} 0 obj\n${o}\nendobj\n`; return at; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  return `${out}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
}

const stamp = () => formatDateTime(new Date());
const FilterSelect = ({ label, value, onChange, options }) => (
  <select className="select" aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
    {options.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
  </select>
);
// communicationservice access codes <-> the labels the page shows
const ACCESS_CODES = { 'All staff': 'ALL_STAFF', 'Staff & parents': 'STAFF_AND_PARENTS', Public: 'PUBLIC', 'School administrators': 'ADMINISTRATORS' };
const accessLabel = (code) => Object.keys(ACCESS_CODES).find((k) => ACCESS_CODES[k] === code) || code;
const isoOfDaysAgo = (n) => { const d = new Date(`${todayIso()}T12:00:00`); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };

/**
 * Documents: the school document library in communicationservice (GET/POST /api/v1/communication/documents…).
 * When the service cannot be reached the page falls back to the sample library above, and changes last until the page is left.
 */
export function Documents() {
  const { user, hasRole } = useAuth();
  const schoolName = useSchoolName();
  const tenantId = user?.tenantId;
  const canManage = hasRole(...commApi.ROLES.documents);
  const [params, setParams] = useSearchParams();
  const liveFolders = useApi(() => commApi.listDocumentFolders(tenantId), [tenantId]);
  const liveDocs = useApi(() => commApi.listSchoolDocuments(tenantId), [tenantId]);
  const live = Array.isArray(liveFolders.data) && Array.isArray(liveDocs.data);
  const [sampleDocs, setSampleDocs] = useState(DOCS);
  const [sampleFolders, setSampleFolders] = useState(FOLDERS);
  const [sampleLog, setSampleLog] = useState({}); // doc id -> actions taken on the sample library, newest first

  const folders = live
    ? liveFolders.data.map((x) => ({ id: x.folderId, name: x.name, sub: x.summary || `${x.documentCount} document${x.documentCount === 1 ? '' : 's'}`, access: accessLabel(x.defaultAccess) }))
    : sampleFolders;
  const docs = live
    ? liveDocs.data.map((d) => ({
      id: d.documentId, folder: liveFolders.data.find((x) => x.folderId === d.folderId)?.name, name: d.fileName, owner: d.ownerName,
      modified: d.modifiedOn, access: accessLabel(d.accessLevel), size: sizeOf(d.sizeBytes), version: d.docVersion,
      shared: d.isShared, archived: d.isArchived, hasContent: d.hasContent,
    }))
    : sampleDocs;

  const [folder, setFolder] = useState(null); // folder name; null until chosen (the linked document's folder, else School policies)
  const [sel, setSel] = useState(params.get('doc'));
  const [tab, setTab] = useState(0);
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [access, setAccess] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null); // 'share' | 'manage' | 'history' | 'folder' | 'newfolder'
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);
  const uploadRef = useRef(null);

  const linked = docs.find((d) => d.id === params.get('doc'));
  const shownFolder = folder || linked?.folder || 'School policies';
  const current = folders.find((x) => x.name === shownFolder);
  const actor = user?.name || 'Staff member';
  const recordSample = (id, action) => setSampleLog((l) => ({ ...l, [id]: [[stamp(), actor, action], ...(l[id] || [])] }));
  const updateSample = (id, change) => setSampleDocs((all) => all.map((d) => (d.id === id ? { ...d, ...change } : d)));
  const filter = (fn) => (v) => { fn(v); setPage(1); };
  const reload = () => { liveFolders.reload(); liveDocs.reload(); };
  // Activity that belongs in the access history: the service's log when live, else this page's
  const record = (d, action, shared) => (live
    ? commApi.recordDocumentActivity(d.id, { actorName: actor, action, shared }).then(() => shared && liveDocs.reload()).catch(() => {})
    : (recordSample(d.id, action), shared && updateSample(d.id, { shared: true })));

  const recentFrom = isoOfDaysAgo(30);
  const inTab = [(d) => !d.archived, (d) => !d.archived && d.modified >= recentFrom, (d) => !d.archived && d.shared, (d) => d.archived][tab];
  const needle = q.trim().toLowerCase();
  const rows = docs
    .filter((d) => d.folder === shownFolder && inTab(d))
    .filter((d) => !needle || d.name.toLowerCase().includes(needle) || d.owner.toLowerCase().includes(needle))
    .filter((d) => (!type || typeOf(d.name) === type) && (!access || d.access === access))
    .sort((a, b) => (tab === 1 ? b.modified.localeCompare(a.modified) : 0));
  const pages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const at = Math.min(page, pages);
  const shown = rows.slice((at - 1) * PER_PAGE, at * PER_PAGE);
  const types = [...new Set(docs.filter((d) => d.folder === shownFolder).map((d) => typeOf(d.name)))].sort();
  const f = docs.find((d) => d.id === sel) || rows[0] || docs.find((d) => d.folder === shownFolder) || docs[0];

  const open = (d) => { setSel(d.id); setParams({ doc: d.id }, { replace: true }); };
  const pickFolder = (name) => { setFolder(name); setTab(0); setQ(''); setType(''); setAccess(''); setPage(1); setNotice(null); setError(null); };
  const download = async (d) => {
    setError(null);
    try {
      if (d.file) downloadFile(d.name, d.file, d.file.type);
      else if (live && d.hasContent) { const blob = await commApi.downloadSchoolDocument(d.id); downloadFile(d.name, blob, blob.type); }
      else if (typeOf(d.name) === 'Spreadsheet') downloadCsv(d.name.replace(/\.\w+$/, ''), ['Item', 'Owner', 'Updated'], [[d.name, d.owner, formatDate(d.modified)]]);
      else downloadFile(d.name, samplePdf(d.name.replace(/\.\w+$/, ''), [`${schoolName} · 2026-2027`, `Owner: ${d.owner}`, `Version ${d.version}`, `Access: ${d.access}`]), 'application/pdf');
      record(d, 'Downloaded');
    } catch (e) { setError(e); }
  };
  const upload = async (files) => {
    const list = [...files];
    if (!list.length) return;
    setError(null);
    const defaultAccess = current?.access || 'All staff';
    try {
      let added;
      if (live) {
        added = [];
        for (const file of list) added.push(await commApi.uploadSchoolDocument(current.id, file, user?.userId, actor));
        reload();
        added = added.map((d) => ({ id: d.documentId, name: d.fileName }));
      } else {
        added = list.map((file, i) => doc(`up-${Date.now()}-${i}`, shownFolder, file.name, actor, todayIso(), defaultAccess, sizeOf(file.size), { file }));
        setSampleDocs((all) => [...added, ...all]);
        added.forEach((d) => recordSample(d.id, 'Uploaded version 1.0'));
      }
      pickFolder(shownFolder);
      open(added[0]);
      setNotice(`${added.length === 1 ? `“${added[0].name}”` : `${added.length} files`} added to ${shownFolder} (${defaultAccess.toLowerCase()} can view).`);
    } catch (e) { setError(e); }
  };
  const saveAccess = async (a) => {
    if (live) await commApi.changeDocumentAccess(f.id, { accessLevel: ACCESS_CODES[a], actorName: actor });
    else { updateSample(f.id, { access: a }); recordSample(f.id, `Access changed to ${a}`); }
    if (live) liveDocs.reload();
    setNotice(`“${f.name}” is now visible to ${a.toLowerCase()}.`); setModal(null);
  };
  const saveFolder = async (x) => {
    if (live) { await commApi.updateDocumentFolder(current.id, { tenantId, defaultAccess: ACCESS_CODES[x.access] }); liveFolders.reload(); }
    else setSampleFolders((all) => all.map((y) => (y.name === shownFolder ? { ...y, ...x } : y)));
    setNotice(`New files in ${shownFolder} will be visible to ${x.access.toLowerCase()}.`); setModal(null);
  };
  const createFolder = async (x) => {
    if (live) { await commApi.createDocumentFolder({ tenantId, name: x.name, defaultAccess: ACCESS_CODES[x.access] }); liveFolders.reload(); }
    else setSampleFolders((all) => [...all, x]);
    pickFolder(x.name); setNotice(`Folder “${x.name}” created.`); setModal(null);
  };
  const manageTitle = canManage ? undefined : 'Only school administrators, principals and communication staff can change documents';

  return (
    <>
      <PageHeader
        title="Documents"
        desc="Organise school files, control access and keep essential records easy to find."
        actions={[
          { label: 'New folder', onClick: () => setModal('newfolder'), disabled: !canManage, title: manageTitle },
          { label: 'Upload files', icon: <Upload size={15} />, primary: true, onClick: () => uploadRef.current?.click(), disabled: !canManage || (live && !current), title: manageTitle },
        ]}
        context
      />
      <input ref={uploadRef} type="file" multiple hidden onChange={(e) => { upload(e.target.files); e.target.value = ''; }} />
      {!live && (liveFolders.error || liveDocs.error) && <ApiNote>Showing sample documents: the document library could not be loaded ({(liveFolders.error || liveDocs.error).detail}).</ApiNote>}
      <div className="grid4">
        {folders.map((x) => (
          <button type="button" key={x.name} className="card" aria-pressed={x.name === shownFolder} onClick={() => pickFolder(x.name)}
            style={{ textAlign: 'left', borderColor: x.name === shownFolder ? 'var(--pr)' : undefined }}>
            <div className="row" style={{ justifyContent: 'flex-start', gap: 12 }}><div className="sym" style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--tint)', color: 'var(--pr)', display: 'grid', placeItems: 'center' }}><Folder size={16} /></div>
              <div><b style={{ fontSize: 13 }}>{x.name}</b><div className="xs muted">{x.sub || `${docs.filter((d) => d.folder === x.name && !d.archived).length} documents`}</div></div></div>
          </button>
        ))}
      </div>
      {notice && <div className="api-note ok"><Check size={14} style={{ flex: 'none' }} /><span>{notice}</span></div>}
      {error && <ApiErr error={error} />}
      <div className="cols s354">
        <Card style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="sh"><div><h3>{shownFolder}</h3><p>School documents / {shownFolder}</p></div>
            <button type="button" className="link" onClick={() => setModal('folder')} disabled={!canManage || !current} title={manageTitle}>Folder settings</button></div>
          <Tabs items={['All files', 'Recent', 'Shared with me', 'Archived']} value={tab} onChange={filter(setTab)} />
          <div className="filters">
            <SearchBox placeholder="Search file name or owner" width={300} value={q} onChange={filter(setQ)} />
            <FilterSelect label="File type" value={type} onChange={filter(setType)} options={[['', 'All file types'], ...types.map((t) => [t, t])]} />
            <FilterSelect label="Permissions" value={access} onChange={filter(setAccess)} options={[['', 'All permissions'], ...ACCESS.map((a) => [a, a])]} />
          </div>
          <div className="tablebox">
            <DataTable cols={[
              { label: 'Name', render: (r) => <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><FileText size={16} style={{ color: 'var(--pr)' }} /><b style={{ fontWeight: r.id === f?.id ? 600 : 500 }}>{r.name}</b></span> },
              { label: 'Owner', key: 'owner' }, { label: 'Modified', render: (r) => formatDate(r.modified) }, { label: 'Access', key: 'access' }, { label: 'Size', key: 'size' },
              { label: 'Action', render: (r) => <button type="button" className="act" onClick={() => open(r)}>Open</button> },
            ]} rows={shown} />
            {!rows.length && <p className="xs muted" style={{ padding: 16 }}>{liveDocs.loading && !live ? 'Loading…' : 'No documents match these filters.'}</p>}
            <Pager text={rows.length ? `Showing ${(at - 1) * PER_PAGE + 1}–${(at - 1) * PER_PAGE + shown.length} of ${rows.length} document${rows.length === 1 ? '' : 's'}` : 'No documents'}
              page={at} pages={pages} onPage={setPage} />
          </div>
        </Card>
        {f && (
          <div className="stack">
            <Card>
              <h3 style={{ fontSize: 15, fontWeight: 600 }}>Document details</h3>
              <p className="small muted" style={{ marginTop: 4 }}>{f.name}</p>
              <div style={{ margin: '16px 0', border: '1px solid var(--bd)', borderRadius: 8, padding: 24, background: 'var(--sb)', textAlign: 'center' }}>
                <FileText size={28} style={{ color: 'var(--pr)' }} /><b style={{ display: 'block', margin: '8px 0 2px', fontSize: 12 }}>{schoolName}</b><span className="xs muted">{f.name.replace(/\.\w+$/, '')}<br />2026–2027</span>
              </div>
              <KV rows={[['File type', typeOf(f.name)], ['Size', f.size], ['Owner', f.owner], ['Modified', formatDate(f.modified)], ['Version', `${f.version} · ${f.archived ? 'Archived' : 'Current'}`]]} />
              <div className="actions" style={{ marginTop: 14 }}>
                <button className="btn primary" onClick={() => download(f)}><Download size={14} />Download</button>
                <button className="btn" onClick={() => setModal('share')}>Share</button>
              </div>
            </Card>
            <Card>
              <SectionHead title="Permissions" link={canManage ? 'Manage →' : undefined} onClick={() => setModal('manage')} />
              <div className="pills" style={{ margin: '14px 0 10px', flexDirection: 'column', alignItems: 'flex-start' }}>
                <Pill tone="purple">{f.access} · Can view</Pill>{f.access !== 'School administrators' && <Pill>School administrators · Can edit</Pill>}
              </div>
              <p className="body-s">{f.access === 'Public' ? 'Anyone with the link can view this file.' : 'External access is disabled. Shared links only open for people who already have access.'}</p>
              <button type="button" className="link" style={{ marginTop: 12 }} onClick={() => setModal('history')}>View access history →</button>
            </Card>
          </div>
        )}
      </div>
      <Card className="notice" style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <ShieldCheck size={18} style={{ color: 'var(--pr)' }} />
        <div><h4>Secure by default</h4><p>Student and staff records are restricted to authorised teams. Shared links respect existing permissions and access is logged.</p></div>
      </Card>
      {modal === 'share' && <ShareModal d={f} onClose={() => setModal(null)} onShared={(how) => record(f, how, true)} />}
      {modal === 'manage' && <AccessModal d={f} onClose={() => setModal(null)} onSave={saveAccess} />}
      {modal === 'history' && <HistoryModal d={f} live={live} sample={sampleLog[f.id] || []} onClose={() => setModal(null)} />}
      {modal === 'folder' && <FolderModal folder={current} onClose={() => setModal(null)} onSave={saveFolder} />}
      {modal === 'newfolder' && <FolderModal taken={folders.map((x) => x.name.toLowerCase())} onClose={() => setModal(null)} onSave={createFolder} />}
      <Footer />
    </>
  );
}

/** Runs a modal's save; a failure stays in the modal. */
function useSave(fn) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const run = async (...args) => {
    setBusy(true); setError(null);
    try { await fn(...args); } catch (e) { setError(e); } finally { setBusy(false); }
  };
  return { busy, error, run };
}

function ShareModal({ d, onClose, onShared }) {
  const link = `${window.location.origin}/documents?doc=${encodeURIComponent(d.id)}`;
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); } catch { /* clipboard blocked: the link stays selectable */ }
    setCopied(true); onShared('Share link copied');
  };
  const email = () => { onShared('Shared by email'); window.location.href = `mailto:?subject=${encodeURIComponent(d.name)}&body=${encodeURIComponent(link)}`; };
  return (
    <Modal title="Share" sub={d.name} onClose={onClose}
      footer={<><button className="btn" onClick={email}>Email link</button><button className="btn primary" onClick={copy}>{copied ? <Check size={14} /> : null}{copied ? 'Copied' : 'Copy link'}</button></>}>
      <div className="field box"><label htmlFor="share-link">LINK</label><input id="share-link" readOnly value={link} onFocus={(e) => e.target.select()} /></div>
      <p className="xs muted" style={{ marginTop: 12 }}>Only people who can already view this file can open the link ({d.access.toLowerCase()}). Change who can view it under Permissions → Manage.</p>
    </Modal>
  );
}

function AccessModal({ d, onClose, onSave }) {
  const [a, setA] = useState(d.access);
  const save = useSave(onSave);
  return (
    <Modal title="Manage permissions" sub={d.name} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={a === d.access || save.busy} onClick={() => save.run(a)}>Save</button></>}>
      <div className="field box"><label htmlFor="doc-access">CAN VIEW</label>
        <select id="doc-access" value={a} onChange={(e) => setA(e.target.value)}>{ACCESS.map((x) => <option key={x}>{x}</option>)}</select></div>
      <p className="xs muted" style={{ marginTop: 12 }}>School administrators can always edit. Changes are recorded in the access history.</p>
      {save.error && <ApiErr error={save.error} />}
    </Modal>
  );
}

function HistoryModal({ d, live, sample, onClose }) {
  const log = useApi(() => commApi.getDocumentAccessLog(d.id), [d.id], live);
  const rows = live
    ? (log.data || []).map((l) => [formatDateTime(l.occurredAt), l.actorName, l.action])
    : [...sample, [formatDate(d.modified), d.owner, `Uploaded version ${d.version}`]];
  return (
    <Modal title="Access history" sub={d.name} onClose={onClose} footer={<button className="btn primary" onClick={onClose}>Done</button>}>
      {log.error ? <ApiErr error={log.error} />
        : live && !log.data ? <p className="xs muted">Loading…</p>
          : rows.length ? <DataTable boxed cols={[{ label: 'When', key: 0 }, { label: 'Who', key: 1 }, { label: 'Action', key: 2 }]} rows={rows} />
            : <p className="xs muted">No activity has been recorded for this file yet.</p>}
    </Modal>
  );
}

/** Folder settings (folder given) or a new folder (no folder). */
function FolderModal({ folder, taken = [], onClose, onSave }) {
  const [name, setName] = useState(folder?.name || '');
  const [a, setA] = useState(folder?.access || 'All staff');
  const save = useSave(onSave);
  const clash = !folder && taken.includes(name.trim().toLowerCase());
  return (
    <Modal title={folder ? 'Folder settings' : 'New folder'} sub={folder ? folder.name : 'School documents'} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={!name.trim() || clash || save.busy} onClick={() => save.run(folder ? { access: a } : { name: name.trim(), access: a })}>{folder ? 'Save' : 'Create folder'}</button></>}>
      {!folder && <div className="field box"><label htmlFor="folder-name">FOLDER NAME *</label><input id="folder-name" autoFocus maxLength={150} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Governors' minutes" /></div>}
      {clash && <p className="xs" style={{ color: 'var(--rd)', marginTop: 6 }}>A folder with this name already exists.</p>}
      <div className="field box"><label htmlFor="folder-access">NEW FILES CAN BE VIEWED BY</label>
        <select id="folder-access" value={a} onChange={(e) => setA(e.target.value)}>{ACCESS.map((x) => <option key={x}>{x}</option>)}</select></div>
      {save.error && <ApiErr error={save.error} />}
    </Modal>
  );
}

/* ---------- Settings ---------- */
let regionalSavedAt = 0;
const zoneLabel = (zone) => `${zone.replace(/_/g, ' ')} · ${zoneName(zone, 'short')}`;
const currencySymbol = (code) => { try { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol' }).format(0).replace(/[\d.,\s]/g, ''); } catch { return code; } };

// Roles allowed to save the school's regional preferences (PUT /api/v1/tenants/{tenantId}/regional-settings)
export const REGIONAL_EDITORS = ['SUPER_ADMIN', 'TRUSTEE', 'SCHOOL_PRINCIPAL', 'PRINCIPAL', 'IT_SYSTEM_ADMIN'];

/**
 * Settings → General → Regional preferences: time zone, currency, date format and language, with a live preview.
 * Saved for the whole school through authservice; users without an editor role see the values read-only.
 */
function RegionalCard({ draft, setDraft, onSave, onDiscard, canEdit, saving, error }) {
  const set = (k) => (e) => setDraft({ ...draft, [k]: e.target.value });
  const changed = version(draft) !== version(getRegional());
  const justSaved = Date.now() - regionalSavedAt < 8000;
  // Preview with the draft values (the helpers read the saved preferences, so format here directly)
  const now = new Date();
  let preview = '';
  try {
    const time = new Intl.DateTimeFormat(draft.language, { timeZone: draft.timeZone, hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }).format(now);
    const amount = new Intl.NumberFormat(draft.language, { style: 'currency', currency: draft.currency }).format(125000.5);
    const example = DATE_FORMATS.find(([f]) => f === draft.dateFormat)?.[1];
    preview = `${example} · ${time} · ${amount}`;
  } catch { preview = ''; }
  const sel = (id, label, key, options) => (
    <div className="field box"><label htmlFor={id}>{label}</label>
      <select id={id} value={draft[key]} onChange={set(key)} disabled={!canEdit}>{options.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></div>
  );
  return (
    <Card>
      <h3 style={{ fontSize: 15, fontWeight: 600 }}>Regional preferences</h3>
      <p className="small muted" style={{ marginTop: 4 }}>Applied to every date, time and amount across the app for everyone at this school.</p>
      <div className="fieldlist">
        {sel('rp-zone', 'TIME ZONE', 'timeZone', TIME_ZONES.map(([z, place]) => [z, `${zoneLabel(z)} — ${place}`]))}
        {sel('rp-currency', 'CURRENCY', 'currency', CURRENCIES.map(([c, n]) => [c, `${c} · ${n} (${currencySymbol(c)})`]))}
        {sel('rp-date', 'DATE FORMAT', 'dateFormat', DATE_FORMATS.map(([f, ex]) => [f, `${f} — ${ex}`]))}
        {sel('rp-lang', 'LANGUAGE (DATES & NUMBERS)', 'language', LANGUAGES)}
      </div>
      <div className="api-note" style={{ marginTop: 12 }}><span><b>Preview</b> · {preview}</span></div>
      <p className="xs muted" style={{ marginTop: 8 }}>Changing the currency changes how amounts are shown, not their value: fees stay as billed. Screens stay in English; the language sets month names and number grouping.</p>
      {justSaved && !changed && <div className="api-note ok" style={{ marginTop: 10 }}><Check size={14} style={{ flex: 'none' }} /><span>Saved. The whole app now uses these settings for everyone at this school.</span></div>}
      {error && <div className="api-error" role="alert" style={{ marginTop: 10 }}><span>Could not save: {error}</span></div>}
      {canEdit ? (
        <div className="pills" style={{ marginTop: 12 }}>
          <button className="btn" disabled={!changed || saving} onClick={onDiscard}>Discard</button>
          <button className="btn primary" disabled={!changed || saving} onClick={onSave}><Check size={14} />{saving ? 'Saving…' : 'Save preferences'}</button>
          <button className="btn" disabled={saving} onClick={() => setDraft({ ...DEFAULT_REGIONAL })}>Reset to defaults</button>
        </div>
      ) : (
        <p className="xs muted" style={{ marginTop: 12 }}>Only a principal, trustee or administrator can change these settings.</p>
      )}
    </Card>
  );
}

// One section per tab; the tab is kept in the URL (/settings?tab=academic) so it survives reloads and can be linked to.
const SETTINGS_TABS = [
  ['general', 'General'], ['academic', 'Academic setup'], ['users', 'Users & permissions'],
  ['notifications', 'Notifications'], ['security', 'Security & audit'], ['integrations', 'Integrations'], ['import', 'Data import'],
];

export function Settings() {
  const [params, setParams] = useSearchParams();
  const { user, hasRole } = useAuth();
  // Data import is shown to the roles that may bulk-import students or staff
  const tabs = SETTINGS_TABS.filter(([key]) => key !== 'import' || canImportData(hasRole));
  const index = Math.max(0, tabs.findIndex(([key]) => key === params.get('tab')));
  const tab = tabs[index][0];
  const setTab = (i) => setParams(i === 0 ? {} : { tab: tabs[i][0] }, { replace: true });
  // Regional preferences: edited here, applied to the whole app on Save (the page re-renders with them)
  const canEditRegional = hasRole(...REGIONAL_EDITORS);
  const [regional, setRegional] = useState(getRegional);
  const [regionalSaving, setRegionalSaving] = useState(false);
  const [regionalError, setRegionalError] = useState('');
  const saveRegional = async () => {
    setRegionalSaving(true);
    setRegionalError('');
    try {
      const saved = await saveRegionalSettings(user.tenantId, regional);
      regionalSavedAt = Date.now();
      applyServerRegional(saved); // the page re-renders (and this form remounts) with the saved values
    } catch (e) {
      setRegionalError(e.detail || e.message);
    }
    setRegionalSaving(false);
  };
  const regionalChanged = version(regional) !== version(getRegional());

  return (
    <>
      <PageHeader
        title="Settings"
        desc="Manage your school profile, academic setup and workspace preferences."
      />
      <Tabs items={tabs.map(([, label]) => label)} value={index} onChange={setTab} />

      {/* Each card saves itself: school profile (authservice), regional preferences (authservice) */}
      {tab === 'general' && (
        <div className="cols s404">
          <div className="stack">
            <SchoolProfileCard />
          </div>
          <div className="stack">
            <RegionalCard draft={regional} setDraft={setRegional} onSave={saveRegional} onDiscard={() => { setRegional(getRegional()); setRegionalError(''); }}
              canEdit={canEditRegional} saving={regionalSaving} error={regionalError} />
          </div>
        </div>
      )}

      {/* studentservice: GET /api/v1/academic/calendar, PUT /api/v1/academic/sessions/{id}[/terms] */}
      {tab === 'academic' && <div className="stack"><AcademicSetupCard /><ClassStructureCard /></div>}

      {/* authservice: GET /api/v1/roles, GET|POST /api/v1/roles/{roleId}/permissions */}
      {tab === 'users' && <div className="stack"><RolesCard /></div>}

      {/* communicationservice: GET|PUT /api/v1/communication/staff-alerts/preferences */}
      {tab === 'notifications' && <div className="stack"><AlertPreferencesCard /></div>}

      {/* authservice: GET /api/v1/mfa/config, GET /api/v1/security/session-config, GET /api/v1/audit/logs */}
      {tab === 'security' && <div className="stack"><SecurityCard /></div>}

      {tab === 'import' && <DataImportCard />}
      {tab === 'integrations' && (
        <div className="stack">
          <Card>
            <div className="cardhead"><h3>Integrations</h3><p>Connect payment gateways, SMS providers and other systems.</p></div>
            <p className="body-s muted" style={{ marginTop: 12 }}>No integrations are configured for this school yet. API tokens for third-party systems are issued by authservice (US-00007) and will be managed here.</p>
          </Card>
        </div>
      )}
      <Footer />
    </>
  );
}

/* ---------- Help ---------- */
export { Help } from '../components/HelpCenter.jsx';
