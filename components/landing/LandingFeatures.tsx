"use client";

import { Lines, Stagger, StaggerItem, Stamp } from "./motion";

const FEATURES = [
  { n: "01", title: "Name your price", body: "You decide what the trip is worth. Drivers who agree take it; the rest make you an offer. No surge, no surprises." },
  { n: "02", title: "WhatsApp first", body: "Book, pay and follow your ride without leaving the chat you already use every day. Works on any phone with WhatsApp." },
  { n: "03", title: "Or tap it in the app", body: "Wheelers on iPhone and Android: a live map, saved places, scheduled rides and every trip you have taken." },
  { n: "04", title: "Book ahead", body: "Sort tomorrow morning's ride tonight. We start finding your driver before you need them and tell you when they're on the way." },
  { n: "05", title: "Drivers you can check", body: "Every driver passes ID, licence and vehicle checks before their first trip. You see their name, car and plate before you get in." },
  { n: "06", title: "Paid on Stellar", body: "Top up in naira or XLM. Payments run on the Stellar network: settled in seconds, cents in fees, and on the record.", stellar: true },
]

export default function LandingFeatures() {
  return (
    <section id="features" className="wh-section" style={{ background: "#FFF8EC" }}>
      <div className="wh-container wh-section-inner">
        <div className="wh-section-head">
          <Stamp>
            <span className="wh-eyebrow">What you get</span>
          </Stamp>
          <Lines
            className="wh-h2"
            lines={[
              "Built for how",
              <>
                <span className="wh-serif">Lagos moves</span>
              </>,
            ]}
          />
        </div>

        {/* The six are stamped into the grid one after another. */}
        <Stagger className="wh-features" gap={0.08}>
          {FEATURES.map((f) => (
            <StaggerItem key={f.n} className="wh-feature">
              <span className="wh-feature-top">
                <span className="wh-feature-num">{f.n}</span>
                {"stellar" in f ? <span className="wh-brand-icon wh-brand-icon--stellar wh-feature-mark" role="img" aria-label="Stellar" /> : null}
              </span>
              <strong>{f.title}</strong>
              <span>{f.body}</span>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
