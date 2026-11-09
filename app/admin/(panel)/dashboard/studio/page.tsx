"use client";

import { Suspense, useState } from "react";
import { useAdminSession } from "@/lib/admin-session";
import { describeRange, filtersQuery, useInsightParams } from "@/lib/insight-filters";
import { AreaChart, BarChart, BreakdownBars, CHART_COLORS } from "@/components/admin/charts";
import { InsightFilterBar } from "@/components/admin/insight-filter-bar";
import { useAdminData } from "@/components/admin/use-admin-data";
import { Card, EmptyState, ErrorState, FilterTabs, PageHeader, RefreshButton, Spinner, StatCard, StatGrid, TableWrap } from "@/components/admin/ui";
import { formatNaira, formatNumber } from "@/lib/admin-format";

/**
 * Studio: how riders and drivers behave, chart by chart, worked out on the server from the same rows as the
 * Excel + Power BI download (so a number here is the number in the file). Owners only.
 * Charts that need data we do not record yet are not shown (NOTES.md in the download lists them).
 */

type Rate = { searches: number; matched: number; completed: number; matchRate: number | null; completionRate: number | null };
type Studio = {
  totals: { searches: number; matched: number; completed: number; offers: number; matchRate: number | null };
  demand: {
    byDay: Array<{ date: string } & Rate>;
    outcomes: Record<string, number>;
    byHour: Array<{ hour: number } & Rate>;
    byWeekday: Array<{ weekday: string; total: number } & Record<string, number | string>>;
    funnel: Array<{ step: string; count: number }>;
    grid: Array<{ weekday: string; cells: Array<{ dayPart: string; searches: number; matchRate: number | null }> }>;
    dayParts: string[];
  };
  prices: {
    openingVsSuccess: Array<{ band: string } & Rate>;
    priceMoves: Array<{ band: string } & Rate>;
    fareSize: Array<{ band: string } & Rate>;
    finalVsSuggested: Array<{ band: string; trips: number }>;
    offerVsSuggested: Array<{ band: string; offers: number }>;
    perKm: Array<{ km: number; priceNgn: number; perKmNgn: number; matched: boolean }>;
    roundness: { prices: number; on1000: number; on500: number; other: number };
  };
  offers: {
    statusMix: Record<string, number>;
    fateByGap: Array<{ band: string; offers: number; acceptedShare: number | null }>;
    counters: { offers: number; atRiderPrice: number; above: number; below: number; medianAboveNgn: number | null };
    choiceOverload: Array<{ band: string } & Rate>;
    premiumByRating: Array<{ band: string; won: number; avgPremiumPct: number | null }>;
    premiumByDistance: Array<{ band: string; won: number; avgPremiumPct: number | null }>;
    decisionSec: { offers: number; avg: number | null; median: number | null };
  };
  supply: { byDay: Array<{ date: string; drivers: number; onlineHours: number; tripHours: number; utilisation: number | null }> };
  money: {
    byDay: Array<{ date: string; trips: number; faresNgn: number; wheelersNetNgn: number }>;
    faresByMethod: Array<{ method: string; trips: number; faresNgn: number }>;
    netByChannel: Array<{ channel: string; trips: number; netPerTripNgn: number | null }>;
    walletMovements: Array<{ type: string; entries: number; amountNgn: number }>;
    paymentsByMethod: Array<{ method: string; type: string; count: number; amountNgn: number }>;
  };
  riders: {
    byChannel: Array<{ channel: string } & Rate>;
    sunkTime: Array<{ band: string } & Rate>;
    peakEnd: Array<{ band: string; rated: number; avgRating: number | null }>;
  };
  table: Array<{
    session_id: string; created_at: string; outcome: string; channel: string; km: number | null; suggested_ngn: number | null;
    opening_ngn: number | null; final_ngn: number | null; agreed_ngn: number | null; first_offer_sec: number | null; match_sec: number | null;
  }>;
};

