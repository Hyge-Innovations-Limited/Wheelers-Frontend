"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { WHATSAPP_URL } from "@/lib/landing-links";
import { Drift, Lines, Stagger, StaggerItem, Stamp } from "./motion";
import StoreBadges from "./StoreBadges";
import { WhatsAppIcon } from "./icons";

type Msg = { from: "rider" | "bot"; text: string; time: string; button?: string };

// The chat in Wheelers' own words: where to, a price the rider names, a driver's offer.
const SCRIPT: Msg[] = [
  { from: "rider", text: "Hi, I need a ride from Admiralty Way, Lekki to Ozumba Mbadiwe, VI", time: "08:24" },
  { from: "bot", text: "Pickup: *Admiralty Way, Lekki*\nTo: *Ozumba Mbadiwe, VI*\n\nName your price, e.g. *6,650*.\nDrivers reply with their offers.", time: "08:24", button: "Quick Actions" },
  { from: "rider", text: "5,500", time: "08:25" },
  { from: "bot", text: "*Adebayo* offers *₦5,700*\nToyota Camry · 4.8★ · 2 min away\n\nYour price: ₦5,500", time: "08:25", button: "Accept ₦5,700" },
  { from: "bot", text: "Driver confirmed\nAdebayo F. · Toyota Camry · KJA-482-XY\nTrack him live in this chat.", time: "08:26" },
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
        <div className="wh-hero-copy">
          {/* The opening: the two tags are stamped down, the headline comes up line by line, then the ways in. */}
          <Stagger className="wh-chips" gap={0.09} onLoad>
            <StaggerItem>
              <span className="wh-chip wh-chip-dark">A product of HYGE Innovations Limited</span>
            </StaggerItem>
            <StaggerItem>
              <span className="wh-chip wh-chip-peach">
                <span className="wh-live-dot" />
                Live in Lagos
              </span>
            </StaggerItem>
          </Stagger>

          <Lines
            as="h1"
            className="wh-h1"
            delay={0.18}
            onLoad
            lines={[
              "Ride from",
              "WhatsApp or",
              <>
                the app. <span className="wh-serif">Drive</span>
              </>,
              "and earn.",
            ]}
          />

          <Stamp delay={0.62} onLoad>
            <StoreBadges />
          </Stamp>

          <Stamp className="wh-hero-wa" delay={0.76} onLoad>
            <a href={WHATSAPP_URL} className="wh-btn wh-btn-hero-wa" target="_blank" rel="noopener noreferrer">
              <WhatsAppIcon />
              Book a ride on WhatsApp
            </a>
          </Stamp>
        </div>

        <div className="wh-hero-visual">
          {/* The orange slab swings into place behind the phone, then drifts against the scroll. */}
          <Drift className="wh-hero-slab-drift" distance={-90} turn={5}>
            <motion.div
              className="wh-hero-slab"
              initial={{ opacity: 0, rotate: -22, scale: 0.8 }}
              animate={{ opacity: 1, rotate: -4, scale: 1 }}
              transition={{ type: "spring", stiffness: 120, damping: 14, delay: 0.5 }}
            />
          </Drift>

          <motion.div
            className="wh-phone"
            initial={{ opacity: 0, y: 90, rotate: 5 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{ type: "spring", stiffness: 110, damping: 17, delay: 0.3 }}>
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
          </motion.div>

          <motion.div
            className="wh-toast"
            aria-hidden="true"
            initial={{ opacity: 0, x: -50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20, delay: 1.3 }}>
            <span className="wh-toast-label">Driver app · new request</span>
            <span className="wh-toast-route">Lekki → Victoria Island</span>
            <span className="wh-toast-meta">Rider offers ₦5,500 · 18 km · 2 min to pickup</span>
            <div className="wh-toast-actions">
              <span className="wh-toast-accept">Accept</span>
              <span className="wh-toast-skip">Skip</span>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
