"use client";

import { useEffect, useRef, useState } from "react";
import { adminFetch } from "@/lib/admin-api";

/**
 * Screenshot protection for the admin panel, as far as a web page can go.
 *
 * A browser cannot stop the operating system from taking a screenshot: that
 * power belongs to native apps (Android's FLAG_SECURE, a desktop window's
 * content protection). What a page can do is take its content off the screen
 * before the capture happens, keep it off for as long as a capture could still
 * be running, and make sure anything that does get out names who took it.
 *
 *  - Off the screen, not blurred. The panel's content is set to
 *    `visibility: hidden` by an attribute on <html>, written in the same tick
 *    as the key press, so there is nothing legible under the cover.
 *  - Capture shortcuts LOCK the page. Cmd+Shift (macOS 3/4/5, and Win+Shift+S),
 *    Print Screen, Ctrl+Shift+S, print and save: the page stays hidden for
 *    LOCK_MS, longer than the longest timed capture (10 s), and then waits for
 *    a click. Cmd+Shift followed by an ordinary key (reload, reopen tab) is
 *    let go at once.
 *  - Leaving the window hides it; coming back shows it.
 *  - Every attempt is reported to the server with the admin's name.
 *  - Watermark: the admin's name, the date and the time across every screen,
 *    so a photo or a capture that gets out says whose session it came from
 *    and when.
 *
 * What none of this stops: a phone's hardware screenshot buttons (a mobile
 * browser is told nothing), a capture tool started with the mouse on a timer,
 * a browser extension, or a camera pointed at the monitor. The watermark and
 * the record of attempts are the answer to those.
 */

const LOCK_MS = 12_000;
const CAPTURE_DIGITS = new Set(["3", "4", "5", "6", "#", "$", "%", "^"]);
const MODIFIERS = new Set(["Meta", "Shift", "Control", "Alt", "OS", "CapsLock"]);

type Reason = "away" | "capture";

function setCover(on: boolean) {
  if (on) document.documentElement.setAttribute("data-screen-guard", "on");
  else document.documentElement.removeAttribute("data-screen-guard");
}

