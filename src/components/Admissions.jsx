import { useState } from 'react';
import { ShieldAlert, Info, LoaderCircle, Eye, Check, X } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { useApi } from '../api/useApi.js';
import * as admissionApi from '../api/admissionService.js';
import { DataTable, Person, Pill, Actions, IconAction, EmptyState, Pager, avatarTone, downloadCsv, useSort, sortRows, Stale } from './ui.jsx';
import { Modal } from './AuthSettings.jsx';
import { NextStep } from './AdmissionActions.jsx';
import { formatDate, formatDateTime, formatTime, formatNumber } from '../regional.js';

// Everyone who moves an application forward can read the list (GET /enquiries)
const READ_ROLES = ['FRONT_OFFICE_COUNSELOR', 'ADMISSION_OFFICER', 'REGISTRAR', 'ENTRANCE_EXAM_EVALUATOR', 'FINANCE_CASHIER', 'SCHOOL_PRINCIPAL', 'SUPER_ADMIN'];

export const ApiNote = ({ children }) => <div className="api-note"><Info size={14} style={{ flex: 'none', marginTop: 1 }} /><span>{children}</span></div>;
export const ApiErr = ({ error, onRetry }) => (
  <div className={error.status === 403 ? 'api-note' : 'api-error'}>
    <ShieldAlert size={14} style={{ flex: 'none' }} />
    <span>{error.status === 403 ? 'Not available for your role.' : error.detail}
      {error.status !== 403 && error.traceId && <small className="trace-ref" title="Trace id of this request in the service logs"> Ref {error.traceId}</small>}</span>
    {onRetry && error.status !== 403 && <button type="button" className="link" onClick={onRetry} style={{ marginLeft: 'auto' }}>Try again</button>}
  </div>
);
const Loading = () => <p className="xs muted"><LoaderCircle size={12} className="spin" /> Loading…</p>;

export const statusPill = (status) => {
  const [text, tone] = admissionApi.STATUS[status] || [status, ''];
  return <Pill tone={tone}>{text}</Pill>;
};
const fmtDate = (t) => formatDate(t);
const label = (code) => (code || '').toLowerCase().split('_').map((w) => (w ? w[0].toUpperCase() + w.slice(1) : '')).join(' ');
/** "GRADE-07" -> "Class 7"; "GRADE-NURSERY" -> "Nursery"; "GRADE-LKG" -> "LKG". */
export const gradeLabel = (g) => {
  const code = String(g || '').replace(/^GRADE-/, '');
  if (/^\d+$/.test(code)) return `Class ${Number(code)}`;
  return code === 'NURSERY' ? 'Nursery' : code;
};

/**
 * Applications of the active campus: GET /api/v1/admissions/enquiries?tenantId=&branchId= (US-02001).
 * `canRead` is false for roles the endpoint does not allow, `missingBranch` when no campus is known.
 */
export function useApplications() {
  const { user, hasRole, branchId } = useAuth();
  const canRead = hasRole(...READ_ROLES);
  const enabled = canRead && !!user?.tenantId && !!branchId;
  const res = useApi(() => admissionApi.listEnquiries(user.tenantId, branchId), [user?.tenantId, branchId], enabled);
  const rows = (res.data || []).slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const open = rows.filter((e) => admissionApi.OPEN_STATUSES.includes(e.enquiryStatus));
  const fresh = rows.filter((e) => e.enquiryStatus === 'NEW_INQUIRY' || e.enquiryStatus === 'CONTACTED');
  return { ...res, rows, open, fresh, canRead, missingBranch: canRead && !branchId };
}

/** Open document follow-ups of the campus: GET /api/v1/admissions/document-follow-ups?status=OPEN (US-02011). */
export function useOpenFollowUps() {
  const { user, hasRole, branchId } = useAuth();
  const enabled = hasRole('REGISTRAR', 'ADMISSION_OFFICER', 'FRONT_OFFICE_COUNSELOR', 'SUPER_ADMIN') && !!user?.tenantId && !!branchId;
  return useApi(() => admissionApi.listFollowUps(user.tenantId, branchId), [user?.tenantId, branchId], enabled);
}

