"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { adminFetch, getToken } from "@/lib/admin-api";
import { QUICK_REASONS, kycFieldLabel } from "@/lib/kyc-fields";

interface FieldStatus {
  status: "approved" | "rejected";
  reason?: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

interface DriverDetail {
  driverId: string;
  userId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  kycStatus: string;
  submission: {
    status: string;
    submittedAt: string | null;
    vehicleMake: string | null;
    vehicleModel: string | null;
    vehiclePlate: string | null;
    vehicleYear: number | null;
    ninImageUrl: string | null;
    licenceImageUrl: string | null;
    /** "application/pdf" when the licence is a PDF (older ones were saved as .jpg). */
    licenceFileType?: string | null;
    selfieUrl: string | null;
    vehicleImageUrls: string[];
    rejectionReason: string | null;
    rejectedFields: string[];
    /** Under review again after a fix: only these were resent; the rest was approved before. */
    resubmittedFields?: string[];
    previousRejectionReason?: string | null;
    fieldStatuses: Record<string, FieldStatus>;
  };
}

const REVIEW_FIELDS = [
  { key: "nin", label: "NIN Card", imageKey: "ninImageUrl" },
  { key: "licence", label: "Driver's Licence", imageKey: "licenceImageUrl" },
  { key: "selfie", label: "Selfie", imageKey: "selfieUrl" },
  { key: "vehicle", label: "Vehicle Details", imageKey: null },
  { key: "vehiclePhotos", label: "Vehicle Photos", imageKey: null },
];

/** A document as the driver sent it: a photo, or a PDF shown as a document. */
function DocumentView({ url, label, isPdf }: { url: string; label: string; isPdf: boolean }) {
  if (isPdf) {
    return (
      <div>
        <iframe
          src={url}
          title={label}
          style={{ width: "100%", height: 420, border: "none", display: "block", background: "#f5ead8" }}
        />
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          style={{ display: "inline-block", padding: "8px 12px", fontSize: 13, fontWeight: 700, color: "#0d0d0d" }}
        >
          Open PDF in a new tab
        </a>
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={label}
      style={{ width: "100%", maxHeight: 300, objectFit: "contain", display: "block", background: "#f5ead8", cursor: "zoom-in" }}
      onClick={() => window.open(url, "_blank")}
    />
  );
}

function VehiclePhotoGrid({ urls }: { urls: string[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8, marginTop: 12 }}>
      {urls.map((url, i) => (
        <div key={i} style={{ border: "2px solid #E8DDD3", borderRadius: 8, overflow: "hidden" }}>
          <img
            src={url}
            alt={`Vehicle photo ${i + 1}`}
            style={{ width: "100%", height: 120, objectFit: "cover", display: "block", cursor: "pointer" }}
            onClick={() => window.open(url, "_blank")}
          />
        </div>
      ))}
    </div>
  );
}

async function errorText(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => null);
  return (body && typeof body.error === "string" && body.error) || fallback;
}

