"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Badge, Card, EmptyState, ErrorState, FilterTabs, PageHeader, RefreshButton, SearchInput, Spinner, StatCard, StatGrid } from "@/components/admin/ui";
import { useAdminData } from "@/components/admin/use-admin-data";
import { adminJson } from "@/lib/admin-api";
import { useAdminSession } from "@/lib/admin-session";

/**
 * Activity: what people tried to do in the app and how it went, in words.
 *   range   last 24 hours, today, 7 or 30 days, or two days picked on a calendar
 *   top     for that range: how many problems, how many people, how many were our fault
 *   then    the problems hitting the most people
 *   then    bots probing the server, kept apart from people
 *   below   every line, newest first: who, what they were doing, and for a
 *           failure the sentence they were shown
 * An open range (up to now) refreshes on its own. A person's name opens their profile.
 */

type Outcome = "failed" | "ok" | "all";
type Preset = "24h" | "today" | "7d" | "30d" | "custom";

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
interface Counted { name: string; count: number }
interface Probe { at: string; method: string | null; path: string | null; ip: string | null; userAgent: string | null; status: number | null }
interface Feed {
  range?: { from: string; to: string };
  probes?: { count: number; addresses: number; paths: Counted[]; fromWhere: Counted[]; recent: Probe[] };
  summary: { failed: number; people: number; ourFault: number; top: Problem[] };
  rows: Row[];
  hasMore: boolean;
  nextBefore: string | null;
}

const LAGOS = "Africa/Lagos";
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: LAGOS });
const day = (iso: string) => new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: LAGOS });

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

/** Today in Lagos as YYYY-MM-DD, for the calendar boxes. */
const lagosToday = () => new Date().toLocaleDateString("en-CA", { timeZone: LAGOS });
/** The start of a Lagos day (UTC+1 all year, no daylight saving). */
const dayStart = (date: string) => new Date(`${date}T00:00:00+01:00`);
const nextDay = (date: string) => new Date(dayStart(date).getTime() + 24 * 60 * 60 * 1000);

const PRESETS: { value: Preset; label: string }[] = [
  { value: "24h", label: "Last 24 hours" },
  { value: "today", label: "Today" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "custom", label: "Pick dates" },
];

/** The range as query words, and what to call it on the page. No `to` means up to now. */
function rangeFor(preset: Preset, from: string, to: string): { query: string; label: string; open: boolean } {
  const daysBack = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  if (preset === "today") return { query: `&from=${encodeURIComponent(dayStart(lagosToday()).toISOString())}`, label: "today", open: true };
  if (preset === "7d") return { query: `&from=${encodeURIComponent(daysBack(7))}`, label: "last 7 days", open: true };
  if (preset === "30d") return { query: `&from=${encodeURIComponent(daysBack(30))}`, label: "last 30 days", open: true };
  if (preset === "custom" && from && to) {
    const [start, end] = from <= to ? [from, to] : [to, from];
    const label = start === end ? day(dayStart(start).toISOString()) : `${day(dayStart(start).toISOString())} – ${day(dayStart(end).toISOString())}`;
    const open = end >= lagosToday();
    return {
      query: `&from=${encodeURIComponent(dayStart(start).toISOString())}${open ? "" : `&to=${encodeURIComponent(nextDay(end).toISOString())}`}`,
      label,
      open,
    };
  }
  return { query: "", label: "last 24 hours", open: true };
}

function Who({ row }: { row: Row }) {
  // The support desk opens its own profile page (numbers masked, no money).
  const { isSupport } = useAdminSession();
  const label = row.name ?? row.phone ?? (row.signedIn ? "Someone signed in" : "Someone not signed in");
  return (
    <div className="act-who">
      {row.userId ? (
        <Link className="act-name" href={isSupport ? `/admin/desk/people/${row.userId}` : `/admin/dashboard/users/${row.userId}`}>
          {label}
        </Link>
      ) : (
        <span className="act-name">{label}</span>
      )}
      <div className="act-sub">
        {[row.name ? row.phone : null, row.role ? row.role.toLowerCase() : row.signedIn ? null : "not signed in"].filter(Boolean).join(" · ")}
      </div>
    </div>
  );
}

