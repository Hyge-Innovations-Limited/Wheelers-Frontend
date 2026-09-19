"use client";

import { useEffect, useState } from "react";
import { WHATSAPP_URL } from "@/lib/landing-links";
import StoreBadges from "./StoreBadges";
import { WhatsAppIcon } from "./icons";

type Msg = { from: "rider" | "bot"; text: string; time: string };

const SCRIPT: Msg[] = [
  { from: "rider", text: "Hi, I need a ride from Admiralty Way, Lekki to Ozumba Mbadiwe, VI", time: "08:24" },
  { from: "bot", text: "Got it. Fixed fare for this trip:\n₦5,684 · 18 km · ~24 min\n\nReply 1 to book\nReply 2 to change pickup", time: "08:24" },
  { from: "rider", text: "1", time: "08:25" },
  { from: "bot", text: "Booked. Pinging verified drivers near Lekki…", time: "08:25" },
  { from: "bot", text: "Driver matched\nAdebayo F. · Toyota Camry · KJA-482-XY\n2 min away · 4.8★ · 1,203 trips", time: "08:25" },
  { from: "bot", text: "Track live: wheelersng.com/t/8F2K\nPay in cash, card or wallet when you arrive.", time: "08:25" },
];

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
            WhatsApp.
            <br />
            <span className="wh-serif">Drive</span> from
            <br />
            the app.
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
                <span className="wh-wa-back">‹</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/wheelers-mark.svg" alt="" width={36} height={36} />
                <div className="wh-wa-header-text">
                  <strong>Wheelers</strong>
                  <small>Business account · replies instantly</small>
                </div>
              </div>

              <div className="wh-wa-body" aria-live="polite">
                <div className="wh-wa-day">Today</div>
                {msgs.map((m, i) => (
                  <div key={i} className={`wh-wa-row wh-wa-row--${m.from}`}>
                    <div className="wh-wa-bubble">
                      {m.text}
                      <span className="wh-wa-time">{m.time}</span>
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

          <div className="wh-toast" aria-hidden="true">
            <span className="wh-toast-label">Driver app · new request</span>
            <span className="wh-toast-route">Lekki → Victoria Island</span>
            <span className="wh-toast-meta">₦5,684 · 18 km · 2 min to pickup</span>
            <div className="wh-toast-actions">
              <span className="wh-toast-accept">Accept</span>
              <span className="wh-toast-skip">Skip</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
