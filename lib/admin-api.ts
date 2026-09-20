const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "https://app.wheelersng.com";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("wheelers_admin_token");
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("wheelers_admin_token");
  localStorage.removeItem("wheelers_admin_user");
}

export async function adminFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...((init?.headers as Record<string, string>) ?? {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return fetch(`${API_BASE}${path}`, { ...init, headers });
}

/** Thrown for any non-2xx response, carrying the backend's own message. */
export class AdminApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AdminApiError";
  }

  /** An expired or revoked admin session, as opposed to a real failure. */
  get isAuthError(): boolean {
    return this.status === 401 || this.status === 403;
  }
}

/**
 * Every panel page used to hand-roll try/catch, ignore `res.ok`, and render
 * "Failed to load" for an expired session with no way to tell the difference.
 * One typed helper instead: it surfaces the backend's own message, and flags an
 * expired session distinctly so the UI can send the operator back to login.
 */
export async function adminJson<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await adminFetch(path, init);
  } catch {
    throw new AdminApiError("Cannot reach the Wheelers API. Check your connection.", 0);
  }

  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
  }

  if (!res.ok) {
    const message =
      parsed && typeof parsed === "object" && typeof (parsed as { error?: unknown }).error === "string"
        ? (parsed as { error: string }).error
        : `Request failed (HTTP ${res.status})`;
    throw new AdminApiError(message, res.status);
  }

  return parsed as T;
}

