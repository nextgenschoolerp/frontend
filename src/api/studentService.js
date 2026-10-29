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
export const updateProfile = (studentId, body) => api.put(`${STUDENTS}/${studentId}/profile`, body);
export const updateGuardians = (studentId, body) => api.put(`${STUDENTS}/${studentId}/guardians`, body);
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
// Settings → Academic setup → Classes, sections & houses
export const createGrade = (body) => api.post(`${ACADEMIC}/grades`, body); // { tenantId, gradeName, gradeCode, sequenceOrder }
export const createSection = (body) => api.post(`${ACADEMIC}/sections`, body); // { gradeId, sectionName, maxCapacity }
export const updateSection = (sectionId, body) => api.put(`${ACADEMIC}/sections/${sectionId}`, body); // { maxCapacity }
export const assignClassTeacher = (sectionId, body) => api.patch(`${ACADEMIC}/sections/${sectionId}/class-teacher`, body); // { staffId, staffName }
export const createHouse = (body) => api.post(`${ACADEMIC}/houses`, body); // { tenantId, houseName, colorHex }
export const updateHouse = (houseId, body) => api.put(`${ACADEMIC}/houses/${houseId}`, body); // { houseName, colorHex }
// Deletes only what nothing refers to; a 409 names what still uses it (students, attendance, timetable, marks …)
export const deleteGrade = (gradeId) => api.del(`${ACADEMIC}/grades/${gradeId}`); // the class and its sections
export const deleteSection = (sectionId) => api.del(`${ACADEMIC}/sections/${sectionId}`);
export const deleteHouse = (houseId) => api.del(`${ACADEMIC}/houses/${houseId}`);
export const listSessions = (tenantId) => api.get(`${ACADEMIC}/sessions`, { query: { tenantId } });
// Settings → Academic setup, Calendar → Term dates: academic years with their terms
export const getAcademicCalendar = (tenantId) => api.get(`${ACADEMIC}/calendar`, { query: { tenantId } });
export const updateAcademicSession = (academicYearId, body) => api.put(`${ACADEMIC}/sessions/${academicYearId}`, body);
export const saveAcademicTerms = (academicYearId, terms) => api.put(`${ACADEMIC}/sessions/${academicYearId}/terms`, { terms });
export const createSession = (body) => api.post(`${ACADEMIC}/sessions`, body);
export const promoteBatch = (body) => api.post(`${ACADEMIC}/batch-promotion`, body); // US-03005

// --- Daily attendance: AM / PM registers, absences, guardian follow-up, school figures ---------------
const ATTENDANCE = '/api/v1/attendance';
export const getRegister = (sectionId, date) => api.get(`${ATTENDANCE}/sections/${sectionId}/register`, { query: { date } });
/** body: { date, session: 'AM' | 'PM', entries: [{ studentId, status, reason }] } */
export const saveRegister = (sectionId, body) => api.put(`${ATTENDANCE}/sections/${sectionId}/register`, body);
export const attendanceSummary = (date, branchId) => api.get(`${ATTENDANCE}/summary`, { query: { date, branchId } });
export const attendanceTrend = (from, to, branchId) => api.get(`${ATTENDANCE}/trend`, { query: { from, to, branchId } });
export const listAbsences = (query) => api.get(`${ATTENDANCE}/absences`, { query });
export const listFollowUps = (query) => api.get(`${ATTENDANCE}/follow-ups`, { query });
export const updateFollowUp = (attendanceId, body) => api.patch(`${ATTENDANCE}/records/${attendanceId}/follow-up`, body);
export const studentAttendance = (studentId, from, to) => api.get(`${ATTENDANCE}/students/${studentId}`, { query: { from, to } });

/** Attendance marks: [label, pill tone]. A student without a mark is "Unmarked". */
export const ATTENDANCE_STATUS = {
  PRESENT: ['Present', 'green'],
  LATE: ['Late', 'amber'],
  EXCUSED: ['Excused', ''],
  UNEXCUSED: ['Unexcused', 'red'],
};
export const FOLLOW_UP_STATUS = { OPEN: ['Guardian not yet reached', 'red'], GUARDIAN_CONTACTED: ['Guardian contacted', 'amber'], RESOLVED: ['Resolved', 'green'] };

