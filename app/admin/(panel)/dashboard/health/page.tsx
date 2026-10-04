"use client";

import { useMemo, useState } from "react";

import { AreaChart, BarChart, CHART_COLORS } from "@/components/admin/charts";
import { Card, EmptyState, ErrorState, PageHeader, RefreshButton, Spinner, StatCard, StatGrid, TableWrap } from "@/components/admin/ui";
import { useAdminData } from "@/components/admin/use-admin-data";
import type { HealthRange, HealthReport, HealthStatus } from "@/lib/admin-api";

/**
 * Health: is Wheelers working right now, and has it been.
 *
 * The checks run every minute on the server (database, Redis, the Kafka
 * outbox, the API servers, Stellar) and are kept for 7 days, so each part has
 * an uptime and a status bar like a public status page. Underneath: API
 * traffic, errors and response times, database query times, the stretches
 * where any of them spiked, and the queries the database spends its time on.
 */

const RANGES: Array<{ key: HealthRange; label: string }> = [
  { key: "1h", label: "1 hour" },
  { key: "24h", label: "24 hours" },
  { key: "7d", label: "7 days" },
];

const STATUS_WORDS: Record<HealthStatus, string> = { up: "Working", degraded: "Slow", down: "Down" };
const BANNER: Record<HealthStatus, { title: string; sub: string }> = {
  up: { title: "Everything is working", sub: "Every part answered its last check on time." },
  degraded: { title: "Some parts are slow", sub: "Riders and drivers can still use Wheelers, but something needs a look." },
  down: { title: "Outage", sub: "A core part is not answering. Riders and drivers are likely affected." },
};

const n = (v: number) => v.toLocaleString("en-NG");
const ms = (v: number | null) => (v === null ? "—" : v >= 5000 ? "> 2.5 s" : v >= 1000 ? `${(v / 1000).toFixed(1)} s` : `${v} ms`);