function RangePicker({
  preset,
  from,
  to,
  onPreset,
  onFrom,
  onTo,
}: {
  preset: Preset;
  from: string;
  to: string;
  onPreset: (preset: Preset) => void;
  onFrom: (date: string) => void;
  onTo: (date: string) => void;
}) {
  const today = lagosToday();
  return (
    <div className="act-range">
      <div className="act-range-chips" role="radiogroup" aria-label="Dates shown">
        {PRESETS.map((option) => (
          <button
            aria-checked={preset === option.value}
            className={`act-chip${preset === option.value ? " on" : ""}`}
            key={option.value}
            onClick={() => onPreset(option.value)}
            role="radio"
            type="button">
            {option.label}
          </button>
        ))}
      </div>
      {preset === "custom" ? (
        <div className="act-dates">
          <label className="act-date">
            <span>From</span>
            <input max={to || today} onChange={(event) => onFrom(event.target.value)} type="date" value={from} />
          </label>
          <label className="act-date">
            <span>To</span>
            <input max={today} min={from || undefined} onChange={(event) => onTo(event.target.value)} type="date" value={to} />
          </label>
        </div>
      ) : null}
    </div>
  );
}

export default function ActivityPage() {
  const { isSupport } = useAdminSession();
  const [outcome, setOutcome] = useState<Outcome>("failed");
  const [query, setQuery] = useState("");
  const [preset, setPreset] = useState<Preset>("24h");
  const [from, setFrom] = useState(() => lagosToday());
  const [to, setTo] = useState(() => lagosToday());
  const range = rangeFor(preset, from, to);

  const base = `/admin/analytics/app-activity?outcome=${outcome}&limit=80${range.query}`;
  // A range that runs up to now keeps itself current; a closed one is history and stays put.
  const feed = useAdminData<Feed>(base, [base], range.open ? { refreshMs: 20_000 } : {});

  // Older lines, fetched on request. They belong to the filter and range they
  // were fetched under: change either and they are no longer shown.
  const [fetched, setFetched] = useState<{ base: string; rows: Row[]; cursor: string | null } | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const kept = fetched?.base === base ? fetched : null;
  const older = kept?.rows;
  const cursor = kept ? kept.cursor : feed.data?.hasMore ? feed.data.nextBefore : null;

  async function loadOlder() {
    if (!cursor || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const page = await adminJson<Feed>(`${base}&before=${encodeURIComponent(cursor)}`);
      setFetched({ base, rows: [...(older ?? []), ...page.rows], cursor: page.hasMore ? page.nextBefore : null });
    } finally {
      setLoadingOlder(false);
    }
  }

  const rows = useMemo(() => {
    const seen = new Set<string>();
    const all = [...(feed.data?.rows ?? []), ...(older ?? [])].filter((row) => (seen.has(row.id) ? false : (seen.add(row.id), true)));
    const wanted = query.trim().toLowerCase();
    if (!wanted) return all;
    return all.filter((row) => [row.name, row.phone, row.action, row.message].some((part) => part?.toLowerCase().includes(wanted)));
  }, [feed.data, older, query]);

  const summary = feed.data?.summary;
  const probes = feed.data?.probes;

  return (
    <div className="act-page">
      <PageHeader
        title="Activity"
        subtitle="What people tried to do in the app, and what stopped them."
        actions={<RefreshButton onClick={feed.refresh} busy={feed.loading} />}
      />

      <RangePicker
        from={from}
        onFrom={setFrom}
        onPreset={setPreset}
        onTo={setTo}
        preset={preset}
        to={to}
      />

      {summary ? (
        <StatGrid cols={3}>
          <StatCard label={`Problems, ${range.label}`} value={summary.failed.toLocaleString("en-NG")} tone={summary.failed > 0 ? "orange" : "green"} />
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
        <Card title={`Hitting the most people, ${range.label}`}>
          {summary.top.map((problem) => (
            <div className="act-problem" key={`${problem.action}|${problem.message}`}>
              <div className="act-problem-text">
                <div className="act-strong">{problem.action}</div>
                <div className="act-message">{problem.message}</div>
              </div>
              <div className="act-problem-count">
                <span className="act-strong">{people(problem.people)}</span>
                <span className="act-sub">{times(problem.count)}</span>
                {problem.ours ? <Badge className="admin-badge red">Our fault</Badge> : null}
              </div>
            </div>
          ))}
        </Card>
      ) : null}

      {probes && probes.count > 0 ? (
        <Card title={`Bots probing the server, ${range.label}`} right={`${probes.count.toLocaleString("en-NG")} tries · ${probes.addresses} ${probes.addresses === 1 ? "address" : "addresses"}`}>
          <div className="act-probes">
            <p className="act-probe-note">
              Automated scanners trying weaknesses other servers have. Every one here was refused (not found). It is worth a look if
              the same address keeps coming back, or if anything here was not refused.
            </p>
            <div className="act-probe-cols">
              <div>
                <div className="act-probe-head">What they tried</div>
                {probes.paths.map((entry) => (
                  <div className="act-probe-line" key={entry.name}>
                    <code>{entry.name}</code>
                    <span>{times(entry.count)}</span>
                  </div>
                ))}
              </div>
              <div>
                <div className="act-probe-head">From</div>
                {probes.fromWhere.map((entry) => (
                  <div className="act-probe-line" key={entry.name}>
                    <code>{entry.name}</code>
                    <span>{times(entry.count)}</span>
                  </div>
                ))}
              </div>
            </div>
            <details className="act-probe-recent">
              <summary>Latest tries</summary>
              {probes.recent.map((probe, index) => (
                <div className="act-probe-try" key={`${probe.at}-${index}`}>
                  <span className="act-sub">{when(probe.at)}</span>
                  <code>
                    {probe.method} {probe.path}
                  </code>
                  <span className="act-sub">
                    {[probe.ip, probe.status ? String(probe.status) : null, probe.userAgent].filter(Boolean).join(" · ")}
                  </span>
                </div>
              ))}
            </details>
          </div>
        </Card>
      ) : null}

      <div className="act-toolbar">
        <FilterTabs<Outcome>
          options={[
            { value: "failed", label: "Failed", count: summary?.failed },
            { value: "ok", label: "Worked" },
            { value: "all", label: "Everything" },
          ]}
          value={outcome}
          onChange={setOutcome}
        />
        <div className="act-search">
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
              ? `Nobody hit a problem, ${range.label}.`
              : `Nothing, ${range.label}.`}
        </EmptyState>
      ) : null}

      {rows.length > 0 ? (
        <Card padded={false}>
          {rows.map((row) => (
            <div className={`act-row ${row.ok ? "ok" : row.ourFault ? "ours" : "theirs"}`} key={row.id}>
              <Who row={row} />
              <div className="act-what">
                <div className="act-what-head">
                  <span className="act-strong">{row.action}</span>
                  {row.ok ? (
                    <Badge className="admin-badge green">Worked</Badge>
                  ) : row.ourFault ? (
                    <Badge className="admin-badge red">Failed · our fault</Badge>
                  ) : (
                    <Badge className="admin-badge orange">Failed</Badge>
                  )}
                </div>
                {row.message ? <div className="act-message">{row.message}</div> : null}
                <div className="act-tech">
                  {[whereWords[row.where] ?? row.where, row.technical].filter(Boolean).join(" · ")}
                  {row.rideId ? (
                    <>
                      {" · "}
                      <Link href={isSupport ? `/admin/desk/trips/${row.rideId}` : `/admin/dashboard/rides/${row.rideId}`}>the trip</Link>
                    </>
                  ) : null}
                </div>
              </div>
              <div className="act-when" title={when(row.at)}>
                {ago(row.at)}
              </div>
            </div>
          ))}
        </Card>
      ) : null}

      {cursor && !query.trim() ? (
        <div className="act-more">
          <button className="admin-btn-ghost" disabled={loadingOlder} onClick={() => void loadOlder()} type="button">
            {loadingOlder ? "Loading…" : "Show older"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
