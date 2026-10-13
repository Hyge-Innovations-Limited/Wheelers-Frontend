"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

/**
 * How it works: four steps on the left, a WhatsApp chat with Wheelers on the
 * right. The heading says it starts with "hi", so that is what the phone
 * shows: the steps take turns, and with each one the chat moves on, in the
 * words and buttons Wheelers really uses. Pointing at a step holds it;
 * clicking one picks it. With reduced motion on, nothing moves by itself and
 * the whole chat shows.
 */
const STEPS = [
  { n: "01", title: "Say hi", body: "Message Wheelers on WhatsApp, or open the app. Your phone number is your account." },
  { n: "02", title: "Say where you're going", body: "Type pickup and destination, or drop a location pin." },
  { n: "03", title: "Name your price", body: "Offer what you want to pay. Drivers reply with their offers." },
  {
    n: "04",
    title: "Choose your driver",
    body: "Each offer shows the driver's name, car and rating. Accept the one you want and track them to your door.",
  },
];

type Msg = { step: number; from: "rider" | "bot"; text: string; time: string; button?: string };

// The chat as Wheelers writes it, a part for each step.
const CHAT: Msg[] = [
  { step: 0, from: "rider", text: "Hi 👋", time: "2:37 PM" },
  {
    step: 0,
    from: "bot",
    text: "Hi Timmy, where are you headed?\n\nSend your pickup and destination, e.g. *From Ikeja City Mall to Unilag gate, Yaba*. Or share your location first.",
    time: "2:37 PM",
    button: "Quick Actions",
  },
  { step: 1, from: "rider", text: "I want to go from Ilemere Road to University of Lagos", time: "2:41 PM" },
  {
    step: 1,
    from: "bot",
    text: "Pickup: *Ilemere Rd, Ikorodu*\n\nI found 3 places called \"University of Lagos\". Tap *Choose* and pick your destination.",
    time: "2:41 PM",
    button: "Choose",
  },
  { step: 2, from: "bot", text: "Name your price, e.g. *6,650*.\nDrivers reply with their offers.", time: "2:42 PM" },
  { step: 2, from: "rider", text: "6,500", time: "2:42 PM" },
  { step: 3, from: "bot", text: "*Tunde* offers *₦7,000*\nToyota Corolla · 4.9★ · 4 min away\n\nYour price: ₦6,500", time: "2:43 PM", button: "Accept ₦7,000" },
];

const STEP_MS = 3600;

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

export default function HowItWorks() {
  const still = useReducedMotion();
  const [active, setActive] = useState(still ? STEPS.length - 1 : 0);
  const [held, setHeld] = useState(false);

  useEffect(() => {
    if (still || held) return;
    const timer = setInterval(() => setActive((current) => (current + 1) % STEPS.length), STEP_MS);
    return () => clearInterval(timer);
  }, [still, held]);

  // Everything said up to and including this step; the newest part arrives a line at a time.
  const said = CHAT.filter((message) => message.step <= active);
  const firstNew = said.findIndex((message) => message.step === active);

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
            <div className="wh-dphone-screen wh-dphone-screen--wa">
              <div className="wh-wa-header">
                <span className="wh-wa-back">←</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/wheelers-mark.svg" alt="" width={36} height={36} />
                <div className="wh-wa-header-text">
                  <strong>Wheelers</strong>
                </div>
                <span className="wh-wa-more" aria-hidden="true">⋮</span>
              </div>

              <div className="wh-wa-body" aria-live="polite">
                <div className="wh-wa-day">Today</div>
                <AnimatePresence initial={false}>
                  {said.map((message, index) => (
                    <motion.div
                      key={`${message.step}-${index}`}
                      layout
                      className={`wh-wa-row wh-wa-row--plain wh-wa-row--${message.from}`}
                      initial={{ opacity: 0, y: 14, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, transition: { duration: 0.15 } }}
                      transition={{ delay: index >= firstNew && !still ? 0.15 + (index - firstNew) * 0.9 : 0, duration: 0.3 }}>
                      <div className="wh-wa-bubble">
                        <Bold text={message.text} />
                        <span className="wh-wa-time">{message.time}</span>
                        {message.button ? <span className="wh-wa-action">{message.button}</span> : null}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              <div className="wh-wa-input">
                <div className="wh-wa-input-field">Message</div>
                <div className="wh-wa-send">➤</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
