"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { ChatTimeline, type ChatItem } from "@/components/admin/chat-timeline";
import { Card, ErrorState, PageHeader, Spinner } from "@/components/admin/ui";
import { useAdminData } from "@/components/admin/use-admin-data";

/** One trip: the rider's chat around it (30 minutes either side), its driver chat and calls, every tap. */

interface TripChat {
  ride: { rideId: string; tripId: string | null; status: string; pickup: string; dest: string; fareNgn: number | null; createdAt: string; endedAt: string | null };
  rider: { userId: string; name: string | null; phone: string | null } | null;
  driver: { userId: string; name: string | null } | null;
  items: ChatItem[];
}

export default function TripChatPage() {
  const { rideId } = useParams<{ rideId: string }>();
  const path = `/admin/chats/trips/${encodeURIComponent(rideId)}`;
  const { data, error, loading } = useAdminData<TripChat>(path, [path]);

  return (
    <>
      <PageHeader
        title={data?.ride.tripId ?? "Trip chat"}
        subtitle={data ? (
          <>
            {data.ride.pickup} → {data.ride.dest}
            {data.ride.fareNgn != null ? ` · ₦${data.ride.fareNgn.toLocaleString("en-NG")}` : ""} · {data.ride.status.toLowerCase().replace(/_/g, " ")}
            {data.rider ? <> · Rider <Link href={`/admin/dashboard/chats/people/${data.rider.userId}`}>{data.rider.name ?? "No name"}</Link></> : null}
            {data.driver ? <> · Driver <Link href={`/admin/dashboard/chats/people/${data.driver.userId}`}>{data.driver.name ?? "No name"}</Link></> : null}
            {" · "}<Link href={`/admin/dashboard/rides/${data.ride.rideId}`}>Ride</Link>
          </>
        ) : undefined}
      />
      {error && !data ? <ErrorState error={error} /> : null}
      {!data && loading ? <Spinner label="Loading chat" /> : null}
      {data ? (
        <Card padded>
          <ChatTimeline items={data.items} riderName={data.rider?.name} driverName={data.driver?.name} />
        </Card>
      ) : null}
    </>
  );
}
