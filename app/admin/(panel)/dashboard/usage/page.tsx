"use client";

import { useMemo, useState } from "react";

import { BarChart, CHART_COLORS } from "@/components/admin/charts";
import { Card, ErrorState, PageHeader, RefreshButton, Spinner, StatCard, StatGrid } from "@/components/admin/ui";
import { useAdminData } from "@/components/admin/use-admin-data";
import type { ServiceUsage } from "@/lib/admin-api";

/**
 * Usage: what the backend asked other people's servers to do, per day.
 *
 * Google, Gemini, Groq, WhatsApp, Paystack, Twilio, Resend — every one of them
 * bills or rate-limits by the call, and their consoles each show only their
 * own slice. This page is the whole picture in one place, and the thing to
 * look at BEFORE a bill arrives: a service that started being called ten
 * times as often on Tuesday shows up here on Tuesday.
 */

const PERIODS = [7, 30, 90] as const;

const n = (v: number) => v.toLocaleString("en-NG");
const dayLabel = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("en-NG", { day: "numeric", month: "short" });

export default function UsagePage() {
  const [days, setDays] = useState<(typeof PERIODS)[number]>(30);
  const { data, error, loading, refresh } = useAdminData<{ days: number; services: ServiceUsage[] }>(
    `/admin/usage/services?days=${days}`,
    [days],
    { refreshMs: 60_000 },
  );

  const services = useMemo(() => (data?.services ?? []).slice().sort((a, b) => b.totalCalls - a.totalCalls), [data]);
  const used = services.filter((s) => s.totalCalls > 0);
  const totals = useMemo(() => ({
    calls: services.reduce((sum, s) => sum + s.totalCalls, 0),
    today: services.reduce((sum, s) => sum + s.today.calls, 0),
    failed: services.reduce((sum, s) => sum + s.totalFailed, 0),
  }), [services]);

  // One bar per day, stacked by the services that were actually used.
  const chart = useMemo(() => {
    const top = used.slice(0, 6);
    const dayKeys = services[0]?.days.map((d) => d.day) ?? [];
    return {
      series: top.map((s, i) => ({ name: s.label, color: [CHART_COLORS.ORANGE, CHART_COLORS.GREEN, CHART_COLORS.MUTED, "#6B7280", "#9CA3AF", "#D1D5DB"][i]! })),
      data: dayKeys.map((day, i) => ({ label: dayLabel(day), values: top.map((s) => s.days[i]?.calls ?? 0) })),
    };
  }, [services, used]);

  return (
    <>
      <PageHeader
        title="Usage"
        subtitle="Every outside service the backend calls — Google, Gemini, Groq, WhatsApp, Paystack — counted per day. Their own consoles hold the bills; this is where a spike shows first."
        actions={
          <div className="admin-page-actions">
            <div className="admin-range-tabs" role="group" aria-label="Period">
              {PERIODS.map((p) => (
                <button key={p} type="button" className={`admin-range-tab${p === days ? " active" : ""}`} onClick={() => setDays(p)}>
                  {p}d
                </button>
              ))}
            </div>
            <RefreshButton onClick={refresh} busy={loading} />
          </div>
        }
      />

      {error ? <ErrorState error={error} onRetry={refresh} /> : null}
      {loading && !data ? <Spinner label="Counting…" /> : null}

      {data ? (
        <>
          <StatGrid cols={3}>
            <StatCard label={`Calls · ${days} days`} value={n(totals.calls)} />
            <StatCard label="Calls · today" value={n(totals.today)} />
            <StatCard label={`Failed · ${days} days`} value={n(totals.failed)} hint={totals.calls > 0 ? `${((totals.failed / totals.calls) * 100).toFixed(1)}% of calls` : undefined} />
          </StatGrid>

          <Card title="Calls per day" right={used.length > 6 ? "top 6 services" : undefined}>
            <div className="admin-card-body">
              <BarChart data={chart.data} series={chart.series} height={220} formatValue={n} />
            </div>
          </Card>

          <Card title="By service">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Service</th>
                  <th className="num">Today</th>
                  <th className="num">{days} days</th>
                  <th className="num">Failed</th>
                  <th className="num">Avg time</th>
                  <th>Pricing</th>
                  <th>Bill</th>
                </tr>
              </thead>
              <tbody>
                {services.map((s) => (
                  <tr key={s.key} style={s.totalCalls === 0 ? { opacity: 0.45 } : undefined}>
                    <td>{s.label}</td>
                    <td className="num">{n(s.today.calls)}</td>
                    <td className="num">{n(s.totalCalls)}</td>
                    <td className="num">
                      {s.totalFailed > 0 ? <span className="admin-badge red">{n(s.totalFailed)}</span> : "—"}
                    </td>
                    <td className="num">{s.today.avgMs !== null ? `${n(s.today.avgMs)} ms` : "—"}</td>
                    <td className="mono">{s.pricing}</td>
                    <td>
                      <a href={s.console} target="_blank" rel="noreferrer">Open ↗</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      ) : null}
    </>
  );
}
