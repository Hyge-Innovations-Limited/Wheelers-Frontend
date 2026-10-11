"use client";

import { useState } from "react";

import { Card, EmptyState, ErrorState, PageHeader, RefreshButton, SectionLabel, Spinner, StatCard, StatGrid, TableWrap } from "@/components/admin/ui";
import { useAdminData } from "@/components/admin/use-admin-data";
import { adminJson } from "@/lib/admin-api";
import { useAdminSession } from "@/lib/admin-session";

/**
 * Pricing: how a fare is suggested. Owners only.
 *
 * A trip starts at the higher of two numbers: the floor (what the other app
 * charges for it, plus the premium) and the rules (our rate per km, lifted by
 * traffic and a busy area). Switched on, the model then moves that a little:
 * usually a few hundred naira down, never closer to the other app than it is
 * allowed. The other app's figures are typed in here from sampled quotes;
 * nothing reads them from its app.
 */

interface Formula { baseNgn: number; perKmNgn: number; perMinuteNgn: number }
interface Settings {
  marketFloorOn: boolean;
  premiumNgn: number;
  quiet: Formula;
  rush: Formula;
  trafficOn: boolean;
  demandOn: boolean;
  modelOn: boolean;
  model: { trainedAt: string; rows: number; seeded?: boolean } | null;
  liftCap: number;
  maxDiscountNgn: number;
  modelPremiumNgn: number;
  rideValueNgn: number;
  trialShare: number;
}
interface ExampleSide {
  marketFareNgn: number | null; suggestedFareNgn: number; minOfferNgn: number; maxOfferNgn: number;
  ratePerKmNgn: number; setBy: string; modelFareNgn: number | null; driverPayoutNgn: number; wheelersNgn: number;
}
interface PricingPage {
  settings: Settings;
  updatedAt: string | null;
  updatedBy: string | null;
  /** The model this build of the server prices with. Null when it has none. */
  trainedModel?: { trainedAt: string; rows: number; source: string; realRows?: number } | null;
  fixed: { serviceChargeNgn: number; commissionRate: number; vatRate: number; stateLevyNgn: number; baseRatePerKmNgn: number };
  examples: Array<{ label: string; distanceKm: number; minutes: number; quiet: ExampleSide; rush: ExampleSide }>;
  busyness: Array<{ zone: string; requests: number; drivers: number; ratio: number | null; factor: number; at: string }>;
  lastWeek: {
    quotes: number; setBy: Record<string, number>; medianAboveMarketNgn: number | null;
    quotesWithModel: number; medianModelMinusQuoteNgn: number | null; ridesRequested: number; ridesCompleted: number;
  };
}

const naira = (v: number | null | undefined) => (v == null ? "—" : `₦${Math.round(v).toLocaleString("en-NG")}`);
// A trial price is one of the model's own range: on this page it counts as the model's.
const SET_BY: Record<string, string> = { floor: "Floor", rules: "Rules", model: "Model", trial: "Model" };
const input: React.CSSProperties = { height: 38, borderRadius: 10, border: "1px solid #E8DDD3", padding: "0 10px", fontSize: 14, width: 110 };

function Num({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "#786F68" }}>
      {label}
      <input type="number" inputMode="decimal" min={0} step={step} value={Number.isFinite(value) ? value : 0} onChange={(e) => onChange(Number(e.target.value))} style={input} />
    </label>
  );
}

function Switch({ label, hint, on, onChange, disabled }: { label: string; hint: string; on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label style={{ display: "flex", gap: 10, alignItems: "flex-start", opacity: disabled ? 0.55 : 1 }}>
      <input type="checkbox" checked={on} disabled={disabled} onChange={(e) => onChange(e.target.checked)} style={{ marginTop: 3, width: 16, height: 16 }} />
      <span>
        <strong style={{ fontSize: 14 }}>{label}</strong>
        <span style={{ display: "block", fontSize: 12.5, color: "#786F68" }}>{hint}</span>
      </span>
    </label>
  );
}

function FormulaRow({ title, value, onChange }: { title: string; value: Formula; onChange: (f: Formula) => void }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
      <strong style={{ width: 150, fontSize: 14, paddingBottom: 9 }}>{title}</strong>
      <Num label="Base ₦" value={value.baseNgn} onChange={(v) => onChange({ ...value, baseNgn: v })} step={50} />
      <Num label="Per km ₦" value={value.perKmNgn} onChange={(v) => onChange({ ...value, perKmNgn: v })} step={5} />
      <Num label="Per minute ₦" value={value.perMinuteNgn} onChange={(v) => onChange({ ...value, perMinuteNgn: v })} />
    </div>
  );
}

