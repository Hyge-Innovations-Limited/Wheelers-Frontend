"use client";

import { useState } from "react";
import Link from "next/link";
import type {
  GroupRideMetrics,
  OverviewResponse,
  PendingDriverRow,
  TimeseriesPoint,
} from "@/lib/admin-api";
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
import { AreaChart, BarChart, BreakdownBars, CHART_COLORS } from "@/components/admin/charts";
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

const RANGES = [7, 30, 90] as const;

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

export default function DashboardPage() {
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);

  // The Overview answers "how are we doing right now", so it keeps itself
  // current: a ride booked while this tab is open shows up without anyone
  // pressing Refresh. Every number still comes from the live API — nothing here
  // is cached or estimated.
  const overview = useAdminData<OverviewResponse>("/admin/metrics/overview", [], {
    refreshMs: LIVE_REFRESH_MS,
  });
  const series = useAdminData<{ days: number; points: TimeseriesPoint[] }>(
    `/admin/metrics/timeseries?days=${days}`,
  );
  const cancels = useAdminData<{ reasons: Array<{ reason: string; count: number }> }>(
    "/admin/metrics/cancellations",
  );
  const groupRides = useAdminData<GroupRideMetrics>("/admin/metrics/group-rides");

  // No early return on the metrics: the approval queue below is a different
  // request, and a slow or broken /metrics/overview must not hide the work
  // someone came here to do.
  const o = overview.data;
  const points = series.data?.points ?? [];
  const shortDate = (iso: string) => iso.slice(5).replace("-", "/");

  return (
    <>
      <PageHeader
        title="Overview"
        actions={
          <RefreshButton
            busy={overview.loading || series.loading || cancels.loading || groupRides.loading}
            onClick={() => {
              overview.refresh();
              series.refresh();
              cancels.refresh();
              groupRides.refresh();
            }}
          />
        }
      />

      {/* Work before numbers: the one thing on this page that needs a human. */}
      <SectionLabel
        right={<Link href="/admin/dashboard/drivers">Open the KYC queue →</Link>}
      >
        Driver approvals
      </SectionLabel>
      <ApprovalQueue />

      {overview.error ? (
        <ErrorState error={overview.error} onRetry={overview.refresh} />
      ) : !o ? (
        <Spinner label="Loading platform metrics…" />
      ) : (
        <>
      {/* Money first — it is the question everyone opens this page to answer. */}
      <SectionLabel>Money</SectionLabel>
      <StatGrid>
        <StatCard
          label="Gross processed"
          value={formatNairaCompact(o.money.grossProcessedNgn)}
          hint={`${formatNaira(o.money.gross30dNgn)} in the last 30 days`}
        />
        <StatCard
          label="Platform revenue"
          value={formatNairaCompact(o.money.platformRevenueNgn)}
          hint={`VAT + levy + service fee · ${formatNaira(o.money.platformRevenue30dNgn)} in 30d`}
          tone="green"
        />
        <StatCard
          label="Driver payouts"
          value={formatNairaCompact(o.money.driverPayoutsNgn)}
          hint={`${formatNaira(o.money.withdrawalsNgn)} withdrawn to banks`}
        />
        <StatCard
          label="Wallet float"
          value={formatNairaCompact(o.money.walletFloatNgn)}
          hint={`${formatNaira(o.money.walletLockedNgn)} locked on active rides`}
          tone="orange"
        />
      </StatGrid>

      <StatGrid cols={4}>
        <StatCard
          label="Deposits in"
          value={formatNairaCompact(o.money.depositsNgn)}
          hint={`${formatNumber(o.money.depositCount)} top-ups`}
        />
        <StatCard label="Platform wallet" value={formatNairaCompact(o.money.platformWalletNgn)} hint="Fees collected, held" />
        <StatCard
          label="Today"
          value={formatNaira(o.money.grossTodayNgn)}
          hint={`${formatNumber(o.rides.completedToday)} rides completed`}
        />
        <StatCard
          label="Refunds & penalties"
          value={formatNairaCompact(Number(o.money.refundsNgn) + Number(o.money.penaltiesNgn))}
          hint="Reversed or charged"
        />
      </StatGrid>

      <SectionLabel>Rides</SectionLabel>
      <StatGrid>
        <StatCard
          label="Rides attempted"
          value={formatNumber(o.rides.attempted)}
          hint={`${formatNumber(o.rides.last30d)} in the last 30 days`}
          href="/admin/dashboard/rides"
        />
        <StatCard
          label="Completed"
          value={formatNumber(o.rides.completed)}
          hint={`${formatPercent(o.rides.completionRate)} of everything attempted`}
          tone="green"
          href="/admin/dashboard/rides?status=COMPLETED"
        />
        <StatCard
          label="Never matched"
          value={formatNumber(o.rides.neverMatched)}
          hint={`Never reached a driver · ${formatPercent(1 - o.rides.matchRate)} of attempts`}
          tone="red"
          href="/admin/dashboard/rides?status=CANCELLED"
        />
        <StatCard label="In flight now" value={formatNumber(o.rides.active)} hint="Matched or on trip" tone="blue" />
      </StatGrid>

      <StatGrid cols={4}>
        <StatCard
          label="Cancelled"
          value={formatNumber(o.rides.cancelled)}
          hint={`${formatNumber(o.rides.cancelled - o.rides.neverMatched)} after a driver was found`}
          href="/admin/dashboard/rides?status=CANCELLED"
        />
        <StatCard
          label="Match rate"
          value={formatPercent(o.rides.matchRate)}
          hint="Attempts that reached a driver"
        />
        <StatCard label="Disputed" value={formatNumber(o.rides.disputed)} hint="Raised by a rider or driver" />
        <StatCard
          label="Completed today"
          value={formatNumber(o.rides.completedToday)}
          hint={`${formatNumber(o.rides.completed7d)} this week`}
        />
      </StatGrid>

      <StatGrid cols={4}>
        <StatCard label="Average fare" value={formatNaira(o.rides.avgFareNgn)} />
        <StatCard
          label="Average trip"
          value={formatDistance(o.rides.avgDistanceKm)}
          hint={formatDuration(o.rides.avgDurationSeconds)}
        />
        <StatCard label="Distance covered" value={`${formatNumber(Math.round(o.rides.totalDistanceKm))} km`} />
        <StatCard
          label="Attempts per day"
          value={(o.rides.last30d / 30).toFixed(1)}
          hint={`${(o.rides.completed30d / 30).toFixed(1)} completed · 30-day average`}
        />
      </StatGrid>

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

      <Card title="How the user base grew" padded>
        {series.loading && points.length === 0 ? (
          <Spinner />
        ) : (
          <AreaChart
            height={200}
            color={CHART_COLORS.ORANGE}
            data={(() => {
              // The window only covers the last N days, so start the running
              // total at whatever existed before it — otherwise the line
              // pretends the platform began this month.
              const inWindow = points.reduce((n, p) => n + p.signups, 0);
              let running = o.users.total - inWindow;
              return points.map((p) => {
                running += p.signups;
                return { label: shortDate(p.date), value: running };
              });
            })()}
            formatValue={(n) => formatNumber(Math.round(n))}
          />
        )}
      </Card>

      <Card title="New sign-ups per day" padded>
        {series.loading && points.length === 0 ? (
          <Spinner />
        ) : (
          <BarChart
            height={180}
            data={points.map((p) => ({
              label: shortDate(p.date),
              values: [Math.max(0, p.signups - p.driverSignups), p.driverSignups],
            }))}
            series={[
              { name: "Riders", color: CHART_COLORS.MUTED },
              { name: "Drivers", color: CHART_COLORS.GREEN },
            ]}
          />
        )}
      </Card>

      <SectionLabel
        right={
          <div className="admin-range-tabs">
            {RANGES.map((r) => (
              <button
                key={r}
                type="button"
                className={`admin-range-tab${r === days ? " active" : ""}`}
                onClick={() => setDays(r)}
              >
                {r}d
              </button>
            ))}
          </div>
        }
      >
        Trend
      </SectionLabel>

      <Card title="Requests vs completed rides" padded>
        {series.error ? (
          <ErrorState error={series.error} onRetry={series.refresh} />
        ) : series.loading && points.length === 0 ? (
          <Spinner />
        ) : (
          <BarChart
            height={220}
            data={points.map((p) => ({
              label: shortDate(p.date),
              values: [p.ridesRequested, p.ridesCompleted],
            }))}
            series={[
              { name: "Requested", color: CHART_COLORS.MUTED },
              { name: "Completed", color: CHART_COLORS.ORANGE },
            ]}
          />
        )}
      </Card>

      <Card title="Gross processed per day" padded>
        {series.loading && points.length === 0 ? (
          <Spinner />
        ) : (
          <AreaChart
            height={200}
            data={points.map((p) => ({ label: shortDate(p.date), value: Number(p.grossNgn) }))}
            formatValue={(n) => formatNairaCompact(n)}
          />
        )}
      </Card>

      <div className="admin-two-col">
        <Card title="Why requests fail" padded>
          {cancels.loading ? (
            <Spinner />
          ) : cancels.error ? (
            <ErrorState error={cancels.error} onRetry={cancels.refresh} />
          ) : (
            <BreakdownBars
              rows={(cancels.data?.reasons ?? []).slice(0, 8).map((r) => ({ label: r.reason, value: r.count }))}
            />
          )}
        </Card>

        <Card title="Money movement" padded>
          <BreakdownBars
            color={CHART_COLORS.GREEN}
            rows={o.money.byType
              .slice()
              .sort((a, b) => Number(b.allTime) - Number(a.allTime))
              .map((t) => ({ label: humanise(t.type), value: Number(t.allTime) }))}
            formatValue={(n) => formatNairaCompact(n)}
          />
        </Card>
      </div>

      {o.withdrawals.length > 0 ? (
        <Card title="Withdrawals" padded>
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

      <div className="admin-footnote">
        Money figures come from the transaction ledger, not from ride records — so they stay correct
        even when settlement is still catching up.{" "}
        <Link href="/admin/dashboard/users">Browse users →</Link>
      </div>
        </>
      )}
    </>
  );
}
