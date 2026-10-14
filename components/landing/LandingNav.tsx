"use client";

import { useState } from "react";
import { WHATSAPP_URL } from "@/lib/landing-links";
import { ScrollProgress } from "./motion";

const LINKS = [
  { label: "Riders", href: "#riders" },
  { label: "Drivers", href: "#drivers" },
  { label: "How it works", href: "#how" },
];

export default function LandingNav() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <header className="wh-nav">
      {/* The header's bottom edge is a road: the car drives it as you scroll down the page. */}
      <ScrollProgress />
      <div className="wh-container wh-nav-row">
        <a href="#top" className="wh-nav-brand" onClick={close}>
          {/* The wordmark as the app shows it: the W and "wheelers" as one mark, in orange. */}
          <span className="wh-wordmark" role="img" aria-label="Wheelers" />
        </a>

        <nav className="wh-nav-links" aria-label="Primary">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href}>
              {l.label}
            </a>
          ))}
        </nav>

        <div className="wh-nav-ctas">
          <a href={WHATSAPP_URL} className="wh-btn wh-btn-mono wh-btn-wa" target="_blank" rel="noopener noreferrer">
            Ride on WhatsApp
          </a>
          <a href="#driverapp" className="wh-btn wh-btn-mono wh-btn-dark">
            Get the app
          </a>
        </div>

        <button
          type="button"
          className="wh-burger"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? (
            <span className="wh-burger-x">×</span>
          ) : (
            <span className="wh-burger-lines">
              <span />
              <span />
              <span />
            </span>
          )}
        </button>
      </div>

      {open && (
        <div className="wh-mobile-menu">
          <nav aria-label="Mobile">
            {LINKS.map((l) => (
              <a key={l.href} href={l.href} onClick={close}>
                {l.label}
              </a>
            ))}
          </nav>
          <div className="wh-mobile-ctas">
            <a href={WHATSAPP_URL} className="wh-btn wh-btn-mono wh-btn-wa" onClick={close} target="_blank" rel="noopener noreferrer">
              Ride on WhatsApp
            </a>
            <a href="#driverapp" className="wh-btn wh-btn-mono wh-btn-dark" onClick={close}>
              Get the app
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
