"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { buildQuery } from "@/lib/admin-api";
import type { Bucket, InsightFilters, RideChannel } from "@/lib/admin-api";

/**
 * The Home and Fees filters, kept in the URL so a filtered view is a link an
 * operator can send, and so a KPI card can open the table behind its number
 * with the same filters applied.
 *
 *   range=today|7d|30d|90d|month   or   from=YYYY-MM-DD&to=YYYY-MM-DD (custom)
 *   zone, channel, rideType, bucket
 *   tab, status, sort, dir, q      (the tables section)
 */

export type Preset = "today" | "7d" | "30d" | "90d" | "month" | "custom";

export const PRESETS: Array<{ value: Preset; label: string }> = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "month", label: "This month" },
  { value: "custom", label: "Custom" },
];

const DAY_MS = 86_400_000;
const isDay = (v: string | null): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** Today in Lagos (UTC+1, no daylight saving), YYYY-MM-DD. */
export function lagosToday(): string {
  return new Date(Date.now() + 3_600_000).toISOString().slice(0, 10);
}

export function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

export function rangeFor(preset: Exclude<Preset, "custom">, today = lagosToday()): { from: string; to: string } {
  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "7d":
      return { from: addDays(today, -6), to: today };
    case "90d":
      return { from: addDays(today, -89), to: today };
    case "month":
      return { from: `${today.slice(0, 8)}01`, to: today };
    default:
      return { from: addDays(today, -29), to: today };
  }
}

/** "4 Mar – 10 Mar 2024", or one day on its own. */
export function describeRange(from: string, to: string): string {
  const fmt = (day: string, year: boolean) =>
    new Date(`${day}T12:00:00Z`).toLocaleDateString("en-NG", { day: "numeric", month: "short", ...(year ? { year: "numeric" } : {}) });
  if (from === to) return fmt(from, true);
  return `${fmt(from, from.slice(0, 4) !== to.slice(0, 4))} – ${fmt(to, true)}`;
}

/** Just the ride filters, as a query string for the API. */
export function filtersQuery(f: InsightFilters, extra: Record<string, string | number | undefined | null> = {}): string {
  return buildQuery({ from: f.from, to: f.to, zone: f.zone, channel: f.channel, rideType: f.rideType, driverId: f.driverId, riderId: f.riderId, ...extra });
}

export function useInsightParams() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const preset: Preset = useMemo(() => {
    const raw = params.get("range");
    if (isDay(params.get("from")) && isDay(params.get("to"))) return "custom";
    return (PRESETS.some((p) => p.value === raw) ? raw : "30d") as Preset;
  }, [params]);

  const filters: InsightFilters = useMemo(() => {
    const range = preset === "custom"
      ? { from: params.get("from")!, to: params.get("to")! }
      : rangeFor(preset);
    return {
      ...range,
      zone: params.get("zone") || undefined,
      channel: (params.get("channel") as RideChannel | null) || undefined,
      rideType: (params.get("rideType") as "single" | "group" | null) || undefined,
      driverId: params.get("driverId") || undefined,
      riderId: params.get("riderId") || undefined,
    };
  }, [params, preset]);

  const bucket: Bucket = (["day", "week", "month"] as const).find((b) => b === params.get("bucket"))
    ?? (filters.from <= addDays(filters.to, -120) ? "week" : "day");

  /** The URL with some parameters changed; null removes one. */
  const hrefWith = useCallback(
    (patch: Record<string, string | null | undefined>, hash = "") => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === undefined || value === "") next.delete(key);
        else next.set(key, value);
      }
      const qs = next.toString();
      return `${pathname}${qs ? `?${qs}` : ""}${hash}`;
    },
    [params, pathname],
  );

  const set = useCallback(
    (patch: Record<string, string | null | undefined>) => router.replace(hrefWith(patch), { scroll: false }),
    [router, hrefWith],
  );

  const setPreset = useCallback(
    (next: Preset) => {
      if (next === "custom") {
        const { from, to } = filters;
        set({ range: null, from, to });
      } else set({ range: next === "30d" ? null : next, from: null, to: null });
    },
    [filters, set],
  );

  return { params, filters, preset, bucket, set, setPreset, hrefWith };
}
