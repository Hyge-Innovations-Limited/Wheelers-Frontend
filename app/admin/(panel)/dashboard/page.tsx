"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import type {
  BreakdownRow,
  GroupRideMetrics,
  InsightPoint,
  InsightSummary,
  OverviewResponse,
  PendingDriverRow,
  ReconcileCheck,
} from "@/lib/admin-api";
import { adminDownload } from "@/lib/admin-api";
import {
  formatDistance,
  formatDuration,
  formatNaira,
  formatNairaCompact,
  formatNumber,
  formatPercent,
  formatWhen,
  humanise,
} from "@/lib/admin-format";
import { describeRange, filtersQuery, useInsightParams } from "@/lib/insight-filters";
import { AreaChart, BarChart, BreakdownBars, CHART_COLORS } from "@/components/admin/charts";
import { InsightFilterBar } from "@/components/admin/insight-filter-bar";
import { InsightTables } from "@/components/admin/insight-tables";
import { useAdminData } from "@/components/admin/use-admin-data";
import {
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  SectionLabel,
  RefreshButton,
  Spinner,
  StatCard,
  StatGrid,
  TableWrap,
} from "@/components/admin/ui";

/** How often the live pages re-read themselves. */
const LIVE_REFRESH_MS = 20_000;

/** Rows of the approval queue shown inline before it defers to the full page. */
const QUEUE_PREVIEW = 8;

/** A submission older than this has been sitting too long, and is called out. */
const STALE_AFTER_HOURS = 48;

const hoursWaiting = (submittedAt: string | null): number =>
  submittedAt ? (Date.now() - Date.parse(submittedAt)) / 3_600_000 : 0;

const vehicleOf = (d: PendingDriverRow): string => {
  const parts = [d.vehicleMake, d.vehicleModel].filter(Boolean).join(" ");
  const year = d.vehicleYear ? ` (${d.vehicleYear})` : "";
  const plate = d.vehiclePlate ? ` · ${d.vehiclePlate}` : "";
  return parts ? `${parts}${year}${plate}` : d.vehiclePlate ?? "—";
};

/**
 * Drivers waiting on a human, at the top of the page.
 *
 * The metrics below answer "how is the business doing"; this answers "what is
 * on my desk right now", and it is the only thing on the Overview an operator
 * can act on — so it goes first, in queue order, oldest submission at the top.
 * Nobody should have to remember to click through to the KYC page to find out
 * that someone has been waiting three days.
 */
