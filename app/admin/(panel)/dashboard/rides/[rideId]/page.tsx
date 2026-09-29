"use client";

import { use, useState } from "react";
import Link from "next/link";
import { unlockTripCode, type AdminTripView } from "@/lib/admin-api";
import { StellarTable } from "@/components/admin/stellar-table";
import { formatDateTime, humanise, statusBadgeClass } from "@/lib/admin-format";
import { useAdminData } from "@/components/admin/use-admin-data";
import { Card, EmptyState, ErrorState, Spinner, TableWrap } from "@/components/admin/ui";

const CODE_LABEL: Record<AdminTripView["tripCode"]["status"], string> = {
  none: "No code on this trip",
  waiting: "Not entered yet",
  verified: "Entered by the driver",
  unlocked: "Unlocked by support",
};

const CARD_LABEL: Record<string, string> = {
  live: "🟢 Trip on, nothing waiting",
  message: "💬 Driver sent a message the rider has not opened",
  call: "📞 Driver calling, or a missed call not yet seen",
  none: "No status (trip ended)",
};

const CALL_OUTCOME: Record<string, string> = {
  COMPLETED: "Talked",
  MISSED: "Missed",
  CANCELLED: "Missed (caller hung up)",
  DECLINED: "Declined",
  FAILED: "Could not connect",
  RINGING: "Ringing",
  ACTIVE: "On the call",
};

/** Trips that have not started yet: support may unlock the code on these. */
const UNLOCKABLE = new Set(["DRIVER_ASSIGNED", "DRIVER_EN_ROUTE", "ARRIVED"]);

function seconds(value: number | null): string {
  if (value == null) return "—";
  const m = Math.floor(value / 60);
  return `${m}:${String(value % 60).padStart(2, "0")}`;
}

export default function RideDetailPage({ params }: { params: Promise<{ rideId: string }> }) {
  const { rideId } = use(params);
  const { data, error, loading, refresh } = useAdminData<AdminTripView>(`/admin/rides/${rideId}/trip`, [], { refreshMs: 15_000 });
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  if (loading && !data) return <Spinner label="Loading trip…" />;
  if (error) return <ErrorState error={error} onRetry={refresh} />;
  if (!data) return null;

  const canUnlock = data.tripCode.status === "waiting" && UNLOCKABLE.has(data.status);

  const unlock = async () => {
    const ok = window.confirm(
      `Start trip ${data.tripId ?? ""} without the rider's code?\n\nOnly do this after speaking to the rider (their phone died, they cannot find the code). Your name is recorded on the trip.`,
    );
    if (!ok) return;
    setUnlocking(true);
    setUnlockError(null);
    try {
      await unlockTripCode(rideId);
      refresh();
    } catch (err) {
      setUnlockError(err instanceof Error ? err.message : "Could not unlock the trip.");
    } finally {
      setUnlocking(false);
    }
  };

  return (
    <>
      <Link href="/admin/dashboard/rides" className="admin-back-btn">
        ← All rides
      </Link>

      <div className="admin-profile-head">
        <div className="admin-profile-meta">
          <h1 className="admin-page-title">Trip {data.tripId ?? rideId.slice(0, 8)}</h1>
          <div className="admin-profile-tags">
            <span className={statusBadgeClass(data.status)}>{humanise(data.status)}</span>
            <span className="admin-badge gray">{data.channel === "WHATSAPP" ? "WhatsApp" : humanise(data.channel)}</span>
            <span className={data.chatOpen ? "admin-badge green" : "admin-badge gray"}>{data.chatOpen ? "Chat open" : "Chat closed"}</span>
          </div>
          <div className="admin-profile-facts">
            <span>
              Rider:{" "}
              <Link href={`/admin/dashboard/users/${data.rider.userId}`} className="admin-user-link">{data.rider.name}</Link>
            </span>
            <span>
              Driver:{" "}
              {data.driver ? (
                <Link href={`/admin/dashboard/users/${data.driver.userId}`} className="admin-user-link">{data.driver.name}</Link>
              ) : "none"}
            </span>
          </div>
        </div>
      </div>

      <Card
        title="Trip code"
        right={canUnlock ? (
          <button type="button" className="admin-btn-primary" onClick={() => void unlock()} disabled={unlocking}>
            {unlocking ? "Unlocking…" : "Unlock trip"}
          </button>
        ) : null}>
        <p>{CODE_LABEL[data.tripCode.status]}</p>
        {data.tripCode.status !== "none" ? (
          <p className="admin-sub">
            Wrong codes entered: {data.tripCode.wrongTries}
            {data.tripCode.verifiedAt ? ` · entered ${formatDateTime(data.tripCode.verifiedAt)}` : ""}
            {data.tripCode.unlockedAt ? ` · unlocked by ${data.tripCode.unlockedBy ?? "support"}, ${formatDateTime(data.tripCode.unlockedAt)}` : ""}
          </p>
        ) : null}
        {canUnlock ? (
          <p className="admin-sub">The code itself is only shown to the rider. Unlock when the rider cannot give it; the driver can then start the trip.</p>
        ) : null}
        {unlockError ? <p className="admin-trip-error">{unlockError}</p> : null}
      </Card>

      {data.channel === "WHATSAPP" ? (
        <Card title="WhatsApp ride card">
          <p>{data.whatsappCardStatus ? CARD_LABEL[data.whatsappCardStatus] ?? data.whatsappCardStatus : "No status on the card"}</p>
        </Card>
      ) : null}

      <Card title={`Chat (${data.messages.filter((m) => m.kind === "text").length} messages)`}>
        {data.messages.length === 0 ? (
          <EmptyState>No messages on this trip.</EmptyState>
        ) : (
          <div className="admin-chat-thread">
            {data.messages.map((m) => (
              <div key={m.id} className={m.kind === "call" ? "admin-chat-line call" : `admin-chat-line ${m.senderRole === "DRIVER" ? "driver" : "rider"}`}>
                <span className="admin-sub">
                  {m.kind === "call" ? "Call" : `${m.senderName} (${m.senderRole === "DRIVER" ? "driver" : "rider"})`} · {formatDateTime(m.createdAt)}
                </span>
                <span>{m.content}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title={`Calls (${data.calls.length})`} padded={false}>
        {data.calls.length === 0 ? (
          <EmptyState>No calls on this trip.</EmptyState>
        ) : (
          <TableWrap>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Caller</th>
                  <th>Rung on</th>
                  <th>Outcome</th>
                  <th className="num">Talk time</th>
                  <th>Ended because</th>
                </tr>
              </thead>
              <tbody>
                {data.calls.map((c) => (
                  <tr key={c.id}>
                    <td>{formatDateTime(c.startedAt)}</td>
                    <td>{c.caller.name} ({c.caller.role === "DRIVER" ? "driver" : "rider"})</td>
                    <td>{c.callee.channel === "whatsapp" ? "WhatsApp" : "App"}</td>
                    <td>{CALL_OUTCOME[c.status] ?? humanise(c.status)}</td>
                    <td className="num">{seconds(c.durationSeconds)}</td>
                    <td>{c.endReason ? humanise(c.endReason) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>

      {data.stellar ? (
        <Card title="Stellar Testnet" padded={false}>
          <StellarTable transfers={data.stellar} />
        </Card>
      ) : null}
    </>
  );
}
