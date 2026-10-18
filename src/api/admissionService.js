// admissionservice endpoints used by the UI. See docs/admissionservice-api-mapping.md for the screen-by-screen map.
import { api, upload } from './client.js';

const BASE = '/api/v1/admissions';

// --- Enquiries / applications (US-02001) ------------------------------------------------------------
export const captureEnquiry = (body) => api.post(`${BASE}/enquiries`, body);
export const listEnquiries = (tenantId, branchId) => api.get(`${BASE}/enquiries`, { query: { tenantId, branchId } });
export const getEnquiry = (enquiryId) => api.get(`${BASE}/enquiries/${enquiryId}`);

// --- Application detail (US-02003, US-02004, US-02006, US-02015) ------------------------------------
export const listDocuments = (enquiryId) => api.get(`${BASE}/enquiries/${enquiryId}/documents`);
export const uploadDocument = (enquiryId, documentType, file) => {
  const form = new FormData();
  form.append('file', file);
  return upload(`${BASE}/enquiries/${enquiryId}/documents`, form, { query: { documentType } });
};
export const listEvaluations = (enquiryId) => api.get(`${BASE}/enquiries/${enquiryId}/evaluations`);
export const listOffers = (enquiryId) => api.get(`${BASE}/enquiries/${enquiryId}/offers`);
export const listCalls = (enquiryId) => api.get(`${BASE}/enquiries/${enquiryId}/calls`);

// --- Moving an application forward (review modal → Next step) ---------------------------------------
export const logCall = (enquiryId, body) => api.post(`${BASE}/enquiries/${enquiryId}/calls`, body);                 // US-02015
export const scheduleExam = (body) => api.post(`${BASE}/entrance-exams`, body);                                     // US-02002
export const getRubric = (evaluationType) => api.get(`${BASE}/evaluation-rubrics`, { query: { evaluationType } });  // US-02003
export const recordEvaluation = (body) => api.post(`${BASE}/evaluations`, body);                                    // US-02003
export const issueOffer = (body) => api.post(`${BASE}/offers`, body);                                               // US-02006
export const collectDeposit = (offerId, body) => api.post(`${BASE}/offers/${offerId}/deposits`, body);              // US-02008
export const convertToStudent = (enquiryId, body) => api.post(`${BASE}/enquiries/${enquiryId}/student-conversion`, body); // US-02005
export const verifyDocument = (documentId, body) => api.patch(`${BASE}/documents/${documentId}/verification`, body); // US-02004
export const closeApplication = (enquiryId, body) => api.patch(`${BASE}/enquiries/${enquiryId}/decision`, body);  // Not offered / Withdrawn

// --- Document follow-ups (US-02011) -----------------------------------------------------------------
export const listFollowUps = (tenantId, branchId, status = 'OPEN') =>
  api.get(`${BASE}/document-follow-ups`, { query: { tenantId, branchId, status } });

/** Pipeline statuses in display order (enquiry_status_enum). */
export const STATUS = {
  NEW_INQUIRY: ['New enquiry', 'purple'],
  CONTACTED: ['Contacted', 'purple'],
  EVALUATION_SCHEDULED: ['Assessment scheduled', 'amber'],
  EVALUATION_PASSED: ['Assessment passed', 'green'],
  OFFER_ISSUED: ['Offer issued', 'green'],
  ENROLLED: ['Enrolled', 'green'],
  REJECTED: ['Not offered', 'red'],
  WITHDRAWN: ['Withdrawn', ''],
};
/** Applications still awaiting a decision ("Awaiting review"). */
export const OPEN_STATUSES = ['NEW_INQUIRY', 'CONTACTED', 'EVALUATION_SCHEDULED', 'EVALUATION_PASSED', 'OFFER_ISSUED'];
