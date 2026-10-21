"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { DocPeek } from "@/components/admin/doc-peek";

import { useAdminData } from "@/components/admin/use-admin-data";
import { adminFetch } from "@/lib/admin-api";

/**
 * Checking a driver's licence and car, on their review page.
 *
 *   Prembly      the licence (FRSC), the plate and the insurance policy (NIID),
 *                each set against what the driver gave us; what does not agree
 *                shows in red. Each check costs money: only owners run one, and
 *                the same check on the same number within 30 days shows the
 *                saved answer. While one runs, the card says so and a bar sweeps.
 *   By hand      what Prembly does not cover (the hackney permit on AutoReg,
 *                roadworthiness on DVIS, the owner's letter): each paper the
 *                driver sent, with its photo, number and dates, the site to
 *                check it on, and Good or Failed.
 *
 * Each check shows the paper it is set against beside it (the licence photo
 * to read the date of birth from, the insurance certificate), so nothing is
 * looked up elsewhere on the page. The licence photo is read by AI as the
 * page opens: the date of birth (and an empty number or name) is filled in,
 * and where the photo disagrees with what the driver typed is said, to be
 * looked at against the photo before a paid check.
 *
 * A check never approves or sends back a paper: that is decided in Papers below.
 */

type Outcome = "verified" | "mismatch" | "not_found" | "failed" | "error";
interface Check {
  id: string;
  kind: string;
  paperType: string | null;
  paperLabel: string | null;
  source: string;
  input: string | null;
  outcome: Outcome;
  mismatches: string[];
  found: Record<string, string | number | boolean | null> | null;
  reference: string | null;
  note: string | null;
  by: string;
  at: string;
}
interface ManualSource { key: string; label: string; url: string | null; papers: string[] }
interface SentPaper {
  type: string;
  label: string;
  number: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  uploadedAt: string;
  expiresOn: string | null;
  daysLeft: number | null;
  isPdf: boolean;
  url: string | null;
}
interface ChecksView {
  prembly: { on: boolean; canRun: boolean; thisMonth: number; reuseDays: number };
  inputs: {
    legalName: string | null;
    accountName: string | null;
    licenceNumber: string | null;
    licenceExpiresOn: string | null;
    plate: string | null;
    vehicle: string | null;
    insuranceNumber: string | null;
    insuranceExpiresOn: string | null;
    hasSelfie: boolean;
  };
  manualSources: ManualSource[];
  /** Older servers send none. */
  documents?: { licence: { url: string; isPdf: boolean } | null; selfieUrl: string | null; papers: SentPaper[] };
  checks: Check[];
}
type PaidKind = "licence" | "plate" | "insurance";
interface LicenceReading {
  readable: boolean;
  licenceNumber: string | null;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  dateOfBirth: string | null;
  issuedOn: string | null;
  expiresOn: string | null;
  note: string | null;
}
type ReadState =
  | { state: "idle" }
  | { state: "reading" }
  | { state: "done"; reading: LicenceReading; differs: string[] }
  | { state: "failed"; error: string };

const OUTCOME: Record<Outcome, { word: string; color: string; bg: string }> = {
  verified: { word: "Matches", color: "#0B7A55", bg: "#E3F8F0" },
  mismatch: { word: "Found, but differs", color: "#B04A00", bg: "#FFE9D5" },
  not_found: { word: "Not found", color: "#B00020", bg: "#FFF0F0" },
  failed: { word: "Failed", color: "#B00020", bg: "#FFF0F0" },
  error: { word: "Could not check", color: "#786F68", bg: "#F3EEE6" },
};

const KIND_LABEL: Record<string, string> = {
  licence: "Driver's licence",
  licenceFace: "Driver's licence + selfie",
  plate: "Plate number",
  insurance: "Insurance",
  manual: "By hand",
};

const SOURCE_LABEL: Record<string, string> = { prembly: "Prembly", autoreg: "AutoReg", dvis: "DVIS", niid: "NIID", other: "Other" };

