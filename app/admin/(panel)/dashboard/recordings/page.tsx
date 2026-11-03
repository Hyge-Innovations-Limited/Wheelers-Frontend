"use client";

import { Fragment, useState } from "react";

import { adminJson } from "@/lib/admin-api";

import { Card, EmptyState, ErrorState, PageHeader, RefreshButton, Spinner, TableWrap } from "@/components/admin/ui";
import { useAdminData } from "@/components/admin/use-admin-data";

/**
 * Trip recordings: every recorded trip, newest first, with where its pieces
 * are in Cloudflare R2 (the bucket and each object key, to copy). Listen asks
 * for 5-minute links (each listen is logged). Owners and support only.
 */

interface Row {
  rideId: string;
  tripId: string | null;
  recordingStartedAt: string | null;
  endedAt: string | null;
  ended: "completed" | "cancelled" | null;
  driverName: string | null;
  driverPhone: string | null;
  riderName: string | null;
  riderPhone: string | null;
  pieces: number;
  kept: number;
  bytes: number;
  seconds: number | null;
  firstUploadAt: string;
  lastUploadAt: string;
  deletesFrom: string;
  objectKeys: string[];
}
interface List { bucket: string | null; keepDays: number; total: number; items: Row[] }
interface Listen { recordings: Array<{ segmentIndex: number; url: string; changed: boolean | null; durationSec: number | null }> }

const PAGE = 50;

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Lagos" }) : "—";
const day = (iso: string) => new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" });
const size = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
const minutes = (seconds: number | null) => (seconds == null ? "—" : `${Math.round(seconds / 60)} min`);

function Copy({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="admin-btn-ghost"
      style={{ minHeight: 32, padding: "4px 10px", fontSize: 12.5 }}
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); }).catch(() => undefined);
      }}>
      {done ? "Copied" : label}
    </button>
  );
}