export default function PricingSettingsPage() {
  const { isOwner, admin } = useAdminSession();
  const { data, error, loading, refresh } = useAdminData<PricingPage>(isOwner ? "/admin/pricing" : null, [isOwner]);
  // What the last save returned stands in for the loaded page until the next refresh;
  // the form is the saved settings until something is edited.
  const [saved, setSaved] = useState<PricingPage | null>(null);
  const [edited, setDraft] = useState<Settings | null>(null);
  const page = saved ?? data ?? null;
  const draft = edited ?? page?.settings ?? null;
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  if (admin && !isOwner) {
    // Said the way any missing page is: no hint that a role keeps it from them.
    return (
      <>
        <PageHeader title="Page not found" />
        <EmptyState>This page doesn&apos;t exist.</EmptyState>
      </>
    );
  }

  const changed = Boolean(draft && page && JSON.stringify(draft) !== JSON.stringify(page.settings));

  const save = async () => {
    if (!draft) return;
    setSaving(true); setNote(null);
    try {
      setSaved(await adminJson<PricingPage>("/admin/pricing", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(draft) }));
      setDraft(null);
      setNote({ ok: true, text: "Saved. New quotes use it within a minute." });
    } catch (e) {
      setNote({ ok: false, text: e instanceof Error ? e.message : "Could not save." });
    } finally {
      setSaving(false);
    }
  };

  const week = page?.lastWeek;
  const share = (key: string) => (week && week.quotes > 0 ? `${Math.round(((week.setBy[key] ?? 0) / week.quotes) * 100)}%` : "—");

  return (
    <>
      <PageHeader
        title="Pricing"
        subtitle={page?.updatedAt ? `Last saved ${new Date(page.updatedAt).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Lagos" })}${page.updatedBy ? ` by ${page.updatedBy}` : ""}` : "How a fare is suggested"}
        actions={<RefreshButton onClick={() => { setSaved(null); refresh(); }} busy={loading} />}
      />

      {error && !page ? <ErrorState error={error} onRetry={refresh} /> : null}
      {!page || !draft ? (loading ? <Spinner label="Loading pricing" /> : null) : (
        <>
          <Card title="The floor: never under the other app" right="Its figures come from quotes you sample; type them in">
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
              <Switch
                label="Use the floor"
                hint="A trip is never suggested under the other app's fare + the premium, and a rider can bargain away no more than the premium. Off: our plain rate per km."
                on={draft.marketFloorOn}
                onChange={(v) => setDraft({ ...draft, marketFloorOn: v })}
              />
              <FormulaRow title="Quiet hours" value={draft.quiet} onChange={(f) => setDraft({ ...draft, quiet: f })} />
              <FormulaRow title="Rush hours" value={draft.rush} onChange={(f) => setDraft({ ...draft, rush: f })} />
              <p style={{ margin: 0, fontSize: 12.5, color: "#786F68" }}>
                Their fare for a trip = base + per km × distance + per minute × trip time. Rush hours are weekdays 07:00–10:00 and 16:00–20:00.
              </p>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <Num label="Premium ₦ per trip" value={draft.premiumNgn} onChange={(v) => setDraft({ ...draft, premiumNgn: v })} step={50} />
                <Num label="Highest lift ×" value={draft.liftCap} onChange={(v) => setDraft({ ...draft, liftCap: v })} step={0.1} />
              </div>
            </div>
          </Card>

          <div style={{ height: 16 }} />

          <Card title="What may lift a fare above the floor">
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
              <Switch
                label="Traffic"
                hint="The rate per km rises on a slow road, and the other app's fare is worked from the live trip time. Routes are then asked of Google with live traffic."
                on={draft.trafficOn}
                onChange={(v) => setDraft({ ...draft, trafficOn: v })}
              />
              <Switch
                label="A busy area"
                hint="The rate rises a step at a time while a launch zone has more requests per driver than is usual for that hour."
                on={draft.demandOn}
                onChange={(v) => setDraft({ ...draft, demandOn: v })}
              />
              <Switch
                label="The model"
                hint={page.trainedModel
                  ? `Trained ${new Date(page.trainedModel.trainedAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })} on ${page.trainedModel.rows.toLocaleString("en-NG")} ${page.trainedModel.source === "simulated" ? "made-up quotes from a simulated market: it has not yet learned from real riders" : `made-up quotes, corrected on ${(page.trainedModel.realRows ?? 0).toLocaleString("en-NG")} real Wheelers quotes`}. On, it moves each price a little, usually down, to the one it expects to be worth most. Off, its number is only recorded beside each quote.`
                  : draft.model
                    ? `A small fitted model, trained ${new Date(draft.model.trainedAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}. It may lift a fare, never lower it.`
                    : "There is no trained model yet."}
                on={draft.modelOn}
                disabled={!page.trainedModel && !draft.model}
                onChange={(v) => setDraft({ ...draft, modelOn: v })}
              />
              {page.trainedModel ? (
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", paddingLeft: 26 }}>
                  <Num label="Most it may take off ₦" value={draft.maxDiscountNgn} onChange={(v) => setDraft({ ...draft, maxDiscountNgn: v })} step={50} />
                  <Num label="Stays above the other app by ₦" value={draft.modelPremiumNgn} onChange={(v) => setDraft({ ...draft, modelPremiumNgn: v })} step={50} />
                  <p style={{ margin: 0, fontSize: 12.5, color: "#786F68", flexBasis: "100%" }}>
                    A cut is also never more than a tenth of the fare. With the model on, a rider can bargain away only the second amount, so no offer goes under the other app.
                  </p>
                </div>
              ) : null}
              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <button type="button" className="admin-btn-primary" onClick={() => void save()} disabled={!changed || saving}>
                  {saving ? "Saving…" : "Save pricing"}
                </button>
                {changed ? (
                  <button type="button" className="admin-btn-ghost" onClick={() => { setDraft(null); setNote(null); }} disabled={saving}>Undo changes</button>
                ) : null}
                {note ? <span style={{ fontSize: 13, color: note.ok ? "#1F8A4C" : "#FF3333" }}>{note.text}</span> : null}
              </div>
            </div>
          </Card>

          <SectionLabel right={changed ? "As last saved, not as edited above" : undefined}>Example trips at the saved settings</SectionLabel>
          <Card>
            <TableWrap>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Trip</th><th>When</th><th className="num">Other app</th><th className="num">We suggest</th><th>Set by</th>
                    <th className="num">Rate per km</th><th className="num">Lowest offer</th><th className="num">Highest bid</th>
                    <th className="num">Driver gets</th><th className="num">Wheelers keeps</th>
                  </tr>
                </thead>
                <tbody>
                  {page.examples.flatMap((trip) => ([["Quiet", trip.quiet], ["Rush", trip.rush]] as Array<[string, ExampleSide]>).map(([when, side]) => (
                    <tr key={`${trip.label}-${when}`}>
                      <td>{when === "Quiet" ? trip.label : ""}</td>
                      <td>{when}</td>
                      <td className="num">{naira(side.marketFareNgn)}</td>
                      <td className="num"><strong>{naira(side.suggestedFareNgn)}</strong></td>
                      <td>{SET_BY[side.setBy] ?? side.setBy}</td>
                      <td className="num">{naira(side.ratePerKmNgn)}</td>
                      <td className="num">{naira(side.minOfferNgn)}</td>
                      <td className="num">{naira(side.maxOfferNgn)}</td>
                      <td className="num">{naira(side.driverPayoutNgn)}</td>
                      <td className="num">{naira(side.wheelersNgn)}</td>
                    </tr>
                  )))}
                </tbody>
              </table>
            </TableWrap>
          </Card>

          <SectionLabel>The last 7 days</SectionLabel>
          <StatGrid>
            <StatCard label="Prices shown" value={week!.quotes.toLocaleString("en-NG")} hint={`${week!.ridesRequested.toLocaleString("en-NG")} rides requested · ${week!.ridesCompleted.toLocaleString("en-NG")} completed`} />
            <StatCard label="Above the other app" value={naira(week!.medianAboveMarketNgn)} hint="Median of our suggested fare less their estimated fare" />
            <StatCard label="What set the price" value={`${share("floor")} floor`} hint={`${share("rules")} rules · ${week && week.quotes > 0 ? `${Math.round((((week.setBy.model ?? 0) + (week.setBy.trial ?? 0)) / week.quotes) * 100)}%` : "—"} model`} />
            <StatCard
              label="The model, watching"
              value={week!.quotesWithModel > 0 ? naira(week!.medianModelMinusQuoteNgn) : "—"}
              hint={week!.quotesWithModel > 0 ? "Median of the model's fare less the fare we showed" : "No model has priced a quote yet"}
            />
          </StatGrid>

          <SectionLabel>How busy each zone is now</SectionLabel>
          <Card>
            {page.busyness.length === 0 ? <EmptyState>Not measured yet. It is measured every five minutes.</EmptyState> : (
              <TableWrap>
                <table className="admin-table">
                  <thead>
                    <tr><th>Zone</th><th className="num">Requests, last 10 min</th><th className="num">Drivers online</th><th className="num">Against the usual</th><th className="num">Lift on the rate</th></tr>
                  </thead>
                  <tbody>
                    {page.busyness.map((z) => (
                      <tr key={z.zone}>
                        <td>{z.zone}</td>
                        <td className="num">{z.requests}</td>
                        <td className="num">{z.drivers}</td>
                        <td className="num">{z.ratio == null ? "No history yet" : `${z.ratio}×`}</td>
                        <td className="num">{z.factor > 1 ? `+${Math.round((z.factor - 1) * 100)}%` : "None"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </Card>

          <SectionLabel>Fixed (changed in code, not here)</SectionLabel>
          <StatGrid>
            <StatCard label="Service charge" value={naira(page.fixed.serviceChargeNgn)} hint="In every fare, paid by the rider" />
            <StatCard label="Commission" value={`${Math.round(page.fixed.commissionRate * 100)}%`} hint="Of the trip fare, from the driver" />
            <StatCard label="VAT" value={`${(page.fixed.vatRate * 100).toFixed(1)}%`} hint="Of the trip fare, added to the rider's fare" />
            <StatCard label="Our rate per km" value={naira(page.fixed.baseRatePerKmNgn)} hint={`Before any lift. Lagos levy ${naira(page.fixed.stateLevyNgn)} from the driver`} />
          </StatGrid>
        </>
      )}
    </>
  );
}