const STATUS_WORD: Record<SentPaper["status"], { word: string; color: string }> = {
  PENDING: { word: "To check", color: "#B04A00" },
  APPROVED: { word: "Approved", color: "#0B7A55" },
  REJECTED: { word: "Sent back", color: "#B00020" },
};

const FOUND_LABEL: Record<string, string> = {
  name: "Name",
  licenceNumber: "Licence no.",
  gender: "Gender",
  stateOfIssue: "Issued in",
  issuedOn: "Issued",
  expiresOn: "Expires",
  faceMatch: "Selfie matches",
  faceConfidence: "Face confidence",
  plate: "Plate",
  newPlate: "New plate",
  make: "Make",
  model: "Model",
  colour: "Colour",
  policyNumber: "Policy no.",
  status: "Status",
  cover: "Cover",
  vehicleType: "Vehicle type",
  chassis: "Chassis",
};

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Lagos" });

const dayWords = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

const inputStyle = { height: 38, borderRadius: 10, border: "1px solid #E8DDD3", padding: "0 10px", fontSize: 14, minWidth: 0 } as const;

function OutcomeBadge({ outcome }: { outcome: Outcome }) {
  const look = OUTCOME[outcome] ?? OUTCOME.error;
  return (
    <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 999, background: look.bg, color: look.color, fontWeight: 700, whiteSpace: "nowrap" }}>
      {look.word}
    </span>
  );
}

/** A paper's photo or PDF, small: point at it for a large preview, click to open it in a new tab. */
function Thumb({ url, isPdf, label, height = 150 }: { url: string | null; isPdf: boolean; label: string; height?: number }) {
  if (!url) return <div style={{ fontSize: 12.5, color: "#786F68" }}>File storage is off</div>;
  return (
    <DocPeek url={url} isPdf={isPdf} label={label}>
      {isPdf ? (
        <a href={url} target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 700, color: "#0d0d0d" }}>Open {label} (PDF)</a>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={label}
          onClick={() => window.open(url, "_blank")}
          style={{ display: "block", height, maxWidth: "100%", objectFit: "contain", borderRadius: 10, background: "#f5ead8", cursor: "zoom-in" }}
        />
      )}
    </DocPeek>
  );
}

/** A paper's number and dates in one line: expired or running out within 30 days in red. */
function PaperDates({ paper }: { paper: SentPaper }) {
  const soon = paper.daysLeft !== null && paper.daysLeft <= 30;
  return (
    <div style={{ fontSize: 13, display: "flex", gap: 12, flexWrap: "wrap" }}>
      {paper.number ? <span>No. <strong>{paper.number}</strong></span> : null}
      <span style={{ color: "#786F68" }}>Sent {when(paper.uploadedAt)}</span>
      {paper.expiresOn ? (
        <span style={soon ? { color: "#B00020", fontWeight: 700 } : undefined}>
          Expires {dayWords(paper.expiresOn)}
          {paper.daysLeft === null ? "" : paper.daysLeft < 0 ? ` (expired ${-paper.daysLeft} days ago)` : soon ? ` (in ${paper.daysLeft} days)` : ""}
        </span>
      ) : <span style={{ color: "#786F68" }}>Does not expire</span>}
      <span style={{ color: STATUS_WORD[paper.status].color, fontWeight: 700 }}>{STATUS_WORD[paper.status].word}</span>
    </div>
  );
}

/** The check's form beside what it is set against. */
function Beside({ doc, children }: { doc: ReactNode; children: ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start", marginTop: 10 }}>
      <div style={{ flex: "1 1 360px", minWidth: 0 }}>{children}</div>
      {doc ? <div style={{ flex: "0 1 280px", minWidth: 0 }}>{doc}</div> : null}
    </div>
  );
}

