"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  acknowledgeAlert,
  describeAlertKind,
  fetchAlerts,
  resolveAlert,
  type SafetyAlertCounts,
  type SafetyAlertRow,
  type SafetyAlertStatus,
} from "@/lib/admin-api";
import { formatDateTime, formatWhen, initialsOf } from "@/lib/admin-format";
import {
  Card,
  EmptyState,
  ErrorState,
  FilterTabs,
  PageHeader,
  RefreshButton,
  Spinner,
  StatCard,
  StatGrid,
} from "@/components/admin/ui";

type Filter = "LIVE" | "OPEN" | "ACKNOWLEDGED" | "RESOLVED" | "ALL";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "LIVE", label: "Needs attention" },
  { value: "OPEN", label: "Unopened" },
  { value: "ACKNOWLEDGED", label: "Being handled" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "ALL", label: "Everything" },
];

/** How often the live list re-fetches itself while an operator is watching. */
const POLL_MS = 15_000;

/**
 * Critical alerts.
 *
 * This is the only page in the panel where being out of date is dangerous, so
 * it refreshes itself every fifteen seconds rather than waiting for someone to
 * press a button. Everything an operator needs to act — who, where, what trip,
 * and a phone number to call — is on the card itself; there is no drill-down,
 * because a second click during an emergency is a second wasted.
 */
