import Link from "next/link";
import { APP_STORE_URL, COMMUNITY_URL, PLAY_STORE_URL, SOCIAL_LINKS, WHATSAPP_URL } from "@/lib/landing-links";

export default function LandingFooter() {
  return (
    <footer className="wh-footer">
      <div className="wh-container wh-footer-grid" data-wh-reveal="1">
        <div className="wh-footer-brand">
          <div className="wh-footer-logo">
            <span className="wh-wordmark wh-wordmark--lg" role="img" aria-label="Wheelers" />
          </div>
          <span className="wh-footer-tag">Ride. Earn. Own.</span>
          <p>
            Ride-hailing where the rider names the price and the driver agrees to it. Built in Lagos, on WhatsApp, the
            Wheelers app and Stellar. A product of HYGE Innovations Limited.
          </p>

          <a href="https://stellar.org" target="_blank" rel="noopener noreferrer" className="wh-stellar-badge">
            <span className="wh-brand-icon wh-brand-icon--stellar" aria-hidden="true" />
            Payments on Stellar
          </a>
        </div>

        <div className="wh-footer-col">
          <span className="wh-footer-col-title">Ride</span>
          <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">Book on WhatsApp</a>
          <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer">Wheelers for iPhone</a>
          <a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer">Wheelers for Android</a>
          <a href="#how">How it works</a>
        </div>

        <div className="wh-footer-col wh-footer-col--community">
          <span className="wh-footer-col-title">Community</span>
          {/* The community comes first: it is people, not a feed. */}
          <a href={COMMUNITY_URL} target="_blank" rel="noopener noreferrer" className="wh-community">
            <span className="wh-community-icon">
              <span className="wh-brand-icon wh-brand-icon--whatsapp" aria-hidden="true" />
            </span>
            <span className="wh-community-words">
              <strong>Join the Wheelers community</strong>
              <small>Riders and drivers trading tips, routes and early news, on WhatsApp.</small>
            </span>
            <span className="wh-community-go" aria-hidden="true">→</span>
          </a>
          <div className="wh-follow">
            <span>Follow us</span>
            <div className="wh-socials">
              {SOCIAL_LINKS.map((link) => (
                <a key={link.name} href={link.href} target="_blank" rel="noopener noreferrer" aria-label={`Wheelers on ${link.name}`} title={link.name} className="wh-social">
                  <span className={`wh-brand-icon wh-brand-icon--${link.icon}`} aria-hidden="true" />
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="wh-footer-col">
          <span className="wh-footer-col-title">Help</span>
          <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">Chat with support</a>
          <Link href="/drivers">Drive with Wheelers</Link>
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/terms">Terms of Service</Link>
        </div>
      </div>

      <div className="wh-footer-bar">
        <div className="wh-container wh-footer-bar-inner">
          <span>© {new Date().getFullYear()} HYGE Innovations Limited</span>
          <span>Lagos, Nigeria · wheelersng.com</span>
        </div>
      </div>
    </footer>
  );
}
