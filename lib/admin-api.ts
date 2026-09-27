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

/* ── Usage: what the backend asks other people's servers to do ─────────── */

export interface ServiceDayUsage { day: string; calls: number; failed: number; avgMs: number | null }
export interface ServiceUsage {
  key: string;
  label: string;
  /** That vendor's own console, where the bill is. */
  console: string;
  pricing: string;
  today: ServiceDayUsage;
  /** Oldest first, zeros where nothing happened. */
  days: ServiceDayUsage[];
  totalCalls: number;
  totalFailed: number;
}

export function fetchServiceUsage(days: number): Promise<{ days: number; services: ServiceUsage[] }> {
  return adminJson(`/admin/usage/services?days=${days}`);
}

/* ── Home analytics and the Fees page (/admin/insights, /admin/fees) ──────── */

export type RideChannel = "APP" | "WHATSAPP" | "MCP" | "UNKNOWN";
export type Bucket = "day" | "week" | "month";

/** Every analytics endpoint takes these, as query parameters. Dates are Lagos days, both included. */
export interface InsightFilters {
  from: string;
  to: string;
  zone?: string;
  channel?: RideChannel;
  rideType?: "single" | "group";
  driverId?: string;
  riderId?: string;
}

export interface InsightOptions {
  zones: Array<{ value: string; label: string }>;
  channels: Array<{ value: RideChannel; label: string }>;
  rideTypes: Array<{ value: "single" | "group"; label: string }>;
  today: string;
}

export interface Kpis {
  requests: number;
  completed: number;
  cancelled: number;
  cancelledNoDriver: number;
  cancelledBeforeMatch: number;
  cancelledAfterMatch: number;
  disputed: number;
  matchRate: number | null;
  gmvNgn: number;
  avgFareNgn: number | null;
  medianFareNgn: number | null;
  distanceKm: number;
  commissionNgn: number;
  serviceFeeNgn: number;
  stateLevyNgn: number;
  depositFeesNgn: number;
  platformRevenueNgn: number;
  driverPayoutsNgn: number;
  activeDrivers: number;
  activeRiders: number;
  /** Hours drivers spent on shift in the period. Only the driver filter narrows it. */
  driverOnlineHours: number;
  driversOnShift: number;
  avgOnlineHoursPerDriver: number | null;
  /** Null under a zone, channel, ride type or rider filter. */
  tripsPerOnlineHour: number | null;
  ridesWithBids: number;
  ridesWithAcceptedBid: number;
  bidAcceptanceRate: number | null;
  avgBidsPerRide: number | null;
  medianSecondsToFirstBid: number | null;
  depositsNgn: number;
  depositCount: number;
  withdrawalsNgn: number;
  withdrawalCount: number;
  refundsNgn: number;
  newUsers: number;
  newRiders: number;
  newDrivers: number;
}

export interface InsightSummary {
  filters: InsightFilters;
  days: number;
  previous: { from: string; to: string };
  current: Kpis;
  previousKpis: Kpis;
  snapshot: {
    driversOnShiftNow: number;
    /** Hours online are counted from here. Null before the first shift was recorded. */
    shiftsRecordedFrom: string | null;
    inFlight: number;
    walletFloatNgn: number;
    walletLockedNgn: number;
    platformWalletNgn: number;
  };
}

export interface HourPoint {
  /** Hour of the day in Lagos, 0 to 23. */
  hour: number;
  requests: number;
  completed: number;
  noDriver: number;
  matchRate: number | null;
  gmvNgn: number;
  driverHours: number;
  /** Drivers on shift during this hour on an average day. Null when supply is not shown. */
  avgDriversOnline: number | null;
  requestsPerDriver: number | null;
}

export interface WeekdayPoint extends Omit<HourPoint, "hour"> {
  /** 1 Monday to 7 Sunday. */
  weekday: number;
  label: string;
}

export interface HoursResponse {
  filters: InsightFilters;
  hours: HourPoint[];
  weekdays: WeekdayPoint[];
  /** Requests by weekday (row, Monday first) and hour (column). */
  grid: number[][];
  peakHour: number | null;
  peakWeekday: number | null;
  tightestHour: number | null;
  supply: { shown: boolean; recordedFrom: string | null };
}

export interface InsightPoint {
  bucket: string;
  requests: number;
  completed: number;
  cancelled: number;
  gmvNgn: number;
  commissionNgn: number;
  serviceFeeNgn: number;
  stateLevyNgn: number;
  depositFeesNgn: number;
  depositsNgn: number;
  newUsers: number;
}

export interface BreakdownRow {
  key: string;
  label: string;
  requests: number;
  completed: number;
  cancelled: number;
  gmvNgn: number;
}

export type TripStatusFilter = "all" | "completed" | "cancelled" | "no_driver" | "disputed" | "active" | "open";

