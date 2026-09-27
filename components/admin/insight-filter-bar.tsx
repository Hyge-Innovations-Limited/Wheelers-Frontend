"use client";

import type { Bucket, InsightOptions } from "@/lib/admin-api";
import { PRESETS, describeRange, lagosToday, useInsightParams } from "@/lib/insight-filters";
import { useAdminData } from "@/components/admin/use-admin-data";

/**
 * The period and ride filters for Home and Fees. Everything it sets lives in
 * the URL (see lib/insight-filters.ts), so the page, the tables and the Excel
 * download all read the same thing.
 */
export function InsightFilterBar({ showBucket = true, showRideType = true }: { showBucket?: boolean; showRideType?: boolean }) {
  const { params, filters, preset, bucket, set, setPreset } = useInsightParams();
  const { data: options } = useAdminData<InsightOptions>("/admin/insights/options");
  const today = lagosToday();
  const active = [filters.zone, filters.channel, filters.rideType].filter(Boolean).length;

  return (
    <div className="admin-filter-bar">
      <div className="admin-filter-row">
        <div className="admin-range-tabs" role="group" aria-label="Period">
          {PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              className={`admin-range-tab${p.value === preset ? " active" : ""}`}
              onClick={() => setPreset(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>
        {preset === "custom" ? (
          <div className="admin-date-range">
            <input
              type="date"
              className="admin-date-input"
              aria-label="From"
              value={filters.from}
              max={filters.to}
              onChange={(e) => e.target.value && set({ from: e.target.value, range: null })}
            />
            <span aria-hidden>to</span>
            <input
              type="date"
              className="admin-date-input"
              aria-label="To"
              value={filters.to}
              min={filters.from}
              max={today}
              onChange={(e) => e.target.value && set({ to: e.target.value, range: null })}
            />
          </div>
        ) : (
          <span className="admin-filter-period">{describeRange(filters.from, filters.to)}</span>
        )}
      </div>

      <div className="admin-filter-row">
        <select
          className="admin-select"
          aria-label="Zone"
          value={filters.zone ?? ""}
          onChange={(e) => set({ zone: e.target.value || null })}
        >
          <option value="">All zones</option>
          {(options?.zones ?? []).map((z) => (
            <option key={z.value} value={z.value}>{z.label}</option>
          ))}
        </select>
        <select
          className="admin-select"
          aria-label="Channel"
          value={filters.channel ?? ""}
          onChange={(e) => set({ channel: e.target.value || null })}
        >
          <option value="">All channels</option>
          {(options?.channels ?? []).map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        {showRideType ? (
          <select
            className="admin-select"
            aria-label="Ride type"
            value={filters.rideType ?? ""}
            onChange={(e) => set({ rideType: e.target.value || null })}
          >
            <option value="">Single and group</option>
            {(options?.rideTypes ?? []).map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        ) : null}
        {showBucket ? (
          <select
            className="admin-select"
            aria-label="Group charts by"
            value={bucket}
            onChange={(e) => set({ bucket: e.target.value as Bucket })}
          >
            <option value="day">By day</option>
            <option value="week">By week</option>
            <option value="month">By month</option>
          </select>
        ) : null}
        {active > 0 || params.get("driverId") || params.get("riderId") ? (
          <button
            type="button"
            className="admin-link-btn"
            onClick={() => set({ zone: null, channel: null, rideType: null, driverId: null, riderId: null })}
          >
            Clear filters
          </button>
        ) : null}
      </div>
    </div>
  );
}
