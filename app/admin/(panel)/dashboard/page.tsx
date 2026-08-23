"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { adminFetch } from "@/lib/admin-api";
import { eventBadgeClass, formatEventType, formatWhen } from "@/lib/activity-format";

interface FeedEvent {
  id: string;
  userId: string;
  userName: string | null;
  userPhone: string | null;
  eventType: string;
  source: string;
  occurredAt: string;
}

interface ActivityFeed {
  counts: Array<{ eventType: string; count: number }>;
  recent: FeedEvent[];
}

interface PlatformStats {
  totalUsers: number;
  totalRiders: number;
  totalDrivers: number;
  approvedDrivers: number;
  onlineDrivers: number;
  totalRides: number;
  completedRides: number;
  cancelledRides: number;
  activeRides: number;
  totalRevenueNgn: string;
  platformFeesNgn: string;
}

function formatNaira(value: string) {
  const num = parseFloat(value);
  if (isNaN(num)) return "₦0.00";
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
  }).format(num);
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [feed, setFeed] = useState<ActivityFeed | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    fetchFeed();
    // Keep the live feed fresh without a manual reload
    const timer = setInterval(fetchFeed, 30_000);
    return () => clearInterval(timer);
  }, []);

  async function fetchStats() {
    try {
      const res = await adminFetch("/admin/analytics/platform");
      if (res.ok) {
        setStats(await res.json());
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function fetchFeed() {
    try {
      const res = await adminFetch("/admin/analytics/activity-feed?limit=25");
      if (res.ok) {
        setFeed(await res.json());
      }
    } catch {
      // feed is additive — the dashboard still works without it
    }
  }

  if (loading) {
    return <div className="admin-spinner-wrap"><div className="admin-spinner"></div></div>;
  }

  if (!stats) {
    return <div className="admin-empty">Failed to load platform stats.</div>;
  }

  return (
    <div>
      <div className="admin-page-header">
        <h1>Dashboard</h1>
        <p>Platform overview and key metrics</p>
      </div>

      <p className="admin-section-label">Users</p>
      <div className="admin-stats-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <div className="admin-stat-card">
          <p className="label">Total Users</p>
          <p className="value">{stats.totalUsers.toLocaleString()}</p>
        </div>
        <div className="admin-stat-card">
          <p className="label">Total Riders</p>
          <p className="value">{stats.totalRiders.toLocaleString()}</p>
        </div>
        <div className="admin-stat-card">
          <p className="label">Total Drivers</p>
          <p className="value">{stats.totalDrivers.toLocaleString()}</p>
        </div>
      </div>

      <p className="admin-section-label">Drivers</p>
      <div className="admin-stats-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <div className="admin-stat-card">
          <p className="label">Approved Drivers</p>
          <p className="value green">{stats.approvedDrivers.toLocaleString()}</p>
        </div>
        <div className="admin-stat-card">
          <p className="label">Online Drivers</p>
          <p className="value green">{stats.onlineDrivers.toLocaleString()}</p>
        </div>
        <div className="admin-stat-card">
          <p className="label">Active Rides</p>
          <p className="value orange">{stats.activeRides.toLocaleString()}</p>
        </div>
      </div>

      <p className="admin-section-label">Rides</p>
      <div className="admin-stats-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <div className="admin-stat-card">
          <p className="label">Total Rides</p>
          <p className="value">{stats.totalRides.toLocaleString()}</p>
        </div>
        <div className="admin-stat-card">
          <p className="label">Completed Rides</p>
          <p className="value green">{stats.completedRides.toLocaleString()}</p>
        </div>
        <div className="admin-stat-card">
          <p className="label">Cancelled Rides</p>
          <p className="value" style={{ color: "#FF3333" }}>
            {stats.cancelledRides.toLocaleString()}
          </p>
        </div>
      </div>

      <p className="admin-section-label">Revenue</p>
      <div className="admin-stats-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
        <div className="admin-stat-card">
          <p className="label">Total Revenue</p>
          <p className="value">{formatNaira(stats.totalRevenueNgn)}</p>
        </div>
        <div className="admin-stat-card">
          <p className="label">Platform Fees Earned</p>
          <p className="value orange">{formatNaira(stats.platformFeesNgn)}</p>
        </div>
      </div>

      {feed && feed.counts.length > 0 && (
        <>
          <p className="admin-section-label">Last 24 hours</p>
          <div className="admin-pulse-grid">
            {feed.counts.map((c) => (
              <div className="admin-pulse-chip" key={c.eventType}>
                <span className={eventBadgeClass(c.eventType)}>{formatEventType(c.eventType)}</span>
                <span className="admin-pulse-count">{c.count.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {feed && feed.recent.length > 0 && (
        <div className="admin-table-card">
          <div className="admin-table-header">
            <h2>Live Activity</h2>
            <span className="count">auto-refreshes every 30s</span>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>User</th>
                  <th>Event</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {feed.recent.map((event) => (
                  <tr key={event.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{formatWhen(event.occurredAt)}</td>
                    <td>
                      <Link
                        className="admin-user-link"
                        href={`/admin/dashboard/activity?userId=${event.userId}`}
                      >
                        {event.userName || event.userPhone || `${event.userId.slice(0, 8)}…`}
                      </Link>
                    </td>
                    <td>
                      <span className={eventBadgeClass(event.eventType)}>
                        {formatEventType(event.eventType)}
                      </span>
                    </td>
                    <td>{event.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
