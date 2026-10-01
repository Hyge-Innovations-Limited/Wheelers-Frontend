"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { DepositRow, FeeKind, FeeLedgerRow, FeesSummary, PagedResponse, WithdrawalRow } from "@/lib/admin-api";
import { adminDownload } from "@/lib/admin-api";
import { formatDateTime, formatNaira, formatNairaCompact, formatNumber, formatPercent, humanise, statusBadgeClass } from "@/lib/admin-format";
import { describeRange, filtersQuery, useInsightParams } from "@/lib/insight-filters";
import { AreaChart, BarChart, CHART_COLORS } from "@/components/admin/charts";
import { DataTable, type Column } from "@/components/admin/data-table";
import { InsightFilterBar } from "@/components/admin/insight-filter-bar";
import { TripsTable } from "@/components/admin/insight-tables";
import { useAdminData } from "@/components/admin/use-admin-data";
import { Badge, Card, ErrorState, FilterTabs, PageHeader, Pagination, RefreshButton, SectionLabel, Spinner, StatCard, StatGrid } from "@/components/admin/ui";

/**
 * What Wheelers earns and what it pays to earn it, for a period.
 *
 * Income is the 4% commission and the ₦375 service fee on each wallet ride, and
 * the ₦30 deposit fee. The ₦30 state levy is collected on each ride for Lagos
 * State, so it is shown on its own and never counted as income. Costs are
 * what the platform pays to take in deposits and to send out withdrawals.
 */

/** The ledger tabs: fee rows by kind, then the deposits and withdrawals people made. */
type LedgerTab = FeeKind | "all" | "deposits" | "withdrawals";
const KINDS: Array<{ value: LedgerTab; label: string }> = [
  { value: "all", label: "All fees" },
  { value: "ride_fee", label: "Ride fees" },
  { value: "deposit_fee", label: "Deposit fees" },
  { value: "withdrawal_fee", label: "Withdrawal fees" },
  { value: "deposits", label: "Platform deposits" },
  { value: "withdrawals", label: "Platform withdrawals" },
];

/** What each ledger row is, in the words the team uses. The provider is not named. */
const KIND_LABEL: Record<FeeKind, string> = {
  ride_fee: "Ride fee",
  deposit_fee: "Deposit fee",
  withdrawal_fee: "Withdrawal fee",
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

/** Page state for one ledger table, reset to the first page whenever the URL changes. */
function useLedgerPage() {
  const { filters, params, set } = useInsightParams();
  const sort = params.get("lsort") || "createdAt";
  const dir = (params.get("ldir") as "asc" | "desc" | null) || "desc";
  const key = params.toString();
  const [page, setPage] = useState({ key, offset: 0 });
  const offset = page.key === key ? page.offset : 0;
  const setOffset = (next: number) => setPage({ key, offset: next });
  const onSort = (s: string, d: "asc" | "desc") => set({ lsort: s, ldir: d });
  return { filters, sort, dir, offset, setOffset, onSort };
}

function FeeRows({ kind }: { kind: FeeKind | null }) {
  const t = useLedgerPage();
  const path = `/admin/fees/ledger${filtersQuery(t.filters, { kind: kind ?? undefined, sort: t.sort, dir: t.dir, limit: PAGE_SIZE, offset: t.offset })}`;
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
    { key: "service", label: "Booking fee", numeric: true, render: (r) => (r.serviceFeeNgn == null ? "" : formatNaira(r.serviceFeeNgn)) },
    { key: "levy", label: "State levy", numeric: true, render: (r) => (r.stateLevyNgn == null ? "" : formatNaira(r.stateLevyNgn)) },
    { key: "vat", label: "VAT", numeric: true, render: (r) => (r.vatNgn == null ? "" : formatNaira(r.vatNgn)) },
    { key: "ref", label: "Reference", render: (r) => <span className="mono admin-cell-ref" title={r.referenceId ?? ""}>{r.referenceId?.slice(0, 8) ?? "—"}</span> },
  ];
  return (
    <Card padded={false}>
      {data ? <div className="admin-toolbar admin-toolbar-inset"><span className="admin-toolbar-note">{formatNumber(data.total)} fee rows</span></div> : null}
      <DataTable columns={columns} rows={data?.items} rowKey={(r) => r.id} loading={loading} error={error} onRetry={refresh}
        empty="No fee rows in this period." sort={t.sort} dir={t.dir} onSort={t.onSort} />
      {data ? <Pagination offset={t.offset} limit={PAGE_SIZE} total={data.total} onChange={t.setOffset} /> : null}
    </Card>
  );
}

