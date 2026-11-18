"use client";

/** Session explorer: every session the filters keep, row by row; click one for its offers, price changes, pings, trip. */
import { useMemo, useState } from "react";
import { PING_ACTIONS, gapBandOf, type StudioSession } from "@/lib/studio/schema";
import { naira, num, signedPct } from "@/lib/studio/stats";
import type { TabProps } from "./tab-props";

const PAGE = 15;
type Col = { key: string; label: string; value: (s: StudioSession) => string | number | null; show: (s: StudioSession) => string; num?: boolean };
const dash = (v: unknown) => (v === null || v === undefined ? "—" : String(v));
const raisePct = (s: StudioSession) => (s.openingNgn && s.finalNgn ? ((s.finalNgn / s.openingNgn) - 1) * 100 : null);

const COLS: Col[] = [
  { key: "id", label: "Session", value: (s) => s.id, show: (s) => s.id },
  { key: "date", label: "Date", value: (s) => s.date, show: (s) => s.date, num: true },
  { key: "channel", label: "Channel", value: (s) => s.channel, show: (s) => s.channel, num: true },
  { key: "class", label: "Class", value: (s) => s.rideClass, show: (s) => s.rideClass, num: true },
  { key: "km", label: "Km", value: (s) => s.km, show: (s) => s.km.toFixed(1), num: true },
  { key: "outcome", label: "Outcome", value: (s) => s.outcome, show: (s) => s.outcome, num: true },
  { key: "reason", label: "Reason", value: (s) => s.reason ?? s.abandonStage?.toLowerCase().replace(/ /g, "_") ?? null, show: (s) => dash(s.reason ?? s.abandonStage?.toLowerCase().replace(/ /g, "_")), num: true },
  { key: "suggested", label: "Suggested", value: (s) => s.suggestedNgn, show: (s) => naira(s.suggestedNgn), num: true },
  { key: "opening", label: "Opened at", value: (s) => s.openingNgn, show: (s) => naira(s.openingNgn), num: true },
  { key: "final", label: "Final price", value: (s) => s.finalNgn, show: (s) => naira(s.finalNgn), num: true },
  { key: "agreed", label: "Agreed", value: (s) => s.agreedNgn, show: (s) => naira(s.agreedNgn), num: true },
  { key: "raise", label: "Raise %", value: raisePct, show: (s) => signedPct(raisePct(s)), num: true },
  { key: "match", label: "Match s", value: (s) => s.matchSec, show: (s) => dash(s.matchSec), num: true },
  { key: "pinged", label: "Pinged", value: (s) => s.pinged, show: (s) => num(s.pinged), num: true },
  { key: "offers", label: "Offers", value: (s) => s.offersReceived, show: (s) => num(s.offersReceived), num: true },
];

