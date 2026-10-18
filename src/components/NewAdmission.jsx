import { useEffect, useState } from 'react';
import { Upload, LoaderCircle } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { useApi } from '../api/useApi.js';
import * as admissionApi from '../api/admissionService.js';
import { Card, Pill, DataTable } from './ui.jsx';
import { ApiErr, ApiNote, statusPill } from './Admissions.jsx';

const DOC_TYPES = [['BIRTH_CERTIFICATE', 'Birth certificate'], ['TRANSFER_CERTIFICATE', 'Transfer certificate'],
  ['AADHAAR', 'Aadhaar'], ['PREVIOUS_REPORT_CARD', 'Previous school report']];
const UPLOAD_ROLES = ['ENTRANCE_EXAM_EVALUATOR', 'SCHOOL_PRINCIPAL', 'ADMISSION_OFFICER', 'SUPER_ADMIN'];
const CAPTURE_ROLES = ['FRONT_OFFICE_COUNSELOR', 'ADMISSION_OFFICER', 'APPLICANT_PARENT', 'SUPER_ADMIN'];

/** "2026–2027" -> "AY-2026-27" (code used by admissionservice data). */
export const academicYearCode = (v) => {
  const m = String(v || '').match(/(\d{4})\D+(\d{2,4})/);
  return m ? `AY-${m[1]}-${m[2].slice(-2)}` : '';
};
/** "Class 7" -> "GRADE-07"; "Nursery" / "LKG" / "UKG" -> "GRADE-NURSERY" / "GRADE-LKG" / "GRADE-UKG". */
export const gradeCode = (v) => {
  const m = String(v || '').match(/(\d{1,2})/);
  if (m) return `GRADE-${m[1].padStart(2, '0')}`;
  return v ? `GRADE-${String(v).trim().toUpperCase()}` : '';
};

/**
 * Builds POST /api/v1/admissions/enquiries (CaptureEnquiryRequest) from the Add student form.
 * Returns { body } or { error }.
 */
export function buildEnquiry(form, tenantId, branchId) {
  const get = (name) => String(form.get(name) || '').trim();
  const missing = [['first-name', 'first name'], ['last-name', 'last name'], ['class', 'class'],
    ['primary-guardian', 'primary guardian'], ['email-address', 'guardian email'], ['mobile-number', 'guardian mobile']]
    .filter(([k]) => !get(k)).map(([, t]) => t);
  if (missing.length) return { error: `Complete the required fields: ${missing.join(', ')}.` };
  if (!tenantId || !branchId) return { error: 'Your account has no campus assigned; ask an administrator or pick a campus in the sidebar.' };
  const phone = get('mobile-number').replace(/[\s().-]/g, '');
  if (!/^\+?[0-9]{7,20}$/.test(phone)) return { error: 'Enter the guardian mobile number as digits, optionally starting with +.' };
  const relationship = get('relationship');
  return {
    body: {
      tenantId,
      branchId,
      candidateFirstName: get('first-name'),
      candidateLastName: get('last-name'),
      targetGradeId: gradeCode(get('class')),
      academicYearId: academicYearCode(get('academic-year')),
      guardianName: get('primary-guardian'),
      guardianEmail: get('email-address'),
      guardianPhone: phone,
      referralSource: 'WALK_IN',
      remarks: ['Entered from Add student', get('section') && `section ${get('section')}`, get('year-group'),
        relationship && `guardian relationship: ${relationship}`].filter(Boolean).join('; '),
    },
  };
}

export function useCaptureAllowed() {
  const { hasRole } = useAuth();
  return hasRole(...CAPTURE_ROLES);
}

/** Right-hand panel of Add student once the application exists: status + document vault upload (US-02004). */
export function NewAdmissionPanel({ enquiry, onDocuments }) {
  const { hasRole } = useAuth();
  const canUpload = hasRole(...UPLOAD_ROLES);
  const docs = useApi(() => admissionApi.listDocuments(enquiry.enquiryId), [enquiry.enquiryId], canUpload);
  const [type, setType] = useState('BIRTH_CERTIFICATE');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  // Lets the form tick "Required documents" in its checklist
  useEffect(() => { if (docs.data) onDocuments?.(docs.data); }, [docs.data]);

  async function send() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      await admissionApi.uploadDocument(enquiry.enquiryId, type, file);
      setFile(null);
      docs.reload();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Card className="notice">
        <h4>Application {enquiry.applicationNumber} saved</h4>
        <p>Recorded for {enquiry.candidateFirstName} {enquiry.candidateLastName}. The student record is created once the application passes assessment, documents are verified and the seat deposit is paid.</p>
        <div className="pills" style={{ marginTop: 10 }}>{statusPill(enquiry.enquiryStatus)}<Pill>{enquiry.academicYearId}</Pill></div>
      </Card>
      <Card>
        <div className="cardhead"><h3>Documents</h3><p>PDF, JPG or PNG · Up to 5 MB per file. Birth and transfer certificates are required.</p></div>
        {!canUpload && <div style={{ margin: '14px 0' }}><ApiNote>Documents are uploaded by admission officers, entrance exam evaluators or the principal.</ApiNote></div>}
        {canUpload && (
          <>
            <div style={{ margin: '14px 0' }}>
              {docs.loading ? null : docs.error ? <ApiErr error={docs.error} /> : docs.data?.length ? (
                <DataTable boxed cols={[
                  { label: 'Document', render: (d) => <span className="cell-id"><b>{DOC_TYPES.find(([k]) => k === d.documentType)?.[1] || d.documentType}</b><small>{d.originalFileName}</small></span> },
                  { label: 'Status', render: (d) => <Pill tone={d.verificationStatus === 'VERIFIED' ? 'green' : 'amber'}>{d.verificationStatus.toLowerCase()}</Pill> },
                ]} rows={docs.data} />
              ) : <ApiNote>No documents uploaded yet.</ApiNote>}
            </div>
            <div className="fieldlist">
              <div className="field box"><label htmlFor="doc-type">DOCUMENT TYPE</label>
                <select id="doc-type" value={type} onChange={(e) => setType(e.target.value)}>
                  {DOC_TYPES.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
                </select>
              </div>
              <div className="field box"><label htmlFor="doc-file">FILE</label>
                <input id="doc-file" type="file" accept="application/pdf,image/jpeg,image/png" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              </div>
            </div>
            {error && <div style={{ marginBottom: 10 }}><ApiErr error={error} /></div>}
            <button type="button" className="btn" onClick={send} disabled={!file || busy}>
              {busy ? <LoaderCircle size={15} className="spin" /> : <Upload size={15} />}Upload document
            </button>
          </>
        )}
      </Card>
    </>
  );
}
