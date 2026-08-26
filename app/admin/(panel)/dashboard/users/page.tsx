"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { AdminUserRow, PagedResponse } from "@/lib/admin-api";
import { buildQuery } from "@/lib/admin-api";
import {
  displayName,
  formatDate,
  formatNaira,
  formatNumber,
  formatWhen,
  humanise,
  initialsOf,
  statusBadgeClass,
} from "@/lib/admin-format";
import { useAdminData, useDebounced } from "@/components/admin/use-admin-data";
import {
  EmptyState,
  ErrorState,
  FilterTabs,
  Pagination,
  PageHeader,
  SearchInput,
  Spinner,
  TableWrap,
} from "@/components/admin/ui";

type Role = "all" | "rider" | "driver";
type Sort = "recent" | "rides" | "spend" | "name";

const SORTS: Array<{ value: Sort; label: string }> = [
  { value: "recent", label: "Newest" },
  { value: "rides", label: "Most rides" },
  { value: "spend", label: "Highest value" },
  { value: "name", label: "Name A–Z" },
];

const PAGE_SIZE = 25;

function UsersDirectory() {
  const router = useRouter();
  const params = useSearchParams();

  const [role, setRole] = useState<Role>((params.get("role") as Role) || "all");
  const [sort, setSort] = useState<Sort>((params.get("sort") as Sort) || "recent");
  const [search, setSearch] = useState(params.get("q") ?? "");
  const [offset, setOffset] = useState(0);
  const query = useDebounced(search);

  // Searching or refiltering should start from page one, not page seven.
  useEffect(() => {
    setOffset(0);
  }, [query, role, sort]);

  // Keep the URL shareable so an operator can send a filtered view to someone.
  useEffect(() => {
    const qs = buildQuery({
      role: role === "all" ? undefined : role,
      sort: sort === "recent" ? undefined : sort,
      q: query || undefined,
    });
    router.replace(`/admin/dashboard/users${qs}`, { scroll: false });
  }, [role, sort, query, router]);

  const path = `/admin/users${buildQuery({ role, sort, q: query, limit: PAGE_SIZE, offset })}`;
  const { data, error, loading, refresh } = useAdminData<PagedResponse<AdminUserRow>>(path);

  return (
    <>
      <PageHeader
        title="Users"
        subtitle={
          data
            ? `${formatNumber(data.total)} ${role === "all" ? "people" : role === "driver" ? "drivers" : "riders"}`
            : "Everyone on Wheelers"
        }
      />

      <div className="admin-toolbar">
        <SearchInput value={search} onChange={setSearch} placeholder="Search name, phone, email or username…" />
        <FilterTabs<Role>
          value={role}
          onChange={setRole}
          options={[
            { value: "all", label: "Everyone" },
            { value: "rider", label: "Riders" },
            { value: "driver", label: "Drivers" },
          ]}
        />
        <select className="admin-select" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={refresh} />
      ) : loading && !data ? (
        <Spinner label="Loading users…" />
      ) : !data || data.items.length === 0 ? (
        <EmptyState>
          {query ? `No users match “${query}”.` : "No users yet."}
        </EmptyState>
      ) : (
        <>
          <TableWrap>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>WhatsApp / contact</th>
                  <th>Role</th>
                  <th className="num">Rides</th>
                  <th className="num">{role === "driver" ? "Earned" : "Spent"}</th>
                  <th className="num">Wallet</th>
                  <th>Joined</th>
                  <th>Last ride</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((u) => (
                  <tr key={u.id} className="admin-row-link">
                    <td>
                      <Link href={`/admin/dashboard/users/${u.id}`} className="admin-user-cell">
                        <span className="admin-avatar sm">{initialsOf(u.name, "?")}</span>
                        <span className="admin-user-cell-text">
                          <strong>{displayName(u)}</strong>
                          {u.vehicle ? <em>{u.vehicle}</em> : u.username ? <em>@{u.username}</em> : null}
                        </span>
                      </Link>
                    </td>
                    <td>
                      {/* Most riders arrive through WhatsApp and never set an
                          email, so the number is the identity — lead with it. */}
                      <span className="admin-stack">
                        <span className="admin-phone">{u.phone ?? "No number"}</span>
                        {u.email ? <em>{u.email}</em> : <em>WhatsApp only</em>}
                      </span>
                    </td>
                    <td>
                      {u.isDriver ? (
                        <span className="admin-stack">
                          <span className={statusBadgeClass(u.driverStatus)}>{humanise(u.driverStatus)}</span>
                          <em>KYC {humanise(u.driverKycStatus)}</em>
                        </span>
                      ) : (
                        <span className={statusBadgeClass(u.riderKycStatus === "VERIFIED" ? "VERIFIED" : "")}>
                          {u.riderKycStatus === "VERIFIED" ? "Verified rider" : "Rider"}
                        </span>
                      )}
                    </td>
                    <td className="num">
                      {u.isDriver ? (
                        <>
                          {formatNumber(u.driverTotalRides ?? 0)}
                          {u.driverRating ? <em className="admin-sub"> ★ {u.driverRating.toFixed(1)}</em> : null}
                        </>
                      ) : (
                        <>
                          {formatNumber(u.ridesCompleted)}
                          {u.ridesCancelled > 0 ? (
                            <em className="admin-sub"> · {formatNumber(u.ridesCancelled)} cancelled</em>
                          ) : null}
                        </>
                      )}
                    </td>
                    <td className="num">
                      {u.isDriver ? formatNaira(u.driverEarningsNgn ?? 0) : formatNaira(u.totalSpentNgn)}
                    </td>
                    <td className="num">{formatNaira(u.walletBalanceNgn)}</td>
                    <td>{formatDate(u.createdAt)}</td>
                    <td>{u.lastRideAt ? formatWhen(u.lastRideAt) : "—"}</td>
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

export default function UsersPage() {
  return (
    <Suspense fallback={<Spinner label="Loading users…" />}>
      <UsersDirectory />
    </Suspense>
  );
}
