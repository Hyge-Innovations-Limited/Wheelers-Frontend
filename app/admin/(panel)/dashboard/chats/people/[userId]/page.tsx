"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { adminJson } from "@/lib/admin-api";

import { ChatTimeline, type ChatItem } from "@/components/admin/chat-timeline";
import { Card, ErrorState, PageHeader, Spinner } from "@/components/admin/ui";

/** One person's whole chat with Wheelers, every trip inside it. Older pages load on demand. */

interface PersonChat { user: { userId: string; name: string | null; phone: string | null; joinedAt: string }; items: ChatItem[]; olderBefore: string | null }

export default function PersonChatPage() {
  const { userId } = useParams<{ userId: string }>();
  const [chat, setChat] = useState<PersonChat | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);

  useEffect(() => {
    let active = true;
    adminJson<PersonChat>(`/admin/chats/people/${encodeURIComponent(userId)}`)
      .then((body) => { if (active) setChat(body); })
      .catch((e) => { if (active) setError(e); });
    return () => { active = false; };
  }, [userId]);

  const older = async () => {
    if (!chat?.olderBefore) return;
    setLoadingOlder(true);
    try {
      const body = await adminJson<PersonChat>(`/admin/chats/people/${encodeURIComponent(userId)}?before=${encodeURIComponent(chat.olderBefore)}`);
      setChat({ ...chat, items: [...body.items, ...chat.items], olderBefore: body.olderBefore });
    } catch (e) {
      setError(e);
    } finally {
      setLoadingOlder(false);
    }
  };

  return (
    <>
      <PageHeader
        title={chat?.user.name ?? "Chat"}
        subtitle={chat ? <>{chat.user.phone ?? "No phone"} · <Link href={`/admin/dashboard/users/${chat.user.userId}`}>User page</Link> · <Link href="/admin/dashboard/chats">All chats</Link></> : undefined}
      />
      {error && !chat ? <ErrorState error={error} /> : null}
      {!chat && !error ? <Spinner label="Loading chat" /> : null}
      {chat ? (
        <Card padded>
          {chat.olderBefore ? (
            <div style={{ textAlign: "center", marginBottom: 10 }}>
              <button type="button" className="admin-btn-ghost" disabled={loadingOlder} onClick={() => void older()}>
                {loadingOlder ? "Loading…" : "Load older"}
              </button>
            </div>
          ) : null}
          <ChatTimeline items={chat.items} riderName={chat.user.name} />
        </Card>
      ) : null}
    </>
  );
}