function foundValue(key: string, value: string | number | boolean | null): string {
  if (value === null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (key === "faceConfidence" && typeof value === "number") return `${Math.round(value <= 1 ? value * 100 : value)}%`;
  return String(value);
}

function CheckResult({ check }: { check: Check }) {
  const found = check.found ? Object.entries(check.found).filter(([, v]) => v !== null && v !== "") : [];
  return (
    <div style={{ marginTop: 8, padding: 10, borderRadius: 10, background: "#FBF7F1", fontSize: 13 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <OutcomeBadge outcome={check.outcome} />
        <span style={{ color: "#786F68" }}>
          {SOURCE_LABEL[check.source] ?? check.source}
          {check.input ? ` · ${check.input}` : ""} · {check.by}, {when(check.at)}
        </span>
      </div>
      {check.mismatches.length ? (
        <ul style={{ margin: "8px 0 0", paddingLeft: 18, color: "#B00020", fontWeight: 600 }}>
          {check.mismatches.map((m) => <li key={m}>{m}</li>)}
        </ul>
      ) : null}
      {found.length ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "4px 14px", marginTop: 8 }}>
          {found.map(([k, v]) => (
            <div key={k}>
              <span style={{ color: "#786F68" }}>{FOUND_LABEL[k] ?? k}: </span>
              <strong>{foundValue(k, v)}</strong>
            </div>
          ))}
        </div>
      ) : null}
      {check.note ? <div style={{ marginTop: 6, color: check.outcome === "verified" ? "#3D3833" : "#B00020" }}>{check.note}</div> : null}
    </div>
  );
}

