"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Card, Spinner } from "@/components/admin/ui";
import { ADMIN_LOCKED_EVENT, adminFetch } from "@/lib/admin-api";

/**
 * Chats, Trip recordings and the money pages: the admin's password again to
 * open them, and they close after five minutes with no mouse, key, scroll or
 * touch. Closing takes the page's content off the screen. The server decides
 * too: a locked area's API answers 423 until this login is unlocked, and a
 * "still here" ping (at most once a minute, only while the admin is active)
 * keeps its five minutes going.
 */

export const IDLE_LOCK_MS = 5 * 60 * 1000;
const PING_EVERY_MS = 60 * 1000;
const CHECK_EVERY_MS = 15 * 1000;
const ACTIVITY = ["mousemove", "mousedown", "keydown", "wheel", "touchstart", "scroll"] as const;

type State = "checking" | "locked" | "open";

async function post(path: string, body?: unknown): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await adminFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: res.status, body: ((await res.json().catch(() => ({}))) ?? {}) as Record<string, unknown> };
}

export function LockedArea({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>("checking");
  // Set when the area opens (below).
  const lastActive = useRef(0);
  const lastPing = useRef(0);

  const lock = useCallback((tellServer: boolean) => {
    setState("locked");
    if (tellServer) void post("/admin/lock").catch(() => undefined);
  }, []);

  // Opened: already unlocked by this login (another locked page a moment ago)?
  useEffect(() => {
    let cancelled = false;
    post("/admin/unlock/ping")
      .then((r) => { if (!cancelled) setState(r.body.unlocked === true ? "open" : "locked"); })
      .catch(() => { if (!cancelled) setState("locked"); });
    return () => { cancelled = true; };
  }, []);

  // The server said locked (its five minutes ran out, or Lock elsewhere in this login).
  useEffect(() => {
    const onLocked = () => setState("locked");
    window.addEventListener(ADMIN_LOCKED_EVENT, onLocked);
    return () => window.removeEventListener(ADMIN_LOCKED_EVENT, onLocked);
  }, []);

  // Open: watch for five idle minutes; while active, tell the server once a minute.
  useEffect(() => {
    if (state !== "open") return;
    lastActive.current = Date.now();
    lastPing.current = Date.now();
    const seen = () => { lastActive.current = Date.now(); };
    for (const name of ACTIVITY) window.addEventListener(name, seen, { passive: true, capture: true });
    const check = () => {
      const now = Date.now();
      if (now - lastActive.current >= IDLE_LOCK_MS) return lock(true);
      if (lastActive.current > lastPing.current && now - lastPing.current >= PING_EVERY_MS) {
        lastPing.current = now;
        void post("/admin/unlock/ping").then((r) => { if (r.body.unlocked !== true) lock(false); }).catch(() => undefined);
      }
    };
    const timer = setInterval(check, CHECK_EVERY_MS);
    // Back to the tab after a while: decided at once, not at the next tick.
    const onVisible = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      for (const name of ACTIVITY) window.removeEventListener(name, seen, { capture: true });
    };
  }, [state, lock]);

  if (state === "checking") return <Spinner />;
  if (state === "locked") return <UnlockCard onOpen={() => setState("open")} />;
  return <>{children}</>;
}

function UnlockCard({ onOpen }: { onOpen: () => void }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function unlock(event: FormEvent) {
    event.preventDefault();
    if (busy || !password) return;
    setBusy(true);
    setProblem(null);
    try {
      const r = await post("/admin/unlock", { password });
      if (r.status === 200) return onOpen();
      const said = typeof r.body.error === "string" ? r.body.error : "That did not work. Try again.";
      const left = typeof r.body.triesLeft === "number" ? ` ${r.body.triesLeft} ${r.body.triesLeft === 1 ? "try" : "tries"} left.` : "";
      setProblem(`${said}${left}`);
      setPassword("");
    } catch {
      setProblem("Cannot reach the Wheelers API. Check your connection.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "48px auto" }}>
      <Card title="Locked" padded>
        <form onSubmit={(event) => void unlock(event)} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input
            className="admin-input"
            type="password"
            autoComplete="current-password"
            autoFocus
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Your password"
            aria-label="Your password"
          />
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <button type="submit" className="admin-btn-primary" disabled={busy || !password}>{busy ? "Checking…" : "Unlock"}</button>
            {problem ? <span role="alert" style={{ color: "#CC3333", fontSize: 14 }}>{problem}</span> : null}
          </div>
        </form>
      </Card>
    </div>
  );
}