export function buildQuery(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

/* ── shared response types ─────────────────────────────────────────────── */

export interface OverviewResponse {
  users: {
    total: number; riders: number; drivers: number;
    newToday: number; new7d: number; new30d: number; kycVerified: number;
  };
  drivers: {
    total: number; approved: number; online: number; onRide: number;
    new30d: number; pendingKyc: number;
  };
  rides: {
    attempted: number; neverMatched: number; neverMatched30d: number; matchRate: number;
    total: number; completed: number; cancelled: number; disputed: number; active: number;
    byStatus: Record<string, number>;
    today: number; last7d: number; last30d: number;
    completedToday: number; completed7d: number; completed30d: number;
    completionRate: number;
    avgFareNgn: string; avgDistanceKm: number; totalDistanceKm: number; avgDurationSeconds: number;
  };
  money: {
    grossProcessedNgn: string; grossTodayNgn: string; gross7dNgn: string; gross30dNgn: string;
    platformRevenueNgn: string; platformRevenue30dNgn: string;
    depositsNgn: string; deposits30dNgn: string; depositCount: number;
    ridePaymentsNgn: string; driverPayoutsNgn: string; driverPayouts30dNgn: string;
    platformFeesLedgerNgn: string;
    withdrawalsNgn: string; withdrawals30dNgn: string;
    refundsNgn: string; penaltiesNgn: string;
    walletFloatNgn: string; walletLockedNgn: string; platformWalletNgn: string;
    byType: Array<{ type: string; count: number; allTime: string; today: string; last7d: string; last30d: string }>;
  };
  withdrawals: Array<{ status: string; count: number; amountNgn: string }>;
  generatedAt: string;
}

export interface TimeseriesPoint {
  date: string;
  signups: number;
  driverSignups: number;
  ridesRequested: number;
  ridesCompleted: number;
  ridesCancelled: number;
  grossNgn: string;
  platformFeesNgn: string;
  depositsNgn: string;
}

export interface AdminUserRow {
  id: string;
  name: string | null;
  username: string | null;
  email: string | null;
  phone: string | null;
  role: string;
  riderKycStatus: string;
  createdAt: string;
  isDriver: boolean;
  driverId: string | null;
  driverStatus: string | null;
  driverKycStatus: string | null;
  driverRating: number | null;
  driverTotalRides: number | null;
  driverEarningsNgn: string | null;
  vehicle: string | null;
  walletBalanceNgn: string;
  walletLockedNgn: string;
  ridesTotal: number;
  ridesCompleted: number;
  ridesCancelled: number;
  totalSpentNgn: string;
  lastRideAt: string | null;
}

export interface PagedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface AdminRideRow {
  id: string;
  status: string;
  riderId: string;
  riderName: string | null;
  riderPhone: string | null;
  driverId: string | null;
  driverName: string | null;
  pickupAddress: string;
  destAddress: string;
  fareEstimateNgn: string | null;
  fareFinalNgn: string | null;
  platformFeeNgn: string | null;
  distanceKm: number | null;
  durationSeconds: number | null;
  cancelReason: string | null;
  createdAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
}

export interface AdminUserDetail {
  user: {
    id: string; name: string | null; username: string | null; email: string | null;
    phone: string | null; role: string; riderKycStatus: string;
    kycVerifiedAt: string | null; photoUrl: string | null; createdAt: string;
    /** WhatsApp privacy-policy answer. Absent on an older backend. */
    privacyConsent?: "PENDING" | "AGREED" | "DECLINED";
    privacyConsentAt?: string | null;
    referralCode: string | null; referralsMade: number;
  };
  wallet: {
    id: string; balanceNgn: string; lockedNgn: string;
    byType: Array<{ type: string; count: number; totalNgn: string }>;
  } | null;
  virtualAccount: { bankName: string; accountNumber: string; accountName: string; status: string } | null;
  driver: {
    id: string; status: string; kycStatus: string; rating: number;
    totalRides: number; totalEarningsNgn: string;
    vehicleMake: string | null; vehicleModel: string | null;
    vehiclePlate: string | null; vehicleYear: number | null;
    lastSeenAt: string | null;
    rides: { total: number; completed: number; cancelled: number; byStatus: Record<string, number> };
  } | null;
  rides: {
    total: number; completed: number; cancelled: number; active: number;
    byStatus: Record<string, number>;
    totalSpentNgn: string; avgFareNgn: string;
    totalDistanceKm: number; avgDistanceKm: number;
  };
  recentRides: Array<{
    id: string; status: string; pickupAddress: string; destAddress: string;
    fareEstimateNgn: string | null; fareFinalNgn: string | null; distanceKm: number | null;
    cancelReason: string | null; createdAt: string; completedAt: string | null; driverId: string | null;
  }>;
  driverRecentRides: Array<{
    id: string; status: string; pickupAddress: string; destAddress: string;
    fareFinalNgn: string | null; platformFeeNgn: string | null; distanceKm: number | null;
    createdAt: string; completedAt: string | null;
  }>;
  transactions: Array<{
    id: string; type: string; direction: string; amountNgn: string;
    balanceAfterNgn: string; referenceId: string; createdAt: string;
  }>;
  withdrawals: Array<{
    id: string; status: string; amountNgn: string; bankAccountNumber: string;
    bankAccountName: string; failureReason: string | null; createdAt: string; settledAt: string | null;
  }>;
  /** What stands between this user and a withdrawal. Null on an older backend. */
  security?: {
    hasPin: boolean;
    /** Decided by the server's clock, not the browser's. */
    withdrawalsFrozen: boolean;
    withdrawalsRestricted: boolean;
    pinLockedUntil: string | null;
    withdrawalsFrozenUntil: string | null;
    withdrawalsFrozenReason: string | null;
    withdrawalsRestrictedUntil: string | null;
  } | null;
  activity: {
    items: Array<{
      id: string; eventType: string; source: string; rideId: string | null;
      metadata: unknown; occurredAt: string;
    }>;
    nextCursor: string | null;
  };
}

export interface GroupRideMetrics {
  total: number; today: number; last7d: number; last30d: number;
  byStatus: Record<string, number>;
  funnel: Array<{ step: string; count: number }>;
  awaitingSelfie: number; expired: number; cancelled: number;
  matchRate: number; bookingRate: number; selfieDropOffRate: number;
  faceVerification: { stored: number; uploading: number; failed: number };
  groups: { formed: number; avgSize: number; maxSize: number; ridersGrouped: number };
  avgSecondsToGroup: number;
  bookedValueNgn: string; avgSeatFareNgn: string;
}

/**
 * A driver who has submitted KYC and is waiting on a human. `GET /admin/drivers`
 * returns these oldest-submission-first — it is a queue, and whoever has been
 * waiting longest is who to deal with next.
 */
export interface PendingDriverRow {
  driverId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  vehicleMake: string | null;
  vehicleModel: string | null;
  vehiclePlate: string | null;
  vehicleYear: number | null;
  status: string;
  submittedAt: string | null;
}


/* ── Safety alerts ─────────────────────────────────────────────────────────
 *
 * The emergency button, from the operator's side. Every other type in this
 * file describes how the business is doing; these describe whether someone is
 * in trouble right now, which is why they get their own polling path and their
 * own place in the nav.
 */

export type SafetyAlertStatus = "OPEN" | "ACKNOWLEDGED" | "RESOLVED" | "CANCELLED";

export type SafetyAlertKind =
  | "SOS"
  | "UNSAFE_DRIVING"
  | "ROUTE_DEVIATION"
  | "ACCIDENT"
  | "MEDICAL";

export interface SafetyAlertRow {
  id: string;
  status: SafetyAlertStatus;
  kind: SafetyAlertKind;
  raisedByRole: "RIDER" | "DRIVER";
  rideId: string | null;
  interstateDepartureId: string | null;
  counterpartUserId: string | null;
  lat: number | null;
  lng: number | null;
  address: string | null;
  note: string | null;
  handledBy: string | null;
  resolution: string | null;
  createdAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  cancelledAt: string | null;
  user: {
    id: string;
    name: string | null;
    username: string | null;
    phone: string | null;
    email: string | null;
    photoUrl: string | null;
    role: string;
  };
}

export interface SafetyAlertCounts {
  open: number;
  acknowledged: number;
  resolved: number;
  cancelled: number;
  /** Everything still waiting on a human — what the nav badge shows. */
  live: number;
}

export interface SafetyAlertsResponse {
  items: SafetyAlertRow[];
  counts: SafetyAlertCounts;
}

export function fetchAlerts(status: string): Promise<SafetyAlertsResponse> {
  return adminJson<SafetyAlertsResponse>(`/admin/alerts${buildQuery({ status })}`);
}

export function fetchAlertCounts(): Promise<SafetyAlertCounts> {
  return adminJson<SafetyAlertCounts>("/admin/alerts/count");
}

export function acknowledgeAlert(id: string): Promise<{ alert: SafetyAlertRow }> {
  return adminJson<{ alert: SafetyAlertRow }>(
    `/admin/alerts/${encodeURIComponent(id)}/acknowledge`,
    { method: "POST" },
  );
}

export function resolveAlert(
  id: string,
  resolution: string,
): Promise<{ alert: SafetyAlertRow }> {
  return adminJson<{ alert: SafetyAlertRow }>(
    `/admin/alerts/${encodeURIComponent(id)}/resolve`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ resolution }),
    },
  );
}