export function Explorer({ data, f }: TabProps) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: string; desc: boolean }>({ key: "date", desc: false });
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const col = COLS.find((c) => c.key === sort.key) ?? COLS[1];
    const found = needle ? f.sessions.filter((s) => s.id.toLowerCase().includes(needle) || (s.reason ?? "").toLowerCase().includes(needle)) : f.sessions;
    return [...found].sort((a, b) => {
      const x = col.value(a);
      const y = col.value(b);
      if (x === y) return a.id < b.id ? -1 : 1;
      if (x === null) return 1;
      if (y === null) return -1;
      return (x < y ? -1 : 1) * (sort.desc ? -1 : 1);
    });
  }, [f.sessions, q, sort]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const at = Math.min(page, pages - 1);
  const open = openId ? data.sessions.find((s) => s.id === openId) ?? null : null;

  return (
    <>
      <section className="studio-panel">
        <div className="studio-panel-head">
          <h3 className="studio-panel-title">Every session, row by row</h3>
          <input className="studio-search" placeholder="Search id or reason..." value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
          <span className="studio-muted">{num(rows.length)} sessions match</span>
        </div>
        <p className="studio-panel-sub">All filters above apply. Click a column header to sort, click a row to open the full drill-down: that session&apos;s offers, price changes and driver pings.</p>
        <div className="studio-scroll">
          <table className="studio-table studio-explorer">
            <thead>
              <tr>
                {COLS.map((c) => (
                  <th key={c.key} style={{ textAlign: c.num ? "right" : "left" }}>
                    <button type="button" onClick={() => { setSort((s) => ({ key: c.key, desc: s.key === c.key ? !s.desc : false })); setPage(0); }}>
                      {c.label}{sort.key === c.key ? (sort.desc ? " ↓" : " ↑") : ""}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(at * PAGE, at * PAGE + PAGE).map((s) => (
                <tr key={s.id} className={s.id === openId ? "on" : ""} onClick={() => setOpenId(s.id === openId ? null : s.id)}>
                  {COLS.map((c) => <td key={c.key} style={{ textAlign: c.num ? "right" : "left" }}>{c.show(s)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="studio-pager">
          <button type="button" disabled={at === 0} onClick={() => setPage(at - 1)}>‹ Prev</button>
          <span className="studio-muted">page {at + 1} of {pages}</span>
          <button type="button" disabled={at >= pages - 1} onClick={() => setPage(at + 1)}>Next ›</button>
        </div>
      </section>
      {open ? <DrillDown s={open} data={data} onClose={() => setOpenId(null)} /> : null}
    </>
  );
}

function DrillDown({ s, data, onClose }: { s: StudioSession; data: TabProps["data"]; onClose: () => void }) {
  const offers = data.offers.filter((o) => o.sessionId === s.id);
  const changes = data.priceChanges.filter((c) => c.sessionId === s.id);
  const pings = data.pings.filter((p) => p.sessionId === s.id);
  const facts: Array<[string, string]> = [
    ["Date", `${s.date} · ${s.weekday} · ${String(s.hour).padStart(2, "0")}:00`], ["Channel", s.channel], ["Class", s.rideClass], ["Rider type", s.riderType],
    ["Weather", s.weather], ["Zone", s.zone], ["Attempt", `#${s.attempt} · ${s.variant}`], ["Outcome", s.reason ? `${s.outcome} — ${s.reason}` : s.outcome],
    ["Suggested fare", naira(s.suggestedNgn)], ["Opened at", naira(s.openingNgn)], ["Final price", naira(s.finalNgn)], ["Time to match", s.matchSec === null ? "—" : `${s.matchSec}s`],
    ["Rounds", num(s.rounds)], ["Drivers pinged", num(s.pinged)], ["Offers received", num(s.offersReceived)], ["Wheelers net", naira(s.wheelersNetNgn)],
    ["Rider", s.riderId], ["Route", `${s.km.toFixed(1)} km → ${s.destZone}`], ["Agreed fare", naira(s.agreedNgn)], ["Promo", s.promo === "No promo" ? "none" : s.promo],
    ["Rider joined via", s.joinedVia],
  ];
  return (
    <section className="studio-panel studio-drill">
      <div className="studio-panel-head">
        <h3 className="studio-panel-title">Drill-down: session {s.id}</h3>
        <button type="button" className="studio-reset" onClick={onClose}>Close ×</button>
      </div>
      <div className="studio-facts">
        {facts.map(([k, v]) => <div key={k}><b>{k}:</b> {v}</div>)}
      </div>

      <h4>Offers in this session</h4>
      {offers.length === 0 ? <p className="studio-muted">No offers.</p> : (
        <table className="studio-table">
          <thead><tr><th style={{ textAlign: "left" }}>Gap band</th><th>Round</th><th>Status</th><th>List pos</th><th>Cheapest?</th><th>Premium</th><th>Latency</th></tr></thead>
          <tbody>
            {offers.map((o) => (
              <tr key={o.id}>
                <td style={{ textAlign: "left" }}>{gapBandOf(o.gapToRiderPct)}</td><td>{o.round}</td><td>{o.status}</td><td>{dash(o.listPos)}</td>
                <td>{o.cheapest === null ? "—" : o.cheapest ? "yes" : "no"}</td><td>{o.premiumNgn === null ? "—" : naira(o.premiumNgn)}</td><td>{o.latencySec}s</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h4>Price changes</h4>
      {changes.length === 0 ? <p className="studio-muted">None.</p> : (
        <table className="studio-table">
          <thead><tr><th style={{ textAlign: "left" }}>Direction</th><th>Trigger</th><th>Step</th></tr></thead>
          <tbody>
            {changes.map((c, i) => (
              <tr key={i}><td style={{ textAlign: "left" }}>{c.direction}</td><td>{c.trigger}</td><td>{signedPct(((c.toNgn / c.fromNgn) - 1) * 100)}</td></tr>
            ))}
          </tbody>
        </table>
      )}

      <h4>Driver pings ({pings.length})</h4>
      {pings.length === 0 ? <p className="studio-muted">None.</p> : (
        <table className="studio-table">
          <thead><tr><th style={{ textAlign: "left" }}>What drivers did</th><th>Count</th></tr></thead>
          <tbody>
            {PING_ACTIONS.map((a) => {
              const n = pings.filter((p) => p.action === a).length;
              return n ? <tr key={a}><td style={{ textAlign: "left" }}>{a}</td><td>{n}</td></tr> : null;
            })}
          </tbody>
        </table>
      )}

      <h4>Trip</h4>
      {!s.trip ? <p className="studio-muted">No driver was booked.</p> : (
        <table className="studio-table">
          <thead><tr><th style={{ textAlign: "left" }}>Status</th><th>Cancelled by</th><th>Reason</th><th>Pickup delay</th><th>Fare</th><th>Paid</th><th>Method</th><th>Rating</th></tr></thead>
          <tbody>
            <tr>
              <td style={{ textAlign: "left" }}>{s.trip.status}</td><td>{dash(s.trip.cancelledBy)}</td><td>{dash(s.trip.reason)}</td>
              <td>{s.trip.pickupDelayMin === null ? "—" : `${s.trip.pickupDelayMin} min`}</td><td>{naira(s.trip.fareNgn)}</td>
              <td>{s.trip.paid === null ? "—" : s.trip.paid ? "yes" : "no"}</td><td>{dash(s.trip.method)}</td><td>{s.trip.rating === null ? "—" : `${s.trip.rating}★`}</td>
            </tr>
          </tbody>
        </table>
      )}
    </section>
  );
}
