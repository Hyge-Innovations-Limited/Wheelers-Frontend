"use client";

import { useState } from "react";

import { adminFetch } from "@/lib/admin-api";

import { Card, EmptyState, ErrorState, PageHeader, RefreshButton, Spinner, StatCard, StatGrid } from "@/components/admin/ui";
import { useAdminData } from "@/components/admin/use-admin-data";

/**
 * The drivers' Feed (driver app, 14 Nov 2026). A driver's post waits here
 * until it is approved; only then do other drivers see it. Three reports send
 * a live post back here ("Reported"). The driver gets a push either way.
 * Wheelers posts are written here and go live at once; pin one to keep it at
 * the top. A driver who keeps posting badly can be stopped from posting.
 */

type List = "waiting" | "live" | "rejected";

interface Item {
  id: string;
  kind: "driver" | "road_alert" | "wheelers";
  text: string;
  photos: Array<{ url: string; width: number; height: number }>;
  driver: { id: string; name: string | null; shownAs: string; phone: string | null; plate: string | null; blocked: boolean } | null;
  likeCount: number;
  reportCount: number;
  reports: Array<{ reason: string | null; at: string }>;
  wasLive: boolean;
  pinned: boolean;
  rejectionReason: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
}
interface Data { status: List; counts: Record<List, number>; reasons: string[]; items: Item[] }

const TABS: Array<{ key: List; label: string; hint: string; empty: string }> = [
  { key: "waiting", label: "To approve", hint: "Drivers' posts no one else sees yet", empty: "No post is waiting." },
  { key: "live", label: "Live", hint: "On every driver's Feed", empty: "Nothing is live." },
  { key: "rejected", label: "Rejected", hint: "Not approved; the driver was told why", empty: "Nothing rejected." },
];

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Lagos" });

const toBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

async function post(path: string, body?: unknown): Promise<{ ok: boolean; error?: string; body?: Record<string, unknown> }> {
  try {
    const res = await adminFetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}) });
    const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    return res.ok ? { ok: true, body: json ?? {} } : { ok: false, error: (json?.error as string) ?? "That did not work." };
  } catch {
    return { ok: false, error: "Could not reach the server." };
  }
}

function NewWheelersPost({ onDone }: { onDone: () => void }) {
  const [text, setText] = useState("");
  const [pinned, setPinned] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const send = async () => {
    if (!text.trim() && files.length === 0) return;
    setBusy(true); setNote(null);
    try {
      const photos = await Promise.all(files.slice(0, 4).map(toBase64));
      const done = await post("/admin/feed", { text, pinned, photos });
      if (!done.ok) { setNote({ ok: false, text: done.error ?? "Not posted." }); return; }
      setText(""); setPinned(false); setFiles([]);
      setNote({ ok: true, text: "Posted. Drivers see it now." });
      onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Post as Wheelers" right="Live at once">
      <div style={{ display: "grid", gap: 10 }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={560}
          rows={3}
          placeholder="Rain bonus tonight 6–9pm: +₦300 on every trip in Yaba and Island."
          style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #E6DFD2", font: "inherit", resize: "vertical" }}
        />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center", fontSize: 13.5 }}>
          <label style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
            <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} /> Pin to the top
          </label>
          <label style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
            Photos (up to 4)
            <input type="file" accept="image/jpeg,image/png" multiple onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 4))} />
          </label>
          <span style={{ color: "#786F68" }}>{[...text].length}/560</span>
          <button type="button" className="admin-btn-primary" disabled={busy || (!text.trim() && files.length === 0)} onClick={() => void send()} style={{ marginLeft: "auto" }}>
            {busy ? "Posting…" : "Post"}
          </button>
        </div>
        {note ? <div style={{ fontSize: 13.5, fontWeight: 600, color: note.ok ? "#0B7A55" : "#B00020" }}>{note.text}</div> : null}
      </div>
    </Card>
  );
}

