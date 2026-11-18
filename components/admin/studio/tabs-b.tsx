"use client";

/** Studio tabs, second half: Money, Price anatomy, Price psychology, People & promos. */
import {
  CHANNELS, FARE_SIZES, JOINED_VIA, LATENESS_BANDS, LEDGER_TYPES, OFFER_VS_SUGGESTED_BANDS, OPENING_BANDS, OUTCOMES, PAY_METHODS,
  PICKUP_BANDS, PROMOS, RATING_BANDS, RIDE_CLASSES, ROUND_BANDS, SCREEN_BANDS, latenessBandOf, offerVsSuggestedBandOf,
  openingBandOf, pickupBandOf, ratingBandOf, roundBandOf, screenBandOf, searched, type StudioPing,
} from "@/lib/studio/schema";
import { countBy, groupBy, mean, median, naira, num, pct, searchedAndMatch, secs, share, signedPct, sum } from "@/lib/studio/stats";
import { CATEGORY_ORDER, EChart, STUDIO_COLORS, barsOption, comboOption, groupedOption, hbarsOption, stacked100Option } from "./charts";
import { Grid, Kpis, Legend, Panel } from "./parts";
import type { TabProps } from "./tab-props";

const dayLabel = (date: string) => `${date.slice(8)} ${new Date(`${date}T12:00:00Z`).toLocaleString("en-GB", { month: "short", timeZone: "UTC" })}`;
const OUTCOME_SERIES = OUTCOMES.map((name, i) => ({ name, color: CATEGORY_ORDER[i] }));
const isBid = (p: StudioPing) => p.action === "Countered" || p.action === "Took rider price";
const LADDER = [
  { name: "Rider opened at", color: STUDIO_COLORS.blue },
  { name: "Best offer seen", color: STUDIO_COLORS.orange },
  { name: "Agreed fare", color: STUDIO_COLORS.green },
];
const PER_KM = [
  { name: "Rider opens ₦/km", color: STUDIO_COLORS.blue },
  { name: "Driver asks ₦/km", color: STUDIO_COLORS.orange },
  { name: "Agreed ₦/km", color: STUDIO_COLORS.green },
];

// ── Money ─────────────────────────────────────────────────────────────────