export default function TripRecordingsPage() {
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [offset, setOffset] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const [listen, setListen] = useState<Record<string, Listen | { error: string } | "loading">>({});

  const params = new URLSearchParams({ limit: String(PAGE), offset: String(offset) });
  if (q.trim()) params.set("q", q.trim());
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const path = `/admin/trip-recordings?${params.toString()}`;
  const { data, error, loading, refresh } = useAdminData<List>(path, [path]);

  const play = async (rideId: string) => {
    setListen((all) => ({ ...all, [rideId]: "loading" }));
    try {
      const body = await adminJson<Listen>(`/admin/rides/${encodeURIComponent(rideId)}/recordings`);
      setListen((all) => ({ ...all, [rideId]: body }));
    } catch (e) {
      setListen((all) => ({ ...all, [rideId]: { error: e instanceof Error ? e.message : "Could not load. Try again." } }));
    }
  };

  return (
    <>
      <PageHeader
        title="Trip recordings"
        subtitle={data?.bucket ? <>R2 bucket <code>{data.bucket}</code> <Copy text={data.bucket} /> · kept {data.keepDays} days</> : undefined}
        actions={<RefreshButton onClick={refresh} busy={loading} />}
      />

      <Card padded>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
          <label style={{ display: "grid", gap: 4, flex: "1 1 220px", fontSize: 12.5 }}>
            Search
            <input className="admin-input" value={q} placeholder="Trip code, ride ID, name or phone" onChange={(e) => { setQ(e.target.value); setOffset(0); }} />
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: 12.5 }}>
            From
            <input className="admin-input" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setOffset(0); }} />
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: 12.5 }}>
            To
            <input className="admin-input" type="date" value={to} onChange={(e) => { setTo(e.target.value); setOffset(0); }} />
          </label>
        </div>
      </Card>

      {error && !data ? <ErrorState error={error} onRetry={refresh} /> : null}
      {!data && loading ? <Spinner label="Loading recordings" /> : null}

      {data ? (
        <Card title={`${data.total.toLocaleString("en-NG")} recorded ${data.total === 1 ? "trip" : "trips"}`}>
          {data.items.length === 0 ? <EmptyState>No recordings.</EmptyState> : (
            <TableWrap>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Trip</th>
                    <th>Driver</th>
                    <th>Rider</th>
                    <th>Recorded</th>
                    <th>Length</th>
                    <th>Deletes</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((row) => {
                    const heard = listen[row.rideId];
                    return (
                      <Fragment key={row.rideId}>
                        <tr>
                          <td>
                            <div style={{ fontWeight: 700 }}>{row.tripId ?? "—"}</div>
                            <div style={{ fontSize: 12, color: "#786F68", display: "flex", gap: 6, alignItems: "center" }}>
                              <span style={{ fontFamily: "monospace" }}>{row.rideId.slice(0, 8)}…</span>
                              <Copy text={row.rideId} label="Copy ID" />
                            </div>
                          </td>
                          <td>
                            {row.driverName ?? "—"}
                            {row.driverPhone ? <div style={{ fontSize: 12, color: "#786F68" }}>{row.driverPhone}</div> : null}
                          </td>
                          <td>
                            {row.riderName ?? "—"}
                            {row.riderPhone ? <div style={{ fontSize: 12, color: "#786F68" }}>{row.riderPhone}</div> : null}
                          </td>
                          <td>
                            {when(row.recordingStartedAt ?? row.firstUploadAt)}
                            <div style={{ fontSize: 12, color: "#786F68" }}>
                              {row.ended === "cancelled" ? "Cancelled" : row.ended === "completed" ? "Ended" : "Running"} {row.endedAt ? when(row.endedAt) : ""}
                            </div>
                          </td>
                          <td>
                            {minutes(row.seconds)}
                            <div style={{ fontSize: 12, color: "#786F68" }}>
                              {row.kept === row.pieces ? `${row.pieces} ${row.pieces === 1 ? "piece" : "pieces"}` : `${row.kept} of ${row.pieces} kept`} · {size(row.bytes)}
                            </div>
                          </td>
                          <td>{row.kept === 0 ? "Deleted" : day(row.deletesFrom)}</td>
                          <td style={{ whiteSpace: "nowrap" }}>
                            <button type="button" className="admin-btn-ghost" onClick={() => setOpen(open === row.rideId ? null : row.rideId)}>
                              {open === row.rideId ? "Hide files" : "Files"}
                            </button>{" "}
                            {row.kept > 0 ? (
                              <button type="button" className="admin-btn-ghost" disabled={heard === "loading"} onClick={() => void play(row.rideId)}>
                                {heard === "loading" ? "Loading…" : "Listen"}
                              </button>
                            ) : null}
                          </td>
                        </tr>
                        {open === row.rideId || (heard && heard !== "loading") ? (
                          <tr>
                            <td colSpan={7} style={{ background: "#FAF7F2" }}>
                              {open === row.rideId ? (
                                <div style={{ display: "grid", gap: 6, marginBottom: heard ? 12 : 0 }}>
                                  {row.objectKeys.map((key) => (
                                    <div key={key} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                      <code style={{ fontSize: 12.5, wordBreak: "break-all" }}>{key}</code>
                                      <Copy text={key} />
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                              {heard && heard !== "loading" ? (
                                "error" in heard ? (
                                  <div style={{ color: "#B00020", fontSize: 13.5, fontWeight: 600 }}>{heard.error}</div>
                                ) : (
                                  <div style={{ display: "grid", gap: 8 }}>
                                    {heard.recordings.map((r) => (
                                      <div key={r.segmentIndex} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                                        <span style={{ fontSize: 12.5, minWidth: 64 }}>Piece {r.segmentIndex + 1}</span>
                                        <audio controls preload="none" src={r.url} style={{ maxWidth: "100%" }} />
                                        {r.changed ? <span style={{ color: "#B00020", fontSize: 12.5, fontWeight: 700 }}>File changed since it was recorded</span> : null}
                                      </div>
                                    ))}
                                    <div style={{ fontSize: 12, color: "#786F68" }}>Links work for 5 minutes. Press Listen again for new ones.</div>
                                  </div>
                                )
                              ) : null}
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </TableWrap>
          )}
          {data.total > PAGE ? (
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
              <button type="button" className="admin-btn-ghost" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>Newer</button>
              <button type="button" className="admin-btn-ghost" disabled={offset + PAGE >= data.total} onClick={() => setOffset(offset + PAGE)}>Older</button>
            </div>
          ) : null}
        </Card>
      ) : null}
    </>
  );
}
