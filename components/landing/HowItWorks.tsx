"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

/**
 * How it works: four steps on the left, a phone on the right. The steps take
 * turns: every few seconds the next one lights up and the phone shows what
 * that step looks like (opening Wheelers, the trip, the fare, the driver's
 * side accepting it). Pointing at a step holds it; clicking one picks it.
 * With reduced motion on, nothing moves by itself and the last step shows.
 */
const STEPS = [
  { n: "01", title: "Open Wheelers", body: "In the app or on WhatsApp. Either way, your phone number is your account." },
  { n: "02", title: "Say where you're going", body: "Type pickup and destination, or drop a location pin." },
  { n: "03", title: "Get a fixed fare", body: "Price, distance and ETA come back in seconds. Confirm to lock it." },
  {
    n: "04",
    title: "Driver matched",
    body: "A verified driver accepts on their side. You get their name, plate and live tracking, in the app or the chat.",
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
            <div className="wh-dphone-screen">
              <div className="wh-dphone-top">
                {/* The wordmark as the app shows it, in place of the old square tile. */}
                <span className="wh-wordmark wh-wordmark--sm" role="img" aria-label="Wheelers" />
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span key={active === 3 ? "driver" : "rider"} className="wh-dphone-online" {...swap}>
                    <span className="wh-live-dot" />
                    {active === 3 ? "Driver · online" : "Rider"}
                  </motion.span>
                </AnimatePresence>
              </div>

              <div className="wh-dphone-stage">
                <AnimatePresence mode="wait" initial={false}>
                  {active === 0 ? (
                    <motion.div key="open" className="wh-dstep" {...swap}>
                      <span className="wh-dstep-label">Two ways in</span>
                      <div className="wh-dstep-door wh-dstep-door--app">
                        <strong>The Wheelers app</strong>
                        <span>iPhone and Android</span>
                      </div>
                      <div className="wh-dstep-door wh-dstep-door--wa">
                        <strong>WhatsApp</strong>
                        <span>Say hi to Wheelers. Nothing to install.</span>
                      </div>
                      <div className="wh-dstep-bubble">Hi 👋</div>
                    </motion.div>
                  ) : null}

                  {active === 1 ? (
                    <motion.div key="where" className="wh-dstep" {...swap}>
                      <span className="wh-dstep-label">Plan your trip</span>
                      <div className="wh-dstep-route">
                        <div className="wh-dstep-stop">
                          <span className="wh-dstep-dot" />
                          <div>
                            <small>From</small>
                            <strong>Admiralty Way, Lekki</strong>
                          </div>
                        </div>
                        <div className="wh-dstep-stop">
                          <span className="wh-dstep-dot wh-dstep-dot--to" />
                          <div>
                            <small>To</small>
                            <motion.strong initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5, duration: 0.4 }}>
                              Ozumba Mbadiwe, VI
                            </motion.strong>
                          </div>
                        </div>
                      </div>
                      <div className="wh-dphone-map wh-dphone-map--short">
                        <span className="wh-map-me" />
                        <span className="wh-map-ping" />
                        <span className="wh-map-rider" />
                        <svg viewBox="0 0 300 200" preserveAspectRatio="none" className="wh-map-route" aria-hidden="true">
                          <motion.path
                            d="M108 78 C 150 70, 170 60, 196 46"
                            stroke="#FF7700"
                            strokeWidth="4"
                            fill="none"
                            initial={{ pathLength: 0 }}
                            animate={{ pathLength: 1 }}
                            transition={{ delay: 0.6, duration: 0.9, ease: "easeOut" }}
                          />
                        </svg>
                      </div>
                    </motion.div>
                  ) : null}

                  {active === 2 ? (
                    <motion.div key="fare" className="wh-dstep" {...swap}>
                      <span className="wh-dstep-label">Your fare</span>
                      <div className="wh-dphone-earn">
                        <span className="wh-dphone-earn-label">Admiralty Way → Ozumba Mbadiwe</span>
                        <span className="wh-dphone-earn-amt">₦5,684</span>
                        <span className="wh-dphone-earn-delta">18 km · about 24 min</span>
                      </div>
                      <motion.div
                        className="wh-dstep-confirm"
                        initial={{ scale: 0.96 }}
                        animate={{ scale: [0.96, 1.02, 1] }}
                        transition={{ delay: 0.9, duration: 0.5 }}>
                        Confirm this fare
                      </motion.div>
                      <span className="wh-dstep-note">The price you see is the price you pay.</span>
                    </motion.div>
                  ) : null}

                  {active === 3 ? (
                    <motion.div key="match" className="wh-dstep" {...swap}>
                      <div className="wh-dphone-earn">
                        <span className="wh-dphone-earn-label">Earned today</span>
                        <span className="wh-dphone-earn-amt">₦12,400</span>
                        <span className="wh-dphone-earn-delta">↑ 18% vs yesterday · 7 trips</span>
                      </div>
                      <div className="wh-dphone-req">
                        <div className="wh-dphone-req-top">
                          <span className="wh-dphone-req-label">New request · 0:28</span>
                          <span className="wh-dphone-req-fare">₦5,684</span>
                        </div>
                        <span className="wh-dphone-req-route">Admiralty Way → Ozumba Mbadiwe</span>
                        <span className="wh-dphone-req-meta">18 km · 2 min to pickup</span>
                        <div className="wh-dphone-req-actions">
                          <motion.span
                            className="wh-dphone-accept"
                            animate={{ scale: [1, 1.05, 1] }}
                            transition={{ delay: 0.8, duration: 0.5 }}>
                            Accept
                          </motion.span>
                          <span className="wh-dphone-skip">Skip</span>
                        </div>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
