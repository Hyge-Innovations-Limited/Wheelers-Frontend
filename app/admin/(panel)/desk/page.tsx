"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { Card, EmptyState, ErrorState, PageHeader, SearchInput, Spinner, TableWrap } from "@/components/admin/ui";
import { useAdminData } from "@/components/admin/use-admin-data";
import { formatDate, humanise } from "@/lib/admin-format";
import type { DeskPerson } from "@/components/admin/desk";

/**
 * People & trips, for the support desk: find a rider or driver by name, the
 * number they are calling from, email or username, and open them; or open a
 * trip by its ID (WH-01234). Numbers are masked; nothing about money.
 */
export default function DeskSearchPage() {
  const router = useRouter();
  const [typed, setTyped] = useState("");
  const [query, setQuery] = useState("");
  const [tripRef, setTripRef] = useState("");

  // Searched a moment after typing stops, not on every key.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(typed.trim()), 350);
    return () => clearTimeout(timer);
  }, [typed]);

  const found = useAdminData<{ people: DeskPerson[] }>(
    query.length >= 2 ? `/admin/desk/people?q=${encodeURIComponent(query)}` : null,
    [query],
  );

  function openTrip(event: FormEvent) {
    event.preventDefault();
    const ref = tripRef.trim().toUpperCase().replace(/^WH(\d)/, "WH-$1");
    if (ref) router.push(`/admin/desk/trips/${encodeURIComponent(ref)}`);
  }

  const people = found.data?.people ?? [];

  return (
    <>
      <PageHeader title="People & trips" subtitle="Find a rider or driver, or open a trip by its ID." />

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

      <Card title="Find a person" padded>
        <SearchInput value={typed} onChange={setTyped} placeholder="Name, phone number, email or username" />
        <div style={{ marginTop: 14 }}>
          {query.length < 2 ? (
            <EmptyState>Type at least two letters, or the last digits of their number.</EmptyState>
          ) : found.loading && !found.data ? (
            <Spinner label="Searching…" />
          ) : found.error ? (
            <ErrorState error={found.error} onRetry={found.refresh} />
          ) : people.length === 0 ? (
            <EmptyState>No one matches “{query}”.</EmptyState>
          ) : (
            <TableWrap>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Account</th>
                    <th>Phone</th>
                    <th>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {people.map((p) => (
                    <tr key={p.id}>
                      <td><Link href={`/admin/desk/people/${p.id}`}>{p.name}</Link></td>
                      <td>
                        {p.driver ? `Driver · ${p.driver.online ? "online" : "offline"} · documents ${humanise(p.driver.documents).toLowerCase()}` : humanise(p.role)}
                      </td>
                      <td>{p.phone ?? "—"}</td>
                      <td>{formatDate(p.joinedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </div>
      </Card>
    </>
  );
}
