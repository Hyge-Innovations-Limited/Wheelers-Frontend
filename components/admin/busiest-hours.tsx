"use client";

import type { HoursResponse, InsightFilters } from "@/lib/admin-api";
import { formatDate, formatHours, formatNumber, formatPercent } from "@/lib/admin-format";
import { filtersQuery } from "@/lib/insight-filters";
import { BarChart, CHART_COLORS } from "@/components/admin/charts";
import { useAdminData } from "@/components/admin/use-admin-data";
import { Card, EmptyState, ErrorState, Spinner } from "@/components/admin/ui";

/** 8 → "08:00", and the hour it covers, "08:00 to 08:59". */
const clock = (hour: number) => `${String(hour).padStart(2, "0")}:00`;
const span = (hour: number) => `${clock(hour)} to ${String(hour).padStart(2, "0")}:59`;
const SHORT_DAY = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * When riders ask for rides, and how many drivers are on at that hour.
 *
 * Demand is every request in the period, by the Lagos hour it was made.
 * Supply is drivers on shift during that hour on an average day. Set side by
 * side they say when to have more drivers on: the hour where requests for each
 * driver are highest is the hour riders wait longest.
 */
export function BusiestHours({ filters }: { filters: InsightFilters }) {
  const { data, error, loading, refresh } = useAdminData<HoursResponse>(`/admin/insights/hours${filtersQuery(filters)}`);

  if (error) return <ErrorState error={error} onRetry={refresh} />;
  if (loading && !data) return <Spinner label="Loading the busiest hours…" />;
  if (!data) return null;

  const total = data.hours.reduce((n, h) => n + h.requests, 0);
  const driverHours = data.hours.reduce((n, h) => n + h.driverHours, 0);
  const peak = data.peakHour == null ? null : data.hours[data.peakHour];
  const peakDay = data.peakWeekday == null ? null : data.weekdays[data.peakWeekday - 1];
  const tight = data.tightestHour == null ? null : data.hours[data.tightestHour];
  const busiestCell = Math.max(1, ...data.grid.flat());

  const supplyNote = !data.supply.shown
    ? "Drivers on shift are not shown under a zone, channel, ride type or rider filter: a shift belongs to no ride."
    : !data.supply.recordedFrom
      ? "No driver shift has been recorded yet. Hours online are counted from the first time a driver goes online after this update."
      : data.supply.recordedFrom.slice(0, 10) > filters.from
        ? `Driver shifts are recorded from ${formatDate(data.supply.recordedFrom)}. Earlier days in this period show requests but no drivers.`
        : null;

  if (total === 0 && driverHours === 0) {
    return (
      <Card padded>
        <EmptyState>No requests and no drivers on shift in this period.</EmptyState>
        {supplyNote ? <p className="admin-note">{supplyNote}</p> : null}
      </Card>
    );
  }

  return (
    <>
      <div className="admin-chip-row admin-hours-chips">
        <span className="admin-chip">
          <strong>Busiest hour</strong>
          <span>{peak ? `${span(peak.hour)} · ${formatNumber(peak.requests)} requests` : "—"}</span>
        </span>
        <span className="admin-chip">
          <strong>Busiest day</strong>
          <span>{peakDay ? `${peakDay.label} · ${formatNumber(peakDay.requests)} requests` : "—"}</span>
        </span>
        <span className="admin-chip">
          <strong>Most stretched hour</strong>
          <span>
            {tight && tight.requestsPerDriver != null
              ? `${span(tight.hour)} · ${tight.requestsPerDriver.toFixed(1)} requests for each driver on shift`
              : "—"}
          </span>
        </span>
      </div>

      <div className="admin-two-col">
        <Card title="Requests by hour of the day" right="Lagos time" padded>
          <BarChart
            height={220}
            data={data.hours.map((h) => ({ label: clock(h.hour), values: [h.requests, h.completed] }))}
            series={[
              { name: "Requests", color: CHART_COLORS.MUTED },
              { name: "Completed", color: CHART_COLORS.ORANGE },
            ]}
          />
        </Card>
        <Card title="Drivers on shift by hour of the day" right="Average day" padded>
          {data.supply.shown && driverHours > 0 ? (
            <BarChart
              height={220}
              data={data.hours.map((h) => ({ label: clock(h.hour), values: [h.avgDriversOnline ?? 0] }))}
              series={[{ name: "Drivers on shift", color: CHART_COLORS.GREEN }]}
              formatValue={(n) => (n >= 10 ? Math.round(n).toLocaleString("en-NG") : n.toFixed(1))}
            />
          ) : (
            <EmptyState>{data.supply.shown ? "No driver was on shift in this period." : "Not shown under this filter."}</EmptyState>
          )}
        </Card>
      </div>

      <Card title="Requests by day and hour" right="Darker is busier" padded>
        <div className="admin-heat-wrap">
          <div className="admin-heat" role="table" aria-label="Requests by weekday and hour">
            <div className="admin-heat-row admin-heat-head" role="row">
              <span className="admin-heat-day" />
              {data.hours.map((h) => (
                <span key={h.hour} className="admin-heat-hour" role="columnheader">
                  {h.hour % 3 === 0 ? String(h.hour).padStart(2, "0") : ""}
                </span>
              ))}
            </div>
            {data.grid.map((row, day) => (
              <div key={day} className="admin-heat-row" role="row">
                <span className="admin-heat-day" role="rowheader">{SHORT_DAY[day]}</span>
                {row.map((n, hour) => (
                  <span
                    key={hour}
                    role="cell"
                    className={`admin-heat-cell${n > 0 ? " on" : ""}`}
                    style={
                      n > 0
                        ? {
                            background: `rgba(255, 92, 0, ${0.14 + 0.86 * (n / busiestCell)})`,
                            // White reads on the dark cells only; the pale ones take ink.
                            color: n / busiestCell > 0.45 ? "#fff" : "#7A2C00",
                          }
                        : undefined
                    }
                    title={`${data.weekdays[day]?.label ?? ""}, ${span(hour)}: ${formatNumber(n)} ${n === 1 ? "request" : "requests"}`}
                  >
                    {n > 0 && busiestCell < 100 ? n : ""}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
        <p className="admin-note">
          {formatNumber(total)} requests in this period
          {data.supply.shown && driverHours > 0 ? `, and ${formatHours(driverHours)} of drivers on shift` : ""}.
          {peak && peak.matchRate != null ? ` At the busiest hour ${formatPercent(peak.matchRate, 0)} of requests became trips.` : ""}
          {supplyNote ? ` ${supplyNote}` : ""}
        </p>
      </Card>
    </>
  );
}
