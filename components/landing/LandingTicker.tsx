const ITEMS = [
  "No app for riders · book on WhatsApp",
  "Fixed fare before you say yes",
  "Driver app on iOS + Android",
  "KYC-verified drivers only",
  "Pay NGN, card or USDT",
  "Lagos-wide · always live",
];

function Group({ hidden = false }: { hidden?: boolean }) {
  return (
    <span className="wh-ticker-group" aria-hidden={hidden || undefined}>
      {ITEMS.map((t) => (
        <span key={t} style={{ display: "contents" }}>
          <span>{t}</span>
          <span>●</span>
        </span>
      ))}
    </span>
  );
}

export default function LandingTicker() {
  return (
    <div className="wh-ticker">
      <div className="wh-ticker-track">
        <Group />
        <Group hidden />
      </div>
    </div>
  );
}
