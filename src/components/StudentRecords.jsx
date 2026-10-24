import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { LoaderCircle, Plus, FileCheck2, ShieldAlert, Upload, FileText, Download, HeartPulse, Minus } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { useApi } from '../api/useApi.js';
import * as studentApi from '../api/studentService.js';
import { DataTable, Person, Pill, KV, Actions, Pager, FilterChips, SearchBox, useSort, sortRows, avatarTone, SkeletonTable, EmptyState, Card, SectionHead, downloadCsv, downloadFile } from './ui.jsx';
import { Modal } from './AuthSettings.jsx';
import { ApiErr, ApiNote } from './Admissions.jsx';
import { formatDate, formatDateTime, formatTime, formatNumber } from '../regional.js';

const { ROLES, STUDENT_STATUS, LEFT_STATUSES, fullName, classLabel } = studentApi;
export const Loading = () => <p className="xs muted"><LoaderCircle size={12} className="spin" /> Loading…</p>;
export const fmtDate = (d) => formatDate(d);
const label = (code) => (code || '').toLowerCase().split('_').map((w) => (w ? w[0].toUpperCase() + w.slice(1) : '')).join(' ');
export const statusPill = (status) => {
  const [text, tone] = STUDENT_STATUS[status] || [label(status), ''];
  // Students who have left (archived) get a dash; everyone else gets the icon for their tone
  return <Pill tone={tone} icon={LEFT_STATUSES.includes(status) ? Minus : undefined}>{text}</Pill>;
};
/** Nursery, LKG, UKG, Class 1 … Class 12 */
const gradeRank = (name) => {
  const i = ['Nursery', 'LKG', 'UKG'].indexOf(name);
  const m = String(name || '').match(/(\d+)/);
  return i >= 0 ? i : m ? 3 + Number(m[1]) : 99;
};
const byClass = (a, b) => gradeRank(a.gradeName) - gradeRank(b.gradeName) || String(a.sectionName).localeCompare(String(b.sectionName))
  || (a.rollNumber ?? 999) - (b.rollNumber ?? 999) || fullName(a).localeCompare(fullName(b));
/** medicalAlerts holds real alerts. Staff write "None", "None; None", "Nil" or "No known allergies" when there are none. */
export const isNoneText = (text) => {
  // Keep only letters, so "None; None." and "None, nil" compare the same as "None"
  const words = String(text || '').replace(/[^a-z]/gi, '').toLowerCase();
  return words === '' || /^(none|nil|na|nokn(own)?(allergies|conditions)?)+$/.test(words);
};
/** A medical alert: conditions or allergies that are not "None". */
export const hasAlert = (s) => !!s && (!isNoneText(s.medicalAlerts) || !isNoneText(s.allergies));
/** Missing a guardian, emergency phone or blood group (the "Record health" card). */
export const isIncomplete = (s) => !s.guardians?.length || !s.emergencyContactPhone || !s.bloodGroup;
/** Start of the current academic year (1 April, as the DPS sessions run April–March). */
const yearStart = () => { const d = new Date(); return new Date(d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1, 3, 1); };

/**
 * Student master records of the active campus: GET /api/v1/students?tenantId=&branchId= (US-03000).
 * `current` are students on roll, `left` transferred or graduated ones (the Archived tab).
 */
export function useStudents() {
  const { user, hasRole, branchId } = useAuth();
  const canRead = hasRole(...ROLES.list);
  const enabled = canRead && !!user?.tenantId && !!branchId;
  const res = useApi(() => studentApi.listStudents(user.tenantId, branchId), [user?.tenantId, branchId], enabled);
  const rows = (res.data || []).slice().sort(byClass);
  const current = rows.filter((s) => !LEFT_STATUSES.includes(s.studentStatus));
  const since = yearStart();
  return {
    ...res, rows, current,
    left: rows.filter((s) => LEFT_STATUSES.includes(s.studentStatus)),
    incomplete: current.filter(isIncomplete),
    newThisYear: current.filter((s) => s.createdAt && new Date(s.createdAt) >= since),
    classCount: new Set(current.filter((s) => s.sectionId).map((s) => s.sectionId)).size,
    canRead, missingBranch: canRead && !branchId,
    live: enabled && !!res.data,
  };
}

