"use client";

import { Lines, Stagger, StaggerItem, Stamp } from "./motion";

const FEATURES = [
  { n: "01", title: "Group ride booking", body: "Split a ride with friends or colleagues heading the same way. One WhatsApp thread, multiple seats, shared cost." },
  { n: "02", title: "Instant seat matching", body: "Radar finds riders going your direction in real time. Hop into a moving trip or start one — no waiting around." },
  { n: "03", title: "Shared fare splitting", body: "Cost splits automatically between passengers. Everyone pays their share, nobody does the maths." },
  { n: "04", title: "Scheduled rides", body: "Book tomorrow morning tonight. Reminders land in the chat, driver is locked ahead of time." },
  { n: "05", title: "Verified both ways", body: "Every driver passes KYC before their first trip. Riders are tied to a real WhatsApp number. Safe seats, every time." },
  { n: "06", title: "Pay how you like", body: "Naira, card, wallet or USDT — with NGN-to-USDT conversion built in. No bank drama, just ride." },
];

export default function LandingFeatures() {
  return (
    <section id="features" className="wh-section" style={{ background: "#FFF8EC" }}>
      <div className="wh-container wh-section-inner">
        <div className="wh-section-head">
          <Stamp>
            <span className="wh-eyebrow">Platform features</span>
          </Stamp>
          <Lines
            className="wh-h2"
            lines={[
              "Built for",
              <>
                the <span className="wh-serif">next era</span>
              </>,
            ]}
          />
        </div>

        {/* The six are stamped into the grid one after another. */}
        <Stagger className="wh-features" gap={0.08}>
          {FEATURES.map((f) => (
            <StaggerItem key={f.n} className="wh-feature">
              <span className="wh-feature-num">{f.n}</span>
              <strong>{f.title}</strong>
              <span>{f.body}</span>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