export function Money({ data, f, fx, pick, sel }: TabProps) {
  const s = f.sessions;
  const done = s.filter((x) => x.outcome === "Completed" && x.trip);
  const attempts = f.payments;
  const days = [...new Set(fx("date").sessions.map((x) => x.date))].sort();
  const ledger = data.ledger.filter((r) => f.dateOnly(r.date));
  const gross = sum(done.map((x) => x.agreedNgn ?? 0));
  const fuel = sum(done.map((x) => x.fuelNgn));
  return (
    <>
      <Kpis items={[
        { label: "Fares + fees collected", value: naira(gross) },
        { label: "Booking fees earned", value: naira(sum(done.map((x) => x.bookingFeeNgn))) },
        { label: "Processor fees", value: naira(sum(s.map((x) => x.processorFeeNgn))) },
        { label: "Messaging cost", value: naira(sum(s.map((x) => x.messagingCostNgn))) },
        { label: "Wheelers net", value: naira(sum(s.map((x) => x.wheelersNetNgn))) },
        { label: "Payment failure rate", value: pct(share(attempts.filter((p) => !p.success).length, attempts.length)) },
      ]} />
      <Grid>
        <Panel title="Wheelers net by day" sub="Booking fees + commission − processor fees − messaging − refunds, per session day.">
          <EChart option={barsOption({ rows: days.map((d) => ({ label: d, value: sum(fx("date").sessions.filter((x) => x.date === d).map((x) => x.wheelersNetNgn)) })), name: "Wheelers net", format: naira, labelFormat: dayLabel, selected: sel("date") })} onClick={(c) => pick("date", c.name)} />
        </Panel>
        <Panel title="Fares by method actually used" sub="Successful charges, after fallbacks. Click to filter payment charts.">
          <EChart height={260} option={hbarsOption({ rows: PAY_METHODS.map((m) => { const v = sum(fx("payMethod").sessions.filter((x) => x.outcome === "Completed" && x.trip).filter((x) => x.trip!.method === m).map((x) => x.agreedNgn ?? 0)); return { label: m, value: v, text: naira(v) }; }), selected: sel("payMethod") })} onClick={(c) => pick("payMethod", c.name)} />
        </Panel>
        <Panel title="Net per completed trip by channel" sub="WhatsApp messaging costs eat most of the booking fee.">
          <EChart height={220} option={hbarsOption({ rows: CHANNELS.map((ch) => { const v = mean(fx("channel").sessions.filter((x) => x.outcome === "Completed" && x.trip).filter((x) => x.channel === ch).map((x) => x.wheelersNetNgn)); return { label: ch, value: v ?? 0, text: naira(v) }; }), selected: sel("channel") })} onClick={(c) => pick("channel", c.name)} />
        </Panel>
        <Panel title="Driver wallet movements" sub="All drivers; date filter only.">
          <EChart height={280} option={hbarsOption({ rows: LEDGER_TYPES.map((t) => { const v = sum(ledger.filter((r) => r.type === t).map((r) => r.amountNgn)); return { label: t, value: v, text: naira(v) }; }) })} />
        </Panel>
        <Panel title="Payment attempts by method" sub="Success vs failure of charge attempts.">
          <Legend items={[{ name: "Success", color: STUDIO_COLORS.blue }, { name: "Failed", color: STUDIO_COLORS.orange }]} />
          <EChart height={240} option={stacked100Option({
            rows: PAY_METHODS.map((m) => ({ label: m, parts: { Success: attempts.filter((p) => p.method === m && p.success).length, Failed: attempts.filter((p) => p.method === m && !p.success).length } })),
            series: [{ name: "Success", color: STUDIO_COLORS.blue }, { name: "Failed", color: STUDIO_COLORS.orange }],
          })} />
        </Panel>
        <Panel title="Driver economics (completed trips)" sub="Gross fares, estimated fuel, net after fuel.">
          <EChart height={200} option={hbarsOption({ rows: [
            { label: "Driver gross fares", value: gross, text: naira(gross) },
            { label: "Est. fuel cost", value: -fuel, text: naira(-fuel) },
            { label: "Driver net after fuel", value: gross - fuel, text: naira(gross - fuel) },
          ] })} />
        </Panel>
      </Grid>
    </>
  );
}

// ── Price anatomy ─────────────────────────────────────────────────────────

