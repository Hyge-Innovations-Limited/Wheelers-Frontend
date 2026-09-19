import { APP_STORE_URL, PLAY_STORE_URL } from "@/lib/landing-links";
import { AppleIcon, PlayIcon } from "./icons";

export default function StoreBadges({ small = false }: { small?: boolean }) {
  const cls = small ? "wh-store wh-store--sm" : "wh-store";
  const icon = small ? 24 : 26;

  return (
    <div className="wh-store-row">
      <a
        href={APP_STORE_URL}
        className={cls}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Download Wheelers Driver on the App Store"
      >
        <AppleIcon size={icon} />
        <span className="wh-store-text">
          <small>Download on the</small>
          <strong>App Store</strong>
        </span>
      </a>
      <a
        href={PLAY_STORE_URL}
        className={cls}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Get Wheelers Driver on Google Play"
      >
        <PlayIcon size={small ? 22 : 24} />
        <span className="wh-store-text">
          <small>Get it on</small>
          <strong>Google Play</strong>
        </span>
      </a>
    </div>
  );
}
