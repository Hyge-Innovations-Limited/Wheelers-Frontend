/**
 * The Studio dataset (Timi, 18 Nov 2026): one contract for the Analytics Studio page and, later, the server endpoint
 * and the Excel / Power BI pack. Until the endpoint exists the page runs on a seeded sample that follows it
 * (lib/studio/sample.ts); switching to real data is one data source change (lib/studio/source.ts).
 *
 * Grain: a SESSION is one opened booking (one ride request, an attempt of an intent). An INTENT is one need to travel,
 * across retries. A PING is one driver sent the request; an OFFER is a driver's bid (one per bidding ping). Money and
 * supply rows are per day.
 */

export const CHANNELS = ['App', 'WhatsApp', 'Claude'] as const;
export const RIDE_CLASSES = ['Economy', 'Comfort', 'XL'] as const;
export const RIDER_TYPES = ['Student', 'Young professional', 'Business', 'Occasional'] as const;
export const WEATHERS = ['Clear', 'Light rain', 'Heavy rain'] as const;
export const DAY_PARTS = ['Night 00–05', 'Morning 06–09', 'Midday 10–15', 'Evening 16–19', 'Night 20–23'] as const;
export const ZONES = ['Yaba', 'Lagos Island', 'Outside zones'] as const;
export const VARIANTS = ['Control (40s)', 'Treatment (60s)'] as const;
export const FARE_SIZES = ['Under ₦3k', '₦3–5k', '₦5–10k', '₦10–15k', '₦15k+'] as const;
export const JOINED_VIA = ['App', 'WhatsApp', 'Claude'] as const;
export const PROMOS = ['First-ride promo', 'Rain promo', 'No promo'] as const;
/** The Promo filter: a promo on the ride, or how the rider was onboarded. */
export const PROMO_FILTER = [...PROMOS, 'Onboarded with promo', 'Onboarded without promo'] as const;
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export const OUTCOMES = ['Completed', 'Cancelled after match', 'Rider cancelled', 'Search timed out', 'Left before search'] as const;
export const INTENT_ENDS = ['Got a ride', 'Gave up negotiating', 'Match fell through', 'Gave up after timeout', 'Left before search'] as const;
export const ABANDON_STAGES = ['After destination', 'After fare shown', 'After pickup'] as const;
export const OFFER_STATUSES = ['Accepted', 'Rejected', 'Expired', 'Lost to other driver', 'Voided by price change', 'Withdrawn', 'Search timed out'] as const;
export const PRICE_TRIGGERS = ['No offers came in', 'Offers above their price', 'Matched lowest counter', 'Got takers, tried lower'] as const;
export const PAY_METHODS = ['Card (Paystack)', 'Bank transfer', 'Wallet', 'Cash'] as const;
export const CAR_OWNERSHIP = ['Owns car', 'Hire purchase', 'Rented'] as const;
export const DECLINE_REASONS = ['Too far', 'Price too low', 'Ending shift', 'Heading elsewhere', 'Wants cash', 'Low rider rating'] as const;
export const PING_ACTIONS = ['Never opened', 'Opened, ignored', 'Declined', 'Countered', 'Took rider price'] as const;
export const LAST_TRIP_ENDS = ['Completed', 'Rider cancelled', 'Driver cancelled', 'Rider no-show'] as const;
export const LEDGER_TYPES = ['Trip earnings', 'Cash booking fee owed', 'Withdrawals', 'Withdrawal fees', 'Failed withdrawals'] as const;

export type Channel = (typeof CHANNELS)[number];
export type RideClass = (typeof RIDE_CLASSES)[number];
export type RiderType = (typeof RIDER_TYPES)[number];
export type Weather = (typeof WEATHERS)[number];
export type DayPart = (typeof DAY_PARTS)[number];
export type Zone = (typeof ZONES)[number];
export type Variant = (typeof VARIANTS)[number];
export type FareSize = (typeof FARE_SIZES)[number];
export type Promo = (typeof PROMOS)[number];
export type Weekday = (typeof WEEKDAYS)[number];
export type Outcome = (typeof OUTCOMES)[number];
export type IntentEnd = (typeof INTENT_ENDS)[number];
export type AbandonStage = (typeof ABANDON_STAGES)[number];
export type OfferStatus = (typeof OFFER_STATUSES)[number];
export type PriceTrigger = (typeof PRICE_TRIGGERS)[number];
export type PayMethod = (typeof PAY_METHODS)[number];
export type CarOwnership = (typeof CAR_OWNERSHIP)[number];
export type DeclineReason = (typeof DECLINE_REASONS)[number];
export type PingAction = (typeof PING_ACTIONS)[number];
export type LastTripEnd = (typeof LAST_TRIP_ENDS)[number];
export type LedgerType = (typeof LEDGER_TYPES)[number];