// --- Bulk student import (Settings → Data import) ------------------------------------------------------
const IMPORT = `${STUDENTS}/import`;
/** mode: CREATE (new students) or UPDATE (existing, by Student UID); prefill puts the campus's current students in the file */
export const studentImportTemplate = (tenantId, format = 'xlsx', { mode = 'CREATE', prefill = false, branchId = '' } = {}) =>
  fetchBlob(`${IMPORT}/template?tenantId=${encodeURIComponent(tenantId)}&format=${format}&mode=${mode}&prefill=${prefill}&branchId=${encodeURIComponent(branchId || '')}`);
export const checkStudentImport = (tenantId, branchId, file, mode = 'CREATE') => { const fd = new FormData(); fd.append('file', file); return upload(`${IMPORT}/check`, fd, { query: { tenantId, branchId, mode } }); };
/** A ZIP of photos named STU-….jpg; dryRun only reports what would be saved */
export const studentPhotoZip = (tenantId, branchId, file, dryRun) => { const fd = new FormData(); fd.append('file', file); return upload(`${IMPORT}/photos`, fd, { query: { tenantId, branchId, dryRun } }); };
/** mode: VALID_ONLY (the rows without errors) or ALL_OR_NOTHING */
export const commitStudentImport = (jobId, mode) => api.post(`${IMPORT}/${jobId}/commit`, null, { query: { mode } });
export const studentImportJobs = (tenantId) => api.get(`${IMPORT}/jobs`, { query: { tenantId } });
export const studentImportErrors = (jobId) => fetchBlob(`${IMPORT}/jobs/${jobId}/errors`);

/** Roles each action allows (the @PreAuthorize of the studentservice endpoint; SUPER_ADMIN everywhere). */

export const ROLES = {
  bulkImport: ['IT_SYSTEM_ADMIN', 'SUPER_ADMIN', 'REGISTRAR'], // Settings → Data import (students)
  structure: ['REGISTRAR', 'SUPER_ADMIN'], // add classes, sections and houses; section capacity; house name and colour
  classTeacher: ['REGISTRAR', 'SCHOOL_PRINCIPAL', 'VICE_PRINCIPAL', 'SUPER_ADMIN'], // PATCH /sections/{id}/class-teacher
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
  profile: ['REGISTRAR', 'OFFICE_CLERK', 'SUPER_ADMIN'],
  uploadDocument: ['REGISTRAR', 'OFFICE_CLERK', 'SCHOOL_NURSE', 'SUPER_ADMIN'],
  /** GET /academic/grades and /sections (class pickers) */
  classes: ['REGISTRAR', 'OFFICE_CLERK', 'SCHOOL_PRINCIPAL', 'CLASS_TEACHER', 'SUBJECT_TEACHER', 'EXAM_CONTROLLER', 'VICE_PRINCIPAL', 'ACADEMIC_AUDITOR', 'ACADEMIC_HEAD', 'SUPER_ADMIN'],
  attendanceView: ['CLASS_TEACHER', 'ACADEMIC_HEAD', 'VICE_PRINCIPAL', 'SCHOOL_PRINCIPAL', 'REGISTRAR', 'OFFICE_CLERK', 'SUPER_ADMIN'],
  attendanceMark: ['CLASS_TEACHER', 'ACADEMIC_HEAD', 'VICE_PRINCIPAL', 'SCHOOL_PRINCIPAL', 'SUPER_ADMIN'],
  attendanceFollowUp: ['CLASS_TEACHER', 'OFFICE_CLERK', 'VICE_PRINCIPAL', 'SCHOOL_PRINCIPAL', 'SUPER_ADMIN'],
  /** Registers older than 7 days */
  attendanceLateCorrection: ['SCHOOL_PRINCIPAL', 'VICE_PRINCIPAL', 'SUPER_ADMIN'],
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