/** "Export list": the loaded rows as a CSV download (no export endpoint exists). */
export function exportStudentsCsv(rows, name = 'students') {
  const cols = [['Student UID', (s) => s.studentUid], ['First name', (s) => s.firstName], ['Last name', (s) => s.lastName],
    ['Class', classLabel], ['Roll no.', (s) => s.rollNumber ?? ''], ['House', (s) => s.houseName || ''],
    ['Date of birth', (s) => s.dateOfBirth], ['Gender', (s) => label(s.gender)], ['Blood group', (s) => s.bloodGroup || ''],
    ['Primary guardian', (s) => s.guardians?.[0]?.fullName || ''], ['Guardian phone', (s) => s.guardians?.[0]?.mobileNumber || ''],
    ['Status', (s) => (STUDENT_STATUS[s.studentStatus] || [s.studentStatus])[0]]];
  downloadCsv(name, cols.map(([h]) => h), rows.map((s) => cols.map(([, f]) => f(s))));
}

/** Students → All students / Archived tab. */
const VIEWS_KEY = 'oakridge.studentViews';
/** Saved views live in this browser only (a per-viewer convenience, not shared data). */
const readViews = () => { try { return JSON.parse(localStorage.getItem(VIEWS_KEY) || '[]'); } catch { return []; } };
const writeViews = (v) => { try { localStorage.setItem(VIEWS_KEY, JSON.stringify(v)); } catch { /* storage unavailable */ } };

