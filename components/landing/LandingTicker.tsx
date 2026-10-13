const ITEMS = [
  "Ride on WhatsApp or in the app",
  "Name your price, choose your driver",
  "One app for riders and drivers",
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
