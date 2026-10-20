"use client";

import Link from "next/link";
import { use, useState } from "react";

import { Badge, Card, EmptyState, ErrorState, Spinner } from "@/components/admin/ui";
import { useAdminData } from "@/components/admin/use-admin-data";
import { DeskTripTable, Fact, type DeskTrip } from "@/components/admin/desk";
import { RevealPhone } from "@/components/admin/reveal-phone";
import { formatDate, formatWhen, humanise, initialsOf } from "@/lib/admin-format";

interface DeskProfile {
  person: { id: string; name: string; role: string; phone: string | null; email: string | null; joinedAt: string };
  driver: { online: boolean; status: string; documents: string; car: string | null; plate: string | null; rating: number } | null;
  trips: DeskTrip[];
  activity: Array<{ id: string; at: string; ok: boolean; action: string; message: string | null; rideId: string | null }>;
  chats: Array<{ id: string; status: "open" | "resolved"; topic: string | null; lastMessageAt: string; lastMessagePreview: string | null }>;
}

type Tab = "trips" | "activity" | "chats";

/**
 * One rider or driver, for the support desk: who they are, their trips, what
 * they tried in the app (and the errors they saw), and their chats with
 * support. The number is masked until asked for; nothing about money.
 */
export default function DeskPersonPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params);
  const [tab, setTab] = useState<Tab>("trips");
  const { data, error, loading, refresh } = useAdminData<DeskProfile>(`/admin/desk/people/${userId}`);

  if (loading && !data) return <Spinner label="Loading…" />;
  if (error) return <ErrorState error={error} onRetry={refresh} />;
  if (!data) return null;

  const { person, driver, trips, activity, chats } = data;
  const failed = activity.filter((a) => !a.ok).length;

  return (
    <>
      <Link href="/admin/desk" className="admin-back-btn">← People & trips</Link>

      <div className="admin-profile-head">
        <span className="admin-avatar lg">{initialsOf(person.name, "?")}</span>
        <div className="admin-profile-meta">
          <h1 className="admin-page-title">{person.name}</h1>
          <div className="admin-profile-tags">
            <Badge className="admin-badge gray">{driver ? `Driver · ${driver.online ? "online" : "offline"}` : humanise(person.role)}</Badge>
            {driver ? <Badge className="admin-badge gray">Documents {humanise(driver.documents).toLowerCase()}</Badge> : null}
            {driver?.rating ? <Badge className="admin-badge gray">★ {driver.rating.toFixed(2)}</Badge> : null}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", margin: "16px 0" }}>
        <div style={{ flex: "1 1 320px" }}>
          <Card title="Contact" padded>
            <Fact label="Phone"><RevealPhone userId={person.id} masked={person.phone} /></Fact>
            <Fact label="Email">{person.email ?? "—"}</Fact>
            <Fact label="Joined">{formatDate(person.joinedAt)}</Fact>
          </Card>
        </div>
        {driver ? (
          <div style={{ flex: "1 1 320px" }}>
            <Card title="Their car" padded>
              <Fact label="Car">{driver.car ?? "—"}</Fact>
              <Fact label="Plate">{driver.plate ?? "—"}</Fact>
              <Fact label="Now">{humanise(driver.status)}</Fact>
            </Card>
          </div>
        ) : null}
      </div>

      <div className="admin-tabs standalone">
        {([["trips", `Trips`, trips.length], ["activity", "Activity", activity.length], ["chats", "Chats with support", chats.length]] as const).map(([key, label, count]) => (
          <button key={key} type="button" className={`admin-tab${tab === key ? " active" : ""}`} onClick={() => setTab(key)}>
            {label} <span className="admin-tab-count">{count}</span>
          </button>
        ))}
      </div>

      {tab === "trips" ? (
        <Card title="Recent trips">
          <DeskTripTable trips={trips} empty="No trips yet." />
        </Card>
      ) : null}

      {tab === "activity" ? (
        <Card title="What they tried in the app" right={failed ? `${failed} problem${failed === 1 ? "" : "s"}` : undefined} padded>
          {activity.length === 0 ? <EmptyState>Nothing recorded yet.</EmptyState> : activity.map((a) => (
            <div key={a.id} style={{ padding: "10px 0", borderBottom: "1px solid #EFEAE2" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <strong>{a.action}</strong>
                <span style={{ color: "#786F68", fontSize: 13, whiteSpace: "nowrap" }}>{formatWhen(a.at)}</span>
              </div>
              {a.ok ? null : <div style={{ color: "#CC3333", fontSize: 14, marginTop: 2 }}>{a.message ?? "It did not work."}</div>}
              {a.rideId ? <Link href={`/admin/desk/trips/${a.rideId}`} style={{ fontSize: 13 }}>the trip</Link> : null}
            </div>
          ))}
        </Card>
      ) : null}

      {tab === "chats" ? (
        <Card title="Chats with support" padded>
          {chats.length === 0 ? <EmptyState>They have not written to support.</EmptyState> : chats.map((c) => (
            <div key={c.id} style={{ padding: "10px 0", borderBottom: "1px solid #EFEAE2" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <strong>{c.topic ?? "Chat"} {c.status === "open" ? <Badge className="admin-badge orange">Open</Badge> : <Badge>Resolved</Badge>}</strong>
                <span style={{ color: "#786F68", fontSize: 13, whiteSpace: "nowrap" }}>{formatWhen(c.lastMessageAt)}</span>
              </div>
              {c.lastMessagePreview ? <div style={{ fontSize: 14, color: "#4A443F", marginTop: 2 }}>{c.lastMessagePreview}</div> : null}
              <Link href={`/admin/dashboard/support?c=${c.id}`} style={{ fontSize: 13 }}>Open the chat</Link>
            </div>
          ))}
        </Card>
      ) : null}
    </>
  );
}
