"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { Badge, Card, EmptyState, ErrorState, FilterTabs, PageHeader, RefreshButton, Spinner } from "@/components/admin/ui";
import { useAdminData } from "@/components/admin/use-admin-data";
import { AdminApiError, adminJson } from "@/lib/admin-api";
import { useAdminSession } from "@/lib/admin-session";
import { RevealPhone } from "@/components/admin/reveal-phone";

/**
 * Support inbox: chats riders and drivers start from the app.
 *   left    who wrote in, waiting-for-an-answer first, with a mark on anyone on a live trip
 *   middle  the conversation, saved replies and the reply box
 *   right   the person, and the trip the chat is about, with both phone numbers
 * A reply reaches the person in the app at once and as a push. The lists
 * refresh on their own every few seconds.
 */

type Status = "open" | "resolved";

interface Person { id: string; name: string; phone: string | null; role: string; email?: string | null }
interface Row {
  id: string;
  status: Status;
  topic: string | null;
  person: Person;
  rideId: string | null;
  onLiveTrip: boolean;
  lastMessageAt: string;
  lastMessagePreview: string | null;
  unread: number;
  assignedTo: string | null;
}
interface Inbox { status: Status; counts: { open: number; waiting: number }; items: Row[] }
interface Message { id: string; from: "person" | "support"; senderName: string | null; content: string; createdAt: string }
interface Trip {
  id: string;
  status: string;
  live: boolean;
  pickupAddress: string;
  destAddress: string;
  fareNgn: number | null;
  startedAt: string | null;
  createdAt: string;
  rider: { name: string | null; phone: string | null } | null;
  driver: { name: string | null; phone: string | null; car: string | null; plate: string | null } | null;
}
interface Thread {
  conversation: { id: string; status: Status; topic: string | null; assignedTo: string | null; createdAt: string; resolvedAt: string | null; person: Person };
  messages: Message[];
  ride: Trip | null;
}

const SAVED_REPLIES = [
  "Thank you. I am checking your trip now and will stay with you in this chat.",
  "I am calling your driver now.",
  "Your refund is on its way to your wallet.",
  "Is everything okay now?",
];

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Lagos" });
const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Lagos" });
const naira = (value: number | null) => (value === null ? "—" : `₦${Math.round(value).toLocaleString("en-NG")}`);
const tripStatus = (status: string) => status.replace(/_/g, " ").toLowerCase();

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", borderBottom: "1px solid #EFEAE2", fontSize: 14 }}>
      <span style={{ color: "#786F68" }}>{label}</span>
      <strong style={{ textAlign: "right" }}>{children}</strong>
    </div>
  );
}

