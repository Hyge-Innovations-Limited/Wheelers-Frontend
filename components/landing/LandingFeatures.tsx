"use client";

import { Lines, Stagger, StaggerItem, Stamp } from "./motion";

const FEATURES = [
  { n: "01", title: "Name your price", body: "You know what the trip is worth. Say it, and drivers take it or come back with an offer. No surge pricing creeping up on you." },
  { n: "02", title: "WhatsApp first", body: "The chat you already open fifty times a day is all you need. Book, pay and follow your ride without downloading a thing." },
  { n: "03", title: "Or tap it in the app", body: "Wheelers on iPhone and Android: a live map, saved places, rides booked ahead and every trip you have taken." },
  { n: "04", title: "Book ahead", body: "Early flight? School run? Book tonight for tomorrow. We find your driver in good time and tell you when they're on the way." },
  { n: "05", title: "Drivers you can check", body: "Every driver passes ID, licence and vehicle checks before their first trip. You see who is coming, and in what car, before you step outside." },
  { n: "06", title: "Paid on Stellar", body: "Top up in naira or XLM. Payments settle on the Stellar network in seconds, for almost nothing, on a record nobody can quietly change.", stellar: true },
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
