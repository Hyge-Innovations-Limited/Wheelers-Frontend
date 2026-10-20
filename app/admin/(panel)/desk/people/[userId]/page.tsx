"use client";

import Link from "next/link";
import { use, useState, type FormEvent } from "react";

import { Badge, Card, EmptyState, ErrorState, Spinner } from "@/components/admin/ui";
import { useAdminData } from "@/components/admin/use-admin-data";
import { DeskTripTable, Fact, type DeskTrip } from "@/components/admin/desk";
import { adminJson } from "@/lib/admin-api";
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
 * One rider or driver, for the support desk: how to reach them, their trips,
 * what they tried in the app (and the errors they saw), their chats with
 * support, and a box to message them: it lands in their app's support chat
 * with a notification, and the chat is then in the inbox. Nothing about money.
 */
export default function DeskPersonPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params);
  const [tab, setTab] = useState<Tab>("trips");
  const { data, error, loading, refresh } = useAdminData<DeskProfile>(`/admin/desk/people/${userId}`);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  async function send(event: FormEvent) {
    event.preventDefault();
    const content = message.trim();
    if (!content || sending) return;
    setSending(true);
    setProblem(null);
    try {
      const result = await adminJson<{ conversationId: string }>(`/admin/support/people/${userId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      setSent(result.conversationId);
      setMessage("");
      refresh();
    } catch (failure) {
      setProblem(failure instanceof Error ? failure.message : "It did not send. Try again.");
    } finally {
      setSending(false);
    }
  }

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
            <Fact label="Phone">{person.phone ? <a href={`tel:${person.phone}`}>{person.phone}</a> : "—"}</Fact>
            <Fact label="Email">{person.email ? <a href={`mailto:${person.email}`}>{person.email}</a> : "—"}</Fact>
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

      <Card title={`Message ${person.name}`} padded>
        <form onSubmit={(event) => void send(event)} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <textarea
            className="admin-input"
            style={{ minHeight: 90, padding: 12, resize: "vertical" }}
            value={message}
            maxLength={1000}
            onChange={(event) => { setMessage(event.target.value); setSent(null); }}
            placeholder="Write to them. It arrives in their Wheelers app, in the chat with support, with a notification."
            aria-label={`Message to ${person.name}`}
          />
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <button type="submit" className="admin-btn-primary" disabled={!message.trim() || sending}>{sending ? "Sending…" : "Send"}</button>
            {sent ? <span style={{ color: "#1E7F4F", fontSize: 14 }}>Sent. Their reply comes to the inbox. <Link href={`/admin/dashboard/support?c=${sent}`}>Open the chat</Link></span> : null}
            {problem ? <span role="alert" style={{ color: "#CC3333", fontSize: 14 }}>{problem}</span> : null}
          </div>
        </form>
      </Card>

      <div style={{ height: 16 }} />

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
