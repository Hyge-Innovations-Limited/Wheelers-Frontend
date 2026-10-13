"use client";

import { AnimatePresence, motion } from "framer-motion";

/**
 * The driver's side of the Wheelers app, drawn as the app draws it: the map
 * with Today, Rating and Rides over it; a ride request coming in, with what
 * the driver earns; and the trip under way. `active` picks which of the three
 * is showing; the parent decides when it changes.
 */
const sheet = {
  initial: { opacity: 0, y: 40 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 30 },
  transition: { duration: 0.4, ease: [0.2, 0.7, 0.2, 1] as const },
};

export default function DriverScreens({ active }: { active: number }) {
  return (
    <div className="wh-drv">
      <div className="wh-drv-map">
        <svg viewBox="0 0 320 620" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <rect width="320" height="620" fill="#F3F0EA" />
          <path d="M0 470 C 70 440, 130 500, 200 468 S 290 440, 320 462 L320 620 L0 620 Z" fill="#A9D7EA" />
          <path d="M-10 120 L120 160 L210 110 L330 150" stroke="#FFFFFF" strokeWidth="9" fill="none" />
          <path d="M60 -10 L92 190 L70 380" stroke="#FFFFFF" strokeWidth="7" fill="none" />
          <path d="M236 -10 L214 220 L262 400" stroke="#FFFFFF" strokeWidth="7" fill="none" />
          <path d="M120 160 L160 330 L70 380" stroke="#FFFFFF" strokeWidth="5" fill="none" />
          {active > 0 ? (
            <motion.path
              d="M150 300 C 170 250, 200 230, 214 180"
              stroke="#FF7700"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray="2 10"
              fill="none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
            />
          ) : null}
        </svg>
        <span className="wh-drv-car" />
        {active > 0 ? <span className="wh-drv-pickup" /> : null}

        <div className="wh-drv-top">
          <span className="wh-drv-pill">
            <span className="wh-live-dot" />
            Online
          </span>
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {active === 0 ? (
          <motion.div key="home" className="wh-drv-bottom" {...sheet}>
            <div className="wh-drv-metrics">
              <div>
                <small>Today</small>
                <b className="wh-drv-orange">₦12,400</b>
              </div>
              <div>
                <small>Rating</small>
                <b>4.9</b>
              </div>
              <div>
                <small>Rides</small>
                <b>7</b>
              </div>
            </div>
            <span className="wh-drv-wait">Waiting for ride requests…</span>
            <span className="wh-drv-btn wh-drv-btn--ghost">Go offline</span>
          </motion.div>
        ) : null}

        {active === 1 ? (
          <motion.div key="request" className="wh-drv-bottom wh-drv-sheet" {...sheet}>
            <span className="wh-drv-tag">New ride request</span>
            <div className="wh-drv-route">
              <div>
                <span className="wh-drv-dot" />
                <b>Ilemere Rd, Ikorodu</b>
              </div>
              <div>
                <span className="wh-drv-dot wh-drv-dot--to" />
                <b>University of Lagos, Akoka</b>
              </div>
            </div>
            <div className="wh-drv-metrics wh-drv-metrics--flat">
              <div>
                <small>Est. fare</small>
                <b className="wh-drv-orange">₦6,500</b>
              </div>
              <div>
                <small>Distance</small>
                <b>34 km</b>
              </div>
              <div>
                <small>Expires</small>
                <b className="wh-drv-red">28s</b>
              </div>
            </div>
            <div className="wh-drv-earn">
              <span>You earn</span>
              <b>₦5,850</b>
            </div>
            <div className="wh-drv-actions">
              <span className="wh-drv-btn wh-drv-btn--ghost">Decline</span>
              <motion.span
                className="wh-drv-btn"
                animate={{ scale: [1, 1.04, 1] }}
                transition={{ delay: 1.4, duration: 0.5 }}>
                Accept ride
              </motion.span>
            </div>
          </motion.div>
        ) : null}

        {active === 2 ? (
          <motion.div key="trip" className="wh-drv-bottom wh-drv-sheet" {...sheet}>
            <span className="wh-drv-tag wh-drv-tag--on">Trip in progress · ₦6,500</span>
            <div className="wh-drv-rider">
              <span className="wh-drv-avatar">T</span>
              <div>
                <b>Timmy</b>
                <small>4 min to pickup · Ilemere Rd</small>
              </div>
            </div>
            <div className="wh-drv-actions">
              <span className="wh-drv-btn wh-drv-btn--ghost">Call</span>
              <span className="wh-drv-btn">I have arrived</span>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
