"use client";

/**
 * Studio tab: Devices (Timi, 20 Nov 2026). The phone each request came from (the rider's) and each offer (the
 * driver's): who books on what, how requests end and how fast by phone, the signal on the ride page, WhatsApp forms
 * that do not open, drivers' phones against how they answer, app versions in use, and the top phones. Every bar
 * cross-filters the page like the other tabs. Requests from before devices were recorded carry the newest device of
 * that kind the rider had then (the chips say how many are estimates). For understanding only: never priced by device.
 */
import {
  MOBILE_NETWORKS, OUTCOMES, PHONE_TIERS, PLATFORMS, SIGNALS, matched, searched, type StudioPing, type StudioSession,
} from "@/lib/studio/schema";
import { groupBy, median, naira, num, pct, share, signedPct } from "@/lib/studio/stats";
import { CATEGORY_ORDER, EChart, STUDIO_COLORS, barsOption, comboOption, donutOption, groupedOption, hbarsOption, stacked100Option } from "./charts";
import { Grid, Kpis, Legend, MiniTable, Panel } from "./parts";
import type { TabProps } from "./tab-props";

const OUTCOME_SERIES = OUTCOMES.map((name, i) => ({ name, color: CATEGORY_ORDER[i] }));
const answered = (p: StudioPing) => p.action !== "No answer" && p.action !== "Never opened" && p.action !== "Opened, ignored";
const completedRate = (rows: StudioSession[]) => share(rows.filter((x) => x.outcome === "Completed").length, rows.length);
/** Gave up before any offer came in. */
const gaveUpEarly = (x: StudioSession) => x.outcome === "Rider cancelled" && x.offersReceived === 0;
/** Version strings in order ("1.10.0" after "1.9.3"). */
const byVersion = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

