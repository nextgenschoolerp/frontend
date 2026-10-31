// communicationservice endpoints used by the UI (Module 09, communication, parent portal & app).
// See docs/communicationservice-api-mapping.md for details.
import { api, upload, fetchBlob } from './client.js';

const COMM = '/api/v1/communication';

// --- Broadcasts & Emergency Alerts (US-09000, US-09010, US-09018, US-09019) ------------------------
export const listBroadcasts = (tenantId) => api.get(`${COMM}/broadcasts`, { query: { tenantId } });
export const getBroadcast = (broadcastId) => api.get(`${COMM}/broadcasts/${broadcastId}`);
export const createBroadcast = (body) => api.post(`${COMM}/broadcasts`, body);
export const sendEmergencyAlert = (body) => api.post(`${COMM}/broadcasts/emergency`, body);
export const pinBroadcast = (broadcastId, body) => api.put(`${COMM}/broadcasts/${broadcastId}/pin`, body);
export const listPinnedBroadcasts = (tenantId) => api.get(`${COMM}/broadcasts/pinned`, { query: { tenantId } });
export const archiveBroadcast = (broadcastId, body) => api.put(`${COMM}/broadcasts/${broadcastId}/archive`, body);
export const listArchivedBroadcasts = (tenantId) => api.get(`${COMM}/broadcasts/archived`, { query: { tenantId } });

// --- Delivery Tracking & SMS Fallback (US-09011) ---------------------------------------------------
export const updateDeliveryStatus = (deliveryId, body) => api.put(`${COMM}/broadcasts/delivery/${deliveryId}`, body);
export const getDeliveryLogs = (broadcastId) => api.get(`${COMM}/broadcasts/${broadcastId}/delivery-logs`);
// Who a circular would reach and which of the school's channels (Settings → Integrations) can send now
export const previewAudience = (tenantId, audience, channel) => api.get(`${COMM}/broadcasts/audience-preview`, { query: { tenantId, audience, channel } });

// --- 30-Minute Student Absence Alerts (US-09001) ----------------------------------------------------
export const dispatchAbsenceAlert = (body) => api.post(`${COMM}/absence-alerts`, body);
export const escalateAbsenceAlert = (alertId) => api.post(`${COMM}/absence-alerts/${alertId}/escalate`);
export const listAbsenceAlerts = (tenantId, date) => api.get(`${COMM}/absence-alerts`, { query: { tenantId, date } });

// --- Mobile App, Device Tokens & Preferences (US-09002, US-09003, US-09012) ------------------------
export const registerDeviceToken = (body) => api.post(`${COMM}/mobile/devices`, body);
export const mapParentStudent = (body) => api.post(`${COMM}/mobile/child-mappings`, body);
export const getLinkedChildren = (parentUserId) => api.get(`${COMM}/mobile/parents/${parentUserId}/children`);
export const configurePreferences = (body) => api.post(`${COMM}/mobile/preferences`, body);
export const getPreferences = (tenantId, userId) => api.get(`${COMM}/mobile/preferences`, { query: { tenantId, userId } });

// --- Confidential Two-Way Teacher-Parent Messaging (US-09004) ---------------------------------------
export const sendMessage = (body) => api.post(`${COMM}/messages`, body);
export const getThreadMessages = (threadId) => api.get(`${COMM}/messages/threads/${threadId}`);
export const getUserInbox = (recipientId) => api.get(`${COMM}/messages/inbox/${recipientId}`);
export const markMessageRead = (messageId) => api.put(`${COMM}/messages/${messageId}/read`);

// --- Student Gate Passes & Security Scanner (US-09005, US-09006, US-09017) -------------------------
export const generateGatePass = (body) => api.post(`${COMM}/gate-passes`, body);
export const verifyGatePass = (body) => api.post(`${COMM}/gate-passes/verify`, body);
export const getStudentGatePasses = (tenantId, studentId) => api.get(`${COMM}/gate-passes`, { query: { tenantId, studentId } });
export const recordGateAuditLog = (body) => api.post(`${COMM}/gate-passes/audit-logs`, body);
export const getGateAuditLogs = (tenantId) => api.get(`${COMM}/gate-passes/audit-logs`, { query: { tenantId } });

// --- Visitor Appointments & Meeting Slots (US-09007, US-09016) --------------------------------------
export const registerVisitor = (body) => api.post(`${COMM}/visitors/appointments`, body);
export const checkInVisitor = (appointmentId, body) => api.put(`${COMM}/visitors/appointments/${appointmentId}/check-in`, body);
export const checkOutVisitor = (appointmentId) => api.put(`${COMM}/visitors/appointments/${appointmentId}/check-out`);
export const listVisitorAppointments = (tenantId) => api.get(`${COMM}/visitors/appointments`, { query: { tenantId } });
export const createSlot = (body) => api.post(`${COMM}/visitors/slots`, body);
export const bookSlot = (slotId, body) => api.post(`${COMM}/visitors/slots/${slotId}/book`, body);
export const getAvailableSlots = (tenantId, date) => api.get(`${COMM}/visitors/slots`, { query: { tenantId, date } });

