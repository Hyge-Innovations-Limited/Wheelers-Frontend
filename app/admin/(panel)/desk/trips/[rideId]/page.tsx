"use client";

import Link from "next/link";
import { use } from "react";

import { Card, ErrorState, Spinner } from "@/components/admin/ui";
import { useAdminData } from "@/components/admin/use-admin-data";
import { Fact, TripStatus, type DeskTrip } from "@/components/admin/desk";
import { formatDateTime, formatDistance, humanise } from "@/lib/admin-format";

/**
 * One trip, for the support desk: who, where, when each step happened and
 * how it ended. Opened by its ID (WH-01234) or from a person or the inbox.
 * No fare, fees or payment.
 */
export default function DeskTripPage({ params }: { params: Promise<{ rideId: string }> }) {
  const { rideId } = use(params);
  const { data, error, loading, refresh } = useAdminData<{ trip: DeskTrip }>(`/admin/desk/trips/${encodeURIComponent(decodeURIComponent(rideId))}`);

  if (loading && !data) return <Spinner label="Loading the trip…" />;
  if (error) return <ErrorState error={error} onRetry={refresh} />;
  if (!data) return null;
  const t = data.trip;

  const steps: Array<[string, string | null]> = [
    ["Requested", t.requestedAt],
    ["Driver found", t.driverFoundAt],
    ["Driver arrived", t.arrivedAt],
    ["Trip started", t.startedAt],
    ["Trip finished", t.completedAt],
    ["Cancelled", t.cancelledAt],
  ];

  return (
    <>
      <Link href="/admin/desk" className="admin-back-btn">← People & trips</Link>
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">{t.trip}</h1>
          <p className="admin-page-sub"><TripStatus trip={t} /></p>
        </div>
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 320px", display: "flex", flexDirection: "column", gap: 16 }}>
          <Card title="Route" padded>
            <Fact label="From">{t.pickupAddress}</Fact>
            <Fact label="To">{t.destAddress}</Fact>
            <Fact label="Distance">{formatDistance(t.distanceKm)}</Fact>
            <Fact label="Booked on">{humanise(t.channel)}</Fact>
          </Card>
          <Card title="People" padded>
            <Fact label="Rider"><Link href={`/admin/desk/people/${t.rider.id}`}>{t.rider.name}</Link></Fact>
            <Fact label="Driver">{t.driver ? <Link href={`/admin/desk/people/${t.driver.id}`}>{t.driver.name}</Link> : "No driver yet"}</Fact>
            {t.driver ? <Fact label="Car">{[t.driver.car, t.driver.plate].filter(Boolean).join(" · ") || "—"}</Fact> : null}
          </Card>
        </div>
        <div style={{ flex: "1 1 320px" }}>
          <Card title="What happened" padded>
            {steps.filter(([, at]) => at).map(([label, at]) => <Fact key={label} label={label}>{formatDateTime(at)}</Fact>)}
            {t.cancelledAt ? (
              <>
                <Fact label="Cancelled when">{humanise(t.cancelStage)}</Fact>
                <Fact label="Why">{t.cancelReason ?? "—"}</Fact>
              </>
            ) : null}
          </Card>
        </div>
      </div>
    </>
  );
}