type Tab = "demand" | "prices" | "offers" | "supply" | "money" | "riders" | "table";
const TABS: Array<{ value: Tab; label: string }> = [
  { value: "demand", label: "Demand & matching" },
  { value: "prices", label: "Prices & bargaining" },
  { value: "offers", label: "Driver offers" },
  { value: "supply", label: "Supply" },
  { value: "money", label: "Money" },
  { value: "riders", label: "Rider behaviour" },
  { value: "table", label: "Every search" },
];
const OUTCOME: Record<string, string> = {
  completed: "Trip completed", cancelled_after_match: "Cancelled after match", cancelled_by_rider: "Rider cancelled",
  expired_no_match: "No driver in time", open: "Still open",
};
const STATUS: Record<string, string> = {
  accepted: "Accepted", rejected: "Declined by rider", expired: "Expired", closed_other_driver_chosen: "Lost to another driver",
  withdrawn_by_driver: "Withdrawn by driver", closed_session_cancelled: "Search cancelled", open: "Still open",
};
const METHOD: Record<string, string> = { wallet: "Wallet", cash: "Cash", xlm: "Stellar (XLM)", unknown: "Unknown" };
const CHANNEL: Record<string, string> = { app: "App", whatsapp: "WhatsApp", claude: "Claude", unknown: "Unknown" };
const pct = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${v.toFixed(1)}%`);
const short = (date: string) => date.slice(5);

/** A searches bar with the match rate written beside it: the shape of most Studio charts. */
function RateRows({ rows, label }: { rows: Array<Rate & Record<string, unknown>>; label: (r: Rate & Record<string, unknown>) => string }) {
  if (rows.length === 0) return <EmptyState>No searches in this period.</EmptyState>;
  return (
    <BreakdownBars
      rows={rows.map((r) => ({ label: `${label(r)} · ${pct(r.matchRate)} matched`, value: r.searches }))}
      formatValue={(n) => `${formatNumber(n)} searches`}
    />
  );
}

/** Weekday × part of the day: the match rate in each cell, darker when more searches matched. */
function MatchGrid({ grid, dayParts }: { grid: Studio["demand"]["grid"]; dayParts: string[] }) {
  return (
    <TableWrap>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Day</th>
            {dayParts.map((p) => <th key={p} className="num">{p}</th>)}
          </tr>
        </thead>
        <tbody>
          {grid.map((row) => (
            <tr key={row.weekday}>
              <td>{row.weekday}</td>
              {row.cells.map((c) => (
                <td
                  key={c.dayPart}
                  className="num"
                  title={`${formatNumber(c.searches)} searches`}
                  style={{ background: c.matchRate === null ? undefined : `rgba(255, 119, 0, ${Math.min(0.85, 0.08 + (c.matchRate / 100) * 0.77)})` }}>
                  {c.searches ? pct(c.matchRate) : "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </TableWrap>
  );
}

function StudioBody() {
  const { isOwner } = useAdminSession();
  const { filters } = useInsightParams();
  const [tab, setTab] = useState<Tab>("demand");
  const studio = useAdminData<Studio>(isOwner ? `/admin/insights/studio${filtersQuery(filters)}` : null, [isOwner]);
  const d = studio.data;

  if (!isOwner) return <EmptyState>The Studio is for owners.</EmptyState>;
  return (
    <>
      <PageHeader
        title="Studio"
        subtitle={describeRange(filters.from, filters.to)}
        actions={<div className="admin-header-actions"><RefreshButton busy={studio.loading} onClick={studio.refresh} /></div>}
      />
      <InsightFilterBar />
      {studio.error ? (
        <ErrorState error={studio.error} onRetry={studio.refresh} />
      ) : !d ? (
        <Spinner label="Working out the charts…" />
      ) : (
        <>
          <StatGrid cols={4}>
            <StatCard label="Searches" value={formatNumber(d.totals.searches)} />
            <StatCard label="Matched" value={pct(d.totals.matchRate)} hint={`${formatNumber(d.totals.matched)} searches`} />
            <StatCard label="Trips completed" value={formatNumber(d.totals.completed)} />
            <StatCard label="Driver offers" value={formatNumber(d.totals.offers)} />
          </StatGrid>
          <FilterTabs options={TABS} value={tab} onChange={setTab} />
          {tab === "demand" ? <Demand d={d} /> : null}
          {tab === "prices" ? <Prices d={d} /> : null}
          {tab === "offers" ? <Offers d={d} /> : null}
          {tab === "supply" ? <Supply d={d} /> : null}
          {tab === "money" ? <Money d={d} /> : null}
          {tab === "riders" ? <Riders d={d} /> : null}
          {tab === "table" ? <Searches d={d} /> : null}
        </>
      )}
    </>
  );
}

function Demand({ d }: { d: Studio }) {
  const outcomes = Object.entries(d.demand.outcomes).map(([k, v]) => ({ label: OUTCOME[k] ?? k, value: v })).sort((a, b) => b.value - a.value);
  return (
    <>
      <Card title="Searches and matches by day" padded>
        <BarChart
          data={d.demand.byDay.map((r) => ({ label: short(r.date), values: [r.searches, r.matched] }))}
          series={[{ name: "Searches", color: CHART_COLORS.MUTED }, { name: "Matched", color: CHART_COLORS.ORANGE }]}
        />
      </Card>
      <div className="admin-two-col">
        <Card title="How searches end" padded><BreakdownBars rows={outcomes} /></Card>
        <Card title="Request funnel" padded>
          <BreakdownBars rows={d.demand.funnel.map((f) => ({ label: f.step, value: f.count }))} color={CHART_COLORS.GREEN} />
        </Card>
      </div>
      <Card title="Searches and matches by hour (Lagos)" padded>
        <BarChart
          data={d.demand.byHour.map((r) => ({ label: `${String(r.hour).padStart(2, "0")}`, values: [r.searches, r.matched] }))}
          series={[{ name: "Searches", color: CHART_COLORS.MUTED }, { name: "Matched", color: CHART_COLORS.ORANGE }]}
        />
      </Card>
      <Card title="Match rate: weekday × part of the day" padded><MatchGrid grid={d.demand.grid} dayParts={d.demand.dayParts} /></Card>
      <Card title="Outcomes by weekday" padded>
        <BarChart
          data={d.demand.byWeekday.map((w) => ({ label: w.weekday.slice(0, 3), values: [Number(w.completed ?? 0), Number(w.cancelled_by_rider ?? 0), Number(w.expired_no_match ?? 0), Number(w.cancelled_after_match ?? 0)] }))}
          series={[
            { name: "Completed", color: CHART_COLORS.GREEN },
            { name: "Rider cancelled", color: CHART_COLORS.ORANGE },
            { name: "No driver in time", color: CHART_COLORS.MUTED },
            { name: "Cancelled after match", color: "#B04A00" },
          ]}
        />
      </Card>
    </>
  );
}

function Prices({ d }: { d: Studio }) {
  const r = d.prices.roundness;
  return (
    <>
      <div className="admin-two-col">
        <Card title="Opening price vs success (vs suggested)" padded><RateRows rows={d.prices.openingVsSuccess} label={(x) => String(x.band)} /></Card>
        <Card title="How far riders move their price" padded><RateRows rows={d.prices.priceMoves} label={(x) => String(x.band)} /></Card>
      </div>
      <div className="admin-two-col">
        <Card title="Final fare vs suggested" padded>
          <BreakdownBars rows={d.prices.finalVsSuggested.map((x) => ({ label: x.band, value: x.trips }))} formatValue={(n) => `${formatNumber(n)} trips`} />
        </Card>
        <Card title="Where driver offers sit vs suggested" padded>
          <BreakdownBars rows={d.prices.offerVsSuggested.map((x) => ({ label: x.band, value: x.offers }))} formatValue={(n) => `${formatNumber(n)} offers`} color={CHART_COLORS.GREEN} />
        </Card>
      </div>
      <div className="admin-two-col">
        <Card title="Rider behaviour by fare size" padded><RateRows rows={d.prices.fareSize} label={(x) => String(x.band)} /></Card>
        <Card title="Do prices land on round numbers?" padded>
          <BreakdownBars
            rows={[
              { label: "On a ₦1,000", value: r.on1000 },
              { label: "On a ₦500", value: r.on500 },
              { label: "Anything else", value: r.other },
            ]}
            formatValue={(n) => `${formatNumber(n)} of ${formatNumber(r.prices)}`}
          />
        </Card>
      </div>
      <Card title="Bargaining per km: the price riders settled on, per km" padded>
        <BreakdownBars
          rows={bucketPerKm(d.prices.perKm).map((x) => ({ label: `${x.label} · ${formatNaira(x.medianPerKm)}/km`, value: x.count }))}
          formatValue={(n) => `${formatNumber(n)} searches`}
        />
      </Card>
    </>
  );
}

function bucketPerKm(rows: Studio["prices"]["perKm"]) {
  const bands: Array<[string, number]> = [["Under 3 km", 3], ["3–7 km", 7], ["7–15 km", 15], ["15–30 km", 30], ["30 km and over", Infinity]];
  return bands
    .map(([label, upper], i) => {
      const lower = i === 0 ? 0 : bands[i - 1]![1];
      const inBand = rows.filter((r) => r.km >= lower && r.km < upper).map((r) => r.perKmNgn).sort((a, b) => a - b);
      return { label, count: inBand.length, medianPerKm: inBand[Math.floor(inBand.length / 2)] ?? 0 };
    })
    .filter((b) => b.count > 0);
}

function Offers({ d }: { d: Studio }) {
  const c = d.offers.counters;
  return (
    <>
      <StatGrid cols={4}>
        <StatCard label="At the rider's price" value={formatNumber(c.atRiderPrice)} />
        <StatCard label="Above it" value={formatNumber(c.above)} hint={c.medianAboveNgn !== null ? `median ${formatNaira(c.medianAboveNgn)} more` : undefined} />
        <StatCard label="Below it" value={formatNumber(c.below)} />
        <StatCard label="Rider decides in" value={d.offers.decisionSec.median !== null ? `${d.offers.decisionSec.median}s` : "—"} hint="median, accepted or declined" />
      </StatGrid>
      <div className="admin-two-col">
        <Card title="Offer status mix" padded>
          <BreakdownBars rows={Object.entries(d.offers.statusMix).map(([k, v]) => ({ label: STATUS[k] ?? k, value: v })).sort((a, b) => b.value - a.value)} />
        </Card>
        <Card title="Offer fate by gap above the rider's price" padded>
          <BreakdownBars rows={d.offers.fateByGap.map((x) => ({ label: `${x.band} · ${pct(x.acceptedShare)} accepted`, value: x.offers }))} formatValue={(n) => `${formatNumber(n)} offers`} color={CHART_COLORS.GREEN} />
        </Card>
      </div>
      <Card title="Choice overload: offers on screen vs a match" padded><RateRows rows={d.offers.choiceOverload} label={(x) => String(x.band)} /></Card>
      <div className="admin-two-col">
        <Card title="Winning premium by driver rating" padded>
          <BreakdownBars rows={d.offers.premiumByRating.map((x) => ({ label: `${x.band} · ${formatNumber(x.won)} won`, value: x.avgPremiumPct ?? 0 }))} formatValue={(n) => `${n.toFixed(1)}% over`} />
        </Card>
        <Card title="Winning premium by pickup distance" padded>
          <BreakdownBars rows={d.offers.premiumByDistance.map((x) => ({ label: `${x.band} · ${formatNumber(x.won)} won`, value: x.avgPremiumPct ?? 0 }))} formatValue={(n) => `${n.toFixed(1)}% over`} />
        </Card>
      </div>
    </>
  );
}

function Supply({ d }: { d: Studio }) {
  return (
    <>
      <Card title="Drivers online by day" padded>
        <AreaChart data={d.supply.byDay.map((x) => ({ label: short(x.date), value: x.drivers }))} />
      </Card>
      <Card title="Hours online and on trips by day" padded>
        <BarChart
          data={d.supply.byDay.map((x) => ({ label: short(x.date), values: [x.onlineHours, x.tripHours] }))}
          series={[{ name: "Online", color: CHART_COLORS.MUTED }, { name: "On trips", color: CHART_COLORS.ORANGE }]}
          formatValue={(n) => `${n.toFixed(1)} h`}
        />
      </Card>
      <Card title="Utilisation by day (share of online time on trips)" padded>
        <AreaChart data={d.supply.byDay.map((x) => ({ label: short(x.date), value: x.utilisation ?? 0 }))} color={CHART_COLORS.ORANGE} formatValue={(n) => `${n.toFixed(1)}%`} />
      </Card>
    </>
  );
}

function Money({ d }: { d: Studio }) {
  return (
    <>
      <Card title="Wheelers net by day (commission + booking fee)" padded>
        <AreaChart data={d.money.byDay.map((x) => ({ label: short(x.date), value: x.wheelersNetNgn }))} formatValue={(n) => formatNaira(n)} />
      </Card>
      <Card title="Fares of completed trips by day" padded>
        <AreaChart data={d.money.byDay.map((x) => ({ label: short(x.date), value: x.faresNgn }))} color={CHART_COLORS.ORANGE} formatValue={(n) => formatNaira(n)} />
      </Card>
      <div className="admin-two-col">
        <Card title="Fares by payment method" padded>
          <BreakdownBars rows={d.money.faresByMethod.map((x) => ({ label: `${METHOD[x.method] ?? x.method} · ${formatNumber(x.trips)} trips`, value: x.faresNgn }))} formatValue={(n) => formatNaira(n)} />
        </Card>
        <Card title="Net per completed trip by channel" padded>
          <BreakdownBars rows={d.money.netByChannel.map((x) => ({ label: `${CHANNEL[x.channel] ?? x.channel} · ${formatNumber(x.trips)} trips`, value: x.netPerTripNgn ?? 0 }))} formatValue={(n) => formatNaira(n)} color={CHART_COLORS.GREEN} />
        </Card>
      </div>
      <div className="admin-two-col">
        <Card title="Driver wallet movements" padded>
          <BreakdownBars rows={d.money.walletMovements.map((x) => ({ label: `${x.type.replace(/_/g, " ")} · ${formatNumber(x.entries)}`, value: Math.abs(x.amountNgn) }))} formatValue={(n) => formatNaira(n)} />
        </Card>
        <Card title="Payments by method" padded>
          <BreakdownBars rows={d.money.paymentsByMethod.map((x) => ({ label: `${METHOD[x.method] ?? x.method} ${x.type} · ${formatNumber(x.count)}`, value: x.amountNgn }))} formatValue={(n) => formatNaira(n)} color={CHART_COLORS.GREEN} />
        </Card>
      </div>
    </>
  );
}

function Riders({ d }: { d: Studio }) {
  return (
    <>
      <Card title="By where the rider booked" padded><RateRows rows={d.riders.byChannel} label={(x) => CHANNEL[String(x.channel)] ?? String(x.channel)} /></Card>
      <div className="admin-two-col">
        <Card title="Sunk time: waiting for a first offer vs a match" padded><RateRows rows={d.riders.sunkTime} label={(x) => String(x.band)} /></Card>
        <Card title="Peak-end: a late pickup and the rating" padded>
          <BreakdownBars rows={d.riders.peakEnd.map((x) => ({ label: `${x.band} · ${formatNumber(x.rated)} rated`, value: x.avgRating ?? 0 }))} formatValue={(n) => `${n.toFixed(1)} ★`} color={CHART_COLORS.GREEN} />
        </Card>
      </div>
    </>
  );
}

function Searches({ d }: { d: Studio }) {
  if (d.table.length === 0) return <EmptyState>No searches in this period.</EmptyState>;
  return (
    <Card title={`Every search (latest ${formatNumber(d.table.length)})`}>
      <TableWrap>
        <table className="admin-table">
          <thead>
            <tr>
              <th>When</th><th>Outcome</th><th>Channel</th><th className="num">Km</th><th className="num">Suggested</th>
              <th className="num">Opened at</th><th className="num">Final ask</th><th className="num">Agreed</th>
              <th className="num">First offer</th><th className="num">Matched in</th>
            </tr>
          </thead>
          <tbody>
            {d.table.map((r) => (
              <tr key={r.session_id}>
                <td>{r.created_at}</td>
                <td>{OUTCOME[r.outcome] ?? r.outcome}</td>
                <td>{CHANNEL[r.channel] ?? r.channel}</td>
                <td className="num">{r.km ?? "—"}</td>
                <td className="num">{r.suggested_ngn !== null ? formatNaira(r.suggested_ngn) : "—"}</td>
                <td className="num">{r.opening_ngn !== null ? formatNaira(r.opening_ngn) : "—"}</td>
                <td className="num">{r.final_ngn !== null ? formatNaira(r.final_ngn) : "—"}</td>
                <td className="num">{r.agreed_ngn !== null ? formatNaira(r.agreed_ngn) : "—"}</td>
                <td className="num">{r.first_offer_sec !== null ? `${r.first_offer_sec}s` : "—"}</td>
                <td className="num">{r.match_sec !== null ? `${r.match_sec}s` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
    </Card>
  );
}

export default function StudioPage() {
  return (
    <Suspense fallback={<Spinner label="Loading…" />}>
      <StudioBody />
    </Suspense>
  );
}
