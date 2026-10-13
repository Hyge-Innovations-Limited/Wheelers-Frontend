"use client";

import { useEffect, useState } from "react";
import { WHATSAPP_URL } from "@/lib/landing-links";
import DriverScreens from "./DriverScreens";
import StoreBadges from "./StoreBadges";
import { WhatsAppIcon } from "./icons";

/** How long the phone stays on each of the driver's three screens. */
const SCREEN_MS = 3400;

export default function LandingHero() {
  // The phone is the driver's: online on the map, a request coming in, the trip under way.
  const [screen, setScreen] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => setScreen((current) => (current + 1) % 3), SCREEN_MS);
    return () => clearInterval(timer);
  }, []);

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
            {/* The driver's side of the app, in the driver side's own look and type. */}
            <div className="wh-phone-screen wh-phone-screen--drv">
              <DriverScreens active={screen} />
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
