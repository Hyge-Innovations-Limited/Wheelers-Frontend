"use client";

import { RollingStrip } from "./motion";

const ITEMS = [
  "Say hi on WhatsApp · we take it from there",
  "Your fare, your call",
  "Drivers bid · you choose",
  "Every driver ID-checked",
  "Pay in naira or XLM on Stellar",
  "One app for riders and drivers",
]

export default function LandingTicker() {
  return (
    <RollingStrip>
      {ITEMS.map((t) => (
        <span key={t} style={{ display: "contents" }}>
          <span>{t}</span>
          <span>●</span>
        </span>
      ))}
    </RollingStrip>
  );
}
