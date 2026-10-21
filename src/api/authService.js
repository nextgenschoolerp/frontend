// authservice endpoints used by the UI. See docs/authservice-api-mapping.md for the screen-by-screen map.
import { api } from './client.js';

// --- Sign-in & password lifecycle (US-00000, US-01001 .. US-01005) ---------------------------------
export const login = (username, password) => api.post('/api/v1/auth/login', { username, password }, { auth: false });
export const me = (token) => api.get('/api/v1/auth/me', { token });
export const forgotPassword = (identifier) => api.post('/api/v1/auth/forgot-password', { identifier }, { auth: false });
export const resetPassword = (token, newPassword, confirmPassword) =>
  api.post('/api/v1/auth/reset-password', { token, newPassword, confirmPassword }, { auth: false });
export const changePassword = (currentPassword, newPassword, confirmPassword) =>
  api.put('/api/v1/auth/change-password', { currentPassword, newPassword, confirmPassword });

// --- Roles & screen permissions (US-00002) ----------------------------------------------------------
export const listRoles = () => api.get('/api/v1/roles');
export const getRolePermissions = (roleId) => api.get(`/api/v1/roles/${roleId}/permissions`);
export const assignRolePermissions = (roleId, permissions) => api.post(`/api/v1/roles/${roleId}/permissions`, { permissions });

// --- Security & audit (US-00003, US-00004, US-00005) -------------------------------------------------
export const getMfaConfig = (tenantId) => api.get('/api/v1/mfa/config', { query: { tenantId } });
export const getSessionConfig = (tenantId) => api.get('/api/v1/security/session-config', { query: { tenantId } });
export const queryAuditLogs = (filters = {}) => api.get('/api/v1/audit/logs', { query: filters });

// --- Campus / branches (US-00009) --------------------------------------------------------------------
export const listBranches = (tenantId) => api.get(`/api/v1/tenants/${tenantId}/branches`);

// --- Regional preferences (Settings → General) -------------------------------------------------------
export const getRegionalSettings = (tenantId) => api.get(`/api/v1/tenants/${tenantId}/regional-settings`);
export const saveRegionalSettings = (tenantId, settings) => api.put(`/api/v1/tenants/${tenantId}/regional-settings`, settings);
