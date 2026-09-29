"use client";

import { useState } from "react";
import type { AdminStellarView } from "@/lib/admin-api";
import { buildQuery } from "@/lib/admin-api";
import { formatNaira, humanise } from "@/lib/admin-format";
import { useAdminData } from "@/components/admin/use-admin-data";
import { Card, EmptyState, ErrorState, PageHeader, Spinner, StatCard, StatGrid } from "@/components/admin/ui";
import { StellarTable } from "@/components/admin/stellar-table";

const KINDS = ["", "ACCOUNT_OPEN", "TOPUP", "FARE", "COMMISSION", "WITHDRAWAL"];
const KIND_LABEL: Record<string, string> = { "": "All", ACCOUNT_OPEN: "Accounts opened", TOPUP: "Top-ups", FARE: "Trip fares", COMMISSION: "Commission", WITHDRAWAL: "Withdrawals" };

/**
 * Stellar TESTNET (grant deliverable 3): Wheelers' operations account and
 * every transfer mirrored on testnet, with stellar.expert links as evidence.
 * Test XLM only; public addresses only.
 */
export default function StellarPage() {
  const [kind, setKind] = useState("");
  const { data, error, loading, refresh } = useAdminData<AdminStellarView>(
    `/admin/stellar${buildQuery({ kind: kind || undefined, limit: 100 })}`,
    [kind],
    { refreshMs: 20_000 },
  );

  if (loading && !data) return <Spinner label="Loading Stellar…" />;
  if (error) return <ErrorState error={error} onRetry={refresh} />;
  if (!data) return null;
  if (!data.enabled) {
    return (
      <>
        <PageHeader title="Stellar Testnet" />
        <EmptyState>Stellar is switched off on the server (STELLAR_ENABLED).</EmptyState>
      </>
    );
  }

  const confirmed = (k: string) => (data.counts ?? []).filter((c) => c.kind === k && c.status === "CONFIRMED").reduce((n, c) => n + c.count, 0);
  const waiting = (data.counts ?? []).filter((c) => c.status === "PENDING" || c.status === "SUBMITTED").reduce((n, c) => n + c.count, 0);
  const failed = (data.counts ?? []).filter((c) => c.status === "FAILED").reduce((n, c) => n + c.count, 0);

  return (
    <>
      <PageHeader
        title="Stellar Testnet"
        subtitle={`Every fare, commission, top-up and driver withdrawal, mirrored on the Stellar test network at ₦${(data.ngnPerXlm ?? 1000).toLocaleString("en-NG")} = 1 XLM. Test XLM has no value.`}
      />

      {data.operations ? (
        <Card title="Wheelers operations account" right={<a href={data.operations.explorerUrl} target="_blank" rel="noreferrer" className="admin-user-link">View on stellar.expert ↗</a>}>
          <p className="mono">{data.operations.publicKey}</p>
          <p className="admin-sub">Balance {Number(data.operations.balanceXlm).toLocaleString("en-NG", { maximumFractionDigits: 4 })} XLM · collects commission and pays every transaction fee</p>
        </Card>
      ) : null}

      <StatGrid cols={4}>
        <StatCard label="Trip fares" value={String(confirmed("FARE"))} />
        <StatCard label="Commission transfers" value={String(confirmed("COMMISSION"))} />
        <StatCard label="Accounts opened" value={String(confirmed("ACCOUNT_OPEN"))} />
        <StatCard label="Waiting / failed" value={`${waiting} / ${failed}`} />
      </StatGrid>

      <Card
        title="Transfers"
        padded={false}
        right={
          <select value={kind} onChange={(e) => setKind(e.target.value)} className="admin-select">
            {KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k] ?? humanise(k)}</option>)}
          </select>
        }>
        <StellarTable transfers={data.transfers ?? []} />
      </Card>
      <p className="admin-sub">Amounts in naira use the demo rate. {formatNaira(data.ngnPerXlm ?? 1000)} = 1 XLM.</p>
    </>
  );
}
