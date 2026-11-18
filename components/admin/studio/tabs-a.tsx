"use client";

/** Studio tabs, first half: Overview, Demand & supply, Rider pricing, Offers & choice, Drivers (internal). */
import { useMemo, useState } from "react";
import {
  ABANDON_STAGES, CAR_OWNERSHIP, DAY_PARTS, DECLINE_REASONS, FREE_BANDS, GAP_BANDS, INTENT_ENDS, LAST_TRIP_ENDS, MOVE_BANDS,
  OFFER_STATUSES, OPENING_BANDS, OUTCOMES, PICKUP_BANDS, RATING_BANDS, RIDE_CLASSES, RIDER_PRICE_BANDS, RIDER_TYPES, VARIANTS,
  WEEKDAYS, freeBandOf, gapBandOf, matched, moveBandOf, openingBandOf, pickupBandOf, ratingBandOf, riderPriceBandOf, searched,
  type IntentEnd, type Outcome, type StudioPing, type StudioSession,
} from "@/lib/studio/schema";
import { countBy, groupBy, median, naira, num, pct, searchedAndMatch, secs, share, signedPct, sum } from "@/lib/studio/stats";
import { CATEGORY_ORDER, EChart, barsOption, comboOption, donutOption, hbarsOption, stacked100Option } from "./charts";
import { Grid, Kpis, Legend, MiniTable, Panel } from "./parts";
import { ExportTable } from "./export";
import type { TabProps } from "./tab-props";

const OUTCOME_SERIES = OUTCOMES.map((name, i) => ({ name, color: CATEGORY_ORDER[i] }));
const STATUS_SERIES = OFFER_STATUSES.map((name, i) => ({ name, color: CATEGORY_ORDER[i] }));
const dayLabel = (date: string) => `${date.slice(8)} ${new Date(`${date}T12:00:00Z`).toLocaleString("en-GB", { month: "short", timeZone: "UTC" })}`;
const isBid = (p: StudioPing) => p.action === "Countered" || p.action === "Took rider price";

/** Every day of the period the sessions cover, in order. */
function daysOf(sessions: StudioSession[]) {
  return [...new Set(sessions.map((s) => s.date))].sort();
}

/** One entry per intent: its attempts, and how it ended (the last attempt). */
function intentsOf(sessions: StudioSession[]) {
  const by = new Map<string, StudioSession[]>();
  for (const s of sessions) by.set(s.intentId, [...(by.get(s.intentId) ?? []), s]);
  const END: Record<Outcome, IntentEnd> = {
    Completed: "Got a ride", "Rider cancelled": "Gave up negotiating", "Cancelled after match": "Match fell through",
    "Search timed out": "Gave up after timeout", "Left before search": "Left before search",
  };
  return [...by.values()].map((attempts) => {
    const last = attempts.reduce((a, b) => (b.attempt > a.attempt ? b : a));
    const fulfilled = attempts.some((a) => a.outcome === "Completed");
    return { attempts: attempts.length, fulfilled, end: fulfilled ? ("Got a ride" as IntentEnd) : END[last.outcome] };
  });
}

// ── Overview ──────────────────────────────────────────────────────────────

