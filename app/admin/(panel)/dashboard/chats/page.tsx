"use client";

import Link from "next/link";
import { useState } from "react";

import { Card, EmptyState, ErrorState, PageHeader, RefreshButton, Spinner, TableWrap } from "@/components/admin/ui";
import { useAdminData } from "@/components/admin/use-admin-data";

/**
 * Chats: every rider's (and driver's) chat with Wheelers, newest first, or every
 * trip. Opening one shows it like WhatsApp, with every tap in between.
 * Owners and support; every view is logged.
 */

interface Person { userId: string; name: string | null; phone: string | null; lastAt: string | null; messages: number; trips: number; lastText: string | null }
interface Trip { rideId: string; tripId: string | null; status: string; createdAt: string; pickup: string; dest: string; fareNgn: number | null; riderName: string | null; riderPhone: string | null; driverName: string | null; chats: number; calls: number }
interface Page<T> { total: number; items: T[] }

const PAGE = 50;
const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Lagos" }) : "—";

export default function ChatsPage() {
  const [tab, setTab] = useState<"people" | "trips">("people");
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);
  const params = new URLSearchParams({ limit: String(PAGE), offset: String(offset) });
  if (q.trim()) params.set("q", q.trim());
  const path = `/admin/chats/${tab}?${params.toString()}`;
  const { data, error, loading, refresh } = useAdminData<Page<Person> | Page<Trip>>(path, [path]);

  return (
    <>
      <PageHeader title="Chats" actions={<RefreshButton onClick={refresh} busy={loading} />} />

      <Card padded>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          {(["people", "trips"] as const).map((t) => (
            <button key={t} type="button" className={tab === t ? "admin-btn-approve" : "admin-btn-ghost"} onClick={() => { setTab(t); setOffset(0); }}>
              {t === "people" ? "By person" : "By trip"}
            </button>
          ))}
          <input
            className="admin-input"
            style={{ flex: "1 1 240px" }}
            value={q}
            placeholder={tab === "people" ? "Name or phone" : "Trip code, name or phone"}
            onChange={(e) => { setQ(e.target.value); setOffset(0); }}
          />
        </div>
      </Card>

      {error && !data ? <ErrorState error={error} onRetry={refresh} /> : null}
      {!data && loading ? <Spinner label="Loading chats" /> : null}

      {data ? (
        <Card title={`${data.total.toLocaleString("en-NG")} ${tab === "people" ? (data.total === 1 ? "person" : "people") : data.total === 1 ? "trip" : "trips"}`}>
          {data.items.length === 0 ? <EmptyState>No chats.</EmptyState> : (
            <TableWrap>
              <table className="admin-table">
                {tab === "people" ? (
                  <>
                    <thead><tr><th>Person</th><th>Last</th><th>Trips</th><th>Messages</th><th /></tr></thead>
                    <tbody>
                      {(data.items as Person[]).map((p) => (
                        <tr key={p.userId}>
                          <td>
                            <Link href={`/admin/dashboard/chats/people/${p.userId}`} style={{ fontWeight: 700 }}>{p.name ?? "No name"}</Link>
                            {p.phone ? <div style={{ fontSize: 12, color: "#786F68" }}>{p.phone}</div> : null}
                          </td>
                          <td style={{ maxWidth: 340 }}>
                            <div style={{ fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.lastText?.split("\n")[0] ?? "—"}</div>
                            <div style={{ fontSize: 12, color: "#786F68" }}>{when(p.lastAt)}</div>
                          </td>
                          <td>{p.trips}</td>
                          <td>{p.messages}</td>
                          <td><Link href={`/admin/dashboard/chats/people/${p.userId}`}>Open</Link></td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                ) : (
                  <>
                    <thead><tr><th>Trip</th><th>Rider</th><th>Driver</th><th>When</th><th>Chat</th><th /></tr></thead>
                    <tbody>
                      {(data.items as Trip[]).map((t) => (
                        <tr key={t.rideId}>
                          <td>
                            <Link href={`/admin/dashboard/chats/trips/${t.rideId}`} style={{ fontWeight: 700 }}>{t.tripId ?? "—"}</Link>
                            <div style={{ fontSize: 12, color: "#786F68" }}>{t.pickup} → {t.dest}</div>
                          </td>
                          <td>{t.riderName ?? "—"}{t.riderPhone ? <div style={{ fontSize: 12, color: "#786F68" }}>{t.riderPhone}</div> : null}</td>
                          <td>{t.driverName ?? "—"}</td>
                          <td>{when(t.createdAt)}<div style={{ fontSize: 12, color: "#786F68" }}>{t.status.toLowerCase().replace(/_/g, " ")}</div></td>
                          <td>{t.chats} messages · {t.calls} calls</td>
                          <td><Link href={`/admin/dashboard/chats/trips/${t.rideId}`}>Open</Link></td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                )}
              </table>
            </TableWrap>
          )}
          {data.total > PAGE ? (
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
              <button type="button" className="admin-btn-ghost" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>Newer</button>
              <button type="button" className="admin-btn-ghost" disabled={offset + PAGE >= data.total} onClick={() => setOffset(offset + PAGE)}>Older</button>
            </div>
          ) : null}
        </Card>
      ) : null}
    </>
  );
}