export function PriceAnatomy({ f, fx, pick, sel, byId }: TabProps) {
  const s = f.sessions.filter(searched);
  const o = f.offers;
  const bestOf = new Map<string, number>();
  for (const x of o) bestOf.set(x.sessionId, Math.min(bestOf.get(x.sessionId) ?? Infinity, x.priceNgn));
  const vs = (a: number, b: number) => ((a / b) - 1) * 100;
  const ladder = OPENING_BANDS.map((band) => {
    const rows = s.filter((x) => openingBandOf(x.openingNgn!, x.suggestedNgn) === band);
    return {
      open: median(rows.map((x) => (x.openingNgn! / x.suggestedNgn) * 100)),
      best: median(rows.flatMap((x) => (bestOf.has(x.id) ? [(bestOf.get(x.id)! / x.suggestedNgn) * 100] : []))),
      agreed: median(rows.flatMap((x) => (x.agreedNgn ? [(x.agreedNgn / x.suggestedNgn) * 100] : []))),
    };
  });
  const premium = (rows: typeof o) => median(rows.map((x) => x.gapToSuggestedPct));
  return (
    <>
      <Kpis items={[
        { label: "Median opening vs suggested", value: signedPct(median(s.map((x) => vs(x.openingNgn!, x.suggestedNgn)))) },
        { label: "Median best offer vs suggested", value: pct(median(s.flatMap((x) => (bestOf.has(x.id) ? [vs(bestOf.get(x.id)!, x.suggestedNgn)] : [])))) },
        { label: "Median agreed vs suggested", value: pct(median(s.flatMap((x) => (x.agreedNgn ? [vs(x.agreedNgn, x.suggestedNgn)] : [])))) },
        { label: "Floor huggers", value: pct(share(s.filter((x) => x.openingNgn! <= x.suggestedNgn * 0.72).length, s.length)), hint: "opened at or near the 70% floor" },
        { label: "Median driver ask per km", value: naira(median(o.map((x) => x.priceNgn / Math.max(1, byId.get(x.sessionId)?.km ?? 1)))) },
      ]} />
      <Grid>
        <Panel title="The price ladder, by where riders open" sub="Median % of the suggested fare at each stage. Dashed lines: the ₦ floor we allow (70%) and the suggested fare (100%).">
          <Legend items={LADDER} />
          <EChart option={groupedOption({
            categories: [...OPENING_BANDS],
            series: [
              { ...LADDER[0], values: ladder.map((l) => l.open) },
              { ...LADDER[1], values: ladder.map((l) => l.best) },
              { ...LADDER[2], values: ladder.map((l) => l.agreed) },
            ],
            yFormat: (v) => `${Math.round(v)}%`,
            refLines: [{ value: 70, label: "floor (70%)" }, { value: 100, label: "suggested" }],
          })} onClick={(c) => pick("openBand", c.name)} />
        </Panel>
        <Panel title="Where driver offers sit vs our suggested price" sub="Every offer, as a gap to the suggested fare.">
          <EChart height={300} option={hbarsOption({ rows: countBy(fx("offerVsSuggested").offers, (x) => offerVsSuggestedBandOf(x.gapToSuggestedPct), OFFER_VS_SUGGESTED_BANDS).map((r) => ({ ...r, text: num(r.value) })), selected: sel("offerVsSuggested") })} onClick={(c) => pick("offerVsSuggested", c.name, "offer")} />
        </Panel>
        <Panel title="Winning premium by driver rating" sub="Accepted offers: median gap over suggested. Click a band to cross-filter driver-side charts.">
          <EChart height={240} option={hbarsOption({ rows: groupBy(fx("ratingBand").offers.filter((x) => x.status === "Accepted"), (x) => ratingBandOf(x.driverRating), RATING_BANDS).map((g) => { const v = premium(g.rows); return { label: g.label, value: v ?? 0, text: signedPct(v) }; }), selected: sel("ratingBand") })} onClick={(c) => pick("ratingBand", c.name, "offer")} />
        </Panel>
        <Panel title="Winning premium by pickup distance" sub="Accepted offers only. Click to filter.">
          <EChart height={240} option={hbarsOption({ rows: groupBy(fx("pickupBand").offers.filter((x) => x.status === "Accepted"), (x) => pickupBandOf(x.pickupKm), PICKUP_BANDS).map((g) => { const v = premium(g.rows); return { label: g.label, value: v ?? 0, text: signedPct(v) }; }), selected: sel("pickupBand") })} onClick={(c) => pick("pickupBand", c.name, "offer")} />
        </Panel>
        <Panel title="Winning premium by vehicle class" sub="Accepted offers only. Click to filter.">
          <EChart height={200} option={hbarsOption({ rows: groupBy(fx("rideClass").offers.filter((x) => x.status === "Accepted"), (x) => byId.get(x.sessionId)?.rideClass ?? null, RIDE_CLASSES).map((g) => { const v = premium(g.rows); return { label: g.label, value: v ?? 0, text: signedPct(v) }; }), selected: sel("rideClass") })} onClick={(c) => pick("rideClass", c.name)} />
        </Panel>
        <Panel title="Bargaining per km" sub="Median ₦ per route-km: what riders open at, what drivers ask, what gets agreed. Base tariff is ₦375/km before class and traffic multipliers.">
          <Legend items={PER_KM} />
          <EChart option={groupedOption({
            categories: [...RIDE_CLASSES],
            series: [
              { ...PER_KM[0], values: RIDE_CLASSES.map((c) => median(s.filter((x) => x.rideClass === c).map((x) => x.openingNgn! / x.km))) },
              { ...PER_KM[1], values: RIDE_CLASSES.map((c) => median(o.filter((x) => byId.get(x.sessionId)?.rideClass === c).map((x) => x.priceNgn / (byId.get(x.sessionId)?.km ?? 1)))) },
              { ...PER_KM[2], values: RIDE_CLASSES.map((c) => median(s.filter((x) => x.rideClass === c && x.agreedNgn).map((x) => x.agreedNgn! / x.km))) },
            ],
            yFormat: (v) => num(v),
          })} />
        </Panel>
      </Grid>
    </>
  );
}