export function DriverChecksPanel({ driverId }: { driverId: string }) {
  // A server without checks answers 404: `data` stays empty and nothing is shown.
  const { data, refresh } = useAdminData<ChecksView>(`/admin/drivers/${driverId}/checks`, [driverId]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [reusedKind, setReusedKind] = useState<string | null>(null);

  // What a licence check sends, typed or corrected from the licence photo.
  const [licence, setLicence] = useState<{ number: string; dob: string; firstName: string; lastName: string; withFace: boolean } | null>(null);
  const [plate, setPlate] = useState<string | null>(null);
  const [policy, setPolicy] = useState<string | null>(null);
  // Per paper: the note being typed, and the site it was checked on when not the usual one.
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [sources, setSources] = useState<Record<string, string>>({});
  const [read, setRead] = useState<ReadState>({ state: "idle" });
  const readFor = useRef<string | null>(null);

  // The form as it starts: what the driver typed. A reading fills in only what is still empty.
  const startingForm = (inputs: ChecksView["inputs"]) => {
    const names = (inputs.legalName ?? inputs.accountName ?? "").split(/\s+/).filter(Boolean);
    return { number: inputs.licenceNumber ?? "", dob: "", firstName: names[0] ?? "", lastName: names.length > 1 ? names[names.length - 1]! : "", withFace: false };
  };

  const readLicence = async (again: boolean) => {
    if (!data) return;
    const inputs = data.inputs;
    setRead({ state: "reading" });
    try {
      const res = await adminFetch(`/admin/drivers/${driverId}/checks/read-licence`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(again ? { again: true } : {}),
      });
      const answer = (await res.json().catch(() => null)) as { error?: string; reading?: LicenceReading; differs?: string[] } | null;
      if (!res.ok || !answer?.reading) { setRead({ state: "failed", error: answer?.error ?? "Could not read the licence photo: type it from the photo." }); return; }
      const reading = answer.reading;
      setRead({ state: "done", reading, differs: answer.differs ?? [] });
      setLicence((current) => {
        const form = current ?? startingForm(inputs);
        return {
          ...form,
          dob: form.dob || reading.dateOfBirth || "",
          number: form.number || reading.licenceNumber || "",
          firstName: form.firstName || reading.firstName || "",
          lastName: form.lastName || reading.lastName || "",
        };
      });
    } catch {
      setRead({ state: "failed", error: "Could not reach the server." });
    }
  };

  // Read once when a driver with a licence photo opens.
  const hasLicencePhoto = Boolean(data?.documents?.licence);
  useEffect(() => {
    if (!hasLicencePhoto || readFor.current === driverId) return;
    readFor.current = driverId;
    void readLicence(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasLicencePhoto, driverId]);

  if (!data) return null;
  const { prembly, inputs } = data;
  const lic = licence ?? startingForm(inputs);
  const plateValue = plate ?? inputs.plate ?? "";
  const policyValue = policy ?? inputs.insuranceNumber ?? "";
  const latest = (kinds: string[]) => data.checks.find((c) => kinds.includes(c.kind));
  const canRun = prembly.on && prembly.canRun;

  const runPrembly = async (kind: PaidKind, body: Record<string, unknown>) => {
    setBusy(kind); setError(null); setReusedKind(null);
    try {
      const res = await adminFetch(`/admin/drivers/${driverId}/checks/prembly`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, ...body }),
      });
      const answer = (await res.json().catch(() => null)) as { error?: string; reused?: boolean; photo?: string } | null;
      if (!res.ok) setError(answer?.error ?? "Could not run that check.");
      if (answer?.reused) setReusedKind(kind);
      if (kind === "licence") setPhoto(answer?.photo ?? null);
      refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(null);
    }
  };

  const recordManual = async (paperType: string, source: string, outcome: "verified" | "failed") => {
    const note = (notes[paperType] ?? "").trim();
    if (outcome === "failed" && note.length < 4) {
      setError("Say what was wrong: the next admin reads it.");
      return;
    }
    setBusy(`manual:${paperType}`); setError(null);
    try {
      const res = await adminFetch(`/admin/drivers/${driverId}/checks/manual`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paperType, source, note, outcome }),
      });
      if (!res.ok) {
        const answer = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(answer?.error ?? "Could not save that.");
        return;
      }
      setNotes((all) => ({ ...all, [paperType]: "" }));
      refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(null);
    }
  };

  const copy = (text: string) => { void navigator.clipboard?.writeText(text).catch(() => undefined); };

  /** Where each check asks, for the line shown while it runs. */
  const ASKING: Record<PaidKind, string> = {
    licence: "Asking FRSC through Prembly",
    plate: "Asking the vehicle records through Prembly",
    insurance: "Asking NIID through Prembly",
  };

  const runButton = (kind: PaidKind, body: Record<string, unknown>, ready: boolean) => (
    <>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
        <button type="button" className="admin-btn-approve" disabled={!canRun || !ready || busy !== null} aria-busy={busy === kind} onClick={() => void runPrembly(kind, body)}>
          {busy === kind ? <><span className="admin-spin-sm" aria-hidden />Checking…</> : "Check with Prembly"}
        </button>
      </div>
      {busy === kind ? (
        <div className="admin-working" role="status">
          <span className="admin-spin-sm" aria-hidden style={{ color: "var(--or)", margin: 0 }} />
          <span>{ASKING[kind]}… this can take up to a minute.</span>
        </div>
      ) : null}
    </>
  );

  const resultOf = (kind: PaidKind) => {
    const last = latest(kind === "licence" ? ["licence", "licenceFace"] : [kind]);
    if (!last || busy === kind) return null;
    return (
      <div key={last.id} className="admin-check-in">
        {reusedKind === kind ? (
          <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "#786F68" }}>
            Checked within the last {prembly.reuseDays} days: this is the saved answer, nothing was paid.
          </p>
        ) : null}
        <CheckResult check={last} />
      </div>
    );
  };

  const sentPapers = data.documents?.papers ?? [];
  const insurancePaper = sentPapers.find((p) => p.type === "insurance") ?? null;
  // The usual site for a paper: the first that covers it, or Other.
  const usualSource = (type: string) => data.manualSources.find((s) => s.url && s.papers.includes(type))?.key ?? "other";
  const lastManual = (type: string) => data.checks.find((c) => c.kind === "manual" && c.paperType === type);

  return (
    <>
      <div id="driver-checks" className="admin-page-header" style={{ marginTop: 24 }}>
        <div>
          <h2 style={{ margin: 0 }}>Checks</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#786F68" }}>
            {!prembly.on
              ? "Prembly is not set up on the server (PREMBLY_API_KEY). Checks by hand still work."
              : prembly.canRun
                ? `Prembly checks are paid. ${prembly.thisMonth.toLocaleString("en-NG")} run this month.`
                : "Only owners run Prembly checks (they cost money). You can see the answers and record checks by hand."}
          </p>
        </div>
      </div>

      {error ? (
        <div className="admin-info-card" style={{ borderColor: "#FF3333", background: "#FFF0F0", color: "#B00020" }}>{error}</div>
      ) : null}

      <div className="admin-info-card">
        <strong>Driver&apos;s licence</strong>
        <span style={{ fontSize: 12.5, color: "#786F68" }}> · FRSC, through Prembly</span>
        <Beside
          doc={data.documents?.licence || (lic.withFace && data.documents?.selfieUrl) ? (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {data.documents?.licence ? (
                <div>
                  <div style={{ fontSize: 12.5, color: "#786F68", marginBottom: 4 }}>Their licence</div>
                  <Thumb url={data.documents.licence.url} isPdf={data.documents.licence.isPdf} label="Driver's licence" />
                </div>
              ) : null}
              {lic.withFace && data.documents?.selfieUrl ? (
                <div>
                  <div style={{ fontSize: 12.5, color: "#786F68", marginBottom: 4 }}>Their selfie</div>
                  <Thumb url={data.documents.selfieUrl} isPdf={false} label="Selfie" />
                </div>
              ) : null}
            </div>
          ) : null}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 8 }}>
          <label style={{ display: "grid", gap: 4, fontSize: 12.5, color: "#786F68" }}>
            Licence number
            <input style={inputStyle} value={lic.number} onChange={(e) => setLicence({ ...lic, number: e.target.value })} />
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: 12.5, color: "#786F68" }}>
            Date of birth (from the licence)
            <input style={inputStyle} type="date" value={lic.dob} onChange={(e) => setLicence({ ...lic, dob: e.target.value })} />
          </label>
          {!lic.withFace ? (
            <>
              <label style={{ display: "grid", gap: 4, fontSize: 12.5, color: "#786F68" }}>
                First name
                <input style={inputStyle} value={lic.firstName} onChange={(e) => setLicence({ ...lic, firstName: e.target.value })} />
              </label>
              <label style={{ display: "grid", gap: 4, fontSize: 12.5, color: "#786F68" }}>
                Last name
                <input style={inputStyle} value={lic.lastName} onChange={(e) => setLicence({ ...lic, lastName: e.target.value })} />
              </label>
            </>
          ) : null}
        </div>
        {inputs.hasSelfie ? (
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, marginTop: 8 }}>
            <input type="checkbox" checked={lic.withFace} onChange={(e) => setLicence({ ...lic, withFace: e.target.checked })} />
            Also match their selfie against the licence photo
          </label>
        ) : null}
        {read.state === "reading" ? (
          <div className="admin-working" role="status">
            <span className="admin-spin-sm" aria-hidden style={{ color: "var(--or)", margin: 0 }} />
            <span>Reading the licence photo…</span>
          </div>
        ) : read.state === "failed" ? (
          <p style={{ margin: "8px 0 0", fontSize: 13, color: "#786F68" }}>
            {read.error}{" "}
            <button type="button" className="admin-btn-ghost" style={{ fontSize: 12 }} onClick={() => void readLicence(true)}>Try again</button>
          </p>
        ) : read.state === "done" ? (
          <div className="admin-check-in" style={{ marginTop: 8, padding: 10, borderRadius: 10, background: "#F4F1FF", fontSize: 13 }}>
            {read.reading.readable ? (
              <div>
                Read from the licence photo by AI
                {read.reading.dateOfBirth ? <>: date of birth <strong>{dayWords(read.reading.dateOfBirth)}</strong></> : ": no date of birth it could read"}
                {read.reading.expiresOn ? <>, expires <strong>{dayWords(read.reading.expiresOn)}</strong></> : null}
                . Look at it against the photo before checking.
              </div>
            ) : (
              <div>The AI could not read this licence{read.reading.note ? ` (${read.reading.note})` : ""}: type it from the photo.</div>
            )}
            {read.differs.length ? (
              <ul style={{ margin: "6px 0 0", paddingLeft: 18, color: "#B04A00", fontWeight: 600 }}>
                {read.differs.map((d) => <li key={d}>{d}</li>)}
              </ul>
            ) : null}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
              {read.reading.readable && (read.reading.licenceNumber || read.reading.lastName) ? (
                <button
                  type="button"
                  className="admin-btn-ghost"
                  style={{ fontSize: 12 }}
                  onClick={() => {
                    const r = read.reading;
                    setLicence({
                      ...lic,
                      number: r.licenceNumber ?? lic.number,
                      dob: r.dateOfBirth ?? lic.dob,
                      firstName: r.firstName ?? lic.firstName,
                      lastName: r.lastName ?? lic.lastName,
                    });
                  }}>
                  Use what the photo says
                </button>
              ) : null}
              <button type="button" className="admin-btn-ghost" style={{ fontSize: 12 }} onClick={() => void readLicence(true)}>Read again</button>
            </div>
          </div>
        ) : null}
        <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "#786F68" }}>
          Set against: {inputs.legalName ?? inputs.accountName ?? "no name given"}
          {inputs.licenceExpiresOn ? `, expiry typed ${dayWords(inputs.licenceExpiresOn)}` : ""}.
        </p>
        </Beside>
        {runButton(
          "licence",
          { number: lic.number, dob: lic.dob, ...(lic.withFace ? { withFace: true } : { firstName: lic.firstName, lastName: lic.lastName }) },
          Boolean(lic.number.trim() && lic.dob && (lic.withFace || (lic.firstName.trim() && lic.lastName.trim()))),
        )}
        {photo ? (
          <div style={{ marginTop: 8 }}>
            <span style={{ fontSize: 12.5, color: "#786F68" }}>Photo on the FRSC record (shown now, not saved):</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`data:image/jpeg;base64,${photo}`} alt="Photo on the licence record" style={{ display: "block", maxHeight: 180, borderRadius: 10, marginTop: 4 }} />
          </div>
        ) : null}
        {resultOf("licence")}
      </div>

      <div className="admin-info-card">
        <strong>Plate number</strong>
        <span style={{ fontSize: 12.5, color: "#786F68" }}> · vehicle records, through Prembly</span>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10, alignItems: "end" }}>
          <label style={{ display: "grid", gap: 4, fontSize: 12.5, color: "#786F68" }}>
            Plate
            <input style={inputStyle} value={plateValue} onChange={(e) => setPlate(e.target.value)} />
          </label>
          <span style={{ fontSize: 12.5, color: "#786F68", paddingBottom: 10 }}>Set against: {inputs.vehicle ?? "no car given"}</span>
        </div>
        {runButton("plate", { number: plateValue }, Boolean(plateValue.trim()))}
        {resultOf("plate")}
      </div>

      <div className="admin-info-card">
        <strong>Insurance</strong>
        <span style={{ fontSize: 12.5, color: "#786F68" }}> · NIID, through Prembly</span>
        <Beside
          doc={insurancePaper ? (
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: 12.5, color: "#786F68" }}>The certificate they sent</div>
              <Thumb url={insurancePaper.url} isPdf={insurancePaper.isPdf} label="Insurance" />
              <PaperDates paper={insurancePaper} />
            </div>
          ) : <div style={{ fontSize: 12.5, color: "#786F68" }}>No insurance certificate sent yet.</div>}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
          <label style={{ display: "grid", gap: 4, fontSize: 12.5, color: "#786F68" }}>
            Policy number
            <input style={inputStyle} value={policyValue} onChange={(e) => setPolicy(e.target.value)} />
          </label>
          <span style={{ fontSize: 12.5, color: "#786F68", paddingBottom: 10 }}>
            Set against: plate {inputs.plate ?? "—"}, {inputs.vehicle ?? "no car given"}
            {inputs.insuranceExpiresOn ? `, expiry typed ${dayWords(inputs.insuranceExpiresOn)}` : ""}
          </span>
        </div>
        {runButton("insurance", { number: policyValue }, Boolean(policyValue.trim()))}
        {resultOf("insurance")}
        </Beside>
      </div>

      <div className="admin-info-card">
        <strong>By hand</strong>
        <span style={{ fontSize: 12.5, color: "#786F68" }}> · what Prembly does not cover</span>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          {data.manualSources.filter((s) => s.url).map((s) => (
            <a key={s.key} href={s.url!} target="_blank" rel="noreferrer" className="admin-btn-ghost" style={{ fontSize: 13, textDecoration: "none" }}>
              Open {s.label} ↗
            </a>
          ))}
          {inputs.plate ? (
            <button type="button" className="admin-btn-ghost" style={{ fontSize: 13 }} onClick={() => copy(inputs.plate!.replace(/\s+/g, ""))}>
              Copy plate {inputs.plate}
            </button>
          ) : null}
        </div>
        {sentPapers.length === 0 ? (
          <p style={{ margin: "10px 0 0", fontSize: 13, color: "#786F68" }}>No papers sent yet.</p>
        ) : sentPapers.map((paper) => {
          const source = sources[paper.type] ?? usualSource(paper.type);
          const site = data.manualSources.find((x) => x.key === source);
          const last = lastManual(paper.type);
          const mine = busy === `manual:${paper.type}`;
          return (
            <div key={paper.type} style={{ borderTop: "1px solid #E8DDD3", paddingTop: 12, marginTop: 12 }}>
              <Beside doc={<Thumb url={paper.url} isPdf={paper.isPdf} label={paper.label} height={130} />}>
                <strong style={{ fontSize: 14 }}>{paper.label}</strong>
                <div style={{ marginTop: 4 }}><PaperDates paper={paper} /></div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10, alignItems: "end" }}>
                  <label style={{ display: "grid", gap: 4, fontSize: 12.5, color: "#786F68" }}>
                    Checked on
                    <select style={inputStyle} value={source} onChange={(e) => setSources((all) => ({ ...all, [paper.type]: e.target.value }))}>
                      {data.manualSources.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
                    </select>
                  </label>
                  {site?.url ? (
                    <a href={site.url} target="_blank" rel="noreferrer" className="admin-btn-ghost" style={{ fontSize: 13, textDecoration: "none" }}>
                      Open {SOURCE_LABEL[site.key] ?? site.label} ↗
                    </a>
                  ) : null}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8, alignItems: "center" }}>
                  <input
                    style={{ ...inputStyle, flex: "1 1 220px" }}
                    value={notes[paper.type] ?? ""}
                    maxLength={300}
                    aria-label={`What you found for ${paper.label}`}
                    placeholder={source === "dvis" ? "What you found, e.g. Valid to 12 Mar 2027" : "What you found, e.g. Valid, plate matches"}
                    onChange={(e) => setNotes((all) => ({ ...all, [paper.type]: e.target.value }))}
                  />
                  <button type="button" className="admin-btn-approve" disabled={busy !== null} onClick={() => void recordManual(paper.type, source, "verified")}>
                    {mine ? <><span className="admin-spin-sm" aria-hidden />Saving…</> : "Good"}
                  </button>
                  <button type="button" className="admin-btn-reject" disabled={busy !== null} onClick={() => void recordManual(paper.type, source, "failed")}>
                    Failed
                  </button>
                </div>
                {last ? <div key={last.id} className="admin-check-in"><CheckResult check={last} /></div> : null}
              </Beside>
            </div>
          );
        })}
      </div>

      {data.checks.length > 0 ? (
        <details className="admin-info-card">
          <summary style={{ cursor: "pointer", fontWeight: 700 }}>Every check ({data.checks.length})</summary>
          <div style={{ marginTop: 8 }}>
            {data.checks.map((c) => (
              <div key={c.id} style={{ fontSize: 13, padding: "6px 0", borderTop: "1px solid #E8DDD3", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <OutcomeBadge outcome={c.outcome} />
                <strong>{c.kind === "manual" ? c.paperLabel ?? "By hand" : KIND_LABEL[c.kind] ?? c.kind}</strong>
                <span style={{ color: "#786F68" }}>
                  {SOURCE_LABEL[c.source] ?? c.source}
                  {c.input ? ` · ${c.input}` : ""} · {c.by}, {when(c.at)}
                </span>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </>
  );
}
