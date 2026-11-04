"use client";

import Link from "next/link";
import { useState } from "react";

/**
 * A chat as admin reads it: the rider on the left, Wheelers (the bot) and
 * support on the right, the driver in their own colour, taps and trip moments
 * as small lines between. Same shape for a person's whole history and a trip.
 */

export type ChatWho = "rider" | "bot" | "driver" | "support" | "system";
export interface ChatItem {
  at: string;
  who: ChatWho;
  source: "whatsapp" | "trip_chat" | "call" | "support" | "page" | "trip";
  kind: string;
  text: string;
  rideId?: string | null;
  tripId?: string | null;
}

const time = (iso: string) =>
  new Date(iso).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Lagos" });

const WHERE: Record<ChatItem["source"], string> = {
  whatsapp: "WhatsApp",
  trip_chat: "Trip chat",
  call: "Call",
  support: "Support",
  page: "Booking page",
  trip: "Trip",
};

/** Taps, page steps, form steps, calls and trip moments: small lines, not bubbles. */
const isAction = (item: ChatItem) =>
  item.source === "page" || item.source === "call" || item.source === "trip" || item.kind === "tap" || (item.kind === "form" && item.who === "rider") || item.kind === "reaction";

const BUBBLE: Record<Exclude<ChatWho, "system">, { side: "left" | "right"; bg: string; label: string }> = {
  rider: { side: "left", bg: "#FFFFFF", label: "Rider" },
  driver: { side: "left", bg: "#E8F1FF", label: "Driver" },
  bot: { side: "right", bg: "#DCF8C6", label: "Wheelers" },
  support: { side: "right", bg: "#FFF1DC", label: "Support" },
};

export function ChatTimeline({ items, riderName, driverName }: { items: ChatItem[]; riderName?: string | null; driverName?: string | null }) {
  const [messagesOnly, setMessagesOnly] = useState(false);
  const shown = messagesOnly ? items.filter((i) => !isAction(i) || i.kind === "trip") : items;

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, justifySelf: "end" }}>
        <input type="checkbox" checked={messagesOnly} onChange={(e) => setMessagesOnly(e.target.checked)} />
        Messages only
      </label>
      <div style={{ display: "grid", gap: 8, background: "#EFEAE2", borderRadius: 12, padding: 12 }}>
        {shown.length === 0 ? <div style={{ textAlign: "center", color: "#786F68", fontSize: 13.5 }}>Nothing here.</div> : null}
        {shown.map((item, index) => {
          if (item.kind === "trip") {
            return (
              <div key={`${item.at}-${index}`} style={{ textAlign: "center", margin: "8px 0" }}>
                <span style={{ display: "inline-block", background: "#0d0d0d", color: "#fff", borderRadius: 999, padding: "6px 12px", fontSize: 12.5, fontWeight: 600 }}>
                  {item.text}
                </span>
                {item.rideId ? (
                  <div style={{ fontSize: 12, marginTop: 4, display: "flex", gap: 10, justifyContent: "center" }}>
                    <Link href={`/admin/dashboard/rides/${item.rideId}`}>Ride</Link>
                    <Link href={`/admin/dashboard/chats/trips/${item.rideId}`}>This trip only</Link>
                    <Link href={`/admin/dashboard/recordings?q=${item.rideId}`}>Recording</Link>
                  </div>
                ) : null}
              </div>
            );
          }
          if (isAction(item) || item.who === "system") {
            return (
              <div key={`${item.at}-${index}`} style={{ textAlign: "center", fontSize: 12, color: "#5f5853" }}>
                {item.who !== "system" ? <strong>{item.who === "driver" ? driverName || "Driver" : item.who === "bot" ? "Wheelers" : riderName || "Rider"}: </strong> : null}
                {item.text} · <span style={{ color: "#8C847D" }}>{WHERE[item.source]} · {time(item.at)}</span>
              </div>
            );
          }
          const look = BUBBLE[item.who as Exclude<ChatWho, "system">];
          const name = item.who === "rider" ? riderName || look.label : item.who === "driver" ? driverName || look.label : look.label;
          return (
            <div key={`${item.at}-${index}`} style={{ display: "flex", justifyContent: look.side === "left" ? "flex-start" : "flex-end" }}>
              <div style={{ maxWidth: "min(78%, 560px)", background: look.bg, borderRadius: 10, padding: "8px 10px", boxShadow: "0 1px 1px rgba(0,0,0,0.08)" }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: "#5f5853", marginBottom: 2 }}>{name}</div>
                <div style={{ fontSize: 14, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{item.text}</div>
                <div style={{ fontSize: 11, color: "#8C847D", textAlign: "right", marginTop: 4 }}>
                  {WHERE[item.source]}{item.tripId ? ` · ${item.tripId}` : ""} · {time(item.at)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
