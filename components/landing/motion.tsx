"use client";

import {
  AnimatePresence,
  motion,
  useAnimationFrame,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  useVelocity,
  type Variants,
} from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * The landing page's motion, in one vocabulary. The page is hard edges, thick
 * ink and flat shadows, so nothing floats or fades politely: lines come up
 * from behind a rule, blocks are stamped down, shadows are thrown, and the
 * road (the ticker, the divider with its car) moves because you do.
 *
 * Everything here stands still for anyone who has asked their device to
 * reduce motion (MotionConfig on the page turns transforms off).
 */

const SNAP = [0.2, 0.9, 0.2, 1] as const;
const IN_VIEW = { once: true, margin: "0px 0px -12% 0px" } as const;

/** A heading whose lines rise, one after another, from behind their own baseline. */
export function Lines({
  as = "h2",
  className,
  lines,
  delay = 0,
  onLoad = false,
}: {
  as?: "h1" | "h2";
  className?: string;
  lines: ReactNode[];
  delay?: number;
  /** Play as the page opens (the hero) instead of when scrolled to. */
  onLoad?: boolean;
}) {
  const Tag = motion[as];
  return (
    <Tag
      className={className}
      initial="down"
      {...(onLoad ? { animate: "up" } : { whileInView: "up", viewport: IN_VIEW })}
      transition={{ staggerChildren: 0.09, delayChildren: delay }}>
      {lines.map((line, index) => (
        <span key={index} className="wh-line">
          <motion.span
            className="wh-line-in"
            variants={{ down: { y: "108%" }, up: { y: "0%", transition: { duration: 0.7, ease: SNAP } } }}>
            {line}
          </motion.span>
        </span>
      ))}
    </Tag>
  );
}

const stamp: Variants = {
  off: { opacity: 0, scale: 1.08, y: 14, rotate: -1.2 },
  on: { opacity: 1, scale: 1, y: 0, rotate: 0, transition: { type: "spring", stiffness: 520, damping: 26, mass: 0.7 } },
};

/** Pressed onto the page like a rubber stamp: a touch too big and crooked, then square. */
export function Stamp({
  children,
  className,
  delay = 0,
  onLoad = false,
  style,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  onLoad?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <motion.div
      className={className}
      style={style}
      variants={stamp}
      initial="off"
      {...(onLoad ? { animate: "on" } : { whileInView: "on", viewport: IN_VIEW })}
      transition={{ delay }}>
      {children}
    </motion.div>
  );
}

/** Children stamped down one after another: a grid filling in, a list arriving. */
export function Stagger({
  children,
  className,
  gap = 0.07,
  delay = 0,
  onLoad = false,
  style,
}: {
  children: ReactNode;
  className?: string;
  gap?: number;
  delay?: number;
  onLoad?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <motion.div
      className={className}
      style={style}
      initial="off"
      {...(onLoad ? { animate: "on" } : { whileInView: "on", viewport: IN_VIEW })}
      transition={{ staggerChildren: gap, delayChildren: delay }}>
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className, id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <motion.div className={className} id={id} variants={stamp}>
      {children}
    </motion.div>
  );
}

/** Arrives from one side like a car pulling in: fast, then a short settle. */
export function PullIn({
  children,
  className,
  from,
  delay = 0,
  id,
}: {
  children: ReactNode;
  className?: string;
  from: "left" | "right";
  delay?: number;
  id?: string;
}) {
  return (
    <motion.div
      className={className}
      id={id}
      initial={{ opacity: 0, x: from === "left" ? -70 : 70 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={IN_VIEW}
      transition={{ type: "spring", stiffness: 210, damping: 24, delay }}>
      {children}
    </motion.div>
  );
}

/** How far down the page you are, as an orange line under the top of the window. */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 26, mass: 0.4 });
  return <motion.div aria-hidden="true" className="wh-progress" style={{ scaleX }} />;
}

/**
 * The orange strip of words under the header. It rolls by itself, and rolls
 * faster (or backwards) with the page as you scroll it, like a road under a car.
 */
export function RollingStrip({ children }: { children: ReactNode }) {
  const still = useReducedMotion();
  const x = useMotionValue(0);
  const { scrollY } = useScroll();
  const velocity = useSpring(useVelocity(scrollY), { damping: 50, stiffness: 400 });
  const boost = useTransform(velocity, [-1500, 0, 1500], [-5, 0, 5], { clamp: false });
  const direction = useRef(1);
  const group = useRef<HTMLSpanElement>(null);

  useAnimationFrame((_, delta) => {
    if (still) return;
    const width = group.current?.offsetWidth ?? 0;
    if (!width) return;
    const push = boost.get();
    if (push < -0.2) direction.current = -1;
    else if (push > 0.2) direction.current = 1;
    // 46px a second by itself, up to six times that while the page is moving.
    let next = x.get() - direction.current * (46 + Math.abs(push) * 46) * (delta / 1000);
    if (next <= -width) next += width;
    if (next > 0) next -= width;
    x.set(next);
  });

  return (
    <div className="wh-ticker">
      <motion.div className="wh-ticker-track wh-ticker-track--driven" style={{ x }}>
        <span ref={group} className="wh-ticker-group">
          {children}
        </span>
        <span className="wh-ticker-group" aria-hidden="true">
          {children}
        </span>
        <span className="wh-ticker-group" aria-hidden="true">
          {children}
        </span>
      </motion.div>
    </div>
  );
}

