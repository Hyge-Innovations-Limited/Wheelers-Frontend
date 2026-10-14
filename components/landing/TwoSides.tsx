"use client";

import { WHATSAPP_URL } from "@/lib/landing-links";
import { Lines, PullIn, Stamp } from "./motion";
import StoreBadges from "./StoreBadges";

export default function TwoSides() {
  return (
    <section id="riders" className="wh-section" style={{ background: "#FFF8EC" }}>
      <div className="wh-container wh-section-inner">
        <div className="wh-section-head">
          <Stamp>
            <span className="wh-eyebrow">Who it&rsquo;s for</span>
          </Stamp>
          <Lines
            className="wh-h2"
            lines={[
              "Two sides of",
              <>
                the <span className="wh-serif">same road</span>
              </>,
            ]}
          />
        </div>

        {/* Riders pull in from the left, drivers from the right, and meet in the middle. */}
        <div className="wh-sides">
          <PullIn className="wh-side wh-side--riders" from="left">
            <div className="wh-side-top">
              <span className="wh-side-badge wh-side-badge--wa">R</span>
              <span className="wh-side-index">01 · WhatsApp first</span>
            </div>
            <h3>For riders</h3>
            <p>
              Say hi to Wheelers on WhatsApp and you&rsquo;re already booking: no download, no forms. Tell us where
              you&rsquo;re headed and what you&rsquo;d like to pay, and drivers nearby answer with offers. Prefer an
              app? Same rides, same prices, in Wheelers on iPhone and Android.
            </p>
            <ul className="wh-bullets">
              <li>Works on any phone with WhatsApp, or in the app</li>
              <li>You set the fare; drivers take it or counter</li>
              <li>Your driver&rsquo;s name, car and live location, right in the chat</li>
              <li>Pay from your wallet: naira by transfer, or XLM on Stellar</li>
            </ul>
            <a
              href={WHATSAPP_URL}
              className="wh-btn wh-btn-mono wh-btn-dark-wa wh-side-cta"
              target="_blank"
              rel="noopener noreferrer"
            >
              Message Wheelers →
            </a>
          </PullIn>

          <PullIn id="drivers" className="wh-side wh-side--drivers" from="right" delay={0.08}>
            <div className="wh-side-top">
              <span className="wh-side-badge wh-side-badge--orange">D</span>
              <span className="wh-side-index">02 · iPhone + Android</span>
            </div>
            <h3>For drivers</h3>
            <p>
              Your car, your hours, your fares. Go online when it suits you, see the rider&rsquo;s price before you
              move, and take it or name yours. Your earnings land in your wallet the moment the trip ends.
            </p>
            <ul className="wh-bullets">
              <li>Wheelers on iPhone and Android</li>
              <li>See the fare first; accept or counter</li>
              <li>Paid to your wallet as each trip ends</li>
              <li>Earn from every rider and driver you refer</li>
            </ul>
            <StoreBadges small />
          </PullIn>
        </div>
      </div>
    </section>
  );
}