export function StudentsTable({ list, archived, only = '', onSetOnly, onClearOnly }) {
  const [q, setQ] = useState('');
  const [klass, setKlass] = useState('');
  const [section, setSection] = useState('');
  const [house, setHouse] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [views, setViews] = useState(readViews);
  const [naming, setNaming] = useState(null); // name typed for a new saved view, or null
  const sort = useSort();
  if (!list.canRead) return <ApiNote>Student records are visible to registrars, office clerks, class teachers, principals, school nurses and super administrators.</ApiNote>;
  if (list.missingBranch) return <ApiNote>Select a campus to see its students.</ApiNote>;
  if (list.loading) return <SkeletonTable cols={['Student', 'Class', 'House', 'Primary guardian', 'Medical', 'Status', 'Actions']} />;
  if (list.error) return <ApiErr error={list.error} onRetry={list.reload} />;
  const all = archived ? list.left : list.current;
  const opts = (f) => [...new Set(all.map(f).filter(Boolean))];
  const classes = opts((s) => s.gradeName).sort((a, b) => gradeRank(a) - gradeRank(b));
  const onlyLabel = { incomplete: 'Incomplete records', new: 'Enrolled this year', medical: 'Medical alerts' }[only];
  const inOnly = only === 'incomplete' ? new Set(list.incomplete) : only === 'new' ? new Set(list.newThisYear)
    : only === 'medical' ? new Set(all.filter(hasAlert)) : null;
  // Sections offered depend on the class: none until a class is chosen
  const sections = klass ? [...new Set(all.filter((s) => s.gradeName === klass).map((s) => s.sectionName).filter(Boolean))].sort() : [];
  const rows = all.filter((s) => (!inOnly || inOnly.has(s)) && (!klass || s.gradeName === klass) && (!section || s.sectionName === section) && (!house || s.houseName === house)
    && `${fullName(s)} ${s.studentUid} ${(s.guardians || []).map((g) => g.fullName).join(' ')}`.toLowerCase().includes(q.toLowerCase()));
  // A filter or search change goes back to page 1
  const PAGE = pageSize;
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const current = Math.min(page, pages);
  // Sorted before paging, so the page shows the first rows of the sorted list
  const cols = [
    { label: 'Student', sortBy: (s) => fullName(s), render: (s) => (
      <>
        <StudentAvatar student={s} className="avatar-sm" tone={avatarTone(s.gradeName)} />
        <span className="cell-id"><b>{fullName(s)}</b><small>{s.studentUid}</small></span>
      </>
    ) },
    { label: 'Class', sortBy: (s) => classLabel(s), render: (s) => <span className="cell-id"><b>{classLabel(s)}</b><small>{s.rollNumber ? `Roll no. ${s.rollNumber}` : '—'}</small></span> },
    { label: 'House', hideOnCards: true, render: (s) => s.houseName || '—' },
    { label: 'Primary guardian', hideOnCards: true, render: (s) => (s.guardians?.[0]
      ? <span className="cell-id"><b>{s.guardians[0].fullName}</b><small>{s.guardians[0].relationship} · {s.guardians[0].mobileNumber}</small></span> : '—') },
    { label: 'Medical', hideOnCards: true, render: (s) => (hasAlert(s) ? <span title={s.medicalAlerts}><Pill tone="amber" icon={HeartPulse}>Medical alert</Pill></span> : <span className="muted">—</span>) },
    { label: 'Status', sortBy: (s) => (isIncomplete(s) && !archived ? 'Needs update' : s.studentStatus), render: (s) => (isIncomplete(s) && !archived ? <Pill tone="amber">Needs update</Pill> : statusPill(s.studentStatus)) },
    { label: 'Actions', render: (s) => (
      <Actions><Link to={`/students/${s.studentId}`}>View profile</Link>{!archived && <Link to={`/students/${s.studentId}/edit`}>Edit</Link>}</Actions>
    ) },
  ];
  const shown = sortRows(rows, cols, sort).slice((current - 1) * PAGE, current * PAGE);
  const pick = (value, set, all, choices, disabled, title) => (
    <select className="select" value={value} disabled={disabled} title={disabled ? title : undefined} onChange={(e) => { set(e.target.value); setPage(1); }} aria-label={all}>
      <option value="">{all}</option>{choices.map((c) => <option key={c}>{c}</option>)}
    </select>
  );
  const setClass = (v) => { setKlass(v); setSection(''); setPage(1); };
  // Saved views: a set of filters kept in this browser
  const now = { klass, section, house, q: q.trim(), only };
  const sameAs = (v) => ['klass', 'section', 'house', 'q', 'only'].every((k) => (v[k] || '') === (now[k] || ''));
  const apply = (v) => { setKlass(v.klass || ''); setSection(v.section || ''); setHouse(v.house || ''); setQ(v.q || ''); setPage(1); onSetOnly?.(v.only || ''); };
  const saveView = () => {
    const name = naming.trim();
    if (!name) return;
    const next = [...views, { id: Date.now().toString(36), name, ...now }];
    setViews(next); writeViews(next); setNaming(null);
  };
  const deleteView = (id) => { const next = views.filter((v) => v.id !== id); setViews(next); writeViews(next); };
  const chips = [
    q.trim() && [`Search: “${q.trim()}”`, () => { setQ(''); setPage(1); }],
    onlyLabel && [onlyLabel, onClearOnly],
    klass && [klass, () => setClass('')],
    section && [`Section ${section}`, () => { setSection(''); setPage(1); }],
    house && [`House: ${house}`, () => { setHouse(''); setPage(1); }],
  ].filter(Boolean);
  const clearAll = () => { setQ(''); setKlass(''); setSection(''); setHouse(''); setPage(1); if (onlyLabel) onClearOnly(); };
  return (
    <>
      <div className="filters">
        <SearchBox placeholder="Search name, student ID or guardian" value={q} onChange={(v) => { setQ(v); setPage(1); }} />
        <select className="select" value={klass} onChange={(e) => setClass(e.target.value)} aria-label="All classes">
          <option value="">All classes</option>{classes.map((c) => <option key={c}>{c}</option>)}
        </select>
        {pick(section, setSection, 'All sections', sections, !klass, 'Choose a class first')}
        {pick(house, setHouse, 'All houses', opts((s) => s.houseName).sort())}
      </div>
      <FilterChips chips={chips} onClear={clearAll}
        save={!archived && naming === null && chips.length > 0 ? <button type="button" className="link" onClick={() => setNaming('')}>Save this view</button>
          : !archived && naming !== null ? (
            <form className="viewsave" onSubmit={(e) => { e.preventDefault(); saveView(); }}>
              <input autoFocus value={naming} maxLength={40} placeholder="e.g. Class 6-A" aria-label="Saved view name" onChange={(e) => setNaming(e.target.value)} />
              <button type="submit" className="btn primary" disabled={!naming.trim()}>Save</button>
              <button type="button" className="btn" onClick={() => setNaming(null)}>Cancel</button>
            </form>
          ) : null}
        end={!archived && views.length > 0 ? views.map((v) => (
          <span key={v.id} className="viewchip own" aria-pressed={sameAs(v)}>
            <button type="button" onClick={() => apply(v)}>{v.name}</button>
            <button type="button" className="x" aria-label={`Delete saved view ${v.name}`} onClick={() => deleteView(v.id)}>✕</button>
          </span>
        )) : null} />
      {!all.length
        ? (archived
          ? <EmptyState title="No archived students">Transferred and graduated students for this campus will appear here.</EmptyState>
          : <EmptyState title="No students on roll yet" action={<Link className="btn primary" to="/students/new">Add student</Link>}>Enrol the first student to build this campus's directory.</EmptyState>)
        : !rows.length
          ? (
            <EmptyState title="No students match" action={<button type="button" className="btn" onClick={clearAll}>Clear filters</button>}>
              Try a different search or remove a filter. {formatNumber(all.length)} students in total.
            </EmptyState>
          ) : (
          <div className="tablebox">
            <DataTable
              cols={cols}
              sort={sort}
              cards
              rows={shown}
            />
            <Pager page={current} pages={pages} onPage={setPage} pageSize={pageSize} onPageSize={(n) => { setPageSize(n); setPage(1); }}
              text={rows.length
                ? `Showing ${(current - 1) * PAGE + 1}–${(current - 1) * PAGE + shown.length} of ${rows.length} student${rows.length === 1 ? '' : 's'}${rows.length < all.length ? ` (filtered from ${all.length})` : ''}`
                : `No students match · ${all.length} in total`} />
          </div>
        )}
    </>
  );
}

/** One student: GET /api/v1/students/{id} (US-03000), plus whether the role may open it at all. */
export function useStudentRecord(id, enabled = true) {
  const { hasRole } = useAuth();
  const canView = hasRole(...ROLES.view);
  const res = useApi(() => studentApi.getStudent(id), [id], enabled && canView);
  return { ...res, canView };
}

/* ---------- photo and documents ---------- */

/** Round avatar: the stored photo (GET …/photo/file with the token) or the initials. `tone` sets the initials' colours. */
export function StudentAvatar({ student, name, className = 'bigavatar', tone }) {
  const [src, setSrc] = useState(null);
  const hasPhoto = student?.profilePhotoUrl?.startsWith('vault:');
  useEffect(() => {
    // A photo URL set through US-03014's POST /{id}/photo is shown as it is; stored files are fetched with the token
    if (!hasPhoto) { setSrc(/^https?:\/\//.test(student?.profilePhotoUrl || '') ? student.profilePhotoUrl : null); return undefined; }
    let url = null;
    let alive = true;
    studentApi.photoBlob(student.studentId).then((b) => { url = URL.createObjectURL(b); if (alive) setSrc(url); }).catch(() => setSrc(null));
    return () => { alive = false; if (url) URL.revokeObjectURL(url); };
  }, [student?.studentId, student?.profilePhotoUrl]);
  const initials = (name || fullName(student)).split(' ').map((w) => w[0]).join('').slice(0, 2);
  const style = tone && !src ? { background: tone[0], color: tone[1] } : undefined;
  return <div className={className + (src ? ' has-photo' : '')} style={style}>{src ? <img src={src} alt={`Photo of ${name || fullName(student)}`} className="avatar-img" /> : initials}</div>;
}

/** Edit student → Change photo: POST …/photo/upload (JPEG or PNG, 5 MB). */
export function PhotoButton({ student, onUploaded }) {
  const { hasRole } = useAuth();
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const allowed = hasRole(...ROLES.photo);
  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png'].includes(file.type)) { setError({ detail: 'Choose a JPG or PNG image.' }); return; }
    if (file.size > 5 * 1024 * 1024) { setError({ detail: 'The photo is larger than 5 MB.' }); return; }
    setBusy(true); setError(null);
    try { onUploaded(await studentApi.uploadPhoto(student.studentId, file)); } catch (err) { setError(err); } finally { setBusy(false); }
  };
  return (
    <div>
      <button type="button" className="btn" disabled={!allowed || busy} title={allowed ? 'Upload a JPG or PNG photo' : 'Photos are changed by the registrar or office clerk'}
        onClick={() => input.current.click()}>
        {busy ? <LoaderCircle size={15} className="spin" /> : <Upload size={15} />}{student.profilePhotoUrl ? 'Change photo' : 'Upload photo'}
      </button>
      <input ref={input} type="file" accept="image/jpeg,image/png" hidden onChange={pick} />
      <small>{allowed ? 'JPG or PNG · Maximum 5 MB' : 'Changed by the registrar or office clerk'}</small>
      {error && <div style={{ marginTop: 6 }}><ApiErr error={error} /></div>}
    </div>
  );
}

const typeLabel = (t) => (studentApi.DOCUMENT_TYPES.find(([k]) => k === t) || [t, label(t)])[1];
const sizeLabel = (n) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
async function download(doc) {
  downloadFile(doc.originalFileName, await studentApi.documentBlob(doc), doc.contentType);
}

/** Files on the student's record (GET …/documents) with download links, and the upload form when the role may upload. */
export function StudentDocuments({ student, upload = true }) {
  const { hasRole } = useAuth();
  const docs = useApi(() => studentApi.listDocuments(student.studentId), [student.studentId], hasRole(...ROLES.view));
  const canUpload = upload && hasRole(...ROLES.uploadDocument);
  const [type, setType] = useState('BIRTH_CERTIFICATE');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState('');
  const fileInput = useRef(null);
  const send = async () => {
    if (!file) { setError({ detail: 'Choose a PDF, JPG or PNG file.' }); return; }
    if (file.size > 10 * 1024 * 1024) { setError({ detail: 'The file is larger than 10 MB.' }); return; }
    setBusy(true); setError(null); setDone('');
    try {
      const d = await studentApi.uploadDocument(student.studentId, type, file);
      setDone(`${typeLabel(d.documentType)} uploaded.`); setFile(null); fileInput.current.value = ''; docs.reload();
    } catch (err) { setError(err); } finally { setBusy(false); }
  };
  return (
    <>
      {docs.loading ? <Loading /> : docs.error ? <ApiErr error={docs.error} /> : !docs.data?.length ? <p className="xs muted">No files on the record yet.</p> : (
        <div className="docs">
          {docs.data.map((d) => (
            <div className="doc" key={d.documentId}><FileText size={20} />
              <div><b>{typeLabel(d.documentType)} · {d.originalFileName}</b>
                <small>{sizeLabel(d.fileSizeBytes)} · {fmtDate(d.uploadedAt)} · {d.uploadedBy}</small></div>
              <button type="button" className="link" style={{ marginLeft: 'auto' }} onClick={() => download(d).catch(setError)}><Download size={13} /> Download</button>
            </div>
          ))}
        </div>
      )}
      {canUpload && (
        <div className="uploadrow">
          <select className="select" value={type} onChange={(e) => setType(e.target.value)} aria-label="Document type">
            {studentApi.DOCUMENT_TYPES.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
          </select>
          <input ref={fileInput} id="student-doc-file" type="file" accept="application/pdf,image/jpeg,image/png" onChange={(e) => { setFile(e.target.files?.[0] || null); setError(null); }} />
          <button type="button" className="btn" disabled={busy} onClick={send}>{busy ? <LoaderCircle size={15} className="spin" /> : <Upload size={15} />}Upload document</button>
        </div>
      )}
      {upload && !canUpload && <p className="xs muted" style={{ marginTop: 10 }}>Documents are uploaded by the registrar, office clerk or school nurse.</p>}
      {done && <p className="xs" style={{ marginTop: 8, color: 'var(--gr)' }}>{done}</p>}
      {error && <div style={{ marginTop: 8 }}><ApiErr error={error} /></div>}
    </>
  );
}

/* ---------- profile cards and actions ---------- */

const ModalForm = ({ title, sub, onClose, onSubmit, busy, error, submitLabel, children }) => (
  <Modal title={title} sub={sub} onClose={onClose}
    footer={<><button className="btn" onClick={onClose}>Cancel</button>
      <button className="btn primary" form="modal-form" disabled={busy}>{busy && <LoaderCircle size={14} className="spin" />}{submitLabel}</button></>}>
    <form id="modal-form" className="fieldlist" noValidate onSubmit={onSubmit}>
      {children}
      {error && <ApiErr error={error} />}
    </form>
  </Modal>
);
const In = ({ label: l, name, required, ...rest }) => (
  <div className="field box"><label htmlFor={`m-${name}`}>{l.toUpperCase()}{required ? ' *' : ''}</label><input id={`m-${name}`} name={name} {...rest} /></div>
);
const Sel = ({ label: l, name, options, value }) => (
  <div className="field box"><label htmlFor={`m-${name}`}>{l.toUpperCase()} *</label>
    <select id={`m-${name}`} name={name} defaultValue={value || ''}>
      {!value && <option value="" disabled>Select</option>}
      {options.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
    </select></div>
);

/** Submit helper: runs `fn(form values)`, then closes and reloads; keeps API errors in the modal. */
function useSubmit(fn, onDone) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const submit = async (e) => {
    e.preventDefault();
    const values = Object.fromEntries(new FormData(e.currentTarget));
    setBusy(true); setError(null);
    try { await fn(values); onDone(); } catch (err) { setError(err); } finally { setBusy(false); }
  };
  return { busy, error, submit };
}

/** Profile · Medical & wellbeing → Update: PUT /api/v1/students/{id}/medical (US-03001). */
export function MedicalModal({ student, onClose, onSaved }) {
  const { busy, error, submit } = useSubmit(async (v) => {
    if (!v.bloodGroup || !v.medicalAlerts.trim() || !v.emergencyContactPhone.trim()) throw Object.assign(new Error(), { detail: 'Blood group, medical alerts and emergency phone are all required (write “None” if there are no alerts).' });
    await studentApi.updateMedical(student.studentId, { bloodGroup: v.bloodGroup, medicalAlerts: v.medicalAlerts.trim(), emergencyContactPhone: v.emergencyContactPhone.trim() });
  }, () => { onSaved(); onClose(); });
  return (
    <ModalForm title="Update medical information" sub={fullName(student)} onClose={onClose} onSubmit={submit} busy={busy} error={error} submitLabel="Save">
      <Sel label="Blood group" name="bloodGroup" value={student.bloodGroup} options={studentApi.BLOOD_GROUPS.map((b) => [b, b])} />
      <In label="Medical alerts" name="medicalAlerts" required defaultValue={student.medicalAlerts || ''} placeholder="Conditions, allergies and care instructions, or “None”" />
      <In label="Emergency phone" name="emergencyContactPhone" required defaultValue={student.emergencyContactPhone || ''} placeholder="+91…" />
    </ModalForm>
  );
}

/** Profile → ID card: GET /api/v1/students/{id}/id-card (US-03004). */
export function IdCardModal({ student, onClose }) {
  const card = useApi(() => studentApi.getIdCard(student.studentId), [student.studentId]);
  return (
    <Modal title="Student ID card" sub={fullName(student)} onClose={onClose} footer={<button className="btn primary" onClick={onClose}>Done</button>}>
      {card.loading ? <Loading /> : card.error ? <ApiErr error={card.error} /> : (
        <KV rows={[['Name', card.data.fullName], ['Student UID', card.data.studentUid],
          ['Class', `${card.data.gradeName} · Section ${card.data.sectionName}`], ['House', card.data.houseName],
          ['Barcode', card.data.barcodeData], ['QR verification', card.data.verificationUrl]]} />
      )}
    </Modal>
  );
}

/** Profile → Documents: certificates issued (US-03006, US-03007) with the issue actions. */
/** `onStudentChanged` reloads the profile after a TC (the student becomes Transferred). */
export function CertificatesCard({ student, onStudentChanged }) {
  const { hasRole } = useAuth();
  const canList = hasRole(...ROLES.certificates);
  const certs = useApi(() => studentApi.listCertificates(student.studentId), [student.studentId], canList);
  const [open, setOpen] = useState(null);
  const onRoll = !LEFT_STATUSES.includes(student.studentStatus);
  return (
    <Card>
      <SectionHead title="Documents" sub="Files on the record and certificates issued by the school" />
      <div style={{ margin: '14px 0' }}><StudentDocuments student={student} /></div>
      <h4 style={{ fontSize: 13, fontWeight: 600, marginTop: 18 }}>Certificates issued</h4>
      <div style={{ margin: '10px 0 14px' }}>
        {!canList ? <ApiNote>Certificates are visible to registrars, office clerks, class teachers, principals and super administrators.</ApiNote>
          : certs.loading ? <Loading /> : certs.error ? <ApiErr error={certs.error} />
            : !certs.data.length ? <p className="xs muted">No certificates issued yet.</p> : (
              <div className="docs">
                {certs.data.map((c) => (
                  <div className="doc" key={c.certificateId}><FileCheck2 size={20} />
                    <div><b>{studentApi.CERTIFICATE_TYPES[c.certificateType] || label(c.certificateType)} · {c.certificateNumber}</b>
                      <small>{fmtDate(c.issueDate)} · {c.authorizedByUserId}{c.secondSignOffUserId ? ` & ${c.secondSignOffUserId}` : ''}{c.remarks ? ` · ${c.remarks}` : ''}</small></div>
                  </div>
                ))}
              </div>
            )}
      </div>
      <div className="pills">
        {hasRole(...ROLES.issueCertificate) && <button className="btn" onClick={() => setOpen('bonafide')}><Plus size={15} />Issue certificate</button>}
        {hasRole(...ROLES.transfer) && onRoll && <button className="btn" onClick={() => setOpen('tc')}><Plus size={15} />Issue transfer certificate</button>}
      </div>
      {open === 'bonafide' && <CertificateModal student={student} onClose={() => setOpen(null)} onSaved={certs.reload} />}
      {open === 'tc' && <TransferModal student={student} onClose={() => setOpen(null)} onSaved={() => { certs.reload(); onStudentChanged?.(); }} />}
    </Card>
  );
}

function CertificateModal({ student, onClose, onSaved }) {
  const { busy, error, submit } = useSubmit((v) => studentApi.issueCertificate(student.studentId, { certificateType: v.certificateType, purpose: v.purpose.trim() || undefined }),
    () => { onSaved(); onClose(); });
  return (
    <ModalForm title="Issue certificate" sub={`${fullName(student)} · ${student.studentUid}`} onClose={onClose} onSubmit={submit} busy={busy} error={error} submitLabel="Issue certificate">
      <Sel label="Certificate" name="certificateType" value="BONAFIDE" options={[['BONAFIDE', 'Bonafide certificate'], ['CHARACTER', 'Character certificate']]} />
      <In label="Purpose" name="purpose" placeholder="e.g. Passport application" />
    </ModalForm>
  );
}

/** Dual sign-off TC (US-03006): the signed-in user signs first; a second, different staff member co-signs. */
function TransferModal({ student, onClose, onSaved }) {
  const { user } = useAuth();
  const { busy, error, submit } = useSubmit(async (v) => {
    const missing = [['reasonForLeaving', 'reason for leaving'], ['conductRemarks', 'conduct'], ['secondSignOffUserId', 'second signatory']].filter(([k]) => !v[k].trim()).map(([, t]) => t);
    if (missing.length) throw Object.assign(new Error(), { detail: `Complete the required fields: ${missing.join(', ')}.` });
    await studentApi.issueTransferCertificate(student.studentId, { reasonForLeaving: v.reasonForLeaving.trim(), conductRemarks: v.conductRemarks.trim(), secondSignOffUserId: v.secondSignOffUserId.trim() });
  }, () => { onSaved(); onClose(); });
  return (
    <ModalForm title="Issue transfer certificate" sub={`${fullName(student)} · ${student.studentUid}`} onClose={onClose} onSubmit={submit} busy={busy} error={error} submitLabel="Issue TC">
      <div className="api-note"><ShieldAlert size={14} style={{ flex: 'none' }} /><span>The student is marked Transferred. You ({user.username}) sign first; enter the username of the second signatory (a different principal, vice principal or registrar).</span></div>
      <In label="Reason for leaving" name="reasonForLeaving" required placeholder="e.g. Family relocating" />
      <In label="Conduct" name="conductRemarks" required placeholder="e.g. Good" />
      <In label="Second signatory (username)" name="secondSignOffUserId" required placeholder="e.g. viceprincipal_kiran" />
    </ModalForm>
  );
}

/** Profile → Conduct: GET/POST /api/v1/students/{id}/disciplinary (US-03008). */
export function ConductCard({ student }) {
  const { hasRole } = useAuth();
  const allowed = hasRole(...ROLES.conduct);
  const list = useApi(() => studentApi.listIncidents(student.studentId), [student.studentId], allowed);
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <SectionHead title="Conduct & counseling" sub="Disciplinary incidents and counseling notes · Restricted" />
      <div style={{ marginTop: 14 }}>
        {!allowed ? <ApiNote>Conduct records are visible to class teachers, principals, vice principals and super administrators.</ApiNote>
          : list.loading ? <Loading /> : list.error ? <ApiErr error={list.error} />
            : !list.data.length ? <p className="xs muted">No incidents recorded.</p> : (
              <DataTable boxed cols={[
                { label: 'Date', render: (r) => fmtDate(r.incidentDate) },
                { label: 'Incident', render: (r) => <span className="cell-id"><b>{r.incidentCategory}</b><small>{r.description}</small></span> },
                { label: 'Severity', render: (r) => <Pill tone={r.severity === 'MINOR' ? '' : r.severity === 'MODERATE' ? 'amber' : 'red'}>{label(r.severity)}</Pill> },
                { label: 'Action & counseling', render: (r) => <span className="cell-id"><b>{r.actionTaken || '—'}</b><small>{r.counselingNotes}</small></span> },
                { label: 'Reported by', key: 'reportedByUserId' },
              ]} rows={list.data.slice().sort((a, b) => String(b.incidentDate).localeCompare(String(a.incidentDate)))} />
            )}
      </div>
      {allowed && <div style={{ marginTop: 14 }}><button className="btn" onClick={() => setOpen(true)}><Plus size={14} />Record incident</button></div>}
      {open && <IncidentModal student={student} onClose={() => setOpen(false)} onSaved={list.reload} />}
    </Card>
  );
}

function IncidentModal({ student, onClose, onSaved }) {
  const today = new Date().toISOString().slice(0, 10);
  const { busy, error, submit } = useSubmit(async (v) => {
    const missing = [['incidentDate', 'date'], ['incidentCategory', 'category'], ['description', 'description']].filter(([k]) => !String(v[k]).trim()).map(([, t]) => t);
    if (missing.length) throw Object.assign(new Error(), { detail: `Complete the required fields: ${missing.join(', ')}.` });
    await studentApi.recordIncident(student.studentId, { incidentDate: v.incidentDate, severity: v.severity, incidentCategory: v.incidentCategory.trim(),
      description: v.description.trim(), actionTaken: v.actionTaken.trim() || undefined, counselingNotes: v.counselingNotes.trim() || undefined });
  }, () => { onSaved(); onClose(); });
  return (
    <ModalForm title="Record incident" sub={`${fullName(student)} · ${classLabel(student)}`} onClose={onClose} onSubmit={submit} busy={busy} error={error} submitLabel="Record incident">
      <In label="Date" name="incidentDate" type="date" required defaultValue={today} max={today} />
      <Sel label="Severity" name="severity" value="MINOR" options={studentApi.SEVERITIES.map((s) => [s, label(s)])} />
      <In label="Category" name="incidentCategory" required placeholder="e.g. Classroom disruption" />
      <In label="Description" name="description" required placeholder="What happened" />
      <In label="Action taken" name="actionTaken" placeholder="e.g. Parents informed" />
      <In label="Counseling notes" name="counselingNotes" placeholder="Optional" />
    </ModalForm>
  );
}
