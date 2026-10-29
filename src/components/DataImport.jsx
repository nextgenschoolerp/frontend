import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Download, FileSpreadsheet, KeyRound, LoaderCircle, Upload } from 'lucide-react';
import { Card, SectionHead, Pill, Tabs, DataTable, downloadFile } from './ui.jsx';
import { ApiErr, ApiNote } from './Admissions.jsx';
import { useAuth } from '../auth.jsx';
import { useApi } from '../api/useApi.js';
import * as studentApi from '../api/studentService.js';
import * as hr from '../api/hrService.js';
import * as authApi from '../api/authService.js';
import { formatDateTime, formatNumber } from '../regional.js';

/*
 * Settings → Data import: bulk students (studentservice) or staff (hrservice).
 *   Add new records     – Excel or CSV, one row per person.
 *   Update existing     – Excel or CSV matched on Student UID / employee code; blank cells keep the current value.
 *   Photos (ZIP)        – photos named after the Student UID / employee code.
 * Download the template → fill it → Check file (nothing saved) → Import → error report for the rows to fix.
 * Staff can also get sign-in accounts (authservice) with one-time temporary passwords, linked back to the staff record.
 */

const STATUS = {
  VALID: ['Ready', 'green'], ERROR: ['Has errors', 'red'], CREATED: ['Imported', 'green'], UPDATED: ['Updated', 'green'],
  UNCHANGED: ['No change', ''], FAILED: ['Not saved', 'red'],
};
const JOB_STATUS = { VALIDATED: ['Checked, not imported', 'amber'], COMMITTED: ['Imported', 'green'], EXPIRED: ['Expired', ''] };
const ACTIONS = [['CREATE', 'Add new'], ['UPDATE', 'Update existing'], ['PHOTOS', 'Photos (ZIP)']];
const ACTION_WORD = { CREATE: 'imported', UPDATE: 'updated', PHOTOS: 'photos saved' };
const SHOWN = 200;
const plural = (n, word) => `${formatNumber(n)} ${word}${n === 1 ? '' : 's'}`;
const doneCount = (j) => (j.mode === 'CREATE' || !j.mode ? j.createdCount : j.updatedCount);

/** The two kinds of import: how to call the service, the words to use and where a record opens. */
const KINDS = {
  students: {
    label: 'Students', noun: 'student', roles: studentApi.ROLES.bulkImport, file: 'student-import', key: 'Student UID', photoExample: 'STU-2026-0001.jpg',
    template: (u, format, o) => studentApi.studentImportTemplate(u.tenantId, format, o),
    check: (u, branchId, file, mode) => studentApi.checkStudentImport(u.tenantId, branchId, file, mode),
    photos: (u, branchId, file, dryRun) => studentApi.studentPhotoZip(u.tenantId, branchId, file, dryRun),
    commit: studentApi.commitStudentImport, jobs: (u) => studentApi.studentImportJobs(u.tenantId), errors: studentApi.studentImportErrors,
    group: ['Class', (r) => r.summary?.class], link: (r) => `/students/${r.recordId}`,
    mandatory: 'First name, Last name, Date of birth, Gender, Class, Section, Guardian name, Guardian relationship, Guardian mobile and Emergency phone',
  },
  staff: {
    label: 'Staff', noun: 'staff member', roles: hr.HR_ROLES.bulkImport, file: 'staff-import', key: 'Employee code', photoExample: 'DPS-EMP-2001.jpg', accounts: true,
    template: (u, format, o) => hr.staffImportTemplate(format, o),
    check: (u, branchId, file, mode) => hr.checkStaffImport(branchId, file, mode),
    photos: (u, branchId, file, dryRun) => hr.staffPhotoZip(branchId, file, dryRun),
    commit: hr.commitStaffImport, jobs: () => hr.staffImportJobs(), errors: hr.staffImportErrors,
    group: ['Department', (r) => r.summary?.department], link: (r) => `/staff/${r.recordId}`,
    mandatory: 'Employee code, First name, Last name, Department, Designation, Joining date, Basic salary, Email and Mobile',
  },
};

