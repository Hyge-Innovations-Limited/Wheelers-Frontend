"use client";

import Link from "next/link";
import { useState } from "react";

import { Card, EmptyState, ErrorState, PageHeader, RefreshButton, Spinner, StatCard, StatGrid, TableWrap } from "@/components/admin/ui";
import { useAdminData } from "@/components/admin/use-admin-data";

/**
 * Driver papers: the papers drivers have sent for their cars, as four lists.
 *   To check       sent and not yet looked at, oldest first
 *   Expiring soon  good, but running out within 30 days
 *   Expired        past their date: the driver has to send a new one
 *   Sent back      rejected and not yet sent again
 * Each row opens the driver, where a paper is opened, approved or sent back.
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
}
interface Queue { filter: Filter; counts: Record<Filter, number>; items: Row[] }

const TABS: Array<{ key: Filter; label: string; hint: string; empty: string }> = [
  { key: "waiting", label: "To check", hint: "Sent and waiting for an answer", empty: "Nothing is waiting to be checked." },
  { key: "expiring", label: "Expiring soon", hint: "Run out within 30 days", empty: "Nothing runs out in the next 30 days." },
  { key: "expired", label: "Expired", hint: "Past their date", empty: "No paper on file has expired." },
  { key: "sentBack", label: "Sent back", hint: "Waiting for the driver to send again", empty: "Nothing is out with a driver to fix." },
];

const dayWords = (iso: string | null) =>
  iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "—";
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Lagos" });

export default function DriverPapersPage() {
  const [filter, setFilter] = useState<Filter>("waiting");
  const { data, error, loading, refresh } = useAdminData<Queue>(`/admin/driver-papers?filter=${filter}`, [filter], { refreshMs: 60_000 });
  const tab = TABS.find((t) => t.key === filter)!;

  return (
    <>
      <PageHeader title="Driver papers" subtitle="Hackney permits, licences, insurance and the rest, as drivers send them" actions={<RefreshButton onClick={refresh} busy={loading} />} />

      {data ? (
        <StatGrid>
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setFilter(t.key)}
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
        <Card title={tab.label} right={`${data.items.length} shown`}>
          {data.items.length === 0 ? <EmptyState>{tab.empty}</EmptyState> : (
            <TableWrap>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Driver</th>
                    <th>Paper</th>
                    <th>Sent</th>
                    <th>Expires</th>
                    {filter === "sentBack" ? <th>Told the driver</th> : null}
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((row) => (
                    <tr key={`${row.driverId}-${row.type}`}>
                      <td>
                        <Link href={`/admin/dashboard/drivers/${row.driverId}#driver-papers`}>{row.driverName}</Link>
                        {row.phone ? <div style={{ fontSize: 12, color: "#786F68" }}>{row.phone}</div> : null}
                      </td>
                      <td>{row.label}</td>
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