function timeLabel(at: number, range: HealthRange): string {
  const d = new Date(at);
  if (range === "7d") return d.toLocaleString("en-NG", { weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Lagos" });
  return d.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Lagos" });
}

function when(at: number): string {
  return new Date(at).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Lagos" });
}

function duration(msTotal: number): string {
  const minutes = Math.round(msTotal / 60000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} h ${minutes % 60} min`;
  return `${Math.floor(hours / 24)} days`;
}

export default function HealthPage() {
  const [range, setRange] = useState<HealthRange>("24h");
  const { data, error, loading, refresh } = useAdminData<HealthReport>(`/admin/health?range=${range}`, [range], { refreshMs: 30_000 });

  const charts = useMemo(() => {
    const points = data?.points ?? [];
    const label = (at: number) => timeLabel(at, range);
    return {
      httpP95: points.map((p) => ({ label: label(p.at), value: p.httpP95 ?? 0 })),
      traffic: points.map((p) => ({ label: label(p.at), values: [p.requests, p.errors] })),
      dbP95: points.map((p) => ({ label: label(p.at), value: p.dbP95 ?? 0 })),
      queries: points.map((p) => ({ label: label(p.at), values: [p.queries, p.slowQueries + p.dbErrors] })),
    };
  }, [data, range]);

  const rangeWord = RANGES.find((r) => r.key === range)!.label;

  return (
    <>
      <PageHeader
        title="Health"
        subtitle="Whether each part of Wheelers is working, its uptime, and how fast the API and database answer. Checked every minute, refreshed here every 30 seconds."
        actions={
          <>
            <div className="admin-range-tabs" role="group" aria-label="Period">
              {RANGES.map((r) => (
                <button key={r.key} type="button" className={`admin-range-tab${r.key === range ? " active" : ""}`} onClick={() => setRange(r.key)}>
                  {r.label}
                </button>
              ))}
            </div>
            <RefreshButton onClick={refresh} busy={loading} />
          </>
        }
      />

      {error && !data ? <ErrorState error={error} onRetry={refresh} /> : null}
      {!data && !error ? <Spinner label="Checking every part…" /> : null}

      {data ? (
        <>
          <div className={`health-banner ${data.overall}`} role="status">
            <span className={`health-dot big ${data.overall}`} aria-hidden="true" />
            <div>
              <div className="health-banner-title">{BANNER[data.overall].title}</div>
              <div className="health-banner-sub">
                {BANNER[data.overall].sub} Checked {new Date(data.generatedAt).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "Africa/Lagos" })}.
              </div>
            </div>
          </div>

          <Card title="Parts of the platform" right={`Uptime over the last ${rangeWord}`}>
            <div className="health-rows">
              {data.components.map((c) => (
                <div className="health-row" key={c.key}>
                  <div className="health-name">
                    <span className={`health-dot ${c.status}`} title={STATUS_WORDS[c.status]} />
                    <div style={{ minWidth: 0 }}>
                      <strong>{c.label} · {STATUS_WORDS[c.status]}</strong>
                      <span title={c.detail}>{c.detail}</span>
                    </div>
                  </div>
                  <div className="health-bars" aria-label={`${c.label} over the last ${rangeWord}`}>
                    {c.bars.map((bar, i) => {
                      const at = data.points[i]?.at;
                      return (
                        <span
                          key={i}
                          className={`health-bar ${bar}`}
                          title={`${at ? timeLabel(at, range) : ""} · ${bar === "none" ? "no checks" : STATUS_WORDS[bar]}`}
                        />
                      );
                    })}
                  </div>
                  <div className="health-uptime">
                    {c.uptimePct === null ? "—" : `${c.uptimePct}%`}
                    <small>{c.checks ? `${n(c.checks)} checks` : "no checks yet"}</small>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <div style={{ height: 20 }} />

          <StatGrid cols={3}>
            <StatCard label={`API requests · ${rangeWord}`} value={n(data.summary.requests)} hint={`average ${ms(data.summary.httpAvgMs)}`} />
            <StatCard
              label="API errors (5xx)"
              value={n(data.summary.errors)}
              tone={data.summary.errorRatePct >= 1 ? "red" : data.summary.errors > 0 ? "orange" : "green"}
              hint={`${data.summary.errorRatePct}% of requests`}
            />
            <StatCard label="API response time (p95)" value={ms(data.summary.httpP95)} tone={(data.summary.httpP95 ?? 0) >= 1000 ? "orange" : undefined} hint="95% of requests were faster" />
            <StatCard label={`Database queries · ${rangeWord}`} value={n(data.summary.queries)} hint={`average ${ms(data.summary.dbAvgMs)}`} />
            <StatCard label="Query time (p95)" value={ms(data.summary.dbP95)} tone={(data.summary.dbP95 ?? 0) >= 250 ? "orange" : undefined} hint="95% of queries were faster" />
            <StatCard
              label="Slow or failed queries"
              value={n(data.summary.slowQueries + data.summary.dbErrors)}
              tone={data.summary.dbErrors > 0 ? "red" : data.summary.slowQueries > 0 ? "orange" : "green"}
              hint={`${n(data.summary.slowQueries)} over 0.5 s · ${n(data.summary.dbErrors)} failed`}
            />
          </StatGrid>

          <div style={{ height: 20 }} />

          <div className="health-charts">
            <Card title="API response time (p95)" padded>
              <AreaChart data={charts.httpP95} color={CHART_COLORS.ORANGE} formatValue={(v) => ms(v)} />
            </Card>
            <Card
              title="API traffic and errors"
              right={<span className="health-legend"><span><i style={{ background: CHART_COLORS.MUTED }} />Requests</span><span><i style={{ background: "#FF3333" }} />Errors</span></span>}
              padded
            >
              <BarChart data={charts.traffic} series={[{ name: "Requests", color: CHART_COLORS.MUTED }, { name: "Errors", color: "#FF3333" }]} formatValue={n} />
            </Card>
            <Card title="Database query time (p95)" padded>
              <AreaChart data={charts.dbP95} color={CHART_COLORS.GREEN} formatValue={(v) => ms(v)} />
            </Card>
            <Card
              title="Database queries"
              right={<span className="health-legend"><span><i style={{ background: CHART_COLORS.MUTED }} />Queries</span><span><i style={{ background: "#FF3333" }} />Slow or failed</span></span>}
              padded
            >
              <BarChart data={charts.queries} series={[{ name: "Queries", color: CHART_COLORS.MUTED }, { name: "Slow or failed", color: "#FF3333" }]} formatValue={n} />
            </Card>
          </div>

          <Card title="Spikes" right="Stretches at least 3× the usual for this period">
            {data.spikes.length === 0 ? (
              <EmptyState>No spikes in the last {rangeWord}.</EmptyState>
            ) : (
              <TableWrap>
                <table className="admin-table">
                  <thead><tr><th>What</th><th>When</th><th>Peak</th><th>Usual</th></tr></thead>
                  <tbody>
                    {data.spikes.map((s, i) => (
                      <tr key={`${s.metric}-${s.from}-${i}`}>
                        <td><strong>{s.label}</strong></td>
                        <td>{when(s.from)} · {duration(s.to - s.from)}</td>
                        <td style={{ color: "#FF3333", fontWeight: 700 }}>{s.unit === "ms" ? ms(s.peak) : n(s.peak)}</td>
                        <td>{s.unit === "ms" ? ms(s.usual) : n(s.usual)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </Card>

          <div style={{ height: 20 }} />

          <Card title="Incidents" right="When a part was slow or down">
            {data.incidents.length === 0 ? (
              <EmptyState>No incidents in the last {rangeWord}.</EmptyState>
            ) : (
              <TableWrap>
                <table className="admin-table">
                  <thead><tr><th>Part</th><th>Status</th><th>Started</th><th>Lasted</th></tr></thead>
                  <tbody>
                    {data.incidents.map((incident) => (
                      <tr key={`${incident.key}-${incident.from}`}>
                        <td><strong>{incident.label}</strong></td>
                        <td><span className={`admin-badge ${incident.status === "down" ? "red" : "orange"}`}>{STATUS_WORDS[incident.status]}</span></td>
                        <td>{when(incident.from)}</td>
                        <td>{incident.ongoing ? `${duration(incident.to - incident.from)} · still going` : duration(incident.to - incident.from)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </Card>

          <div style={{ height: 20 }} />

          <Card title="Where the database spends its time" right={`Last ${rangeWord}, most total time first`}>
            {data.queries.length === 0 ? (
              <EmptyState>No queries counted yet.</EmptyState>
            ) : (
              <TableWrap>
                <table className="admin-table">
                  <thead><tr><th>Query</th><th>Calls</th><th>Average</th><th>Over 0.5 s</th><th>Failed</th><th>Total time</th></tr></thead>
                  <tbody>
                    {data.queries.map((q) => (
                      <tr key={q.name}>
                        <td><code>{q.name}</code></td>
                        <td>{n(q.count)}</td>
                        <td style={q.avgMs >= 250 ? { color: "#FF5C00", fontWeight: 700 } : undefined}>{ms(q.avgMs)}</td>
                        <td>{q.slow ? n(q.slow) : "—"}</td>
                        <td style={q.errors ? { color: "#FF3333", fontWeight: 700 } : undefined}>{q.errors ? n(q.errors) : "—"}</td>
                        <td>{duration(q.sumMs) === "0 min" ? `${(q.sumMs / 1000).toFixed(1)} s` : duration(q.sumMs)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </Card>

          <div style={{ height: 20 }} />

          <div className="health-charts">
            <Card title="API servers" right="Each process, as it reported in">
              {data.instances.length === 0 ? (
                <EmptyState>No server has reported in the last 3 minutes.</EmptyState>
              ) : (
                <TableWrap>
                  <table className="admin-table">
                    <thead><tr><th>Server</th><th>Up for</th><th>Memory</th><th>Delay (p99)</th><th>Connections</th></tr></thead>
                    <tbody>
                      {data.instances.map((i) => (
                        <tr key={i.instanceId}>
                          <td><code>{i.instanceId.slice(0, 8)}</code> · pid {i.pid}</td>
                          <td>{duration(i.uptimeMs)}</td>
                          <td>{n(i.rssMb)} MB</td>
                          <td style={i.loopP99Ms >= 200 ? { color: "#FF5C00", fontWeight: 700 } : undefined}>{ms(i.loopP99Ms)}</td>
                          <td>{n(i.sockets)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableWrap>
              )}
            </Card>
            <Card title="Outside services today" right="Calls made by the backend">
              {data.services.length === 0 ? (
                <EmptyState>No outside calls yet today.</EmptyState>
              ) : (
                <TableWrap>
                  <table className="admin-table">
                    <thead><tr><th>Service</th><th>Calls</th><th>Failed</th><th>Average</th></tr></thead>
                    <tbody>
                      {data.services.map((s) => {
                        const failedPct = s.calls ? Math.round((s.failed / s.calls) * 1000) / 10 : 0;
                        return (
                          <tr key={s.key}>
                            <td><strong>{s.label}</strong></td>
                            <td>{n(s.calls)}</td>
                            <td style={failedPct >= 5 ? { color: "#FF3333", fontWeight: 700 } : undefined}>{s.failed ? `${n(s.failed)} (${failedPct}%)` : "—"}</td>
                            <td>{ms(s.avgMs)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </TableWrap>
              )}
            </Card>
          </div>
        </>
      ) : null}
    </>
  );
}