export interface StudioTrip {
  status: 'Completed' | 'Cancelled after match';
  cancelledBy: 'rider' | 'driver' | null;
  reason: string | null;
  /** Minutes late against the quoted ETA (negative: early). Null when the driver never arrived. */
  pickupDelayMin: number | null;
  fareNgn: number;
  paid: boolean | null;
  method: PayMethod | null;
  /** The rider's rating of the driver, 1–5. */
  rating: number | null;
}

export interface StudioSession {
  id: string;
  /** Lagos day, YYYY-MM-DD. */
  date: string;
  /** Lagos hour 0–23 the session opened. */
  hour: number;
  weekday: Weekday;
  dayPart: DayPart;
  channel: Channel;
  rideClass: RideClass;
  riderId: string;
  riderType: RiderType;
  joinedVia: Channel;
  onboardedWithPromo: boolean;
  weather: Weather;
  zone: Zone;
  destZone: Zone;
  variant: Variant;
  promo: Promo;
  intentId: string;
  /** 1 = first try of the intent. */
  attempt: number;
  km: number;
  suggestedNgn: number;
  fareSize: FareSize;
  /** Null: left before searching. */
  openingNgn: number | null;
  finalNgn: number | null;
  agreedNgn: number | null;
  outcome: Outcome;
  reason: string | null;
  abandonStage: AbandonStage | null;
  /** Free drivers within 6.5 km when the search started. */
  freeDrivers: number;
  rounds: number;
  pinged: number;
  offersReceived: number;
  firstOfferSec: number | null;
  matchSec: number | null;
  /** Seconds from the first offer on screen to the accept. */
  decisionSec: number | null;
  /** Offers on screen at the moment of choice. */
  offersOnScreen: number | null;
  /** First open of the intent to the trip start, minutes (the completed attempt only). */
  minutesToRide: number | null;
  bookingFeeNgn: number;
  commissionNgn: number;
  processorFeeNgn: number;
  messagingCostNgn: number;
  refundNgn: number;
  wheelersNetNgn: number;
  fuelNgn: number;
  trip: StudioTrip | null;
}

export interface StudioOffer {
  id: string;
  sessionId: string;
  driverId: string;
  priceNgn: number;
  /** The rider's price when the driver answered. */
  riderPriceNgn: number;
  /** Above the rider's price at the time, % (0 = took the rider's price). */
  gapToRiderPct: number;
  /** Against our suggested fare, %. */
  gapToSuggestedPct: number;
  round: number;
  status: OfferStatus;
  /** Position on the rider's screen at the moment of choice; null when no choice was made. */
  listPos: number | null;
  cheapest: boolean | null;
  premiumNgn: number | null;
  latencySec: number;
  profileViewed: boolean;
  driverRating: number;
  pickupKm: number;
}

export interface StudioPing {
  sessionId: string;
  driverId: string;
  ownership: CarOwnership;
  driverRating: number;
  pickupKm: number;
  delivered: boolean;
  seen: boolean;
  action: PingAction;
  declineReason: DeclineReason | null;
  /** How the driver's previous trip ended. */
  lastTripEnd: LastTripEnd;
  /** The rider's price against our suggested fare when pinged, %. */
  riderVsSuggestedPct: number;
  /** The offer's gap to the suggested fare, %, when they bid. */
  bidVsSuggestedPct: number | null;
}

export interface StudioPriceChange {
  sessionId: string;
  direction: 'Raise' | 'Drop';
  fromNgn: number;
  toNgn: number;
  trigger: PriceTrigger;
}

export interface StudioPayment {
  sessionId: string;
  date: string;
  method: PayMethod;
  success: boolean;
  amountNgn: number;
}

export interface StudioShiftDay {
  date: string;
  onlineHours: number;
  tripHours: number;
}

export interface StudioLedgerRow {
  date: string;
  type: LedgerType;
  amountNgn: number;
}

export interface StudioDataset {
  /** 'sample' until the endpoint exists. */
  source: 'sample' | 'live';
  from: string;
  to: string;
  sessions: StudioSession[];
  offers: StudioOffer[];
  pings: StudioPing[];
  priceChanges: StudioPriceChange[];
  payments: StudioPayment[];
  shifts: StudioShiftDay[];
  ledger: StudioLedgerRow[];
}

// ── Bands, shared by the charts and the filters ──────────────────────────

export function dayPartOf(hour: number): DayPart {
  if (hour <= 5) return 'Night 00–05';
  if (hour <= 9) return 'Morning 06–09';
  if (hour <= 15) return 'Midday 10–15';
  if (hour <= 19) return 'Evening 16–19';
  return 'Night 20–23';
}

export function fareSizeOf(ngn: number): FareSize {
  if (ngn < 3000) return 'Under ₦3k';
  if (ngn < 5000) return '₦3–5k';
  if (ngn < 10000) return '₦5–10k';
  if (ngn < 15000) return '₦10–15k';
  return '₦15k+';
}

export const OPENING_BANDS = ['20%+ below sugg', '10-20% below', '0-10% below', '0-10% above', '10%+ above'] as const;
export function openingBandOf(openingNgn: number, suggestedNgn: number): (typeof OPENING_BANDS)[number] {
  const d = (openingNgn / suggestedNgn - 1) * 100;
  if (d <= -20) return '20%+ below sugg';
  if (d <= -10) return '10-20% below';
  if (d < 0) return '0-10% below';
  if (d < 10) return '0-10% above';
  return '10%+ above';
}

