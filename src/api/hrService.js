// hrservice endpoints used by the UI (Module 07, staff HR, biometric attendance & payroll).
// See docs/hrservice-api-mapping.md for the screen-by-screen map.
import { api, upload, fetchBlob } from './client.js';

const HR = '/api/v1/hr';

// --- Employee master (US-07000, US-07010) -----------------------------------------------------------
export const listEmployees = (query = {}) => api.get(`${HR}/employees`, { query });
export const getEmployee = (staffId) => api.get(`${HR}/employees/${staffId}`);
export const getMyProfile = () => api.get(`${HR}/employees/me`);
export const createEmployee = (body) => api.post(`${HR}/employees`, body);
export const updateEmployee = (staffId, body) => api.put(`${HR}/employees/${staffId}`, body);
// Staff photo (JPEG or PNG, 5 MB): replaces the photo on file; the photo itself is fetched as a blob with the token
export const uploadEmployeePhoto = (staffId, file) => {
  const form = new FormData();
  form.append('file', file);
  return upload(`${HR}/employees/${staffId}/photo`, form);
};
export const employeePhotoBlob = (staffId) => fetchBlob(`${HR}/employees/${staffId}/photo/file`);
export const listAppraisals = (staffId) => api.get(`${HR}/employees/${staffId}/appraisals`);
export const listArchives = () => api.get(`${HR}/employees/archives`);

// --- Leave (US-07003, US-07004, US-07017) ------------------------------------------------------------
export const listLeaves = (query = {}) => api.get(`${HR}/leaves`, { query });
export const applyLeave = (body) => api.post(`${HR}/leaves`, body);
export const reviewLeave = (applicationId, body) => api.put(`${HR}/leaves/${applicationId}/review`, body);
export const listQuotas = (staffId, quotaYear) => api.get(`${HR}/leaves/quotas`, { query: { staffId, quotaYear } });

// --- Attendance (US-07001, US-07013) and CPD (US-07009) ---------------------------------------------
export const listScans = (staffId) => api.get(`${HR}/attendance/scans/${staffId}`);
export const attendanceSummary = (date) => api.get(`${HR}/attendance/summary`, { query: { date } });
export const listCpd = (staffId) => api.get(`${HR}/development/cpd/${staffId}`);

// --- Bulk staff import (Settings → Data import) --------------------------------------------------------
const STAFF_IMPORT = `${HR}/employees/import`;
/** mode: CREATE (new staff) or UPDATE (existing, by employee code); prefill puts the campus's current staff in the file */
export const staffImportTemplate = (format = 'xlsx', { mode = 'CREATE', prefill = false, branchId = '' } = {}) =>
  fetchBlob(`${STAFF_IMPORT}/template?format=${format}&mode=${mode}&prefill=${prefill}&branchId=${encodeURIComponent(branchId || '')}`);
export const checkStaffImport = (branchId, file, mode = 'CREATE') => { const fd = new FormData(); fd.append('file', file); return upload(`${STAFF_IMPORT}/check`, fd, { query: { branchId, mode } }); };
/** A ZIP of photos named after the employee code; dryRun only reports what would be saved */
export const staffPhotoZip = (branchId, file, dryRun) => { const fd = new FormData(); fd.append('file', file); return upload(`${STAFF_IMPORT}/photos`, fd, { query: { branchId, dryRun } }); };
/** Links sign-in accounts (made through authservice) to the staff they belong to: [{ staffId, userId }] */
export const linkStaffAccounts = (links) => api.post(`${STAFF_IMPORT}/link-accounts`, { links });
/** mode: VALID_ONLY (the rows without errors) or ALL_OR_NOTHING */
export const commitStaffImport = (jobId, mode) => api.post(`${STAFF_IMPORT}/${jobId}/commit`, null, { query: { mode } });
export const staffImportJobs = () => api.get(`${STAFF_IMPORT}/jobs`);
export const staffImportErrors = (jobId) => fetchBlob(`${STAFF_IMPORT}/jobs/${jobId}/errors`);

/** Roles as enforced by hrservice (HrRoles.java), using the role codes authservice issues. */

export const HR_ROLES = {
  bulkImport: ['IT_SYSTEM_ADMIN', 'SUPER_ADMIN', 'HR_MANAGER'], // Settings → Data import (staff)
  manage: ['HR_MANAGER', 'SCHOOL_PRINCIPAL', 'PRINCIPAL', 'SUPER_ADMIN'],
  approveLeave: ['HR_MANAGER', 'DEPARTMENT_HEAD', 'SCHOOL_PRINCIPAL', 'PRINCIPAL', 'VICE_PRINCIPAL', 'SUPER_ADMIN'],
  /** May record leave for someone else; everyone else applies only on their own profile */
  hrOfficer: ['HR_MANAGER', 'PAYROLL_ACCOUNTANT', 'SCHOOL_PRINCIPAL', 'PRINCIPAL', 'VICE_PRINCIPAL', 'DEPARTMENT_HEAD', 'SUPER_ADMIN'],
  attendance: ['SCHOOL_PRINCIPAL', 'PRINCIPAL', 'VICE_PRINCIPAL', 'COMPLIANCE_OFFICER', 'HR_MANAGER', 'DEPARTMENT_HEAD', 'SUPER_ADMIN'],
};

export const LEAVE_TYPES = [['CASUAL', 'Casual leave'], ['SICK', 'Sick leave'], ['EARNED', 'Earned leave'], ['MATERNITY', 'Maternity leave'],
  ['PATERNITY', 'Paternity leave'], ['LWP', 'Leave without pay']];
export const LEAVE_LABEL = Object.fromEntries(LEAVE_TYPES);
export const LEAVE_STATUS = { PENDING: ['Pending approval', 'amber'], APPROVED: ['Approved', 'green'], REJECTED: ['Rejected', 'red'], CANCELLED: ['Cancelled', ''] };
export const EMPLOYMENT_STATUS = {
  ACTIVE: ['Active', 'green'], ON_LEAVE: ['On leave', 'amber'], NOTICE_PERIOD: ['Notice period', 'amber'],
  RESIGNED: ['Resigned', ''], RETIRED: ['Retired', ''], TERMINATED: ['Terminated', 'red'],
};
export const PROBATION = { ON_PROBATION: 'On probation', CONFIRMED: 'Confirmed', EXTENDED: 'Probation extended' };
/** Departments whose staff teach; everyone else is support staff */
export const TEACHING_DEPARTMENTS = ['Mathematics', 'Science', 'English', 'Hindi', 'Social Science', 'Computer Science', 'Physical Education'];