function PostCard({ item, list, reasons, picked, onPick, onChanged }: {
  item: Item; list: List; reasons: string[]; picked: boolean; onPick: () => void; onChanged: (text: string, ok: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState(reasons[0] ?? "");
  const [other, setOther] = useState("");

  const act = async (path: string, body: unknown, done: string) => {
    setBusy(true);
    const result = await post(path, body);
    setBusy(false);
    onChanged(result.ok ? done : result.error ?? "That did not work.", result.ok);
  };
  const tag = item.kind === "road_alert" ? "Road alert" : item.kind === "wheelers" ? "Wheelers" : null;

  return (
    <div style={{ border: "1px solid #E6DFD2", borderRadius: 14, padding: 14, display: "grid", gap: 10, background: "#fff" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        {list === "waiting" ? <input type="checkbox" aria-label="Select this post" checked={picked} onChange={onPick} style={{ marginTop: 4 }} /> : null}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>
            {item.driver ? (
              <a href={`/admin/dashboard/drivers/${item.driver.id}`}>{item.driver.name ?? item.driver.shownAs}</a>
            ) : "Wheelers"}
            <span style={{ fontWeight: 500, color: "#786F68" }}>
              {item.driver ? ` · shown as ${item.driver.shownAs}` : ""}{item.driver?.phone ? ` · ${item.driver.phone}` : ""}{item.driver?.plate ? ` · ${item.driver.plate}` : ""}
            </span>
          </div>
          <div style={{ fontSize: 12, color: "#786F68" }}>
            {when(item.createdAt)}
            {tag ? ` · ${tag}` : ""}
            {item.pinned ? " · Pinned" : ""}
            {list !== "waiting" ? ` · ♥ ${item.likeCount}` : ""}
            {item.driver?.blocked ? " · Can't post" : ""}
          </div>
        </div>
      </div>

      {item.wasLive ? (
        <div style={{ fontSize: 12.5, fontWeight: 700, color: "#B04A00" }}>
          Reported {item.reportCount}× while live{item.reports.some((r) => r.reason) ? `: ${item.reports.map((r) => r.reason).filter(Boolean).join(" · ")}` : ""}
        </div>
      ) : null}

      {item.text ? <div style={{ fontSize: 14.5, lineHeight: 1.45, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{item.text}</div> : null}

      {item.photos.length ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {item.photos.map((p) => (
            <a key={p.url} href={p.url} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" style={{ height: 140, width: "auto", maxWidth: 240, objectFit: "cover", borderRadius: 10, border: "1px solid #E6DFD2" }} />
            </a>
          ))}
        </div>
      ) : null}

      {list === "rejected" ? (
        <div style={{ fontSize: 12.5, color: "#786F68" }}>Rejected by {item.reviewedBy ?? "—"}{item.reviewedAt ? ` on ${when(item.reviewedAt)}` : ""}: {item.rejectionReason ?? "—"}</div>
      ) : null}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        {list === "waiting" && !rejecting ? (
          <>
            <button type="button" className="admin-btn-approve" disabled={busy} onClick={() => void act(`/admin/feed/${item.id}/review`, { decision: "approve" }, "Approved. The driver was told.")}>Approve</button>
            <button type="button" className="admin-btn-reject" disabled={busy} onClick={() => setRejecting(true)}>Reject</button>
          </>
        ) : null}
        {list === "waiting" && rejecting ? (
          <>
            <select value={reason} onChange={(e) => setReason(e.target.value)} style={{ padding: "7px 10px", borderRadius: 10, border: "1px solid #E6DFD2", font: "inherit" }}>
              {reasons.map((r) => <option key={r} value={r}>{r}</option>)}
              <option value="">Other…</option>
            </select>
            {reason === "" ? (
              <input value={other} onChange={(e) => setOther(e.target.value)} maxLength={200} placeholder="Reason the driver sees" style={{ padding: "7px 10px", borderRadius: 10, border: "1px solid #E6DFD2", font: "inherit", minWidth: 220 }} />
            ) : null}
            <button
              type="button"
              className="admin-btn-confirm-reject"
              disabled={busy || !(reason || other.trim())}
              onClick={() => void act(`/admin/feed/${item.id}/review`, { decision: "reject", reason: reason || other.trim() }, "Rejected. The driver was told why.")}>
              Reject post
            </button>
            <button type="button" className="admin-btn-ghost" onClick={() => setRejecting(false)}>Cancel</button>
          </>
        ) : null}
        {list === "live" ? (
          <>
            <button type="button" className="admin-btn-ghost" disabled={busy} onClick={() => void act(`/admin/feed/${item.id}/pin`, { pinned: !item.pinned }, item.pinned ? "Unpinned." : "Pinned to the top.")}>
              {item.pinned ? "Unpin" : "Pin"}
            </button>
            <button
              type="button"
              className="admin-btn-reject"
              disabled={busy}
              onClick={() => { if (window.confirm("Take this post off the Feed?")) void act(`/admin/feed/${item.id}/remove`, {}, "Removed from the Feed."); }}>
              Remove
            </button>
          </>
        ) : null}
        {item.driver ? (
          <button
            type="button"
            className="admin-btn-ghost"
            disabled={busy}
            style={{ marginLeft: "auto" }}
            onClick={() => {
              const blocking = !item.driver!.blocked;
              if (blocking && !window.confirm(`Stop ${item.driver!.name ?? item.driver!.shownAs} posting on the Feed? They can still read it.`)) return;
              void act(`/admin/feed/drivers/${item.driver!.id}/block`, { blocked: blocking }, blocking ? "This driver can no longer post." : "This driver can post again.");
            }}>
            {item.driver.blocked ? "Let them post" : "Stop them posting"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function FeedPage() {
  const [list, setList] = useState<List>("waiting");
  const { data, error, loading, refresh } = useAdminData<Data>(`/admin/feed?status=${list}`, [list], { refreshMs: 30_000 });
  const tab = TABS.find((t) => t.key === list)!;
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const items = data?.items ?? [];
  const allPicked = list === "waiting" && items.length > 0 && items.every((i) => picked.has(i.id));

  const changed = (text: string, ok: boolean) => { setNote({ ok, text }); if (ok) { setPicked(new Set()); refresh(); } };

  const approvePicked = async () => {
    const ids = items.filter((i) => picked.has(i.id)).map((i) => i.id);
    if (!ids.length || !window.confirm(`Approve ${ids.length} post${ids.length === 1 ? "" : "s"}?`)) return;
    setBusy(true);
    const done = await post("/admin/feed/approve", { ids });
    setBusy(false);
    changed(done.ok ? `Approved ${String(done.body?.approved ?? 0)}.${Number(done.body?.skipped) ? ` ${String(done.body?.skipped)} were already decided.` : ""}` : done.error ?? "Not approved.", done.ok);
  };

  return (
    <>
      <PageHeader title="Feed" subtitle="Drivers' posts: approve before other drivers see them" actions={<RefreshButton onClick={refresh} busy={loading} />} />

      {data ? (
        <StatGrid cols={3}>
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => { setList(t.key); setPicked(new Set()); setNote(null); }}
              aria-pressed={list === t.key}
              style={{ all: "unset", cursor: "pointer", display: "block", borderRadius: 14, outline: list === t.key ? "2px solid #0d0d0d" : "none", outlineOffset: 2 }}>
              <StatCard label={t.label} value={data.counts[t.key].toLocaleString("en-NG")} hint={t.hint} tone={t.key === "waiting" && data.counts.waiting > 0 ? "orange" : undefined} />
            </button>
          ))}
        </StatGrid>
      ) : null}

      <NewWheelersPost onDone={() => { if (list === "live") refresh(); }} />

      {error && !data ? <ErrorState error={error} onRetry={refresh} /> : null}
      {!data && loading ? <Spinner label="Loading posts" /> : null}

      {data ? (
        <Card
          title={tab.label}
          right={list === "waiting" && items.length > 0 ? (
            <span style={{ display: "inline-flex", gap: 10, alignItems: "center" }}>
              <label style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 13 }}>
                <input type="checkbox" checked={allPicked} onChange={() => setPicked(allPicked ? new Set() : new Set(items.map((i) => i.id)))} /> All
              </label>
              {picked.size > 0 ? (
                <button type="button" className="admin-btn-approve" disabled={busy} onClick={() => void approvePicked()}>
                  {busy ? "Approving…" : `Approve ${picked.size}`}
                </button>
              ) : null}
            </span>
          ) : `${items.length} shown`}>
          {note ? <div style={{ marginBottom: 10, fontSize: 13.5, fontWeight: 600, color: note.ok ? "#0B7A55" : "#B00020" }}>{note.text}</div> : null}
          {items.length === 0 ? <EmptyState>{tab.empty}</EmptyState> : (
            <div style={{ display: "grid", gap: 12 }}>
              {items.map((item) => (
                <PostCard
                  key={item.id}
                  item={item}
                  list={list}
                  reasons={data.reasons}
                  picked={picked.has(item.id)}
                  onPick={() => setPicked((all) => { const next = new Set(all); if (next.has(item.id)) next.delete(item.id); else next.add(item.id); return next; })}
                  onChanged={changed}
                />
              ))}
            </div>
          )}
        </Card>
      ) : null}
    </>
  );
}
