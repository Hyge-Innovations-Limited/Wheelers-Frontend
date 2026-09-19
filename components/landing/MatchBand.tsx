"use client";

import { useEffect, useState } from "react";
import { WHATSAPP_URL } from "@/lib/landing-links";

const POOL = [
  { name: "Adebayo F.", car: "Toyota Camry", plate: "KJA-482-XY" },
  { name: "Chidinma O.", car: "Honda Accord", plate: "LND-903-AB" },
  { name: "Emeka N.", car: "Toyota Corolla", plate: "ABJ-234-KL" },
  { name: "Funmi A.", car: "Hyundai Elantra", plate: "EKY-117-GH" },
  { name: "Tunde B.", car: "Kia Cerato", plate: "LSD-560-QP" },
  { name: "Ngozi E.", car: "Toyota Sienna", plate: "APP-771-MJ" },
  { name: "Segun K.", car: "Lexus ES 350", plate: "FST-329-RD" },
  { name: "Amaka U.", car: "Honda Civic", plate: "GGE-845-TL" },
  { name: "Yusuf M.", car: "Toyota Highlander", plate: "IKJ-208-WZ" },
  { name: "Bisi O.", car: "Nissan Altima", plate: "MUS-613-CN" },
];

const ZONES = [
  "Victoria Island — Zone B",
  "Lekki Phase 1 — Zone A",
  "Ikeja GRA — Zone C",
  "Yaba — Zone D",
  "Surulere — Zone E",
];

const AVATAR_BGS = ["#FF7700", "#25D366", "#FFE3C7", "#F3E9D6"];

type Driver = {
  key: string;
  name: string;
  car: string;
  plate: string;
  initials: string;
  avatarBg: string;
  etaMin: number;
  rating: string;
  trips: string;
};

function shuffleDrivers(): Driver[] {
  const picks = [...POOL].sort(() => Math.random() - 0.5).slice(0, 4);
  return picks
    .map((d, i) => {
      const parts = d.name.split(" ");
      const trips = 200 + Math.floor(Math.random() * 1900);
      return {
        ...d,
        key: `${d.plate}-${Date.now()}-${i}`,
        initials: parts[0][0] + parts[1][0],
        avatarBg: AVATAR_BGS[i % AVATAR_BGS.length],
        etaMin: 1 + Math.floor(Math.random() * 6),
        rating: (4.6 + Math.random() * 0.4).toFixed(1),
        trips: trips.toLocaleString() + " trips",
      };
    })
    .sort((a, b) => a.etaMin - b.etaMin);
}

export default function MatchBand() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [zone, setZone] = useState(ZONES[0]);

  useEffect(() => {
    const refresh = () => {
      setDrivers(shuffleDrivers());
      setZone(ZONES[Math.floor(Math.random() * ZONES.length)]);
    };
    refresh();
    const id = setInterval(refresh, 4500);
    return () => clearInterval(id);
  }, []);

  return (
    <section id="waitlist" className="wh-band">
      <div className="wh-ring wh-ring-1" />
      <div className="wh-ring wh-ring-2" />
      <div className="wh-ring wh-ring-3" />
      <div className="wh-ring-dot" />
      <div className="wh-ring-ping" />

      <div className="wh-container wh-band-inner">
        <div className="wh-band-copy" data-wh-reveal="1">
          <span className="wh-band-tag">Drivers near you</span>
          <h2 className="wh-h2">
            Match in <span className="wh-serif">30 seconds.</span>
            <br />
            Every single time.
          </h2>
          <p>
            Your WhatsApp message pings every verified driver in that hub. The first to accept on the Driver app is
            locked to you before you blink. Lagos-wide, always live.
          </p>
          <div className="wh-band-ctas">
            <a href={WHATSAPP_URL} className="wh-btn wh-btn-dark-cream" target="_blank" rel="noopener noreferrer">
              Ride · WhatsApp
            </a>
            <a href="#driverapp" className="wh-btn wh-btn-cream">
              Drive · iOS + Android
            </a>
          </div>
        </div>

        <div className="wh-band-panel-wrap" data-wh-reveal="1" style={{ "--wh-d": "160ms" } as React.CSSProperties}>
          <div className="wh-panel">
            <div className="wh-panel-head">
              <span className="wh-online">Online now</span>
              <span className="wh-panel-zone">{zone}</span>
            </div>
            {drivers.length === 0 && <div className="wh-panel-empty" />}
            {drivers.map((d) => (
              <div key={d.key} className="wh-driver-row">
                <span className="wh-driver-avatar" style={{ background: d.avatarBg }}>
                  {d.initials}
                </span>
                <span className="wh-driver-info">
                  <span className="wh-driver-name">{d.name}</span>
                  <span className="wh-driver-car">
                    {d.car} · {d.plate}
                  </span>
                </span>
                <span className="wh-driver-right">
                  <span className="wh-driver-eta">{d.etaMin} min</span>
                  <span className="wh-driver-stats">
                    {d.rating}★ · {d.trips}
                  </span>
                </span>
              </div>
            ))}
            <span className="wh-panel-foot">Live from the Driver app · refreshes every few seconds</span>
          </div>
        </div>
      </div>
    </section>
  );
}