export default function DriverReviewPage() {
  const params = useParams();
  const router = useRouter();
  const driverId = params.driverId as string;

  const [driver, setDriver] = useState<DriverDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});
  const [showRejectInput, setShowRejectInput] = useState<string | null>(null);
  const [finalLoading, setFinalLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.push("/admin/login");
      return;
    }
    fetchDriver();
  }, [driverId]);

  async function fetchDriver() {
    setLoading(true);
    try {
      const res = await adminFetch(`/admin/drivers/${driverId}`);
      if (res.ok) {
        setDriver(await res.json());
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function handleFieldApprove(field: string) {
    setActionLoading(field);
    try {
      const res = await adminFetch(`/admin/drivers/${driverId}/field-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field, status: "approved" }),
      });
      setActionError(res.ok ? null : await errorText(res, "Could not save that decision."));
      if (res.ok) {
        const data = await res.json();
        setDriver((prev) =>
          prev
            ? {
                ...prev,
                submission: {
                  ...prev.submission,
                  fieldStatuses: data.fieldStatuses,
                },
              }
            : prev
        );
      }
    } finally {
      setActionLoading(null);
    }
  }

  async function handleFieldReject(field: string) {
    const reason = rejectReasons[field]?.trim();
    if (!reason) return;
    setActionLoading(field);
    try {
      const res = await adminFetch(`/admin/drivers/${driverId}/field-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field, status: "rejected", reason }),
      });
      setActionError(res.ok ? null : await errorText(res, "Could not save that decision."));
      if (res.ok) {
        const data = await res.json();
        setDriver((prev) =>
          prev
            ? {
                ...prev,
                submission: {
                  ...prev.submission,
                  fieldStatuses: data.fieldStatuses,
                },
              }
            : prev
        );
        setShowRejectInput(null);
        setRejectReasons((prev) => ({ ...prev, [field]: "" }));
      }
    } finally {
      setActionLoading(null);
    }
  }

  async function handleFinalApprove() {
    setFinalLoading(true);
    try {
      const res = await adminFetch(`/admin/drivers/${driverId}/approve`, {
        method: "POST",
      });
      // Only leave when it worked: a failed approval used to look like a success.
      if (!res.ok) {
        setActionError(await errorText(res, "Could not approve this driver."));
        return;
      }
      router.push("/admin/dashboard/drivers");
    } finally {
      setFinalLoading(false);
    }
  }

  async function handleFinalReject() {
    if (!driver) return;
    setFinalLoading(true);
    const fs = driver.submission.fieldStatuses;
    const rejectedFields = Object.entries(fs)
      .filter(([, v]) => v.status === "rejected")
      .map(([k]) => k);
    // The server writes the driver's message from each item's reason; this is its fallback.
    const reasons = Object.entries(fs)
      .filter(([, v]) => v.status === "rejected" && v.reason)
      .map(([k, v]) => `${kycFieldLabel(k)}: ${v.reason}`)
      .join(". ");

    try {
      const res = await adminFetch(`/admin/drivers/${driverId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: reasons || "Documents did not pass review",
          rejectedFields,
        }),
      });
      if (!res.ok) {
        setActionError(await errorText(res, "Could not send this back to the driver."));
        return;
      }
      router.push("/admin/dashboard/drivers");
    } finally {
      setFinalLoading(false);
    }
  }

  if (loading) return <div className="admin-loading">Loading driver...</div>;
  if (!driver) return <div className="admin-empty">Driver not found.</div>;

  const sub = driver.submission;
  const fs = sub.fieldStatuses || {};
  const resubmitted = sub.resubmittedFields ?? [];
  const licenceIsPdf = sub.licenceFileType === "application/pdf";

  // Check review progress
  const allFieldsReviewed = REVIEW_FIELDS.every((f) => fs[f.key]);
  const hasRejections = Object.values(fs).some((v) => v.status === "rejected");
  const allApproved = allFieldsReviewed && !hasRejections;

  function getFieldBadge(field: string) {
    const s = fs[field];
    if (!s) {
      return resubmitted.includes(field) ? <span className="admin-badge blue">Resubmitted</span> : null;
    }
    if (s.status === "approved") {
      // Kept from the last review: the driver only resent the other items.
      const before = resubmitted.length > 0 && !resubmitted.includes(field);
      return <span className="admin-badge green">{before ? "Approved before" : "Approved"}</span>;
    }
    return <span className="admin-badge red">Rejected</span>;
  }

  function getImageUrl(field: typeof REVIEW_FIELDS[number]): string | null {
    if (!field.imageKey) return null;
    return (sub as Record<string, unknown>)[field.imageKey] as string | null;
  }

  return (
    <div>
      <button
        onClick={() => router.push("/admin/dashboard/drivers")}
        className="admin-back-btn"
      >
        ← Back to drivers
      </button>

      <div className="admin-page-header">
        <h1>Driver Review</h1>
        <p>
          {driver.name || "Unknown"} —{" "}
          {driver.phone || driver.email || "No contact"}
        </p>
      </div>

      {/* Driver info summary */}
      <div className="admin-info-card">
        <div className="admin-info-row">
          <span className="admin-info-label">Name</span>
          <span>{driver.name || "—"}</span>
        </div>
        <div className="admin-info-row">
          <span className="admin-info-label">Phone</span>
          <span>{driver.phone || "—"}</span>
        </div>
        <div className="admin-info-row">
          <span className="admin-info-label">Email</span>
          <span>{driver.email || "—"}</span>
        </div>
        <div className="admin-info-row">
          <span className="admin-info-label">Vehicle</span>
          <span>
            {sub.vehicleMake} {sub.vehicleModel}{" "}
            {sub.vehicleYear ? `(${sub.vehicleYear})` : ""}{" "}
            {sub.vehiclePlate ? `— ${sub.vehiclePlate}` : ""}
          </span>
        </div>
        <div className="admin-info-row">
          <span className="admin-info-label">Overall Status</span>
          <span
            className={`admin-badge ${
              sub.status === "SUBMITTED"
                ? "orange"
                : sub.status === "APPROVED"
                ? "green"
                : sub.status === "REJECTED"
                ? "red"
                : "gray"
            }`}
          >
            {sub.status}
          </span>
        </div>
      </div>

      {actionError && (
        <div className="admin-info-card" style={{ borderColor: "#FF3333", background: "#FFF0F0", color: "#B00020", marginBottom: 16 }}>
          {actionError}
        </div>
      )}

      {sub.status === "SUBMITTED" && resubmitted.length > 0 && (
        <div className="admin-info-card" style={{ borderColor: "#3366FF", background: "#F3F7FF", marginBottom: 16 }}>
          <strong>Resubmitted after a fix:</strong> {resubmitted.map(kycFieldLabel).join(", ")}.
          {sub.previousRejectionReason && (
            <div style={{ marginTop: 6, fontSize: 13, color: "#786F68" }}>
              Last time: {sub.previousRejectionReason}
            </div>
          )}
          <div style={{ marginTop: 6, fontSize: 13, color: "#786F68" }}>
            Everything else was approved before; only the resent items need a decision.
          </div>
        </div>
      )}

      {/* Quick overall actions */}
      {sub.status === "SUBMITTED" && (
        <>
          <div
            style={{
              display: "flex",
              gap: 12,
              marginBottom: 24,
            }}
          >
            <button
              onClick={handleFinalApprove}
              disabled={finalLoading}
              className="admin-btn-approve"
            >
              {finalLoading ? "Processing..." : "Approve All"}
            </button>
            <button
              onClick={() => {
                // Scroll to field review section so they can pick what to reject
                document
                  .getElementById("field-review-section")
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
              className="admin-btn-reject"
            >
              Reject Specific Fields
            </button>
          </div>

          <div id="field-review-section" className="admin-page-header" style={{ marginTop: 8 }}>
            <h1 style={{ fontSize: 18 }}>Review Documents</h1>
            <p>Or review each document individually below</p>
          </div>

          {REVIEW_FIELDS.map((field) => {
            const imageUrl = getImageUrl(field);
            const reviewed = !!fs[field.key];
            const isRejected =
              fs[field.key]?.status === "rejected";

            return (
              <div
                key={field.key}
                className="admin-info-card"
                style={{
                  marginBottom: 16,
                  borderColor: reviewed
                    ? isRejected
                      ? "#FF3333"
                      : "#00C48C"
                    : undefined,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 12,
                  }}
                >
                  <h3
                    style={{
                      margin: 0,
                      fontSize: 15,
                      fontWeight: 700,
                    }}
                  >
                    {field.label}
                  </h3>
                  {getFieldBadge(field.key)}
                </div>

                {/* Show image if it's a document field */}
                {imageUrl && (
                  <div
                    style={{
                      border: "2px solid #E8DDD3",
                      borderRadius: 10,
                      overflow: "hidden",
                      marginBottom: 12,
                    }}
                  >
                    <DocumentView url={imageUrl} label={field.label} isPdf={field.key === "licence" && licenceIsPdf} />
                  </div>
                )}

                {/* Vehicle info display */}
                {field.key === "vehicle" && (
                  <div
                    style={{
                      padding: "12px 0",
                      fontSize: 14,
                      color: "#0d0d0d",
                    }}
                  >
                    <div>
                      <strong>Make:</strong> {sub.vehicleMake || "—"}
                    </div>
                    <div>
                      <strong>Model:</strong> {sub.vehicleModel || "—"}
                    </div>
                    <div>
                      <strong>Year:</strong> {sub.vehicleYear || "—"}
                    </div>
                    <div>
                      <strong>Plate:</strong> {sub.vehiclePlate || "—"}
                    </div>
                  </div>
                )}

                {field.key === "vehiclePhotos" && (
                  sub.vehicleImageUrls?.length > 0
                    ? <VehiclePhotoGrid urls={sub.vehicleImageUrls} />
                    : <p style={{ fontSize: 13, color: "#786F68" }}>No photos.</p>
                )}

                {/* Show rejection reason if rejected */}
                {isRejected && fs[field.key]?.reason && (
                  <div
                    style={{
                      background: "#FFF0F0",
                      border: "1px solid #FF3333",
                      borderRadius: 8,
                      padding: "8px 12px",
                      fontSize: 13,
                      color: "#FF3333",
                      marginBottom: 12,
                    }}
                  >
                    Reason: {fs[field.key].reason}
                  </div>
                )}

                {/* Action buttons if not yet reviewed */}
                {!reviewed && (
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button
                      onClick={() => handleFieldApprove(field.key)}
                      disabled={actionLoading === field.key}
                      className="admin-btn-approve"
                      style={{ height: 40, fontSize: 13, padding: "0 20px" }}
                    >
                      {actionLoading === field.key
                        ? "..."
                        : `Approve ${field.label}`}
                    </button>
                    {showRejectInput !== field.key ? (
                      <button
                        onClick={() => setShowRejectInput(field.key)}
                        className="admin-btn-reject"
                        style={{ height: 40, fontSize: 13, padding: "0 20px" }}
                      >
                        Reject
                      </button>
                    ) : (
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          flex: 1,
                          minWidth: 200,
                          alignItems: "center",
                          flexWrap: "wrap",
                        }}
                      >
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", width: "100%" }}>
                          {(QUICK_REASONS[field.key] ?? []).map((reason) => (
                            <button
                              key={reason}
                              type="button"
                              onClick={() => setRejectReasons((prev) => ({ ...prev, [field.key]: reason }))}
                              style={{
                                height: 30, padding: "0 10px", borderRadius: 999, fontSize: 12, cursor: "pointer",
                                border: rejectReasons[field.key] === reason ? "2px solid #FF3333" : "1px solid #E8DDD3",
                                background: rejectReasons[field.key] === reason ? "#FFF0F0" : "#fff",
                              }}
                            >
                              {reason}
                            </button>
                          ))}
                        </div>
                        <input
                          type="text"
                          placeholder="Reason the driver will read, e.g. photo is blurry"
                          value={rejectReasons[field.key] || ""}
                          onChange={(e) =>
                            setRejectReasons((prev) => ({
                              ...prev,
                              [field.key]: e.target.value,
                            }))
                          }
                          style={{
                            flex: 1,
                            height: 40,
                            border: "2px solid #FF3333",
                            borderRadius: 8,
                            padding: "0 12px",
                            fontSize: 13,
                          }}
                        />
                        <button
                          onClick={() => handleFieldReject(field.key)}
                          disabled={
                            actionLoading === field.key ||
                            !rejectReasons[field.key]?.trim()
                          }
                          className="admin-btn-confirm-reject"
                          style={{
                            height: 40,
                            fontSize: 13,
                            padding: "0 16px",
                          }}
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Allow re-review */}
                {reviewed && (
                  <button
                    onClick={() => {
                      // Clear field status to re-review
                      setDriver((prev) => {
                        if (!prev) return prev;
                        const newFs = { ...prev.submission.fieldStatuses };
                        delete newFs[field.key];
                        return {
                          ...prev,
                          submission: {
                            ...prev.submission,
                            fieldStatuses: newFs,
                          },
                        };
                      });
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#786F68",
                      fontSize: 12,
                      cursor: "pointer",
                      marginTop: 8,
                      textDecoration: "underline",
                    }}
                  >
                    Change decision
                  </button>
                )}
              </div>
            );
          })}

          {/* Final actions — only show when all fields reviewed */}
          {allFieldsReviewed && (
            <div
              className="admin-info-card"
              style={{
                marginTop: 24,
                borderColor: allApproved ? "#00C48C" : "#FF3333",
                background: allApproved ? "#F0FFF9" : "#FFF8F8",
              }}
            >
              <h3 style={{ margin: "0 0 8px", fontSize: 16 }}>
                {allApproved
                  ? "All documents approved — ready to approve driver"
                  : "Some documents were rejected"}
              </h3>
              <p style={{ margin: "0 0 16px", fontSize: 13, color: "#786F68" }}>
                {allApproved
                  ? "Click below to approve this driver and let them start accepting rides."
                  : "Click below to reject this submission. The driver will be asked to re-upload the rejected documents."}
              </p>

              {allApproved ? (
                <button
                  onClick={handleFinalApprove}
                  disabled={finalLoading}
                  className="admin-btn-approve"
                >
                  {finalLoading ? "Approving..." : "Approve Driver"}
                </button>
              ) : (
                <button
                  onClick={handleFinalReject}
                  disabled={finalLoading}
                  className="admin-btn-confirm-reject"
                  style={{ boxShadow: "4px 4px 0 #0d0d0d" }}
                >
                  {finalLoading ? "Rejecting..." : "Reject & Notify Driver"}
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* Already reviewed — show documents read-only */}
      {sub.status !== "SUBMITTED" && (
        <>
          <div className="admin-page-header" style={{ marginTop: 8 }}>
            <h1 style={{ fontSize: 18 }}>Documents</h1>
          </div>
          <div className="admin-docs-grid">
            {sub.ninImageUrl && (
              <div className="admin-doc-card">
                <p className="admin-doc-label">NIN Card</p>
                <img
                  src={sub.ninImageUrl}
                  alt="NIN"
                  className="admin-doc-img"
                />
              </div>
            )}
            {sub.licenceImageUrl && (
              <div className="admin-doc-card">
                <p className="admin-doc-label">Driver&apos;s Licence</p>
                {licenceIsPdf ? (
                  <DocumentView url={sub.licenceImageUrl} label="Licence" isPdf />
                ) : (
                  <img
                    src={sub.licenceImageUrl}
                    alt="Licence"
                    className="admin-doc-img"
                  />
                )}
              </div>
            )}
            {sub.selfieUrl && (
              <div className="admin-doc-card">
                <p className="admin-doc-label">Selfie</p>
                <img
                  src={sub.selfieUrl}
                  alt="Selfie"
                  className="admin-doc-img"
                />
              </div>
            )}
          </div>
          {sub.vehicleImageUrls?.length > 0 && (
            <div className="admin-info-card">
              <p className="admin-doc-label">Vehicle photos</p>
              <VehiclePhotoGrid urls={sub.vehicleImageUrls} />
            </div>
          )}
          {sub.status === "REJECTED" && sub.rejectedFields?.length > 0 && (
            <div className="admin-info-card" style={{ borderColor: "#FF3333" }}>
              <div className="admin-info-row" style={{ borderBottom: "none" }}>
                <span className="admin-info-label">Sent back to fix</span>
                <span>{sub.rejectedFields.map(kycFieldLabel).join(", ")}</span>
              </div>
            </div>
          )}
          {sub.rejectionReason && (
            <div
              className="admin-info-card"
              style={{ borderColor: "#FF3333" }}
            >
              <div className="admin-info-row" style={{ borderBottom: "none" }}>
                <span className="admin-info-label">Rejection Reason</span>
                <span style={{ color: "#FF3333" }}>{sub.rejectionReason}</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
