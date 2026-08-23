"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { adminFetch } from "@/lib/admin-api";
import { eventBadgeClass, formatEventType, formatWhen, metadataSummary } from "@/lib/activity-format";

interface ActivityUser {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  role: string;
}

interface ActivityEvent {
  id: string;
  userId: string;
  eventType: string;
  source: string;
  rideId: string | null;
  metadata: Record<string, unknown> | null;
  occurredAt: string;
  createdAt: string;
}

interface ActivityResponse {
  items: ActivityEvent[];
  nextCursor: string | null;
  user: ActivityUser | null;
}

function ActivityExplorer() {
  const searchParams = useSearchParams();
  const initialUserId = searchParams.get("userId") ?? "";

  const [userIdInput, setUserIdInput] = useState(initialUserId);
  const [activeUserId, setActiveUserId] = useState(initialUserId);
  const [typeFilter, setTypeFilter] = useState("");
  const [user, setUser] = useState<ActivityUser | null>(null);
  const [items, setItems] = useState<ActivityEvent[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchActivity = useCallback(
    async (userId: string, cursor: string | null, type: string, append: boolean) => {
      if (!userId.trim()) return;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ userId: userId.trim(), limit: "50" });
        if (cursor) params.set("cursor", cursor);
        if (type) params.set("type", type);
        const res = await adminFetch(`/admin/analytics/activity?${params.toString()}`);
        if (!res.ok) {
          setError(`Failed to load activity (${res.status})`);
          return;
        }
        const data: ActivityResponse = await res.json();
        setUser(data.user);
        setItems((prev) => (append ? [...prev, ...data.items] : data.items));
        setNextCursor(data.nextCursor);
      } catch {
        setError("Could not reach the API.");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (initialUserId) {
      void fetchActivity(initialUserId, null, "", false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialUserId]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setActiveUserId(userIdInput);
    setItems([]);
    setNextCursor(null);
    void fetchActivity(userIdInput, null, typeFilter, false);
  }

  function handleTypeChange(type: string) {
    setTypeFilter(type);
    if (activeUserId) {
      setItems([]);
      setNextCursor(null);
      void fetchActivity(activeUserId, null, type, false);
    }
  }

  const knownTypes = [...new Set(items.map((i) => i.eventType))].sort();

  return (
    <div>
      <div className="admin-page-header">
        <h1>User Activity</h1>
        <p>Everything a user has done on the platform, newest first</p>
      </div>

      <form onSubmit={handleSearch} className="admin-activity-search">
        <input
          className="admin-input"
          placeholder="Paste a user ID (uuid)…"
          value={userIdInput}
          onChange={(e) => setUserIdInput(e.target.value)}
        />
        <select
          className="admin-input admin-select"
          value={typeFilter}
          onChange={(e) => handleTypeChange(e.target.value)}
        >
          <option value="">All events</option>
          {knownTypes.map((t) => (
            <option key={t} value={t}>{formatEventType(t)}</option>
          ))}
        </select>
        <button type="submit" className="admin-btn-primary" disabled={loading}>
          {loading ? "Loading…" : "Load"}
        </button>
      </form>

      {error && <div className="admin-empty">{error}</div>}

      {user && (
        <div className="admin-stats-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
          <div className="admin-stat-card">
            <p className="label">Name</p>
            <p className="value" style={{ fontSize: 18 }}>{user.name || "—"}</p>
          </div>
          <div className="admin-stat-card">
            <p className="label">Phone</p>
            <p className="value" style={{ fontSize: 18 }}>{user.phone || "—"}</p>
          </div>
          <div className="admin-stat-card">
            <p className="label">Role</p>
            <p className="value" style={{ fontSize: 18 }}>{user.role}</p>
          </div>
          <div className="admin-stat-card">
            <p className="label">Events Loaded</p>
            <p className="value orange" style={{ fontSize: 18 }}>{items.length}{nextCursor ? "+" : ""}</p>
          </div>
        </div>
      )}

      {items.length > 0 && (
        <div className="admin-table-card">
          <div className="admin-table-header">
            <h2>Timeline</h2>
            <span className="count">{items.length} events</span>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Event</th>
                  <th>Source</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {items.map((event) => (
                  <tr key={event.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{formatWhen(event.occurredAt)}</td>
                    <td>
                      <span className={eventBadgeClass(event.eventType)}>
                        {formatEventType(event.eventType)}
                      </span>
                    </td>
                    <td>{event.source}</td>
                    <td className="admin-activity-details">{metadataSummary(event.metadata)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {nextCursor && (
            <div className="admin-load-more">
              <button
                className="admin-btn-primary"
                disabled={loading}
                onClick={() => void fetchActivity(activeUserId, nextCursor, typeFilter, true)}
              >
                {loading ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </div>
      )}

      {!loading && !error && activeUserId && items.length === 0 && user !== null && (
        <div className="admin-empty">No activity recorded for this user yet.</div>
      )}

      {!activeUserId && (
        <div className="admin-empty">
          Paste a user ID above, or click a user from the Dashboard feed or Riders page.
        </div>
      )}
    </div>
  );
}

export default function AdminActivityPage() {
  return (
    <Suspense fallback={<div className="admin-spinner-wrap"><div className="admin-spinner"></div></div>}>
      <ActivityExplorer />
    </Suspense>
  );
}