function ApprovalQueue() {
  const { data, error, loading, refresh } = useAdminData<{ drivers: PendingDriverRow[] }>(
    "/admin/drivers",
    [],
    { refreshMs: LIVE_REFRESH_MS },
  );

  if (error) return <ErrorState error={error} onRetry={refresh} />;
  if (loading && !data) return <Spinner label="Loading the approval queue…" />;

  // The API already orders these oldest-first; sorting again costs nothing and
  // means the queue stays a queue even if that ever changes.
  const queue = [...(data?.drivers ?? [])].sort(
    (a, b) => Date.parse(a.submittedAt ?? "") - Date.parse(b.submittedAt ?? ""),
  );

  if (queue.length === 0) {
    return (
      <Card>
        <EmptyState>No drivers are waiting for review — the queue is clear.</EmptyState>
      </Card>
    );
  }

  const waitingLongest = hoursWaiting(queue[0].submittedAt);

  return (
    <Card
      title={`${formatNumber(queue.length)} ${queue.length === 1 ? "driver" : "drivers"} waiting for review`}
      right={
        waitingLongest >= STALE_AFTER_HOURS
          ? `longest wait ${Math.floor(waitingLongest / 24)}d`
          : undefined
      }
    >
      <TableWrap>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Waiting</th>
              <th>Driver</th>
              <th>Vehicle</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {queue.slice(0, QUEUE_PREVIEW).map((d) => {
              const stale = hoursWaiting(d.submittedAt) >= STALE_AFTER_HOURS;
              return (
                <tr key={d.driverId}>
                  <td>
                    <span className={stale ? "admin-badge red" : "admin-badge orange"}>
                      {formatWhen(d.submittedAt)}
                    </span>
                  </td>
                  <td>
                    <span className="admin-stack">
                      <span>{d.name ?? "Unnamed driver"}</span>
                      <em>{d.phone ?? d.email ?? "no contact on file"}</em>
                    </span>
                  </td>
                  <td>{vehicleOf(d)}</td>
                  <td className="num">
                    <Link
                      href={`/admin/dashboard/drivers/${d.driverId}`}
                      className="admin-review-link"
                    >
                      Review
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableWrap>

      {queue.length > QUEUE_PREVIEW ? (
        <div className="admin-card-more">
          <Link href="/admin/dashboard/drivers">
            Review the other {formatNumber(queue.length - QUEUE_PREVIEW)} waiting →
          </Link>
        </div>
      ) : null}
    </Card>
  );
}

/**
 * "12% up on the previous 30 days", coloured by whether up is good. The
 * previous period is the same number of days just before this one.
 */
function Change({ now, before, upIsGood = true }: { now: number | null; before: number | null; upIsGood?: boolean }) {
  if (now == null || before == null) return null;
  // Nothing to compare with: a percentage change from zero means nothing, so say nothing.
  if (before === 0) return null;
  const change = (now - before) / Math.abs(before);
  if (Math.abs(change) < 0.005) return <span className="admin-delta neutral">same as before</span>;
  const good = change > 0 === upIsGood;
  return (
    <span className={`admin-delta ${good ? "up" : "down"}`}>
      {change > 0 ? "▲" : "▼"} {formatPercent(Math.abs(change), 0)}
    </span>
  );
}

/** A card's hint line, with the change against the previous period after it. */
function Hint({ text, now, before, upIsGood }: { text?: string; now?: number | null; before?: number | null; upIsGood?: boolean }) {
  return (
    <>
      {text}
      {now !== undefined ? <> <Change now={now ?? null} before={before ?? null} upIsGood={upIsGood} /></> : null}
    </>
  );
}

const bucketLabel = (bucket: string, kind: string) => {
  const d = new Date(`${bucket}T12:00:00Z`);
  if (kind === "month") return d.toLocaleDateString("en-NG", { month: "short", year: "2-digit" });
  const short = bucket.slice(5).replace("-", "/");
  return kind === "week" ? `wk ${short}` : short;
};

function Breakdown({ title, rows, loading, note }: { title: string; rows: BreakdownRow[] | undefined; loading: boolean; note?: string }) {
  return (
    <Card title={title} padded>
      {loading && !rows ? (
        <Spinner />
      ) : !rows || rows.length === 0 ? (
        <EmptyState>Nothing in this period.</EmptyState>
      ) : (
        <BreakdownBars rows={rows.map((r) => ({ label: r.label, value: r.requests }))} />
      )}
      {note ? <p className="admin-note">{note}</p> : null}
    </Card>
  );
}

function NumbersCheck({ query }: { query: string }) {
  const { data, error, loading, refresh } = useAdminData<{ checks: ReconcileCheck[] }>(`/admin/insights/reconcile${query}`);
  if (error) return <ErrorState error={error} onRetry={refresh} />;
  if (loading && !data) return <Spinner label="Checking the numbers against the ledger…" />;
  const checks = data?.checks ?? [];
  const failing = checks.filter((c) => !c.ok);
  return (
    <Card
      title="Numbers check"
      right={<span className={failing.length ? "admin-check bad" : "admin-check good"}>{failing.length ? `${failing.length} of ${checks.length} disagree` : `All ${checks.length} agree`}</span>}
      padded
    >
      <p className="admin-note">
        Each headline total for this period, computed a second, independent way from the ledger. A difference means
        something is wrong with the money or the dashboard, and says where to look.
      </p>
      <TableWrap>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Check</th>
              <th className="num">Dashboard</th>
              <th className="num">Ledger</th>
              <th className="num">Difference</th>
            </tr>
          </thead>
          <tbody>
            {checks.map((c) => (
              <tr key={c.key}>
                <td>
                  <span className={c.ok ? "admin-check-dot good" : "admin-check-dot bad"} aria-hidden /> {c.label}
                </td>
                <td className="num">{c.key === "completed" ? formatNumber(c.left.value) : formatNaira(c.left.value)}</td>
                <td className="num">{c.key === "completed" ? formatNumber(c.right.value) : formatNaira(c.right.value)}</td>
                <td className={`num${c.ok ? "" : " admin-text-red"}`}>{c.key === "completed" ? formatNumber(c.diff) : formatNaira(c.diff)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
    </Card>
  );
}

function DashboardBody() {
  const { filters, bucket, hrefWith } = useInsightParams();
  const query = filtersQuery(filters);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // The period's numbers keep themselves current, like the old Overview did: a
  // ride booked while this tab is open shows up without pressing Refresh.
  const summary = useAdminData<InsightSummary>(`/admin/insights/summary${query}`, [], { refreshMs: LIVE_REFRESH_MS });
  const series = useAdminData<{ points: InsightPoint[] }>(`/admin/insights/timeseries${filtersQuery(filters, { bucket })}`);
  const byChannel = useAdminData<{ rows: BreakdownRow[] }>(`/admin/insights/breakdown${filtersQuery(filters, { by: "channel" })}`);
  const byZone = useAdminData<{ rows: BreakdownRow[] }>(`/admin/insights/breakdown${filtersQuery(filters, { by: "zone" })}`);
  const byType = useAdminData<{ rows: BreakdownRow[] }>(`/admin/insights/breakdown${filtersQuery(filters, { by: "rideType" })}`);
  const byCancel = useAdminData<{ rows: BreakdownRow[] }>(`/admin/insights/breakdown${filtersQuery(filters, { by: "cancelReason" })}`);
  // All-time context the period does not replace: people, the ledger by type, withdrawals by status.
  const overview = useAdminData<OverviewResponse>("/admin/metrics/overview", [], { refreshMs: LIVE_REFRESH_MS });
  const groupRides = useAdminData<GroupRideMetrics>("/admin/metrics/group-rides");

  const s = summary.data;
  const k = s?.current;
  const p = s?.previousKpis;
  const o = overview.data;
  const points = series.data?.points ?? [];
  const period = describeRange(filters.from, filters.to);
  // A zone, channel or ride-type view: deposits belong to no ride, so revenue there is ride fees only.
  const narrowed = Boolean(filters.zone || filters.channel || filters.rideType || filters.driverId || filters.riderId);
  const feesHref = (extra: Record<string, string> = {}) => `/admin/dashboard/fees${filtersQuery(filters, extra)}`;
  // Every card opens the rows that make up its number, with the same filters.
  const rows = (patch: Record<string, string | null> = {}) =>
    hrefWith({ tab: null, status: null, sort: null, dir: null, q: null, ...patch }, "#rows");

  const download = async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      await adminDownload(`/admin/insights/export${filtersQuery(filters, { scope: "overview", bucket })}`, `wheelers-overview-${filters.from}-to-${filters.to}.xlsx`);
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  };

  const refreshAll = () => {
    [summary, series, byChannel, byZone, byType, byCancel, overview, groupRides].forEach((d) => d.refresh());
  };

  return (
    <>
      <PageHeader
        title="Overview"
        subtitle={period}
        actions={
          <div className="admin-header-actions">
            <button type="button" className="admin-btn-ghost" onClick={() => void download()} disabled={downloading}>
              {downloading ? "Preparing Excel…" : "Download Excel"}
            </button>
            <RefreshButton busy={summary.loading || series.loading || overview.loading} onClick={refreshAll} />
          </div>
        }
      />
      {downloadError ? <div className="admin-inline-error">{downloadError}</div> : null}

      {/* Work before numbers: the one thing on this page that needs a human. */}
      <SectionLabel right={<Link href="/admin/dashboard/drivers">Open the KYC queue →</Link>}>Driver approvals</SectionLabel>
      <ApprovalQueue />

      <InsightFilterBar />

      {summary.error ? (
        <ErrorState error={summary.error} onRetry={summary.refresh} />
      ) : !k || !p || !s ? (
        <Spinner label="Loading this period…" />
      ) : (
        <>
          <SectionLabel>Money</SectionLabel>
          <StatGrid>
            <StatCard
              label="GMV"
              value={formatNairaCompact(k.gmvNgn)}
              hint={<Hint text={`Fares of ${formatNumber(k.completed)} completed trips`} now={k.gmvNgn} before={p.gmvNgn} />}
              href={rows({ status: "completed" })}
            />
            <StatCard
              label="Platform revenue"
              value={formatNairaCompact(k.platformRevenueNgn)}
              hint={<Hint text={narrowed ? "Commission + service fee on these trips" : "Commission + service fee + deposit fees"} now={k.platformRevenueNgn} before={p.platformRevenueNgn} />}
              tone="green"
              href={feesHref()}
            />
            <StatCard
              label="Driver payouts"
              value={formatNairaCompact(k.driverPayoutsNgn)}
              hint={<Hint text="What drivers kept after fees" now={k.driverPayoutsNgn} before={p.driverPayoutsNgn} />}
              href={rows({ tab: "drivers", sort: "earnings" })}
            />
            <StatCard
              label="Wallet float"
              value={formatNairaCompact(s.snapshot.walletFloatNgn)}
              hint={`Held in wallets now · ${formatNaira(s.snapshot.walletLockedNgn)} locked on rides`}
              tone="orange"
              href="/admin/dashboard/users?sort=spend"
            />
          </StatGrid>
          <StatGrid cols={4}>
            <StatCard
              label="Commission"
              value={formatNairaCompact(k.commissionNgn)}
              hint={<Hint text={`4% · plus ${formatNaira(k.serviceFeeNgn)} service fees`} now={k.commissionNgn} before={p.commissionNgn} />}
              href={feesHref()}
            />
            <StatCard
              label="Deposits in"
              value={formatNairaCompact(k.depositsNgn)}
              hint={<Hint text={`${formatNumber(k.depositCount)} top-ups · ${formatNaira(k.depositFeesNgn)} in fees`} now={k.depositsNgn} before={p.depositsNgn} />}
              href={`${feesHref({ kind: "deposit_fee" })}#ledger`}
            />
            <StatCard
              label="Withdrawals out"
              value={formatNairaCompact(k.withdrawalsNgn)}
              hint={<Hint text={`${formatNumber(k.withdrawalCount)} paid to banks`} now={k.withdrawalsNgn} before={p.withdrawalsNgn} />}
              href={`${feesHref({ kind: "transfer_fee" })}#ledger`}
            />
            <StatCard
              label="Platform wallet"
              value={formatNairaCompact(s.snapshot.platformWalletNgn)}
              hint="Fees collected and held, now"
              href={feesHref()}
            />
          </StatGrid>

          <SectionLabel>Rides</SectionLabel>
          <StatGrid>
            <StatCard
              label="Ride requests"
              value={formatNumber(k.requests)}
              hint={<Hint text={`${(k.requests / Math.max(1, s.days)).toFixed(1)} a day`} now={k.requests} before={p.requests} />}
              href={rows()}
            />
            <StatCard
              label="Completed"
              value={formatNumber(k.completed)}
              hint={<Hint text={`${formatPercent(k.matchRate)} of requests`} now={k.completed} before={p.completed} />}
              tone="green"
              href={rows({ status: "completed" })}
            />
            <StatCard
              label="No driver found"
              value={formatNumber(k.cancelledNoDriver)}
              hint={<Hint text="The search ran out" now={k.cancelledNoDriver} before={p.cancelledNoDriver} upIsGood={false} />}
              tone="red"
              href={rows({ status: "no_driver" })}
            />
            <StatCard
              label="In flight now"
              value={formatNumber(s.snapshot.inFlight)}
              hint="Matched or on a trip"
              tone="blue"
              href="/admin/dashboard/live-map"
            />
          </StatGrid>
          <StatGrid cols={4}>
            <StatCard
              label="Cancelled"
              value={formatNumber(k.cancelled)}
              hint={<Hint text={`${formatNumber(k.cancelledAfterMatch)} after a driver was found`} now={k.cancelled} before={p.cancelled} upIsGood={false} />}
              href={rows({ status: "cancelled" })}
            />
            <StatCard
              label="Average fare"
              value={k.avgFareNgn == null ? "—" : formatNaira(k.avgFareNgn)}
              hint={<Hint text={k.medianFareNgn == null ? undefined : `Median ${formatNaira(k.medianFareNgn)}`} now={k.avgFareNgn} before={p.avgFareNgn} />}
              href={rows({ status: "completed", sort: "fare" })}
            />
            <StatCard
              label="Distance covered"
              value={formatDistance(k.distanceKm)}
              hint={<Hint text="On completed trips" now={k.distanceKm} before={p.distanceKm} />}
              href={rows({ status: "completed", sort: "distance" })}
            />
            <StatCard
              label="Disputed"
              value={formatNumber(k.disputed)}
              hint="Raised by a rider or driver"
              href={rows({ status: "disputed" })}
            />
          </StatGrid>

          <SectionLabel>Marketplace</SectionLabel>
          <StatGrid>
            <StatCard
              label="Active drivers"
              value={formatNumber(k.activeDrivers)}
              hint={<Hint text="Completed at least one trip" now={k.activeDrivers} before={p.activeDrivers} />}
              href={rows({ tab: "drivers" })}
            />
            <StatCard
              label="Active riders"
              value={formatNumber(k.activeRiders)}
              hint={<Hint text="Took at least one trip" now={k.activeRiders} before={p.activeRiders} />}
              href={rows({ tab: "riders" })}
            />
            <StatCard
              label="Bid acceptance"
              value={k.bidAcceptanceRate == null ? "—" : formatPercent(k.bidAcceptanceRate)}
              hint={
                <Hint
                  text={
                    k.ridesWithBids === 0
                      ? "No ride got a bid"
                      : `${formatNumber(k.ridesWithBids)} rides got bids · ${k.avgBidsPerRide?.toFixed(1)} each${k.medianSecondsToFirstBid != null ? ` · first in ${formatDuration(k.medianSecondsToFirstBid)}` : ""}`
                  }
                  now={k.bidAcceptanceRate}
                  before={p.bidAcceptanceRate}
                />
              }
              href={rows({ tab: "drivers", sort: "bids" })}
            />
            <StatCard
              label="New users"
              value={formatNumber(k.newUsers)}
              hint={<Hint text={`${formatNumber(k.newRiders)} riders · ${formatNumber(k.newDrivers)} drivers`} now={k.newUsers} before={p.newUsers} />}
              href="/admin/dashboard/users"
            />
          </StatGrid>
          <p className="admin-footnote">
            Compared with {describeRange(s.previous.from, s.previous.to)}. Deposits, withdrawals, new users and the
            wallet figures are for the whole platform; the zone, channel and ride-type filters apply to ride numbers.
          </p>
        </>
      )}

      <SectionLabel>Trend</SectionLabel>
      {series.error ? (
        <ErrorState error={series.error} onRetry={series.refresh} />
      ) : series.loading && points.length === 0 ? (
        <Spinner />
      ) : (
        <>
          <Card title="Requests and completed trips" padded>
            <BarChart
              height={220}
              data={points.map((pt) => ({ label: bucketLabel(pt.bucket, bucket), values: [pt.requests, pt.completed] }))}
              series={[
                { name: "Requests", color: CHART_COLORS.MUTED },
                { name: "Completed", color: CHART_COLORS.ORANGE },
              ]}
            />
          </Card>
          <div className="admin-two-col">
            <Card title="GMV" padded>
              <AreaChart
                height={200}
                data={points.map((pt) => ({ label: bucketLabel(pt.bucket, bucket), value: pt.gmvNgn }))}
                formatValue={(n) => formatNairaCompact(n)}
              />
            </Card>
            <Card title="Platform revenue" right={<Link href={feesHref()}>Fees →</Link>} padded>
              <BarChart
                height={200}
                data={points.map((pt) => ({ label: bucketLabel(pt.bucket, bucket), values: [pt.commissionNgn, pt.serviceFeeNgn, pt.depositFeesNgn] }))}
                series={[
                  { name: "Commission", color: CHART_COLORS.ORANGE },
                  { name: "Service fee", color: CHART_COLORS.GREEN },
                  { name: "Deposit fees", color: CHART_COLORS.MUTED },
                ]}
                formatValue={(n) => formatNairaCompact(n)}
              />
            </Card>
          </div>
        </>
      )}

      <SectionLabel>Where rides come from</SectionLabel>
      <div className="admin-two-col">
        <Breakdown title="By channel" rows={byChannel.data?.rows} loading={byChannel.loading} note="Rides before 27 September are labelled from the bot's records; Claude bookings before then show as App." />
        <Breakdown title="By pickup zone" rows={byZone.data?.rows} loading={byZone.loading} />
      </div>
      <div className="admin-two-col">
        <Breakdown title="Single and group" rows={byType.data?.rows} loading={byType.loading} />
        <Card title="Why requests end without a trip" padded>
          {byCancel.loading && !byCancel.data ? (
            <Spinner />
          ) : (byCancel.data?.rows ?? []).length === 0 ? (
            <EmptyState>No cancellations in this period.</EmptyState>
          ) : (
            <BreakdownBars rows={(byCancel.data?.rows ?? []).map((r) => ({ label: r.label, value: r.cancelled }))} />
          )}
        </Card>
      </div>

      <SectionLabel>The rows behind the numbers</SectionLabel>
      <InsightTables filters={filters} />

      <SectionLabel>Group rides</SectionLabel>
      {groupRides.error ? (
        <ErrorState error={groupRides.error} onRetry={groupRides.refresh} />
      ) : groupRides.loading && !groupRides.data ? (
        <Spinner />
      ) : groupRides.data ? (
        <>
          <StatGrid>
            <StatCard
              label="Requests"
              value={formatNumber(groupRides.data.total)}
              hint={`${formatNumber(groupRides.data.last30d)} in the last 30 days`}
            />
            <StatCard
              label="Booked"
              value={formatNumber(groupRides.data.byStatus.BOOKED ?? 0)}
              hint={`${formatPercent(groupRides.data.bookingRate)} of all requests`}
              tone="green"
            />
            <StatCard
              label="Groups formed"
              value={formatNumber(groupRides.data.groups.formed)}
              hint={`${groupRides.data.groups.avgSize.toFixed(1)} riders per group on average`}
            />
            <StatCard
              label="Stuck on the selfie"
              value={formatNumber(groupRides.data.awaitingSelfie)}
              hint={`${formatPercent(groupRides.data.selfieDropOffRate)} never verify and go no further`}
              tone="red"
            />
          </StatGrid>

          <StatGrid cols={4}>
            <StatCard
              label="Match rate"
              value={formatPercent(groupRides.data.matchRate)}
              hint="Of those that reached matching"
            />
            <StatCard
              label="Time to match"
              value={
                groupRides.data.avgSecondsToGroup > 0
                  ? formatDuration(groupRides.data.avgSecondsToGroup)
                  : "—"
              }
              hint="Ready → grouped, on average"
            />
            <StatCard
              label="Seat fare"
              value={formatNaira(groupRides.data.avgSeatFareNgn)}
              hint="Average per booked seat"
            />
            <StatCard
              label="Expired / cancelled"
              value={formatNumber(
                groupRides.data.expired + groupRides.data.cancelled,
              )}
              hint={`${formatNumber(groupRides.data.expired)} found nobody in time`}
            />
          </StatGrid>

          <div className="admin-two-col">
            <Card title="Where group riders drop off" padded>
              {/* A funnel, not a bar race — the steps are ordered, so the
                  interesting number is the gap between each pair. */}
              <BreakdownBars
                rows={groupRides.data.funnel.map((f) => ({ label: f.step, value: f.count }))}
              />
            </Card>

            <Card title="Verification selfies" padded>
              <div className="admin-chip-row">
                <span className="admin-chip">
                  <strong>Stored</strong>
                  <span>{formatNumber(groupRides.data.faceVerification.stored)}</span>
                </span>
                <span className="admin-chip">
                  <strong>Still uploading</strong>
                  <span>{formatNumber(groupRides.data.faceVerification.uploading)}</span>
                </span>
                <span className="admin-chip">
                  <strong>Failed</strong>
                  <span>{formatNumber(groupRides.data.faceVerification.failed)}</span>
                </span>
              </div>
              <p className="admin-note">
                Every group ride needs a verification selfie before matching starts. It is the
                single biggest drop-off in this funnel.
              </p>
            </Card>
          </div>

        </>
      ) : null}


      {o ? (
        <>
      <SectionLabel>People</SectionLabel>
          <StatGrid>
            <StatCard
              label="Total users"
              value={formatNumber(o.users.total)}
              hint={`${formatNumber(o.users.new30d)} joined in 30 days`}
              href="/admin/dashboard/users"
            />
            <StatCard
              label="Riders"
              value={formatNumber(o.users.riders)}
              hint={`${formatNumber(o.users.kycVerified)} identity verified`}
              href="/admin/dashboard/users?role=rider"
            />
            <StatCard
              label="Drivers"
              value={formatNumber(o.drivers.total)}
              hint={`${formatNumber(o.drivers.approved)} approved · ${formatNumber(o.drivers.pendingKyc)} awaiting review`}
              href="/admin/dashboard/users?role=driver"
            />
            <StatCard
              label="Online now"
              value={formatNumber(o.drivers.online + o.drivers.onRide)}
              hint={`${formatNumber(o.drivers.onRide)} on a trip`}
              tone="green"
            />
          </StatGrid>


          <Card title="Money movement, all time" padded>
            <BreakdownBars
              color={CHART_COLORS.GREEN}
              rows={o.money.byType
                .slice()
                .sort((a, b) => Number(b.allTime) - Number(a.allTime))
                .map((t) => ({ label: humanise(t.type), value: Number(t.allTime) }))}
              formatValue={(n) => formatNairaCompact(n)}
            />
          </Card>

          {o.withdrawals.length > 0 ? (
            <Card title="Withdrawals by status, all time" padded>
              <div className="admin-chip-row">
                {o.withdrawals.map((w) => (
                  <span key={w.status} className="admin-chip">
                    <strong>{humanise(w.status)}</strong>
                    <span>
                      {formatNumber(w.count)} · {formatNaira(w.amountNgn)}
                    </span>
                  </span>
                ))}
              </div>
            </Card>
          ) : null}
        </>
      ) : overview.error ? (
        <ErrorState error={overview.error} onRetry={overview.refresh} />
      ) : null}

      <SectionLabel>Checks</SectionLabel>
      <NumbersCheck query={query} />
    </>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<Spinner label="Loading the overview…" />}>
      <DashboardBody />
    </Suspense>
  );
}
