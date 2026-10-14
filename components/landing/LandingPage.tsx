"use client";

import { MotionConfig } from "framer-motion";
import { useEffect } from "react";
import LandingNav from "./LandingNav";
import LandingTicker from "./LandingTicker";
import LandingHero from "./LandingHero";
import TwoSides from "./TwoSides";
import HowItWorks from "./HowItWorks";
import LandingFeatures from "./LandingFeatures";
import MatchBand from "./MatchBand";
import LandingFooter from "./LandingFooter";
import { RoadDivider } from "./motion";

export default function LandingPage({ className = "" }: { className?: string }) {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>("[data-wh-reveal]:not(.wh-in)");
    if (!("IntersectionObserver" in window)) {
      els.forEach((e) => e.classList.add("wh-in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add("wh-in");
            io.unobserve(en.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);

  return (
    // Anyone who has asked their device for less motion gets a page that holds still.
    <MotionConfig reducedMotion="user">
      <div className={`wh ${className}`.trim()}>
        <LandingNav />
        <LandingTicker />
        <main>
          <LandingHero />
          <RoadDivider />
          <TwoSides />
          <HowItWorks />
          <LandingFeatures />
          <MatchBand />
        </main>
        <LandingFooter />
      </div>
    </MotionConfig>
  );
}
