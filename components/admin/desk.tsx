"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { formatDistance, formatWhen, humanise, statusBadgeClass } from "@/lib/admin-format";
import { EmptyState, TableWrap } from "@/components/admin/ui";

/**
 * The support desk's people and trips, as the server sends them to it
 * (/admin/desk/*): with the number and email to reach someone, nothing about money.
 */
export interface DeskTrip {
  id: string;
  trip: string;
  status: string;
  live: boolean;
  channel: string;
  pickupAddress: string;
  destAddress: string;
  distanceKm: number | null;
  requestedAt: string | null;
  driverFoundAt: string | null;
  arrivedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelStage: string | null;
  cancelReason: string | null;
  rider: { id: string; name: string };
  driver: { id: string; name: string; car: string | null; plate: string | null } | null;
}

export interface DeskPerson {
  id: string;
  name: string;
  role: string;
  phone: string | null;
  email: string | null;
  joinedAt: string;
  driver: { online: boolean; documents: string } | null;
}

/** One line of a card: a label on the left, the fact on the right. */
export function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", borderBottom: "1px solid #EFEAE2", fontSize: 14 }}>
      <span style={{ color: "#786F68" }}>{label}</span>
      <strong style={{ textAlign: "right" }}>{children}</strong>
    </div>
  );
}

/** How a trip stands, in words: "Live now", "Completed", "Cancelled". */
export function TripStatus({ trip }: { trip: Pick<DeskTrip, "status" | "live"> }) {
  return trip.live
    ? <span className="admin-badge red">Live now · {humanise(trip.status)}</span>
    : <span className={statusBadgeClass(trip.status)}>{humanise(trip.status)}</span>;
}

/** A person's trips, newest first, each opening the trip page. No fares. */
export function DeskTripTable({ trips, empty }: { trips: DeskTrip[]; empty: string }) {
  if (trips.length === 0) return <EmptyState>{empty}</EmptyState>;
  return (
    <TableWrap>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Trip</th>
            <th>When</th>
            <th>Status</th>
            <th>Route</th>
            <th>Rider · Driver</th>
            <th>Distance</th>
          </tr>
        </thead>
        <tbody>
          {trips.map((t) => (
            <tr key={t.id}>
              <td><Link href={`/admin/desk/trips/${t.id}`}>{t.trip}</Link></td>
              <td>{formatWhen(t.requestedAt)}</td>
              <td><TripStatus trip={t} /></td>
              <td>{t.pickupAddress}<br /><span style={{ color: "#786F68" }}>→ {t.destAddress}</span></td>
              <td>{t.rider.name}<br /><span style={{ color: "#786F68" }}>{t.driver ? t.driver.name : "No driver"}</span></td>
              <td>{formatDistance(t.distanceKm)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableWrap>
  );
}
