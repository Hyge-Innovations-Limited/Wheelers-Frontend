"use client";

import type { AdminStellarTransfer } from "@/lib/admin-api";
import { formatDateTime, formatNaira, humanise, statusBadgeClass } from "@/lib/admin-format";
import { EmptyState, TableWrap } from "@/components/admin/ui";

const TRANSFER_LABEL: Record<string, string> = {
  ACCOUNT_OPEN: "Account opened",
  TOPUP: "Top-up",
  FARE: "Trip fare",
  COMMISSION: "Commission",
  WITHDRAWAL: "Driver withdrawal",
};

function shortKey(key: string): string {
  return key.length > 14 ? `${key.slice(0, 6)}…${key.slice(-6)}` : key;
}

/** Stellar TESTNET transfers, each with a link to stellar.expert. Public addresses only. */
export function StellarTable({ transfers }: { transfers: AdminStellarTransfer[] }) {
  if (!transfers.length) return <EmptyState>No Stellar transfers.</EmptyState>;
  return (
    <TableWrap>
      <table className="admin-table">
        <thead>
          <tr>
            <th>When</th>
            <th>Kind</th>
            <th className="num">XLM</th>
            <th className="num">Naira value</th>
            <th>Status</th>
            <th>From → To</th>
            <th>Transaction</th>
          </tr>
        </thead>
        <tbody>
          {transfers.map((t, i) => (
            <tr key={t.id ?? `${t.kind}-${i}`}>
              <td>{formatDateTime(t.createdAt)}</td>
              <td>{TRANSFER_LABEL[t.kind] ?? humanise(t.kind)}{t.memo && t.kind !== "TOPUP" ? <span className="admin-sub"> · {t.memo}</span> : null}</td>
              <td className="num mono">{t.amountXlm}</td>
              <td className="num">{t.amountNgn == null ? "—" : formatNaira(t.amountNgn)}</td>
              <td>
                <span className={statusBadgeClass(t.status === "CONFIRMED" ? "COMPLETED" : t.status === "FAILED" ? "FAILED" : "PENDING")}>{humanise(t.status)}</span>
                {t.note ? <span className="admin-sub"> {t.note}</span> : null}
              </td>
              <td className="mono">{shortKey(t.from)} → {shortKey(t.to)}</td>
              <td>
                {t.explorerUrl ? (
                  <a href={t.explorerUrl} target="_blank" rel="noreferrer" className="admin-user-link mono">
                    {t.txHash?.slice(0, 10)}… ↗
                  </a>
                ) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableWrap>
  );
}

