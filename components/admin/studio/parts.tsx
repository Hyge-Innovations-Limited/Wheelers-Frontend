"use client";

import type { ReactNode } from "react";
import {
  CHANNELS, DAY_PARTS, FARE_SIZES, JOINED_VIA, PROMO_FILTER, RIDE_CLASSES, RIDER_TYPES, VARIANTS, WEATHERS, ZONES,
} from "@/lib/studio/schema";
import { pickLabel, pickOf, setPick, type StudioFilters } from "@/lib/studio/filters";
import { ExportTable, PanelTitle, useExportScope, type Cell } from "./export";

/**
 * A chart card: title, one line under it, the chart. `missing`: what this chart needs that is not recorded yet
 * (live data): the card says so instead of drawing zeros as if they were facts. `name`: the card's name in the Excel
 * when its title is not plain text.
 */
export function Panel({ title, name, sub, right, missing, children }: { title: ReactNode; name?: string; sub?: ReactNode; right?: ReactNode; missing?: string | false; children: ReactNode }) {
  const scope = useExportScope();
  const label = name ?? (typeof title === "string" ? title : "");
  if (scope) return missing ? null : <PanelTitle title={label}>{children}</PanelTitle>;
  return (
    <section className="studio-panel">
      <div className="studio-panel-head">
        <h3 className="studio-panel-title">{title}</h3>
        {right}
      </div>
      {sub ? <p className="studio-panel-sub">{sub}</p> : null}
      <div className="studio-panel-body">
        {missing ? <div className="studio-missing"><b>Not recorded yet</b><span>{missing}</span></div> : <PanelTitle title={label}>{children}</PanelTitle>}
      </div>
    </section>
  );
}

export function Kpis({ items }: { items: Array<{ label: string; value: string; hint?: string }> }) {
  if (useExportScope()) return <ExportTable title="Headline numbers" columns={["", "Value", "Note"]} rows={items.map((k) => [k.label, k.value, k.hint ?? null])} />;
  return (
    <div className="studio-kpis" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((k) => (
        <div className="studio-kpi" key={k.label}>
          <div className="studio-kpi-label">{k.label}</div>
          <div className="studio-kpi-value">{k.value}</div>
          {k.hint ? <div className="studio-kpi-hint">{k.hint}</div> : null}
        </div>
      ))}
    </div>
  );
}

export function Grid({ children }: { children: ReactNode }) {
  return <div className="studio-grid">{children}</div>;
}

/** The legend over a stacked chart, as on the mock-up. */
export function Legend({ items }: { items: Array<{ name: string; color: string }> }) {
  return (
    <div className="studio-legend">
      {items.map((i) => (
        <span key={i.name}><i style={{ background: i.color }} />{i.name}</span>
      ))}
    </div>
  );
}

/** A plain table inside a panel (e.g. why riders changed their price). */
export function MiniTable({ head, rows, align }: { head: string[]; rows: Array<Array<ReactNode>>; align?: Array<"left" | "right"> }) {
  if (useExportScope()) return <ExportTable columns={head} rows={rows.map((r) => r.map((c) => (typeof c === "number" || typeof c === "string" ? c : c === null || c === undefined ? null : String(c)) as Cell))} />;
  return (
    <table className="studio-table">
      <thead><tr>{head.map((h, i) => <th key={h} style={{ textAlign: align?.[i] ?? (i === 0 ? "left" : "right") }}>{h}</th>)}</tr></thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>{r.map((c, j) => <td key={j} style={{ textAlign: align?.[j] ?? (j === 0 ? "left" : "right") }}>{c}</td>)}</tr>
        ))}
      </tbody>
    </table>
  );
}

const BAR: Array<{ key: string; label: string; options: readonly string[]; wide?: boolean }> = [
  { key: "channel", label: "Channel", options: CHANNELS },
  { key: "rideClass", label: "Ride class", options: RIDE_CLASSES },
  { key: "riderType", label: "Rider type", options: RIDER_TYPES, wide: true },
  { key: "weather", label: "Weather", options: WEATHERS },
  { key: "dayPart", label: "Day part", options: DAY_PARTS },
  { key: "zone", label: "Zone", options: ZONES },
  { key: "variant", label: "Offer timeout test", options: VARIANTS },
  { key: "fareSize", label: "Fare size", options: FARE_SIZES },
  { key: "destZone", label: "Destination", options: ZONES },
  { key: "joinedVia", label: "Rider joined via", options: JOINED_VIA },
];

/** Promo is one dropdown over two fields: a promo on the ride, or how the rider was onboarded. */
const promoValue = (f: StudioFilters) => pickOf(f, "promo") || pickOf(f, "onboarded");
function setPromo(f: StudioFilters, value: string): StudioFilters {
  const cleared = setPick(setPick(f, "promo", ""), "onboarded", "");
  if (!value) return cleared;
  return value.startsWith("Onboarded") ? setPick(cleared, "onboarded", value) : setPick(cleared, "promo", value);
}

export function FilterBar({ filters, onChange, min, max, zones }: { filters: StudioFilters; onChange: (f: StudioFilters) => void; min: string; max: string; zones: string[] }) {
  const bar = BAR.map((b) => (b.key === "zone" || b.key === "destZone" ? { ...b, options: zones } : b));
  return (
    <div className="studio-filterbar">
      <label className="studio-field">
        <span>From</span>
        <input type="date" min={min} max={max} value={filters.from} onChange={(e) => onChange({ ...filters, from: e.target.value })} />
      </label>
      <label className="studio-field">
        <span>To</span>
        <input type="date" min={min} max={max} value={filters.to} onChange={(e) => onChange({ ...filters, to: e.target.value })} />
      </label>
      {bar.map((b) => (
        <label className={`studio-field${b.wide ? " wide" : ""}`} key={b.key}>
          <span>{b.label}</span>
          <select value={pickOf(filters, b.key)} onChange={(e) => onChange(setPick(filters, b.key, e.target.value))}>
            <option value="">All</option>
            {b.options.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </label>
      ))}
      <label className="studio-field wide">
        <span>Promo</span>
        <select value={promoValue(filters)} onChange={(e) => onChange(setPromo(filters, e.target.value))}>
          <option value="">All</option>
          {PROMO_FILTER.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </label>
      <button type="button" className="studio-reset" onClick={() => onChange({ from: "", to: "", picks: [] })}>Reset all</button>
    </div>
  );
}

/** What is filtering the page now, each with its ×; or the line that says nothing is. */
export function Chips({ filters, onChange, period }: { filters: StudioFilters; onChange: (f: StudioFilters) => void; period: string }) {
  const chips: Array<{ id: string; text: string; clear: () => StudioFilters }> = [];
  if (filters.from) chips.push({ id: "from", text: `From ${filters.from}`, clear: () => ({ ...filters, from: "" }) });
  if (filters.to) chips.push({ id: "to", text: `To ${filters.to}`, clear: () => ({ ...filters, to: "" }) });
  for (const p of filters.picks) chips.push({ id: p.key, text: pickLabel(p), clear: () => ({ ...filters, picks: filters.picks.filter((x) => x.key !== p.key) }) });
  if (chips.length === 0) return <p className="studio-nofilter">No filters — showing all of {period}.</p>;
  return (
    <div className="studio-chips">
      {chips.map((c) => (
        <button type="button" key={c.id} className="studio-chip" onClick={() => onChange(c.clear())} aria-label={`Remove ${c.text}`}>
          {c.text} <span aria-hidden>×</span>
        </button>
      ))}
    </div>
  );
}
