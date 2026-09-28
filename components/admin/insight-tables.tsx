"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type {
  InsightDriverRow,
  InsightFilters,
  InsightRiderRow,
  PagedResponse,
  RideChannel,
  TripRow,
  TripStatusFilter,
} from "@/lib/admin-api";
import { formatDateTime, formatDistance, formatHours, formatNaira, formatNumber, formatPercent, humanise, statusBadgeClass } from "@/lib/admin-format";
import { filtersQuery, useInsightParams } from "@/lib/insight-filters";
import { useAdminData, useDebounced } from "@/components/admin/use-admin-data";
import { DataTable, type Column } from "@/components/admin/data-table";
import { Badge, Card, FilterTabs, SearchInput } from "@/components/admin/ui";

const PAGE_SIZE = 25;

export const CHANNEL_LABEL: Record<RideChannel, string> = { APP: "App", WHATSAPP: "WhatsApp", MCP: "Claude", UNKNOWN: "Unknown" };

const TRIP_STATUSES: Array<{ value: TripStatusFilter; label: string }> = [
  { value: "all", label: "All requests" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "no_driver", label: "No driver" },
  { value: "active", label: "In flight" },
  { value: "open", label: "Searching" },
  { value: "disputed", label: "Disputed" },
];

const money = (n: number | null) => (n == null ? "—" : formatNaira(n));
const zone = (z: string | null) => z ?? "Outside";
const route = (t: TripRow) => `${t.pickupAddress.split(",")[0]} → ${t.destAddress.split(",")[0]}`;

