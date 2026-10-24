"use client";

import Link from "next/link";
import { use } from "react";
import { useAdminData } from "@/components/admin/use-admin-data";
import { displayName, formatDate, formatDateTime, formatNaira, formatNumber, formatPercent } from "@/lib/admin-format";
import { Card, EmptyState, ErrorState, PageHeader, RefreshButton, SectionLabel, Spinner, StatCard, StatGrid, TableWrap } from "@/components/admin/ui";

type Person = { id: string; name: string | null; phone: string | null };
type Status = "PENDING" | "QUALIFIED_RIDE" | "EXPIRED_NO_RIDE" | "CLOSED";

type PersonReferrals = {
  rules: { rideRewardNgn: number; noRideRewardNgn: number; rideWithinDays: number; cashbackUnusedDays: number };
  user: Person & { username: string | null; role: string; joinedAt: string };
  code: { code: string; active: boolean; createdAt: string } | null;
  broughtBy: { code: string; status: Status; appliedAt: string; referrer: Person } | null;
  summary: {
    referred: number; rode: number; waiting: number; noRide: number; friendsStillRiding: number; friendTrips: number;
    earnedNgn: number; spentNgn: number; availableNgn: number; frozenNgn: number;
  };
  friends: Array<{
    id: string; code: string; status: Status; appliedAt: string; expiresAt: string; qualifiedAt: string | null;
    friend: Person & { joinedAt: string };
    firstRide: { id: string; tripNumber: number; completedAt: string | null; fareNgn: number | null } | null;
    friendTrips: number; friendLastTripAt: string | null;
    cashback: { amountNgn: number; status: string } | null;
  }>;
  cashback: Array<{
    id: string; type: "RIDE_QUALIFIED" | "NO_RIDE_EXPIRED"; amountNgn: number; remainingNgn: number; status: string;
    freezesAt: string; frozenAt: string | null; usedAt: string | null; createdAt: string; forFriend: Person | null;
  }>;
  spending: Array<{ id: string; amountNgn: number; status: string; createdAt: string; settledAt: string | null; ride: { id: string; tripNumber: number; fareNgn: number | null } | null }>;
};

const STATUS_WORDS: Record<Status, { label: string; badge: string }> = {
  PENDING: { label: "Waiting for a ride", badge: "admin-badge orange" },
  QUALIFIED_RIDE: { label: "Rode", badge: "admin-badge green" },
  EXPIRED_NO_RIDE: { label: "No ride in time", badge: "admin-badge gray" },
  CLOSED: { label: "Closed", badge: "admin-badge gray" },
};
const CASHBACK_WORDS: Record<string, { label: string; badge: string }> = {
  AVAILABLE: { label: "To spend", badge: "admin-badge green" },
  FROZEN: { label: "Frozen", badge: "admin-badge blue" },
  USED: { label: "Spent", badge: "admin-badge gray" },
  EXPIRED: { label: "Expired", badge: "admin-badge gray" },
};
const SPEND_WORDS: Record<string, string> = { RESERVED: "held for a ride", SETTLED: "spent", RELEASED: "given back" };
const tripId = (n: number) => `WH-${String(n).padStart(5, "0")}`;

/**
 * One person's referrals, of all time: their code, who brought them, every
 * friend they brought and how far that friend got, and every naira of
 * cashback (given for which friend, spent on which ride, left, frozen).
 */