// ── Price psychology ──────────────────────────────────────────────────────

const RAISE_STEPS = ["Under +₦100", "Exactly +₦100", "+₦101-250", "+₦251-500", "+₦501-1,000", "More than +₦1,000"] as const;
const raiseStepOf = (d: number) => (d < 100 ? RAISE_STEPS[0] : d === 100 ? RAISE_STEPS[1] : d <= 250 ? RAISE_STEPS[2] : d <= 500 ? RAISE_STEPS[3] : d <= 1000 ? RAISE_STEPS[4] : RAISE_STEPS[5]);
const COUNTER_STEPS = ["Exactly +₦100", "+₦101-300", "+₦301-500", "+₦501-1,000", "+₦1,000 or more"] as const;
const counterStepOf = (d: number) => (d === 100 ? COUNTER_STEPS[0] : d <= 300 ? COUNTER_STEPS[1] : d <= 500 ? COUNTER_STEPS[2] : d < 1000 ? COUNTER_STEPS[3] : COUNTER_STEPS[4]);
const ODD_MOVES = ["Typed it exactly", "Rounded DOWN to ₦500", "Rounded UP to ₦500", "Rounded to ₦1,000", "Small tweak (within ₦200)", "Set their own price"] as const;
function oddMoveOf(opening: number, suggested: number): (typeof ODD_MOVES)[number] {
  if (opening === suggested) return ODD_MOVES[0];
  if (opening % 1000 === 0 && Math.abs(opening - suggested) <= 1000) return ODD_MOVES[3];
  if (opening === Math.floor(suggested / 500) * 500) return ODD_MOVES[1];
  if (opening === Math.ceil(suggested / 500) * 500) return ODD_MOVES[2];
  if (Math.abs(opening - suggested) <= 200) return ODD_MOVES[4];
  return ODD_MOVES[5];
}
const ROUND_LANDING = ["On a ₦1,000 multiple", "On a ₦500 multiple", "On a ₦100 multiple", "Odd amount"] as const;
const landingOf = (n: number) => (n % 1000 === 0 ? ROUND_LANDING[0] : n % 500 === 0 ? ROUND_LANDING[1] : n % 100 === 0 ? ROUND_LANDING[2] : ROUND_LANDING[3]);

