"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Badge, Card, EmptyState, ErrorState, FilterTabs, PageHeader, RefreshButton, SearchInput, Spinner, StatCard, StatGrid } from "@/components/admin/ui";
import { useAdminData } from "@/components/admin/use-admin-data";
import { adminJson } from "@/lib/admin-api";

/**
 * Activity: what people tried to do in the app and how it went, in words.
 *   top     the last 24 hours: how many problems, how many people, how many were our fault
 *   then    the problems hitting the most people
 *   below   every line, newest first: who, what they were doing, and for a
 *           failure the sentence they were shown
 * It refreshes on its own. A person's name opens their profile.
 */

type Outcome = "failed" | "ok" | "all";

interface Row {
  id: string;
  at: string;
  ok: boolean;
  action: string;
  message: string | null;
  ourFault: boolean;
  userId: string | null;
  name: string | null;
  phone: string | null;
  role: string | null;
  signedIn: boolean;
  where: string;
  rideId: string | null;
  technical: string | null;
}
interface Problem { action: string; message: string; count: number; people: number; ours: boolean }
interface Feed {
  summary: { failed: number; people: number; ourFault: number; top: Problem[] };
  rows: Row[];
  hasMore: boolean;
  nextBefore: string | null;
}

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Lagos" });

function ago(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours} hr ago` : when(iso);
}

const people = (count: number) => (count === 1 ? "1 person" : `${count} people`);
const times = (count: number) => (count === 1 ? "once" : `${count} times`);
const whereWords: Record<string, string> = { app: "App", whatsapp: "WhatsApp", "api-gateway": "App" };

function Who({ row }: { row: Row }) {
  const label = row.name ?? row.phone ?? (row.signedIn ? "Someone signed in" : "Someone not signed in");
  return (
    <div style={{ minWidth: 0 }}>
      {row.userId ? (
        <Link href={`/admin/dashboard/users/${row.userId}`} style={{ fontWeight: 700, color: "inherit" }}>
          {label}
        </Link>
      ) : (
        <span style={{ fontWeight: 700 }}>{label}</span>
      )}
      <div style={{ fontSize: 13, color: "#7A7167" }}>
        {[row.name ? row.phone : null, row.role ? row.role.toLowerCase() : row.signedIn ? null : "not signed in"].filter(Boolean).join(" · ")}
      </div>
    </div>
  );
}

export default function ActivityPage() {
  const [outcome, setOutcome] = useState<Outcome>("failed");
  const [query, setQuery] = useState("");
  const feed = useAdminData<Feed>(`/admin/analytics/app-activity?outcome=${outcome}&limit=80`, [outcome], { refreshMs: 20_000 });

  // Older lines, fetched on request and kept until the filter changes.
  const [older, setOlder] = useState<Row[]>([]);
  const [olderCursor, setOlderCursor] = useState<string | null | undefined>(undefined);
  const [loadingOlder, setLoadingOlder] = useState(false);
  useEffect(() => {
    setOlder([]);
    setOlderCursor(undefined);
  }, [outcome]);

  const cursor = olderCursor === undefined ? (feed.data?.hasMore ? feed.data.nextBefore : null) : olderCursor;

  async function loadOlder() {
    if (!cursor || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const page = await adminJson<Feed>(`/admin/analytics/app-activity?outcome=${outcome}&limit=80&before=${encodeURIComponent(cursor)}`);
      setOlder((current) => [...current, ...page.rows]);
      setOlderCursor(page.hasMore ? page.nextBefore : null);
    } finally {
      setLoadingOlder(false);
    }
  }

  const rows = useMemo(() => {
    const seen = new Set<string>();
    const all = [...(feed.data?.rows ?? []), ...older].filter((row) => (seen.has(row.id) ? false : (seen.add(row.id), true)));
    const wanted = query.trim().toLowerCase();
    if (!wanted) return all;
    return all.filter((row) => [row.name, row.phone, row.action, row.message].some((part) => part?.toLowerCase().includes(wanted)));
  }, [feed.data, older, query]);

  const summary = feed.data?.summary;

  return (
    <div>
      <PageHeader
        title="Activity"
        subtitle="What people tried to do in the app, and what stopped them."
        actions={<RefreshButton onClick={feed.refresh} busy={feed.loading} />}
      />

      {summary ? (
        <StatGrid cols={3}>
          <StatCard label="Problems, last 24 hours" value={summary.failed.toLocaleString("en-NG")} tone={summary.failed > 0 ? "orange" : "green"} />
          <StatCard label="People who hit one" value={summary.people.toLocaleString("en-NG")} />
          <StatCard
            label="Caused by a fault on our side"
            value={summary.ourFault.toLocaleString("en-NG")}
            tone={summary.ourFault > 0 ? "red" : "green"}
            hint={summary.ourFault > 0 ? "These need an engineer." : "None."}
          />
        </StatGrid>
      ) : null}

      {summary && summary.top.length > 0 ? (
        <Card title="Hitting the most people, last 24 hours">
          {summary.top.map((problem) => (
            <div
              key={`${problem.action}|${problem.message}`}
              style={{ display: "flex", gap: 16, alignItems: "flex-start", padding: "12px 0", borderBottom: "1px solid #EFEAE2" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700 }}>{problem.action}</div>
                <div style={{ color: "#4A433B", overflowWrap: "anywhere" }}>{problem.message}</div>
              </div>
              <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                <div style={{ fontWeight: 700 }}>{people(problem.people)}</div>
                <div style={{ fontSize: 13, color: "#7A7167" }}>{times(problem.count)}</div>
                {problem.ours ? <Badge className="admin-badge red">Our fault</Badge> : null}
              </div>
            </div>
          ))}
        </Card>
      ) : null}

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", margin: "20px 0 12px" }}>
        <FilterTabs<Outcome>
          options={[
            { value: "failed", label: "Failed", count: summary?.failed },
            { value: "ok", label: "Worked" },
            { value: "all", label: "Everything" },
          ]}
          value={outcome}
          onChange={setOutcome}
        />
        <div style={{ flex: 1, minWidth: 220 }}>
          <SearchInput value={query} onChange={setQuery} placeholder="Name, phone number or words from the message" />
        </div>
      </div>

      {feed.error && !feed.data ? <ErrorState error={feed.error} onRetry={feed.refresh} /> : null}
      {!feed.data && feed.loading ? <Spinner label="Loading activity" /> : null}

      {feed.data && rows.length === 0 ? (
        <EmptyState>
          {query.trim()
            ? "Nothing matches that search."
            : outcome === "failed"
              ? "Nobody has hit a problem. Failures show here the moment they happen."
              : "Nothing yet."}
        </EmptyState>
      ) : null}

      {rows.length > 0 ? (
        <Card padded={false}>
          {rows.map((row) => (
            <div
              key={row.id}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(150px, 1fr) minmax(0, 2.4fr) auto",
                gap: 16,
                alignItems: "flex-start",
                padding: "14px 18px",
                borderBottom: "1px solid #EFEAE2",
                borderLeft: `4px solid ${row.ok ? "#0B7A55" : row.ourFault ? "#C0392B" : "#FF7700"}`,
              }}>
              <Who row={row} />
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700 }}>{row.action}</span>
                  {row.ok ? (
                    <Badge className="admin-badge green">Worked</Badge>
                  ) : row.ourFault ? (
                    <Badge className="admin-badge red">Failed · our fault</Badge>
                  ) : (
                    <Badge className="admin-badge orange">Failed</Badge>
                  )}
                </div>
                {row.message ? <div style={{ marginTop: 4, color: "#2B2622", overflowWrap: "anywhere" }}>{row.message}</div> : null}
                <div style={{ marginTop: 4, fontSize: 12, color: "#9A9086", overflowWrap: "anywhere" }}>
                  {[whereWords[row.where] ?? row.where, row.technical].filter(Boolean).join(" · ")}
                  {row.rideId ? (
                    <>
                      {" · "}
                      <Link href={`/admin/dashboard/rides/${row.rideId}`} style={{ color: "inherit", textDecoration: "underline" }}>
                        the trip
                      </Link>
                    </>
                  ) : null}
                </div>
              </div>
              <div style={{ textAlign: "right", whiteSpace: "nowrap", fontSize: 13, color: "#7A7167" }} title={when(row.at)}>
                {ago(row.at)}
              </div>
            </div>
          ))}
        </Card>
      ) : null}

      {cursor && !query.trim() ? (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
          <button className="admin-btn-ghost" disabled={loadingOlder} onClick={() => void loadOlder()} type="button">
            {loadingOlder ? "Loading…" : "Show older"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
