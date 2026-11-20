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

/**
 * The live payload: as StudioDataset, but pings as compact rows [sessionId, driverRating, action, riderVsSuggested%,
 * bidVsSuggested%, driverPlatform, driverPhoneTier] (the last two from 20 Nov 2026; older servers leave them out).
 */
type LivePayload = Omit<StudioDataset, "pings" | "devices"> & {
  pingRows: Array<[string, number | null, StudioPing["action"], number | null, number | null, StudioPing["driverPlatform"]?, StudioPing["driverPhoneTier"]?]>;
  devices?: StudioDataset["devices"];
};

function lagosDay(offsetDays = 0): string {
  return new Date(Date.now() + 60 * 60 * 1000 - offsetDays * 86_400_000).toISOString().slice(0, 10);
}

export function liveRange(): { from: string; to: string } {
  return { from: lagosDay(LIVE_DAYS - 1), to: lagosDay(0) };
}

const NO_RIDER_DEVICE = { deviceId: null, deviceRecorded: false, platform: "Unknown", phoneMaker: null, phoneModel: null, phoneTier: "Unknown", signal: "Unknown", appVersion: null, browser: null, mobileNetwork: "Unknown", formsOpen: null };
const NO_DRIVER_DEVICE = { driverDeviceId: null, driverPlatform: "Unknown", driverPhoneTier: "Unknown", driverPhoneModel: null, driverAppVersion: null };

export function fromLive(p: LivePayload): StudioDataset {
  const pings: StudioPing[] = p.pingRows.map(([sessionId, driverRating, action, riderVsSuggestedPct, bidVsSuggestedPct, driverPlatform, driverPhoneTier]) => ({
    sessionId, driverId: "", ownership: null, driverRating, pickupKm: null, delivered: null, seen: null, action,
    declineReason: null, lastTripEnd: null, riderVsSuggestedPct: riderVsSuggestedPct ?? 0, bidVsSuggestedPct,
    driverPlatform: driverPlatform ?? "Unknown", driverPhoneTier: driverPhoneTier ?? "Unknown",
  }));
  const { pingRows: _rows, devices, ...rest } = p;
  void _rows;
  // An older server: no device fields at all (every device chart then says Unknown).
  const sessions = rest.sessions.map((s) => ({ ...NO_RIDER_DEVICE, ...(s as object) }) as StudioDataset["sessions"][number]);
  const offers = rest.offers.map((o) => ({ ...NO_DRIVER_DEVICE, ...(o as object) }) as StudioDataset["offers"][number]);
  return { ...rest, sessions, offers, source: "live", pings, devices: devices ?? [] };
}

export function useStudioDataset(source: StudioSource): { data: StudioDataset | null; loading: boolean; error: unknown; refresh: () => void } {
  const range = useMemo(() => liveRange(), []);
  const live = useAdminData<LivePayload>(source === "live" ? `/admin/insights/studio-dataset?from=${range.from}&to=${range.to}` : null, [source]);
  const sample = useMemo(() => (source === "sample" ? sampleDataset() : null), [source]);
  const data = useMemo(() => (source === "sample" ? sample : live.data ? fromLive(live.data) : null), [source, sample, live.data]);
  return { data, loading: source === "live" && live.loading, error: source === "live" ? live.error : null, refresh: live.refresh };
}
