import { useCallback, useEffect, useState } from 'react';

/**
 * Loads data from an API call when `enabled`. `error.status === 403` means the signed-in role may not
 * use the endpoint; callers show a role notice instead of a failure.
 */
export function useApi(fn, deps, enabled = true) {
  const [state, setState] = useState({ data: null, error: null, loading: enabled });
  const load = useCallback(async () => {
    if (!enabled) { setState({ data: null, error: null, loading: false }); return; }
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      setState({ data: await fn(), error: null, loading: false });
    } catch (error) {
      setState({ data: null, error, loading: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);
  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load };
}
