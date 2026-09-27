"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import type { FeeKind, FeeLedgerRow, FeesSummary, PagedResponse } from "@/lib/admin-api";
import { adminDownload } from "@/lib/admin-api";
import { formatDateTime, formatNaira, formatNairaCompact, formatNumber, formatPercent } from "@/lib/admin-format";
import { describeRange, filtersQuery, useInsightParams } from "@/lib/insight-filters";
import { AreaChart, BarChart, CHART_COLORS } from "@/components/admin/charts";
import { DataTable, type Column } from "@/components/admin/data-table";
import { InsightFilterBar } from "@/components/admin/insight-filter-bar";
import { TripsTable } from "@/components/admin/insight-tables";
import { useAdminData } from "@/components/admin/use-admin-data";
import { Card, ErrorState, FilterTabs, PageHeader, Pagination, RefreshButton, SectionLabel, Spinner, StatCard, StatGrid } from "@/components/admin/ui";

/**
 * What Wheelers earns and what it pays to earn it, for a period.
 *
 * Income is the 4% commission and the ₦375 service fee on each wallet ride, and
 * the ₦30 deposit fee. The ₦30 state levy is collected on each ride for Lagos
 * State, so it is shown on its own and never counted as income. Costs are
 * what the platform pays to take in deposits and to send out withdrawals.
 */

const KINDS: Array<{ value: FeeKind | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "ride_fee", label: "Ride fees" },
  { value: "deposit_fee", label: "Deposit fees" },
  { value: "deposit_provider_fee", label: "Platform deposits" },
  { value: "transfer_fee", label: "Platform withdrawals" },
];

/** What each ledger row is, in the words the team uses. The provider is not named. */
const KIND_LABEL: Record<FeeKind, string> = {
  ride_fee: "Ride fee",
  deposit_fee: "Deposit fee",
  deposit_provider_fee: "Platform deposit cost",
  transfer_fee: "Platform withdrawal cost",
  provider_fee: "Other platform cost",
};

const PAGE_SIZE = 25;

const bucketLabel = (bucket: string, kind: string) => {
  if (kind === "month") return new Date(`${bucket}T12:00:00Z`).toLocaleDateString("en-NG", { month: "short", year: "2-digit" });
  const short = bucket.slice(5).replace("-", "/");
  return kind === "week" ? `wk ${short}` : short;
};

function change(now: number, before: number): string | null {
  if (!before) return null;
  const c = (now - before) / Math.abs(before);
  return `${c >= 0 ? "▲" : "▼"} ${formatPercent(Math.abs(c), 0)} on the previous period`;
}

