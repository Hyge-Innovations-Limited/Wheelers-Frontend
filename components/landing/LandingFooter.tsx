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
            Ride-hailing where you set the price. Book on WhatsApp or in the app, and pay in naira or XLM on Stellar.
            A product of HYGE Innovations Limited.
          </p>
          <div className="wh-socials">
            {SOCIAL_LINKS.map((link) => (
              <a key={link.name} href={link.href} target="_blank" rel="noopener noreferrer" aria-label={link.name} title={link.name} className="wh-social">
                <span className={`wh-brand-icon wh-brand-icon--${link.icon}`} aria-hidden="true" />
              </a>
            ))}
          </div>
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

        <div className="wh-footer-col">
          <span className="wh-footer-col-title">Community</span>
          <a href={COMMUNITY_URL} target="_blank" rel="noopener noreferrer">Join the WhatsApp community</a>
          {SOCIAL_LINKS.slice(1).map((link) => (
            <a key={link.name} href={link.href} target="_blank" rel="noopener noreferrer">{link.name === "X" ? "X (Twitter)" : link.name}</a>
          ))}
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
