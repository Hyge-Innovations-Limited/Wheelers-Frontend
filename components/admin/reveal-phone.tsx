"use client";

import { useState } from "react";
import { adminJson } from "@/lib/admin-api";

/**
 * A phone number as the support desk sees it: masked ("+234 708 *** 6640"),
 * with a button that asks the server for the full number to call them back.
 * The server records every number shown, with who asked, on Team activity.
 */
export function RevealPhone({ userId, masked }: { userId: string; masked: string | null }) {
  const [full, setFull] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!masked) return <>—</>;
  if (full) return <a href={`tel:${full}`}>{full}</a>;

  async function show() {
    setBusy(true);
    setFailed(false);
    try {
      const { phone } = await adminJson<{ phone: string | null }>(`/admin/desk/people/${userId}/phone`, { method: "POST" });
      setFull(phone ?? masked);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <span>{masked}</span>
      <button type="button" className="admin-link-btn" onClick={() => void show()} disabled={busy}>
        {busy ? "Showing…" : failed ? "Try again" : "Show number"}
      </button>
    </span>
  );
}
