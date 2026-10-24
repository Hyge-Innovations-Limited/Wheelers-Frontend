"use client";

import Link from "next/link";
import { useState } from "react";
import { BarChart, CHART_COLORS } from "@/components/admin/charts";
import { useAdminData, useDebounced } from "@/components/admin/use-admin-data";
import { displayName, formatDate, formatDateTime, formatNaira, formatNumber, formatPercent } from "@/lib/admin-format";
import {
  Card,
  EmptyState,
  ErrorState,
  FilterTabs,
  PageHeader,
  Pagination,
  RefreshButton,
  SearchInput,
  SectionLabel,
  Spinner,
  StatCard,
  StatGrid,
  TableWrap,
} from "@/components/admin/ui";

type Status = "PENDING" | "QUALIFIED_RIDE" | "EXPIRED_NO_RIDE" | "CLOSED";
type Person = { id: string; name: string | null; phone: string | null };

type Referrals = {
  from: string;
  to: string;
  rules: { rideRewardNgn: number; noRideRewardNgn: number; rideWithinDays: number; cashbackUnusedDays: number };
  summary: {
    referred: number; referrers: number; rode: number; noRide: number; waiting: number; closed: number;
    rodeRate: number | null; avgDaysToFirstRide: number | null; codes: number; codesInPeriod: number; referrersEver: number;
  };
  cashback: {
    earnedNgn: number; earnedForRidesNgn: number; earnedNoRideNgn: number; spentNgn: number;
    availableNgn: number; peopleWithCashback: number; frozenNgn: number;
  };
  byDay: Array<{ day: string; referred: number; rode: number }>;
  topReferrers: Array<{ userId: string; name: string | null; phone: string | null; code: string | null; referred: number; rode: number; waiting: number; earnedNgn: number; lastReferredAt: string }>;
  referrals: {
    total: number;
    limit: number;
    offset: number;
    rows: Array<{
      id: string; code: string; status: Status; appliedAt: string; expiresAt: string; qualifiedAt: string | null;
      referrer: Person; referred: Person;
      firstRide: { id: string; tripNumber: number; completedAt: string | null; fareNgn: number | null } | null;
      friendTrips: number;
      cashback: { amountNgn: number; status: string } | null;
    }>;
  };
};

const STATUS_WORDS: Record<Status, { label: string; badge: string }> = {
  PENDING: { label: "Waiting for a ride", badge: "admin-badge orange" },
  QUALIFIED_RIDE: { label: "Rode", badge: "admin-badge green" },
  EXPIRED_NO_RIDE: { label: "No ride in time", badge: "admin-badge gray" },
  CLOSED: { label: "Closed", badge: "admin-badge gray" },
};

const CASHBACK_WORDS: Record<string, string> = { AVAILABLE: "to spend", FROZEN: "frozen", USED: "spent", EXPIRED: "expired" };

const LIMIT = 50;
const lagosDay = (offsetDays = 0) => new Date(Date.now() + 3600_000 - offsetDays * 86_400_000).toISOString().slice(0, 10);
const tripId = (n: number) => `WH-${String(n).padStart(5, "0")}`;

function Who({ person }: { person: Person }) {
  return (
    <>
      <Link href={`/admin/dashboard/users/${person.id}`} className="admin-user-link">{displayName(person)}</Link>
      {person.name && person.phone ? <span className="admin-sub">{person.phone}</span> : null}
    </>
  );
}

/**
 * Referrals: who brought whom, whether the friend rode, and the cashback it
 * earned the person who brought them. The period counts a referral on the day
 * the friend used the code.
 */
