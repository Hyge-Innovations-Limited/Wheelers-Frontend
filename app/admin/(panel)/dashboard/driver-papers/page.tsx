"use client";

import Link from "next/link";
import { useState } from "react";

import { adminFetch } from "@/lib/admin-api";

import { Card, EmptyState, ErrorState, PageHeader, RefreshButton, Spinner, StatCard, StatGrid, TableWrap } from "@/components/admin/ui";
import { useAdminData } from "@/components/admin/use-admin-data";

/**
 * Driver papers: the papers drivers have sent for their cars, as four lists.
 *   To check       sent and not yet looked at, oldest first
 *   Expiring soon  good, but running out within 30 days
 *   Expired        past their date: the driver has to send a new one
 *   Sent back      rejected and not yet sent again
 * Each row opens the driver, where a paper is opened, checked, approved or
 * sent back. Papers waiting can be ticked and approved together: only ones
 * still waiting and in date are approved, and each driver gets one message.
 * Beside each paper, the driver's latest checks (Prembly and by hand).
 */

type Filter = "waiting" | "expiring" | "expired" | "sentBack";

interface Row {
  driverId: string;
  driverName: string;
  phone: string | null;
  kycStatus: string;
  type: string;
  label: string;
  status: string;
  expired: boolean;
  uploadedAt: string;
  expiresOn: string | null;
  daysLeft: number | null;
  rejectionReason: string | null;
  checks?: Array<{ kind: string; paperType: string | null; source: string; outcome: string }>;
}
interface Queue { filter: Filter; counts: Record<Filter, number>; items: Row[] }

const TABS: Array<{ key: Filter; label: string; hint: string; empty: string }> = [
  { key: "waiting", label: "To check", hint: "Sent and waiting for an answer", empty: "Nothing is waiting to be checked." },
  { key: "expiring", label: "Expiring soon", hint: "Run out within 30 days", empty: "Nothing runs out in the next 30 days." },
  { key: "expired", label: "Expired", hint: "Past their date", empty: "No paper on file has expired." },
  { key: "sentBack", label: "Sent back", hint: "Waiting for the driver to send again", empty: "Nothing is out with a driver to fix." },
];

const OUTCOME: Record<string, { mark: string; color: string; word: string }> = {
  verified: { mark: "✓", color: "#0B7A55", word: "matches" },
  mismatch: { mark: "!", color: "#B04A00", word: "differs" },
  not_found: { mark: "✗", color: "#B00020", word: "not found" },
  failed: { mark: "✗", color: "#B00020", word: "failed" },
  error: { mark: "?", color: "#786F68", word: "could not check" },
};
const CHECK_NAME: Record<string, string> = { licence: "Licence", licenceFace: "Licence + face", plate: "Plate", insurance: "Insurance" };
const SOURCE_NAME: Record<string, string> = { autoreg: "AutoReg", dvis: "DVIS", niid: "NIID", other: "By hand" };

/** The checks that bear on this paper: its own (insurance, a hand check of it), and the licence and plate, which bear on all. */
function checksFor(row: Row) {
  return (row.checks ?? []).filter((c) => c.paperType === row.type || c.kind === "licence" || c.kind === "licenceFace" || c.kind === "plate");
}

const dayWords = (iso: string | null) =>
  iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "—";
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Lagos" });

