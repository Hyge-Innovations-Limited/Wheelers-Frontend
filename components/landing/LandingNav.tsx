"use client";

import { useState } from "react";
import { WHATSAPP_URL } from "@/lib/landing-links";

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
      <div className="wh-container wh-nav-row">
        <a href="#top" className="wh-nav-brand" onClick={close}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/wheelers-mark.svg" alt="Wheelers" width={40} height={40} />
          <span>Wheelers</span>
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
            Get the driver app
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
              Get the driver app
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
