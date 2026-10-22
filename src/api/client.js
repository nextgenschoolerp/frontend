// Thin fetch wrapper for the School ERP services.
// Every service answers with { success, message, data } or an ApiErrorResponse
// { success: false, status, errorCode, message, validationErrors }.
// Every call carries X-Span-Id (the signed-in session) and a new X-Trace-Id (see tracing.js).
import { TRACE_HEADER, traceHeaders } from './tracing.js';

const SESSION_KEY = 'oakridge.session';
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

function apiUrl(path) {
  const baseUrl = API_BASE_URL ? new URL(API_BASE_URL, window.location.origin) : window.location.origin;
  return new URL(path, baseUrl);
}

export class ApiError extends Error {
  constructor(status, body, traceId) {
    // A 5xx without the JSON envelope comes from the dev proxy when the backend service is not running
    const unreachable = status === 0 || (status >= 500 && !body);
    super(body?.message || (unreachable ? 'Cannot reach the server. Check that the service is running.' : `Request failed (${status})`));
    this.status = status;
    this.code = body?.errorCode;
    this.validationErrors = body?.validationErrors || [];
    this.traceId = body?.traceId || traceId; // the X-Trace-Id of the failed call: find it in the service log
  }

  /** First field-level message, falling back to the general message. */
  get detail() {
    return this.validationErrors[0]?.message || this.message;
  }
}

let onUnauthorized = () => {};
/** Called when an authenticated request gets 401 (expired or revoked token). */
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

function storedToken() {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY));
    return s?.token || null;
  } catch {
    return null;
  }
}

export async function request(method, path, { body, query, auth = true, token } = {}) {
  const url = apiUrl(path);
  Object.entries(query || {}).forEach(([k, v]) => v !== undefined && v !== null && v !== '' && url.searchParams.set(k, v));
  const trace = traceHeaders();
  const headers = { Accept: 'application/json', ...trace };
  const bearer = token || (auth ? storedToken() : null);
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(url.href, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError(0, null, trace[TRACE_HEADER]);
  }
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON error page */ }

  if (!res.ok || json?.success === false) {
    const err = new ApiError(res.status, json, trace[TRACE_HEADER]);
    if (res.status === 401 && bearer) onUnauthorized(err);
    throw err;
  }
  return json?.data ?? json;
}

/** GET a file with the bearer token (photos, document downloads); returns a Blob. */
export async function fetchBlob(path) {
  const bearer = storedToken();
  const trace = traceHeaders();
  let res;
  try {
    res = await fetch(apiUrl(path).href, { headers: bearer ? { ...trace, Authorization: `Bearer ${bearer}` } : trace });
  } catch {
    throw new ApiError(0, null, trace[TRACE_HEADER]);
  }
  if (!res.ok) {
    let json = null;
    try { json = await res.json(); } catch { /* binary or empty */ }
    const err = new ApiError(res.status, json, trace[TRACE_HEADER]);
    if (res.status === 401 && bearer) onUnauthorized(err);
    throw err;
  }
  return res.blob();
}

/** multipart/form-data upload (the browser sets the boundary header); POST unless `method` says otherwise. */
export async function upload(path, formData, { query, method = 'POST' } = {}) {
  const url = apiUrl(path);
  Object.entries(query || {}).forEach(([k, v]) => v !== undefined && v !== null && v !== '' && url.searchParams.set(k, v));
  const trace = traceHeaders();
  const headers = { Accept: 'application/json', ...trace };
  const bearer = storedToken();
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  let res;
  try {
    res = await fetch(url.href, { method, headers, body: formData });
  } catch {
    throw new ApiError(0, null, trace[TRACE_HEADER]);
  }
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON error page */ }
  if (!res.ok || json?.success === false) {
    const err = new ApiError(res.status, json, trace[TRACE_HEADER]);
    if (res.status === 401 && bearer) onUnauthorized(err);
    throw err;
  }
  return json?.data ?? json;
}

export const api = {
  get: (path, opts) => request('GET', path, opts),
  post: (path, body, opts) => request('POST', path, { ...opts, body }),
  put: (path, body, opts) => request('PUT', path, { ...opts, body }),
  patch: (path, body, opts) => request('PATCH', path, { ...opts, body }),
  del: (path, opts) => request('DELETE', path, opts),
};

export { SESSION_KEY };