export default function PersonReferralsPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params);
  const { data, error, loading, refresh } = useAdminData<PersonReferrals>(`/admin/referrals/people/${userId}`, [userId]);

  if (loading && !data) return <Spinner label="Loading their referrals…" />;
  if (error) return <ErrorState error={error} onRetry={refresh} />;
  if (!data) return null;

  const s = data.summary;
  const settled = s.rode + s.noRide;

  return (
    <>
      <Link href="/admin/dashboard/referrals" className="admin-back-btn">← Referrals</Link>
      <PageHeader
        title={displayName(data.user)}
        subtitle={[data.user.phone && data.user.name ? data.user.phone : null, `joined ${formatDate(data.user.joinedAt)}`].filter(Boolean).join(" · ")}
        actions={
          <>
            <Link href={`/admin/dashboard/users/${data.user.id}`} className="admin-btn-ghost">Their user page</Link>
            <RefreshButton busy={loading} onClick={refresh} />
          </>
        }
      />

      <Card padded>
        <div className="admin-chip-row">
          <span className="admin-chip">
            <strong>Code</strong>
            <span>{data.code ? <><code>{data.code.code}</code>{data.code.active ? "" : " (switched off)"} · made {formatDate(data.code.createdAt)}</> : "No code yet: one is made when they open Refer a friend"}</span>
          </span>
          <span className="admin-chip">
            <strong>Brought by</strong>
            <span>
              {data.broughtBy ? (
                <>
                  <Link href={`/admin/dashboard/referrals/${data.broughtBy.referrer.id}`} className="admin-user-link">{displayName(data.broughtBy.referrer)}</Link>
                  {" "}with <code>{data.broughtBy.code}</code> on {formatDate(data.broughtBy.appliedAt)}
                </>
              ) : "Nobody: they joined on their own"}
            </span>
          </span>
        </div>
      </Card>

      <StatGrid>
        <StatCard label="Friends brought" value={formatNumber(s.referred)} hint={s.waiting ? `${formatNumber(s.waiting)} still have time to ride` : "all time"} />
        <StatCard
          label={`Rode within ${data.rules.rideWithinDays} days`}
          value={formatNumber(s.rode)}
          tone="green"
          hint={settled ? `${formatPercent(s.rode / settled)} of friends whose time is up · ${formatNumber(s.noRide)} didn't` : "None whose time is up yet"}
        />
        <StatCard label="Friends' trips" value={formatNumber(s.friendTrips)} hint={`${formatNumber(s.friendsStillRiding)} rode in the last 30 days`} />
        <StatCard label="Cashback given" value={formatNaira(s.earnedNgn)} hint={`${formatNaira(s.spentNgn)} spent · ${formatNaira(s.availableNgn)} to spend · ${formatNaira(s.frozenNgn)} frozen`} />
      </StatGrid>

      <SectionLabel>Friends they brought</SectionLabel>
      <Card>
        {data.friends.length === 0 ? (
          <EmptyState>{data.code ? `Nobody has used ${data.code.code} yet.` : "Nobody yet."}</EmptyState>
        ) : (
          <TableWrap>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Friend</th>
                  <th>Used the code</th>
                  <th>Status</th>
                  <th>First ride</th>
                  <th className="num">Trips</th>
                  <th>Last trip</th>
                  <th>Cashback</th>
                </tr>
              </thead>
              <tbody>
                {data.friends.map((f) => {
                  const words = STATUS_WORDS[f.status] ?? { label: f.status, badge: "admin-badge gray" };
                  const cb = f.cashback ? CASHBACK_WORDS[f.cashback.status] : null;
                  return (
                    <tr key={f.id}>
                      <td>
                        <Link href={`/admin/dashboard/referrals/${f.friend.id}`} className="admin-user-link">{displayName(f.friend)}</Link>
                        {f.friend.name && f.friend.phone ? <span className="admin-sub">{f.friend.phone}</span> : null}
                      </td>
                      <td>{formatDateTime(f.appliedAt)}</td>
                      <td>
                        <span className={words.badge}>{words.label}</span>
                        {f.status === "PENDING" ? <span className="admin-sub">until {formatDate(f.expiresAt)}</span> : null}
                      </td>
                      <td>
                        {f.firstRide ? (
                          <>
                            <Link href={`/admin/dashboard/rides/${f.firstRide.id}`} className="admin-user-link">{tripId(f.firstRide.tripNumber)}</Link>
                            <span className="admin-sub">{f.firstRide.fareNgn === null ? "" : `${formatNaira(f.firstRide.fareNgn)} · `}{formatDate(f.firstRide.completedAt)}</span>
                          </>
                        ) : "—"}
                      </td>
                      <td className="num">{formatNumber(f.friendTrips)}</td>
                      <td>{f.friendLastTripAt ? formatDate(f.friendLastTripAt) : "—"}</td>
                      <td>
                        {f.cashback ? (
                          <>
                            {formatNaira(f.cashback.amountNgn)}
                            <span className="admin-sub">{cb?.label.toLowerCase() ?? f.cashback.status.toLowerCase()}</span>
                          </>
                        ) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>

      <div className="admin-two-col">
        <Card title="Cashback they were given" padded>
          {data.cashback.length === 0 ? (
            <EmptyState>None yet.</EmptyState>
          ) : (
            <TableWrap>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>For</th>
                    <th className="num">Given</th>
                    <th className="num">Left</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.cashback.map((c) => {
                    const words = CASHBACK_WORDS[c.status] ?? { label: c.status, badge: "admin-badge gray" };
                    return (
                      <tr key={c.id}>
                        <td>
                          {c.forFriend ? displayName(c.forFriend) : "—"}
                          <span className="admin-sub">{c.type === "RIDE_QUALIFIED" ? "their friend rode" : "their friend didn't ride in time"} · {formatDate(c.createdAt)}</span>
                        </td>
                        <td className="num">{formatNaira(c.amountNgn)}</td>
                        <td className="num">{formatNaira(c.remainingNgn)}</td>
                        <td>
                          <span className={words.badge}>{words.label}</span>
                          <span className="admin-sub">
                            {c.status === "AVAILABLE" ? `freezes ${formatDate(c.freezesAt)}` : c.status === "FROZEN" && c.frozenAt ? `since ${formatDate(c.frozenAt)}` : c.usedAt ? formatDate(c.usedAt) : ""}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableWrap>
          )}
        </Card>

        <Card title="Where they spent it" padded>
          {data.spending.length === 0 ? (
            <EmptyState>Not spent on a ride yet.</EmptyState>
          ) : (
            <TableWrap>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Ride</th>
                    <th className="num">Cashback</th>
                    <th>When</th>
                  </tr>
                </thead>
                <tbody>
                  {data.spending.map((u) => (
                    <tr key={u.id}>
                      <td>
                        {u.ride ? <Link href={`/admin/dashboard/rides/${u.ride.id}`} className="admin-user-link">{tripId(u.ride.tripNumber)}</Link> : "—"}
                        {u.ride?.fareNgn != null ? <span className="admin-sub">fare {formatNaira(u.ride.fareNgn)}</span> : null}
                      </td>
                      <td className="num">
                        {formatNaira(u.amountNgn)}
                        <span className="admin-sub">{SPEND_WORDS[u.status] ?? u.status.toLowerCase()}</span>
                      </td>
                      <td>{formatDateTime(u.settledAt ?? u.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </Card>
      </div>

      <p className="admin-note">
        A friend who rides within {data.rules.rideWithinDays} days earns them {formatNaira(data.rules.rideRewardNgn)} cashback; {formatNaira(data.rules.noRideRewardNgn)} if not.
        Cashback not spent in {data.rules.cashbackUnusedDays} days is frozen until their next friend joins.
      </p>
    </>
  );
}
