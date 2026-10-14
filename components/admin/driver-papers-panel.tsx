"use client";

import { DocPeek } from "@/components/admin/doc-peek";
import { useState } from "react";

import { useAdminData } from "@/components/admin/use-admin-data";
import { adminFetch } from "@/lib/admin-api";

/**
 * A driver's papers on their review page: the name and licence details they
 * typed, and each paper for the car with a link to open it, its expiry date
 * and where it stands. A paper waiting to be checked is approved or sent back
 * here; sending back needs a reason, because that is what the driver is told.
 *
 * It loads on its own, so a server that does not have papers yet simply
 * shows nothing here and the rest of the page is untouched.
 */

type State = "missing" | "waiting" | "approved" | "rejected" | "expired";

interface PaperDocument {
  state: State;
  status: "PENDING" | "APPROVED" | "REJECTED";
  number: string | null;
  expiresOn: string | null;
  uploadedAt: string;
  rejectionReason: string | null;
  expiringSoon: boolean;
  daysLeft: number | null;
  fileType: string;
  url: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
}
interface Paper { type: string; label: string; hint: string; expires: boolean; numbered: boolean; document: PaperDocument | null }
interface Need { key: string; label: string; required: boolean; state: State; papers: Paper[] }
interface DriverPapers {
  details: { legalName: string | null; licenceNumber: string | null; licenceExpiresOn: string | null; licenceExpired: boolean; complete: boolean };
  toDo: number;
  requiredFrom: string | null;
  blocked: boolean;
  needs: Need[];
}

const STATE: Record<State, { word: string; color: string; bg: string }> = {
  missing: { word: "Not sent", color: "#786F68", bg: "#F3EEE6" },
  waiting: { word: "To check", color: "#B04A00", bg: "#FFE9D5" },
  approved: { word: "Approved", color: "#0B7A55", bg: "#E3F8F0" },
  rejected: { word: "Sent back", color: "#B00020", bg: "#FFF0F0" },
  expired: { word: "Expired", color: "#B00020", bg: "#FFF0F0" },
};

const QUICK = ["The photo is blurry.", "Part of it is cut off.", "This is the wrong paper.", "The name does not match the driver.", "The date on it has passed."];

const dayWords = (iso: string | null) =>
  iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "—";
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Lagos" });

