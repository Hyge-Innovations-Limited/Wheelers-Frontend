"use client";

import type { GroupRideMetrics } from "@/lib/admin-api";
import { formatDuration, formatNaira, formatNumber, formatPercent, humanise } from "@/lib/admin-format";
import { BreakdownBars, CHART_COLORS } from "@/components/admin/charts";
import { useAdminData } from "@/components/admin/use-admin-data";
import {
  Card,
  ErrorState,
  PageHeader,
  RefreshButton,
  SectionLabel,
  Spinner,
  StatCard,
  StatGrid,
  TableWrap,
} from "@/components/admin/ui";

/**
 * Group rides read as a funnel, not a total. A request has to clear four steps
 * before anybody travels, and the interesting number is always the gap between
 * two of them — so the steps are shown with their drop-off spelled out rather
 * than left for the reader to subtract.
 */
export default function GroupRidesPage() {
  const { data, error, loading, refresh } = useAdminData<GroupRideMetrics>("/admin/metrics/group-rides");

  if (loading && !data) return <Spinner label="Loading group ride metrics…" />;
  if (error) return <ErrorState error={error} onRetry={refresh} />;
  if (!data) return null;

  const biggestDropIndex = data.funnel.reduce(
    (worst, step, i) => {
      if (i === 0) return worst;
      const lost = data.funnel[i - 1].count - step.count;
      return lost > worst.lost ? { index: i, lost } : worst;
    },
    { index: -1, lost: -1 },
  ).index;

  return (
    <>
      <PageHeader
        title="Group rides"
        subtitle={`${formatNumber(data.total)} requests · ${formatNumber(data.byStatus.BOOKED ?? 0)} became trips`}
        actions={<RefreshButton busy={loading} onClick={refresh} />}
      />

      <StatGrid>
        <StatCard
          label="Requests"
          value={formatNumber(data.total)}
          hint={`${formatNumber(data.last30d)} in the last 30 days · ${formatNumber(data.today)} today`}
        />
        <StatCard
          label="Booked"
          value={formatNumber(data.byStatus.BOOKED ?? 0)}
          hint={`${formatPercent(data.bookingRate)} of everything requested`}
          tone="green"
        />
        <StatCard
          label="Groups formed"
          value={formatNumber(data.groups.formed)}
          hint={`${data.groups.avgSize.toFixed(2)} riders each · largest ${data.groups.maxSize}`}
        />
        <StatCard
          label="Stuck on the selfie"
          value={formatNumber(data.awaitingSelfie)}
          hint={`${formatPercent(data.selfieDropOffRate)} never verify`}
          tone="red"
        />
      </StatGrid>

      <StatGrid cols={4}>
        <StatCard
          label="Match rate"
          value={formatPercent(data.matchRate)}
          hint="Of requests that reached matching"
        />
        <StatCard
          label="Time to match"
          value={data.avgSecondsToGroup > 0 ? formatDuration(data.avgSecondsToGroup) : "—"}
          hint="Ready → grouped, on average"
        />
        <StatCard
          label="Riders grouped"
          value={formatNumber(data.groups.ridersGrouped)}
          hint="People who shared a vehicle"
        />
        <StatCard
          label="Seat fare"
          value={formatNaira(data.avgSeatFareNgn)}
          hint={`${formatNaira(data.bookedValueNgn)} booked in total`}
        />
      </StatGrid>

      <SectionLabel>The funnel</SectionLabel>
      <Card padded>
        <TableWrap>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Step</th>
                <th className="num">Reached</th>
                <th className="num">Lost here</th>
                <th className="num">Survives</th>
                <th>Share of all requests</th>
              </tr>
            </thead>
            <tbody>
              {data.funnel.map((step, i) => {
                const previous = i === 0 ? step.count : data.funnel[i - 1].count;
                const lost = i === 0 ? 0 : previous - step.count;
                const survives = previous > 0 ? step.count / previous : 0;
                const share = data.total > 0 ? step.count / data.total : 0;
                return (
                  <tr key={step.step} className={i === biggestDropIndex ? "admin-row-warn" : undefined}>
                    <td>
                      <strong>{step.step}</strong>
                      {i === biggestDropIndex ? <em className="admin-sub">biggest drop-off</em> : null}
                    </td>
                    <td className="num">{formatNumber(step.count)}</td>
                    <td className="num">{i === 0 ? "—" : `−${formatNumber(lost)}`}</td>
                    <td className="num">{i === 0 ? "—" : formatPercent(survives)}</td>
                    <td>
                      <span className="admin-breakdown-track">
                        <span
                          className="admin-breakdown-fill"
                          style={{
                            width: `${Math.max(2, share * 100)}%`,
                            background: i === biggestDropIndex ? "#FF3333" : CHART_COLORS.ORANGE,
                          }}
                        />
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
      </Card>

      <div className="admin-two-col">
        <Card title="Every request by status" padded>
          <BreakdownBars
            rows={Object.entries(data.byStatus)
              .sort((a, b) => b[1] - a[1])
              .map(([status, count]) => ({ label: humanise(status), value: count }))}
          />
        </Card>

        <Card title="Verification selfies" padded>
          <BreakdownBars
            color={CHART_COLORS.GREEN}
            rows={[
              { label: "Stored", value: data.faceVerification.stored },
              { label: "Still uploading", value: data.faceVerification.uploading },
              { label: "Failed", value: data.faceVerification.failed },
            ]}
          />
          <p className="admin-note">
            Every group ride needs a verification selfie before matching begins. Riders who never
            take it never enter the pool — which is why it is the largest single loss above, ahead
            of anything the matching algorithm does.
          </p>
        </Card>
      </div>

      <Card title="Requests that ended without a trip" padded>
        <div className="admin-chip-row">
          <span className="admin-chip">
            <strong>Expired</strong>
            <span>{formatNumber(data.expired)} found nobody in time</span>
          </span>
          <span className="admin-chip">
            <strong>Cancelled</strong>
            <span>{formatNumber(data.cancelled)} pulled out</span>
          </span>
          <span className="admin-chip">
            <strong>Awaiting selfie</strong>
            <span>{formatNumber(data.awaitingSelfie)} never verified</span>
          </span>
        </div>
      </Card>
    </>
  );
}
