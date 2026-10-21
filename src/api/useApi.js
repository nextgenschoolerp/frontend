import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Loads data from an API call when `enabled`. `error.status === 403` means the signed-in role may not
 * use the endpoint; callers show a role notice instead of a failure.
 *
 * React StrictMode (development) mounts every component twice, which would send each request twice:
 * while a request for the same deps is still in flight it is reused instead. `reload()` always sends a new one.
 * A response that arrives after a newer request was started (deps changed, reload) is ignored.
 */
export function useApi(fn, deps, enabled = true) {
  const [state, setState] = useState({ data: null, error: null, loading: enabled });
  const inflight = useRef(null); // { key, promise } of the latest unsettled request
  const key = JSON.stringify([enabled, ...deps]);
  const load = useCallback(async (force = false) => {
    if (!enabled) { inflight.current = null; setState({ data: null, error: null, loading: false }); return; }
    setState((s) => ({ ...s, loading: true, error: null }));
    let promise = !force && inflight.current?.key === key ? inflight.current.promise : null;
    if (!promise) {
      promise = Promise.resolve().then(fn);
      inflight.current = { key, promise };
    }
    const latest = () => inflight.current?.promise === promise;
    try {
      const data = await promise;
      if (latest()) setState({ data, error: null, loading: false });
    } catch (error) {
      if (latest()) setState({ data: null, error, loading: false });
    } finally {
      if (latest()) inflight.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => { load(); }, [load]);
  const reload = useCallback(() => load(true), [load]);
  return { ...state, reload };
}