export function DriverPapersPanel({ driverId }: { driverId: string }) {
  // A server without papers answers 404: `data` stays empty and nothing is shown.
  const { data: papers, refresh } = useAdminData<DriverPapers>(`/admin/drivers/${driverId}/papers`, [driverId]);
  const [busy, setBusy] = useState<string | null>(null);
  const [sendingBack, setSendingBack] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const review = async (type: string, decision: "approve" | "reject") => {
    setBusy(type); setError(null);
    try {
      const res = await adminFetch(`/admin/drivers/${driverId}/papers/${encodeURIComponent(type)}/review`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision, ...(decision === "reject" ? { reason: reason.trim() } : {}) }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "Could not save that.");
        return;
      }
      setSendingBack(null); setReason("");
      refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(null);
    }
  };

  if (!papers) return null;
  const sent = papers.needs.flatMap((n) => n.papers).filter((p) => p.document);

  return (
    <>
      <div id="driver-papers" className="admin-page-header" style={{ marginTop: 24 }}>
        <div>
          <h2 style={{ margin: 0 }}>Papers</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#786F68" }}>
            {papers.toDo === 0 ? "Everything asked for has been sent." : `${papers.toDo} still to send.`}
            {papers.blocked ? " This driver cannot go online until they are in." : papers.requiredFrom ? ` Needed to go online from ${dayWords(papers.requiredFrom)}.` : ""}
          </p>
        </div>
      </div>

      <div className="admin-info-card">
        <div className="admin-info-row">
          <span className="admin-info-label">Name on licence</span>
          <span>{papers.details.legalName ?? "Not entered"}</span>
        </div>
        <div className="admin-info-row">
          <span className="admin-info-label">Licence number</span>
          <span>{papers.details.licenceNumber ?? "Not entered"}</span>
        </div>
        <div className="admin-info-row" style={{ borderBottom: "none" }}>
          <span className="admin-info-label">Licence expires</span>
          <span style={papers.details.licenceExpired ? { color: "#B00020", fontWeight: 700 } : undefined}>
            {papers.details.licenceExpiresOn ? `${dayWords(papers.details.licenceExpiresOn)}${papers.details.licenceExpired ? " (expired)" : ""}` : "Not entered"}
          </span>
        </div>
      </div>

      {error ? (
        <div className="admin-info-card" style={{ borderColor: "#FF3333", background: "#FFF0F0", color: "#B00020" }}>{error}</div>
      ) : null}

      {papers.needs.map((need) => (
        <div key={need.key} className="admin-info-card">
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
            <strong>{need.label}</strong>
            <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 999, background: STATE[need.state].bg, color: STATE[need.state].color, fontWeight: 700 }}>
              {STATE[need.state].word}
            </span>
            {!need.required ? <span style={{ fontSize: 12, color: "#786F68" }}>Optional</span> : null}
            {need.papers.length > 1 ? <span style={{ fontSize: 12, color: "#786F68" }}>Any one of {need.papers.length} will do</span> : null}
          </div>

          {need.papers.filter((p) => p.document).length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: "#786F68" }}>Nothing sent.</p>
          ) : null}

          {need.papers.filter((p) => p.document).map((paper) => {
            const doc = paper.document!;
            const look = STATE[doc.state];
            const canReview = doc.state !== "expired";
            return (
              <div key={paper.type} style={{ borderTop: "1px solid #E8DDD3", paddingTop: 10, marginTop: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
                  <div>
                    {need.papers.length > 1 ? <strong style={{ fontSize: 14 }}>{paper.label} · </strong> : null}
                    <span style={{ color: look.color, fontWeight: 700, fontSize: 14 }}>{look.word}</span>
                    <span style={{ fontSize: 13, color: "#786F68" }}> · sent {when(doc.uploadedAt)}</span>
                  </div>
                  {doc.url ? (
                    <DocPeek url={doc.url} isPdf={doc.fileType === "application/pdf"} label={paper.label}>
                      <a href={doc.url} target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 700, color: "#0d0d0d" }}>
                        Open {doc.fileType === "application/pdf" ? "PDF" : "photo"} in a new tab
                      </a>
                    </DocPeek>
                  ) : <span style={{ fontSize: 13, color: "#786F68" }}>File storage is off</span>}
                </div>

                <div style={{ fontSize: 13, marginTop: 4, display: "flex", gap: 16, flexWrap: "wrap" }}>
                  {paper.expires ? (
                    <span style={doc.state === "expired" || doc.expiringSoon ? { color: "#B00020", fontWeight: 700 } : undefined}>
                      Expires {dayWords(doc.expiresOn)}
                      {doc.state === "expired" ? " (expired)" : doc.expiringSoon && doc.daysLeft !== null ? ` (in ${doc.daysLeft} days)` : ""}
                    </span>
                  ) : null}
                  {doc.number ? <span>Number: {doc.number}</span> : null}
                  {doc.reviewedBy && doc.reviewedAt ? <span style={{ color: "#786F68" }}>{doc.status === "APPROVED" ? "Approved" : "Sent back"} by {doc.reviewedBy}, {when(doc.reviewedAt)}</span> : null}
                </div>
                {doc.status === "REJECTED" && doc.rejectionReason ? (
                  <div style={{ fontSize: 13, color: "#B00020", marginTop: 4 }}>Told the driver: {doc.rejectionReason}</div>
                ) : null}

                {doc.url && doc.fileType !== "application/pdf" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={doc.url}
                    alt={paper.label}
                    style={{ width: "100%", maxHeight: 260, objectFit: "contain", display: "block", background: "#f5ead8", cursor: "zoom-in", marginTop: 8 }}
                    onClick={() => window.open(doc.url!, "_blank")}
                  />
                ) : null}

                {canReview ? (
                  sendingBack === paper.type ? (
                    <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {QUICK.map((q) => (
                          <button key={q} type="button" className="admin-btn-ghost" style={{ fontSize: 12 }} onClick={() => setReason(q)}>{q}</button>
                        ))}
                      </div>
                      <input
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Why is it being sent back? The driver is told this."
                        aria-label={`Why ${paper.label} is being sent back`}
                        maxLength={300}
                        style={{ height: 40, borderRadius: 10, border: "1px solid #E8DDD3", padding: "0 12px", fontSize: 14 }}
                      />
                      <div style={{ display: "flex", gap: 8 }}>
                        <button type="button" className="admin-btn-confirm-reject" disabled={busy === paper.type || reason.trim().length < 4} onClick={() => void review(paper.type, "reject")}>
                          {busy === paper.type ? "Sending…" : "Send back"}
                        </button>
                        <button type="button" className="admin-btn-ghost" onClick={() => { setSendingBack(null); setReason(""); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {doc.status !== "APPROVED" ? (
                        <button type="button" className="admin-btn-approve" disabled={busy === paper.type} onClick={() => void review(paper.type, "approve")}>
                          {busy === paper.type ? "Saving…" : "Approve"}
                        </button>
                      ) : null}
                      {doc.status !== "REJECTED" ? (
                        <button type="button" className="admin-btn-reject" disabled={busy === paper.type} onClick={() => { setSendingBack(paper.type); setReason(""); setError(null); }}>
                          Send back
                        </button>
                      ) : null}
                    </div>
                  )
                ) : (
                  <p style={{ margin: "8px 0 0", fontSize: 13, color: "#786F68" }}>Expired: the driver has to send the renewed one.</p>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {sent.length === 0 ? null : (
        <p style={{ fontSize: 12.5, color: "#786F68" }}>The driver gets a notification for each paper approved or sent back.</p>
      )}
    </>
  );
}