export function Overview({ f, fx, pick, sel }: TabProps) {
  const s = f.sessions;
  const srch = s.filter(searched);
  const intents = useMemo(() => intentsOf(s), [s]);
  const hours = [...new Set(fx("hour").sessions.map((x) => x.hour))].sort((a, b) => a - b).map((h) => `${String(h).padStart(2, "0")}h`);
  return (
    <>
      <Kpis items={[
        { label: "Searched sessions", value: num(srch.length), hint: `${num(s.length)} opened` },
        { label: "Match rate", value: pct(share(srch.filter(matched).length, srch.length)) },
        { label: "Completion rate", value: pct(share(srch.filter((x) => x.outcome === "Completed").length, srch.length)) },
        { label: "Intent fulfilment", value: pct(share(intents.filter((i) => i.fulfilled).length, intents.length)), hint: "across retries" },
        { label: "Median time to match", value: secs(median(s.flatMap((x) => (x.matchSec === null ? [] : [x.matchSec])))) },
        { label: "Wheelers net", value: naira(sum(s.map((x) => x.wheelersNetNgn))) },
      ]} />
      <Grid>
        <Panel title="Demand and match rate by day" sub="Bars: searched requests. Line: match rate. Click a day to zoom to it.">
          <EChart option={comboOption({ rows: searchedAndMatch(fx("date").sessions, (x) => x.date, daysOf(fx("date").sessions)), barName: "Searched", lineName: "Match rate", selected: sel("date"), labelFormat: dayLabel })} onClick={(c) => pick("date", c.name)} />
        </Panel>
        <Panel title="How sessions end" sub="Click a slice to filter everything to that outcome.">
          <EChart option={donutOption({ items: countBy(fx("outcome").sessions, (x) => x.outcome, OUTCOMES).map((r, i) => ({ name: r.label, value: r.value, color: CATEGORY_ORDER[i] })), selected: sel("outcome") })} onClick={(c) => pick("outcome", c.name)} />
        </Panel>
        <Panel title="Demand and match rate by hour" sub="Lagos hours. Click a bar to filter to that hour.">
          <EChart option={comboOption({ rows: searchedAndMatch(fx("hour").sessions, (x) => `${String(x.hour).padStart(2, "0")}h`, hours), barName: "Searched", lineName: "Match rate", selected: sel("hour") })} onClick={(c) => pick("hour", c.name)} />
        </Panel>
        <Panel title="Outcome mix by weekday" sub="Share of sessions. Click a segment to filter to that outcome.">
          <Legend items={OUTCOME_SERIES} />
          <EChart height={380} option={stacked100Option({
            rows: groupBy(fx("outcome").sessions, (x) => x.weekday, WEEKDAYS).map((g) => ({ label: g.label, parts: Object.fromEntries(countBy(g.rows, (x) => x.outcome, OUTCOMES).map((c) => [c.label, c.value])) })),
            series: OUTCOME_SERIES, selected: sel("outcome"),
          })} onClick={(c) => c.seriesName && pick("outcome", c.seriesName)} />
        </Panel>
      </Grid>
    </>
  );
}

// ── Demand & supply ───────────────────────────────────────────────────────

