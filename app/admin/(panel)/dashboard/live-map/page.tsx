"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  fetchDispatch,
  fetchDriverTrail,
  fetchLiveDriver,
  fetchLiveDrivers,
  logDriverCall,
  nudgeDriver,
  type DispatchCandidate,
  type DispatchContactRow,
  type DispatchOutcome,
  type DispatchRide,
  type DriverPresence,
  type LiveDriver,
  type LiveDriversResponse,
  type TrailPoint,
} from "@/lib/admin-api";
import { formatNaira, formatWhen } from "@/lib/admin-format";
import { EmptyState, ErrorState, PageHeader, RefreshButton, Spinner } from "@/components/admin/ui";
import type { MapFocus } from "@/components/admin/live-map-canvas";

// Leaflet reads `window` the moment it is imported, so it never runs on the server.
const LiveMapCanvas = dynamic(() => import("@/components/admin/live-map-canvas"), {
  ssr: false,
  loading: () => <div className="lm-canvas lm-canvas-loading">Loading map…</div>,
});

/** Fast enough to follow a car, slow enough to be nothing to the server. */
const POLL_MS = 10_000;

const PRESENCE: Record<DriverPresence, { label: string; hint: string }> = {
  online: { label: "Online", hint: "On shift, waiting for a ride" },
  on_trip: { label: "On a trip", hint: "Carrying a rider right now" },
  standby: { label: "Off shift, alerts on", hint: "Agreed to hear about nearby rides" },
  stale: { label: "Signal lost", hint: "Marked online but the phone has gone quiet" },
  offline: { label: "Offline", hint: "Last known position" },
};
const PRESENCE_ORDER: DriverPresence[] = ["online", "on_trip", "standby", "stale", "offline"];

const TRAIL_WINDOWS = [
  { minutes: 30, label: "30 min" },
  { minutes: 60, label: "1 hour" },
  { minutes: 180, label: "3 hours" },
  { minutes: 720, label: "12 hours" },
  { minutes: 1440, label: "24 hours" },
];

const OUTCOMES: { value: DispatchOutcome; label: string }[] = [
  { value: "accepted", label: "Will take it" },
  { value: "declined", label: "Declined" },
  { value: "no_answer", label: "No answer" },
  { value: "unreachable", label: "Unreachable" },
];

function ago(seconds: number): string {
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)} h ago`;
  return `${Math.floor(seconds / 86_400)} d ago`;
}

function waited(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)} min`;
}

function describeContact(contact: DispatchContactRow): string {
  const what =
    contact.kind === "nudge"
      ? "Nudged"
      : `Called · ${OUTCOMES.find((o) => o.value === contact.outcome)?.label ?? contact.outcome}`;
  return `${what} · ${contact.adminName} · ${formatWhen(contact.at)}`;
}

/**
 * Live map + dispatch.
 *
 * Two jobs on one screen: see where every driver is, and — when a rider is
 * waiting and nobody has bid — find the closest driver and get them on the
 * phone. Calling and nudging never change a driver's state; the driver decides.
 */
