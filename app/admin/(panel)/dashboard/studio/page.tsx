"use client";

/**
 * Analytics Studio (Timi, 18 Nov 2026): the "Wheelers Analytics Studio" mock-up, made real. Ten tabs, one filter bar,
 * and a click on any bar, slice or band cross-filters the whole page (again to clear). Session explorer drills into
 * any single request. Live data only (GET /admin/insights/studio-dataset, the last 30 days; lib/studio/source.ts). "Download Excel": one sheet per tab with the numbers on screen, then the data.
 * Owners only, like the live Studio (/admin/dashboard/studio/live).
 */
import "../../../../../styles/studio.css";
import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { useAdminSession } from "@/lib/admin-session";
import { EmptyState, Spinner } from "@/components/admin/ui";
import { applyFilters, NO_FILTERS, pickOf, togglePick, type Filtered, type Level, type StudioFilters } from "@/lib/studio/filters";
import { useStudioDataset } from "@/lib/studio/source";
import type { StudioDataset } from "@/lib/studio/schema";
import { Chips, FilterBar } from "@/components/admin/studio/parts";
import { DemandSupply, Drivers, OffersChoice, Overview, RiderPricing } from "@/components/admin/studio/tabs-a";
import { Money, PeoplePromos, PriceAnatomy, PricePsychology } from "@/components/admin/studio/tabs-b";
import { Explorer } from "@/components/admin/studio/explorer";
import { Devices } from "@/components/admin/studio/tabs-c";
import { downloadWorkbook, ExportScope, type ExportItem } from "@/components/admin/studio/export";
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
  { id: "devices", label: "Devices", View: Devices },
  { id: "explorer", label: "Session explorer", View: Explorer },
] as const;
type TabId = (typeof TABS)[number]["id"];
const CHART_TABS = TABS.filter((t) => t.id !== "explorer");

export default function AnalyticsStudioPage() {
  const { isOwner } = useAdminSession();
  if (!isOwner) return <EmptyState>The Studio is for owners.</EmptyState>;
  return <Studio />;
}

function Studio() {
  const { data, loading, error, refresh } = useStudioDataset("live");
  return (
    <div className="studio">
      <header className="studio-head">
        <h1 className="studio-title">Wheelers Analytics Studio</h1>
      </header>
      {error ? (
        <div className="studio-error">
          Could not load the live data. <button type="button" className="studio-reset" onClick={refresh}>Try again</button>
        </div>
      ) : loading || !data ? (
        <Spinner label="Loading the Studio…" />
      ) : (
        // A new dataset starts with no filters (its days and zones differ).
        <StudioBody key={`${data.source}:${data.from}`} data={data} />
      )}
    </div>
  );
}

function StudioBody({ data }: { data: StudioDataset }) {
  const [tab, setTab] = useState<TabId>("overview");
  const [filters, setFilters] = useState<StudioFilters>(NO_FILTERS);
  const [exporting, setExporting] = useState(false);
  const items = useRef<ExportItem[]>([]);
  const f = useMemo(() => applyFilters(data, filters), [data, filters]);
  const byId = useMemo(() => new Map(data.sessions.map((s) => [s.id, s])), [data]);
  const pick = useCallback((key: string, value: string, level: Level = "session") => setFilters((now) => togglePick(now, { key, value, level })), []);
  const sel = useCallback((key: string) => pickOf(filters, key) || null, [filters]);
  // For each pick, the page without it (a few ms each; a key with no pick is just f).
  const without = useMemo(() => new Map<string, Filtered>(filters.picks.map((p) => [p.key, applyFilters(data, filters, p.key)])), [data, filters]);
  const fx = useCallback((key: string): Filtered => without.get(key) ?? f, [without, f]);
  const notRecorded = useMemo(() => new Set(data.notRecorded), [data]);
  const nr = useCallback((field: string) => notRecorded.has(field), [notRecorded]);
  const period = data.source === "sample"
    ? new Date(`${data.from}T12:00:00Z`).toLocaleString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })
    : `${data.from} to ${data.to}`;
  const props: TabProps = { data, f, filters, pick, sel, byId, fx, nr };
  const View = TABS.find((t) => t.id === tab)!.View;

  const startExport = () => {
    items.current = [];
    setExporting(true);
  };
  const finishExport = useCallback(() => {
    const name = `wheelers-studio-${data.source}-${filters.from || data.from}-to-${filters.to || data.to}.xlsx`;
    void downloadWorkbook({ name, items: items.current, tabs: CHART_TABS.map((t) => t.label), f })
      .catch((e) => console.error("[studio] Excel not made", e))
      .finally(() => setExporting(false));
  }, [data, filters, f]);

  return (
    <>
      <nav className="studio-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? "on" : ""} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      <FilterBar filters={filters} onChange={setFilters} min={data.from} max={data.to} zones={data.zones} />
      <div className="studio-bar-after">
        <Chips filters={filters} onChange={setFilters} period={period} />
        <button type="button" className="studio-download" disabled={exporting} onClick={startExport}>{exporting ? "Making the Excel…" : "Download Excel"}</button>
      </div>

      <View {...props} />

      {exporting ? (
        // Every tab once, hidden: each chart hands over its numbers (components/admin/studio/export.tsx).
        <div hidden aria-hidden>
          {CHART_TABS.map((t) => (
            <ExportScope key={t.id} tab={t.label} add={(item) => items.current.push(item)}>
              <t.View {...props} />
            </ExportScope>
          ))}
          <AfterExportPass onDone={finishExport} />
        </div>
      ) : null}

      <p className="studio-foot">
        Live data: one row per ride request; no names or phone numbers. Group rides are not in it yet.
      </p>
    </>
  );
}

/** Mounted after the hidden tabs: its effect runs once theirs have handed over their numbers. */
function AfterExportPass({ onDone }: { onDone: () => void }) {
  useEffect(() => { onDone(); }, [onDone]);
  return null;
}
