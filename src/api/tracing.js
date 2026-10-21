// Trace headers sent on every API call; the services' TraceCorrelationFilter (ms-core) reads them,
// puts them in the log MDC (traceId / spanId) and echoes them back in the response headers.
//   X-Span-Id  – 16 hex chars, one per signed-in session: every call of the session shares it
//   X-Trace-Id – 32 hex chars, new for every API call
// Search a service log for the span id to see everything one user did in a session, or for the
// trace id (shown with API errors) to find one request.

export const TRACE_HEADER = 'X-Trace-Id';
export const SPAN_HEADER = 'X-Span-Id';
const SPAN_KEY = 'oakridge.spanId';
const SESSION_KEY = 'oakridge.session';

function hex(chars) {
  const bytes = new Uint8Array(chars / 2);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export const newTraceId = () => hex(32);

/** The session's span: the one saved with the signed-in session, else the tab's current one (sign-in in progress). */
export function spanId() {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY));
    if (session?.spanId) return session.spanId;
    let span = sessionStorage.getItem(SPAN_KEY);
    if (!span) { span = hex(16); sessionStorage.setItem(SPAN_KEY, span); }
    return span;
  } catch {
    // Storage blocked: keep one span for the page's lifetime
    spanId.fallback = spanId.fallback || hex(16);
    return spanId.fallback;
  }
}

/** Starts a new session span (sign-in); the sign-in call and every call after it carry it. */
export function startSpan() {
  const span = hex(16);
  try { sessionStorage.setItem(SPAN_KEY, span); } catch { spanId.fallback = span; }
  return span;
}

/** Ends the session span (sign-out); the next call starts a fresh one. */
export function endSpan() {
  try { sessionStorage.removeItem(SPAN_KEY); } catch { /* storage unavailable */ }
  spanId.fallback = null;
}

/** Headers for one API call: the session span and a new trace id. */
export function traceHeaders() {
  return { [SPAN_HEADER]: spanId(), [TRACE_HEADER]: newTraceId() };
}
