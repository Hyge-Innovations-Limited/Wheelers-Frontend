"use client";

import { useCallback, useEffect, useState } from "react";

import { Card, EmptyState, ErrorState, PageHeader, RefreshButton, Spinner, StatCard, StatGrid, TableWrap } from "@/components/admin/ui";
import { useAdminData } from "@/components/admin/use-admin-data";
import { adminJson } from "@/lib/admin-api";
import { useAdminSession, type AdminRole } from "@/lib/admin-session";

/**
 * Team: the admins, their roles, and everything they did in the dashboard.
 * Owners only. Screenshot shortcuts and blocked downloads are flagged; the
 * mark code on each row is the one hidden on every page that admin sees, so a
 * leaked screenshot can be traced back (Trace a mark).
 */

interface TeamAdmin {
  id: string;
  username: string;
  name: string;
  role: AdminRole;
  markCode: string;
  lastSeenAt: string | null;
  today: number;
  flagsThisWeek: number;
  isYou: boolean;
}

interface ActivityRow {
  id: string;
  adminId: string | null;
  adminName: string;
  kind: string;
  page: string | null;
  detail: Record<string, unknown> | null;
  flagged: boolean;
  ip: string | null;
  createdAt: string;
}

const KINDS: Array<{ key: string; label: string }> = [
  { key: "", label: "Everything" },
  { key: "flagged", label: "Flags only" },
  { key: "screenshot", label: "Screenshots" },
  { key: "export", label: "Downloads" },
  { key: "search", label: "Searches" },
  { key: "view", label: "Records opened" },
  { key: "action", label: "Changes" },
  { key: "login", label: "Sign-ins" },
  { key: "page", label: "Pages" },
];

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Lagos" }) : "Never";

