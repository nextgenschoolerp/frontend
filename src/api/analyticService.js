// analyticservice endpoints used by the UI (Module 10, integrations, compliance & analytics).
// See docs/analyticservice-api-mapping.md for details.
import { api } from './client.js';

const AN = '/api/v1/analytics';

// --- Custom report builder (US-10009) & trustee KPI dashboards (US-10014) ---------------------------
export const listCustomReports = (tenantId) => api.get(`${AN}/reports/custom`, { query: { tenantId } });
export const createCustomReport = (body) => api.post(`${AN}/reports/custom`, body);
export const executeReport = (reportId) => api.post(`${AN}/reports/custom/${reportId}/execute`);
export const listTrusteeKpis = (tenantId) => api.get(`${AN}/reports/trustee/kpi`, { query: { tenantId } });
export const recordTrusteeKpi = (body) => api.post(`${AN}/reports/trustee/kpi`, body);

// --- Integration platform: endpoints, API keys, rate limits, latency rules (US-10000, US-10010, US-10011, US-10015)
export const listIntegrationEndpoints = (tenantId) => api.get(`${AN}/integrations/endpoints`, { query: { tenantId } });
export const getIntegrationEndpoint = (id) => api.get(`${AN}/integrations/endpoints/${id}`);
export const createIntegrationEndpoint = (body) => api.post(`${AN}/integrations/endpoints`, body);
export const listApiKeys = (tenantId) => api.get(`${AN}/integrations/api-keys`, { query: { tenantId } });
export const createApiKey = (body) => api.post(`${AN}/integrations/api-keys`, body);
export const revokeApiKey = (id) => api.delete(`${AN}/integrations/api-keys/${id}`);
export const listRateLimits = (tenantId) => api.get(`${AN}/integrations/rate-limits`, { query: { tenantId } });
export const createRateLimit = (body) => api.post(`${AN}/integrations/rate-limits`, body);
export const listLatencyRules = (tenantId) => api.get(`${AN}/integrations/latency-rules`, { query: { tenantId } });
export const createLatencyRule = (body) => api.post(`${AN}/integrations/latency-rules`, body);

// --- Hardware connectors & webhooks: biometric, payments, bank recon, WhatsApp, Tally (US-10001–10004, US-10012)
export const listBiometricDevices = (tenantId) => api.get(`${AN}/connectors/biometric/devices`, { query: { tenantId } });
export const registerBiometricDevice = (body) => api.post(`${AN}/connectors/biometric/devices`, body);
export const listBiometricEvents = (tenantId) => api.get(`${AN}/connectors/biometric/attendance-stream`, { query: { tenantId } });
export const ingestBiometricEvent = (body) => api.post(`${AN}/connectors/biometric/attendance-stream`, body);
export const listPaymentWebhooks = (tenantId) => api.get(`${AN}/connectors/webhooks/payment`, { query: { tenantId } });
export const receivePaymentWebhook = (body) => api.post(`${AN}/connectors/webhooks/payment`, body);
export const listBankReconciliations = (tenantId) => api.get(`${AN}/connectors/bank-recon`, { query: { tenantId } });
export const verifyBankReconciliation = (body) => api.post(`${AN}/connectors/bank-recon/verify`, body);
export const listWhatsappConfigs = (tenantId) => api.get(`${AN}/connectors/whatsapp/configs`, { query: { tenantId } });
export const dispatchWhatsapp = (body) => api.post(`${AN}/connectors/whatsapp/dispatch`, body);
export const listTallyBatches = (tenantId) => api.get(`${AN}/connectors/tally/batches`, { query: { tenantId } });
export const syncTally = (body) => api.post(`${AN}/connectors/tally/sync`, body);

