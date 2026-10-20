"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Card } from "@/components/admin/ui";
import { useAdminData } from "@/components/admin/use-admin-data";
import { adminJson } from "@/lib/admin-api";
import { formatNaira, formatWhen } from "@/lib/admin-format";

export interface BalanceAccess {
  status: "always" | "none" | "pending" | "approved" | "denied" | "expired";
  reason?: string;
  decidedBy?: string | null;
  expiresAt?: string | null;
}

interface Balance { totalNgn: number; heldNgn: number; availableNgn: number; updatedAt: string | null }

/**
 * Someone's wallet balance on the support desk. Owners and staff see it.
 * Support asks first, saying what the money issue is; an owner approves on
 * the Team page, and then this person's balance shows for an hour.
 */
export function BalanceAccessCard({ userId, access, onChange }: { userId: string; access: BalanceAccess; onChange: () => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [balance, setBalance] = useState<Balance | null>(null);
  const canSee = access.status === "always" || access.status === "approved";

  useEffect(() => {
    if (!canSee) return;
    let cancelled = false;
    adminJson<{ balance: Balance }>(`/admin/desk/people/${userId}/balance`)
      .then((r) => { if (!cancelled) setBalance(r.balance); })
      .catch(() => { if (!cancelled) setBalance(null); });
    return () => { cancelled = true; };
  }, [canSee, userId]);

  // Waiting for an owner: look again now and then, so the yes shows without a refresh.
  useEffect(() => {
    if (access.status !== "pending") return;
    const timer = setInterval(onChange, 15_000);
    return () => clearInterval(timer);
  }, [access.status, onChange]);

  async function ask(event: FormEvent) {
    event.preventDefault();
    if (busy || reason.trim().length < 5) return;
    setBusy(true);
    setProblem(null);
    try {
      await adminJson(`/admin/desk/people/${userId}/balance-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      setReason("");
      onChange();
    } catch (failure) {
      setProblem(failure instanceof Error ? failure.message : "It did not send. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Wallet balance" right={access.status === "approved" && access.expiresAt ? `Shown until ${formatWhen(access.expiresAt)}` : undefined} padded>
      {canSee ? (
        balance ? (
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <Amount label="Balance" value={formatNaira(balance.totalNgn)} />
            <Amount label="Held for trips" value={formatNaira(balance.heldNgn)} />
            <Amount label="Available" value={formatNaira(balance.availableNgn)} />
          </div>
        ) : <span style={{ color: "#786F68" }}>Loading…</span>
      ) : access.status === "pending" ? (
        <p style={{ margin: 0 }}>Waiting for an owner to approve. <span style={{ color: "#786F68" }}>You asked: “{access.reason}”</span></p>
      ) : (
        <form onSubmit={(event) => void ask(event)} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <p style={{ margin: 0, color: "#4A443F", fontSize: 14 }}>
            {access.status === "denied"
              ? `${access.decidedBy ?? "An owner"} declined the last ask. You can ask again with more detail.`
              : access.status === "expired"
                ? "The hour you were given is up. Ask again if you still need it."
                : "Hidden. For a money issue, ask an owner to let you see it for an hour."}
          </p>
          <input
            className="admin-input"
            value={reason}
            maxLength={300}
            onChange={(event) => setReason(event.target.value)}
            placeholder="What is the money issue? e.g. says a ₦5,000 deposit is not showing"
            aria-label="What the money issue is"
          />
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <button type="submit" className="admin-btn-primary" disabled={busy || reason.trim().length < 5}>{busy ? "Asking…" : "Ask to see balance"}</button>
            {problem ? <span role="alert" style={{ color: "#CC3333", fontSize: 14 }}>{problem}</span> : null}
          </div>
        </form>
      )}
    </Card>
  );
}

function Amount({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ color: "#786F68", fontSize: 13 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

interface BalanceRequest {
  id: string;
  askedBy: string;
  person: { id: string; name: string; phone: string | null };
  reason: string;
  status: "PENDING" | "APPROVED" | "DENIED" | "EXPIRED";
  decidedBy: string | null;
  askedAt: string;
  expiresAt: string | null;
}

/** Owners, on the Team page: support asking to see someone's balance, to approve (for an hour) or decline. */
export function BalanceRequestsCard() {
  const list = useAdminData<{ requests: BalanceRequest[] }>("/admin/team/balance-requests", [], { refreshMs: 20_000 });
  const rows = list.data?.requests ?? null;
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  async function decide(id: string, answer: "approve" | "deny") {
    setBusy(id);
    setProblem(null);
    try {
      await adminJson(`/admin/team/balance-requests/${id}/${answer}`, { method: "POST" });
      list.refresh();
    } catch (failure) {
      setProblem(failure instanceof Error ? failure.message : "That did not go through. Try again.");
    } finally {
      setBusy(null);
    }
  }

  if (!rows) return null;
  const waiting = rows.filter((r) => r.status === "PENDING").length;
  const word = { APPROVED: "Approved", DENIED: "Declined", EXPIRED: "Approved, hour over", PENDING: "Waiting" } as const;

  return (
    <Card title="Balance requests" right={waiting ? `${waiting} waiting` : "Support asking to see a wallet balance"} padded>
      {problem ? <div className="admin-login-error" style={{ marginBottom: 10 }}>{problem}</div> : null}
      {rows.length === 0 ? <span style={{ color: "#786F68" }}>No requests yet.</span> : rows.map((r) => (
        <div key={r.id} style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #EFEAE2" }}>
          <div style={{ minWidth: 0, flex: "1 1 320px" }}>
            <strong>{r.askedBy}</strong> asks to see <strong>{r.person.name}</strong>’s balance
            <div style={{ fontSize: 14, color: "#4A443F" }}>“{r.reason}”</div>
            <div style={{ fontSize: 13, color: "#786F68" }}>
              {formatWhen(r.askedAt)}{r.status !== "PENDING" ? ` · ${word[r.status]}${r.decidedBy ? ` by ${r.decidedBy}` : ""}` : ""}
            </div>
          </div>
          {r.status === "PENDING" ? (
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="admin-btn-primary" disabled={busy === r.id} onClick={() => void decide(r.id, "approve")}>Approve for 1 hour</button>
              <button type="button" className="admin-btn-secondary" disabled={busy === r.id} onClick={() => void decide(r.id, "deny")}>Decline</button>
            </div>
          ) : null}
        </div>
      ))}
    </Card>
  );
}