export function PricePsychology({ f, fx, pick, sel, byId }: TabProps) {
  const s = f.sessions.filter(searched);
  const raises = f.priceChanges.filter((c) => c.direction === "Raise");
  const counters = f.offers.filter((o) => o.priceNgn > o.riderPriceNgn);
  const odd = s.filter((x) => x.suggestedNgn % 500 !== 0);
  const asShare = (rows: Array<{ label: string; value: number }>, total: number) => rows.map((r) => { const v = share(r.value, total); return { label: r.label, value: v ?? 0, text: pct(v) }; });
  return (
    <>
      <Kpis items={[
        { label: "Suggested fares that are odd numbers", value: pct(share(odd.length, s.length)), hint: "not a ₦500 multiple" },
        { label: "Riders who typed the suggested price exactly", value: pct(share(s.filter((x) => x.openingNgn === x.suggestedNgn).length, s.length)) },
        { label: "Openers on a round ₦500 number", value: pct(share(s.filter((x) => x.openingNgn! % 500 === 0).length, s.length)) },
        { label: "Median raise step", value: naira(median(raises.map((c) => c.toNgn - c.fromNgn))) },
        { label: "Counters that are exactly +₦100", value: pct(share(counters.filter((o) => o.priceNgn - o.riderPriceNgn === 100).length, counters.length)) },
      ]} />
      <Grid>
        <Panel title="Rider behaviour by fare size" sub="Searched sessions and match rate by the suggested fare's size. Click a band to filter everything.">
          <EChart option={comboOption({ rows: searchedAndMatch(fx("fareSize").sessions, (x) => x.fareSize, FARE_SIZES), barName: "Searched", lineName: "Match rate", selected: sel("fareSize") })} onClick={(c) => pick("fareSize", c.name)} />
        </Panel>
        <Panel title="Driver appetite by fare size" sub="Pings and bid rate by the ride's fare band.">
          <EChart option={comboOption({ rows: groupBy(f.pings, (p) => byId.get(p.sessionId)?.fareSize ?? null, FARE_SIZES).map((g) => ({ label: g.label, bar: g.rows.length, line: share(g.rows.filter(isBid).length, g.rows.length) })), barName: "Pings", lineName: "Bid rate" })} />
        </Panel>
        <Panel title="When the suggested price is an odd number…" sub="…what do riders type? Most suggested fares are not round ₦500 multiples; this is what riders do with them.">
          <EChart height={300} option={hbarsOption({ rows: asShare(countBy(odd, (x) => oddMoveOf(x.openingNgn!, x.suggestedNgn), ODD_MOVES), odd.length) })} />
        </Panel>
        <Panel title="How big is one raise?" sub="Every price raise, by its absolute step.">
          <EChart height={300} option={hbarsOption({ rows: countBy(raises, (c) => raiseStepOf(c.toNgn - c.fromNgn), RAISE_STEPS).map((r) => ({ ...r, text: num(r.value) })) })} />
        </Panel>
        <Panel title="Do raises land on round numbers?" sub="Where the new price ends up after a raise.">
          <EChart height={240} option={hbarsOption({ rows: asShare(countBy(raises, (c) => landingOf(c.toNgn), ROUND_LANDING), raises.length) })} />
        </Panel>
        <Panel title="How drivers counter" sub="Counter-offers by how far above the rider's price they go.">
          <EChart height={280} option={hbarsOption({ rows: countBy(counters, (o) => counterStepOf(o.priceNgn - o.riderPriceNgn), COUNTER_STEPS).map((r) => ({ ...r, text: num(r.value) })) })} />
        </Panel>
      </Grid>
    </>
  );
}

// ── People & promos ───────────────────────────────────────────────────────

