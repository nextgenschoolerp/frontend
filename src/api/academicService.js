// academicservice endpoints used by the UI (Module 06, academics & LMS).
// See docs/academicservice-api-mapping.md for the screen-by-screen map.
import { api, fetchBlob } from './client.js';

const LMS = '/api/v1/lms';

// --- Bell schedules, workloads, allocations (US-06000, US-06001) ------------------------------------
export const listBellSchedules = () => api.get(`${LMS}/bell-schedules`);
export const getBellSchedule = (id) => api.get(`${LMS}/bell-schedules/${id}`);
export const listWorkloads = () => api.get(`${LMS}/workloads`);
export const listClasses = () => api.get(`${LMS}/classes`);
export const listSubjects = () => api.get(`${LMS}/subjects`);
export const listAllocations = (sectionId) => api.get(`${LMS}/allocations`, { query: { sectionId } });
/** Creates the class's allocation for the subject, or replaces its teacher and periods when there is one. */
export const allocate = (body) => api.post(`${LMS}/allocations`, body);
export const deleteAllocation = (allocationId) => api.del(`${LMS}/allocations/${allocationId}`);

// --- Timetables (US-06002, US-06015) ----------------------------------------------------------------
export const generateTimetables = (body) => api.post(`${LMS}/timetables/generate`, body);
export const sectionTimetable = (sectionId) => api.get(`${LMS}/timetables/sections/${sectionId}`);
export const teacherTimetable = (teacherId) => api.get(`${LMS}/timetables/teachers/${encodeURIComponent(teacherId)}`);
export const facultyPdf = (bellScheduleId, teacherId) =>
  fetchBlob(`${LMS}/timetables/faculty/pdf?bellScheduleId=${bellScheduleId}${teacherId ? `&teacherId=${encodeURIComponent(teacherId)}` : ''}`);

// --- Substitutions (US-06003) -----------------------------------------------------------------------
export const listAbsences = (date) => api.get(`${LMS}/substitutions/absences`, { query: { date } });
export const reportAbsence = (body) => api.post(`${LMS}/substitutions/absences`, body);
export const autoAssign = (date) => api.post(`${LMS}/substitutions/auto-assign`, { date });
export const daySheet = (date) => api.get(`${LMS}/substitutions`, { query: { date } });
export const reassignProxy = (proxyId, body) => api.put(`${LMS}/substitutions/${proxyId}`, body);

// --- Syllabus coverage (US-06004) -------------------------------------------------------------------
export const coverage = (sectionId) => api.get(`${LMS}/syllabus/coverage`, { query: { sectionId } });
export const markCovered = (topicId, body) => api.post(`${LMS}/syllabus/topics/${topicId}/coverage`, body);

// --- Homework (US-06010, US-06008) ------------------------------------------------------------------
export const listHomework = (sectionId) => api.get(`${LMS}/homework`, { query: { sectionId } });
export const createHomework = (body) => api.post(`${LMS}/homework`, body);
export const homeworkRoster = (homeworkId) => api.get(`${LMS}/homework/${homeworkId}/submissions`);
export const evaluateSubmission = (submissionId, body) => api.put(`${LMS}/homework/submissions/${submissionId}/evaluation`, body);

// --- Lesson plans (US-06013) ------------------------------------------------------------------------
export const listLessonPlans = (query) => api.get(`${LMS}/lesson-plans`, { query });
export const createLessonPlan = (body) => api.post(`${LMS}/lesson-plans`, body);
export const submitLessonPlan = (id) => api.post(`${LMS}/lesson-plans/${id}/submit`, {});
export const reviewLessonPlan = (id, body) => api.post(`${LMS}/lesson-plans/${id}/review`, body);
export const lessonPlanCompliance = (from, to) => api.get(`${LMS}/lesson-plans/compliance`, { query: { from, to } });

// --- Labs (US-06011) --------------------------------------------------------------------------------
export const listLabs = () => api.get(`${LMS}/labs`);
export const labReservations = (roomId, from, to) => api.get(`${LMS}/labs/${roomId}/reservations`, { query: { from, to } });
export const reserveLab = (roomId, body) => api.post(`${LMS}/labs/${roomId}/reservations`, body);
export const cancelReservation = (reservationId, reason) => api.post(`${LMS}/labs/reservations/${reservationId}/cancel`, { reason });

const STAFF = ['ACADEMIC_COORDINATOR', 'TIMETABLE_INCHARGE', 'SUBSTITUTION_INCHARGE', 'ELEARNING_ADMIN', 'SUBJECT_TEACHER', 'CLASS_TEACHER',
  'SCHOOL_PRINCIPAL', 'VICE_PRINCIPAL', 'SUPER_ADMIN'];

/** Roles each action allows (AcademicRoles.java in academicservice). */
export const ROLES = {
  view: STAFF,
  generate: ['TIMETABLE_INCHARGE', 'ACADEMIC_COORDINATOR', 'SUPER_ADMIN'],
  allocate: ['TIMETABLE_INCHARGE', 'ACADEMIC_COORDINATOR', 'SUPER_ADMIN'],
  exportPdf: ['SCHOOL_PRINCIPAL', 'VICE_PRINCIPAL', 'TIMETABLE_INCHARGE', 'ACADEMIC_COORDINATOR', 'SUBSTITUTION_INCHARGE', 'SUPER_ADMIN'],
  substitution: ['SUBSTITUTION_INCHARGE', 'TIMETABLE_INCHARGE', 'VICE_PRINCIPAL', 'SUPER_ADMIN'],
  coverage: ['SUBJECT_TEACHER', 'CLASS_TEACHER', 'ACADEMIC_COORDINATOR', 'SUPER_ADMIN'],
  setHomework: ['SUBJECT_TEACHER', 'CLASS_TEACHER', 'SUPER_ADMIN'],
  evaluate: ['SUBJECT_TEACHER', 'CLASS_TEACHER', 'ACADEMIC_COORDINATOR', 'SUPER_ADMIN'],
  writePlan: ['SUBJECT_TEACHER', 'CLASS_TEACHER', 'SUPER_ADMIN'],
  reviewPlan: ['SCHOOL_PRINCIPAL', 'VICE_PRINCIPAL', 'ACADEMIC_COORDINATOR', 'SUPER_ADMIN'],
  bookLab: ['SUBJECT_TEACHER', 'CLASS_TEACHER', 'SUBSTITUTION_INCHARGE', 'TIMETABLE_INCHARGE', 'ACADEMIC_COORDINATOR', 'SUPER_ADMIN'],
};

export const COVERAGE = { ON_TRACK: ['On track', 'green'], AHEAD: ['Ahead', 'green'], BEHIND: ['Behind plan', 'amber'], NOT_STARTED: ['Not started', ''] };
export const PLAN_STATUS = { DRAFT: ['Draft', ''], SUBMITTED: ['Awaiting review', 'amber'], APPROVED: ['Approved', 'green'], RETURNED: ['Returned', 'purple'] };
export const PROXY_STATUS = { ASSIGNED: ['Covered', 'green'], UNCOVERED: ['Not covered', 'amber'], CANCELLED: ['Cancelled', ''] };
export const ROOM_TYPE = { COMPUTER_LAB: 'Computer lab', SCIENCE_LAB: 'Science lab', LANGUAGE_LAB: 'Language lab', ACTIVITY_ROOM: 'Activity room' };
export const DAYS = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const hhmm = (t) => (t ? String(t).slice(0, 5) : '');