export function describeAlertKind(kind: SafetyAlertKind): string {
  switch (kind) {
    case "SOS":
      return "SOS — needs help now";
    case "UNSAFE_DRIVING":
      return "Unsafe driving";
    case "ROUTE_DEVIATION":
      return "Off the route";
    case "ACCIDENT":
      return "Accident";
    case "MEDICAL":
      return "Medical emergency";
    default:
      return kind;
  }
}

/* ── withdrawal freeze ─────────────────────────────────────────────────── */

export interface WithdrawalFreezeResult {
  userId: string;
  withdrawalsFrozenUntil: string | null;
  withdrawalsFrozenReason: string | null;
}

/** For the call that starts "my phone was stolen". Only an admin can undo it. */
export function setWithdrawalFreeze(userId: string, frozen: boolean): Promise<WithdrawalFreezeResult> {
  return adminJson(
    `/admin/users/${encodeURIComponent(userId)}/withdrawals/${frozen ? "freeze" : "unfreeze"}`,
    { method: "POST" },
  );
}

/* ── live map + dispatch ───────────────────────────────────────────────── */

export type DriverPresence = "on_trip" | "online" | "stale" | "standby" | "offline";

export interface LiveDriver {
  id: string;
  userId: string;
  name: string;
  phone: string | null;
  photoUrl: string | null;
  status: string;
  kycStatus: string;
  presence: DriverPresence;
  lat: number;
  lng: number;
  positionSource: "online" | "standby";
  seenAt: string;
  secondsSinceSeen: number;
  standbyEnabled: boolean;
  vehicle: string | null;
  plate: string | null;
  rating: number;
  totalRides: number;
  ride: {
    id: string; status: string; pickupAddress: string; destAddress: string;
    destLat: number; destLng: number;
  } | null;
}

export interface LiveDriversResponse {
  generatedAt: string;
  summary: { total: number } & Record<DriverPresence, number>;
  drivers: LiveDriver[];
}

export type DispatchOutcome = "accepted" | "declined" | "no_answer" | "unreachable";

export interface DispatchContactRow {
  id: string;
  driverId: string;
  rideId: string | null;
  adminName: string;
  kind: "call" | "nudge";
  outcome: string;
  note: string | null;
  at: string;
}

export interface DispatchCandidate {
  id: string;
  name: string;
  phone: string | null;
  presence: DriverPresence;
  vehicle: string | null;
  plate: string | null;
  distanceKm: number;
  etaMinutes: number;
  secondsSinceSeen: number;
  contacts: DispatchContactRow[];
}

export interface DispatchRide {
  id: string;
  status: string;
  pickupAddress: string;
  destAddress: string;
  pickupLat: number;
  pickupLng: number;
  offerNgn: number | null;
  estimateNgn: number | null;
  distanceKm: number | null;
  bidCount: number;
  waitingSeconds: number;
  nearest: DispatchCandidate[];
}

export interface TrailPoint { lat: number; lng: number; source: "online" | "standby"; at: string }

export function fetchLiveDrivers(): Promise<LiveDriversResponse> {
  return adminJson("/admin/live/drivers");
}

export function fetchDispatch(): Promise<{ generatedAt: string; rides: DispatchRide[] }> {
  return adminJson("/admin/live/dispatch");
}

export function fetchLiveDriver(
  driverId: string,
): Promise<{ driver: LiveDriver | null; contacts: DispatchContactRow[] }> {
  return adminJson(`/admin/live/drivers/${encodeURIComponent(driverId)}`);
}

export function fetchDriverTrail(
  driverId: string,
  minutes: number,
): Promise<{ driverId: string; minutes: number; points: TrailPoint[] }> {
  return adminJson(`/admin/live/drivers/${encodeURIComponent(driverId)}/trail?minutes=${minutes}`);
}

/** A "ride near you" push. The backend refuses a second one within two minutes. */
export function nudgeDriver(driverId: string, rideId?: string | null): Promise<{ contact: DispatchContactRow }> {
  return adminJson(`/admin/live/drivers/${encodeURIComponent(driverId)}/nudge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(rideId ? { rideId } : {}),
  });
}

export function logDriverCall(
  driverId: string,
  input: { outcome: DispatchOutcome; rideId?: string | null; note?: string },
): Promise<{ contact: DispatchContactRow }> {
  return adminJson(`/admin/live/drivers/${encodeURIComponent(driverId)}/contacts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}
