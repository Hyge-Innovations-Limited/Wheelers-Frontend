"use client";

import {
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
import { useRef, type ReactNode } from "react";

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

/**
 * A strip of road between two sections, with the Wheelers car on it. The car
 * is driven by the scroll: it enters as the road comes into view and has
 * crossed the page by the time the road leaves.
 */
export function RoadDivider() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const smooth = useSpring(scrollYProgress, { stiffness: 90, damping: 22, mass: 0.5 });
  const left = useTransform(smooth, [0, 1], ["-18%", "104%"]);
  const dashes = useTransform(smooth, [0, 1], [0, -260]);

  return (
    <div ref={ref} className="wh-road" aria-hidden="true">
      <motion.div className="wh-road-dashes" style={{ x: dashes }} />
      <motion.div className="wh-road-car" style={{ left }}>
        <svg viewBox="86 236 204 100" width="132" height="65">
          <path
            d="M102 318h170c7 0 12-5 12-12v-9c0-7-5-12-12-13l-26-5-19-21c-4-4-9-6-14-6h-54c-6 0-11 3-14 8l-13 19-23 5c-7 2-12 7-12 14v8c0 7 5 12 12 12z"
            fill="#FF7700"
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
      </motion.div>
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