const pageName = (page: string | null) => (page ?? "").replace(/^\/admin\/dashboard\/?/, "").replace(/^\/admin\//, "") || "Overview";

function describe(row: ActivityRow): string {
  const d = row.detail ?? {};
  switch (row.kind) {
    case "login": return "Signed in";
    case "login-failed": return `Failed sign-in${d.username ? ` as "${String(d.username)}"` : ""}`;
    case "page": return `Opened ${pageName(row.page)}`;
    case "search": return `Searched "${String(d.q ?? "")}" in ${pageName(row.page)}`;
    case "view": return `Opened the record ${pageName(row.page)}`;
    case "action": return `Made a change: ${pageName(row.page)}`;
    case "export": return `Downloaded Excel (${String(d.scope ?? "")}, ${String(d.from ?? "")} to ${String(d.to ?? "")}${d.contacts ? ", with phone numbers" : ""})`;
    case "export-blocked": return "Tried to download Excel (blocked: staff)";
    case "screenshot": return `Screenshot keys${d.key ? ` (${String(d.key)})` : ""} on ${pageName(row.page)}`;
    case "role-change": return `Changed ${String(d.admin ?? "an admin")} from ${String(d.from ?? "").toLowerCase()} to ${String(d.to ?? "").toLowerCase()}`;
    default: return row.kind;
  }
}

export default function TeamPage() {
  const { isOwner, admin } = useAdminSession();
  const team = useAdminData<{ admins: TeamAdmin[] }>(isOwner ? "/admin/team" : null, [isOwner], { refreshMs: 60_000 });
  const [person, setPerson] = useState("");
  const [kind, setKind] = useState("");
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState(0);
  const [code, setCode] = useState("");
  const [traced, setTraced] = useState<{ code: string; admin: { name: string; username: string; role: AdminRole } | null } | null>(null);

  const query = useCallback((before?: string | null) => {
    const params = new URLSearchParams({ limit: "50" });
    if (person) params.set("adminId", person);
    if (kind === "flagged") params.set("flagged", "1");
    else if (kind) params.set("kind", kind);
    if (before) params.set("before", before);
    return `/admin/team/activity?${params.toString()}`;
  }, [person, kind]);

  const load = useCallback(async (more = false) => {
    setLoading(true);
    setError(null);
    try {
      const page = await adminJson<{ rows: ActivityRow[]; next: string | null }>(query(more ? next : null));
      setRows((current) => (more ? [...current, ...page.rows] : page.rows));
      setLoadedAt(Date.now());
      setNext(page.rows.length === 50 ? page.next : null);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [query, next]);

  // A new person or filter: the list from the top (on the next tick, not inside the effect itself).
  useEffect(() => {
    if (!isOwner) return;
    const timer = setTimeout(() => void load(false), 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOwner, person, kind]);

  async function changeRole(target: TeamAdmin, role: AdminRole) {
    setRoleError(null);
    try {
      await adminJson(`/admin/team/${target.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ role }) });
      team.refresh();
      void load(false);
    } catch (e) {
      setRoleError(e instanceof Error ? e.message : "Could not change the role.");
    }
  }

  async function trace() {
    const clean = code.trim().toUpperCase().replace(/^WH\s*/, "").slice(0, 6);
    if (!clean) return;
    try {
      setTraced(await adminJson(`/admin/team/trace?code=${encodeURIComponent(clean)}`));
    } catch {
      setTraced({ code: clean, admin: null });
    }
  }

  if (admin && !isOwner) {
    // Said the way any missing page is: no hint that a role keeps it from them.
    return (
      <>
        <PageHeader title="Page not found" />
        <EmptyState>This page doesn&apos;t exist.</EmptyState>
      </>
    );
  }

  const admins = team.data?.admins ?? [];
  const flagsToday = rows.filter((r) => r.flagged && loadedAt - Date.parse(r.createdAt) < 86400_000).length;

  return (
    <>
      <PageHeader
        title="Team"
        subtitle="Who can see what, and everything each admin did in the dashboard. Screenshot keys and blocked downloads are flagged in red."
        actions={<RefreshButton busy={team.loading || loading} onClick={() => { team.refresh(); void load(false); }} />}
      />

      {team.error && !team.data ? <ErrorState error={team.error} onRetry={team.refresh} /> : null}
      {!team.data && !team.error ? <Spinner label="Loading the team…" /> : null}

      {team.data ? (
        <>
          <StatGrid cols={3}>
            <StatCard label="Admins" value={admins.length} hint={`${admins.filter((a) => a.role === "OWNER").length} owners · ${admins.filter((a) => a.role === "STAFF").length} staff`} />
            <StatCard label="Flags this week" value={admins.reduce((sum, a) => sum + a.flagsThisWeek, 0)} tone={admins.some((a) => a.flagsThisWeek > 0) ? "red" : "green"} hint="Screenshot keys and blocked downloads" />
            <StatCard label="Active today" value={admins.filter((a) => a.today > 0).length} hint="Admins who did anything today" />
          </StatGrid>

          <div style={{ height: 20 }} />

          <Card title="People" right="Staff don't see the Excel download or this page">
            {roleError ? <div className="admin-login-error" style={{ margin: 12 }}>{roleError}</div> : null}
            <TableWrap>
              <table className="admin-table">
                <thead>
                  <tr><th>Admin</th><th>Role</th><th>Last seen</th><th>Today</th><th>Flags (7 days)</th><th>Mark code</th></tr>
                </thead>
                <tbody>
                  {admins.map((a) => (
                    <tr key={a.id}>
                      <td><strong>{a.name}</strong>{a.isYou ? " (you)" : ""}<br /><span style={{ color: "#786F68", fontSize: 12 }}>@{a.username}</span></td>
                      <td>
                        <select
                          value={a.role}
                          onChange={(e) => void changeRole(a, e.target.value as AdminRole)}
                          aria-label={`Role for ${a.name}`}
                          style={{ height: 32, borderRadius: 8, border: "1px solid #E8DDD3", padding: "0 8px", fontWeight: 600 }}
                        >
                          <option value="OWNER">Owner</option>
                          <option value="STAFF">Staff</option>
                        </select>
                      </td>
                      <td>{when(a.lastSeenAt)}</td>
                      <td>{a.today}</td>
                      <td>{a.flagsThisWeek ? <span className="admin-badge red">{a.flagsThisWeek}</span> : "—"}</td>
                      <td><code>{a.markCode}</code></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </Card>

          <div style={{ height: 20 }} />

          <Card title="Trace a mark" right="From a leaked screenshot or photo of the dashboard">
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
              <p style={{ margin: 0, fontSize: 13, color: "#786F68" }}>
                Every dashboard page carries a very faint line, &ldquo;WH&nbsp;CODE&nbsp;date&nbsp;time&rdquo;. In a leaked image, turn the brightness down and the contrast up until it shows, then type the six-character code here.
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void trace(); }}
                  placeholder="e.g. 3FA9C1"
                  aria-label="Mark code"
                  style={{ height: 40, borderRadius: 10, border: "1px solid #E8DDD3", padding: "0 12px", fontFamily: "monospace", fontSize: 15, textTransform: "uppercase", width: 180 }}
                />
                <button type="button" className="admin-btn-primary" onClick={() => void trace()}>Trace</button>
              </div>
              {traced ? (
                traced.admin
                  ? <div><strong>{traced.code}</strong> is <strong>{traced.admin.name}</strong> (@{traced.admin.username}, {traced.admin.role === "OWNER" ? "owner" : "staff"}).</div>
                  : <div style={{ color: "#FF3333" }}>No admin has the code {traced.code}.</div>
              ) : null}
            </div>
          </Card>

          <div style={{ height: 20 }} />

          <Card
            title="Activity"
            right={flagsToday ? <span className="admin-badge red">{flagsToday} flagged today</span> : "Newest first"}
          >
            <div style={{ padding: "12px 16px", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <select value={person} onChange={(e) => setPerson(e.target.value)} aria-label="Admin" style={{ height: 34, borderRadius: 8, border: "1px solid #E8DDD3", padding: "0 8px" }}>
                <option value="">Everyone</option>
                {admins.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <div className="admin-range-tabs" role="group" aria-label="What">
                {KINDS.map((k) => (
                  <button key={k.key || "all"} type="button" className={`admin-range-tab${kind === k.key ? " active" : ""}`} onClick={() => setKind(k.key)}>
                    {k.label}
                  </button>
                ))}
              </div>
            </div>
            {error ? <ErrorState error={error} onRetry={() => void load(false)} /> : null}
            {rows.length === 0 && !loading && !error ? <EmptyState>Nothing recorded yet.</EmptyState> : null}
            {rows.length > 0 ? (
              <TableWrap>
                <table className="admin-table">
                  <thead><tr><th>When</th><th>Who</th><th>What</th><th>From</th></tr></thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} style={r.flagged ? { background: "#FFF4F4" } : undefined}>
                        <td style={{ whiteSpace: "nowrap" }}>{when(r.createdAt)}</td>
                        <td><strong>{r.adminName}</strong></td>
                        <td style={r.flagged ? { color: "#D92D20", fontWeight: 700 } : undefined}>{describe(r)}</td>
                        <td style={{ color: "#786F68", fontSize: 12 }}>{r.ip ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            ) : null}
            {next ? (
              <div style={{ padding: 16, textAlign: "center" }}>
                <button type="button" className="admin-btn-ghost" onClick={() => void load(true)} disabled={loading}>
                  {loading ? "Loading…" : "Load more"}
                </button>
              </div>
            ) : null}
          </Card>
        </>
      ) : null}
    </>
  );
}