export default function AlertsPage() {
  const [filter, setFilter] = useState<Filter>("LIVE");
  const [rows, setRows] = useState<SafetyAlertRow[]>([]);
  const [counts, setCounts] = useState<SafetyAlertCounts | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const requestRef = useRef(0);

  const load = useCallback(
    async (quiet = false) => {
      const requestId = ++requestRef.current;
      if (!quiet) setLoading(true);

      try {
        const result = await fetchAlerts(filter);
        // A slow response for an old filter must not overwrite a newer one.
        if (requestId !== requestRef.current) return;
        setRows(result.items);
        setCounts(result.counts);
        setError(null);
      } catch (loadError) {
        if (requestId !== requestRef.current) return;
        // A failed background poll keeps whatever is already on screen; an
        // empty page is worse than a slightly stale one.
        if (!quiet) setError(loadError);
      } finally {
        if (requestId === requestRef.current) setLoading(false);
      }
    },
    [filter],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const timer = setInterval(() => void load(true), POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  async function handleAcknowledge(alert: SafetyAlertRow) {
    setBusyId(alert.id);
    try {
      await acknowledgeAlert(alert.id);
      await load(true);
    } catch (actionError) {
      setError(actionError);
    } finally {
      setBusyId(null);
    }
  }

  async function handleResolve(alert: SafetyAlertRow) {
    const resolution = window.prompt(
      `What happened with ${alert.user.name ?? "this user"}? This is the only record of how the alert was handled.`,
    );
    if (!resolution?.trim()) return;

    setBusyId(alert.id);
    try {
      await resolveAlert(alert.id, resolution.trim());
      await load(true);
    } catch (actionError) {
      setError(actionError);
    } finally {
      setBusyId(null);
    }
  }

  if (loading && rows.length === 0 && !error) {
    return <Spinner label="Loading alerts…" />;
  }

  return (
    <>
      <PageHeader
        title="Critical alerts"
        subtitle={
          counts
            ? counts.live > 0
              ? `${counts.live} still waiting on someone`
              : "Nothing outstanding — every alert has been handled"
            : "Emergency alerts raised by riders and drivers"
        }
        actions={<RefreshButton busy={loading} onClick={() => void load()} />}
      />

      {counts ? (
        <StatGrid cols={4}>
          <StatCard
            label="Unopened"
            value={String(counts.open)}
            hint="Nobody has picked these up yet"
            tone={counts.open > 0 ? "red" : undefined}
          />
          <StatCard
            label="Being handled"
            value={String(counts.acknowledged)}
            hint="An operator is on them"
          />
          <StatCard
            label="Resolved"
            value={String(counts.resolved)}
            hint="Closed with a written outcome"
            tone="green"
          />
          <StatCard
            label="Withdrawn"
            value={String(counts.cancelled)}
            hint="Cancelled by the person who raised it"
          />
        </StatGrid>
      ) : null}

      <FilterTabs value={filter} onChange={setFilter} options={FILTERS} />

      {error ? <ErrorState error={error} onRetry={() => void load()} /> : null}

      {rows.length === 0 && !error ? (
        <EmptyState>
          {filter === "LIVE"
            ? "No alerts need attention. This page refreshes itself every 15 seconds."
            : "No alerts match this filter."}
        </EmptyState>
      ) : null}

      <div className="admin-alert-list">
        {rows.map((alert) => (
          <AlertCard
            key={alert.id}
            alert={alert}
            busy={busyId === alert.id}
            onAcknowledge={() => void handleAcknowledge(alert)}
            onResolve={() => void handleResolve(alert)}
          />
        ))}
      </div>
    </>
  );
}

function AlertCard({
  alert,
  busy,
  onAcknowledge,
  onResolve,
}: {
  alert: SafetyAlertRow;
  busy: boolean;
  onAcknowledge: () => void;
  onResolve: () => void;
}) {
  const isLive = alert.status === "OPEN" || alert.status === "ACKNOWLEDGED";
  const isUrgent = alert.status === "OPEN";
  const name = alert.user.name ?? alert.user.username ?? "Unknown user";

  return (
    <Card padded>
      <div className={`admin-alert${isUrgent ? " urgent" : ""}`}>
        <div className="admin-alert-head">
          <span className="admin-avatar">{initialsOf(name)}</span>

          <div className="admin-alert-who">
            <strong>{name}</strong>
            <em className="admin-sub">
              {alert.raisedByRole === "DRIVER" ? "Driver" : "Rider"} ·{" "}
              {formatWhen(alert.createdAt)}
            </em>
          </div>

          <span className={`admin-alert-status ${alert.status.toLowerCase()}`}>
            {statusLabel(alert.status)}
          </span>
        </div>

        <p className="admin-alert-kind">{describeAlertKind(alert.kind)}</p>

        <div className="admin-alert-facts">
          <Fact label="Phone">
            {alert.user.phone ? (
              // The single most useful thing on this card: one click to call.
              <a href={`tel:${alert.user.phone}`}>{alert.user.phone}</a>
            ) : (
              <span className="admin-sub">No number on file</span>
            )}
          </Fact>

          <Fact label="Where">
            {alert.lat !== null && alert.lng !== null ? (
              <a
                href={`https://www.google.com/maps?q=${alert.lat},${alert.lng}`}
                target="_blank"
                rel="noreferrer"
              >
                {alert.address ?? `${alert.lat.toFixed(5)}, ${alert.lng.toFixed(5)}`}
              </a>
            ) : (
              <span className="admin-sub">
                Location unavailable when the button was pressed
              </span>
            )}
          </Fact>

          <Fact label="Trip">
            {alert.rideId ? (
              <Link href={`/admin/dashboard/rides?q=${alert.rideId}`}>
                {alert.rideId.slice(0, 8)}…
              </Link>
            ) : alert.interstateDepartureId ? (
              <span>Interstate trip</span>
            ) : (
              <span className="admin-sub">Not on a trip</span>
            )}
          </Fact>

          <Fact label="Raised">{formatDateTime(alert.createdAt)}</Fact>
        </div>

        {alert.note ? <p className="admin-alert-note">“{alert.note}”</p> : null}

        {alert.resolution ? (
          <p className="admin-alert-resolution">
            <strong>{alert.handledBy ?? "An operator"}:</strong> {alert.resolution}
          </p>
        ) : null}

        {isLive ? (
          <div className="admin-alert-actions">
            <Link
              href={`/admin/dashboard/users/${alert.user.id}`}
              className="admin-btn-ghost"
            >
              Open profile
            </Link>

            {alert.status === "OPEN" ? (
              <button
                type="button"
                className="admin-btn-secondary"
                disabled={busy}
                onClick={onAcknowledge}
              >
                {busy ? "Working…" : "I am on this"}
              </button>
            ) : (
              <span className="admin-sub">
                Taken by {alert.handledBy ?? "an operator"}
              </span>
            )}

            <button
              type="button"
              className="admin-btn-primary"
              disabled={busy}
              onClick={onResolve}
            >
              Resolve
            </button>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="admin-alert-fact">
      <span className="admin-alert-fact-label">{label}</span>
      <span className="admin-alert-fact-value">{children}</span>
    </div>
  );
}

function statusLabel(status: SafetyAlertStatus): string {
  switch (status) {
    case "OPEN":
      return "NEEDS ATTENTION";
    case "ACKNOWLEDGED":
      return "BEING HANDLED";
    case "RESOLVED":
      return "RESOLVED";
    case "CANCELLED":
      return "WITHDRAWN";
    default:
      return status;
  }
}
