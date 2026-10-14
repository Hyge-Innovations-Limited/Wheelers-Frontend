"use client";

import { RollingStrip } from "./motion";

const ITEMS = [
  "No download needed · just text Wheelers",
  "You name the fare · drivers bid · you choose",
  "Also on iPhone and Android",
  "Every driver ID-checked",
  "Pay in naira or XLM on Stellar",
  "Live across Lagos",
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
