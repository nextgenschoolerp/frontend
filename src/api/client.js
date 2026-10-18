// Thin fetch wrapper for the School ERP services.
// Every service answers with { success, message, data } or an ApiErrorResponse
// { success: false, status, errorCode, message, validationErrors }.

const SESSION_KEY = 'oakridge.session';

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.message || (status === 0 ? 'Cannot reach the server. Check that the service is running.' : `Request failed (${status})`));
    this.status = status;
    this.code = body?.errorCode;
    this.validationErrors = body?.validationErrors || [];
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
  const url = new URL(path, window.location.origin);
  Object.entries(query || {}).forEach(([k, v]) => v !== undefined && v !== null && v !== '' && url.searchParams.set(k, v));
  const headers = { Accept: 'application/json' };
  const bearer = token || (auth ? storedToken() : null);
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(url.pathname + url.search, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError(0);
  }
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON error page */ }

  if (!res.ok || json?.success === false) {
    const err = new ApiError(res.status, json);
    if (res.status === 401 && bearer) onUnauthorized(err);
    throw err;
  }
  return json?.data ?? json;
}

/** multipart/form-data upload (the browser sets the boundary header). */
export async function upload(path, formData, { query } = {}) {
  const url = new URL(path, window.location.origin);
  Object.entries(query || {}).forEach(([k, v]) => v !== undefined && v !== null && v !== '' && url.searchParams.set(k, v));
  const headers = { Accept: 'application/json' };
  const bearer = storedToken();
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  let res;
  try {
    res = await fetch(url.pathname + url.search, { method: 'POST', headers, body: formData });
  } catch {
    throw new ApiError(0);
  }
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON error page */ }
  if (!res.ok || json?.success === false) {
    const err = new ApiError(res.status, json);
    if (res.status === 401 && bearer) onUnauthorized(err);
    throw err;
  }
  return json?.data ?? json;
}

export const api = {
  get: (path, opts) => request('GET', path, opts),
  post: (path, body, opts) => request('POST', path, { ...opts, body }),
  put: (path, body, opts) => request('PUT', path, { ...opts, body }),
  del: (path, opts) => request('DELETE', path, opts),
};

export { SESSION_KEY };