export function PeoplePromos({ f, fx, pick, sel }: TabProps) {
  const all = f.sessions;
  const s = all.filter(searched);
  const promoRides = s.filter((x) => x.promo !== "No promo");
  const noPromo = s.filter((x) => x.promo === "No promo");
  const completion = (rows: typeof s) => share(rows.filter((x) => x.outcome === "Completed").length, rows.length);
  const chose = s.filter((x) => x.offersOnScreen);
  const acceptedBySession = new Map(f.offers.filter((o) => o.status === "Accepted").map((o) => [o.sessionId, o]));
  const sunk = OUTCOME_SERIES.slice(0, 4);
  return (
    <>
      <Kpis items={[
        { label: "Riders onboarded with a promo", value: pct(share(all.filter((x) => x.onboardedWithPromo).length, all.length)), hint: "of sessions (placeholder data)" },
        { label: "Rides with a promo attached", value: num(promoRides.length) },
        { label: "Completion with promo", value: pct(completion(promoRides)) },
        { label: "Completion without", value: pct(completion(noPromo)) },
        { label: "Median decision time", value: secs(median(s.flatMap((x) => (x.decisionSec === null ? [] : [x.decisionSec])))) },
      ]} />
      <Grid>
        <Panel title="By how the rider joined" sub="Searched sessions and match rate by signup channel. Click to filter.">
          <EChart option={comboOption({ rows: searchedAndMatch(fx("joinedVia").sessions, (x) => x.joinedVia, JOINED_VIA), barName: "Searched", lineName: "Match rate", selected: sel("joinedVia") })} onClick={(c) => pick("joinedVia", c.name)} />
        </Panel>
        <Panel title="Outcomes by promo on the ride" sub="Click a row to filter. Placeholder promo data.">
          <Legend items={OUTCOME_SERIES} />
          <EChart height={220} option={stacked100Option({
            rows: PROMOS.map((p) => ({ label: p, parts: Object.fromEntries(countBy(fx("promo").sessions.filter((x) => x.promo === p), (x) => x.outcome, OUTCOMES).map((c) => [c.label, c.value])) })),
            series: OUTCOME_SERIES,
          })} onClick={(c) => pick("promo", c.name)} />
        </Panel>
        <Panel title="Choice overload" sub="When more offers are on screen, do riders still pick the cheapest?">
          <EChart option={comboOption({ rows: groupBy(fx("onScreen").sessions.filter((x) => x.offersOnScreen), (x) => screenBandOf(x.offersOnScreen!), SCREEN_BANDS).map((g) => ({ label: g.label, bar: g.rows.length, line: share(g.rows.filter((x) => acceptedBySession.get(x.id)?.cheapest).length, g.rows.length) })), barName: "Accepted", lineName: "Picked the cheapest", selected: sel("onScreen") })} onClick={(c) => pick("onScreen", c.name)} />
        </Panel>
        <Panel title="Decision time vs options" sub="Median seconds to accept, by offers on screen.">
          <EChart option={barsOption({ rows: groupBy(chose, (x) => screenBandOf(x.offersOnScreen!), SCREEN_BANDS).map((g) => ({ label: g.label, value: median(g.rows.map((x) => x.decisionSec ?? 0)) ?? 0 })), name: "Median seconds", format: (v) => `${v.toFixed(0)}s` })} />
        </Panel>
        <Panel title="Sunk time: the longer they wait, the harder they fall" sub="Outcome mix by how many broadcast rounds the search ran.">
          <Legend items={sunk} />
          <EChart height={300} option={stacked100Option({
            rows: groupBy(fx("rounds").sessions.filter(searched), (x) => roundBandOf(x.rounds), ROUND_BANDS).map((g) => ({ label: g.label, parts: Object.fromEntries(countBy(g.rows, (x) => x.outcome, OUTCOMES.slice(0, 4)).map((c) => [c.label, c.value])) })),
            series: sunk,
          })} onClick={(c) => pick("rounds", c.name)} />
        </Panel>
        <Panel title="Peak-end: lateness writes the review" sub="Average rating given, by how late the driver arrived vs the quoted ETA.">
          <EChart height={240} option={hbarsOption({ rows: groupBy(fx("lateness").sessions.filter((x) => x.trip?.rating != null && x.trip.pickupDelayMin != null), (x) => latenessBandOf(x.trip!.pickupDelayMin!), LATENESS_BANDS).map((g) => { const v = mean(g.rows.map((x) => x.trip!.rating!)); return { label: g.label, value: v ?? 0, text: v === null ? "—" : `${v.toFixed(1)}★` }; }), selected: sel("lateness") })} onClick={(c) => pick("lateness", c.name)} />
        </Panel>
      </Grid>
    </>
  );
}