function DepositRows() {
  const t = useLedgerPage();
  const path = `/admin/fees/deposits${filtersQuery(t.filters, { sort: t.sort, dir: t.dir, limit: PAGE_SIZE, offset: t.offset })}`;
  const { data, error, loading, refresh } = useAdminData<PagedResponse<DepositRow>>(path);
  const columns: Array<Column<DepositRow>> = [
    { key: "when", label: "Time", sortKey: "createdAt", render: (r) => formatDateTime(r.createdAt) },
    { key: "who", label: "Wallet owner", sortKey: "name", render: (r) => <Link href={`/admin/dashboard/users/${r.userId}`}>{r.name ?? "User"}</Link> },
    { key: "sent", label: "Sent", numeric: true, render: (r) => (r.grossNgn == null ? "—" : formatNaira(r.grossNgn)) },
    { key: "fee", label: "Deposit fee", numeric: true, render: (r) => (r.feeNgn == null ? "—" : formatNaira(r.feeNgn)) },
    { key: "charge", label: "Transfer charge", numeric: true, title: "Charged on the transfer and paid by the sender", render: (r) => (r.providerFeeNgn == null ? "—" : formatNaira(r.providerFeeNgn)) },
    { key: "credited", label: "Credited", numeric: true, sortKey: "amount", render: (r) => <span className="admin-text-green">+{formatNaira(r.creditedNgn)}</span> },
    { key: "sender", label: "From", render: (r) => [r.senderName, r.senderBank].filter(Boolean).join(" · ") || "—" },
  ];
  return (
    <Card padded={false}>
      {data ? (
        <div className="admin-toolbar admin-toolbar-inset">
          <span className="admin-toolbar-note">
            {formatNumber(data.total)} deposits · {formatNaira(data.items.reduce((n, r) => n + r.creditedNgn, 0))} credited on this page
          </span>
        </div>
      ) : null}
      <DataTable columns={columns} rows={data?.items} rowKey={(r) => r.id} loading={loading} error={error} onRetry={refresh}
        empty="No deposits in this period." sort={t.sort} dir={t.dir} onSort={t.onSort} />
      {data ? <Pagination offset={t.offset} limit={PAGE_SIZE} total={data.total} onChange={t.setOffset} /> : null}
    </Card>
  );
}

function WithdrawalRows() {
  const t = useLedgerPage();
  const path = `/admin/fees/withdrawals${filtersQuery(t.filters, { sort: t.sort, dir: t.dir, limit: PAGE_SIZE, offset: t.offset })}`;
  const { data, error, loading, refresh } = useAdminData<PagedResponse<WithdrawalRow>>(path);
  const columns: Array<Column<WithdrawalRow>> = [
    { key: "when", label: "Requested", sortKey: "createdAt", render: (r) => formatDateTime(r.createdAt) },
    { key: "who", label: "Wallet owner", sortKey: "name", render: (r) => <Link href={`/admin/dashboard/users/${r.userId}`}>{r.name ?? "User"}</Link> },
    { key: "amount", label: "Amount", numeric: true, sortKey: "amount", render: (r) => <span className="admin-text-red">−{formatNaira(r.amountNgn)}</span> },
    { key: "fee", label: "Withdrawal fee", numeric: true, render: (r) => (r.feeNgn > 0 ? formatNaira(r.feeNgn) : "—") },
    { key: "sent", label: "Sent to bank", numeric: true, render: (r) => formatNaira(r.payoutNgn) },
    { key: "status", label: "Status", sortKey: "status", render: (r) => <Badge className={statusBadgeClass(r.status)}>{humanise(r.status)}</Badge> },
    { key: "cost", label: "Platform cost", numeric: true, render: (r) => (r.transferFeeNgn == null ? "—" : formatNaira(r.transferFeeNgn)) },
    { key: "to", label: "To account", render: (r) => `${r.accountName}${r.accountEnding ? ` ••${r.accountEnding}` : ""}` },
    { key: "paid", label: "Paid", render: (r) => (r.settledAt ? formatDateTime(r.settledAt) : r.failureReason ? <span className="admin-text-red" title={r.failureReason}>Failed</span> : "—") },
  ];
  return (
    <Card padded={false}>
      {data ? <div className="admin-toolbar admin-toolbar-inset"><span className="admin-toolbar-note">{formatNumber(data.total)} withdrawals requested</span></div> : null}
      <DataTable columns={columns} rows={data?.items} rowKey={(r) => r.id} loading={loading} error={error} onRetry={refresh}
        empty="No withdrawals in this period." sort={t.sort} dir={t.dir} onSort={t.onSort} />
      {data ? <Pagination offset={t.offset} limit={PAGE_SIZE} total={data.total} onChange={t.setOffset} /> : null}
    </Card>
  );
}

