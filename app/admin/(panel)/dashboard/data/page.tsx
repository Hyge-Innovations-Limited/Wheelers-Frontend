"use client";

import { useState } from "react";

import { BreakdownBars } from "@/components/admin/charts";
import { Card, EmptyState, ErrorState, PageHeader, RefreshButton, Spinner, StatCard, StatGrid, TableWrap } from "@/components/admin/ui";
import { useAdminData } from "@/components/admin/use-admin-data";
import { adminDownload } from "@/lib/admin-api";

/**
 * Data: where riders stop, and the data to work it out further.
 *
 *   Rides               every ride by stage (offers, driver, arrived, trip, done), by channel, and why the
 *                       ones that did not finish ended
 *   WhatsApp ride page  each visit by step (opened, saw the price, searched, got offers, accepted, booked)
 *                       and the last thing people did before leaving
 *   Shown a price       riders shown a price, and how many then searched
 *   Download            each dataset as CSV for Power BI, Python or Excel (docs/analytics-data.md in the
 *                       backend explains every column and how to connect Power BI)
 */

type RideRow = {
  channel: string;
  requested: number;
  got_offers: number;
  driver_assigned: number;
  driver_arrived: number;
  trip_started: number;
  completed: number;
  no_driver: number;
  cancelled: number;
  avg_minutes_to_first_offer: number | null;
  avg_minutes_to_driver: number | null;
  avg_minutes_driver_to_pickup: number | null;
};
type Funnel = {
  from: string;
  to: string;
  channel: string | null;
  rides: RideRow[];
  cancels: Array<{ stage: string; reason: string; rides: number }>;
  page: Record<string, number | null>;
  leftAt: Array<{ step: string; lastEvent: string; visits: number }>;
  quotes: Record<string, number | null>;
};
type Datasets = { from: string; to: string; maxRows: number; datasets: Array<{ name: string; title: string; description: string; rows: number }> };

const CHANNELS = ["", "APP", "WHATSAPP", "MCP", "UNKNOWN"];

const STAGE_WORDS: Record<string, string> = {
  "1_searching": "Searching (no offer yet)",
  "2_offers_received": "Had offers",
  "3_driver_assigned": "Driver assigned",
  "4_driver_arrived": "Driver arrived",
  "5_trip_started": "Trip started",
  "6_completed": "Completed",
};
const STEP_WORDS: Record<string, string> = {
  "0_opened": "Only opened the page",
  "1_saw_price": "Saw the price",
  "2_searched": "Searched for drivers",
  "3_got_offers": "Got offers",
  "4_tapped_accept": "Tapped Accept",
  "5_driver_confirmed": "Driver confirmed",
};
const EVENT_WORDS: Record<string, string> = {
  page_opened: "opened the page",
  phase_shown: "a screen appeared",
  page_hidden: "switched away",
  page_left: "closed the page",
  price_changed: "changed the price",
  find_tapped: "tapped Find drivers",
  find_failed: "Find drivers failed",
  offer_received: "an offer came in",
  raise_tapped: "tapped a raise",
  price_updated: "updated the price",
  accept_tapped: "tapped Accept",
  wallet_short_shown: "was asked to add money",
  pay_sheet_closed: "closed the payment sheet",
  cancel_confirmed: "cancelled",
  cancel_kept: "opened cancel, kept looking",
  edit_trip_back_confirmed: "went back to edit the trip",
  trip_edit_opened: "opened Edit trip",
  chat_link_tapped: "went back to WhatsApp",
};

const n = (value: number | null | undefined) => (typeof value === "number" && Number.isFinite(value) ? value : 0);
const count = (value: number) => value.toLocaleString("en-NG");
const minutes = (value: number | null | undefined) => (typeof value === "number" && Number.isFinite(value) ? `${value.toFixed(1)} min` : "—");

const lagosDay = (offsetDays = 0) => new Date(Date.now() + 3600_000 - offsetDays * 86_400_000).toISOString().slice(0, 10);

/** A funnel as bars: each step's count and its share of the first step, so the drop is read at a glance. */
function FunnelBars({ steps }: { steps: Array<{ label: string; value: number }> }) {
  const first = steps[0]?.value ?? 0;
  if (first === 0) return <EmptyState>Nothing in this period.</EmptyState>;
  return (
    <BreakdownBars
      rows={steps}
      formatValue={(value) => `${count(value)} · ${Math.round((value / first) * 100)}%`}
    />
  );
}

