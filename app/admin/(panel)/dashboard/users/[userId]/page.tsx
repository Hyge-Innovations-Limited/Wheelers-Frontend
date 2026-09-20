"use client";

import { use, useState } from "react";
import Link from "next/link";
import { setWithdrawalFreeze, type AdminUserDetail } from "@/lib/admin-api";
import {
  displayName,
  formatDate,
  formatDateTime,
  formatDistance,
  formatNaira,
  formatNumber,
  formatWhen,
  humanise,
  initialsOf,
  statusBadgeClass,
} from "@/lib/admin-format";
import { useAdminData } from "@/components/admin/use-admin-data";
import {
  Card,
  EmptyState,
  ErrorState,
  Spinner,
  StatCard,
  StatGrid,
  TableWrap,
} from "@/components/admin/ui";

type Tab = "rides" | "money" | "activity";

export default function UserDetailPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params);
  const [tab, setTab] = useState<Tab>("rides");
  const { data, error, loading, refresh } = useAdminData<AdminUserDetail>(`/admin/users/${userId}`);

  if (loading && !data) return <Spinner label="Loading profile…" />;
  if (error) return <ErrorState error={error} onRetry={refresh} />;
  if (!data) return null;

  const { user, driver, wallet, virtualAccount, rides } = data;
  const isDriver = Boolean(driver);

  // A driver's own rides are the trips they drove; a rider's are trips taken.
  const rideRows = isDriver && data.driverRecentRides.length > 0 ? data.driverRecentRides : data.recentRides;

  return (
    <>
      <Link href="/admin/dashboard/users" className="admin-back-btn">
        ← All users
      </Link>

      <div className="admin-profile-head">
        <span className="admin-avatar lg">{initialsOf(user.name, "?")}</span>
        <div className="admin-profile-meta">
          <h1 className="admin-page-title">{displayName(user)}</h1>
          <div className="admin-profile-tags">
            <span className={statusBadgeClass(isDriver ? driver!.status : user.riderKycStatus)}>
              {isDriver ? `Driver · ${humanise(driver!.status)}` : "Rider"}
            </span>
            {isDriver ? (
              <span className={statusBadgeClass(driver!.kycStatus)}>KYC {humanise(driver!.kycStatus)}</span>
            ) : (
              <span className={statusBadgeClass(user.riderKycStatus)}>
                {user.riderKycStatus === "VERIFIED" ? "Identity verified" : `KYC ${humanise(user.riderKycStatus)}`}
              </span>
            )}
            {isDriver && driver!.rating ? <span className="admin-badge gray">★ {driver!.rating.toFixed(2)}</span> : null}
            {user.privacyConsent === "AGREED" ? (
              <span className="admin-badge green" title={`Agreed ${formatDateTime(user.privacyConsentAt)}`}>Privacy policy agreed</span>
            ) : user.privacyConsent === "DECLINED" ? (
              <span className="admin-badge red" title={`Declined ${formatDateTime(user.privacyConsentAt)}`}>Privacy policy not agreed</span>
            ) : user.privacyConsent === "PENDING" ? (
              <span className="admin-badge gray">Privacy policy not answered</span>
            ) : null}
          </div>
          <div className="admin-profile-facts">
            <span>{user.phone ?? "No phone"}</span>
            <span>{user.email ?? "No email"}</span>
            {user.username ? <span>@{user.username}</span> : null}
            <span>Joined {formatDate(user.createdAt)}</span>
          </div>
        </div>
        {isDriver ? (
          <Link href={`/admin/dashboard/drivers/${driver!.id}`} className="admin-btn-primary">
            Review KYC documents
          </Link>
        ) : null}
      </div>

      <StatGrid>
        {isDriver ? (
          <>
            <StatCard label="Trips driven" value={formatNumber(driver!.rides.completed)} hint={`${formatNumber(driver!.rides.total)} assigned`} />
            <StatCard label="Total earned" value={formatNaira(driver!.totalEarningsNgn)} tone="green" />
            <StatCard label="Wallet balance" value={formatNaira(wallet?.balanceNgn ?? 0)} hint={`${formatNaira(wallet?.lockedNgn ?? 0)} locked`} />
            <StatCard label="Vehicle" value={driver!.vehiclePlate ?? "—"} hint={[driver!.vehicleMake, driver!.vehicleModel, driver!.vehicleYear].filter(Boolean).join(" · ") || undefined} />
          </>
        ) : (
          <>
            <StatCard label="Rides completed" value={formatNumber(rides.completed)} hint={`${formatNumber(rides.total)} requested`} tone="green" />
            <StatCard label="Total spent" value={formatNaira(rides.totalSpentNgn)} hint={`Avg ${formatNaira(rides.avgFareNgn)} per ride`} />
            <StatCard label="Wallet balance" value={formatNaira(wallet?.balanceNgn ?? 0)} hint={`${formatNaira(wallet?.lockedNgn ?? 0)} locked`} />
            <StatCard label="Cancelled" value={formatNumber(rides.cancelled)} hint={`${formatNumber(rides.active)} in flight`} tone={rides.cancelled > 0 ? "orange" : undefined} />
          </>
        )}
      </StatGrid>

      {!isDriver ? (
        <StatGrid cols={4}>
          <StatCard label="Distance travelled" value={`${formatNumber(Math.round(rides.totalDistanceKm))} km`} hint={`Avg ${formatDistance(rides.avgDistanceKm)}`} />
          <StatCard label="Referral code" value={user.referralCode ?? "—"} hint={`${formatNumber(user.referralsMade)} referred`} />
          <StatCard
            label="Deposit account"
            value={virtualAccount ? virtualAccount.accountNumber : "Not set up"}
            hint={virtualAccount?.bankName ?? undefined}
          />
          <StatCard label="Last activity" value={rideRows[0] ? formatWhen(rideRows[0].createdAt) : "—"} />
        </StatGrid>
      ) : null}

      <div className="admin-tabs standalone">
        {(["rides", "money", "activity"] as Tab[]).map((t) => (
          <button key={t} type="button" className={`admin-tab${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>
            {t === "rides" ? (isDriver ? "Trips" : "Rides") : t === "money" ? "Money" : "Activity"}
            <span className="admin-tab-count">
              {t === "rides" ? rideRows.length : t === "money" ? data.transactions.length : data.activity.items.length}
            </span>
          </button>
        ))}
      </div>

      {tab === "rides" ? (
        <Card title={isDriver ? "Recent trips" : "Recent rides"}>
          {rideRows.length === 0 ? (
            <EmptyState>No rides yet.</EmptyState>
          ) : (
            <TableWrap>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Status</th>
                    <th>Route</th>
                    <th className="num">Distance</th>
                    <th className="num">Fare</th>
                  </tr>
                </thead>
                <tbody>
                  {rideRows.map((r) => (
                    <tr key={r.id}>
                      <td>{formatDateTime(r.createdAt)}</td>
                      <td>
                        <span className={statusBadgeClass(r.status)}>{humanise(r.status)}</span>
                        {"cancelReason" in r && r.cancelReason ? (
                          <em className="admin-sub"> {r.cancelReason}</em>
                        ) : null}
                      </td>
                      <td>
                        <span className="admin-route">
                          <span title={r.pickupAddress}>{r.pickupAddress}</span>
                          <em title={r.destAddress}>→ {r.destAddress}</em>
                        </span>
                      </td>
                      <td className="num">{formatDistance(r.distanceKm)}</td>
                      <td className="num">
                        {r.fareFinalNgn
                          ? formatNaira(r.fareFinalNgn)
                          : "fareEstimateNgn" in r && r.fareEstimateNgn
                            ? <em className="admin-sub">{formatNaira(r.fareEstimateNgn)} est.</em>
                            : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </Card>
      ) : null}

      {tab === "money" ? (
        <>
          {data.security ? (
            <WithdrawalFreeze userId={user.id} security={data.security} onChanged={refresh} />
          ) : null}

          {wallet && wallet.byType.length > 0 ? (
            <Card title="Lifetime totals" padded>
              <div className="admin-chip-row">
                {wallet.byType.map((t) => (
                  <span key={t.type} className="admin-chip">
                    <strong>{humanise(t.type)}</strong>
                    <span>
                      {formatNaira(t.totalNgn)} · {formatNumber(t.count)}
                    </span>
                  </span>
                ))}
              </div>
            </Card>
          ) : null}

          <Card title="Transactions">
            {data.transactions.length === 0 ? (
              <EmptyState>No wallet activity yet.</EmptyState>
            ) : (
              <TableWrap>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Type</th>
                      <th className="num">Amount</th>
                      <th className="num">Balance after</th>
                      <th>Reference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.transactions.map((t) => (
                      <tr key={t.id}>
                        <td>{formatDateTime(t.createdAt)}</td>
                        <td>{humanise(t.type)}</td>
                        <td className={`num ${t.direction === "CREDIT" ? "amount-in" : "amount-out"}`}>
                          {t.direction === "CREDIT" ? "+" : "−"}
                          {formatNaira(t.amountNgn)}
                        </td>
                        <td className="num">{formatNaira(t.balanceAfterNgn)}</td>
                        <td className="mono">{t.referenceId.slice(0, 12)}…</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </Card>

          {data.withdrawals.length > 0 ? (
            <Card title="Withdrawals">
              <TableWrap>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Status</th>
                      <th className="num">Amount</th>
                      <th>Bank account</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.withdrawals.map((w) => (
                      <tr key={w.id}>
                        <td>{formatDateTime(w.createdAt)}</td>
                        <td>
                          <span className={statusBadgeClass(w.status)}>{humanise(w.status)}</span>
                          {w.failureReason ? <em className="admin-sub"> {w.failureReason}</em> : null}
                        </td>
                        <td className="num">{formatNaira(w.amountNgn)}</td>
                        <td>
                          <span className="admin-stack">
                            <span>{w.bankAccountNumber}</span>
                            <em>{w.bankAccountName}</em>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            </Card>
          ) : null}
        </>
      ) : null}

      {tab === "activity" ? (
        <Card title="Activity">
          {data.activity.items.length === 0 ? (
            <EmptyState>
              No recorded activity for this user. Events are captured as people use the app — older
              accounts may predate activity tracking.
            </EmptyState>
          ) : (
            <TableWrap>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Event</th>
                    <th>Source</th>
                    <th>Ride</th>
                  </tr>
                </thead>
                <tbody>
                  {data.activity.items.map((a) => (
                    <tr key={a.id}>
                      <td title={formatDateTime(a.occurredAt)}>{formatWhen(a.occurredAt)}</td>
                      <td>{humanise(a.eventType)}</td>
                      <td>{humanise(a.source)}</td>
                      <td className="mono">{a.rideId ? `${a.rideId.slice(0, 8)}…` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </Card>
      ) : null}
    </>
  );
}

/**
 * The button for "my phone was stolen". A freeze blocks every withdrawal until
 * an admin lifts it; lifting it also clears the known-accounts-only restriction
 * that follows a PIN reset.
 */
function WithdrawalFreeze({
  userId,
  security,
  onChanged,
}: {
  userId: string;
  security: NonNullable<AdminUserDetail["security"]>;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const frozen = security.withdrawalsFrozen;
  const restricted = security.withdrawalsRestricted;
  const byAdmin = security.withdrawalsFrozenReason === "admin_freeze";

  async function change(next: boolean) {
    const question = next
      ? "Freeze withdrawals for this user? They will not be able to move money out until you unfreeze them."
      : "Unfreeze withdrawals? Only do this once you are sure you are dealing with the real owner.";
    if (!window.confirm(question)) return;
    setBusy(true);
    setFailure(null);
    try {
      await setWithdrawalFreeze(userId, next);
      onChanged();
    } catch (error) {
      setFailure(error instanceof Error ? error.message : "Could not change the freeze.");
    } finally {
      setBusy(false);
    }
  }

  let headline = "Withdrawals are open";
  let detail = security.hasPin ? "Wallet PIN is set." : "No wallet PIN yet — they will be asked to create one before withdrawing.";
  if (frozen) {
    headline = byAdmin ? "Withdrawals frozen by support" : "Withdrawals frozen";
    detail = byAdmin
      ? "Stays frozen until an admin lifts it."
      : `${humanise(security.withdrawalsFrozenReason) || "Frozen"} · lifts ${formatDateTime(security.withdrawalsFrozenUntil)}.`;
  } else if (restricted) {
    headline = "Withdrawals limited to known accounts";
    detail = `After a PIN reset, until ${formatDateTime(security.withdrawalsRestrictedUntil)}.`;
  }

  return (
    <Card title="Withdrawal safety" padded>
      <div className={`admin-freeze${frozen ? " frozen" : ""}`}>
        <div className="admin-freeze-text">
          <strong>{headline}</strong>
          <span>{detail}</span>
          {failure ? <span style={{ color: "var(--adm-red)" }}>{failure}</span> : null}
        </div>
        {frozen || restricted ? (
          <button type="button" className="admin-btn-ghost" disabled={busy} onClick={() => void change(false)}>
            {busy ? "Working…" : "Unfreeze"}
          </button>
        ) : (
          <button type="button" className="admin-btn-danger" disabled={busy} onClick={() => void change(true)}>
            {busy ? "Working…" : "Freeze withdrawals"}
          </button>
        )}
      </div>
    </Card>
  );
}