function FeeLedger() {
  const { filters, params, set } = useInsightParams();
  const ref = useRef<HTMLDivElement>(null);
  const raw = params.get("kind");
  // Older links named the provider-cost kinds; they now live under deposits and withdrawals.
  const tab = (raw === "deposit_provider_fee" ? "deposits" : raw === "transfer_fee" ? "withdrawals" : KINDS.find((k) => k.value === raw)?.value ?? "all") as LedgerTab;
  const key = params.toString();
  const narrowed = Boolean(filters.zone || filters.channel || filters.rideType || filters.driverId || filters.riderId);
  useEffect(() => {
    if (window.location.hash === "#ledger") ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [key]);

  return (
    <div id="ledger" ref={ref}>
      <div className="admin-toolbar">
        <FilterTabs options={KINDS} value={tab} onChange={(v) => set({ kind: v === "all" ? null : v, lsort: null, ldir: null })} />
        {narrowed && (tab === "deposits" || tab === "withdrawals") ? (
          <span className="admin-toolbar-note">Deposits and withdrawals belong to no ride, so the zone and channel filters don&apos;t apply here.</span>
        ) : null}
      </div>
      {tab === "deposits" ? <DepositRows /> : tab === "withdrawals" ? <WithdrawalRows /> : <FeeRows key={tab} kind={tab === "all" ? null : tab} />}
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
  const ledger = (kind: LedgerTab | null) => hrefWith({ kind, lsort: null, ldir: null }, "#ledger");
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
          <StatGrid cols={3}>
            <StatCard
              label="Income"
              value={formatNairaCompact(t.incomeNgn)}
              hint={change(t.incomeNgn, p.incomeNgn) ?? (narrowed ? "Commission + service fee on these trips" : "Ride, deposit and withdrawal fees")}
              tone="green"
              href={ledger(null)}
            />
            <StatCard label="Commission" value={formatNairaCompact(t.commissionNgn)} hint={`4% of the fare on ${formatNumber(t.feeRides)} trips`} href={trips()} />
            <StatCard label="Booking fee" value={formatNairaCompact(t.serviceFeeNgn)} hint="₦375 on each trip" href={trips()} />
          </StatGrid>
          <StatGrid cols={2}>
            <StatCard
              label="Deposit fees"
              value={narrowed ? "—" : formatNairaCompact(t.depositFeesNgn)}
              hint={narrowed ? notTied : `₦30 on each of ${formatNumber(t.deposits)} deposits`}
              href={narrowed ? undefined : ledger("deposit_fee")}
            />
            <StatCard
              label="Withdrawal fees"
              value={narrowed ? "—" : formatNairaCompact(t.withdrawalFeesNgn)}
              hint={narrowed ? notTied : `₦45 on each of ${formatNumber(t.feeWithdrawals)} withdrawals paid out`}
              href={narrowed ? undefined : ledger("withdrawal_fee")}
            />
          </StatGrid>

          <SectionLabel>Owed, costs and what is left</SectionLabel>
          <StatGrid>
            <StatCard label="State levy" value={formatNairaCompact(t.stateLevyNgn)} hint="₦30 per trip, owed to Lagos State: not income" tone="orange" href={trips()} />
            <StatCard label="VAT" value={formatNairaCompact(t.vatNgn ?? 0)} hint="7.5% of each driver's share (fare after the booking fee), owed: not income" tone="orange" href={trips()} />
            <StatCard
              label="Platform costs"
              value={narrowed ? "—" : formatNairaCompact(t.costsNgn)}
              hint={narrowed ? notTied : `${formatNaira(t.depositProviderCostNgn)} on deposits · ${formatNaira(t.transferCostNgn)} on ${formatNumber(t.transfers)} withdrawals`}
              tone="red"
              href={narrowed ? undefined : ledger(null)}
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
                data={data.points.map((pt) => ({ label: bucketLabel(pt.bucket, bucket), values: [pt.commissionNgn, pt.serviceFeeNgn, pt.depositFeesNgn + (pt.withdrawalFeesNgn ?? 0)] }))}
                series={[
                  { name: "Commission", color: CHART_COLORS.ORANGE },
                  { name: "Booking fee", color: CHART_COLORS.GREEN },
                  { name: "Deposit and withdrawal fees", color: CHART_COLORS.MUTED },
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

      <SectionLabel>Ledger</SectionLabel>
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
