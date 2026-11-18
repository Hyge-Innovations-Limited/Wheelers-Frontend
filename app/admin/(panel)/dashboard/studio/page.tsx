"use client";

/**
 * Analytics Studio (Timi, 18 Nov 2026): the "Wheelers Analytics Studio" mock-up, made real. Ten tabs, one filter bar,
 * and a click on any bar, slice or band cross-filters the whole page (again to clear). Session explorer drills into
 * any single request. Runs on the seeded sample dataset until the server endpoint exists (lib/studio/source.ts).
 * Owners only, like the live Studio (/admin/dashboard/studio/live).
 */
import "../../../../../styles/studio.css";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { useAdminSession } from "@/lib/admin-session";
import { EmptyState } from "@/components/admin/ui";
import { applyFilters, NO_FILTERS, pickOf, togglePick, type Filtered, type Level, type StudioFilters } from "@/lib/studio/filters";
import { useStudioDataset } from "@/lib/studio/source";
import { num } from "@/lib/studio/stats";
import { Chips, FilterBar } from "@/components/admin/studio/parts";
import { DemandSupply, Drivers, OffersChoice, Overview, RiderPricing } from "@/components/admin/studio/tabs-a";
import { Money, PeoplePromos, PriceAnatomy, PricePsychology } from "@/components/admin/studio/tabs-b";
import { Explorer } from "@/components/admin/studio/explorer";
import type { TabProps } from "@/components/admin/studio/tab-props";

const TABS = [
  { id: "overview", label: "Overview", View: Overview },
  { id: "demand", label: "Demand & supply", View: DemandSupply },
  { id: "pricing", label: "Rider pricing", View: RiderPricing },
  { id: "offers", label: "Offers & choice", View: OffersChoice },
  { id: "drivers", label: "Drivers (internal)", View: Drivers },
  { id: "money", label: "Money", View: Money },
  { id: "anatomy", label: "Price anatomy", View: PriceAnatomy },
  { id: "psychology", label: "Price psychology", View: PricePsychology },
  { id: "people", label: "People & promos", View: PeoplePromos },
  { id: "explorer", label: "Session explorer", View: Explorer },
] as const;
type TabId = (typeof TABS)[number]["id"];

export default function AnalyticsStudioPage() {
  const { isOwner } = useAdminSession();
  if (!isOwner) return <EmptyState>The Studio is for owners.</EmptyState>;
  return <Studio />;
}

function Studio() {
  const data = useStudioDataset();
  const [tab, setTab] = useState<TabId>("overview");
  const [filters, setFilters] = useState<StudioFilters>(NO_FILTERS);
  const f = useMemo(() => applyFilters(data, filters), [data, filters]);
  const byId = useMemo(() => new Map(data.sessions.map((s) => [s.id, s])), [data]);
  const pick = useCallback((key: string, value: string, level: Level = "session") => setFilters((now) => togglePick(now, { key, value, level })), []);
  const sel = useCallback((key: string) => pickOf(filters, key) || null, [filters]);
  // For each pick, the page without it (a few ms each; a key with no pick is just f).
  const without = useMemo(() => new Map<string, Filtered>(filters.picks.map((p) => [p.key, applyFilters(data, filters, p.key)])), [data, filters]);
  const fx = useCallback((key: string): Filtered => without.get(key) ?? f, [without, f]);
  const period = new Date(`${data.from}T12:00:00Z`).toLocaleString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  const props: TabProps = { data, f, filters, pick, sel, byId, fx };
  const View = TABS.find((t) => t.id === tab)!.View;

  return (
    <div className="studio">
      <header className="studio-head">
        <div>
          <h1 className="studio-title">Wheelers Analytics Studio</h1>
          <p className="studio-intro">
            {data.source === "sample" ? <><b>Simulated sample data</b> — {num(data.sessions.length)} ride requests, {period}, generated to rehearse the analytics. </> : null}
            Filter with the bar below; <b>click any bar, slice or band to cross-filter the whole page</b> (click it again to clear). Open Session explorer to drill into any single request.
          </p>
        </div>
        <div className="studio-head-right">
          {data.source === "sample" ? <span className="studio-badge">Sample data</span> : null}
          <Link href="/admin/dashboard/studio/live" className="studio-link">Live numbers →</Link>
        </div>
      </header>

      <nav className="studio-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? "on" : ""} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      <FilterBar filters={filters} onChange={setFilters} min={data.from} max={data.to} />
      <Chips filters={filters} onChange={setFilters} period={period} />

      <View {...props} />

      <p className="studio-foot">
        {data.source === "sample"
          ? "Simulated data, generated in the browser from a fixed seed to rehearse Wheelers analytics — not real traffic. Live numbers are on the Live numbers page."
          : "Live data."}
      </p>
    </div>
  );
}
