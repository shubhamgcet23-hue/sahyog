import { useCallback, useEffect, useRef, useState } from 'react';
import { api, errMsg } from '../services/api';

/**
 * Loads data from an API call and re-runs when `deps` change.
 *   const { data, meta, loading, error, reload, setData } = useFetch(() => api.get('/resources'), [page]);
 * Stale responses (an older request finishing after a newer one) are ignored.
 */
export function useFetch(fn, deps = [], { enabled = true } = {}) {
  const [state, setState] = useState({ data: null, meta: null, loading: enabled, error: null });
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const seq = useRef(0);

  const run = useCallback(async () => {
    const id = ++seq.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const r = await fnRef.current();
      if (id === seq.current) setState({ data: r.data, meta: r.meta || null, loading: false, error: null });
    } catch (e) {
      if (id === seq.current) setState((s) => ({ ...s, loading: false, error: errMsg(e) }));
    }
  }, []);

  useEffect(() => {
    if (enabled) run();
    else setState((s) => ({ ...s, loading: false }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  const setData = useCallback((updater) => setState((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater })), []);
  return { ...state, reload: run, setData };
}

export function useDebounce(value, delay = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

export function useCategories() {
  const [cats, setCats] = useState(null);
  useEffect(() => {
    let alive = true;
    api.get('/categories').then((r) => { if (alive) setCats(r.data); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  return cats;
}