/** "Export list" on the Admissions tab: the loaded applications as CSV. */
export function exportApplicationsCsv(rows) {
  downloadCsv('admission-applications',
    ['Application number', 'First name', 'Last name', 'Applying for', 'Academic year', 'Guardian', 'Guardian email', 'Guardian phone', 'Source', 'Received', 'Status', 'Counselor'],
    rows.map((e) => [e.applicationNumber, e.candidateFirstName, e.candidateLastName, gradeLabel(e.targetGradeId), e.academicYearId, e.guardianName,
      e.guardianEmail, e.guardianPhone, label(e.referralSource), e.createdAt?.slice(0, 10), (admissionApi.STATUS[e.enquiryStatus] || [e.enquiryStatus])[0], e.assignedCounselorId || '']));
}

/** Students → Admissions tab. */
/** Applicant name with initials on the class colour (the class applied for), as the student list colours students by class. */
export function ApplicantCell({ enquiry: e }) {
  const name = `${e.candidateFirstName} ${e.candidateLastName}`;
  const [bg, fg] = avatarTone(e.targetGradeId);
  const initials = `${e.candidateFirstName?.[0] || ''}${e.candidateLastName?.[0] || ''}`.toUpperCase();
  return (
    <>
      <span className="avatar-sm" style={{ background: bg, color: fg }} aria-hidden="true">{initials}</span>
      <span className="cell-id"><b>{name}</b><small>{e.applicationNumber}</small></span>
    </>
  );
}

export function ApplicationsTable({ apps }) {
  const [viewing, setViewing] = useState(null);
  const sort = useSort();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const cols = [
    { label: 'Applicant', sortBy: (e) => `${e.candidateFirstName} ${e.candidateLastName}`, render: (e) => <ApplicantCell enquiry={e} /> },
    { label: 'Applying for', sortBy: (e) => gradeLabel(e.targetGradeId), render: (e) => `${gradeLabel(e.targetGradeId)} · ${e.academicYearId}` },
    { label: 'Guardian', sortBy: (e) => e.guardianName, render: (e) => <span className="cell-id"><b>{e.guardianName}</b><small>{e.guardianPhone}</small></span> },
    { label: 'Source', sortBy: (e) => label(e.referralSource), render: (e) => label(e.referralSource) },
    { label: 'Received', sortBy: (e) => e.createdAt, render: (e) => fmtDate(e.createdAt) },
    { label: 'Status', sortBy: (e) => e.enquiryStatus, render: (e) => statusPill(e.enquiryStatus) },
    { label: 'Actions', render: (e) => <Actions><IconAction icon={Eye} label={`Review application of ${e.candidateFirstName || ''} ${e.candidateLastName || ''}`.replace(/\s+/g, ' ').trim()} onClick={() => setViewing(e)} /></Actions> },
  ];
  if (!apps.canRead) return <ApiNote>Admission applications are visible to admissions staff: counselors, admission officers, registrars, evaluators, cashiers, principals and super administrators.</ApiNote>;
  if (apps.missingBranch) return <ApiNote>Select a campus to see its applications.</ApiNote>;
  // Only the first load shows the spinner: a reload after an action keeps the review modal open
  if (apps.loading && !apps.data) return <Loading />;
  if (apps.error) return <ApiErr error={apps.error} />;
  if (!apps.rows.length) return <ApiNote>No applications for this campus yet. Use “Add student” to record one.</ApiNote>;
  // 10 per page by default; the sorted list is paged, so the page shows the first rows of the sort
  const sorted = sortRows(apps.rows, cols, sort);
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(page, pages);
  const shown = sorted.slice((current - 1) * pageSize, current * pageSize);
  return (
    <>
      <div className="tablebox">
        <DataTable
          sort={sort}
          cols={cols}
          rows={shown}
        />
        <Pager page={current} pages={pages} onPage={setPage} pageSize={pageSize} onPageSize={(n) => { setPageSize(n); setPage(1); }}
          text={`Showing ${(current - 1) * pageSize + 1}–${(current - 1) * pageSize + shown.length} of ${sorted.length} application${sorted.length === 1 ? '' : 's'}`} />
      </div>
      {/* The modal shows the latest list row, so a status change made inside it is reflected straight away */}
      {viewing && <ApplicationModal enquiry={apps.rows.find((e) => e.enquiryId === viewing.enquiryId) || viewing}
        onClose={() => setViewing(null)} onChanged={apps.reload} />}
    </>
  );
}

