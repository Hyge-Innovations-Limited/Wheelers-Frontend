"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { adminFetch } from "@/lib/admin-api";
import { kycFieldLabel } from "@/lib/kyc-fields";

interface DriverAnalytics {
  totalDrivers: number;
  pendingKyc: number;
  byKycStatus: Array<{ status: string; count: number }>;
  byStatus: Array<{ status: string; count: number }>;
  topDrivers: Array<{
    driverId: string;
    name: string | null;
    phone: string | null;
    email: string | null;
    totalRides: number;
    totalEarningsNgn: string;
    rating: number;
    kycStatus: string;
    status: string;
  }>;
}

interface PendingDriver {
  driverId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  vehicleMake: string | null;
  vehicleModel: string | null;
  vehiclePlate: string | null;
  vehicleYear: number | null;
  status: string;
  submittedAt: string | null;
  reviewedAt?: string | null;
  /** Under review again after a fix: only these were resent. */
  resubmittedFields?: string[];
  /** Sent back to the driver: what they have to fix. */
  rejectedFields?: string[];
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
    case "APPROVED":
      return "admin-badge green";
    case "SUBMITTED":
    case "PENDING":
      return "admin-badge orange";
    case "REJECTED":
      return "admin-badge red";
    case "ONLINE":
      return "admin-badge green";
    case "ON_RIDE":
      return "admin-badge blue";
    case "OFFLINE":
      return "admin-badge gray";
    default:
      return "admin-badge gray";
  }
}

export default function AdminDriversPage() {
  const [analytics, setAnalytics] = useState<DriverAnalytics | null>(null);
  const [pending, setPending] = useState<PendingDriver[]>([]);
  const [sentBack, setSentBack] = useState<PendingDriver[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [analyticsRes, pendingRes, sentBackRes] = await Promise.all([
        adminFetch("/admin/analytics/drivers"),
        adminFetch("/admin/drivers"),
        adminFetch("/admin/drivers?status=REJECTED"),
      ]);

      if (analyticsRes.ok) {
        setAnalytics(await analyticsRes.json());
      }
      if (pendingRes.ok) {
        const data = await pendingRes.json();
        setPending(data.drivers ?? []);
      }
      if (sentBackRes.ok) {
        const data = await sentBackRes.json();
        setSentBack(data.drivers ?? []);
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

  return (
    <div>
      <div className="admin-page-header">
        <h1>Drivers</h1>
        <p>Driver analytics, KYC reviews, and top performers</p>
      </div>

      {/* Stats row */}
      {analytics && (
        <>
          <div className="admin-stats-grid">
            <div className="admin-stat-card">
              <p className="label">Total Drivers</p>
              <p className="value">{analytics.totalDrivers}</p>
            </div>
            <div className="admin-stat-card">
              <p className="label">Pending KYC</p>
              <p className="value orange">{analytics.pendingKyc}</p>
            </div>
            {analytics.byKycStatus.map((s) => (
              <div className="admin-stat-card" key={s.status}>
                <p className="label">KYC {s.status}</p>
                <p className="value">{s.count}</p>
              </div>
            ))}
          </div>

          <div className="admin-stats-grid">
            {analytics.byStatus.map((s) => (
              <div className="admin-stat-card" key={s.status}>
                <p className="label">{s.status}</p>
                <p className="value">{s.count}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Pending KYC table */}
      {pending.length > 0 && (
        <div className="admin-table-card">
          <div className="admin-table-header">
            <h2>Pending KYC Applications</h2>
            <span className="count">{pending.length} pending</span>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Vehicle</th>
                  <th>Submitted</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((d) => (
                  <tr
                    key={d.driverId}
                    onClick={() => window.location.href = `/admin/dashboard/drivers/${d.driverId}`}
                    style={{ cursor: "pointer" }}
                  >
                    <td>
                      {d.name || "—"}
                      {d.resubmittedFields && d.resubmittedFields.length > 0 && (
                        <div style={{ marginTop: 4 }}>
                          <span className="admin-badge blue">
                            Resubmitted: {d.resubmittedFields.map(kycFieldLabel).join(", ")}
                          </span>
                        </div>
                      )}
                    </td>
                    <td>{d.phone || d.email || "—"}</td>
                    <td>
                      {d.vehicleMake} {d.vehicleModel}{" "}
                      {d.vehicleYear ? `(${d.vehicleYear})` : ""}{" "}
                      {d.vehiclePlate ? `— ${d.vehiclePlate}` : ""}
                    </td>
                    <td>
                      {d.submittedAt
                        ? new Date(d.submittedAt).toLocaleDateString("en-NG", {
                            dateStyle: "medium",
                          })
                        : "—"}
                    </td>
                    <td>
                      <Link
                        href={`/admin/dashboard/drivers/${d.driverId}`}
                        className="admin-review-link"
                      >
                        Review
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sent back to the driver, waiting on their fix */}
      {sentBack.length > 0 && (
        <div className="admin-table-card">
          <div className="admin-table-header">
            <h2>Sent back to driver</h2>
            <span className="count">{sentBack.length} waiting on a fix</span>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>To fix</th>
                  <th>Sent back</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {sentBack.map((d) => (
                  <tr key={d.driverId}>
                    <td>{d.name || "—"}</td>
                    <td>{d.phone || d.email || "—"}</td>
                    <td>{(d.rejectedFields ?? []).map(kycFieldLabel).join(", ") || "Everything"}</td>
                    <td>
                      {d.reviewedAt
                        ? new Date(d.reviewedAt).toLocaleDateString("en-NG", { dateStyle: "medium" })
                        : "—"}
                    </td>
                    <td>
                      <Link href={`/admin/dashboard/drivers/${d.driverId}`} className="admin-review-link">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Top drivers */}
      {analytics && analytics.topDrivers.length > 0 && (
        <div className="admin-table-card">
          <div className="admin-table-header">
            <h2>Top Drivers</h2>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Rides</th>
                  <th>Earnings</th>
                  <th>Rating</th>
                  <th>KYC</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {analytics.topDrivers.map((d) => (
                  <tr key={d.driverId}>
                    <td>{d.name || "—"}</td>
                    <td>{d.phone || d.email || "—"}</td>
                    <td>{d.totalRides}</td>
                    <td>{formatNaira(d.totalEarningsNgn)}</td>
                    <td>⭐ {d.rating.toFixed(1)}</td>
                    <td>
                      <span className={getStatusBadge(d.kycStatus)}>
                        {d.kycStatus}
                      </span>
                    </td>
                    <td>
                      <span className={getStatusBadge(d.status)}>
                        {d.status}
                      </span>
                    </td>
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
