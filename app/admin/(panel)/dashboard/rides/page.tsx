"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { AdminRideRow, PagedResponse } from "@/lib/admin-api";
import { buildQuery } from "@/lib/admin-api";
import {
  formatDateTime,
  formatDistance,
  formatDuration,
  formatNaira,
  formatNumber,
  humanise,
  statusBadgeClass,
} from "@/lib/admin-format";
import { useAdminData, useDebounced } from "@/components/admin/use-admin-data";
import {
  EmptyState,
  ErrorState,
  Pagination,
  PageHeader,
  SearchInput,
  Spinner,
  TableWrap,
} from "@/components/admin/ui";

const STATUSES = [
  "all",
  "COMPLETED",
  "CANCELLED",
  "IN_PROGRESS",
  "DRIVER_ASSIGNED",
  "DRIVER_EN_ROUTE",
  "ARRIVED",
  "REQUESTED",
  "MATCHING",
  "DISPUTED",
];

const PAGE_SIZE = 25;

function RidesTable() {
  const params = useSearchParams();
  const [status, setStatus] = useState(params.get("status") ?? "all");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const query = useDebounced(search);

  useEffect(() => {
    setOffset(0);
  }, [query, status]);

  const path = `/admin/rides${buildQuery({ status, q: query, limit: PAGE_SIZE, offset })}`;
  // Rides is the page an operator watches during a shift, so it re-reads
  // itself rather than going stale behind them.
  const { data, error, loading, refresh } = useAdminData<PagedResponse<AdminRideRow>>(
    path,
    [],
    { refreshMs: 20_000 },
  );

  return (
    <>
      <PageHeader
        title="Rides"
        subtitle={data ? `${formatNumber(data.total)} matching rides` : "Every request, matched or not"}
      />

      <div className="admin-toolbar">
        <SearchInput value={search} onChange={setSearch} placeholder="Search pickup, destination or ride id…" />
        <select className="admin-select" value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s === "all" ? "All statuses" : humanise(s)}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={refresh} />
      ) : loading && !data ? (
        <Spinner label="Loading rides…" />
      ) : !data || data.items.length === 0 ? (
        <EmptyState>No rides match this filter.</EmptyState>
      ) : (
        <>
          <TableWrap>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Status</th>
                  <th>Rider</th>
                  <th>Driver</th>
                  <th>Route</th>
                  <th className="num">Distance</th>
                  <th className="num">Fare</th>
                  <th className="num">Platform fee</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <span className="admin-stack">
                        <span>{formatDateTime(r.createdAt)}</span>
                        {r.durationSeconds ? <em>{formatDuration(r.durationSeconds)}</em> : null}
                      </span>
                    </td>
                    <td>
                      <span className={statusBadgeClass(r.status)}>{humanise(r.status)}</span>
                      {r.cancelReason ? <em className="admin-sub">{r.cancelReason}</em> : null}
                    </td>
                    <td>
                      <Link href={`/admin/dashboard/users/${r.riderId}`} className="admin-user-link">
                        {r.riderName ?? r.riderPhone ?? "Unknown"}
                      </Link>
                    </td>
                    <td>{r.driverName ?? <em className="admin-sub">unmatched</em>}</td>
                    <td>
                      <span className="admin-route">
                        <span title={r.pickupAddress}>{r.pickupAddress}</span>
                        <em title={r.destAddress}>→ {r.destAddress}</em>
                      </span>
                    </td>
                    <td className="num">{formatDistance(r.distanceKm)}</td>
                    <td className="num">
                      {r.fareFinalNgn ? (
                        formatNaira(r.fareFinalNgn)
                      ) : r.fareEstimateNgn ? (
                        <em className="admin-sub">{formatNaira(r.fareEstimateNgn)} est.</em>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="num">{r.platformFeeNgn ? formatNaira(r.platformFeeNgn) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>

          <Pagination offset={offset} limit={PAGE_SIZE} total={data.total} onChange={setOffset} />
        </>
      )}
    </>
  );
}

export default function RidesPage() {
  return (
    <Suspense fallback={<Spinner label="Loading rides…" />}>
      <RidesTable />
    </Suspense>
  );
}
