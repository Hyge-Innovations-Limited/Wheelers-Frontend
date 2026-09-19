const STEPS = [
  { n: "01", title: "Save the number", body: "Add Wheelers on WhatsApp. That's the whole signup." },
  { n: "02", title: "Say where you're going", body: "Type pickup and destination, or drop a location pin." },
  { n: "03", title: "Get a fixed fare", body: "Price, distance and ETA come back in seconds. Reply 1 to lock it." },
  {
    n: "04",
    title: "Driver matched",
    body: "A verified driver accepts on the Driver app. You get their name, plate and a live tracking link — right in the chat.",
    active: true,
  },
];

export default function HowItWorks() {
  return (
    <section id="how" className="wh-section wh-how">
      <div className="wh-container wh-how-inner">
        <div className="wh-how-copy">
          <div className="wh-section-head" data-wh-reveal="1">
            <span className="wh-eyebrow">How it works</span>
            <h2 className="wh-h2">
              From &ldquo;hi&rdquo; to
              <br />
              <span className="wh-serif">picked up</span>
              <br />
              in four replies
            </h2>
          </div>

          <ol className="wh-steps" data-wh-reveal="1" style={{ "--wh-d": "120ms" } as React.CSSProperties}>
            {STEPS.map((s) => (
              <li key={s.n} className={`wh-step${s.active ? " wh-step--active" : ""}`}>
                <span className="wh-step-num">{s.n}</span>
                <div className="wh-step-text">
                  <strong>{s.title}</strong>
                  <span>{s.body}</span>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div id="driverapp" className="wh-driver-visual" data-wh-reveal="1" style={{ "--wh-d": "200ms" } as React.CSSProperties}>
          <div className="wh-dphone">
            <div className="wh-dphone-screen">
              <div className="wh-dphone-top">
                <div className="wh-dphone-brand">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/wheelers-mark.svg" alt="" width={30} height={30} />
                  <span>Driver</span>
                </div>
                <span className="wh-dphone-online">
                  <span className="wh-live-dot" />
                  Online
                </span>
              </div>

              <div className="wh-dphone-earn">
                <span className="wh-dphone-earn-label">Earned today</span>
                <span className="wh-dphone-earn-amt">₦12,400</span>
                <span className="wh-dphone-earn-delta">↑ 18% vs yesterday · 7 trips</span>
              </div>

              <div className="wh-dphone-map">
                <span className="wh-map-me" />
                <span className="wh-map-ping" />
                <span className="wh-map-rider" />
                <svg viewBox="0 0 300 200" preserveAspectRatio="none" className="wh-map-route" aria-hidden="true">
                  <path d="M108 78 C 150 70, 170 60, 196 46" stroke="#FF7700" strokeWidth="4" strokeDasharray="8 6" fill="none" />
                </svg>
                <span className="wh-map-zone">Lekki · Zone B</span>
              </div>

              <div className="wh-dphone-req">
                <div className="wh-dphone-req-top">
                  <span className="wh-dphone-req-label">New request · 0:28</span>
                  <span className="wh-dphone-req-fare">₦5,684</span>
                </div>
                <span className="wh-dphone-req-route">Admiralty Way → Ozumba Mbadiwe</span>
                <span className="wh-dphone-req-meta">18 km · 2 min to pickup · Rider on WhatsApp</span>
                <div className="wh-dphone-req-actions">
                  <span className="wh-dphone-accept">Accept</span>
                  <span className="wh-dphone-skip">Skip</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