export default function ReferralsPage() {
  const [from, setFrom] = useState(() => lagosDay(29));
  const [to, setTo] = useState(() => lagosDay(0));
  const [status, setStatus] = useState<"" | Status>("");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const q = useDebounced(search.trim());

  const params = new URLSearchParams({ from, to, limit: String(LIMIT), offset: String(offset) });
  if (status) params.set("status", status);
  if (q) params.set("q", q);
  const { data, error, loading, refresh } = useAdminData<Referrals>(`/admin/referrals?${params}`, [from, to, status, q, offset]);

  // A new filter starts the list from the top.
  const changed = <T,>(set: (value: T) => void) => (value: T) => { set(value); setOffset(0); };

  const s = data?.summary;
  const c = data?.cashback;
  const rules = data?.rules;

  return (
    <>
      <PageHeader
        title="Referrals"
        subtitle={rules
          ? `A friend who rides within ${rules.rideWithinDays} days earns the person who brought them ${formatNaira(rules.rideRewardNgn)} cashback; ${formatNaira(rules.noRideRewardNgn)} if they don't. Cashback unused for ${rules.cashbackUnusedDays} days is frozen until the next friend joins.`
          : "Who brought whom, and what it earned them"}
        actions={<RefreshButton busy={loading} onClick={refresh} />}
      />

      <div className="admin-card" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end", padding: 14 }}>
        <label style={{ display: "grid", gap: 4, fontSize: 12.5, color: "#786F68" }}>
          From
          <input type="date" value={from} max={to} onChange={(e) => { const day = e.target.value; if (!day) return; setFrom(day); if (day > to) setTo(day); setOffset(0); }} className="admin-input" />
        </label>
        <label style={{ display: "grid", gap: 4, fontSize: 12.5, color: "#786F68" }}>
          To
          <input type="date" value={to} min={from} onChange={(e) => { const day = e.target.value; if (!day) return; setTo(day); if (day < from) setFrom(day); setOffset(0); }} className="admin-input" />
        </label>
      </div>

      {error && !data ? <ErrorState error={error} onRetry={refresh} /> : null}
      {!data && !error ? <Spinner label="Loading referrals…" /> : null}

      {data && s && c ? (
        <>
          <StatGrid>
            <StatCard label="Friends referred" value={formatNumber(s.referred)} hint={`by ${formatNumber(s.referrers)} ${s.referrers === 1 ? "person" : "people"} · ${formatNumber(s.codesInPeriod)} new codes`} />
            <StatCard
              label={`Rode within ${data.rules.rideWithinDays} days`}
              value={formatNumber(s.rode)}
              tone="green"
              hint={s.rodeRate === null ? "None whose time is up yet" : `${formatPercent(s.rodeRate)} of friends whose ${data.rules.rideWithinDays} days are up`}
            />
            <StatCard label="Still waiting" value={formatNumber(s.waiting)} tone="orange" hint={`${formatNumber(s.noRide)} didn't ride in time`} />
            <StatCard label="Days to the first ride" value={s.avgDaysToFirstRide === null ? "—" : s.avgDaysToFirstRide.toFixed(1)} hint="on average, after using the code" />
          </StatGrid>

          <StatGrid>
            <StatCard label="Cashback given" value={formatNaira(c.earnedNgn)} hint={`${formatNaira(c.earnedForRidesNgn)} for rides · ${formatNaira(c.earnedNoRideNgn)} for no ride`} />
            <StatCard label="Cashback spent on rides" value={formatNaira(c.spentNgn)} hint="in this period" />
            <StatCard label="Waiting to be spent" value={formatNaira(c.availableNgn)} tone="green" hint={`${formatNumber(c.peopleWithCashback)} ${c.peopleWithCashback === 1 ? "person has" : "people have"} some, today`} />
            <StatCard label="Frozen" value={formatNaira(c.frozenNgn)} hint="unused; a new friend unfreezes it" />
          </StatGrid>

          <Card title="Each day" padded>
            <BarChart
              height={200}
              data={data.byDay.map((d) => ({ label: d.day.slice(5), values: [d.referred, d.rode] }))}
              series={[
                { name: "Friends referred", color: CHART_COLORS.MUTED },
                { name: "First rides", color: CHART_COLORS.ORANGE },
              ]}
            />
          </Card>

          <SectionLabel right={<span className="admin-sub">{formatNumber(s.referrersEver)} people have ever referred · {formatNumber(s.codes)} codes</span>}>Top referrers</SectionLabel>
          <Card>
            {data.topReferrers.length === 0 ? (
              <EmptyState>Nobody used a referral code in this period.</EmptyState>
            ) : (
              <TableWrap>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Person</th>
                      <th>Code</th>
                      <th className="num">Friends</th>
                      <th className="num">Rode</th>
                      <th className="num">Waiting</th>
                      <th className="num">Cashback</th>
                      <th>Last friend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topReferrers.map((t) => (
                      <tr key={t.userId}>
                        <td><Who person={{ id: t.userId, name: t.name, phone: t.phone }} /></td>
                        <td><code>{t.code ?? "—"}</code></td>
                        <td className="num"><strong>{formatNumber(t.referred)}</strong></td>
                        <td className="num">{formatNumber(t.rode)}</td>
                        <td className="num">{formatNumber(t.waiting)}</td>
                        <td className="num">{formatNaira(t.earnedNgn)}</td>
                        <td>{formatDate(t.lastReferredAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </Card>

          <SectionLabel>Every referral</SectionLabel>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
            <SearchInput value={search} onChange={changed(setSearch)} placeholder="Name, phone or code" />
            <FilterTabs
              value={status}
              onChange={changed(setStatus)}
              options={[
                { value: "", label: "All" },
                { value: "PENDING", label: "Waiting" },
                { value: "QUALIFIED_RIDE", label: "Rode" },
                { value: "EXPIRED_NO_RIDE", label: "No ride" },
                { value: "CLOSED", label: "Closed" },
              ]}
            />
          </div>
          <Card>
            {data.referrals.rows.length === 0 ? (
              <EmptyState>{q || status ? "No referral matches that." : "No referrals in this period."}</EmptyState>
            ) : (
              <>
                <TableWrap>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Code used</th>
                        <th>Brought by</th>
                        <th>Friend</th>
                        <th>Status</th>
                        <th>First ride</th>
                        <th className="num">Trips</th>
                        <th>Cashback</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.referrals.rows.map((r) => {
                        const words = STATUS_WORDS[r.status] ?? { label: r.status, badge: "admin-badge gray" };
                        return (
                          <tr key={r.id}>
                            <td>
                              <code>{r.code}</code>
                              <span className="admin-sub">{formatDateTime(r.appliedAt)}</span>
                            </td>
                            <td><Who person={r.referrer} /></td>
                            <td><Who person={r.referred} /></td>
                            <td>
                              <span className={words.badge}>{words.label}</span>
                              {r.status === "PENDING" ? <span className="admin-sub">until {formatDate(r.expiresAt)}</span> : null}
                            </td>
                            <td>
                              {r.firstRide ? (
                                <>
                                  <Link href={`/admin/dashboard/rides/${r.firstRide.id}`} className="admin-user-link">{tripId(r.firstRide.tripNumber)}</Link>
                                  <span className="admin-sub">{r.firstRide.fareNgn === null ? "" : `${formatNaira(r.firstRide.fareNgn)} · `}{formatDate(r.firstRide.completedAt)}</span>
                                </>
                              ) : "—"}
                            </td>
                            <td className="num">{formatNumber(r.friendTrips)}</td>
                            <td>
                              {r.cashback ? (
                                <>
                                  {formatNaira(r.cashback.amountNgn)}
                                  <span className="admin-sub">{CASHBACK_WORDS[r.cashback.status] ?? r.cashback.status.toLowerCase()}</span>
                                </>
                              ) : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </TableWrap>
                <Pagination offset={data.referrals.offset} limit={data.referrals.limit} total={data.referrals.total} onChange={setOffset} />
              </>
            )}
          </Card>
        </>
      ) : null}
    </>
  );
}
