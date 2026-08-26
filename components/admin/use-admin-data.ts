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
export function useAdminData<T>(
  path: string | null,
  deps: unknown[] = [],
  options: {
    /**
     * Re-fetch every N milliseconds.
     *
     * Off by default — most panel pages are things an operator reads once. Turn
     * it on for the pages that answer "what is happening right now", where a
     * number that was true when the tab was opened an hour ago is worse than no
     * number at all.
     */
    refreshMs?: number;
  } = {},
): State<T> & { refresh: () => void } {
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

  // Background refresh. Deliberately silent: it does not flip `loading`, so the
  // page never flashes a spinner over numbers that are already on screen, and a
  // failed poll leaves the last good data alone rather than blanking the page.
  useEffect(() => {
    if (!path || !options.refreshMs) return;

    const timer = setInterval(() => {
      const requestId = ++requestRef.current;
      adminJson<T>(path)
        .then((data) => {
          if (requestId !== requestRef.current) return;
          setState({ data, error: null, loading: false });
        })
        .catch(() => {
          // Keep what is on screen. A blip is not worth wiping the dashboard.
        });
    }, options.refreshMs);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, options.refreshMs, ...deps]);

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
