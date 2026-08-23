"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { adminFetch } from "@/lib/admin-api";

interface RiderAnalytics {
  totalRiders: number;
  ridersWithRides: number;
  ridesByStatus: Array<{ status: string; count: number }>;
  topRiders: Array<{
    riderId: string;
    name: string | null;
    phone: string | null;
    email: string | null;
    rideCount: number;
    totalSpentNgn: string;
  }>;
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

function getStatusBadge(status: string) {
  switch (status) {
    case "COMPLETED":
      return "admin-badge green";
    case "CANCELLED":
      return "admin-badge red";
    case "REQUESTED":
    case "MATCHING":
      return "admin-badge orange";
    case "IN_PROGRESS":
    case "DRIVER_EN_ROUTE":
    case "ARRIVED":
      return "admin-badge blue";
    case "DISPUTED":
      return "admin-badge red";
    default:
      return "admin-badge gray";
  }
}

export default function AdminRidersPage() {
  const [analytics, setAnalytics] = useState<RiderAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const res = await adminFetch("/admin/analytics/riders");
      if (res.ok) {
        setAnalytics(await res.json());
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="admin-spinner-wrap"><div className="admin-spinner"></div></div>;
  }

  if (!analytics) {
    return <div className="admin-empty">Failed to load rider analytics.</div>;
  }

  return (
    <div>
      <div className="admin-page-header">
        <h1>Riders</h1>
        <p>Rider analytics, ride breakdown, and top riders</p>
      </div>

      <div className="admin-stats-grid">
        <div className="admin-stat-card">
          <p className="label">Total Riders</p>
          <p className="value">{analytics.totalRiders.toLocaleString()}</p>
        </div>
        <div className="admin-stat-card">
          <p className="label">Riders With Rides</p>
          <p className="value green">
            {analytics.ridersWithRides.toLocaleString()}
          </p>
        </div>
        <div className="admin-stat-card">
          <p className="label">Inactive Riders</p>
          <p className="value" style={{ color: "#786F68" }}>
            {(analytics.totalRiders - analytics.ridersWithRides).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Rides by status */}
      {analytics.ridesByStatus.length > 0 && (
        <div className="admin-stats-grid">
          {analytics.ridesByStatus.map((s) => (
            <div className="admin-stat-card" key={s.status}>
              <p className="label">{s.status.replace(/_/g, " ")}</p>
              <p className="value">{s.count}</p>
            </div>
          ))}
        </div>
      )}

      {/* Top riders */}
      {analytics.topRiders.length > 0 && (
        <div className="admin-table-card">
          <div className="admin-table-header">
            <h2>Top Riders</h2>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Total Rides</th>
                  <th>Total Spent</th>
                </tr>
              </thead>
              <tbody>
                {analytics.topRiders.map((r) => (
                  <tr key={r.riderId}>
                    <td>
                      <Link className="admin-user-link" href={`/admin/dashboard/activity?userId=${r.riderId}`}>
                        {r.name || "—"}
                      </Link>
                    </td>
                    <td>{r.phone || "—"}</td>
                    <td>{r.email || "—"}</td>
                    <td>{r.rideCount}</td>
                    <td>{formatNaira(r.totalSpentNgn)}</td>
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