export default function LiveMapPage() {
  const [live, setLive] = useState<LiveDriversResponse | null>(null);
  const [rides, setRides] = useState<DispatchRide[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [tab, setTab] = useState<"drivers" | "dispatch">("drivers");
  const [presenceFilter, setPresenceFilter] = useState<DriverPresence | "all">("all");
  const [search, setSearch] = useState("");
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [selectedRideId, setSelectedRideId] = useState<string | null>(null);
  const [focus, setFocus] = useState<MapFocus | null>(null);

  const [trailMinutes, setTrailMinutes] = useState(60);
  // Kept with the driver they belong to, so switching driver can never show
  // the previous one's trail while the new one loads.
  const [history, setHistory] = useState<{
    driverId: string;
    trail: TrailPoint[];
    contacts: DispatchContactRow[];
  } | null>(null);

  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const requestRef = useRef(0);

  // `loading` starts true and `refreshing` is raised by whoever asks, so this
  // never sets state before its first await.
  const load = useCallback(async (quiet = false) => {
    const requestId = ++requestRef.current;
    try {
      const [drivers, dispatch] = await Promise.all([fetchLiveDrivers(), fetchDispatch()]);
      if (requestId !== requestRef.current) return;
      setLive(drivers);
      setRides(dispatch.rides);
      setError(null);
    } catch (loadError) {
      if (requestId !== requestRef.current) return;
      // A failed background poll keeps the last picture on screen.
      if (!quiet) setError(loadError);
    } finally {
      if (requestId === requestRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  // First load, then poll only while someone is looking. Coming back to the
  // tab refreshes at once.
  useEffect(() => {
    const tick = () => {
      if (!document.hidden) void load(true);
    };
    const first = setTimeout(() => void load(), 0);
    const timer = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [load]);

  // A fresh key each time, so asking for the same spot twice re-centres the map.
  const focusOn = useCallback((lat: number, lng: number) => {
    setFocus((previous) => ({ lat, lng, key: (previous?.key ?? 0) + 1 }));
  }, []);

  const drivers = useMemo(() => live?.drivers ?? [], [live]);
  const selectedDriver = useMemo(
    () => drivers.find((driver) => driver.id === selectedDriverId) ?? null,
    [drivers, selectedDriverId],
  );

  // Trail + contact history follow the selected driver and refresh with each poll.
  const generatedAt = live?.generatedAt;
  useEffect(() => {
    if (!selectedDriverId) return;
    let cancelled = false;
    Promise.all([fetchDriverTrail(selectedDriverId, trailMinutes), fetchLiveDriver(selectedDriverId)])
      .then(([trailResult, detail]) => {
        if (cancelled) return;
        setHistory({ driverId: selectedDriverId, trail: trailResult.points, contacts: detail.contacts });
      })
      .catch(() => {
        // The pin and the phone number are already on screen; a missing trail is not worth an error page.
      });
    return () => {
      cancelled = true;
    };
  }, [selectedDriverId, trailMinutes, generatedAt]);

  const ownHistory = history && history.driverId === selectedDriverId ? history : null;
  const trail = useMemo(() => ownHistory?.trail ?? [], [ownHistory]);
  const contacts = ownHistory?.contacts ?? [];

  const retry = () => {
    setLoading(true);
    void load();
  };
  const refresh = () => {
    setRefreshing(true);
    void load(true);
  };

  const visibleDrivers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return drivers
      .filter((driver) => presenceFilter === "all" || driver.presence === presenceFilter)
      .filter(
        (driver) =>
          !needle ||
          driver.name.toLowerCase().includes(needle) ||
          (driver.phone ?? "").includes(needle) ||
          (driver.plate ?? "").toLowerCase().includes(needle),
      )
      .sort(
        (a, b) =>
          PRESENCE_ORDER.indexOf(a.presence) - PRESENCE_ORDER.indexOf(b.presence) ||
          a.secondsSinceSeen - b.secondsSinceSeen,
      );
  }, [drivers, presenceFilter, search]);

  const selectDriver = useCallback(
    (id: string) => {
      setSelectedDriverId(id);
      setTab("drivers");
      const driver = drivers.find((row) => row.id === id);
      if (driver) focusOn(driver.lat, driver.lng);
    },
    [drivers, focusOn],
  );

  const selectRide = useCallback(
    (id: string) => {
      setSelectedRideId(id);
      setTab("dispatch");
      const ride = rides.find((row) => row.id === id);
      if (ride) focusOn(ride.pickupLat, ride.pickupLng);
    },
    [rides, focusOn],
  );

  async function handleNudge(driverId: string, name: string, rideId: string | null) {
    setBusyKey(`nudge:${driverId}`);
    try {
      await nudgeDriver(driverId, rideId);
      setNotice({ tone: "ok", text: `Nudge sent to ${name}.` });
      await load(true);
    } catch (actionError) {
      setNotice({ tone: "bad", text: actionError instanceof Error ? actionError.message : "Could not send the nudge." });
    } finally {
      setBusyKey(null);
    }
  }

  async function handleLogCall(driverId: string, name: string, outcome: DispatchOutcome, rideId: string | null) {
    setBusyKey(`call:${driverId}`);
    try {
      await logDriverCall(driverId, { outcome, rideId });
      setNotice({ tone: "ok", text: `Saved: ${name} — ${OUTCOMES.find((o) => o.value === outcome)?.label}.` });
      await load(true);
    } catch (actionError) {
      setNotice({ tone: "bad", text: actionError instanceof Error ? actionError.message : "Could not save the call." });
    } finally {
      setBusyKey(null);
    }
  }

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [notice]);

  if (loading && !live) return <Spinner label="Finding your drivers…" />;
  if (error && !live) return <ErrorState error={error} onRetry={retry} />;

  const summary = live?.summary;

  return (
    <div className="lm-page">
      <PageHeader
        title="Live map"
        subtitle={
          <>
            Where every driver is right now. Updates every 10 seconds
            {live ? <> · last updated {formatWhen(live.generatedAt)}</> : null}
          </>
        }
        actions={<RefreshButton onClick={refresh} busy={refreshing} />}
      />

      <div className="lm-chips" role="group" aria-label="Filter drivers by status">
        <button
          type="button"
          className={`lm-chip${presenceFilter === "all" ? " active" : ""}`}
          onClick={() => setPresenceFilter("all")}
        >
          <span className="lm-chip-count">{summary?.total ?? 0}</span>
          <span className="lm-chip-label">All drivers</span>
        </button>
        {PRESENCE_ORDER.map((presence) => (
          <button
            key={presence}
            type="button"
            title={PRESENCE[presence].hint}
            className={`lm-chip${presenceFilter === presence ? " active" : ""}`}
            onClick={() => setPresenceFilter(presenceFilter === presence ? "all" : presence)}
          >
            <span className={`lm-dot lm-dot--${presence}`} aria-hidden />
            <span className="lm-chip-count">{summary?.[presence] ?? 0}</span>
            <span className="lm-chip-label">{PRESENCE[presence].label}</span>
          </button>
        ))}
        <button
          type="button"
          className={`lm-chip lm-chip-rides${rides.length > 0 ? " hot" : ""}`}
          onClick={() => setTab("dispatch")}
        >
          <span className="lm-chip-count">{rides.length}</span>
          <span className="lm-chip-label">Riders waiting</span>
        </button>
      </div>

      {notice ? (
        <div className={`lm-notice ${notice.tone}`} role="status">
          {notice.text}
        </div>
      ) : null}

      <div className="lm-shell">
        <div className="lm-map-wrap">
          <LiveMapCanvas
            drivers={visibleDrivers}
            rides={rides}
            selectedDriverId={selectedDriverId}
            selectedRideId={selectedRideId}
            trail={trail}
            focus={focus}
            onSelectDriver={selectDriver}
            onSelectRide={selectRide}
          />
        </div>

        <aside className="lm-panel">
          <div className="lm-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "drivers"}
              className={`lm-tab${tab === "drivers" ? " active" : ""}`}
              onClick={() => setTab("drivers")}
            >
              Drivers
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "dispatch"}
              className={`lm-tab${tab === "dispatch" ? " active" : ""}`}
              onClick={() => setTab("dispatch")}
            >
              Dispatch
              {rides.length > 0 ? <span className="lm-tab-badge">{rides.length}</span> : null}
            </button>
          </div>

          {tab === "drivers" ? (
            selectedDriver ? (
              <DriverDetail
                driver={selectedDriver}
                contacts={contacts}
                trailCount={trail.length}
                trailMinutes={trailMinutes}
                onTrailMinutes={setTrailMinutes}
                busyKey={busyKey}
                onBack={() => setSelectedDriverId(null)}
                onLocate={() => focusOn(selectedDriver.lat, selectedDriver.lng)}
                onNudge={() => void handleNudge(selectedDriver.id, selectedDriver.name, null)}
                onLogCall={(outcome) => void handleLogCall(selectedDriver.id, selectedDriver.name, outcome, null)}
              />
            ) : (
              <>
                <div className="lm-search">
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search name, phone or plate"
                    aria-label="Search drivers"
                  />
                </div>
                <div className="lm-list">
                  {visibleDrivers.length === 0 ? (
                    <EmptyState>
                      {drivers.length === 0
                        ? "No driver has shared a location yet. They appear here the first time they go online."
                        : "No drivers match this filter."}
                    </EmptyState>
                  ) : (
                    visibleDrivers.map((driver) => (
                      <button key={driver.id} type="button" className="lm-row" onClick={() => selectDriver(driver.id)}>
                        <span className={`lm-dot lm-dot--${driver.presence}`} aria-hidden />
                        <span className="lm-row-main">
                          <span className="lm-row-name">{driver.name}</span>
                          <span className="lm-row-sub">
                            {[driver.vehicle, driver.plate].filter(Boolean).join(" · ") || "No vehicle on file"}
                          </span>
                        </span>
                        <span className="lm-row-side">
                          <span className="lm-row-state">{PRESENCE[driver.presence].label}</span>
                          <span className="lm-row-seen">{ago(driver.secondsSinceSeen)}</span>
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </>
            )
          ) : (
            <div className="lm-list">
              {rides.length === 0 ? (
                <EmptyState>Nobody is waiting. Rides that go unanswered show up here with the closest drivers to call.</EmptyState>
              ) : (
                rides.map((ride) => (
                  <RideCard
                    key={ride.id}
                    ride={ride}
                    open={ride.id === selectedRideId || rides.length === 1}
                    busyKey={busyKey}
                    onToggle={() => selectRide(ride.id)}
                    onShowDriver={selectDriver}
                    onNudge={(candidate) => void handleNudge(candidate.id, candidate.name, ride.id)}
                    onLogCall={(candidate, outcome) => void handleLogCall(candidate.id, candidate.name, outcome, ride.id)}
                  />
                ))
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

/* ── call / nudge ──────────────────────────────────────────────────────── */

function ContactActions({
  phone,
  nudgeDisabled,
  nudgeBusy,
  callBusy,
  onNudge,
  onLogCall,
}: {
  phone: string | null;
  nudgeDisabled?: boolean;
  nudgeBusy: boolean;
  callBusy: boolean;
  onNudge: () => void;
  onLogCall: (outcome: DispatchOutcome) => void;
}) {
  const [logging, setLogging] = useState(false);

  return (
    <div className="lm-actions">
      <div className="lm-actions-row">
        {phone ? (
          <a className="lm-btn lm-btn-call" href={`tel:${phone}`} onClick={() => setLogging(true)}>
            Call {phone}
          </a>
        ) : (
          <span className="lm-btn lm-btn-disabled">No phone on file</span>
        )}
        <button type="button" className="lm-btn" onClick={onNudge} disabled={nudgeDisabled || nudgeBusy}>
          {nudgeBusy ? "Sending…" : "Nudge"}
        </button>
      </div>
      {phone ? (
        logging ? (
          <div className="lm-outcomes">
            <span className="lm-outcomes-label">How did the call go?</span>
            <div className="lm-outcomes-row">
              {OUTCOMES.map((outcome) => (
                <button
                  key={outcome.value}
                  type="button"
                  className={`lm-outcome lm-outcome--${outcome.value}`}
                  disabled={callBusy}
                  onClick={() => {
                    onLogCall(outcome.value);
                    setLogging(false);
                  }}
                >
                  {outcome.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <button type="button" className="lm-link" onClick={() => setLogging(true)}>
            Log a call
          </button>
        )
      ) : null}
    </div>
  );
}

/* ── one driver ────────────────────────────────────────────────────────── */

function DriverDetail({
  driver,
  contacts,
  trailCount,
  trailMinutes,
  onTrailMinutes,
  busyKey,
  onBack,
  onLocate,
  onNudge,
  onLogCall,
}: {
  driver: LiveDriver;
  contacts: DispatchContactRow[];
  trailCount: number;
  trailMinutes: number;
  onTrailMinutes: (minutes: number) => void;
  busyKey: string | null;
  onBack: () => void;
  onLocate: () => void;
  onNudge: () => void;
  onLogCall: (outcome: DispatchOutcome) => void;
}) {
  return (
    <div className="lm-detail">
      <button type="button" className="lm-link lm-back" onClick={onBack}>
        ← All drivers
      </button>

      <div className="lm-detail-head">
        <div>
          <h2 className="lm-detail-name">{driver.name}</h2>
          <p className="lm-detail-sub">
            {[driver.vehicle, driver.plate].filter(Boolean).join(" · ") || "No vehicle on file"}
          </p>
        </div>
        <span className={`lm-state lm-state--${driver.presence}`}>
          <span className={`lm-dot lm-dot--${driver.presence}`} aria-hidden />
          {PRESENCE[driver.presence].label}
        </span>
      </div>

      <p className="lm-detail-hint">
        {PRESENCE[driver.presence].hint}. Position from {ago(driver.secondsSinceSeen)}
        {driver.positionSource === "standby" ? " (rough, off-shift)" : ""}.
      </p>

      <dl className="lm-facts">
        <div>
          <dt>Rating</dt>
          <dd>{driver.rating.toFixed(1)}</dd>
        </div>
        <div>
          <dt>Trips</dt>
          <dd>{driver.totalRides}</dd>
        </div>
        <div>
          <dt>Nearby alerts</dt>
          <dd>{driver.standbyEnabled ? "On" : "Off"}</dd>
        </div>
      </dl>

      {driver.ride ? (
        <div className="lm-trip">
          <span className="lm-trip-label">Current trip</span>
          <span className="lm-trip-line">{driver.ride.pickupAddress}</span>
          <span className="lm-trip-arrow">to</span>
          <span className="lm-trip-line">{driver.ride.destAddress}</span>
        </div>
      ) : null}

      <ContactActions
        phone={driver.phone}
        nudgeDisabled={driver.presence === "on_trip"}
        nudgeBusy={busyKey === `nudge:${driver.id}`}
        callBusy={busyKey === `call:${driver.id}`}
        onNudge={onNudge}
        onLogCall={onLogCall}
      />

      <div className="lm-trail">
        <div className="lm-trail-head">
          <span className="lm-section">Where they have been</span>
          <select
            value={trailMinutes}
            onChange={(event) => onTrailMinutes(Number(event.target.value))}
            aria-label="Trail window"
          >
            {TRAIL_WINDOWS.map((option) => (
              <option key={option.minutes} value={option.minutes}>
                Last {option.label}
              </option>
            ))}
          </select>
        </div>
        <p className="lm-trail-note">
          {trailCount >= 2
            ? `${trailCount} points drawn on the map.`
            : "No movement recorded in this window."}
        </p>
      </div>

      <div className="lm-detail-links">
        <button type="button" className="admin-btn-ghost" onClick={onLocate}>
          Centre on map
        </button>
        <Link className="admin-btn-ghost" href={`/admin/dashboard/users/${driver.userId}`}>
          Open profile
        </Link>
      </div>

      {contacts.length > 0 ? (
        <div className="lm-history">
          <span className="lm-section">Recent contact</span>
          <ul>
            {contacts.slice(0, 6).map((contact) => (
              <li key={contact.id}>{describeContact(contact)}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/* ── one waiting ride ──────────────────────────────────────────────────── */

function RideCard({
  ride,
  open,
  busyKey,
  onToggle,
  onShowDriver,
  onNudge,
  onLogCall,
}: {
  ride: DispatchRide;
  open: boolean;
  busyKey: string | null;
  onToggle: () => void;
  onShowDriver: (driverId: string) => void;
  onNudge: (candidate: DispatchCandidate) => void;
  onLogCall: (candidate: DispatchCandidate, outcome: DispatchOutcome) => void;
}) {
  const price = ride.offerNgn ?? ride.estimateNgn;

  return (
    <div className={`lm-ride-card${open ? " open" : ""}`}>
      <button type="button" className="lm-ride-head" onClick={onToggle}>
        <span className="lm-ride-wait">{waited(ride.waitingSeconds)}</span>
        <span className="lm-ride-route">
          <span className="lm-ride-from">{ride.pickupAddress}</span>
          <span className="lm-ride-to">to {ride.destAddress}</span>
        </span>
        <span className="lm-ride-meta">
          {price !== null ? <strong>{formatNaira(price)}</strong> : null}
          <span>
            {ride.bidCount} {ride.bidCount === 1 ? "offer" : "offers"}
          </span>
        </span>
      </button>

      {open ? (
        <div className="lm-candidates">
          {ride.nearest.length === 0 ? (
            <p className="lm-trail-note">No reachable driver has a known position yet.</p>
          ) : (
            ride.nearest.map((candidate) => (
              <div key={candidate.id} className="lm-candidate">
                <button type="button" className="lm-candidate-head" onClick={() => onShowDriver(candidate.id)}>
                  <span className={`lm-dot lm-dot--${candidate.presence}`} aria-hidden />
                  <span className="lm-row-main">
                    <span className="lm-row-name">{candidate.name}</span>
                    <span className="lm-row-sub">
                      {PRESENCE[candidate.presence].label} · seen {ago(candidate.secondsSinceSeen)}
                    </span>
                  </span>
                  <span className="lm-row-side">
                    <span className="lm-row-state">{candidate.distanceKm} km</span>
                    <span className="lm-row-seen">~{candidate.etaMinutes} min away</span>
                  </span>
                </button>
                {candidate.contacts.length > 0 ? (
                  <p className="lm-candidate-last">{describeContact(candidate.contacts[0])}</p>
                ) : null}
                <ContactActions
                  phone={candidate.phone}
                  nudgeBusy={busyKey === `nudge:${candidate.id}`}
                  callBusy={busyKey === `call:${candidate.id}`}
                  onNudge={() => onNudge(candidate)}
                  onLogCall={(outcome) => onLogCall(candidate, outcome)}
                />
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
