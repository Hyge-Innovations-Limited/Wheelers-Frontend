"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * A driver's document, seen without leaving the page: point at the link or
 * thumbnail and a large preview opens beside the pointer (a photo, or the PDF
 * itself). Moving away closes it. On a touchscreen, a tap opens it and a tap
 * anywhere closes it. The link still opens the file in a new tab when clicked.
 */
export function DocPeek({
  url,
  isPdf = false,
  label,
  children,
}: {
  url: string;
  isPdf?: boolean;
  label: string;
  children: ReactNode;
}) {
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  const opening = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (opening.current) clearTimeout(opening.current);
  }, []);

  useEffect(() => {
    if (!at) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAt(null);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [at]);

  // A short pause first, so sweeping the pointer across a page does not flash previews.
  const show = (x: number, y: number) => {
    if (opening.current) clearTimeout(opening.current);
    opening.current = setTimeout(() => setAt({ x, y }), 140);
  };
  const hide = () => {
    if (opening.current) clearTimeout(opening.current);
    setAt(null);
  };

  // Beside the pointer, on whichever side has room, and never off the screen.
  const width = isPdf ? 560 : 520;
  const height = isPdf ? 680 : 560;
  let left = 0;
  let top = 0;
  if (at && typeof window !== "undefined") {
    left = at.x + 24 + width > window.innerWidth ? at.x - 24 - width : at.x + 24;
    left = Math.max(12, Math.min(left, window.innerWidth - width - 12));
    top = Math.max(12, Math.min(at.y - height / 3, window.innerHeight - height - 12));
  }

  return (
    <span
      className="admin-peek-trigger"
      onMouseEnter={(event) => show(event.clientX, event.clientY)}
      onMouseMove={(event) => {
        if (at) setAt({ x: event.clientX, y: event.clientY });
      }}
      onMouseLeave={hide}
      onFocus={(event) => {
        const box = event.currentTarget.getBoundingClientRect();
        show(box.right, box.top);
      }}
      onBlur={hide}>
      {children}
      {at && typeof document !== "undefined"
        ? createPortal(
            <div className="admin-peek" role="dialog" aria-label={`Preview: ${label}`} style={{ left, top, width, height }}>
              <div className="admin-peek-head">
                <strong>{label}</strong>
                <span>Click to open in a new tab</span>
              </div>
              {isPdf ? (
                <iframe src={url} title={label} className="admin-peek-pdf" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt={label} className="admin-peek-img" />
              )}
            </div>,
            document.body,
          )
        : null}
    </span>
  );
}
