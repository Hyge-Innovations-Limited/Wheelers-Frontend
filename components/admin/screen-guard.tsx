"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * Screenshot protection for the admin panel, as far as a web page can go.
 *
 * A browser cannot stop the operating system from taking a screenshot (that is
 * Android's FLAG_SECURE, which only native apps have). So, like the iOS
 * approach, this detects and hides instead, and marks every screen with who is
 * looking at it:
 *
 *  - Hide: the page is covered the moment it loses focus or is hidden: switching
 *    apps or tabs, the app switcher on a phone, and the Windows and macOS
 *    capture tools, which take focus from the browser before they capture.
 *  - Keys: Print Screen, and Cmd+Shift on a Mac (the start of Cmd+Shift+3/4/5),
 *    cover the page at once; Print Screen also overwrites the clipboard.
 *  - Print: printing the panel prints a notice instead of the page.
 *  - Watermark: the admin's name and today's date across every screen, faint,
 *    so a photo or screenshot that gets out says whose session it came from.
 *
 * None of this stops a phone camera pointed at the monitor; the watermark is
 * what makes that traceable.
 */
export function ScreenGuard({ viewer }: { viewer: string }) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const hideFor = (ms: number) => {
      setHidden(true);
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (document.hasFocus() && document.visibilityState === "visible") setHidden(false);
      }, ms);
    };
    const onBlur = () => setHidden(true);
    const onFocus = () => setHidden(false);
    const onVisibility = () => setHidden(document.visibilityState !== "visible" || !document.hasFocus());
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "PrintScreen") {
        hideFor(2500);
        void navigator.clipboard?.writeText("Screenshots of the Wheelers admin are not allowed.").catch(() => undefined);
      } else if (event.metaKey && event.shiftKey) {
        // Cmd+Shift is the start of every macOS screenshot shortcut.
        hideFor(2500);
      }
    };
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("keyup", onKey, true);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("keyup", onKey, true);
    };
  }, []);

  // A tile of faint, tilted text, repeated across the screen.
  const watermark = useMemo(() => {
    const day = new Date().toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
    const text = `${viewer} · ${day} · Wheelers admin`.replace(/[<&>"']/g, "");
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='420' height='220'><text x='20' y='130' transform='rotate(-24 210 110)' font-family='sans-serif' font-size='15' font-weight='600' fill='rgba(13,13,13,0.07)'>${text}</text></svg>`;
    return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
  }, [viewer]);

  return (
    <>
      <div className="admin-watermark" style={{ backgroundImage: watermark }} aria-hidden />
      <div className="admin-print-notice" aria-hidden>
        Printing the Wheelers admin is disabled.
      </div>
      {hidden ? (
        <button type="button" className="admin-screen-guard" onClick={() => setHidden(false)}>
          <span className="admin-screen-guard-card">
            <strong>Content hidden</strong>
            <span>The admin is hidden while this window is not in use. Click to continue.</span>
          </span>
        </button>
      ) : null}
    </>
  );
}
