"use client";

import { useEffect, useState } from "react";
import { WHATSAPP_URL } from "@/lib/landing-links";
import StoreBadges from "./StoreBadges";
import { WhatsAppIcon } from "./icons";

type Msg = { from: "rider" | "bot"; text: string; time: string; button?: string };

// The chat as Wheelers really writes it on WhatsApp: its own words, its own
// buttons, a price the rider names and a driver answering with an offer.
const SCRIPT: Msg[] = [
  { from: "rider", text: "Hey wassup 🤗", time: "2:37 PM" },
  {
    from: "bot",
    text: "Hi Timmy, where are you headed?\n\nSend your pickup and destination, e.g. *From Ikeja City Mall to Unilag gate, Yaba*. Or share your location first.",
    time: "2:37 PM",
    button: "Quick Actions",
  },
  { from: "rider", text: "I want to go from Ilemere Road to University of Lagos", time: "2:41 PM" },
  {
    from: "bot",
    text: "Pickup: *Ilemere Rd, Ikorodu*\n\nI found 3 places called \"University of Lagos\". Tap *Choose* and pick your destination.",
    time: "2:41 PM",
    button: "Choose",
  },
  { from: "bot", text: "Name your price, e.g. *6,650*.\nDrivers reply with their offers.", time: "2:42 PM", button: "Quick Actions" },
  { from: "rider", text: "6,500", time: "2:42 PM" },
  { from: "bot", text: "*Tunde* offers *₦7,000*\nToyota Corolla · 4.9★ · 4 min away\n\nYour price: ₦6,500", time: "2:43 PM", button: "Accept ₦7,000" },
];

/** WhatsApp's bold: *like this*. */
function Bold({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*[^*]+\*)/g).map((part, index) =>
        part.startsWith("*") && part.endsWith("*") && part.length > 2 ? <strong key={index}>{part.slice(1, -1)}</strong> : part,
      )}
    </>
  );
}

const CHAT_SPEED = 1;

function useChatDemo() {
  const [shown, setShown] = useState(1);

  useEffect(() => {
    const done = shown >= SCRIPT.length;
    const next = done ? null : SCRIPT[shown];
    const delay = done ? 4200 : next?.from === "bot" ? 1700 : 1200;
    const t = setTimeout(() => {
      setShown((s) => (s >= SCRIPT.length ? 1 : s + 1));
    }, delay / CHAT_SPEED);
    return () => clearTimeout(t);
  }, [shown]);

  return {
    msgs: SCRIPT.slice(0, shown),
    typing: shown < SCRIPT.length && SCRIPT[shown].from === "bot",
  };
}

export default function LandingHero() {
  const { msgs, typing } = useChatDemo();

  return (
    <section id="top" className="wh-hero wh-grid-bg">
      <div className="wh-container wh-hero-inner">
        <div className="wh-hero-copy" data-wh-reveal="1">
          <div className="wh-chips">
            <span className="wh-chip wh-chip-dark">A product of HYGE Innovations Limited</span>
            <span className="wh-chip wh-chip-peach">
              <span className="wh-live-dot" />
              Live in Lagos
            </span>
          </div>

          <h1 className="wh-h1">
            Ride from
            <br />
            WhatsApp or
            <br />
            the app. <span className="wh-serif">Drive</span>
            <br />
            and earn.
          </h1>

          <StoreBadges />

          <div className="wh-hero-wa">
            <a href={WHATSAPP_URL} className="wh-btn wh-btn-hero-wa" target="_blank" rel="noopener noreferrer">
              <WhatsAppIcon />
              Book a ride on WhatsApp
            </a>
          </div>
        </div>

        <div className="wh-hero-visual" data-wh-reveal="1" style={{ "--wh-d": "150ms" } as React.CSSProperties}>
          <div className="wh-hero-slab" />

          <div className="wh-phone">
            <div className="wh-phone-screen">
              <div className="wh-wa-header">
                <span className="wh-wa-back">←</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/wheelers-mark.svg" alt="" width={36} height={36} />
                <div className="wh-wa-header-text">
                  <strong>Wheelers</strong>
                </div>
                <span className="wh-wa-more" aria-hidden="true">⋮</span>
              </div>

              <div className="wh-wa-body" aria-live="polite">
                <div className="wh-wa-day">Today</div>
                {msgs.map((m, i) => (
                  <div key={i} className={`wh-wa-row wh-wa-row--${m.from}`}>
                    <div className="wh-wa-bubble">
                      <Bold text={m.text} />
                      <span className="wh-wa-time">{m.time}</span>
                      {m.button ? <span className="wh-wa-action">{m.button}</span> : null}
                    </div>
                  </div>
                ))}
                {typing && (
                  <div className="wh-wa-row wh-wa-row--bot">
                    <div className="wh-wa-typing">
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                )}
              </div>

              <div className="wh-wa-input">
                <div className="wh-wa-input-field">Message</div>
                <div className="wh-wa-send">➤</div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