// --- Community: Calendar, Grievances, Bulletins, Surveys & Documents (US-09008, 09, 13, 14, 15) -----
export const createCalendarEvent = (body) => api.post(`${COMM}/community/calendar-events`, body);
export const listCalendarEvents = (tenantId) => api.get(`${COMM}/community/calendar-events`, { query: { tenantId } });
export const updateCalendarEvent = (eventId, body) => api.put(`${COMM}/community/calendar-events/${eventId}`, body);
export const createGrievance = (body) => api.post(`${COMM}/community/grievances`, body);
export const updateGrievance = (ticketId, body) => api.put(`${COMM}/community/grievances/${ticketId}`, body);
export const listGrievances = (tenantId) => api.get(`${COMM}/community/grievances`, { query: { tenantId } });
export const createDailyBulletin = (body) => api.post(`${COMM}/community/bulletins`, body);
export const listDailyBulletins = (tenantId, date) => api.get(`${COMM}/community/bulletins`, { query: { tenantId, date } });
export const createSurvey = (body) => api.post(`${COMM}/community/surveys`, body);
export const submitSurveyResponse = (body) => api.post(`${COMM}/community/surveys/responses`, body);
export const listSurveyResponses = (surveyId) => api.get(`${COMM}/community/surveys/${surveyId}/responses`);
export const sendDocumentNotification = (body) => api.post(`${COMM}/community/documents/notifications`, body);
export const listDocumentNotifications = (tenantId, studentId) => api.get(`${COMM}/community/documents/notifications`, { query: { tenantId, studentId } });

// --- Help & support tickets ---------------------------------------------------------------------------
export const listSupportTickets = (tenantId, requesterUserId) => api.get(`${COMM}/support/tickets`, { query: { tenantId, requesterUserId } });
export const createSupportTicket = (body) => api.post(`${COMM}/support/tickets`, body);
export const getSupportTicket = (ticketId) => api.get(`${COMM}/support/tickets/${ticketId}`);
export const replySupportTicket = (ticketId, body) => api.post(`${COMM}/support/tickets/${ticketId}/messages`, body);
export const setSupportTicketStatus = (ticketId, status) => api.put(`${COMM}/support/tickets/${ticketId}/status`, { status });

// --- Settings → Notifications: a staff member's alert switches ----------------------------------------
export const getStaffAlerts = (tenantId, userId) => api.get(`${COMM}/staff-alerts/preferences`, { query: { tenantId, userId } });
export const saveStaffAlerts = (body) => api.put(`${COMM}/staff-alerts/preferences`, body);

// --- School document library (Documents page) ---------------------------------------------------------
export const listDocumentFolders = (tenantId) => api.get(`${COMM}/documents/folders`, { query: { tenantId } });
export const createDocumentFolder = (body) => api.post(`${COMM}/documents/folders`, body);
export const updateDocumentFolder = (folderId, body) => api.put(`${COMM}/documents/folders/${folderId}`, body);
export const listSchoolDocuments = (tenantId) => api.get(`${COMM}/documents`, { query: { tenantId } });
export const uploadSchoolDocument = (folderId, file, ownerUserId, ownerName) => {
  const form = new FormData();
  form.append('file', file);
  return upload(`${COMM}/documents/folders/${folderId}/files`, form, { query: { ownerUserId, ownerName } });
};
export const downloadSchoolDocument = (documentId) => fetchBlob(`${COMM}/documents/${documentId}/content`);
export const changeDocumentAccess = (documentId, body) => api.put(`${COMM}/documents/${documentId}/access`, body);
export const recordDocumentActivity = (documentId, body) => api.post(`${COMM}/documents/${documentId}/access-log`, body);
export const getDocumentAccessLog = (documentId) => api.get(`${COMM}/documents/${documentId}/access-log`);

const ADMIN = ['SUPER_ADMIN', 'ADMIN'];
/** Roles each action allows (CommunicationRoles.java in communicationservice). */
export const ROLES = {
  broadcast: ['PUBLIC_RELATIONS_OFFICER', 'COMMUNICATION_OFFICER', 'PRINCIPAL', 'SCHOOL_PRINCIPAL', ...ADMIN], // send, archive, delivery logs
  leadership: ['PRINCIPAL', 'SCHOOL_PRINCIPAL', ...ADMIN], // emergency alert, pin
  attendanceAlerts: ['SYSTEM_AUTOMATION', 'ATTENDANCE_OFFICER', ...ADMIN],
  parent: ['PARENT', ...ADMIN], // log a grievance, alert preferences
  messaging: ['PARENT', 'TEACHER', 'SUBJECT_TEACHER', 'CLASS_TEACHER', ...ADMIN],
  gatePass: ['PARENT', 'RECEPTIONIST', ...ADMIN],
  security: ['SECURITY_GUARD', ...ADMIN], // scan passes, gate log
  reception: ['RECEPTIONIST', 'FRONT_OFFICE_COUNSELOR', 'ADMIN_CLERK', ...ADMIN], // visitors, grievance desk
  documents: ['PUBLIC_RELATIONS_OFFICER', 'COMMUNICATION_OFFICER', 'PRINCIPAL', 'SCHOOL_PRINCIPAL', 'ADMIN_CLERK', ...ADMIN], // folders, uploads, permissions
};