export default function SupportInboxPage() {
  const [status, setStatus] = useState<Status>("open");
  const [picked, setPicked] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState<"send" | "resolve" | "assign" | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  // The support desk: numbers masked (shown on asking), no fares, and its own profile and trip pages.
  const { isSupport } = useAdminSession();
  const profileHref = (id: string) => (isSupport ? `/admin/desk/people/${id}` : `/admin/dashboard/users/${id}`);
  const tripHref = (id: string) => (isSupport ? `/admin/desk/trips/${id}` : `/admin/dashboard/rides/${id}`);

  const inbox = useAdminData<Inbox>(`/admin/support/conversations?status=${status}`, [status], { refreshMs: 8_000 });
  const rows = inbox.data?.items ?? [];
  // Whoever is waiting longest is opened first; a pick the list no longer has falls back to it.
  const selected = picked && rows.some((row) => row.id === picked) ? picked : rows[0]?.id ?? null;
  const thread = useAdminData<Thread>(selected ? `/admin/support/conversations/${selected}` : null, [selected], { refreshMs: 5_000 });
  const open = thread.data && thread.data.conversation.id === selected ? thread.data : null;

  async function act(kind: "send" | "resolve" | "assign", content?: string) {
    if (!selected || busy) return;
    setBusy(kind);
    setProblem(null);
    try {
      if (kind === "send") {
        await adminJson(`/admin/support/conversations/${selected}/messages`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ content }),
        });
        setReply("");
      } else {
        await adminJson(`/admin/support/conversations/${selected}/${kind}`, { method: "POST" });
      }
      thread.refresh();
      inbox.refresh();
    } catch (error) {
      setProblem(error instanceof AdminApiError ? error.message : "That did not go through. Try again.");
    } finally {
      setBusy(null);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const content = reply.trim();
    if (content) void act("send", content);
  }

  return (
    <>
      <PageHeader
        title="Support inbox"
        subtitle={inbox.data ? `${inbox.data.counts.open} open · ${inbox.data.counts.waiting} waiting for an answer` : "Chats riders and drivers start from the app"}
        actions={<RefreshButton onClick={() => { inbox.refresh(); thread.refresh(); }} busy={inbox.loading} />}
      />

      <FilterTabs<Status>
        options={[{ value: "open", label: "Open", count: inbox.data?.counts.open }, { value: "resolved", label: "Resolved" }]}
        value={status}
        onChange={(value) => { setStatus(value); setPicked(null); }}
      />

      {inbox.error && !inbox.data ? <ErrorState error={inbox.error} onRetry={inbox.refresh} /> : null}
      {!inbox.data && inbox.loading ? <Spinner label="Loading the inbox" /> : null}

      {inbox.data ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start", marginTop: 16 }}>
          <div style={{ flex: "1 1 280px", minWidth: 0 }}>
            <Card title={status === "open" ? "Open chats" : "Resolved chats"} right={`${rows.length} shown`}>
              {rows.length === 0 ? <EmptyState>{status === "open" ? "Nobody is waiting. New chats show here on their own." : "No resolved chats yet."}</EmptyState> : (
                <div>
                  {rows.map((row) => (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => setPicked(row.id)}
                      aria-pressed={row.id === selected}
                      style={{
                        display: "flex", flexDirection: "column", gap: 4, width: "100%", padding: "12px 16px", textAlign: "left", cursor: "pointer",
                        border: "none", borderBottom: "1px solid #EFEAE2", borderLeft: `4px solid ${row.id === selected ? "#FF7700" : "transparent"}`,
                        background: row.id === selected ? "#FFF8F1" : "transparent", font: "inherit", color: "inherit",
                      }}>
                      <span style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <strong style={{ fontSize: 15 }}>{row.person.name}{row.person.role === "DRIVER" ? " (driver)" : ""}</strong>
                        <span style={{ fontSize: 12, color: "#786F68", whiteSpace: "nowrap" }}>{when(row.lastMessageAt)}</span>
                      </span>
                      <span style={{ fontSize: 14, color: "#5C534B", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{row.lastMessagePreview ?? "No messages"}</span>
                      <span style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {row.onLiveTrip ? <Badge className="admin-badge red">On a live trip</Badge> : null}
                        {row.unread > 0 ? <Badge className="admin-badge orange">{row.unread} new</Badge> : null}
                        {row.topic ? <Badge>{row.topic}</Badge> : null}
                        {row.assignedTo ? <Badge className="admin-badge blue">{row.assignedTo}</Badge> : null}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <div style={{ flex: "999 1 420px", minWidth: 0 }}>
            {!selected ? null : !open ? (
              thread.error ? <ErrorState error={thread.error} onRetry={thread.refresh} /> : <Spinner label="Opening the chat" />
            ) : (
              <Card
                title={`${open.conversation.person.name}${open.conversation.person.role === "DRIVER" ? " (driver)" : ""}`}
                right={open.conversation.status === "open" ? (open.conversation.assignedTo ? `With ${open.conversation.assignedTo}` : "Not taken yet") : `Resolved ${open.conversation.resolvedAt ? when(open.conversation.resolvedAt) : ""}`}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "12px 16px", borderBottom: "1px solid #EFEAE2" }}>
                  <button type="button" className="admin-btn-ghost" disabled={busy !== null} onClick={() => void act("assign")}>Assign to me</button>
                  {open.conversation.status === "open" ? (
                    <button type="button" className="admin-btn-secondary" disabled={busy !== null} onClick={() => void act("resolve")}>
                      {busy === "resolve" ? "Resolving" : "Mark resolved"}
                    </button>
                  ) : null}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 16, maxHeight: 460, overflowY: "auto" }}>
                  {open.messages.map((message) => (
                    <div
                      key={message.id}
                      style={{
                        alignSelf: message.from === "support" ? "flex-end" : "flex-start", maxWidth: "76%", padding: "10px 14px", fontSize: 15, lineHeight: 1.4,
                        borderRadius: message.from === "support" ? "18px 4px 18px 18px" : "4px 18px 18px 18px",
                        background: message.from === "support" ? "#0D0D0D" : "#FEFAEF", color: message.from === "support" ? "#FEFAEF" : "#0D0D0D",
                        border: message.from === "support" ? "none" : "1px solid #E6DFD2", whiteSpace: "pre-wrap", overflowWrap: "anywhere",
                      }}>
                      {message.content}
                      <div style={{ marginTop: 4, fontSize: 11, opacity: 0.7, textAlign: "right" }}>
                        {message.from === "support" ? `${message.senderName ?? "Support"} · ` : ""}{clock(message.createdAt)}
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "0 16px 10px" }}>
                  {SAVED_REPLIES.map((text) => (
                    <button key={text} type="button" className="admin-btn-ghost" disabled={busy !== null} onClick={() => void act("send", text)} style={{ fontSize: 13 }}>
                      {text}
                    </button>
                  ))}
                </div>

                <form onSubmit={submit} style={{ display: "flex", gap: 10, padding: "12px 16px 16px", borderTop: "1px solid #EFEAE2" }}>
                  <label htmlFor="support-reply" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Reply</label>
                  <input
                    id="support-reply"
                    className="admin-input"
                    value={reply}
                    onChange={(event) => setReply(event.target.value)}
                    maxLength={1000}
                    placeholder={`Reply to ${open.conversation.person.name.split(" ")[0]}`}
                    style={{ flex: 1, minWidth: 0 }}
                  />
                  <button type="submit" className="admin-btn-primary" disabled={busy !== null || !reply.trim()}>
                    {busy === "send" ? "Sending" : "Send"}
                  </button>
                </form>
                {problem ? <p role="alert" style={{ margin: 0, padding: "0 16px 14px", color: "#CC3333", fontSize: 14 }}>{problem}</p> : null}
              </Card>
            )}
          </div>

          {open ? (
            <div style={{ flex: "1 1 280px", minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>
              <Card title="Who wrote in" padded>
                <Fact label="Name">{open.conversation.person.name}</Fact>
                <Fact label="Account">{open.conversation.person.role === "DRIVER" ? "Driver" : "Rider"}</Fact>
                <Fact label="Phone">{isSupport
                  ? <RevealPhone key={open.conversation.person.id} userId={open.conversation.person.id} masked={open.conversation.person.phone} />
                  : open.conversation.person.phone ? <a href={`tel:${open.conversation.person.phone}`}>{open.conversation.person.phone}</a> : "—"}</Fact>
                <Fact label="Email">{open.conversation.person.email ?? "—"}</Fact>
                <Fact label="Chat started">{when(open.conversation.createdAt)}</Fact>
                {open.conversation.topic ? <Fact label="About">{open.conversation.topic}</Fact> : null}
                <p style={{ margin: "12px 0 0" }}><Link href={profileHref(open.conversation.person.id)}>Open their profile</Link></p>
              </Card>

              <Card title="The trip" right={open.ride ? (open.ride.live ? <Badge className="admin-badge red">Live now</Badge> : <Badge>{tripStatus(open.ride.status)}</Badge>) : undefined} padded>
                {!open.ride ? <EmptyState>This chat is not about a trip.</EmptyState> : (
                  <>
                    <Fact label="From">{open.ride.pickupAddress}</Fact>
                    <Fact label="To">{open.ride.destAddress}</Fact>
                    {isSupport ? null : <Fact label="Fare">{naira(open.ride.fareNgn)}</Fact>}
                    <Fact label={open.ride.startedAt ? "Started" : "Booked"}>{when(open.ride.startedAt ?? open.ride.createdAt)}</Fact>
                    <Fact label="Rider">{open.ride.rider?.name ?? "—"}{open.ride.rider?.phone ? <> · {isSupport ? open.ride.rider.phone : <a href={`tel:${open.ride.rider.phone}`}>{open.ride.rider.phone}</a>}</> : null}</Fact>
                    <Fact label="Driver">{open.ride.driver?.name ?? "No driver yet"}{open.ride.driver?.phone ? <> · {isSupport ? open.ride.driver.phone : <a href={`tel:${open.ride.driver.phone}`}>{open.ride.driver.phone}</a>}</> : null}</Fact>
                    {open.ride.driver ? <Fact label="Car">{[open.ride.driver.car, open.ride.driver.plate].filter(Boolean).join(" · ") || "—"}</Fact> : null}
                    <p style={{ margin: "12px 0 0", display: "flex", flexWrap: "wrap", gap: 12 }}>
                      <Link href={tripHref(open.ride.id)}>Open the trip</Link>
                      {open.ride.live && !isSupport ? <Link href="/admin/dashboard/live-map">See it on the live map</Link> : null}
                    </p>
                  </>
                )}
              </Card>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
