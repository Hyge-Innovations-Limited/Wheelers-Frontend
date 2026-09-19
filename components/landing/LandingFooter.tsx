import Link from "next/link";
import { APP_STORE_URL, PLAY_STORE_URL, WHATSAPP_URL } from "@/lib/landing-links";

export default function LandingFooter() {
  return (
    <footer className="wh-footer">
      <div className="wh-container wh-footer-grid" data-wh-reveal="1">
        <div className="wh-footer-brand">
          <div className="wh-footer-logo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/wheelers-mark.svg" alt="Wheelers" width={40} height={40} />
            <span>Wheelers</span>
          </div>
          <span className="wh-footer-tag">Ride. Earn. Own.</span>
          <p>
            Community-owned ride-hailing. Riders on WhatsApp, drivers on iOS and Android, everyone on the same chain.
            A product of HYGE Innovations Limited.
          </p>
        </div>

        <div className="wh-footer-col">
          <span className="wh-footer-col-title">Product</span>
          <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">Ride on WhatsApp</a>
          <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer">Driver app · iOS</a>
          <a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer">Driver app · Android</a>
          <a href="#how">How it works</a>
        </div>

        <div className="wh-footer-col">
          <span className="wh-footer-col-title">Company</span>
          <a href="#riders">About</a>
          <a href="#">Blog</a>
          <Link href="/drivers">Careers</Link>
          <a href="#">Community</a>
        </div>

        <div className="wh-footer-col">
          <span className="wh-footer-col-title">Support</span>
          <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">Help Center</a>
          <a href="#">Safety</a>
          <Link href="/privacy">Privacy Policy</Link>
          <a href="#">Terms of Service</a>
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