export const MOVE_BANDS = ['Lowered', 'No change', '+1-10%', '+10-20%', '+20-30%', '+30%+'] as const;
export function moveBandOf(openingNgn: number, finalNgn: number): (typeof MOVE_BANDS)[number] {
  const d = (finalNgn / openingNgn - 1) * 100;
  if (d < -0.5) return 'Lowered';
  if (d < 0.5) return 'No change';
  if (d < 10) return '+1-10%';
  if (d < 20) return '+10-20%';
  if (d < 30) return '+20-30%';
  return '+30%+';
}

export const FREE_BANDS = ['0-2 free', '3-5 free', '6-10 free', '11+ free'] as const;
export function freeBandOf(n: number): (typeof FREE_BANDS)[number] {
  if (n <= 2) return '0-2 free';
  if (n <= 5) return '3-5 free';
  if (n <= 10) return '6-10 free';
  return '11+ free';
}

export const GAP_BANDS = ['At rider price', '+0-5%', '+5-10%', '+10-15%', '+15-20%', '+20-30%', '+30%+'] as const;
export function gapBandOf(pct: number): (typeof GAP_BANDS)[number] {
  if (pct < 0.5) return 'At rider price';
  if (pct < 5) return '+0-5%';
  if (pct < 10) return '+5-10%';
  if (pct < 15) return '+10-15%';
  if (pct < 20) return '+15-20%';
  if (pct < 30) return '+20-30%';
  return '+30%+';
}

export const RIDER_PRICE_BANDS = ['20%+ below', '10-20% below', '0-10% below', '0-10% above', '10-20% above', '20%+ above'] as const;
export function riderPriceBandOf(pct: number): (typeof RIDER_PRICE_BANDS)[number] {
  if (pct <= -20) return '20%+ below';
  if (pct <= -10) return '10-20% below';
  if (pct < 0) return '0-10% below';
  if (pct < 10) return '0-10% above';
  if (pct < 20) return '10-20% above';
  return '20%+ above';
}

export const OFFER_VS_SUGGESTED_BANDS = ['Below suggested', '0-5% above', '5-10%', '10-20%', '20-35%', '35%+'] as const;
export function offerVsSuggestedBandOf(pct: number): (typeof OFFER_VS_SUGGESTED_BANDS)[number] {
  if (pct < 0) return 'Below suggested';
  if (pct < 5) return '0-5% above';
  if (pct < 10) return '5-10%';
  if (pct < 20) return '10-20%';
  if (pct < 35) return '20-35%';
  return '35%+';
}

export const RATING_BANDS = ['Under 4.3★', '4.3-4.6★', '4.6-4.8★', '4.8★+'] as const;
export function ratingBandOf(r: number): (typeof RATING_BANDS)[number] {
  if (r < 4.3) return 'Under 4.3★';
  if (r < 4.6) return '4.3-4.6★';
  if (r < 4.8) return '4.6-4.8★';
  return '4.8★+';
}

export const PICKUP_BANDS = ['Under 1.5 km', '1.5-3 km', '3-4.5 km', '4.5+ km'] as const;
export function pickupBandOf(km: number): (typeof PICKUP_BANDS)[number] {
  if (km < 1.5) return 'Under 1.5 km';
  if (km < 3) return '1.5-3 km';
  if (km < 4.5) return '3-4.5 km';
  return '4.5+ km';
}

export const ROUND_BANDS = ['1 round', '2 rounds', '3 rounds', '4 rounds', '5+ rounds'] as const;
export function roundBandOf(n: number): (typeof ROUND_BANDS)[number] {
  return n >= 5 ? '5+ rounds' : (`${n} round${n === 1 ? '' : 's'}` as (typeof ROUND_BANDS)[number]);
}

export const SCREEN_BANDS = ['1 offer', '2 offers', '3 offers', '4+ offers'] as const;
export function screenBandOf(n: number): (typeof SCREEN_BANDS)[number] {
  return n >= 4 ? '4+ offers' : (`${n} offer${n === 1 ? '' : 's'}` as (typeof SCREEN_BANDS)[number]);
}

export const LATENESS_BANDS = ['Early or on time', '0-3 min late', '3-6 min late', '6+ min late'] as const;
export function latenessBandOf(min: number): (typeof LATENESS_BANDS)[number] {
  if (min <= 0) return 'Early or on time';
  if (min <= 3) return '0-3 min late';
  if (min <= 6) return '3-6 min late';
  return '6+ min late';
}

/** Searched: the rider got as far as sending the request. */
export const searched = (s: StudioSession): boolean => s.outcome !== 'Left before search';
/** Matched: a driver was booked (whatever happened after). */
export const matched = (s: StudioSession): boolean => s.outcome === 'Completed' || s.outcome === 'Cancelled after match';