export default function DriverPapersPage() {
  const [filter, setFilter] = useState<Filter>("waiting");
  const { data, error, loading, refresh } = useAdminData<Queue>(`/admin/driver-papers?filter=${filter}`, [filter], { refreshMs: 60_000 });
  const tab = TABS.find((t) => t.key === filter)!;
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const keyOf = (row: Row) => `${row.driverId}:${row.type}`;
  const pickable = filter === "waiting" ? data?.items ?? [] : [];
  const allPicked = pickable.length > 0 && pickable.every((row) => picked.has(keyOf(row)));
  const toggle = (key: string) => setPicked((all) => { const next = new Set(all); if (next.has(key)) next.delete(key); else next.add(key); return next; });

  const approvePicked = async () => {
    const items = pickable.filter((row) => picked.has(keyOf(row))).map((row) => ({ driverId: row.driverId, type: row.type }));
    if (!items.length) return;
    if (!window.confirm(`Approve ${items.length} paper${items.length === 1 ? "" : "s"}? Each driver gets one message.`)) return;
    setBusy(true); setNote(null);
    try {
      const res = await adminFetch("/admin/driver-papers/approve", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ items }) });
      const body = (await res.json().catch(() => null)) as { error?: string; approved?: unknown[]; skipped?: Array<{ why: string }> } | null;
      if (!res.ok) { setNote({ ok: false, text: body?.error ?? "Could not approve those." }); return; }
      const skipped = body?.skipped ?? [];
      setNote({ ok: true, text: `Approved ${body?.approved?.length ?? 0}.${skipped.length ? ` Passed over ${skipped.length} (${[...new Set(skipped.map((s) => s.why))].join(", ")}).` : ""}` });
      setPicked(new Set());
      refresh();
    } catch {
      setNote({ ok: false, text: "Could not reach the server." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Driver papers" subtitle="Hackney permits, licences, insurance and the rest, as drivers send them" actions={<RefreshButton onClick={refresh} busy={loading} />} />

      {data ? (
        <StatGrid>
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => { setFilter(t.key); setPicked(new Set()); setNote(null); }}
              aria-pressed={filter === t.key}
              style={{ all: "unset", cursor: "pointer", display: "block", borderRadius: 14, outline: filter === t.key ? "2px solid #0d0d0d" : "none", outlineOffset: 2 }}>
              <StatCard label={t.label} value={data.counts[t.key].toLocaleString("en-NG")} hint={t.hint} tone={t.key === "waiting" && data.counts.waiting > 0 ? "orange" : undefined} />
            </button>
          ))}
        </StatGrid>
      ) : null}

      {error && !data ? <ErrorState error={error} onRetry={refresh} /> : null}
      {!data && loading ? <Spinner label="Loading papers" /> : null}

      {data ? (
        <Card
          title={tab.label}
          right={filter === "waiting" && picked.size > 0 ? (
            <button type="button" className="admin-btn-approve" disabled={busy} onClick={() => void approvePicked()}>
              {busy ? "Approving…" : `Approve ${picked.size} selected`}
            </button>
          ) : `${data.items.length} shown`}>
          {note ? (
            <div style={{ marginBottom: 10, fontSize: 13.5, fontWeight: 600, color: note.ok ? "#0B7A55" : "#B00020" }}>{note.text}</div>
          ) : null}
          {data.items.length === 0 ? <EmptyState>{tab.empty}</EmptyState> : (
            <TableWrap>
              <table className="admin-table">
                <thead>
                  <tr>
                    {filter === "waiting" ? (
                      <th style={{ width: 32 }}>
                        <input
                          type="checkbox"
                          aria-label="Select every paper shown"
                          checked={allPicked}
                          onChange={() => setPicked(allPicked ? new Set() : new Set(pickable.map(keyOf)))}
                        />
                      </th>
                    ) : null}
                    <th>Driver</th>
                    <th>Paper</th>
                    <th>Checks</th>
                    <th>Sent</th>
                    <th>Expires</th>
                    {filter === "sentBack" ? <th>Told the driver</th> : null}
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((row) => (
                    <tr key={`${row.driverId}-${row.type}`}>
                      {filter === "waiting" ? (
                        <td>
                          <input type="checkbox" aria-label={`Select ${row.label} of ${row.driverName}`} checked={picked.has(keyOf(row))} onChange={() => toggle(keyOf(row))} />
                        </td>
                      ) : null}
                      <td>
                        <Link href={`/admin/dashboard/drivers/${row.driverId}#driver-papers`}>{row.driverName}</Link>
                        {row.phone ? <div style={{ fontSize: 12, color: "#786F68" }}>{row.phone}</div> : null}
                      </td>
                      <td>{row.label}</td>
                      <td style={{ fontSize: 12.5 }}>
                        {checksFor(row).length === 0 ? <span style={{ color: "#786F68" }}>None yet</span> : checksFor(row).map((c) => {
                          const look = OUTCOME[c.outcome] ?? OUTCOME.error!;
                          const name = c.kind === "manual" ? SOURCE_NAME[c.source] ?? "By hand" : CHECK_NAME[c.kind] ?? c.kind;
                          return (
                            <div key={`${c.kind}-${c.source}-${c.paperType}`} style={{ color: look.color, fontWeight: 600, whiteSpace: "nowrap" }}>
                              {look.mark} {name} {look.word}
                            </div>
                          );
                        })}
                      </td>
                      <td>{when(row.uploadedAt)}</td>
                      <td style={row.expired || (row.daysLeft !== null && row.daysLeft <= 30) ? { color: "#B00020", fontWeight: 700 } : undefined}>
                        {row.expiresOn
                          ? `${dayWords(row.expiresOn)}${row.daysLeft === null ? "" : row.daysLeft < 0 ? ` · ${-row.daysLeft} days ago` : row.daysLeft <= 30 ? ` · in ${row.daysLeft} days` : ""}`
                          : "Does not expire"}
                      </td>
                      {filter === "sentBack" ? <td>{row.rejectionReason ?? "—"}</td> : null}
                      <td><Link href={`/admin/dashboard/drivers/${row.driverId}#driver-papers`}>{filter === "waiting" ? "Check" : "Open"}</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </Card>
      ) : null}
    </>
  );
}
