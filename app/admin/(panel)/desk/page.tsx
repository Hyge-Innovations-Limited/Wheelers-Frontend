"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { Card, EmptyState, ErrorState, FilterTabs, PageHeader, Pagination, SearchInput, Spinner, TableWrap } from "@/components/admin/ui";
import { useAdminData } from "@/components/admin/use-admin-data";
import { formatDate, humanise } from "@/lib/admin-format";
import type { DeskPerson } from "@/components/admin/desk";

type Kind = "all" | "riders" | "drivers";

/**
 * People & trips, for the support desk: everyone, newest first, with the
 * number and email to reach them; narrowed to riders or drivers, or found
 * by name, number, email or username. A trip opens by its ID (WH-01234).
 * Nothing about money.
 */
export default function DeskSearchPage() {
  const router = useRouter();
  const [typed, setTyped] = useState("");
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<Kind>("all");
  const [page, setPage] = useState(0);
  const [tripRef, setTripRef] = useState("");

  // Searched a moment after typing stops, not on every key, from the first page.
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(typed.trim());
      setPage(0);
    }, 350);
    return () => clearTimeout(timer);
  }, [typed]);

  const params = new URLSearchParams({ page: String(page) });
  if (query.length >= 2) params.set("q", query);
  if (kind !== "all") params.set("role", kind);
  const found = useAdminData<{ people: Array<DeskPerson & { email: string | null }>; total: number; pageSize: number }>(
    `/admin/desk/people?${params.toString()}`,
    [query, kind, page],
  );

  function openTrip(event: FormEvent) {
    event.preventDefault();
    const ref = tripRef.trim().toUpperCase().replace(/^WH(\d)/, "WH-$1");
    if (ref) router.push(`/admin/desk/trips/${encodeURIComponent(ref)}`);
  }

  const people = found.data?.people ?? [];
  const pageSize = found.data?.pageSize ?? 50;

  return (
    <>
      <PageHeader title="People & trips" subtitle="Everyone on Wheelers, newest first. Open someone to see their trips, what they tried in the app, and to message them." />

      <Card title="Open a trip" padded>
        <form onSubmit={openTrip} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input
            className="admin-input"
            style={{ flex: "1 1 220px" }}
            value={tripRef}
            onChange={(event) => setTripRef(event.target.value)}
            placeholder="Trip ID, e.g. WH-00216"
            aria-label="Trip ID"
          />
          <button type="submit" className="admin-btn-primary" disabled={!tripRef.trim()}>Open trip</button>
        </form>
      </Card>

      <div style={{ height: 16 }} />

      <Card title="People" right={found.data ? `${found.data.total.toLocaleString("en-NG")} ${query.length >= 2 ? "found" : "in all"}` : undefined} padded>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
          <FilterTabs<Kind>
            options={[{ value: "all", label: "Everyone" }, { value: "riders", label: "Riders" }, { value: "drivers", label: "Drivers" }]}
            value={kind}
            onChange={(next) => { setKind(next); setPage(0); }}
          />
          <div style={{ flex: "1 1 260px" }}>
            <SearchInput value={typed} onChange={setTyped} placeholder="Name, phone number, email or username" />
          </div>
        </div>
        {found.loading && !found.data ? (
          <Spinner label="Loading people…" />
        ) : found.error ? (
          <ErrorState error={found.error} onRetry={found.refresh} />
        ) : people.length === 0 ? (
          <EmptyState>{query.length >= 2 ? `No one matches “${query}”.` : "No one here yet."}</EmptyState>
        ) : (
          <>
            <TableWrap>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Account</th>
                    <th>Phone</th>
                    <th>Email</th>
                    <th>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {people.map((p) => (
                    <tr key={p.id}>
                      <td><Link href={`/admin/desk/people/${p.id}`}><strong>{p.name}</strong></Link></td>
                      <td>
                        {p.driver ? `Driver · ${p.driver.online ? "online" : "offline"} · documents ${humanise(p.driver.documents).toLowerCase()}` : humanise(p.role)}
                      </td>
                      <td>{p.phone ? <a href={`tel:${p.phone}`}>{p.phone}</a> : "—"}</td>
                      <td>{p.email ? <a href={`mailto:${p.email}`}>{p.email}</a> : "—"}</td>
                      <td>{formatDate(p.joinedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
            <Pagination offset={page * pageSize} limit={pageSize} total={found.data?.total ?? 0} onChange={(offset) => setPage(Math.floor(offset / pageSize))} />
          </>
        )}
      </Card>
    </>
  );
}
