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
              Getting somewhere shouldn&rsquo;t start with a guessing game. Tell Wheelers where you&rsquo;re headed
              and what feels fair, right in WhatsApp. Drivers nearby answer with their offers, and you pick the one that
              works for you, before anyone moves.
            </p>
            <ul className="wh-bullets">
              <li>No download, no sign-up form: just a chat</li>
              <li>You set the fare; drivers take it or make an offer</li>
              <li>See your driver&rsquo;s name, car and plate before they arrive</li>
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
              You know these roads, and you know what your time is worth. On Wheelers you see the rider&rsquo;s offer
              before you move, and you can take it or name your own. When the trip ends, your money is already in your
              wallet.
            </p>
            <ul className="wh-bullets">
              <li>One app, on iPhone and Android</li>
              <li>See the fare first; accept or counter</li>
              <li>Paid into your wallet the moment you drop off</li>
              <li>Earn more for every rider and driver you bring</li>
            </ul>
            <StoreBadges small />
          </PullIn>
        </div>
      </div>
    </section>
  );
}
