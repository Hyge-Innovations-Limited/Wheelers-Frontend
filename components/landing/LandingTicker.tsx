"use client";

import { RollingStrip } from "./motion";

const ITEMS = [
  "Ride on WhatsApp or in the app",
  "Name your price, choose your driver",
  "One app for riders and drivers",
  "KYC-verified drivers only",
  "Pay NGN, card or USDT",
  "Lagos-wide · always live",
];

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