/** Search, sort and paging for one table; the sort and search live in the URL. */
function useTableState(defaultSort: string) {
  const { params, set } = useInsightParams();
  const [search, setSearch] = useState(params.get("q") ?? "");
  const q = useDebounced(search);
  const sort = params.get("sort") || defaultSort;
  const dir = (params.get("dir") as "asc" | "desc" | null) || "desc";
  const paramsKey = params.toString();
  // The page belongs to one set of filters: any change of filter, sort or search
  // starts again from the first page, with no effect needed to reset it.
  const [page, setPage] = useState({ key: paramsKey, offset: 0 });
  const offset = page.key === paramsKey ? page.offset : 0;
  const setOffset = (next: number) => setPage({ key: paramsKey, offset: next });

  useEffect(() => {
    if ((params.get("q") ?? "") !== q) set({ q: q || null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return {
    search,
    setSearch,
    q,
    offset,
    setOffset,
    sort,
    dir,
    onSort: (s: string, d: "asc" | "desc") => set({ sort: s, dir: d }),
  };
}

export function TripsTable({
  filters,
  status,
  feeColumns = false,
  title,
}: {
  filters: InsightFilters;
  status: TripStatusFilter;
  feeColumns?: boolean;
  title?: string;
}) {
  const t = useTableState(status === "completed" ? "completedAt" : "createdAt");
  const path = `/admin/insights/trips${filtersQuery(filters, { status, q: t.q, sort: t.sort, dir: t.dir, limit: PAGE_SIZE, offset: t.offset })}`;
  const { data, error, loading, refresh } = useAdminData<PagedResponse<TripRow>>(path);

  const columns: Array<Column<TripRow>> = [
    { key: "trip", label: "Trip ID", render: (r) => <span className="admin-trip-id">{r.tripId ?? "—"}</span> },
    {
      key: "when",
      label: status === "completed" ? "Completed" : status === "cancelled" || status === "no_driver" ? "Cancelled" : "Requested",
      sortKey: status === "completed" ? "completedAt" : "createdAt",
      render: (r) => formatDateTime(status === "completed" ? r.completedAt : status === "cancelled" || status === "no_driver" ? r.cancelledAt ?? r.createdAt : r.createdAt),
    },
    { key: "route", label: "Route", render: (r) => <span className="admin-cell-route" title={`${r.pickupAddress} → ${r.destAddress}`}>{route(r)}</span> },
    { key: "zone", label: "Zones", sortKey: "zone", render: (r) => `${zone(r.pickupZone)} → ${zone(r.destZone)}` },
    { key: "rider", label: "Rider", sortKey: "rider", render: (r) => <Link href={`/admin/dashboard/users/${r.riderId}`}>{r.riderName ?? "Rider"}</Link> },
    {
      key: "driver",
      label: "Driver",
      sortKey: "driver",
      render: (r) => (r.driverId ? <Link href={`/admin/dashboard/drivers/${r.driverId}`}>{r.driverName ?? "Driver"}</Link> : "—"),
    },
    { key: "fare", label: "Fare", numeric: true, sortKey: "fare", render: (r) => money(r.fareNgn) },
    ...(feeColumns
      ? [
          { key: "commission", label: "Commission", numeric: true, sortKey: "commission", render: (r: TripRow) => money(r.commissionNgn) },
          { key: "service", label: "Service fee", numeric: true, render: (r: TripRow) => money(r.serviceFeeNgn) },
          { key: "levy", label: "State levy", numeric: true, render: (r: TripRow) => money(r.stateLevyNgn) },
          {
            key: "total",
            label: "Platform total",
            numeric: true,
            sortKey: "platformTotal",
            render: (r: TripRow) => (
              <>
                {money(r.platformTotalNgn)}
                {r.feeSplitEstimated ? <span className="admin-estimated" title="Split reconstructed from the rates in force then">est.</span> : null}
              </>
            ),
          },
          { key: "payout", label: "Driver got", numeric: true, render: (r: TripRow) => money(r.driverPayoutNgn) },
        ]
      : [
          { key: "channel", label: "Channel", sortKey: "channel", render: (r: TripRow) => CHANNEL_LABEL[r.channel] },
          { key: "bids", label: "Bids", numeric: true, sortKey: "bids", render: (r: TripRow) => formatNumber(r.bids) },
          { key: "distance", label: "Distance", numeric: true, sortKey: "distance", render: (r: TripRow) => formatDistance(r.distanceKm) },
          { key: "status", label: "Status", sortKey: "status", render: (r: TripRow) => <Badge className={statusBadgeClass(r.status)}>{humanise(r.status)}</Badge> },
        ]),
  ];

  return (
    <Card title={title} padded={false}>
      <div className="admin-toolbar admin-toolbar-inset">
        <SearchInput value={t.search} onChange={t.setSearch} placeholder="Search trip ID (WH-01234), address, rider or driver" />
        {data ? <span className="admin-toolbar-note">{formatNumber(data.total)} rides</span> : null}
      </div>
      <DataTable
        columns={columns}
        rows={data?.items}
        rowKey={(r) => r.id}
        loading={loading}
        error={error}
        onRetry={refresh}
        empty="No rides match these filters."
        sort={t.sort}
        dir={t.dir}
        onSort={t.onSort}
        paging={data ? { offset: t.offset, limit: PAGE_SIZE, total: data.total, onChange: t.setOffset } : undefined}
      />
    </Card>
  );
}

function DriversTable({ filters }: { filters: InsightFilters }) {
  const { set } = useInsightParams();
  const t = useTableState("trips");
  const path = `/admin/insights/drivers${filtersQuery(filters, { q: t.q, sort: t.sort, dir: t.dir, limit: PAGE_SIZE, offset: t.offset })}`;
  const { data, error, loading, refresh } = useAdminData<PagedResponse<InsightDriverRow>>(path);
  const columns: Array<Column<InsightDriverRow>> = [
    { key: "name", label: "Driver", sortKey: "name", render: (d) => <Link href={`/admin/dashboard/users/${d.userId}`}>{d.name ?? "Driver"}</Link> },
    {
      key: "trips",
      label: "Trips",
      numeric: true,
      sortKey: "trips",
      title: "Click to see this driver's trips",
      render: (d) =>
        d.trips > 0 ? (
          <button type="button" className="admin-link-btn" onClick={() => set({ driverId: d.driverId, tab: "trips", status: "completed", q: null, sort: null, dir: null })}>
            {formatNumber(d.trips)}
          </button>
        ) : (
          "0"
        ),
    },
    {
      key: "online",
      label: "Hours online",
      numeric: true,
      sortKey: "onlineHours",
      title: "Time on shift in this period, in every zone and channel",
      render: (d) => (d.shifts > 0 ? <span title={`${formatNumber(d.shifts)} ${d.shifts === 1 ? "shift" : "shifts"}`}>{formatHours(d.onlineHours)}</span> : "—"),
    },
    {
      key: "perHour",
      label: "Trips / hour",
      numeric: true,
      sortKey: "tripsPerHour",
      title: "Trips for every hour on shift",
      render: (d) => (d.tripsPerOnlineHour == null ? "—" : d.tripsPerOnlineHour.toFixed(2)),
    },
    { key: "gmv", label: "GMV", numeric: true, sortKey: "gmv", render: (d) => formatNaira(d.gmvNgn) },
    { key: "earnings", label: "Earnings", numeric: true, sortKey: "earnings", render: (d) => formatNaira(d.earningsNgn) },
    { key: "commission", label: "Commission", numeric: true, sortKey: "commission", render: (d) => formatNaira(d.commissionNgn) },
    { key: "avg", label: "Average fare", numeric: true, render: (d) => money(d.avgFareNgn) },
    { key: "bids", label: "Bids", numeric: true, sortKey: "bids", render: (d) => formatNumber(d.bids) },
    { key: "won", label: "Won", numeric: true, sortKey: "bidsWon", render: (d) => formatNumber(d.bidsWon) },
    { key: "rate", label: "Win rate", numeric: true, sortKey: "winRate", render: (d) => (d.bidWinRate == null ? "—" : formatPercent(d.bidWinRate)) },
    { key: "last", label: "Last trip", sortKey: "lastTrip", render: (d) => (d.lastTripAt ? formatDateTime(d.lastTripAt) : "—") },
    { key: "lastOnline", label: "Last online", sortKey: "lastOnline", render: (d) => (d.lastOnlineAt ? formatDateTime(d.lastOnlineAt) : "—") },
  ];
  return (
    <Card padded={false}>
      <div className="admin-toolbar admin-toolbar-inset">
        <SearchInput value={t.search} onChange={t.setSearch} placeholder="Search name or phone" />
        {data ? <span className="admin-toolbar-note">{formatNumber(data.total)} drivers who were online, bid or drove in this period</span> : null}
      </div>
      <DataTable
        columns={columns}
        rows={data?.items}
        rowKey={(d) => d.driverId}
        loading={loading}
        error={error}
        onRetry={refresh}
        empty="No driver was online, bid or drove in this period."
        sort={t.sort}
        dir={t.dir}
        onSort={t.onSort}
        paging={data ? { offset: t.offset, limit: PAGE_SIZE, total: data.total, onChange: t.setOffset } : undefined}
      />
    </Card>
  );
}

function RidersTable({ filters }: { filters: InsightFilters }) {
  const { set } = useInsightParams();
  const t = useTableState("trips");
  const path = `/admin/insights/riders${filtersQuery(filters, { q: t.q, sort: t.sort, dir: t.dir, limit: PAGE_SIZE, offset: t.offset })}`;
  const { data, error, loading, refresh } = useAdminData<PagedResponse<InsightRiderRow>>(path);
  const columns: Array<Column<InsightRiderRow>> = [
    { key: "name", label: "Rider", sortKey: "name", render: (r) => <Link href={`/admin/dashboard/users/${r.riderId}`}>{r.name ?? "Rider"}</Link> },
    { key: "requests", label: "Requests", numeric: true, sortKey: "requests", render: (r) => formatNumber(r.requests) },
    {
      key: "trips",
      label: "Trips",
      numeric: true,
      sortKey: "trips",
      title: "Click to see this rider's trips",
      render: (r) =>
        r.trips > 0 ? (
          <button type="button" className="admin-link-btn" onClick={() => set({ riderId: r.riderId, tab: "trips", status: "completed", q: null, sort: null, dir: null })}>
            {formatNumber(r.trips)}
          </button>
        ) : (
          "0"
        ),
    },
    { key: "cancelled", label: "Cancelled", numeric: true, sortKey: "cancelled", render: (r) => formatNumber(r.cancelled) },
    { key: "spend", label: "Spend", numeric: true, sortKey: "spend", render: (r) => formatNaira(r.spendNgn) },
    { key: "avg", label: "Average fare", numeric: true, render: (r) => money(r.avgFareNgn) },
    { key: "channel", label: "Usual channel", render: (r) => (r.topChannel ? CHANNEL_LABEL[r.topChannel] : "—") },
    { key: "balance", label: "Wallet", numeric: true, sortKey: "balance", render: (r) => formatNaira(r.walletBalanceNgn) },
    { key: "last", label: "Last request", sortKey: "lastRequest", render: (r) => (r.lastRequestAt ? formatDateTime(r.lastRequestAt) : "—") },
  ];
  return (
    <Card padded={false}>
      <div className="admin-toolbar admin-toolbar-inset">
        <SearchInput value={t.search} onChange={t.setSearch} placeholder="Search name or phone" />
        {data ? <span className="admin-toolbar-note">{formatNumber(data.total)} riders who booked in this period</span> : null}
      </div>
      <DataTable
        columns={columns}
        rows={data?.items}
        rowKey={(r) => r.riderId}
        loading={loading}
        error={error}
        onRetry={refresh}
        empty="No rider booked in this period."
        sort={t.sort}
        dir={t.dir}
        onSort={t.onSort}
        paging={data ? { offset: t.offset, limit: PAGE_SIZE, total: data.total, onChange: t.setOffset } : undefined}
      />
    </Card>
  );
}

type Tab = "trips" | "drivers" | "riders";

/**
 * The rows behind the numbers, on Home. A KPI card links here with the tab and
 * status that make up its figure; the same filters as the cards apply.
 */
export function InsightTables({ filters }: { filters: InsightFilters }) {
  const { params, set } = useInsightParams();
  const ref = useRef<HTMLDivElement>(null);
  const tab = ((["trips", "drivers", "riders"] as const).find((x) => x === params.get("tab")) ?? "trips") as Tab;
  const status = (TRIP_STATUSES.find((s) => s.value === params.get("status"))?.value ?? "all") as TripStatusFilter;
  const paramsKey = params.toString();

  // A card links here with #rows; bring the table into view once it has rendered.
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash === "#rows") {
      ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [paramsKey]);

  const who = [params.get("driverId") ? "one driver" : null, params.get("riderId") ? "one rider" : null].filter(Boolean).join(" and ");

  return (
    <div id="rows" ref={ref} className="admin-rows-section">
      <div className="admin-toolbar">
        <FilterTabs
          options={[
            { value: "trips", label: "Trips" },
            { value: "drivers", label: "Drivers" },
            { value: "riders", label: "Riders" },
          ]}
          value={tab}
          onChange={(v) => set({ tab: v === "trips" ? null : v, sort: null, dir: null, q: null })}
        />
        {tab === "trips" ? (
          <select className="admin-select" aria-label="Which rides" value={status} onChange={(e) => set({ status: e.target.value === "all" ? null : e.target.value, sort: null, dir: null })}>
            {TRIP_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        ) : null}
        {who ? (
          <span className="admin-toolbar-note">
            Showing {who}.{" "}
            <button type="button" className="admin-link-btn" onClick={() => set({ driverId: null, riderId: null })}>Show everyone</button>
          </span>
        ) : null}
      </div>
      {tab === "trips" ? <TripsTable key={`trips-${status}`} filters={filters} status={status} /> : null}
      {tab === "drivers" ? <DriversTable filters={filters} /> : null}
      {tab === "riders" ? <RidersTable filters={filters} /> : null}
    </div>
  );
}

