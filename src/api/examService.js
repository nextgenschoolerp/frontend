// examservice endpoints used by the UI (Module 05, exams & NEP 2020 assessments).
// See docs/studentservice-api-mapping.md › Assessments for the screen-by-screen map.
import { api } from './client.js';

const AC = '/api/v1/exams';

// --- Setup (US-05000, US-05005) ---------------------------------------------------------------------
export const listTerms = () => api.get(`${AC}/terms`);
export const listSubjects = (termId, gradeId) => api.get(`${AC}/terms/${termId}/subjects`, { query: { gradeId } });
export const lockTerm = (termId) => api.post(`${AC}/terms/${termId}/lock`, {});

// --- Mark entry (US-05003), unlock tickets (US-05006), completeness (US-05016) -----------------------
export const markSheet = (termId, sectionId, subjectCode, branchId) =>
  api.get(`${AC}/terms/${termId}/marks`, { query: { sectionId, subjectCode, branchId } });
export const saveMarks = (termId, body, branchId) => api.put(`${AC}/terms/${termId}/marks`, body, { query: { branchId } });
export const requestUnlock = (termId, body) => api.post(`${AC}/terms/${termId}/unlock-tickets`, body);
export const listTickets = (termId) => api.get(`${AC}/terms/${termId}/unlock-tickets`);
export const decideTicket = (ticketId, body) => api.patch(`${AC}/unlock-tickets/${ticketId}/decision`, body);
export const completeness = (termId, query) => api.get(`${AC}/terms/${termId}/completeness`, { query });

// --- Results (US-05007, US-05008, US-05010, US-05011) -------------------------------------------------
export const broadsheet = (termId, sectionId, branchId) => api.get(`${AC}/terms/${termId}/broadsheet`, { query: { sectionId, branchId } });
export const rankList = (termId, query) => api.get(`${AC}/terms/${termId}/rank-list`, { query });
/** The broadsheet of every section with students, in one call (Academics outlook; leadership only). */
export const schoolResults = (termId, branchId) => api.get(`${AC}/terms/${termId}/school-results`, { query: { branchId } });
export const publish = (termId, sectionId, branchId) => api.post(`${AC}/terms/${termId}/publish`, { sectionId }, { query: { branchId } });

// --- Student (US-05009, US-05013, US-05018) -----------------------------------------------------------
export const progressCard = (studentId, examTermId) => api.get(`${AC}/students/${studentId}/progress-card`, { query: { examTermId } });
export const progressTrend = (studentId) => api.get(`${AC}/students/${studentId}/progress-trend`);
export const saveRemarks = (studentId, body) => api.put(`${AC}/students/${studentId}/progress-card/remarks`, body);

const TEACHING = ['EXAM_CONTROLLER', 'SUBJECT_TEACHER', 'CLASS_TEACHER', 'SCHOOL_PRINCIPAL', 'VICE_PRINCIPAL', 'ACADEMIC_AUDITOR', 'SUPER_ADMIN'];

/** Roles each action allows (ExamRoles.java in examservice). */
export const ROLES = {
  view: [...TEACHING, 'REGISTRAR'],
  studentProgress: [...TEACHING, 'REGISTRAR', 'APPLICANT_PARENT'],
  configure: ['EXAM_CONTROLLER', 'SCHOOL_PRINCIPAL', 'SUPER_ADMIN'],
  schoolResults: ['SCHOOL_PRINCIPAL', 'VICE_PRINCIPAL', 'EXAM_CONTROLLER', 'ACADEMIC_AUDITOR', 'SUPER_ADMIN'],
  enterMarks: ['SUBJECT_TEACHER', 'CLASS_TEACHER', 'EXAM_CONTROLLER', 'SUPER_ADMIN'],
  requestUnlock: ['SUBJECT_TEACHER', 'CLASS_TEACHER', 'SUPER_ADMIN'],
  decideUnlock: ['SCHOOL_PRINCIPAL', 'EXAM_CONTROLLER', 'SUPER_ADMIN'],
  remarks: ['CLASS_TEACHER', 'SCHOOL_PRINCIPAL', 'SUPER_ADMIN'],
  publish: ['CLASS_TEACHER', 'SCHOOL_PRINCIPAL', 'EXAM_CONTROLLER', 'SUPER_ADMIN'],
};

export const RESULT = { PASS: ['Pass', 'green'], FAIL: ['Needs support', 'amber'], INCOMPLETE: ['Incomplete', ''] };
export const TREND = { IMPROVING: ['Improving', 'green'], DECLINING: ['Declining', 'amber'], STEADY: ['Steady', 'purple'], NOT_ENOUGH_DATA: ['One term so far', ''] };
export const AREAS = {
  ART_EDUCATION: 'Art education', HEALTH_AND_PHYSICAL_EDUCATION: 'Health & physical education', WORK_EDUCATION: 'Work education',
  VALUE_EDUCATION: 'Value education', DISCIPLINE: 'Discipline',
};
export const pct = (n) => (n === null || n === undefined ? '—' : `${Number(n).toFixed(1)}%`);
