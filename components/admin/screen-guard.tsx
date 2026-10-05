"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { adminFetch } from "@/lib/admin-api";

/**
 * Quiet watch over the admin panel. Nothing is blocked and nothing on screen
 * says it is there: pages work as any website does. Instead,
 *
 *  - every page opened is recorded for the owners' Team activity page;
 *  - screenshot shortcuts the browser can see (Print Screen, Cmd+Shift+3/4/5,
 *    Win+Shift+S, print) are recorded and flagged red on the Team page;
 *  - a mark too faint to notice covers the content: this admin's code and the
 *    time. A screenshot or photo that turns up anywhere, however it was taken,
 *    can be traced to the session it came from (owners: Team → Trace a mark).
 *
 * A page cannot see a phone's screenshot buttons, screen recording or a camera
 * pointed at the monitor. The mark is the answer to those.
 */

const CAPTURE_DIGITS = new Set(["3", "4", "5", "6", "#", "$", "%", "^"]);
const MODIFIERS = new Set(["Meta", "Shift", "Control", "Alt", "OS", "CapsLock"]);

function report(body: Record<string, unknown>) {
  void adminFetch("/admin/activity", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    keepalive: true,
  }).catch(() => undefined);
}

export function ScreenGuard({ markCode }: { markCode: string | null }) {
  const pathname = usePathname();
  const lastCapture = useRef(0);
  const [minute, setMinute] = useState(() => Math.floor(Date.now() / 60_000));

  // A page opened.
  useEffect(() => {
    if (pathname) report({ kind: "page", page: pathname });
  }, [pathname]);

  useEffect(() => {
    let pendingCombo: ReturnType<typeof setTimeout> | undefined;
    const capture = (key: string) => {
      const now = Date.now();
      if (now - lastCapture.current < 5_000) return;
      lastCapture.current = now;
      report({ kind: "capture", key, page: window.location.pathname });
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key;
      const lower = key.length === 1 ? key.toLowerCase() : key;
      if (key === "PrintScreen") return capture("PrintScreen");
      if (event.metaKey && event.shiftKey) {
        if (MODIFIERS.has(key)) {
          // macOS swallows the digit of a capture shortcut: a Cmd+Shift with
          // nothing straight after is most likely one.
          clearTimeout(pendingCombo);
          pendingCombo = setTimeout(() => capture("Meta+Shift"), 400);
          return;
        }
        clearTimeout(pendingCombo);
        if (CAPTURE_DIGITS.has(key) || lower === "s") capture(`Meta+Shift+${key}`);
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && lower === "s") capture("Ctrl+Shift+S");
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === "PrintScreen") capture("PrintScreen");
    };
    const onBeforePrint = () => capture("print");

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    window.addEventListener("beforeprint", onBeforePrint);
    const clock = setInterval(() => setMinute(Math.floor(Date.now() / 60_000)), 30_000);
    return () => {
      clearTimeout(pendingCombo);
      clearInterval(clock);
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("beforeprint", onBeforePrint);
    };
  }, []);

  if (!markCode) return null;

  // The mark: code, date and time, in ink so faint it reads as nothing on the
  // page, but comes up when a picture of it is darkened.
  const stamp = new Date(minute * 60_000);
  const when = stamp.toLocaleString("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).replace(",", "");
  const text = `WH ${markCode.replace(/[^0-9A-Z]/g, "")} ${when.replace(/[^0-9: -]/g, "")}`;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='360' height='180'><text x='16' y='96' transform='rotate(-14 180 90)' font-family='monospace' font-size='13' fill='rgba(13,13,13,0.022)'>${text}</text></svg>`;
  return <div className="admin-mark" style={{ backgroundImage: `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")` }} aria-hidden />;
}