export default function DataPage() {
  const [from, setFrom] = useState(() => lagosDay(29));
  const [to, setTo] = useState(() => lagosDay(0));
  const [channel, setChannel] = useState("");
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const range = `from=${from}&to=${to}`;
  const funnel = useAdminData<Funnel>(`/admin/data/funnel?${range}${channel ? `&channel=${channel}` : ""}`, [from, to, channel]);
  const datasets = useAdminData<Datasets>(`/admin/data/datasets?${range}`, [from, to]);

  const download = async (name: string) => {
    setDownloading(name);
    setDownloadError(null);
    try {
      await adminDownload(`/admin/data/export?dataset=${name}&${range}`, `wheelers-${name}-${from}-to-${to}.csv`);
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : "Could not download that.");
    } finally {
      setDownloading(null);
    }
  };

  const f = funnel.data;
  // All channels together, or the one chosen.
  const rides = (f?.rides ?? []).reduce<Record<string, number>>((sum, row) => {
    for (const key of ["requested", "got_offers", "driver_assigned", "driver_arrived", "trip_started", "completed", "no_driver", "cancelled"] as const) {
      sum[key] = (sum[key] ?? 0) + n(row[key]);
    }
    return sum;
  }, {});
  const page = f?.page ?? {};
  const quotes = f?.quotes ?? {};

  return (
    <>
      <PageHeader
        title="Data"
        subtitle="Where riders stop, and the data to work it out further"
        actions={<RefreshButton onClick={() => { funnel.refresh(); datasets.refresh(); }} busy={funnel.loading} />}
      />

      <div className="admin-card" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end", padding: 14 }}>
        <label style={{ display: "grid", gap: 4, fontSize: 12.5, color: "#786F68" }}>
          From
          <input type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} className="admin-input" />
        </label>
        <label style={{ display: "grid", gap: 4, fontSize: 12.5, color: "#786F68" }}>
          To
          <input type="date" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} className="admin-input" />
        </label>
        <label style={{ display: "grid", gap: 4, fontSize: 12.5, color: "#786F68" }}>
          Rides from
          <select value={channel} onChange={(e) => setChannel(e.target.value)} className="admin-input">
            {CHANNELS.map((c) => <option key={c} value={c}>{c ? (c === "APP" ? "The app" : c === "WHATSAPP" ? "WhatsApp" : c) : "Every channel"}</option>)}
          </select>
        </label>
      </div>

      {funnel.error && !f ? <ErrorState error={funnel.error} onRetry={funnel.refresh} /> : null}
      {!f && funnel.loading ? <Spinner label="Working out the funnel" /> : null}

      {f ? (
        <>
          <Card title="Rides: how far they got" right={channel ? (channel === "WHATSAPP" ? "WhatsApp" : channel === "APP" ? "The app" : channel) : "Every channel"} padded>
            <FunnelBars
              steps={[
                { label: "Requested", value: n(rides.requested) },
                { label: "Got an offer", value: n(rides.got_offers) },
                { label: "Driver assigned", value: n(rides.driver_assigned) },
                { label: "Driver arrived", value: n(rides.driver_arrived) },
                { label: "Trip started", value: n(rides.trip_started) },
                { label: "Completed", value: n(rides.completed) },
              ]}
            />
            <p style={{ margin: "10px 0 0", fontSize: 12.5, color: "#786F68" }}>
              A rider who searched again counts once: searches replaced by a newer one are left out.
            </p>
          </Card>

          <StatGrid cols={4}>
            <StatCard label="No driver in time" value={count(n(rides.no_driver))} hint="Searches nobody took" />
            <StatCard label="Cancelled" value={count(n(rides.cancelled))} hint="By the rider or driver" />
            <StatCard
              label="To the first offer"
              value={minutes(f.rides.length === 1 ? f.rides[0]!.avg_minutes_to_first_offer : null)}
              hint={f.rides.length === 1 ? "Average" : "Pick one channel to see it"}
            />
            <StatCard
              label="Driver to pickup"
              value={minutes(f.rides.length === 1 ? f.rides[0]!.avg_minutes_driver_to_pickup : null)}
              hint={f.rides.length === 1 ? "Average" : "Pick one channel to see it"}
            />
          </StatGrid>

          {f.rides.length > 1 ? (
            <Card title="By channel">
              <TableWrap>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Channel</th><th>Requested</th><th>Got an offer</th><th>Driver assigned</th><th>Completed</th><th>No driver</th><th>Cancelled</th><th>To first offer</th><th>To driver</th>
                    </tr>
                  </thead>
                  <tbody>
                    {f.rides.map((r) => (
                      <tr key={r.channel}>
                        <td>{r.channel === "APP" ? "The app" : r.channel === "WHATSAPP" ? "WhatsApp" : r.channel}</td>
                        <td>{count(n(r.requested))}</td>
                        <td>{count(n(r.got_offers))}</td>
                        <td>{count(n(r.driver_assigned))}</td>
                        <td>{count(n(r.completed))}</td>
                        <td>{count(n(r.no_driver))}</td>
                        <td>{count(n(r.cancelled))}</td>
                        <td>{minutes(r.avg_minutes_to_first_offer)}</td>
                        <td>{minutes(r.avg_minutes_to_driver)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            </Card>
          ) : null}

          <Card title="Rides that ended without a trip: where, and why">
            {f.cancels.length === 0 ? <EmptyState>None in this period.</EmptyState> : (
              <TableWrap>
                <table className="admin-table">
                  <thead><tr><th>Stopped at</th><th>Reason</th><th>Rides</th></tr></thead>
                  <tbody>
                    {f.cancels.map((c) => (
                      <tr key={`${c.stage}-${c.reason}`}>
                        <td>{STAGE_WORDS[c.stage] ?? c.stage}</td>
                        <td>{c.reason}</td>
                        <td>{count(c.rides)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </Card>

          <Card title="WhatsApp ride page: each visit" padded>
            <FunnelBars
              steps={[
                { label: "Opened the page", value: n(page.opened) },
                { label: "Saw the price", value: n(page.saw_price) },
                { label: "Searched", value: n(page.searched) },
                { label: "Got offers", value: n(page.got_offers) },
                { label: "Tapped Accept", value: n(page.tapped_accept) },
                { label: "Driver confirmed", value: n(page.driver_confirmed) },
              ]}
            />
          </Card>

          <StatGrid cols={4}>
            <StatCard label="Asked to add money" value={count(n(page.wallet_short))} hint="Wallet short at Accept" />
            <StatCard label="Changed price while searching" value={count(n(page.changed_price_while_searching))} hint="Raised or updated" />
            <StatCard label="Cancelled on the page" value={count(n(page.cancelled))} hint="With a reason" />
            <StatCard label="Time on the page" value={page.avg_seconds_on_page ? `${Math.round(n(page.avg_seconds_on_page))} s` : "—"} hint="Average per visit" />
          </StatGrid>

          <Card title="WhatsApp visits that did not book: the last thing they did">
            {f.leftAt.length === 0 ? <EmptyState>No visits recorded yet. The page reports steps from this release on.</EmptyState> : (
              <TableWrap>
                <table className="admin-table">
                  <thead><tr><th>Got as far as</th><th>Last thing they did</th><th>Visits</th></tr></thead>
                  <tbody>
                    {f.leftAt.map((r) => (
                      <tr key={`${r.step}-${r.lastEvent}`}>
                        <td>{STEP_WORDS[r.step] ?? r.step}</td>
                        <td>{EVENT_WORDS[r.lastEvent] ?? r.lastEvent.replace(/_/g, " ")}</td>
                        <td>{count(r.visits)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </Card>

          <StatGrid cols={4}>
            <StatCard label="Shown a price on WhatsApp" value={count(n(quotes.whatsapp_quoted_riders))} hint="Riders" />
            <StatCard label="…then searched" value={count(n(quotes.whatsapp_then_searched))} hint={n(quotes.whatsapp_quoted_riders) ? `${Math.round((n(quotes.whatsapp_then_searched) / n(quotes.whatsapp_quoted_riders)) * 100)}% of them` : "From this release on"} />
            <StatCard label="Shown a price in the app" value={count(n(quotes.app_quoted_riders))} hint="Riders" />
            <StatCard label="…then searched" value={count(n(quotes.app_then_searched))} hint={n(quotes.app_quoted_riders) ? `${Math.round((n(quotes.app_then_searched) / n(quotes.app_quoted_riders)) * 100)}% of them` : "—"} />
          </StatGrid>
        </>
      ) : null}

      <Card title="Download for Power BI, Python or Excel" right={datasets.data ? `Up to ${count(datasets.data.maxRows)} rows each` : undefined}>
        {downloadError ? <div style={{ padding: "10px 14px", color: "#B00020", fontSize: 13.5, fontWeight: 600 }}>{downloadError}</div> : null}
        {datasets.error && !datasets.data ? <ErrorState error={datasets.error} onRetry={datasets.refresh} /> : null}
        {datasets.data ? (
          <TableWrap>
            <table className="admin-table">
              <thead><tr><th>Dataset</th><th>What is in it</th><th>Rows</th><th /></tr></thead>
              <tbody>
                {datasets.data.datasets.map((d) => (
                  <tr key={d.name}>
                    <td><strong>{d.title}</strong><div style={{ fontSize: 12, color: "#786F68" }}>{d.name}</div></td>
                    <td style={{ fontSize: 13, maxWidth: 420 }}>{d.description}</td>
                    <td>{count(d.rows)}</td>
                    <td>
                      <button type="button" className="admin-btn-ghost" disabled={downloading !== null || d.rows === 0} onClick={() => void download(d.name)}>
                        {downloading === d.name ? "Downloading…" : "Download CSV"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        ) : null}
        <p style={{ margin: 0, padding: "10px 14px", fontSize: 12.5, color: "#786F68" }}>
          Times are UTC; day and hour columns are Lagos time. Every column, and how to connect Power BI to the database directly, is in the data guide (docs/analytics-data.md in the backend).
        </p>
      </Card>
    </>
  );
}