export function Devices({ data, f, fx, pick, sel }: TabProps) {
  const s = f.sessions;
  const sr = s.filter(searched);
  const known = s.filter((x) => x.platform !== "Unknown");
  const estimated = s.filter((x) => x.deviceId && !x.deviceRecorded).length;
  const pageRows = s.filter((x) => x.signal !== "Unknown");
  const waRows = s.filter((x) => x.formsOpen !== null);
  const driverVersions = [...new Set(f.devices.filter((d) => d.owner === "Driver" && d.appVersion).map((d) => d.appVersion!))].sort(byVersion);
  const latestDriverVersion = driverVersions.at(-1) ?? null;
  const drivers = f.devices.filter((d) => d.owner === "Driver");

  // Top phones: the 20 models with the most requests.
  const models = groupBy(s.filter((x) => x.phoneModel), (x) => x.phoneModel, [...new Set(s.flatMap((x) => (x.phoneModel ? [x.phoneModel] : [])))])
    .sort((a, b) => b.rows.length - a.rows.length)
    .slice(0, 20);

  const versions = [...new Set(f.devices.flatMap((d) => (d.appVersion ? [d.appVersion] : [])))].sort(byVersion);

  return (
    <>
      <Kpis items={[
        { label: "Requests with a known phone", value: pct(share(known.length, s.length)), ...(estimated ? { hint: `${num(estimated)} estimated (before devices were recorded)` } : {}) },
        { label: "On Android", value: pct(share(s.filter((x) => x.platform === "Android").length, known.length)) },
        { label: "On a low-end phone", value: pct(share(s.filter((x) => x.phoneTier === "Low-end").length, s.filter((x) => x.phoneTier !== "Unknown").length)) },
        { label: "Ride page on 2G or 3G", value: pct(share(pageRows.filter((x) => x.signal === "2G" || x.signal === "3G").length, pageRows.length)) },
        { label: "WhatsApp forms don't open", value: pct(share(waRows.filter((x) => x.formsOpen === false).length, waRows.length)) },
        { label: "Drivers on the newest app", value: latestDriverVersion ? pct(share(drivers.filter((d) => d.appVersion === latestDriverVersion).length, drivers.filter((d) => d.appVersion).length)) : "—", ...(latestDriverVersion ? { hint: `v${latestDriverVersion}` } : {}) },
      ]} />
      <Grid>
        <Panel title="Requests by phone" sub="Bars: searched requests. Line: match rate. Click to filter the page.">
          <EChart option={comboOption({ rows: groupBy(fx("platform").sessions.filter(searched), (x) => x.platform, PLATFORMS).map((g) => ({ label: g.label, bar: g.rows.length, line: share(g.rows.filter(matched).length, g.rows.length) })), barName: "Searched", lineName: "Match rate", selected: sel("platform") })} onClick={(c) => pick("platform", c.name)} />
        </Panel>
        <Panel title="Requests by phone tier" sub="Android by memory (3 GB or less low-end, 4–6 mid-range, 8+ high-end), iPhones by model. Line: completion rate.">
          <EChart option={comboOption({ rows: groupBy(fx("phoneTier").sessions.filter(searched), (x) => x.phoneTier, PHONE_TIERS).map((g) => ({ label: g.label, bar: g.rows.length, line: completedRate(g.rows) })), barName: "Searched", lineName: "Completed", selected: sel("phoneTier") })} onClick={(c) => pick("phoneTier", c.name)} />
        </Panel>
        <Panel title="How requests end, by phone tier" sub="Share of each outcome per tier.">
          <Legend items={OUTCOME_SERIES} />
          <EChart height={240} option={stacked100Option({
            rows: PHONE_TIERS.map((t) => ({ label: t, parts: Object.fromEntries(OUTCOMES.map((o) => [o, s.filter((x) => x.phoneTier === t && x.outcome === o).length])) })),
            series: OUTCOME_SERIES,
          })} />
        </Panel>
        <Panel title="Signal on the ride page" sub="The browser's own reading (the app does not say). Line: completion rate.">
          <EChart option={comboOption({ rows: groupBy(fx("signal").sessions.filter(searched), (x) => x.signal, SIGNALS).map((g) => ({ label: g.label, bar: g.rows.length, line: completedRate(g.rows) })), barName: "Searched", lineName: "Completed", selected: sel("signal") })} onClick={(c) => pick("signal", c.name)} />
        </Panel>
        <Panel title="Gave up before any offer" sub="Searched requests the rider cancelled with no offer yet, by phone tier and signal.">
          <EChart height={260} option={hbarsOption({ rows: [
            ...PHONE_TIERS.map((t) => { const rows = sr.filter((x) => x.phoneTier === t); const v = share(rows.filter(gaveUpEarly).length, rows.length); return { label: t, value: v ?? 0, text: rows.length ? pct(v) : "—" }; }),
            ...SIGNALS.filter((g) => g !== "Unknown").map((g) => { const rows = sr.filter((x) => x.signal === g); const v = share(rows.filter(gaveUpEarly).length, rows.length); return { label: `Signal ${g}`, value: v ?? 0, text: rows.length ? pct(v) : "—" }; }),
          ] })} />
        </Panel>
        <Panel title="Waiting and deciding, by phone tier" sub="Median seconds to the first offer, and from the first offer to the accept.">
          <Legend items={[{ name: "First offer", color: STUDIO_COLORS.blue }, { name: "Decision", color: STUDIO_COLORS.orange }]} />
          <EChart option={groupedOption({
            categories: [...PHONE_TIERS],
            series: [
              { name: "First offer", color: STUDIO_COLORS.blue, values: PHONE_TIERS.map((t) => median(sr.filter((x) => x.phoneTier === t && x.firstOfferSec !== null).map((x) => x.firstOfferSec!))) },
              { name: "Decision", color: STUDIO_COLORS.orange, values: PHONE_TIERS.map((t) => median(sr.filter((x) => x.phoneTier === t && x.decisionSec !== null).map((x) => x.decisionSec!))) },
            ],
            yFormat: (v) => `${Math.round(v)}s`,
          })} />
        </Panel>
        <Panel title="Mobile network" sub="From the WhatsApp number (approximate: numbers move). Click to filter.">
          <EChart height={240} option={donutOption({ items: MOBILE_NETWORKS.map((n) => ({ name: n, value: fx("mobileNetwork").sessions.filter((x) => x.mobileNetwork === n).length })).filter((i) => i.value > 0), selected: sel("mobileNetwork") })} onClick={(c) => pick("mobileNetwork", c.name)} />
        </Panel>
        <Panel title="WhatsApp forms, by phone" sub="Riders whose WhatsApp shows our forms, against those sent the browser link instead.">
          <Legend items={[{ name: "Forms open", color: STUDIO_COLORS.green }, { name: "Forms don't open", color: STUDIO_COLORS.orange }]} />
          <EChart height={220} option={stacked100Option({
            rows: PLATFORMS.filter((p) => p !== "Unknown").map((p) => ({ label: p, parts: { "Forms open": waRows.filter((x) => x.platform === p && x.formsOpen).length, "Forms don't open": waRows.filter((x) => x.platform === p && x.formsOpen === false).length } })),
            series: [{ name: "Forms open", color: STUDIO_COLORS.green }, { name: "Forms don't open", color: STUDIO_COLORS.orange }],
          })} />
        </Panel>
        <Panel title="Rider prices by phone tier" sub="Median opening price against the suggested fare. For understanding only: prices never depend on the phone.">
          <EChart height={220} option={hbarsOption({ rows: PHONE_TIERS.map((t) => { const v = median(sr.filter((x) => x.phoneTier === t && x.openingNgn !== null).map((x) => ((x.openingNgn! / x.suggestedNgn) - 1) * 100)); return { label: t, value: v ?? 0, text: signedPct(v) }; }) })} />
        </Panel>
        <Panel title="Drivers' phones: how often they answer" sub="Requests sent to drivers, by the driver's phone tier. Line: answered (a bid or a decline). Click to narrow the driver charts.">
          <EChart option={comboOption({ rows: groupBy(fx("pingPhoneTier").pings, (p) => p.driverPhoneTier, PHONE_TIERS).map((g) => ({ label: g.label, bar: g.rows.length, line: share(g.rows.filter(answered).length, g.rows.length) })), barName: "Requests sent", lineName: "Answered", selected: sel("pingPhoneTier") })} onClick={(c) => pick("pingPhoneTier", c.name, "ping")} />
        </Panel>
        <Panel title="Drivers' phones: how fast they bid" sub="Median seconds from the round's start to the bid, by the driver's phone tier and platform.">
          <EChart height={260} option={hbarsOption({ rows: [
            ...PHONE_TIERS.map((t) => { const v = median(f.offers.filter((o) => o.driverPhoneTier === t).map((o) => o.latencySec)); return { label: t, value: v ?? 0, text: v === null ? "—" : `${Math.round(v)}s` }; }),
            ...PLATFORMS.filter((p) => p === "Android" || p === "iPhone").map((p) => { const v = median(f.offers.filter((o) => o.driverPlatform === p).map((o) => o.latencySec)); return { label: p, value: v ?? 0, text: v === null ? "—" : `${Math.round(v)}s` }; }),
          ] })} />
        </Panel>
        <Panel title="App versions in use" sub="Devices seen in the period, riders and drivers. Click to filter requests from that version.">
          <EChart option={barsOption({ rows: versions.map((v) => ({ label: v, value: f.devices.filter((d) => d.appVersion === v).length })), name: "Devices", selected: sel("appVersion") })} onClick={(c) => pick("appVersion", c.name)} />
        </Panel>
        <Panel title="Top phones" sub="The 20 phones with the most requests.">
          <MiniTable
            head={["Phone", "Requests", "Completed", "Gave up early", "Median agreed fare"]}
            align={["left", "right", "right", "right", "right"]}
            rows={models.map((m) => [
              m.label,
              num(m.rows.length),
              pct(completedRate(m.rows)),
              pct(share(m.rows.filter(gaveUpEarly).length, m.rows.filter(searched).length)),
              naira(median(m.rows.flatMap((x) => (x.agreedNgn ? [x.agreedNgn] : [])))),
            ])}
          />
        </Panel>
      </Grid>
      {data.devices.length === 0 ? <p className="studio-nofilter">No devices in this period yet.</p> : null}
    </>
  );
}
