"use client";

import { DocPeek } from "@/components/admin/doc-peek";
import { useState } from "react";

import { useAdminData } from "@/components/admin/use-admin-data";
import { adminFetch } from "@/lib/admin-api";

/**
 * A driver's papers on their review page: the name and licence details they
 * typed, and each paper for the car with a link to open it, its expiry date
 * and where it stands. Each paper is marked Approve or Send back (with a
 * reason: it is what the driver is told), then one Send decision saves them
 * all and the driver gets ONE message listing what to send again.
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

const QUICK = [
  "The photo is blurry.",
  "Part of it is cut off.",
  "This is the wrong paper.",
  "The name does not match the driver.",
  "The date on it has passed.",
  "It is for another car.",
  "Not found on NIID.",
  "Not found on DVIS.",
  "Not found on AutoReg.",
];

type Choice = { decision: "approve" | "reject"; reason: string };

const dayWords = (iso: string | null) =>
  iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "—";
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Lagos" });

export function DriverPapersPanel({ driverId }: { driverId: string }) {
  // A server without papers answers 404: `data` stays empty and nothing is shown.
  const { data: papers, refresh } = useAdminData<DriverPapers>(`/admin/drivers/${driverId}/papers`, [driverId]);
  const [busy, setBusy] = useState(false);
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  // Tapping the chosen answer again takes it back.
  const choose = (type: string, decision: Choice["decision"]) => {
    setDone(null);
    setChoices((all) => {
      const next = { ...all };
      if (next[type]?.decision === decision) delete next[type];
      else next[type] = { decision, reason: next[type]?.reason ?? "" };
      return next;
    });
  };
  const setReason = (type: string, reason: string) =>
    setChoices((all) => (all[type] ? { ...all, [type]: { ...all[type]!, reason } } : all));

  const sendDecision = async () => {
    const decisions = Object.entries(choices).map(([type, c]) => ({ type, decision: c.decision, ...(c.decision === "reject" ? { reason: c.reason.trim() } : {}) }));
    if (!decisions.length) return;
    setBusy(true); setError(null); setDone(null);
    try {
      const res = await adminFetch(`/admin/drivers/${driverId}/papers/decide`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decisions }),
      });
      const body = (await res.json().catch(() => null)) as { error?: string; errors?: Array<{ error: string }>; approved?: string[]; sentBack?: string[] } | null;
      if (!res.ok) {
        setError(body?.errors?.length ? body.errors.map((e) => e.error).join(" ") : body?.error ?? "Could not save that.");
        return;
      }
      const a = body?.approved?.length ?? 0;
      const r = body?.sentBack?.length ?? 0;
      setDone(`Saved: ${a} approved, ${r} sent back. The driver got one message.`);
      setChoices({});
      refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  };

  if (!papers) return null;
  const sent = papers.needs.flatMap((n) => n.papers).filter((p) => p.document);
  const waiting = sent.filter((p) => p.document!.state === "waiting");
  const staged = Object.values(choices);
  const toApprove = staged.filter((c) => c.decision === "approve").length;
  const toSendBack = staged.filter((c) => c.decision === "reject").length;
  const reasonsMissing = staged.some((c) => c.decision === "reject" && c.reason.trim().length < 4);

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
        {waiting.length > 1 ? (
          <button
            type="button"
            className="admin-btn-ghost"
            onClick={() => { setDone(null); setChoices((all) => ({ ...all, ...Object.fromEntries(waiting.map((p) => [p.type, { decision: "approve" as const, reason: "" }])) })); }}>
            Mark all {waiting.length} waiting to approve
          </button>
        ) : null}
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
      {done ? (
        <div className="admin-info-card" style={{ borderColor: "#0B7A55", background: "#E3F8F0", color: "#0B7A55", fontWeight: 600 }}>{done}</div>
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
            const choice = choices[paper.type];
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
                  <>
                    <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {doc.status !== "APPROVED" ? (
                        <button
                          type="button"
                          className="admin-btn-approve"
                          aria-pressed={choice?.decision === "approve"}
                          style={choice?.decision === "approve" ? { outline: "3px solid #0d0d0d", outlineOffset: 2 } : choice ? { opacity: 0.45 } : undefined}
                          onClick={() => choose(paper.type, "approve")}>
                          {choice?.decision === "approve" ? "✓ Approve" : "Approve"}
                        </button>
                      ) : null}
                      {doc.status !== "REJECTED" ? (
                        <button
                          type="button"
                          className="admin-btn-reject"
                          aria-pressed={choice?.decision === "reject"}
                          style={choice?.decision === "reject" ? { outline: "3px solid #0d0d0d", outlineOffset: 2 } : choice ? { opacity: 0.45 } : undefined}
                          onClick={() => choose(paper.type, "reject")}>
                          {choice?.decision === "reject" ? "✓ Send back" : "Send back"}
                        </button>
                      ) : null}
                    </div>
                    {choice?.decision === "reject" ? (
                      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {QUICK.map((q) => (
                            <button key={q} type="button" className="admin-btn-ghost" style={{ fontSize: 12 }} onClick={() => setReason(paper.type, q)}>{q}</button>
                          ))}
                        </div>
                        <input
                          value={choice.reason}
                          onChange={(e) => setReason(paper.type, e.target.value)}
                          placeholder="Why is it being sent back? The driver is told this."
                          aria-label={`Why ${paper.label} is being sent back`}
                          maxLength={300}
                          style={{ height: 40, borderRadius: 10, border: `1px solid ${choice.reason.trim().length < 4 ? "#FF9A9A" : "#E8DDD3"}`, padding: "0 12px", fontSize: 14 }}
                        />
                      </div>
                    ) : null}
                  </>
                ) : (
                  <p style={{ margin: "8px 0 0", fontSize: 13, color: "#786F68" }}>Expired: the driver has to send the renewed one.</p>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {sent.length === 0 ? null : (
        <p style={{ fontSize: 12.5, color: "#786F68" }}>Mark each paper, then Send decision: the driver gets one notification listing what to send again.</p>
      )}

      {staged.length ? (
        <div
          role="region"
          aria-label="Your decision"
          style={{ position: "sticky", bottom: 12, zIndex: 5, background: "#0d0d0d", color: "#fff", borderRadius: 14, padding: "12px 14px", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", boxShadow: "0 6px 24px rgba(0,0,0,0.18)" }}>
          <span style={{ flex: "1 1 220px", fontSize: 14 }}>
            {toApprove ? `${toApprove} to approve` : ""}
            {toApprove && toSendBack ? " · " : ""}
            {toSendBack ? `${toSendBack} to send back` : ""}
            {reasonsMissing ? <span style={{ color: "#FFB4B4" }}> · say why for each sent back</span> : <span style={{ color: "#BDB5AE" }}> · one message to the driver</span>}
          </span>
          <button type="button" className="admin-btn-approve" disabled={busy || reasonsMissing} onClick={() => void sendDecision()}>
            {busy ? "Sending…" : "Send decision"}
          </button>
          <button type="button" className="admin-btn-ghost" style={{ color: "#fff" }} disabled={busy} onClick={() => setChoices({})}>Clear</button>
        </div>
      ) : null}
    </>
  );
}
