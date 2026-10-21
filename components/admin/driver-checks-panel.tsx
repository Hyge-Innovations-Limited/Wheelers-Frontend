"use client";

import { useState } from "react";

import { useAdminData } from "@/components/admin/use-admin-data";
import { adminFetch } from "@/lib/admin-api";

/**
 * Checking a driver's licence and car, on their review page.
 *
 *   Prembly      the licence (FRSC), the plate and the insurance policy (NIID),
 *                each set against what the driver gave us; what does not agree
 *                shows in red. Each check costs money: only owners run one, and
 *                the same check on the same number within 30 days shows the
 *                saved answer unless run again on purpose.
 *   By hand      what Prembly does not cover (the hackney permit on AutoReg,
 *                roadworthiness on DVIS, the owner's letter): open the site,
 *                check, and record what was found.
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
  checks: Check[];
}
type PaidKind = "licence" | "plate" | "insurance";

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

const PAPER_OPTIONS: Array<{ type: string; label: string }> = [
  { type: "hackneyPermit", label: "Hackney permit" },
  { type: "vehicleLicence", label: "Vehicle licence" },
  { type: "roadworthiness", label: "Roadworthiness certificate" },
  { type: "vioInspection", label: "VIO inspection report" },
  { type: "insurance", label: "Insurance" },
  { type: "proofOfOwnership", label: "Proof of ownership" },
  { type: "purchaseReceipt", label: "Receipt of the car" },
  { type: "ownerLetter", label: "Owner's letter" },
  { type: "lagosVehicle", label: "Lagos State vehicle paper" },
];

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

const inputStyle = { height: 38, borderRadius: 10, border: "1px solid #E8DDD3", padding: "0 10px", fontSize: 14, minWidth: 0 } as const;

function OutcomeBadge({ outcome }: { outcome: Outcome }) {
  const look = OUTCOME[outcome] ?? OUTCOME.error;
  return (
    <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 999, background: look.bg, color: look.color, fontWeight: 700, whiteSpace: "nowrap" }}>
      {look.word}
    </span>
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
  const [manual, setManual] = useState({ paperType: "hackneyPermit", source: "autoreg", note: "" });

  if (!data) return null;
  const { prembly, inputs } = data;
  const names = (inputs.legalName ?? inputs.accountName ?? "").split(/\s+/).filter(Boolean);
  const lic = licence ?? {
    number: inputs.licenceNumber ?? "",
    dob: "",
    firstName: names[0] ?? "",
    lastName: names.length > 1 ? names[names.length - 1]! : "",
    withFace: false,
  };
  const plateValue = plate ?? inputs.plate ?? "";
  const policyValue = policy ?? inputs.insuranceNumber ?? "";
  const latest = (kinds: string[]) => data.checks.find((c) => kinds.includes(c.kind));
  const canRun = prembly.on && prembly.canRun;

  const runPrembly = async (kind: PaidKind, body: Record<string, unknown>, force = false) => {
    if (!window.confirm(`${force ? "Run it again? " : ""}This is a paid Prembly check. Go ahead?`)) return;
    setBusy(kind); setError(null); setReusedKind(null);
    try {
      const res = await adminFetch(`/admin/drivers/${driverId}/checks/prembly`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, ...body, ...(force ? { force: true } : {}) }),
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

  const recordManual = async (outcome: "verified" | "failed") => {
    if (outcome === "failed" && manual.note.trim().length < 4) {
      setError("Say what was wrong: the next admin reads it.");
      return;
    }
    setBusy("manual"); setError(null);
    try {
      const res = await adminFetch(`/admin/drivers/${driverId}/checks/manual`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...manual, outcome }),
      });
      if (!res.ok) {
        const answer = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(answer?.error ?? "Could not save that.");
        return;
      }
      setManual((m) => ({ ...m, note: "" }));
      refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(null);
    }
  };

  const copy = (text: string) => { void navigator.clipboard?.writeText(text).catch(() => undefined); };

  const runButton = (kind: PaidKind, body: Record<string, unknown>, ready: boolean) => {
    const last = latest(kind === "licence" ? ["licence", "licenceFace"] : [kind]);
    return (
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
        <button type="button" className="admin-btn-approve" disabled={!canRun || !ready || busy !== null} onClick={() => void runPrembly(kind, body)}>
          {busy === kind ? "Checking…" : "Check with Prembly"}
        </button>
        {canRun && last && (reusedKind === kind || last.outcome !== "error") ? (
          <button type="button" className="admin-btn-ghost" disabled={busy !== null} onClick={() => void runPrembly(kind, body, true)}>
            Run again (paid)
          </button>
        ) : null}
      </div>
    );
  };

  const resultOf = (kind: PaidKind) => {
    const last = latest(kind === "licence" ? ["licence", "licenceFace"] : [kind]);
    if (!last) return null;
    return (
      <>
        {reusedKind === kind ? (
          <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "#786F68" }}>
            Checked within the last {prembly.reuseDays} days: this is the saved answer, nothing was paid. Use Run again for a fresh one.
          </p>
        ) : null}
        <CheckResult check={last} />
      </>
    );
  };

  const source = data.manualSources.find((s) => s.key === manual.source);
  const manualChecks = data.checks.filter((c) => c.kind === "manual");

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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 8, marginTop: 10 }}>
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
        <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "#786F68" }}>
          Set against: {inputs.legalName ?? inputs.accountName ?? "no name given"}
          {inputs.licenceExpiresOn ? `, expiry typed ${inputs.licenceExpiresOn}` : ""}.
        </p>
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
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10, alignItems: "end" }}>
          <label style={{ display: "grid", gap: 4, fontSize: 12.5, color: "#786F68" }}>
            Policy number
            <input style={inputStyle} value={policyValue} onChange={(e) => setPolicy(e.target.value)} />
          </label>
          <span style={{ fontSize: 12.5, color: "#786F68", paddingBottom: 10 }}>
            Set against: plate {inputs.plate ?? "—"}, {inputs.vehicle ?? "no car given"}
            {inputs.insuranceExpiresOn ? `, expiry typed ${inputs.insuranceExpiresOn}` : ""}
          </span>
        </div>
        {runButton("insurance", { number: policyValue }, Boolean(policyValue.trim()))}
        {resultOf("insurance")}
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
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10, alignItems: "end" }}>
          <label style={{ display: "grid", gap: 4, fontSize: 12.5, color: "#786F68" }}>
            Paper
            <select style={inputStyle} value={manual.paperType} onChange={(e) => setManual({ ...manual, paperType: e.target.value })}>
              {PAPER_OPTIONS.map((p) => <option key={p.type} value={p.type}>{p.label}</option>)}
            </select>
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: 12.5, color: "#786F68" }}>
            Checked on
            <select style={inputStyle} value={manual.source} onChange={(e) => setManual({ ...manual, source: e.target.value })}>
              {data.manualSources.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: 12.5, color: "#786F68", flex: "1 1 220px" }}>
            What you found
            <input
              style={inputStyle}
              value={manual.note}
              maxLength={300}
              placeholder={source?.key === "dvis" ? "e.g. Valid to 12 Mar 2027" : "e.g. Permit valid, plate matches"}
              onChange={(e) => setManual({ ...manual, note: e.target.value })}
            />
          </label>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button type="button" className="admin-btn-approve" disabled={busy !== null} onClick={() => void recordManual("verified")}>
            {busy === "manual" ? "Saving…" : "Good"}
          </button>
          <button type="button" className="admin-btn-reject" disabled={busy !== null} onClick={() => void recordManual("failed")}>
            Failed
          </button>
        </div>
        {manualChecks.length ? (
          <div style={{ marginTop: 10 }}>
            {manualChecks.map((c) => (
              <div key={c.id}>
                <div style={{ fontSize: 13, fontWeight: 700, marginTop: 8 }}>{c.paperLabel ?? c.paperType}</div>
                <CheckResult check={c} />
              </div>
            ))}
          </div>
        ) : null}
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
