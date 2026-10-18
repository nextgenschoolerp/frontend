// studentservice endpoints used by the UI (Module 03, SIS & student lifecycle).
// See docs/studentservice-api-mapping.md for the screen-by-screen map.
import { api, upload, fetchBlob } from './client.js';

const STUDENTS = '/api/v1/students';
const ACADEMIC = '/api/v1/academic';

// --- Student master record (US-03000 … US-03004) ----------------------------------------------------
export const listStudents = (tenantId, branchId) => api.get(STUDENTS, { query: { tenantId, branchId } });
export const getStudent = (studentId) => api.get(`${STUDENTS}/${studentId}`);
export const enrollStudent = (body) => api.post(STUDENTS, body);
export const updateMedical = (studentId, body) => api.put(`${STUDENTS}/${studentId}/medical`, body);
export const assignAllocation = (studentId, body) => api.put(`${STUDENTS}/${studentId}/allocation`, body);
export const getIdCard = (studentId) => api.get(`${STUDENTS}/${studentId}/id-card`);

// --- Photo and document files (Edit student → Change photo / Upload documents; profile → Documents) --
export const uploadPhoto = (studentId, file) => { const f = new FormData(); f.append('file', file); return upload(`${STUDENTS}/${studentId}/photo/upload`, f); };
export const photoBlob = (studentId) => fetchBlob(`${STUDENTS}/${studentId}/photo/file`);
export const listDocuments = (studentId) => api.get(`${STUDENTS}/${studentId}/documents`);
export const uploadDocument = (studentId, documentType, file) => {
  const f = new FormData(); f.append('file', file);
  return upload(`${STUDENTS}/${studentId}/documents`, f, { query: { documentType } });
};
export const documentBlob = (doc) => fetchBlob(doc.downloadUrl);

// --- Certificates (US-03006, US-03007) and conduct (US-03008) ---------------------------------------
export const listCertificates = (studentId) => api.get(`${STUDENTS}/${studentId}/certificates`);
export const issueCertificate = (studentId, body) => api.post(`${STUDENTS}/${studentId}/certificates/bonafide`, body);
export const issueTransferCertificate = (studentId, body) => api.post(`${STUDENTS}/${studentId}/certificates/transfer`, body);
export const listIncidents = (studentId) => api.get(`${STUDENTS}/${studentId}/disciplinary`);
export const recordIncident = (studentId, body) => api.post(`${STUDENTS}/${studentId}/disciplinary`, body);

// --- Academic structure (classes, sections, houses, sessions) ---------------------------------------
export const listGrades = (tenantId) => api.get(`${ACADEMIC}/grades`, { query: { tenantId } });
export const listSections = (gradeId) => api.get(`${ACADEMIC}/sections`, { query: { gradeId } });
export const listHouses = (tenantId) => api.get(`${ACADEMIC}/houses`, { query: { tenantId } });
export const listSessions = (tenantId) => api.get(`${ACADEMIC}/sessions`, { query: { tenantId } });
export const createSession = (body) => api.post(`${ACADEMIC}/sessions`, body);
export const promoteBatch = (body) => api.post(`${ACADEMIC}/batch-promotion`, body); // US-03005

/** Roles each action allows (the @PreAuthorize of the studentservice endpoint; SUPER_ADMIN everywhere). */
export const ROLES = {
  list: ['REGISTRAR', 'OFFICE_CLERK', 'CLASS_TEACHER', 'SCHOOL_PRINCIPAL', 'SCHOOL_NURSE', 'SUPER_ADMIN'],
  view: ['REGISTRAR', 'OFFICE_CLERK', 'CLASS_TEACHER', 'SCHOOL_PRINCIPAL', 'SCHOOL_NURSE', 'SUPER_ADMIN'],
  enroll: ['REGISTRAR', 'OFFICE_CLERK', 'SUPER_ADMIN'],
  promote: ['REGISTRAR', 'SCHOOL_PRINCIPAL', 'SUPER_ADMIN'],
  medical: ['SCHOOL_NURSE', 'REGISTRAR', 'SUPER_ADMIN'],
  allocate: ['REGISTRAR', 'CLASS_TEACHER', 'HOUSE_MASTER', 'SUPER_ADMIN'],
  idCard: ['OFFICE_CLERK', 'REGISTRAR', 'CLASS_TEACHER', 'SUPER_ADMIN'],
  certificates: ['REGISTRAR', 'OFFICE_CLERK', 'SCHOOL_PRINCIPAL', 'CLASS_TEACHER', 'SUPER_ADMIN'],
  issueCertificate: ['REGISTRAR', 'OFFICE_CLERK', 'SCHOOL_PRINCIPAL', 'SUPER_ADMIN'],
  transfer: ['SCHOOL_PRINCIPAL', 'VICE_PRINCIPAL', 'REGISTRAR', 'SUPER_ADMIN'],
  conduct: ['CLASS_TEACHER', 'SCHOOL_PRINCIPAL', 'VICE_PRINCIPAL', 'SUPER_ADMIN'],
  grades: ['REGISTRAR', 'OFFICE_CLERK', 'SCHOOL_PRINCIPAL', 'CLASS_TEACHER', 'SUPER_ADMIN'],
  houses: ['REGISTRAR', 'OFFICE_CLERK', 'SCHOOL_PRINCIPAL', 'CLASS_TEACHER', 'HOUSE_MASTER', 'SUPER_ADMIN'],
  photo: ['REGISTRAR', 'OFFICE_CLERK', 'SUPER_ADMIN'],
  uploadDocument: ['REGISTRAR', 'OFFICE_CLERK', 'SCHOOL_NURSE', 'SUPER_ADMIN'],
};

/** student_status values: [label, pill tone]. */
export const STUDENT_STATUS = {
  ACTIVE: ['Active', 'green'],
  PROMOTED: ['Promoted', 'green'],
  SUSPENDED: ['Suspended', 'red'],
  TRANSFERRED: ['Transferred', ''],
  GRADUATED: ['Graduated', 'purple'],
};
/** Students who have left the school (shown under Archived). */
export const LEFT_STATUSES = ['TRANSFERRED', 'GRADUATED'];

export const GENDERS = { Female: 'FEMALE', Male: 'MALE', 'Non-binary': 'OTHER', 'Prefer not to say': 'OTHER' };
export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
export const CERTIFICATE_TYPES = { TRANSFER_CERTIFICATE: 'Transfer certificate', BONAFIDE: 'Bonafide certificate', CHARACTER: 'Character certificate', MIGRATION: 'Migration certificate', MERIT: 'Merit certificate' };
export const SEVERITIES = ['MINOR', 'MODERATE', 'MAJOR', 'SEVERE'];
export const DOCUMENT_TYPES = [['BIRTH_CERTIFICATE', 'Birth certificate'], ['PROOF_OF_ADDRESS', 'Proof of address'], ['TRANSFER_CERTIFICATE', 'Transfer certificate'],
  ['REPORT_CARD', 'Previous school report'], ['MEDICAL_CARE_PLAN', 'Medical care plan'], ['IDENTITY_DOCUMENT', 'Identity document (Aadhaar)'], ['OTHER', 'Other']];

/** studentId values are UUIDs; anything else in /students/:id is the static sample profile. */
export const isStudentId = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id || ''));
export const fullName = (s) => `${s?.firstName || ''} ${s?.lastName || ''}`.trim();
/** "Class 6" + "A" -> "Class 6-A". */
export const classLabel = (s) => (s?.gradeName ? `${s.gradeName}${s.sectionName ? `-${s.sectionName}` : ''}` : 'Not placed');
