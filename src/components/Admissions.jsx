import { useState } from 'react';
import { ShieldAlert, Info, LoaderCircle } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { useApi } from '../api/useApi.js';
import * as admissionApi from '../api/admissionService.js';
import { DataTable, Person, Pill, KV, Actions } from './ui.jsx';
import { Modal } from './AuthSettings.jsx';

const READ_ROLES = ['FRONT_OFFICE_COUNSELOR', 'ADMISSION_OFFICER', 'SUPER_ADMIN'];

export const ApiNote = ({ children }) => <div className="api-note"><Info size={14} style={{ flex: 'none', marginTop: 1 }} /><span>{children}</span></div>;
export const ApiErr = ({ error }) => (
  <div className={error.status === 403 ? 'api-note' : 'api-error'}>
    <ShieldAlert size={14} style={{ flex: 'none' }} />
    <span>{error.status === 403 ? 'Not available for your role.' : error.detail}</span>
  </div>
);
const Loading = () => <p className="xs muted"><LoaderCircle size={12} className="spin" /> Loading…</p>;

export const statusPill = (status) => {
  const [text, tone] = admissionApi.STATUS[status] || [status, ''];
  return <Pill tone={tone}>{text}</Pill>;
};
const fmtDate = (t) => (t ? new Date(t).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
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

/** Students → Admissions tab. */
export function ApplicationsTable({ apps }) {
  const [viewing, setViewing] = useState(null);
  if (!apps.canRead) return <ApiNote>Admission applications are visible to front-office counselors, admission officers and super administrators.</ApiNote>;
  if (apps.missingBranch) return <ApiNote>Select a campus to see its applications.</ApiNote>;
  if (apps.loading) return <Loading />;
  if (apps.error) return <ApiErr error={apps.error} />;
  if (!apps.rows.length) return <ApiNote>No applications for this campus yet. Use “Add student” to record one.</ApiNote>;
  return (
    <>
      <div className="tablebox">
        <DataTable
          cols={[
            { label: 'Applicant', render: (e) => <Person name={`${e.candidateFirstName} ${e.candidateLastName}`} sub={e.applicationNumber} /> },
            { label: 'Applying for', render: (e) => `${gradeLabel(e.targetGradeId)} · ${e.academicYearId}` },
            { label: 'Guardian', render: (e) => <span className="cell-id"><b>{e.guardianName}</b><small>{e.guardianPhone}</small></span> },
            { label: 'Source', render: (e) => label(e.referralSource) },
            { label: 'Received', render: (e) => fmtDate(e.createdAt) },
            { label: 'Status', render: (e) => statusPill(e.enquiryStatus) },
            { label: 'Actions', render: (e) => <Actions><button className="link" onClick={() => setViewing(e)}>Review application</button></Actions> },
          ]}
          rows={apps.rows}
        />
      </div>
      {viewing && <ApplicationModal enquiry={viewing} onClose={() => setViewing(null)} />}
    </>
  );
}

function Section({ title, res, children }) {
  return (
    <div style={{ marginTop: 18 }}>
      <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{title}</h4>
      {res.loading ? <Loading /> : res.error ? <ApiErr error={res.error} /> : children(res.data || [])}
    </div>
  );
}

/** Review application: enquiry + documents, assessments, offers and calls (read-only). */
export function ApplicationModal({ enquiry, onClose }) {
  const id = enquiry.enquiryId;
  const docs = useApi(() => admissionApi.listDocuments(id), [id]);
  const evals = useApi(() => admissionApi.listEvaluations(id), [id]);
  const offers = useApi(() => admissionApi.listOffers(id), [id]);
  const calls = useApi(() => admissionApi.listCalls(id), [id]);

  return (
    <Modal title={`${enquiry.candidateFirstName} ${enquiry.candidateLastName}`} sub={`${enquiry.applicationNumber} · ${gradeLabel(enquiry.targetGradeId)} · ${enquiry.academicYearId}`} onClose={onClose}>
      <div className="pills">{statusPill(enquiry.enquiryStatus)}{enquiry.campaignCode && <Pill>{enquiry.campaignCode}</Pill>}</div>
      <KV rows={[
        ['Guardian', `${enquiry.guardianName} · ${enquiry.guardianPhone}`],
        ['Email', enquiry.guardianEmail],
        ['Source', label(enquiry.referralSource)],
        ['Received', fmtDate(enquiry.createdAt)],
        ['Counselor', enquiry.assignedCounselorId || '—'],
      ]} />
      {enquiry.remarks && <p className="body-s" style={{ marginTop: 10 }}>{enquiry.remarks}</p>}

      <Section title="Documents" res={docs}>
        {(rows) => (rows.length ? (
          <DataTable boxed cols={[
            { label: 'Document', render: (d) => <span className="cell-id"><b>{label(d.documentType)}</b><small>{d.originalFileName}</small></span> },
            { label: 'Status', render: (d) => <Pill tone={d.verificationStatus === 'VERIFIED' ? 'green' : d.verificationStatus === 'REJECTED' ? 'red' : 'amber'}>{label(d.verificationStatus)}</Pill> },
            { label: 'Notes', render: (d) => <span className="xs muted">{d.verificationNotes || (d.mandatory ? 'Required' : 'Optional')}</span> },
          ]} rows={rows} />
        ) : <ApiNote>No documents uploaded yet.</ApiNote>)}
      </Section>

      <Section title="Assessments" res={evals}>
        {(rows) => (rows.length ? (
          <DataTable boxed cols={[
            { label: 'Assessment', render: (e) => label(e.evaluationType) },
            { label: 'Score', render: (e) => `${e.totalScore} / ${e.maxTotalScore} (pass ${e.passingScore})` },
            { label: 'Result', render: (e) => <Pill tone={e.evaluationStatus === 'PASSED' ? 'green' : 'red'}>{label(e.evaluationStatus)}</Pill> },
            { label: 'Date', render: (e) => fmtDate(e.evaluationDate) },
          ]} rows={rows} />
        ) : <ApiNote>No assessments recorded yet.</ApiNote>)}
      </Section>

      <Section title="Offers" res={offers}>
        {(rows) => (rows.length ? (
          <DataTable boxed cols={[
            { label: 'Offer', key: 'offerCode' },
            { label: 'Seat deposit', render: (o) => `${o.currency} ${o.initialFeeAmount}` },
            { label: 'Valid until', render: (o) => fmtDate(o.validUntilDate) },
            { label: 'Status', render: (o) => <Pill tone={o.offerStatus === 'ACCEPTED' ? 'green' : o.offerStatus === 'DISPATCHED' ? 'purple' : ''}>{label(o.offerStatus)}</Pill> },
          ]} rows={rows} />
        ) : <ApiNote>No offer issued yet.</ApiNote>)}
      </Section>

      <Section title="Calls" res={calls}>
        {(rows) => (rows.length ? (
          <DataTable boxed cols={[
            { label: 'When', render: (c) => fmtDate(c.calledAt) },
            { label: 'Outcome', render: (c) => label(c.outcome) },
            { label: 'Notes', render: (c) => <span className="xs">{c.notes}</span> },
          ]} rows={rows} />
        ) : <ApiNote>No calls logged yet.</ApiNote>)}
      </Section>
    </Modal>
  );
}
