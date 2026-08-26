"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { adminJson } from "@/lib/admin-api";

interface State<T> {
  data: T | null;
  error: unknown;
  loading: boolean;
}

/**
 * Fetch-on-mount with the bits every page was re-implementing by hand: an
 * error that survives to the UI, a manual refresh, and cancellation so a
 * fast filter change cannot let a stale response overwrite a newer one.
 */
export function useAdminData<T>(path: string | null, deps: unknown[] = []): State<T> & { refresh: () => void } {
  const [state, setState] = useState<State<T>>({ data: null, error: null, loading: path !== null });
  const [nonce, setNonce] = useState(0);
  const requestRef = useRef(0);

  useEffect(() => {
    if (!path) {
      setState({ data: null, error: null, loading: false });
      return;
    }

    const requestId = ++requestRef.current;
    let cancelled = false;
    setState((prev) => ({ data: prev.data, error: null, loading: true }));

    adminJson<T>(path)
      .then((data) => {
        if (cancelled || requestId !== requestRef.current) return;
        setState({ data, error: null, loading: false });
      })
      .catch((error) => {
        if (cancelled || requestId !== requestRef.current) return;
        setState({ data: null, error, loading: false });
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, nonce, ...deps]);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);
  return { ...state, refresh };
}

/** Debounces a value — used so typing in search does not fire a request per key. */
export function useDebounced<T>(value: T, delayMs = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