export interface TripRow {
  id: string;
  createdAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  status: string;
  channel: RideChannel;
  rideType: "single" | "group";
  pickupZone: string | null;
  destZone: string | null;
  pickupAddress: string;
  destAddress: string;
  riderId: string;
  riderName: string | null;
  riderPhone: string | null;
  driverId: string | null;
  driverName: string | null;
  driverPhone: string | null;
  fareNgn: number | null;
  commissionNgn: number | null;
  serviceFeeNgn: number | null;
  stateLevyNgn: number | null;
  platformTotalNgn: number | null;
  driverPayoutNgn: number | null;
  feeSplitEstimated: boolean;
  distanceKm: number | null;
  durationSeconds: number | null;
  bids: number;
  cancelReason: string | null;
}

export interface InsightDriverRow {
  driverId: string;
  userId: string;
  name: string | null;
  phone: string | null;
  status: string;
  kycStatus: string;
  trips: number;
  gmvNgn: number;
  earningsNgn: number;
  commissionNgn: number;
  avgFareNgn: number | null;
  bids: number;
  bidsWon: number;
  bidWinRate: number | null;
  lastTripAt: string | null;
  onlineHours: number;
  shifts: number;
  tripsPerOnlineHour: number | null;
  lastOnlineAt: string | null;
}

export interface InsightRiderRow {
  riderId: string;
  name: string | null;
  phone: string | null;
  joinedAt: string;
  requests: number;
  trips: number;
  cancelled: number;
  spendNgn: number;
  avgFareNgn: number | null;
  topChannel: RideChannel | null;
  lastRequestAt: string | null;
  walletBalanceNgn: number;
}

export interface FeeTotals {
  commissionNgn: number;
  serviceFeeNgn: number;
  depositFeesNgn: number;
  incomeNgn: number;
  stateLevyNgn: number;
  depositProviderCostNgn: number;
  transferCostNgn: number;
  otherProviderCostNgn: number;
  costsNgn: number;
  netNgn: number;
  feeRides: number;
  deposits: number;
  transfers: number;
  estimatedCommissionNgn: number;
}

export interface FeePoint {
  bucket: string;
  commissionNgn: number;
  serviceFeeNgn: number;
  depositFeesNgn: number;
  incomeNgn: number;
  stateLevyNgn: number;
  depositProviderCostNgn: number;
  transferCostNgn: number;
  otherProviderCostNgn: number;
  costsNgn: number;
  netNgn: number;
}

export interface FeesSummary {
  filters: InsightFilters;
  /** A zone, channel or person filter is on: deposit fees and platform costs belong to no ride, so they are left out. */
  rideFiltersApplied: boolean;
  bucket: Bucket;
  totals: FeeTotals;
  previousTotals: FeeTotals;
  previous: { from: string; to: string };
  points: FeePoint[];
  platformWalletNgn: number;
}

export type FeeKind = "ride_fee" | "deposit_fee" | "deposit_provider_fee" | "transfer_fee" | "provider_fee";

export interface FeeLedgerRow {
  id: string;
  createdAt: string;
  kind: FeeKind;
  label: string;
  direction: "CREDIT" | "DEBIT";
  amountNgn: number;
  referenceId: string | null;
  commissionNgn: number | null;
  serviceFeeNgn: number | null;
  stateLevyNgn: number | null;
}

export interface DepositRow {
  id: string;
  createdAt: string;
  userId: string;
  name: string | null;
  phone: string | null;
  grossNgn: number | null;
  feeNgn: number | null;
  providerFeeNgn: number | null;
  creditedNgn: number;
  senderName: string | null;
  senderBank: string | null;
  reference: string | null;
}

export interface WithdrawalRow {
  id: string;
  createdAt: string;
  settledAt: string | null;
  userId: string;
  name: string | null;
  phone: string | null;
  status: string;
  amountNgn: number;
  transferFeeNgn: number | null;
  accountName: string;
  accountEnding: string;
  failureReason: string | null;
}

export interface ReconcileCheck {
  key: string;
  label: string;
  left: { label: string; value: number };
  right: { label: string; value: number };
  diff: number;
  ok: boolean;
}

/**
 * Download a file from the admin API with the admin's token, and save it under
 * the name the server gives (or the fallback). A plain link cannot carry the
 * Authorization header, so the file is fetched and handed to the browser.
 */
export async function adminDownload(path: string, fallbackName: string): Promise<void> {
  let res: Response;
  try {
    res = await adminFetch(path);
  } catch {
    throw new AdminApiError("Cannot reach the Wheelers API. Check your connection.", 0);
  }
  if (!res.ok) {
    let message = `Download failed (HTTP ${res.status})`;
    try {
      const body = (await res.json()) as { error?: unknown };
      if (typeof body.error === "string") message = body.error;
    } catch {
      /* not JSON */
    }
    throw new AdminApiError(message, res.status);
  }
  const disposition = res.headers.get("content-disposition") ?? "";
  const name = /filename="([^"]+)"/.exec(disposition)?.[1] ?? fallbackName;
  const url = URL.createObjectURL(await res.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
