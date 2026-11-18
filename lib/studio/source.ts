/**
 * Where the Studio's dataset comes from: 'live' (GET /admin/insights/studio-dataset, real rows, the last 30 days) or
 * 'sample' (lib/studio/sample.ts, the seeded rehearsal data). Both are a StudioDataset (lib/studio/schema.ts).
 */
import { useMemo } from "react";
import { useAdminData } from "@/components/admin/use-admin-data";
import { sampleDataset } from "./sample";
import type { StudioDataset, StudioPing } from "./schema";

export type StudioSource = "live" | "sample";
export const LIVE_DAYS = 30;

/** The live payload: as StudioDataset, but pings as compact rows [sessionId, driverRating, action, riderVsSuggested%, bidVsSuggested%]. */
type LivePayload = Omit<StudioDataset, "pings"> & { pingRows: Array<[string, number | null, StudioPing["action"], number | null, number | null]> };

function lagosDay(offsetDays = 0): string {
  return new Date(Date.now() + 60 * 60 * 1000 - offsetDays * 86_400_000).toISOString().slice(0, 10);
}

export function liveRange(): { from: string; to: string } {
  return { from: lagosDay(LIVE_DAYS - 1), to: lagosDay(0) };
}

export function fromLive(p: LivePayload): StudioDataset {
  const pings: StudioPing[] = p.pingRows.map(([sessionId, driverRating, action, riderVsSuggestedPct, bidVsSuggestedPct]) => ({
    sessionId, driverId: "", ownership: null, driverRating, pickupKm: null, delivered: null, seen: null, action,
    declineReason: null, lastTripEnd: null, riderVsSuggestedPct: riderVsSuggestedPct ?? 0, bidVsSuggestedPct,
  }));
  const { pingRows: _rows, ...rest } = p;
  void _rows;
  return { ...rest, source: "live", pings };
}

export function useStudioDataset(source: StudioSource): { data: StudioDataset | null; loading: boolean; error: unknown; refresh: () => void } {
  const range = useMemo(() => liveRange(), []);
  const live = useAdminData<LivePayload>(source === "live" ? `/admin/insights/studio-dataset?from=${range.from}&to=${range.to}` : null, [source]);
  const sample = useMemo(() => (source === "sample" ? sampleDataset() : null), [source]);
  const data = useMemo(() => (source === "sample" ? sample : live.data ? fromLive(live.data) : null), [source, sample, live.data]);
  return { data, loading: source === "live" && live.loading, error: source === "live" ? live.error : null, refresh: live.refresh };
}