export function ScreenGuard({ viewer }: { viewer: string }) {
  const [reason, setReason] = useState<Reason | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [minute, setMinute] = useState(() => Math.floor(Date.now() / 60_000));
  const lockedUntil = useRef(0);
  const lastReport = useRef(0);

  useEffect(() => {
    let tick: ReturnType<typeof setInterval> | undefined;
    let pendingCombo: ReturnType<typeof setTimeout> | undefined;

    const away = () => document.visibilityState !== "visible" || !document.hasFocus();

    const report = (kind: string) => {
      const now = Date.now();
      if (now - lastReport.current < 10_000) return;
      lastReport.current = now;
      void adminFetch("/admin/security/capture-attempt", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, page: window.location.pathname }),
        keepalive: true,
      }).catch(() => undefined);
    };

    const startCountdown = () => {
      clearInterval(tick);
      const update = () => {
        const left = Math.max(0, Math.ceil((lockedUntil.current - Date.now()) / 1000));
        setSecondsLeft(left);
        if (left === 0) clearInterval(tick);
      };
      update();
      tick = setInterval(update, 500);
    };

    /** Hidden now, and for LOCK_MS more, whatever happens to focus in between. */
    const lock = (kind: string) => {
      setCover(true); // before React, before the next paint
      lockedUntil.current = Date.now() + LOCK_MS;
      setReason("capture");
      startCountdown();
      report(kind);
    };

    const hideWhileAway = () => {
      setCover(true);
      setReason((current) => current ?? "away");
    };

    const showIfAllowed = () => {
      if (Date.now() < lockedUntil.current || away()) return;
      setReason((current) => {
        // A capture lock is only ever lifted by the click on the cover.
        if (current === "capture") return current;
        setCover(false);
        return null;
      });
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key;
      const lower = key.length === 1 ? key.toLowerCase() : key;

      if (key === "PrintScreen") return lock("print-screen");

      if (event.metaKey && event.shiftKey) {
        if (MODIFIERS.has(key)) {
          // The start of every macOS capture shortcut, and of Win+Shift+S. The
          // system swallows the key that follows, so the page never sees it:
          // hide now, and lock unless an ordinary key turns up straight after.
          setCover(true);
          setReason((current) => current ?? "away");
          clearTimeout(pendingCombo);
          pendingCombo = setTimeout(() => lock("capture-shortcut"), 350);
          return;
        }
        if (CAPTURE_DIGITS.has(key) || lower === "s") {
          clearTimeout(pendingCombo);
          return lock("capture-shortcut");
        }
        // Cmd+Shift+R, Cmd+Shift+T and friends: not a capture.
        clearTimeout(pendingCombo);
        if (Date.now() >= lockedUntil.current) showIfAllowed();
        return;
      }

      const command = event.metaKey || event.ctrlKey;
      if (command && event.shiftKey && lower === "s") return lock("browser-capture");
      if (command && (lower === "p" || lower === "s")) {
        event.preventDefault();
        return lock(lower === "p" ? "print" : "save-page");
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      // Windows only tells the page about Print Screen when the key comes up,
      // after the capture: the clipboard is overwritten so it cannot be pasted.
      if (event.key === "PrintScreen") {
        lock("print-screen");
        void navigator.clipboard?.writeText("Screenshots of the Wheelers admin are not allowed.").catch(() => undefined);
      }
    };

    const onBeforePrint = () => lock("print");
    const onContextMenu = (event: MouseEvent) => event.preventDefault();
    const onDragStart = (event: DragEvent) => event.preventDefault();
    const onVisibility = () => (away() ? hideWhileAway() : showIfAllowed());

    window.addEventListener("blur", hideWhileAway);
    window.addEventListener("focus", showIfAllowed);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    window.addEventListener("beforeprint", onBeforePrint);
    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("dragstart", onDragStart);

    const clock = setInterval(() => setMinute(Math.floor(Date.now() / 60_000)), 15_000);
    if (away()) hideWhileAway();

    return () => {
      clearInterval(tick);
      clearInterval(clock);
      clearTimeout(pendingCombo);
      setCover(false);
      window.removeEventListener("blur", hideWhileAway);
      window.removeEventListener("focus", showIfAllowed);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("beforeprint", onBeforePrint);
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("dragstart", onDragStart);
    };
  }, []);

  const reveal = () => {
    if (Date.now() < lockedUntil.current) return;
    if (document.visibilityState !== "visible" || !document.hasFocus()) return;
    setCover(false);
    setReason(null);
  };

  // A tile of tilted text, repeated across the screen, in two layers. The second
  // is moved so that its lines fall midway between the first's: a line every
  // 55 pixels, so no crop of a useful size is free of it.
  const stamp = new Date(minute * 60_000);
  const day = stamp.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
  const time = stamp.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit", hour12: false });
  const text = `${viewer} · ${day} ${time} · Wheelers admin`.replace(/[<&>"']/g, "");
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='110'><text x='24' y='60' transform='rotate(-12 200 55)' font-family='sans-serif' font-size='13' font-weight='700' fill='rgba(13,13,13,0.10)'>${text}</text></svg>`;
  const tile = `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;

  const locked = reason === "capture" && secondsLeft > 0;

  return (
    <>
      <div
        className="admin-watermark"
        style={{ backgroundImage: `${tile}, ${tile}`, backgroundPosition: "0 0, 200px 13px" }}
        aria-hidden
      />
      <div className="admin-print-notice" aria-hidden>
        Printing the Wheelers admin is disabled.
      </div>
      {reason ? (
        <button type="button" className="admin-screen-guard" onClick={reveal} disabled={locked}>
          <span className="admin-screen-guard-card">
            {reason === "capture" ? (
              <>
                <strong>Screenshots are not allowed</strong>
                <span>
                  This attempt has been recorded against {viewer}.{" "}
                  {locked ? `The admin will be available again in ${secondsLeft}s.` : "Click to continue."}
                </span>
              </>
            ) : (
              <>
                <strong>Content hidden</strong>
                <span>The admin is hidden while this window is not in use. Click to continue.</span>
              </>
            )}
          </span>
        </button>
      ) : null}
    </>
  );
}