function Section({ id, title, res, children }) {
  const count = res.data ? ` (${res.data.length})` : '';
  return (
    <div id={id} className="reviewsection">
      <h4>{title}<small>{count}</small></h4>
      {res.loading && !res.data ? <Loading /> : res.error ? <ApiErr error={res.error} /> : <Stale busy={res.loading}>{children(res.data || [])}</Stale>}
    </div>
  );
}

/** Scrolls the review panel to one of its sections (the panel itself is the scroll container). */
const jumpTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
const digits = (p) => String(p || '').replace(/[^0-9]/g, '');

/** Review application: enquiry details, the next step for the signed-in stakeholder, documents, assessments, offers and calls. */
export function ApplicationModal({ enquiry, onClose, onChanged }) {
  const id = enquiry.enquiryId;
  const docs = useApi(() => admissionApi.listDocuments(id), [id]);
  const evals = useApi(() => admissionApi.listEvaluations(id), [id]);
  const offers = useApi(() => admissionApi.listOffers(id), [id]);
  const calls = useApi(() => admissionApi.listCalls(id), [id]);
  const changed = () => { onChanged?.(); docs.reload(); evals.reload(); offers.reload(); calls.reload(); };
  const { hasRole, user } = useAuth();
  const canVerify = hasRole('REGISTRAR', 'ADMISSION_OFFICER', 'SUPER_ADMIN');
  const [verifyError, setVerifyError] = useState(null);
  const verify = async (d, verificationStatus) => {
    setVerifyError(null);
    try {
      await admissionApi.verifyDocument(d.documentId, { verificationStatus,
        verificationNotes: `${verificationStatus === 'VERIFIED' ? 'Verified' : 'Rejected'} by ${user.username} from the review modal` });
      docs.reload();
    } catch (err) { setVerifyError(err); }
  };

  return (
    <Modal title={`${enquiry.candidateFirstName} ${enquiry.candidateLastName}`} sub={`${enquiry.applicationNumber} · ${gradeLabel(enquiry.targetGradeId)} · ${enquiry.academicYearId}`} onClose={onClose}>
      <div className="pills">{statusPill(enquiry.enquiryStatus)}{enquiry.campaignCode && <Pill>{enquiry.campaignCode}</Pill>}<Pill>{label(enquiry.referralSource)}</Pill></div>
      <dl className="factgrid review-facts">
        <div><dt>Date of birth</dt><dd>{enquiry.candidateDateOfBirth
          ? `${fmtDate(enquiry.candidateDateOfBirth)}${enquiry.candidateGender ? ` · ${label(enquiry.candidateGender)}` : ''}`
          : <Pill tone="amber">Missing</Pill>}</dd></div>
        <div><dt>Guardian</dt><dd>{enquiry.guardianName}{enquiry.guardianRelationship ? ` (${enquiry.guardianRelationship})` : ''}</dd></div>
        <div><dt>Phone</dt><dd className="contactlinks">
          <a href={`tel:+${digits(enquiry.guardianPhone)}`}>{enquiry.guardianPhone}</a>
          <a href={`https://wa.me/${digits(enquiry.guardianPhone)}`} target="_blank" rel="noreferrer">WhatsApp</a></dd></div>
        <div><dt>Email</dt><dd>{enquiry.guardianEmail ? <a href={`mailto:${enquiry.guardianEmail}`}>{enquiry.guardianEmail}</a> : <Pill tone="amber">Missing</Pill>}</dd></div>
        <div><dt>Received</dt><dd>{fmtDate(enquiry.createdAt)}</dd></div>
        <div><dt>Counselor</dt><dd>{enquiry.assignedCounselorId || '—'}</dd></div>
      </dl>
      {calls.data?.length > 0 && (() => {
        const last = calls.data.slice().sort((a, b) => String(b.calledAt).localeCompare(String(a.calledAt)))[0];
        return (
          <div className="lastcall">
            <span>Last call</span>
            <b>{formatDateTime(last.calledAt)}</b>
            <Pill tone={last.outcome === 'CONNECTED' ? 'green' : last.outcome === 'CALLBACK_REQUESTED' ? 'amber' : undefined}>{label(last.outcome)}</Pill>
            {last.notes && <em>{last.notes}</em>}
          </div>
        );
      })()}
      {enquiry.remarks && <blockquote className="reviewnote">{enquiry.remarks}</blockquote>}
      <nav className="reviewnav" aria-label="Application sections">
        <button type="button" onClick={() => jumpTo('adm-docs')}>Documents</button>
        <button type="button" onClick={() => jumpTo('adm-evals')}>Assessments</button>
        <button type="button" onClick={() => jumpTo('adm-offers')}>Offers</button>
        <button type="button" onClick={() => jumpTo('adm-calls')}>Calls</button>
      </nav>

      <NextStep enquiry={enquiry} offers={offers} onChanged={changed} />

      <Section id="adm-docs" title="Documents" res={docs}>
        {(rows) => (rows.length ? (
          <DataTable boxed cols={[
            { label: 'Document', render: (d) => <span className="cell-id"><b>{label(d.documentType)}</b><small>{d.originalFileName}</small></span> },
            { label: 'Status', render: (d) => <Pill tone={d.verificationStatus === 'VERIFIED' ? 'green' : d.verificationStatus === 'REJECTED' ? 'red' : 'amber'}>{label(d.verificationStatus)}</Pill> },
            { label: 'Notes', render: (d) => <span className="xs muted">{d.verificationNotes || (d.mandatory ? 'Required' : 'Optional')}</span> },
            // Registrar / admission officer: PATCH /documents/{id}/verification (US-02004)
            ...(canVerify ? [{ label: 'Verify', render: (d) => (d.verificationStatus === 'PENDING' ? (
              <Actions>
                <IconAction icon={Check} label={`Verify ${d.documentType || 'document'}`} onClick={() => verify(d, 'VERIFIED')} />
                <IconAction icon={X} danger label={`Reject ${d.documentType || 'document'}`} onClick={() => verify(d, 'REJECTED')} />
              </Actions>) : '—') }] : []),
          ]} rows={rows} />
        ) : <EmptyState title="No documents uploaded yet" />)}
      </Section>
      {verifyError && <ApiErr error={verifyError} />}

      <Section id="adm-evals" title="Assessments" res={evals}>
        {(rows) => (rows.length ? (
          <DataTable boxed cols={[
            { label: 'Assessment', render: (e) => label(e.evaluationType) },
            { label: 'Score', render: (e) => `${e.totalScore} / ${e.maxTotalScore} (pass ${e.passingScore})` },
            { label: 'Result', render: (e) => <Pill tone={e.evaluationStatus === 'PASSED' ? 'green' : 'red'}>{label(e.evaluationStatus)}</Pill> },
            { label: 'Date', render: (e) => fmtDate(e.evaluationDate) },
          ]} rows={rows} />
        ) : <EmptyState title="No assessments recorded yet" />)}
      </Section>

      <Section id="adm-offers" title="Offers" res={offers}>
        {(rows) => (rows.length ? (
          <DataTable boxed cols={[
            { label: 'Offer', key: 'offerCode' },
            { label: 'Seat deposit', render: (o) => `${o.currency} ${o.initialFeeAmount}` },
            { label: 'Valid until', render: (o) => fmtDate(o.validUntilDate) },
            { label: 'Status', render: (o) => <Pill tone={o.offerStatus === 'ACCEPTED' ? 'green' : o.offerStatus === 'DISPATCHED' ? 'purple' : ''}>{label(o.offerStatus)}</Pill> },
          ]} rows={rows} />
        ) : <EmptyState title="No offer issued yet" />)}
      </Section>

      <Section id="adm-calls" title="Calls" res={calls}>
        {(rows) => (rows.length ? (
          <DataTable boxed cols={[
            { label: 'When', render: (c) => fmtDate(c.calledAt) },
            { label: 'Outcome', render: (c) => label(c.outcome) },
            { label: 'Notes', render: (c) => <span className="xs">{c.notes}</span> },
          ]} rows={rows} />
        ) : <EmptyState title="No calls logged yet" />)}
      </Section>
    </Modal>
  );
}