export function DemandSupply({ f, fx, pick, sel, nr }: TabProps) {
  const s = f.sessions;
  const srch = s.filter(searched);
  const intents = useMemo(() => intentsOf(s), [s]);
  const shortPart = (p: string) => p.split(" ")[0];
  return (
    <>
      <Kpis items={[
        { label: "Ride intents", value: num(intents.length) },
        { label: "Fulfilment rate", value: pct(share(intents.filter((i) => i.fulfilled).length, intents.length)) },
        { label: "Avg attempts", value: num(intents.length ? s.length / intents.length : null, 1) },
        { label: "Median minutes to ride", value: num(median(s.flatMap((x) => (x.minutesToRide === null ? [] : [x.minutesToRide]))), 1), hint: "first open → trip start" },
        { label: "Abandoned before search", value: pct(share(s.length - srch.length, s.length)) },
        { label: "Median time to first offer", value: secs(median(s.flatMap((x) => (x.firstOfferSec === null ? [] : [x.firstOfferSec])))) },
      ]} />
      <Grid>
        <Panel title="Request funnel" sub="Opened → searched → matched → completed.">
          <EChart height={260} option={hbarsOption({ rows: [
            { label: "Opened", value: s.length, text: num(s.length) },
            { label: "Searched", value: srch.length, text: num(srch.length) },
            { label: "Matched", value: srch.filter(matched).length, text: num(srch.filter(matched).length) },
            { label: "Completed", value: srch.filter((x) => x.outcome === "Completed").length, text: num(srch.filter((x) => x.outcome === "Completed").length) },
          ] })} />
        </Panel>
        <Panel title="Free drivers nearby decide matching" sub="Free drivers near the pickup when the search started. Click a band to filter.">
          <EChart option={comboOption({ rows: searchedAndMatch(fx("freeBand").sessions, (x) => freeBandOf(x.freeDrivers), FREE_BANDS), barName: "Searched", lineName: "Match rate", selected: sel("freeBand") })} onClick={(c) => pick("freeBand", c.name)} />
        </Panel>
        <Panel title="How ride intents end" sub="An intent = one need to travel, across retries.">
          <EChart option={donutOption({ items: countBy(intents, (i) => i.end, INTENT_ENDS).map((r, i) => ({ name: r.label, value: r.value, color: CATEGORY_ORDER[i] })) })} />
        </Panel>
        <Panel title="Match rate: weekday × day part" sub="Darker = higher match rate. Hover for numbers.">
          <ExportTable columns={["", ...DAY_PARTS]} rows={WEEKDAYS.map((d) => [d, ...DAY_PARTS.map((p) => {
            const cell = srch.filter((x) => x.weekday === d && x.dayPart === p);
            const rate = share(cell.filter(matched).length, cell.length);
            return rate === null ? null : Math.round(rate);
          })])} />
          <table className="studio-table studio-heat">
            <thead><tr><th />{DAY_PARTS.map((p) => <th key={p}>{shortPart(p)}</th>)}</tr></thead>
            <tbody>
              {WEEKDAYS.map((d) => (
                <tr key={d}>
                  <td className="studio-heat-day">{d}</td>
                  {DAY_PARTS.map((p) => {
                    const cell = srch.filter((x) => x.weekday === d && x.dayPart === p);
                    const rate = share(cell.filter(matched).length, cell.length);
                    return (
                      <td key={p} title={`${num(cell.length)} searched · ${pct(rate)} matched`} style={{ background: rate === null ? undefined : `rgba(61,125,216,${(rate / 100) * 0.55})` }}>
                        {rate === null ? "—" : `${Math.round(rate)}%`}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
        <Panel title="Retries pay off" sub="Intents by number of attempts, and how many got a ride.">
          <EChart option={comboOption({
            rows: groupBy(intents, (i) => `${Math.min(i.attempts, 3)} attempt${Math.min(i.attempts, 3) === 1 ? "" : "s"}`, ["1 attempt", "2 attempts", "3 attempts"]).map((g) => ({ label: g.label, bar: g.rows.length, line: share(g.rows.filter((i) => i.fulfilled).length, g.rows.length) })),
            barName: "Intents", lineName: "Got a ride",
          })} />
        </Panel>
        <Panel title="Where riders drop off before searching" sub="Abandoned sessions by stage." missing={nr("abandonStage") && "the steps before a search (destination set, fare shown, pickup set)."}>
          <EChart height={220} option={hbarsOption({ rows: countBy(s, (x) => x.abandonStage, ABANDON_STAGES).map((r) => ({ ...r, text: num(r.value) })) })} />
        </Panel>
      </Grid>
    </>
  );
}

// ── Rider pricing ─────────────────────────────────────────────────────────

export function RiderPricing({ f, fx, pick, sel, nr }: TabProps) {
  const s = f.sessions;
  const srch = s.filter(searched);
  const raisedIds = new Set(f.priceChanges.filter((c) => c.direction === "Raise").map((c) => c.sessionId));
  const raised = srch.filter((x) => raisedIds.has(x.id));
  return (
    <>
      <Kpis items={[
        { label: "Riders who raised", value: pct(share(raised.length, srch.length)) },
        { label: "Median raise when raised", value: pct(median(raised.map((x) => ((x.finalNgn! / x.openingNgn!) - 1) * 100))) },
        { label: "Price raises", value: num(f.priceChanges.filter((c) => c.direction === "Raise").length) },
        { label: "Price drops", value: num(f.priceChanges.filter((c) => c.direction === "Drop").length) },
        { label: "Median opening vs suggested", value: signedPct(median(srch.map((x) => ((x.openingNgn! / x.suggestedNgn) - 1) * 100))) },
      ]} />
      <Grid>
        <Panel title="Opening price vs success" sub="Where the rider opened vs the suggested fare. Click a band to filter.">
          <EChart option={comboOption({ rows: searchedAndMatch(fx("openBand").sessions, (x) => (x.openingNgn === null ? null : openingBandOf(x.openingNgn, x.suggestedNgn)), OPENING_BANDS), barName: "Searched", lineName: "Match rate", rotate: 30, selected: sel("openBand") })} onClick={(c) => pick("openBand", c.name)} />
        </Panel>
        <Panel title="How far riders move their price" sub="Final vs opening price. Click a band to filter.">
          <EChart option={comboOption({ rows: searchedAndMatch(fx("moveBand").sessions, (x) => (x.openingNgn === null || x.finalNgn === null ? null : moveBandOf(x.openingNgn, x.finalNgn)), MOVE_BANDS), barName: "Searched", lineName: "Match rate", rotate: 30, selected: sel("moveBand") })} onClick={(c) => pick("moveBand", c.name)} />
        </Panel>
        <Panel title="Why riders changed their price" sub="Every price change, by what the rider had just seen.">
          <MiniTable
            head={["Trigger", "Changes", "Median step"]}
            rows={["No offers came in", "Offers above their price", "Matched lowest counter", "Got takers, tried lower"].map((t) => {
              const rows = f.priceChanges.filter((c) => c.trigger === t);
              return [t, num(rows.length), signedPct(median(rows.map((c) => ((c.toNgn / c.fromNgn) - 1) * 100)))];
            })}
          />
        </Panel>
        <Panel title="Who raises, by rider type" sub="Bars: searched sessions. Line: share that raised." missing={nr("riderType") && "rider type (Student, Young professional, Business, Occasional) is not asked yet."}>
          <EChart option={comboOption({ rows: groupBy(fx("riderType").sessions.filter(searched), (x) => x.riderType, RIDER_TYPES).map((g) => ({ label: g.label, bar: g.rows.length, line: share(g.rows.filter((x) => raisedIds.has(x.id)).length, g.rows.length) })), barName: "Searched", lineName: "Raised", selected: sel("riderType") })} onClick={(c) => pick("riderType", c.name)} />
        </Panel>
        <Panel title="Final fare vs suggested, by class" sub="Completed trips; median gap between agreed fare and suggested.">
          <EChart option={comboOption({ rows: groupBy(fx("rideClass").sessions.filter((x) => x.outcome === "Completed"), (x) => x.rideClass, RIDE_CLASSES).map((g) => ({ label: g.label, bar: g.rows.length, line: median(g.rows.map((x) => ((x.agreedNgn! / x.suggestedNgn) - 1) * 100)) })), barName: "Completed trips", lineName: "Agreed vs suggested", lineFormat: "signedPct", selected: sel("rideClass") })} onClick={(c) => pick("rideClass", c.name)} />
        </Panel>
        <Panel title="Experiment: 40s vs 60s offer timeout" sub="Match rate and expired offers per searched session, by variant." missing={nr("variant") && "no offer-timeout experiment is running."}>
          <EChart option={comboOption({ rows: searchedAndMatch(fx("variant").sessions, (x) => x.variant, VARIANTS), barName: "Searched", lineName: "Match rate", selected: sel("variant") })} onClick={(c) => pick("variant", c.name)} />
          <p className="studio-note">
            Expired offers per searched session: {VARIANTS.map((v) => {
              const vs = srch.filter((x) => x.variant === v);
              const ids = new Set(vs.map((x) => x.id));
              return `${v} ${num(vs.length ? f.offers.filter((o) => ids.has(o.sessionId) && o.status === "Expired").length / vs.length : null, 2)}`;
            }).join(" · ")}
          </p>
        </Panel>
      </Grid>
    </>
  );
}

// ── Offers & choice ───────────────────────────────────────────────────────

export function OffersChoice({ f, fx, pick, sel, byId, nr }: TabProps) {
  const o = f.offers;
  const acted = o.filter((x) => x.status === "Accepted" || x.status === "Rejected");
  const accepted = o.filter((x) => x.status === "Accepted");
  const choice = accepted.filter((x) => (byId.get(x.sessionId)?.offersOnScreen ?? 0) >= 2);
  const searchedCount = f.sessions.filter(searched).length;
  return (
    <>
      <Kpis items={[
        { label: "Offers", value: num(o.length) },
        { label: "Acceptance rate", value: pct(share(accepted.length, acted.length)), hint: "of offers riders acted on" },
        { label: "Cheapest offer won", value: pct(share(choice.filter((x) => x.cheapest).length, choice.length)), hint: "when 2+ offers on screen" },
        { label: "Median premium when not cheapest", value: naira(median(accepted.filter((x) => x.cheapest === false).map((x) => x.premiumNgn ?? 0))) },
        { label: "Median driver response", value: secs(median(o.map((x) => x.latencySec))) },
      ]} />
      <Grid>
        <Panel title="Offer fate by gap above rider price" sub="What riders did with each offer. Click a band to filter offer charts.">
          <Legend items={STATUS_SERIES.slice(0, 4)} />
          <EChart height={360} option={stacked100Option({
            rows: groupBy(fx("gapBand").offers, (x) => gapBandOf(x.gapToRiderPct), GAP_BANDS).map((g) => ({ label: g.label, parts: Object.fromEntries(countBy(g.rows, (x) => x.status, OFFER_STATUSES).map((c) => [c.label, c.value])) })),
            series: STATUS_SERIES,
          })} onClick={(c) => pick("gapBand", c.name, "offer")} />
        </Panel>
        <Panel title="Rider price moves drivers" sub="Bars: drivers pinged. Line: share who bid. Click a band to filter driver charts.">
          <EChart option={comboOption({ rows: groupBy(fx("riderPriceBand").pings, (p) => riderPriceBandOf(p.riderVsSuggestedPct), RIDER_PRICE_BANDS).map((g) => ({ label: g.label, bar: g.rows.length, line: share(g.rows.filter(isBid).length, g.rows.length) })), barName: "Pinged", lineName: "Bid", rotate: 30, selected: sel("riderPriceBand") })} onClick={(c) => pick("riderPriceBand", c.name, "ping")} />
        </Panel>
        <Panel title="Accepted offers by list position" sub="Position on the rider screen at the moment of choice.">
          <EChart option={barsOption({ rows: countBy(fx("listPos").offers.filter((x) => x.status === "Accepted"), (x) => (x.listPos ? `Position ${Math.min(x.listPos, 6)}` : null), [1, 2, 3, 4, 5, 6].map((i) => `Position ${i}`)), name: "Accepted", selected: sel("listPos") })} onClick={(c) => pick("listPos", c.name, "offer")} />
        </Panel>
        <Panel title="Offers by broadcast round" sub="Bars: offers. Line: acceptance rate of offers riders acted on.">
          <EChart option={comboOption({ rows: groupBy(fx("round").offers, (x) => `R${Math.min(x.round, 5)}`, ["R1", "R2", "R3", "R4", "R5"]).map((g) => ({ label: g.label, bar: g.rows.length, line: share(g.rows.filter((x) => x.status === "Accepted").length, g.rows.filter((x) => x.status === "Accepted" || x.status === "Rejected").length) ?? 0 })), barName: "Offers", lineName: "Acceptance rate", selected: sel("round") })} onClick={(c) => pick("round", c.name, "offer")} />
        </Panel>
        <Panel title="Offer status mix" sub="Click a slice to filter offer charts.">
          <EChart option={donutOption({ items: countBy(fx("status").offers, (x) => x.status, OFFER_STATUSES).map((r, i) => ({ name: r.label, value: r.value, color: CATEGORY_ORDER[i] })), selected: sel("status") })} onClick={(c) => pick("status", c.name, "offer")} />
        </Panel>
        <Panel title="Speed and attention" sub="Driver response latency and rider profile views on offers.">
          <EChart height={200} option={hbarsOption({ rows: [
            { label: "Median driver response latency (s)", value: median(o.map((x) => x.latencySec)) ?? 0, text: num(median(o.map((x) => x.latencySec)), 1) },
            { label: "Offers whose profile was viewed (%)", value: nr("profileViewed") ? 0 : share(o.filter((x) => x.profileViewed).length, o.length) ?? 0, text: nr("profileViewed") ? "not recorded" : num(share(o.filter((x) => x.profileViewed).length, o.length), 1) },
            { label: "Offers per searched session", value: searchedCount ? o.length / searchedCount : 0, text: num(searchedCount ? o.length / searchedCount : null, 1) },
          ] })} />
        </Panel>
      </Grid>
    </>
  );
}

// ── Drivers (internal) ────────────────────────────────────────────────────

const FACTORS = {
  "Car ownership": { key: "ownership", bands: CAR_OWNERSHIP as readonly string[], of: (p: StudioPing) => p.ownership as string },
  "Driver rating": { key: "pingRating", bands: RATING_BANDS as readonly string[], of: (p: StudioPing) => ratingBandOf(p.driverRating) as string },
  "Pickup distance": { key: "pingPickup", bands: PICKUP_BANDS as readonly string[], of: (p: StudioPing) => pickupBandOf(p.pickupKm) as string },
} as const;
type Factor = keyof typeof FACTORS;

export function Drivers({ data, f, fx, pick, sel, nr }: TabProps) {
  const [factor, setFactor] = useState<Factor>("Car ownership");
  const by = FACTORS[factor];
  const p = f.pings;
  const delivered = p.filter((x) => x.delivered);
  const seen = p.filter((x) => x.seen);
  const bids = p.filter(isBid);
  const shifts = data.shifts.filter((d) => f.dateOnly(d.date));
  return (
    <>
      <Kpis items={[
        { label: "Drivers pinged", value: num(p.length) },
        { label: "Seen rate", value: nr("pingSeen") ? "—" : pct(share(seen.length, p.length)), ...(nr("pingSeen") ? { hint: "not recorded yet" } : {}) },
        { label: "Bid rate", value: pct(share(bids.length, p.length)) },
        { label: "Decline rate", value: pct(share(p.filter((x) => x.action === "Declined").length, nr("pingSeen") ? p.length : seen.length)) },
        { label: "Bid win rate", value: pct(share(f.offers.filter((o) => o.status === "Accepted").length, f.offers.length)) },
      ]} />
      <Grid>
        <Panel
          title={<>Driver behaviour by <select className="studio-inline-select" value={factor} onChange={(e) => setFactor(e.target.value as Factor)}>{Object.keys(FACTORS).map((k) => <option key={k}>{k}</option>)}</select></>}
          name="Driver behaviour"
          sub="Share of pinged drivers who bid, for each group. Click a bar to filter everything driver-side."
          missing={factor === "Car ownership" && nr("carOwnership") && "drivers are not asked whether they own, hire-purchase or rent the car."}
        >
          <EChart height={260} option={hbarsOption({ rows: groupBy(fx(by.key).pings, by.of, by.bands).map((g) => { const v = share(g.rows.filter(isBid).length, g.rows.length); return { label: g.label, value: v ?? 0, text: pct(v) }; }), selected: sel(by.key) })} onClick={(c) => pick(by.key, c.name, "ping")} />
        </Panel>
        <Panel title="How high they bid, same factor" sub="Median offer vs the suggested fare, by the factor picked on the left." missing={factor === "Car ownership" && nr("carOwnership") && "car ownership is not recorded."}>
          <EChart height={260} option={hbarsOption({ rows: groupBy(bids, by.of, by.bands).map((g) => { const v = median(g.rows.map((x) => x.bidVsSuggestedPct ?? 0)); return { label: g.label, value: v ?? 0, text: signedPct(v) }; }) })} />
        </Panel>
        <Panel title="Why drivers decline" sub="Explicit declines only; silent ignores carry no reason." missing={nr("declineReason") && "drivers decline without picking a reason."}>
          <EChart height={300} option={hbarsOption({ rows: countBy(fx("declineReason").pings, (x) => x.declineReason, DECLINE_REASONS).map((r) => ({ ...r, text: num(r.value) })), selected: sel("declineReason") })} onClick={(c) => pick("declineReason", c.name, "ping")} />
        </Panel>
        <Panel title="Ping funnel" sub="Sent → delivered → seen → bid.">
          <EChart height={260} option={hbarsOption({ rows: [
            { label: "Pings sent", value: p.length, text: num(p.length) },
            ...(nr("pingDelivered") ? [] : [{ label: "Delivered", value: delivered.length, text: num(delivered.length) }]),
            ...(nr("pingSeen") ? [] : [{ label: "Seen", value: seen.length, text: num(seen.length) }]),
            { label: "Bid", value: bids.length, text: num(bids.length) },
          ] })} />
        </Panel>
        <Panel title="Supply and utilisation by day" sub="Bars: online hours. Line: share of online time on trips. Date filter only.">
          <EChart option={comboOption({ rows: shifts.map((d) => ({ label: d.date, bar: d.onlineHours, line: share(d.tripHours, d.onlineHours) })), barName: "Online hours", lineName: "On trips", labelFormat: dayLabel })} />
        </Panel>
        <Panel title="Last trip changes the next bid" sub="Bid rate by how the driver's previous trip ended." missing={nr("lastTripEnd") && "how each pinged driver's previous trip ended is not worked out yet."}>
          <EChart height={260} option={hbarsOption({ rows: groupBy(fx("lastTripEnd").pings, (x) => x.lastTripEnd, LAST_TRIP_ENDS).map((g) => { const v = share(g.rows.filter(isBid).length, g.rows.length); return { label: g.label, value: v ?? 0, text: pct(v) }; }), selected: sel("lastTripEnd") })} onClick={(c) => pick("lastTripEnd", c.name, "ping")} />
        </Panel>
      </Grid>
    </>
  );
}

