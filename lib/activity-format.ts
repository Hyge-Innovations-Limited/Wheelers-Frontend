export function eventBadgeClass(eventType: string): string {
  if (eventType.startsWith("auth_") || eventType === "phone_verified") return "admin-badge blue";
  if (
    eventType.includes("withdrawal_failed") ||
    eventType.includes("CANCELLED") ||
    eventType.includes("cancelled") ||
    eventType.startsWith("account_deleted") ||
    eventType.includes("FAILED") ||
    eventType.includes("rejected") ||
    eventType.includes("REJECTED")
  )
    return "admin-badge red";
  if (
    eventType.startsWith("WALLET") ||
    eventType.startsWith("PAYOUT") ||
    eventType.includes("withdrawal") ||
    eventType.includes("virtual_account") ||
    eventType.startsWith("VIRTUAL")
  )
    return "admin-badge green";
  if (eventType.startsWith("RIDE") || eventType.startsWith("ride_") || eventType.startsWith("scheduled_ride"))
    return "admin-badge orange";
  if (eventType.startsWith("GROUP") || eventType.startsWith("group")) return "admin-badge blue";
  return "admin-badge gray";
}

export function formatEventType(eventType: string): string {
  return eventType.replace(/_/g, " ").toLowerCase();
}

export function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-NG", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function metadataSummary(metadata: Record<string, unknown> | null): string {
  if (!metadata) return "—";
  const parts: string[] = [];
  for (const [key, value] of Object.entries(metadata)) {
    if (value === null || value === undefined || value === "") continue;
    if (typeof value === "object") {
      parts.push(`${key}: ${JSON.stringify(value)}`);
    } else {
      parts.push(`${key}: ${String(value)}`);
    }
    if (parts.length >= 5) break;
  }
  return parts.length ? parts.join(" · ") : "—";
}