const FARES = [5000, 5500, 6000, 6500, 7000, 7500, 8000];
const naira = (amount: number) => `₦${amount.toLocaleString("en-NG")}`;

function Car({ color, width }: { color: string; width: number }) {
  return (
    <svg viewBox="86 236 204 100" width={width} height={(width * 100) / 204} aria-hidden="true">
      <path
        d="M102 318h170c7 0 12-5 12-12v-9c0-7-5-12-12-13l-26-5-19-21c-4-4-9-6-14-6h-54c-6 0-11 3-14 8l-13 19-23 5c-7 2-12 7-12 14v8c0 7 5 12 12 12z"
        fill={color}
      />
      <path d="M152 262h30v20h-44zM190 262h23l17 20h-40z" fill="#2B2B2B" />
      <rect fill="#FFFFFF" height="7" rx="3" width="14" x="262" y="292" />
      {[140, 242].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy={320} fill="#2B2B2B" r={15} />
          <circle cx={cx} cy={320} fill="#FFFFFF" r={7} />
        </g>
      ))}
    </svg>
  );
}

/**
 * A strip of road between two sections that plays Wheelers out, over and
 * over, whatever the page is doing: the car is driving, the rider names a
 * price, the driver takes it, and the money lands. Then the next fare.
 *
 *   0  driving            1  "You offer ₦6,500"
 *   2  "Driver accepts"   3  the cash: +₦6,500 off the car, "Paid" on the road
 */
export function RoadDivider() {
  const still = useReducedMotion();
  const [beat, setBeat] = useState(still ? 3 : 0);
  const [fare, setFare] = useState(6500);

  useEffect(() => {
    if (still) return;
    const waits = [900, 1300, 1100, 2200];
    const timer = setTimeout(() => {
      if (beat === 3) setFare((last) => FARES.filter((f) => f !== last)[Math.floor(Math.random() * (FARES.length - 1))]);
      setBeat((current) => (current + 1) % 4);
    }, waits[beat]);
    return () => clearTimeout(timer);
  }, [beat, still]);

  const pop = {
    initial: { opacity: 0, y: 14, scale: 0.8 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -10, scale: 0.9, transition: { duration: 0.18 } },
    transition: { type: "spring" as const, stiffness: 520, damping: 24 },
  };

  return (
    <div className="wh-road" aria-hidden="true">
      <div className="wh-road-sky">
        {/* Other cars on the road: Wheelers is not one car. */}
        <div className="wh-road-passer wh-road-passer--a">
          <Car color="#3A352F" width={84} />
        </div>
        <div className="wh-road-passer wh-road-passer--b">
          <Car color="#5B534A" width={64} />
        </div>

        <div className="wh-road-scene">
          <div className="wh-road-talk">
            <AnimatePresence>
              {beat >= 1 && beat <= 2 ? (
                <motion.span key={`offer-${fare}`} className="wh-road-bubble wh-road-bubble--offer" {...pop}>
                  <small>You offer</small>
                  <b>{naira(fare)}</b>
                </motion.span>
              ) : null}
            </AnimatePresence>
            <AnimatePresence>
              {beat === 2 ? (
                <motion.span key={`deal-${fare}`} className="wh-road-bubble wh-road-bubble--deal" {...pop}>
                  ✓ <b>Driver accepts</b>
                </motion.span>
              ) : null}
            </AnimatePresence>
          </div>

          <motion.div
            className="wh-road-car"
            animate={still ? undefined : { y: [0, -2.5, 0] }}
            transition={{ duration: 0.5, repeat: Infinity, ease: "easeInOut" }}>
            <Car color="#FF7700" width={150} />
            {/* The cash: it bursts off the car the moment the driver accepts. */}
            <AnimatePresence>
              {beat === 3
                ? [0, 1, 2, 3, 4].map((note) => (
                    <motion.span
                      key={`cash-${fare}-${note}`}
                      className="wh-road-cash"
                      initial={{ opacity: 0, x: 0, y: 0, scale: 0.4, rotate: 0 }}
                      animate={{
                        opacity: [0, 1, 1, 0],
                        x: (note - 2) * 46,
                        y: -70 - (note % 2) * 26,
                        scale: 1,
                        rotate: (note - 2) * 14,
                      }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 1.5, delay: note * 0.07, ease: [0.2, 0.9, 0.2, 1] }}>
                      ₦
                    </motion.span>
                  ))
                : null}
            </AnimatePresence>
            <AnimatePresence>
              {beat === 3 ? (
                <motion.span
                  key={`paid-${fare}`}
                  className="wh-road-paid"
                  initial={{ opacity: 0, scale: 2.2, rotate: -14 }}
                  animate={{ opacity: 1, scale: 1, rotate: -6 }}
                  exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                  transition={{ type: "spring", stiffness: 600, damping: 18 }}>
                  +{naira(fare)}
                </motion.span>
              ) : null}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
      <div className="wh-road-tar">
        <div className="wh-road-dashes" />
      </div>
    </div>
  );
}

/** Drifts against the scroll: the orange slab behind the hero phone. */
export function Drift({ children, className, distance = -80, turn = 0 }: { children?: ReactNode; className?: string; distance?: number; turn?: number }) {
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 700], [0, distance]);
  const rotate = useTransform(scrollY, [0, 700], [0, turn]);
  return (
    <motion.div className={className} style={{ y, rotate }}>
      {children}
    </motion.div>
  );
}