/** Roles that see Settings → Data import (either kind). */
export const canImportData = (hasRole) => hasRole(...KINDS.students.roles) || hasRole(...KINDS.staff.roles);

/** The CSV of new sign-in accounts to hand over; the passwords exist only in this response. */
function signInCsv(rows) {
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [['Employee code', 'Username', 'Role', 'Temporary password'].map(cell).join(',')];
  rows.filter((r) => r.status === 'CREATED').forEach((r) => lines.push([r.employeeCode, r.username, r.roleCode, r.temporaryPassword].map(cell).join(',')));
  return new Blob([`﻿${lines.join('\r\n')}\r\n`], { type: 'text/csv' });
}

export function DataImportCard() {
  const { user, hasRole, branchId } = useAuth();
  const kinds = Object.entries(KINDS).filter(([, k]) => hasRole(...k.roles));
  const [kindKey, setKindKey] = useState(kinds[0]?.[0]);
  const [action, setAction] = useState('CREATE');
  const kind = KINDS[kindKey];
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState(null);
  const [job, setJob] = useState(null);
  const [mode, setMode] = useState('VALID_ONLY');
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [withAccounts, setWithAccounts] = useState(false);
  const [accounts, setAccounts] = useState(null);
  const history = useHistory(kinds);

  if (!kind) return null;
  const photos = action === 'PHOTOS';
  const reset = () => { setFile(null); setJob(null); setError(null); setOnlyErrors(false); setMode('VALID_ONLY'); setAccounts(null); setWithAccounts(false); if (fileRef.current) fileRef.current.value = ''; };
  const pickKind = (i) => { setKindKey(kinds[i][0]); reset(); };
  const pickAction = (i) => { setAction(ACTIONS[i][0]); reset(); };
  const run = async (what, fn) => {
    setBusy(what);
    setError(null);
    try { await fn(); } catch (e) { setError(e); } finally { setBusy(''); }
  };
  const template = (format, prefill) => run(`template-${format}-${prefill}`, async () => {
    const blob = await kind.template(user, format, { mode: action, prefill, branchId });
    const name = action === 'UPDATE' ? (prefill ? `${kind.label.toLowerCase()}-current` : `${kind.file}-update-template`) : `${kind.file}-template`;
    downloadFile(`${name}.${format}`, blob, blob.type);
  });
  const check = () => run('check', async () => setJob(photos ? await kind.photos(user, branchId, file, true) : await kind.check(user, branchId, file, action)));
  const commit = () => run('commit', async () => {
    const done = photos ? await kind.photos(user, branchId, file, false) : await kind.commit(job.jobId, mode);
    setJob(done);
    history.reload();
    if (kind.accounts && withAccounts && !photos && hasRole('IT_SYSTEM_ADMIN', 'SUPER_ADMIN')) await makeAccounts(done);
  });
  const errorReport = (j = job, k = kind) => run('errors', async () => {
    const blob = await k.errors(j.jobId);
    downloadFile(`${k.file}-errors.csv`, blob, 'text/csv');
  });

  /** Sign-in accounts for the rows that asked for one (a System role in the file): authservice makes them, hrservice links them. */
  async function makeAccounts(done) {
    const wanted = (done.rows || []).filter((r) => (r.status === 'CREATED' || r.status === 'UPDATED') && r.summary?.systemRole && r.summary?.email);
    if (!wanted.length) { setAccounts({ rows: [], skipped: 0, none: true }); return; }
    const results = await authApi.createStaffAccounts(wanted.map((r) => ({
      employeeCode: r.recordCode, firstName: r.summary.firstName, lastName: r.summary.lastName, email: r.summary.email, roleName: r.summary.systemRole, branchId,
    })));
    const byCode = new Map(wanted.map((r) => [r.recordCode, r]));
    const links = results.filter((x) => x.status === 'CREATED').map((x) => ({ staffId: byCode.get(x.employeeCode)?.recordId, userId: x.userId })).filter((l) => l.staffId);
    let linkError = null;
    if (links.length) { try { await hr.linkStaffAccounts(links); } catch (e) { linkError = e; } }
    setAccounts({ rows: results, skipped: (done.rows || []).filter((r) => r.status === 'CREATED' || r.status === 'UPDATED').length - wanted.length, linkError });
  }

  const committed = job?.status === 'COMMITTED';
  const rows = (job?.rows || []).filter((r) => !onlyErrors || r.status === 'ERROR' || r.status === 'FAILED');
  const saved = (job?.rows || []).filter((r) => r.status === 'CREATED' || r.status === 'UPDATED');
  const step = !job ? (file ? 2 : 1) : committed ? 4 : 3;

  return (
    <div className="stack">
      <Card>
        <SectionHead title="Bulk data import" sub="Add, update or add photos for many students or staff at once. Nothing is saved until you choose Import." />
        {kinds.length > 1 && <div style={{ marginTop: 14 }}><Tabs items={kinds.map(([, k]) => k.label)} value={kinds.findIndex(([k]) => k === kindKey)} onChange={pickKind} /></div>}
        <div style={{ marginTop: kinds.length > 1 ? 8 : 14 }}><Tabs items={ACTIONS.map(([, l]) => l)} value={ACTIONS.findIndex(([a]) => a === action)} onChange={pickAction} /></div>
        {!branchId && <div style={{ marginTop: 14 }}><ApiNote>Choose a campus in the header first; {kind.label.toLowerCase()} are {action === 'CREATE' ? 'added to' : 'taken from'} the selected campus.</ApiNote></div>}

        <ol className="importsteps">
          <li className={step > 1 ? 'done' : 'on'}>
            {action === 'CREATE' && <>
              <b>1. Download the template</b>
              <p>Mandatory columns are marked * and shaded yellow: {kind.mandatory}. Dropdowns list the school’s own values; the Instructions sheet explains each column.</p>
              <div className="row" style={{ gap: 8, justifyContent: 'flex-start', flexWrap: 'wrap' }}>
                <button className="btn" onClick={() => template('xlsx', false)} disabled={!!busy}>{busy === 'template-xlsx-false' ? <LoaderCircle size={14} className="spin" /> : <FileSpreadsheet size={14} />}Excel template (.xlsx)</button>
                <button className="btn" onClick={() => template('csv', false)} disabled={!!busy}>{busy === 'template-csv-false' ? <LoaderCircle size={14} className="spin" /> : <Download size={14} />}CSV template</button>
              </div>
            </>}
            {action === 'UPDATE' && <>
              <b>1. Download the current {kind.label.toLowerCase()}</b>
              <p>The file already holds today’s details of this campus, first column <b>{kind.key}</b>. Change only the cells you want to update; a blank cell keeps the current value. Delete the rows you do not need.{kind.accounts ? ' Fill System role for staff who need a sign-in account.' : ''}</p>
              <div className="row" style={{ gap: 8, justifyContent: 'flex-start', flexWrap: 'wrap' }}>
                <button className="btn" onClick={() => template('xlsx', true)} disabled={!!busy || !branchId}>{busy === 'template-xlsx-true' ? <LoaderCircle size={14} className="spin" /> : <FileSpreadsheet size={14} />}Current {kind.label.toLowerCase()} (.xlsx)</button>
                <button className="btn" onClick={() => template('csv', true)} disabled={!!busy || !branchId}>{busy === 'template-csv-true' ? <LoaderCircle size={14} className="spin" /> : <Download size={14} />}CSV</button>
                <button className="link" onClick={() => template('xlsx', false)} disabled={!!busy}>Blank update template</button>
              </div>
            </>}
            {photos && <>
              <b>1. Name the photos after the {kind.key}</b>
              <p>Put JPG or PNG photos (up to 5 MB each) in one ZIP file, each named after the {kind.key.toLowerCase()}, for example <b>{kind.photoExample}</b>. A photo replaces the current one. Folders inside the ZIP are fine.</p>
            </>}
          </li>
          <li className={step > 2 ? 'done' : step === 2 ? 'on' : ''}>
            <b>2. Upload the {photos ? 'ZIP' : 'filled file'} and check it</b>
            <p>{photos ? '.zip up to 60 MB and 2,000 photos' : '.xlsx or .csv, up to 5,000 rows and 10 MB'}. {kind.label} {action === 'CREATE' ? 'go to' : 'are on'} campus <b>{branchId || '—'}</b>.</p>
            <div className="row" style={{ gap: 8, justifyContent: 'flex-start', flexWrap: 'wrap' }}>
              <input ref={fileRef} type="file" accept={photos ? '.zip' : '.xlsx,.xls,.csv'} aria-label="Import file" disabled={!!busy || committed}
                onChange={(e) => { setFile(e.target.files?.[0] || null); setJob(null); setError(null); setAccounts(null); }} />
              <button className="btn primary" onClick={check} disabled={!file || !branchId || !!busy || committed}>
                {busy === 'check' ? <LoaderCircle size={14} className="spin" /> : <Upload size={14} />}Check file</button>
            </div>
          </li>
          <li className={step > 3 ? 'done' : step === 3 ? 'on' : ''}>
            <b>3. Review and import</b>
            <p>{photos ? 'Photos that match are saved; fix the others in the ZIP and upload it again.' : 'Fix rows with errors in your file and check it again, or import only the rows that are ready.'}</p>
          </li>
        </ol>

        {error && <div style={{ marginTop: 12 }}><ApiErr error={error} /></div>}

        {job && (
          <div style={{ marginTop: 16 }}>
            <div className="row" style={{ justifyContent: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
              <Pill>{plural(job.totalRows, photos ? 'photo' : 'row')}</Pill>
              {committed ? <Pill tone="green">{formatNumber(doneCount(job))} {ACTION_WORD[job.mode || action]}</Pill> : <Pill tone="green">{formatNumber(job.validRows)} ready</Pill>}
              {job.errorRows > 0 && <Pill tone="red">{formatNumber(job.errorRows)} {committed ? 'not saved' : 'with errors'}</Pill>}
              <span className="xs muted">{job.fileName}</span>
              <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                {job.errorRows > 0 && job.jobId && <button className="btn" onClick={() => errorReport()} disabled={!!busy}><Download size={14} />Error report</button>}
                {job.errorRows > 0 && <label className="xs" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="checkbox" checked={onlyErrors} onChange={(e) => setOnlyErrors(e.target.checked)} />Only rows with errors</label>}
              </span>
            </div>

            {committed && (
              <div className="api-note ok" style={{ marginTop: 12 }}><Check size={14} style={{ flex: 'none' }} />
                <span>{photos ? `Saved ${plural(job.updatedCount, 'photo')}.` : action === 'UPDATE' ? `Updated ${plural(job.updatedCount, kind.noun)}.` : `Imported ${plural(job.createdCount, kind.noun)}.`}
                  {job.errorRows > 0 ? ` ${plural(job.errorRows, photos ? 'photo' : 'row')} still need fixing: ${photos ? 'correct the ZIP and upload it again' : 'download the error report, correct them and upload that file'}.` : ''}</span></div>
            )}

            <div style={{ marginTop: 12 }}>
              <DataTable boxed cols={[
                { label: photos ? 'Photo' : 'Row', className: photos ? undefined : 'num', render: (r) => (photos ? <span className="xs">{r.summary?.file}</span> : r.rowNumber) },
                { label: 'Name', render: (r) => ((r.status === 'CREATED' || r.status === 'UPDATED') && r.recordId
                  ? <Link className="link" to={kind.link(r)}>{r.summary?.name || '—'}</Link> : <b style={{ fontWeight: 500 }}>{r.summary?.name || '—'}</b>) },
                action === 'UPDATE' ? { label: 'Changes', render: (r) => <span className="xs">{r.summary?.changes || '—'}</span> }
                  : photos ? { label: kind.key, render: (r) => <span className="xs">{r.recordCode || '—'}</span> }
                    : { label: kind.group[0], render: (r) => kind.group[1](r) || '—' },
                { label: 'Status', render: (r) => { const [t, c] = STATUS[r.status] || [r.status, '']; return <Pill tone={c}>{t}</Pill>; } },
                { label: committed ? 'Record / problem' : 'Problems', render: (r) => (r.status === 'CREATED' || r.status === 'UPDATED' ? <span className="xs">{r.recordCode}</span>
                  : r.errors?.length ? <ul className="importerrs">{r.errors.map((e, i) => <li key={i}>{e.column ? <b>{e.column}: </b> : null}{e.message}</li>)}</ul> : <span className="muted xs">—</span>) },
              ]} rows={rows.slice(0, SHOWN)} />
              {rows.length > SHOWN && <p className="xs muted" style={{ marginTop: 6 }}>Showing the first {SHOWN} of {formatNumber(rows.length)} rows. The error report lists every row with errors.</p>}
            </div>

            {!committed ? (
              <div className="importgo">
                {!photos && <>
                  <label><input type="radio" name="import-mode" checked={mode === 'VALID_ONLY'} onChange={() => setMode('VALID_ONLY')} />
                    {action === 'UPDATE' ? 'Update' : 'Import'} the {plural(job.validRows, 'ready row')}{job.errorRows > 0 ? `, skip the ${plural(job.errorRows, 'row')} with errors` : ''}</label>
                  <label><input type="radio" name="import-mode" checked={mode === 'ALL_OR_NOTHING'} onChange={() => setMode('ALL_OR_NOTHING')} disabled={job.errorRows > 0} />
                    {action === 'UPDATE' ? 'Update' : 'Import'} only if every row is valid (all or nothing){job.errorRows > 0 ? ' — fix the errors first' : ''}</label>
                </>}
                {kind.accounts && !photos && hasRole('IT_SYSTEM_ADMIN', 'SUPER_ADMIN') && (
                  <label><input type="checkbox" checked={withAccounts} onChange={(e) => setWithAccounts(e.target.checked)} />
                    Also create sign-in accounts for rows that have a System role{action === 'UPDATE' ? ' (staff without an account yet)' : ''}</label>
                )}
                <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
                  <button className="btn" onClick={reset} disabled={!!busy}>Start again</button>
                  <button className="btn primary" onClick={commit} disabled={!!busy || job.validRows === 0}>
                    {busy === 'commit' ? <LoaderCircle size={14} className="spin" /> : <Upload size={14} />}
                    {photos ? `Save ${plural(job.validRows, 'photo')}` : `${action === 'UPDATE' ? 'Update' : 'Import'} ${plural(job.validRows, kind.noun)}`}</button>
                </div>
              </div>
            ) : (
              <div className="row" style={{ marginTop: 12, justifyContent: 'flex-end', gap: 8 }}>
                {saved.length > 0 && <Link className="btn" to={kindKey === 'students' ? '/students' : '/staff'}>Open {kind.label.toLowerCase()}</Link>}
                <button className="btn primary" onClick={reset}>Import another file</button>
              </div>
            )}

            {accounts && (
              <div style={{ marginTop: 16 }}>
                <h4 style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}><KeyRound size={14} />Sign-in accounts</h4>
                {accounts.none ? <ApiNote>No saved row had a System role, so no account was created. Fill the System role column and use Update existing to add accounts later.</ApiNote> : <>
                  <div className="api-note" style={{ marginTop: 8 }}><span>The temporary passwords below are shown <b>only now</b> and are not stored. Download the sign-in details and hand them over safely; each person must choose a new password at first sign-in.</span></div>
                  {accounts.linkError && <div style={{ marginTop: 8 }}><ApiErr error={accounts.linkError} /></div>}
                  <div className="row" style={{ margin: '10px 0', justifyContent: 'flex-start', gap: 8 }}>
                    <Pill tone="green">{formatNumber(accounts.rows.filter((r) => r.status === 'CREATED').length)} created</Pill>
                    {accounts.rows.some((r) => r.status !== 'CREATED') && <Pill tone="red">{formatNumber(accounts.rows.filter((r) => r.status !== 'CREATED').length)} not created</Pill>}
                    {accounts.skipped > 0 && <span className="xs muted">{plural(accounts.skipped, 'row')} without a System role skipped</span>}
                    {accounts.rows.some((r) => r.status === 'CREATED') && (
                      <button className="btn" style={{ marginLeft: 'auto' }} onClick={() => downloadFile('staff-sign-in-details.csv', signInCsv(accounts.rows), 'text/csv')}><Download size={14} />Sign-in details (.csv)</button>)}
                  </div>
                  <DataTable boxed cols={[
                    { label: 'Employee code', render: (r) => r.employeeCode },
                    { label: 'Username', render: (r) => r.username || '—' },
                    { label: 'Role', render: (r) => <span className="xs">{r.roleCode || '—'}</span> },
                    { label: 'Temporary password', render: (r) => (r.temporaryPassword ? <code>{r.temporaryPassword}</code> : '—') },
                    { label: 'Result', render: (r) => (r.status === 'CREATED' ? <Pill tone="green">Created</Pill> : <span className="xs" style={{ color: 'var(--red, #b91c1c)' }}>{r.message}</span>) },
                  ]} rows={accounts.rows} />
                </>}
              </div>
            )}
          </div>
        )}
      </Card>

      <Card>
        <SectionHead title="Import history" sub="The last 50 uploads of each kind. Uploaded files are not kept; error reports stay available." />
        <div style={{ marginTop: 12 }}>
          {history.error ? <ApiErr error={history.error} /> : !history.rows ? <p className="xs muted">Loading…</p>
            : !history.rows.length ? <p className="xs muted">No imports yet.</p> : (
              <DataTable boxed cols={[
                { label: 'When', render: (j) => formatDateTime(j.committedAt || j.createdAt) },
                { label: 'Type', render: (j) => `${KINDS[j.kind].label} · ${{ UPDATE: 'update', PHOTOS: 'photos' }[j.mode] || 'new'}` },
                { label: 'File', render: (j) => <span className="xs">{j.fileName}</span> },
                { label: 'By', render: (j) => <span className="xs">{j.committedBy || j.createdBy || '—'}</span> },
                { label: 'Status', render: (j) => { const [t, c] = JOB_STATUS[j.status] || [j.status, '']; return <Pill tone={c}>{t}</Pill>; } },
                { label: 'Rows', className: 'num', render: (j) => formatNumber(j.totalRows) },
                { label: 'Saved', className: 'num', render: (j) => formatNumber(doneCount(j)) },
                { label: 'Errors', render: (j) => (j.errorRows ? <button className="link" onClick={() => errorReport(j, KINDS[j.kind])}>{formatNumber(j.errorRows)} · report</button> : '0') },
              ]} rows={history.rows} />
            )}
        </div>
      </Card>
    </div>
  );
}

/** Past uploads of every kind the user may import, newest first. */
function useHistory(kinds) {
  const { user } = useAuth();
  const keys = kinds.map(([k]) => k).join(',');
  const res = useApi(async () => {
    const lists = await Promise.all(kinds.map(([k, kind]) => kind.jobs(user).then((list) => list.map((j) => ({ ...j, kind: k })))));
    return lists.flat().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }, [keys, user.tenantId], kinds.length > 0);
  return { rows: res.data, error: res.error, reload: res.reload };
}
