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
              <span className="wh-side-index">01 · WhatsApp or app</span>
            </div>
            <h3>For riders</h3>
            <p>
              Book in the Wheelers app or on WhatsApp, whichever you prefer. Say where you&rsquo;re going, name the
              price you want to pay, and pick from the drivers who answer.
            </p>
            <ul className="wh-bullets">
              <li>In the app, or on any phone that runs WhatsApp</li>
              <li>You name the price; drivers accept it or make an offer</li>
              <li>Live tracking and driver details, in the app or the chat</li>
              <li>Pay with wallet, card or USDT</li>
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
              <span className="wh-side-index">02 · iOS + Android</span>
            </div>
            <h3>For drivers</h3>
            <p>
              A proper app, because you live in it all day. Go online, accept requests, navigate, and watch earnings
              settle to your wallet the moment a trip ends. No middleman taking 30%.
            </p>
            <ul className="wh-bullets">
              <li>Native app on iOS and Android</li>
              <li>Industry-lowest commission, direct wallet payouts</li>
              <li>KYC once, then you&rsquo;re verified for every rider</li>
              <li>Referral income on every driver you bring in</li>
            </ul>
            <StoreBadges small />
          </PullIn>
        </div>
      </div>
    </section>
  );
}