function FeeLedger() {
  const { filters, params, set } = useInsightParams();
  const ref = useRef<HTMLDivElement>(null);
  const kind = (KINDS.find((k) => k.value === params.get("kind"))?.value ?? "all") as FeeKind | "all";
  const sort = params.get("lsort") || "createdAt";
  const dir = (params.get("ldir") as "asc" | "desc" | null) || "desc";
  const key = params.toString();
  const [page, setPage] = useState({ key, offset: 0 });
  const offset = page.key === key ? page.offset : 0;
  const setOffset = (next: number) => setPage({ key, offset: next });
  useEffect(() => {
    if (window.location.hash === "#ledger") ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [key]);

  const path = `/admin/fees/ledger${filtersQuery(filters, { kind: kind === "all" ? undefined : kind, sort, dir, limit: PAGE_SIZE, offset })}`;
  const { data, error, loading, refresh } = useAdminData<PagedResponse<FeeLedgerRow>>(path);
  const columns: Array<Column<FeeLedgerRow>> = [
    { key: "when", label: "Time", sortKey: "createdAt", render: (r) => formatDateTime(r.createdAt) },
    { key: "kind", label: "Kind", sortKey: "kind", render: (r) => KIND_LABEL[r.kind] ?? r.label },
    {
      key: "amount",
      label: "Amount",
      numeric: true,
      sortKey: "amount",
      render: (r) => <span className={r.direction === "DEBIT" ? "admin-text-red" : "admin-text-green"}>{r.direction === "DEBIT" ? "−" : "+"}{formatNaira(r.amountNgn)}</span>,
    },
    { key: "commission", label: "Commission", numeric: true, render: (r) => (r.commissionNgn == null ? "" : formatNaira(r.commissionNgn)) },
    { key: "service", label: "Service fee", numeric: true, render: (r) => (r.serviceFeeNgn == null ? "" : formatNaira(r.serviceFeeNgn)) },
    { key: "levy", label: "State levy", numeric: true, render: (r) => (r.stateLevyNgn == null ? "" : formatNaira(r.stateLevyNgn)) },
    { key: "ref", label: "Reference", render: (r) => <span className="mono admin-cell-ref" title={r.referenceId ?? ""}>{r.referenceId?.slice(0, 8) ?? "—"}</span> },
  ];
  return (
    <div id="ledger" ref={ref}>
      <div className="admin-toolbar">
        <FilterTabs options={KINDS} value={kind} onChange={(v) => set({ kind: v === "all" ? null : v })} />
        {data ? <span className="admin-toolbar-note">{formatNumber(data.total)} ledger rows</span> : null}
      </div>
      <Card padded={false}>
        <DataTable
          columns={columns}
          rows={data?.items}
          rowKey={(r) => r.id}
          loading={loading}
          error={error}
          onRetry={refresh}
          empty="No fee rows in this period."
          sort={sort}
          dir={dir}
          onSort={(s, d) => set({ lsort: s, ldir: d })}
        />
        {data ? <Pagination offset={offset} limit={PAGE_SIZE} total={data.total} onChange={setOffset} /> : null}
      </Card>
    </div>
  );
}

function FeesBody() {
  const { filters, bucket, hrefWith } = useInsightParams();
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const { data, error, loading, refresh } = useAdminData<FeesSummary>(`/admin/fees/summary${filtersQuery(filters, { bucket })}`, [], { refreshMs: 60_000 });
  const t = data?.totals;
  const p = data?.previousTotals;
  // Deposits and withdrawals belong to no ride, so a channel or zone view has none of them.
  const narrowed = data?.rideFiltersApplied ?? false;
  const notTied = "Not tied to a ride, so not in a channel or zone view. Clear the filters to include it.";
  const ledger = (kind: FeeKind | null) => hrefWith({ kind }, "#ledger");
  const trips = () => hrefWith({}, "#trips");

  const download = async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      await adminDownload(`/admin/insights/export${filtersQuery(filters, { scope: "fees", bucket })}`, `wheelers-fees-${filters.from}-to-${filters.to}.xlsx`);
    } catch (e) {
      setDownloadError(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Fees"
        subtitle={describeRange(filters.from, filters.to)}
        actions={
          <div className="admin-header-actions">
            <button type="button" className="admin-btn-ghost" onClick={() => void download()} disabled={downloading}>
              {downloading ? "Preparing Excel…" : "Download Excel"}
            </button>
            <RefreshButton busy={loading} onClick={refresh} />
          </div>
        }
      />
      {downloadError ? <div className="admin-inline-error">{downloadError}</div> : null}
      <InsightFilterBar showRideType={false} />

      {error ? (
        <ErrorState error={error} onRetry={refresh} />
      ) : !data || !t || !p ? (
        <Spinner label="Loading fees…" />
      ) : (
        <>
          <SectionLabel>Income</SectionLabel>
          <StatGrid>
            <StatCard
              label="Income"
              value={formatNairaCompact(t.incomeNgn)}
              hint={change(t.incomeNgn, p.incomeNgn) ?? (narrowed ? "Commission + service fee on these trips" : "Commission + service fee + deposit fees")}
              tone="green"
              href={ledger(null)}
            />
            <StatCard label="Commission" value={formatNairaCompact(t.commissionNgn)} hint={`4% of the fare on ${formatNumber(t.feeRides)} trips`} href={trips()} />
            <StatCard label="Service fee" value={formatNairaCompact(t.serviceFeeNgn)} hint="₦375 on each trip" href={trips()} />
            <StatCard
              label="Deposit fees"
              value={narrowed ? "—" : formatNairaCompact(t.depositFeesNgn)}
              hint={narrowed ? notTied : `₦30 on each of ${formatNumber(t.deposits)} deposits`}
              href={narrowed ? undefined : ledger("deposit_fee")}
            />
          </StatGrid>

          <SectionLabel>Owed, costs and what is left</SectionLabel>
          <StatGrid>
            <StatCard label="State levy" value={formatNairaCompact(t.stateLevyNgn)} hint="₦30 per trip, owed to Lagos State: not income" tone="orange" href={trips()} />
            <StatCard
              label="Platform costs"
              value={narrowed ? "—" : formatNairaCompact(t.costsNgn)}
              hint={narrowed ? notTied : `${formatNaira(t.depositProviderCostNgn)} on deposits · ${formatNaira(t.transferCostNgn)} on ${formatNumber(t.transfers)} withdrawals`}
              tone="red"
              href={narrowed ? undefined : ledger("transfer_fee")}
            />
            <StatCard
              label="Net"
              value={formatNairaCompact(t.netNgn)}
              hint={change(t.netNgn, p.netNgn) ?? (narrowed ? "Fees on these trips; no platform costs apply" : "Income minus costs")}
              tone="green"
              href={ledger(null)}
            />
            <StatCard label="Platform wallet" value={formatNairaCompact(data.platformWalletNgn)} hint="Fees collected and held, now" />
          </StatGrid>
          {t.estimatedCommissionNgn > 0 ? (
            <p className="admin-footnote">
              {formatNaira(t.estimatedCommissionNgn)} of the commission is from trips settled before the split was recorded; their split
              was reconstructed from the rates in force then, and is marked est. in the trips table.
            </p>
          ) : null}

          <div className="admin-two-col">
            <Card title="Income" padded>
              <BarChart
                height={220}
                data={data.points.map((pt) => ({ label: bucketLabel(pt.bucket, bucket), values: [pt.commissionNgn, pt.serviceFeeNgn, pt.depositFeesNgn] }))}
                series={[
                  { name: "Commission", color: CHART_COLORS.ORANGE },
                  { name: "Service fee", color: CHART_COLORS.GREEN },
                  { name: "Deposit fees", color: CHART_COLORS.MUTED },
                ]}
                formatValue={(n) => formatNairaCompact(n)}
              />
            </Card>
            <Card title="Net" padded>
              <AreaChart
                height={220}
                color={CHART_COLORS.GREEN}
                data={data.points.map((pt) => ({ label: bucketLabel(pt.bucket, bucket), value: pt.netNgn }))}
                formatValue={(n) => formatNairaCompact(n)}
              />
            </Card>
          </div>
        </>
      )}

      <SectionLabel>Fees on each trip</SectionLabel>
      <div id="trips">
        <TripsTable filters={filters} status="completed" feeColumns />
      </div>

      <SectionLabel>Fee ledger</SectionLabel>
      <FeeLedger />
    </>
  );
}

export default function FeesPage() {
  return (
    <Suspense fallback={<Spinner label="Loading fees…" />}>
      <FeesBody />
    </Suspense>
  );
}
