import { WHATSAPP_URL } from "@/lib/landing-links";
import StoreBadges from "./StoreBadges";

export default function TwoSides() {
  return (
    <section id="riders" className="wh-section" style={{ background: "#FFF8EC" }}>
      <div className="wh-container wh-section-inner">
        <div className="wh-section-head" data-wh-reveal="1">
          <span className="wh-eyebrow">Who it&rsquo;s for</span>
          <h2 className="wh-h2">
            Two sides of
            <br />
            the <span className="wh-serif">same road</span>
          </h2>
        </div>

        <div className="wh-sides" data-wh-reveal="1" style={{ "--wh-d": "120ms" } as React.CSSProperties}>
          <div className="wh-side wh-side--riders">
            <div className="wh-side-top">
              <span className="wh-side-badge wh-side-badge--wa">R</span>
              <span className="wh-side-index">01 · WhatsApp</span>
            </div>
            <h3>For riders</h3>
            <p>
              No app to install, no account to set up. Save one number, send your pickup and destination, and a
              fixed fare comes back before you commit. Reply once and you&rsquo;re booked.
            </p>
            <ul className="wh-bullets">
              <li>Works on any phone that runs WhatsApp</li>
              <li>Fixed fare, locked before you book — no surge</li>
              <li>Live tracking link and driver details in the chat</li>
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
          </div>

          <div id="drivers" className="wh-side wh-side--drivers">
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
          </div>
        </div>
      </div>
    </section>
  );
}