// --- Board compliance: CBSE LOC, anonymisation, certificates (US-10005, US-10013, US-10017) ------------
export const listLocExports = (tenantId) => api.get(`${AN}/compliance/cbse-loc/exports`, { query: { tenantId } });
export const exportCbseLoc = (body) => api.post(`${AN}/compliance/cbse-loc/export`, body);
export const listAnonymizationJobs = (tenantId) => api.get(`${AN}/compliance/anonymization/jobs`, { query: { tenantId } });
export const executeAnonymization = (body) => api.post(`${AN}/compliance/anonymization/execute`, body);
export const listComplianceCertificates = (tenantId) => api.get(`${AN}/compliance/certificates`, { query: { tenantId } });
export const registerComplianceCertificate = (body) => api.post(`${AN}/compliance/certificates`, body);

// --- System health, audit, backups, replicas, SLAs, incidents (US-10006–10008, US-10016, US-10018, US-10019)
export const getLatestHealth = (tenantId) => api.get(`${AN}/system/health/latest`, { query: { tenantId } });
export const getHealthHistory = (tenantId) => api.get(`${AN}/system/health/history`, { query: { tenantId } });
export const recordHealthMetric = (body) => api.post(`${AN}/system/health/telemetry`, body);
export const listAuditLogs = (tenantId) => api.get(`${AN}/system/audit/logs`, { query: { tenantId } });
export const recordAuditLog = (body) => api.post(`${AN}/system/audit/logs`, body);
export const listBackups = (tenantId) => api.get(`${AN}/system/backups`, { query: { tenantId } });
export const triggerBackup = (body) => api.post(`${AN}/system/backups`, body);
export const getSlowQueries = () => api.get(`${AN}/system/performance/slow-queries`);
export const listReplicas = (tenantId) => api.get(`${AN}/system/replicas`, { query: { tenantId } });
export const executeReplicaFailover = (body) => api.post(`${AN}/system/replicas/failover`, body);
export const listUptimeSlas = (tenantId) => api.get(`${AN}/system/uptime/sla`, { query: { tenantId } });
export const recordUptimeSla = (body) => api.post(`${AN}/system/uptime/sla`, body);
export const listIncidents = (tenantId) => api.get(`${AN}/system/status/incidents`, { query: { tenantId } });
export const reportIncident = (body) => api.post(`${AN}/system/status/incidents`, body);

// Mirrors com.kvs.analytics.config.AnalyticsRoles (role codes without the ROLE_ prefix)
const ADMIN = ['SUPER_ADMIN', 'ADMIN'];
export const ROLES = {
  reportBuilder: ['DATA_ANALYST', 'SYSTEM_INTEGRATOR', ...ADMIN], // custom reports: list, create, run
  analyticsView: ['DATA_ANALYST', 'TRUSTEE', 'PRINCIPAL', 'SCHOOL_PRINCIPAL', ...ADMIN], // trustee KPI dashboards
  integration: ['CHIEF_TECHNOLOGY_OFFICER', 'SYSTEM_INTEGRATOR', ...ADMIN],
  webhook: ['CHIEF_TECHNOLOGY_OFFICER', 'DATA_ANALYST', 'SYSTEM_AUTOMATION', ...ADMIN],
  compliance: ['COMPLIANCE_OFFICER', 'PRINCIPAL', 'SCHOOL_PRINCIPAL', 'EXAM_CONTROLLER', 'DATABASE_ADMINISTRATOR', ...ADMIN],
  audit: ['SECURITY_AUDITOR', 'AUDITOR', 'CHIEF_TECHNOLOGY_OFFICER', 'PRINCIPAL', 'SCHOOL_PRINCIPAL', ...ADMIN],
  backup: ['CHIEF_TECHNOLOGY_OFFICER', 'DATABASE_ADMINISTRATOR', ...ADMIN],
  gateway: ['SYSTEM_AUTOMATION', 'SYSTEM_INTEGRATOR', ...ADMIN],
};

// Report builder categories accepted by CustomReportRequest.category
export const CATEGORIES = [['ACADEMIC', 'Students & academics'], ['ATTENDANCE', 'Attendance'], ['FINANCE', 'Finance'], ['STAFF_HR', 'Staff & HR']];
export const CHART_TYPES = [['TABLE', 'Table'], ['BAR', 'Bar chart'], ['LINE', 'Line chart'], ['PIE', 'Pie chart']];
