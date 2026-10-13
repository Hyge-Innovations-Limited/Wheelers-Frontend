"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

/**
 * How it works: four steps on the left, a phone on the right. The steps take
 * turns: every few seconds the next one lights up and the phone shows what
 * that step looks like in the Wheelers app itself: Home, Plan your trip,
 * Set your price, and the drivers' offers. Pointing at a step holds it; clicking one picks it.
 * With reduced motion on, nothing moves by itself and the last step shows.
 */
const STEPS = [
  { n: "01", title: "Open Wheelers", body: "In the app or on WhatsApp. Either way, your phone number is your account." },
  { n: "02", title: "Say where you're going", body: "Type pickup and destination, or drop a location pin." },
  { n: "03", title: "Name your price", body: "See the suggested price, then offer what you want to pay. Drivers reply with their offers." },
  {
    n: "04",
    title: "Choose your driver",
    body: "Each offer shows the driver's name, car and rating. Accept the one you want and track them to your door.",
  },
];

const STEP_MS = 3200;
const swap = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -14 },
  transition: { duration: 0.35, ease: [0.2, 0.7, 0.2, 1] as const },
};

export default function HowItWorks() {
  const still = useReducedMotion();
  const [active, setActive] = useState(still ? STEPS.length - 1 : 0);
  const [held, setHeld] = useState(false);

  useEffect(() => {
    if (still || held) return;
    const timer = setInterval(() => setActive((current) => (current + 1) % STEPS.length), STEP_MS);
    return () => clearInterval(timer);
  }, [still, held]);

  return (
    <section id="how" className="wh-section wh-how">
      <div className="wh-container wh-how-inner">
        <div className="wh-how-copy">
          <div className="wh-section-head" data-wh-reveal="1">
            <span className="wh-eyebrow">How it works</span>
            <h2 className="wh-h2">
              From &ldquo;hi&rdquo; to
              <br />
              <span className="wh-serif">picked up</span>
              <br />
              in four steps
            </h2>
          </div>

          <ol
            className="wh-steps"
            data-wh-reveal="1"
            style={{ "--wh-d": "120ms" } as React.CSSProperties}
            onMouseEnter={() => setHeld(true)}
            onMouseLeave={() => setHeld(false)}>
            {STEPS.map((s, index) => {
              const on = index === active;
              return (
                <li key={s.n} className={`wh-step wh-step--live${on ? " wh-step--on" : ""}`}>
                  {on ? <motion.span layoutId="wh-step-bar" className="wh-step-bar" transition={{ type: "spring", stiffness: 420, damping: 38 }} /> : null}
                  <button
                    type="button"
                    className="wh-step-btn"
                    aria-current={on ? "step" : undefined}
                    onClick={() => setActive(index)}
                    onFocus={() => setHeld(true)}
                    onBlur={() => setHeld(false)}>
                    <motion.span
                      className="wh-step-num"
                      animate={{ backgroundColor: on ? "#FF7700" : "#FFF8EC", scale: on ? 1.06 : 1 }}
                      transition={{ duration: 0.25 }}>
                      {s.n}
                    </motion.span>
                    <span className="wh-step-text">
                      <strong>{s.title}</strong>
                      <span>{s.body}</span>
                    </span>
                  </button>
                  {/* How long this step has left before the next one takes its turn. */}
                  {on && !still && !held ? (
                    <motion.span
                      key={`run-${index}`}
                      className="wh-step-run"
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: STEP_MS / 1000, ease: "linear" }}
                    />
                  ) : null}
                </li>
              );
            })}
          </ol>
        </div>

        <div id="driverapp" className="wh-driver-visual" data-wh-reveal="1" style={{ "--wh-d": "200ms" } as React.CSSProperties}>
          <div className="wh-dphone">
            {/* The rider's screens as the app draws them: cream, ink and orange, the app's own type. */}
            <div className="wh-dphone-screen wh-app">
              <AnimatePresence mode="wait" initial={false}>
                {active === 0 ? (
                  <motion.div key="home" className="wh-app-view" {...swap}>
                    <div className="wh-app-map">
                      <svg viewBox="0 0 320 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
                        <rect width="320" height="300" fill="#F3F0EA" />
                        <path d="M0 232 C 60 205, 120 250, 190 228 S 290 205, 320 222 L320 300 L0 300 Z" fill="#A9D7EA" />
                        <path d="M170 150 c22 -16 52 -6 56 16 c4 22 -22 38 -44 30 c-20 -8 -28 -32 -12 -46 Z" fill="#A9D7EA" />
                        <path d="M-10 70 L120 96 L210 60 L330 88" stroke="#FFFFFF" strokeWidth="7" fill="none" />
                        <path d="M60 -10 L88 110 L70 210" stroke="#FFFFFF" strokeWidth="5" fill="none" />
                        <path d="M230 -10 L214 120 L250 200" stroke="#FFFFFF" strokeWidth="5" fill="none" />
                        <path d="M120 96 L150 170" stroke="#FFFFFF" strokeWidth="4" fill="none" />
                      </svg>
                      <span className="wh-app-place" style={{ left: "14%", top: "52%" }}>Ibeshe</span>
                      <span className="wh-app-place" style={{ left: "50%", top: "70%" }}>Ilemere</span>
                      <span className="wh-app-me" />
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img className="wh-app-tile" src="/wheelers-mark.svg" alt="" width={40} height={40} />
                      <span className="wh-app-wallet">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#FF7700" strokeWidth="2" aria-hidden="true"><rect x="3" y="6" width="18" height="13" rx="3" /><path d="M16 12.5h2" /></svg>
                        ₦4,200
                      </span>
                    </div>
                    <div className="wh-app-sheet">
                      <span className="wh-app-handle" />
                      <strong className="wh-app-title">Where are you going?</strong>
                      <div className="wh-app-row">
                        <span className="wh-app-search">
                          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
                          Search destination
                        </span>
                        <span className="wh-app-later">Later</span>
                      </div>
                      <span className="wh-app-label">Last ride</span>
                      <div className="wh-app-row">
                        <span className="wh-app-chip wh-app-chip--ink">
                          <b>Repeat</b>
                          <small>Ilemere Rd to Ikorodu…</small>
                        </span>
                        <span className="wh-app-chip">
                          <b>Reverse</b>
                          <small>Ikorodu Garage to Ile…</small>
                        </span>
                      </div>
                    </div>
                    <AppTabs />
                  </motion.div>
                ) : null}

                {active === 1 ? (
                  <motion.div key="plan" className="wh-app-view wh-app-view--pad" {...swap}>
                    <div className="wh-app-head">
                      <span className="wh-app-back">‹</span>
                      <strong className="wh-app-title wh-app-title--sm">Plan your trip</strong>
                    </div>
                    <div className="wh-app-fields">
                      <div className="wh-app-field">
                        <span className="wh-app-dot" />
                        <small>FROM</small>
                        <b>Ilemere Rd, Ikorodu</b>
                      </div>
                      <div className="wh-app-field wh-app-field--on">
                        <span className="wh-app-dot wh-app-dot--to" />
                        <small>TO</small>
                        <Typed text="University of Lagos" />
                      </div>
                    </div>
                    <span className="wh-app-label">Matching places</span>
                    {["University of Lagos, Akoka", "University of Lagos Gate, Yaba", "UNILAG Senate Building"].map((place, index) => (
                      <motion.div
                        key={place}
                        className="wh-app-result"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 1.1 + index * 0.14, duration: 0.3 }}>
                        <span className="wh-app-pin" />
                        <div>
                          <b>{place}</b>
                          <small>Lagos</small>
                        </div>
                      </motion.div>
                    ))}
                    <span className="wh-app-cta">Continue</span>
                  </motion.div>
                ) : null}

                {active === 2 ? (
                  <motion.div key="price" className="wh-app-view wh-app-view--pad" {...swap}>
                    <div className="wh-app-head">
                      <span className="wh-app-back">‹</span>
                      <strong className="wh-app-title wh-app-title--sm">Set your price</strong>
                    </div>
                    <div className="wh-app-trip">
                      <small>Ilemere Rd → University of Lagos</small>
                      <small>34 km · about 58 min</small>
                    </div>
                    <div className="wh-app-price">
                      <span className="wh-app-step">−</span>
                      <motion.strong
                        initial={{ scale: 0.9, opacity: 0.4 }}
                        animate={{ scale: [0.9, 1.08, 1], opacity: 1 }}
                        transition={{ delay: 0.4, duration: 0.5 }}>
                        ₦6,500
                      </motion.strong>
                      <span className="wh-app-step">+</span>
                    </div>
                    <div className="wh-app-suggest">
                      <span>Suggested price</span>
                      <b>₦7,350</b>
                    </div>
                    <small className="wh-app-note">You are offering ₦850 under the suggested price.</small>
                    <span className="wh-app-cta">Find drivers</span>
                  </motion.div>
                ) : null}

                {active === 3 ? (
                  <motion.div key="offers" className="wh-app-view wh-app-view--pad" {...swap}>
                    <div className="wh-app-head">
                      <strong className="wh-app-title wh-app-title--sm">Driver offers</strong>
                      <span className="wh-app-yours">Your price ₦6,500</span>
                    </div>
                    {[
                      { initials: "TA", name: "Tunde A.", car: "Toyota Corolla · LAG-482-XY", meta: "4.9★ · 4 min away", price: "₦6,500", best: true },
                      { initials: "AU", name: "Amaka U.", car: "Honda Civic · GGE-845-TL", meta: "5.0★ · 6 min away", price: "₦7,000", best: false },
                    ].map((offer, index) => (
                      <motion.div
                        key={offer.name}
                        className={`wh-app-offer${offer.best ? " wh-app-offer--best" : ""}`}
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.25 + index * 0.45, duration: 0.35 }}>
                        <div className="wh-app-offer-top">
                          <span className="wh-app-avatar">{offer.initials}</span>
                          <div>
                            <b>{offer.name}</b>
                            <small>{offer.car}</small>
                            <small>{offer.meta}</small>
                          </div>
                          <strong>{offer.price}</strong>
                        </div>
                        <div className="wh-app-offer-actions">
                          <span className="wh-app-accept">Accept</span>
                          <span className="wh-app-decline">Decline</span>
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}


/** The app's tab bar: Ride, Trips, Wallet, You. */
function AppTabs() {
  return (
    <div className="wh-app-tabs" aria-hidden="true">
      {["Ride", "Trips", "Wallet", "You"].map((tab, index) => (
        <span key={tab} className={index === 0 ? "wh-app-tab wh-app-tab--on" : "wh-app-tab"}>
          <i />
          {tab}
        </span>
      ))}
    </div>
  );
}

/** A destination being typed, a letter at a time. */
function Typed({ text }: { text: string }) {
  const still = useReducedMotion();
  const [shown, setShown] = useState(still ? text.length : 0);
  useEffect(() => {
    if (still || shown >= text.length) return;
    const timer = setTimeout(() => setShown((count) => count + 1), 45);
    return () => clearTimeout(timer);
  }, [shown, still, text.length]);
  return (
    <b>
      {text.slice(0, shown)}
      {shown < text.length ? <span className="wh-app-caret" /> : null}
    </b>
  );
}
