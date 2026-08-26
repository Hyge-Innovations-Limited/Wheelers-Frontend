/**
 * One home for the formatters. `formatNaira` used to be copy-pasted into four
 * pages with different decimal settings, so the same amount rendered three
 * different ways depending on which screen you were on.
 */

export function formatNaira(value: string | number | null | undefined, opts?: { decimals?: boolean }): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "₦0";
  return `₦${n.toLocaleString("en-NG", {
    minimumFractionDigits: opts?.decimals ? 2 : 0,
    maximumFractionDigits: opts?.decimals ? 2 : 0,
  })}`;
}

/** Compact money for stat tiles: ₦86.8M reads better than ₦86,769,200. */
export function formatNairaCompact(value: string | number | null | undefined): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "₦0";
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `₦${(n / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `₦${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 100_000) return `₦${(n / 1_000).toFixed(0)}K`;
  return formatNaira(n);
}

export function formatNumber(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n.toLocaleString("en-NG") : "0";
}

export function formatPercent(value: number | null | undefined, decimals = 1): string {
  const n = Number(value ?? 0);
  return `${(n * 100).toFixed(decimals)}%`;
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-NG", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

/** Relative time, for feeds where "3h ago" beats a timestamp. */
export function formatWhen(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const diff = Date.now() - d.getTime();
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(d);
}

export function formatDuration(seconds: number | null | undefined): string {
  const s = Number(seconds ?? 0);
  if (!Number.isFinite(s) || s <= 0) return "—";
  const mins = Math.round(s / 60);
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ${mins % 60}m`;
}

export function formatDistance(km: number | null | undefined): string {
  const n = Number(km ?? 0);
  if (!Number.isFinite(n) || n <= 0) return "—";
  return `${n.toFixed(1)} km`;
}

/** Maps a domain status onto the badge colours already in admin.css. */
export function statusBadgeClass(status: string | null | undefined): string {
  switch ((status ?? "").toUpperCase()) {
    case "COMPLETED":
    case "APPROVED":
    case "VERIFIED":
    case "SETTLED":
    case "ONLINE":
    case "ACTIVE":
      return "admin-badge green";
    case "CANCELLED":
    case "REJECTED":
    case "FAILED":
    case "EXPIRED":
      return "admin-badge red";
    case "PENDING":
    case "SUBMITTED":
    case "PROCESSING":
    case "MATCHING":
    case "REQUESTED":
      return "admin-badge orange";
    case "IN_PROGRESS":
    case "DRIVER_ASSIGNED":
    case "DRIVER_EN_ROUTE":
    case "ARRIVED":
    case "ON_RIDE":
      return "admin-badge blue";
    case "DISPUTED":
      return "admin-badge red";
    default:
      return "admin-badge gray";
  }
}

/** RIDE_PAYMENT → "Ride payment" */
export function humanise(value: string | null | undefined): string {
  if (!value) return "—";
  const spaced = value.replace(/[_-]+/g, " ").toLowerCase().trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function initialsOf(name: string | null | undefined, fallback = "?"): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return fallback;
  const parts = trimmed.split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || fallback;
}

/** Best available label for a person who may have signed up via WhatsApp only. */
export function displayName(user: {
  name?: string | null; username?: string | null; phone?: string | null; email?: string | null;
}): string {
  return user.name?.trim() || user.username || user.phone || user.email || "Unnamed user";
}
