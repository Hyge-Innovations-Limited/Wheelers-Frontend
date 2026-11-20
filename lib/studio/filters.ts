/**
 * One filter engine for the whole Studio: the filter bar's dropdowns and every chart click are the same thing, a
 * PICK (a field = a value). A pick lives at a level: a session pick narrows everything; an offer pick narrows the
 * offer charts only; a ping pick narrows the driver-side charts only (as the mock-up says under each chart).
 * Clicking the same bar again takes its pick off. Every chart is a function of (dataset, filters).
 */
import {
  freeBandOf, gapBandOf, latenessBandOf, moveBandOf, offerVsSuggestedBandOf, openingBandOf, pickupBandOf, ratingBandOf,
  riderPriceBandOf, roundBandOf, screenBandOf,
  type StudioDataset, type StudioOffer, type StudioPing, type StudioSession,
} from './schema';

export type Level = 'session' | 'offer' | 'ping';

export interface Pick {
  key: string;
  value: string;
  level: Level;
}

export interface StudioFilters {
  from: string;
  to: string;
  picks: Pick[];
}

export const NO_FILTERS: StudioFilters = { from: '', to: '', picks: [] };

/** A session's value for a pick key; null: the key does not apply to it. */
const SESSION_FIELDS: Record<string, (s: StudioSession) => string | null> = {
  channel: (s) => s.channel,
  rideClass: (s) => s.rideClass,
  riderType: (s) => s.riderType,
  weather: (s) => s.weather,
  dayPart: (s) => s.dayPart,
  zone: (s) => s.zone,
  variant: (s) => s.variant,
  fareSize: (s) => s.fareSize,
  destZone: (s) => s.destZone,
  joinedVia: (s) => s.joinedVia,
  promo: (s) => s.promo,
  onboarded: (s) => (s.onboardedWithPromo ? 'Onboarded with promo' : 'Onboarded without promo'),
  date: (s) => s.date,
  hour: (s) => `${String(s.hour).padStart(2, '0')}h`,
  weekday: (s) => s.weekday,
  outcome: (s) => s.outcome,
  freeBand: (s) => (s.outcome === 'Left before search' ? null : freeBandOf(s.freeDrivers)),
  openBand: (s) => (s.openingNgn === null ? null : openingBandOf(s.openingNgn, s.suggestedNgn)),
  moveBand: (s) => (s.openingNgn === null || s.finalNgn === null ? null : moveBandOf(s.openingNgn, s.finalNgn)),
  rounds: (s) => (s.rounds > 0 ? roundBandOf(s.rounds) : null),
  onScreen: (s) => (s.offersOnScreen ? screenBandOf(s.offersOnScreen) : null),
  payMethod: (s) => s.trip?.method ?? null,
  lateness: (s) => (s.trip?.pickupDelayMin == null ? null : latenessBandOf(s.trip.pickupDelayMin)),
  // Devices (20 Nov 2026): the rider's device the request came from.
  platform: (s) => s.platform,
  phoneTier: (s) => s.phoneTier,
  signal: (s) => s.signal,
  mobileNetwork: (s) => s.mobileNetwork,
  phoneModel: (s) => s.phoneModel,
  appVersion: (s) => s.appVersion,
  formsOpen: (s) => (s.formsOpen === null ? null : s.formsOpen ? 'Forms open' : "Forms don't open"),
};

const OFFER_FIELDS: Record<string, (o: StudioOffer) => string | null> = {
  gapBand: (o) => gapBandOf(o.gapToRiderPct),
  status: (o) => o.status,
  round: (o) => `R${o.round}`,
  listPos: (o) => (o.listPos ? `Position ${o.listPos}` : null),
  offerVsSuggested: (o) => offerVsSuggestedBandOf(o.gapToSuggestedPct),
  ratingBand: (o) => ratingBandOf(o.driverRating),
  pickupBand: (o) => pickupBandOf(o.pickupKm),
  driverPlatform: (o) => o.driverPlatform,
  driverPhoneTier: (o) => o.driverPhoneTier,
  driverAppVersion: (o) => o.driverAppVersion,
};

const PING_FIELDS: Record<string, (p: StudioPing) => string | null> = {
  riderPriceBand: (p) => riderPriceBandOf(p.riderVsSuggestedPct),
  ownership: (p) => p.ownership,
  pingRating: (p) => ratingBandOf(p.driverRating),
  pingPickup: (p) => pickupBandOf(p.pickupKm),
  declineReason: (p) => p.declineReason,
  lastTripEnd: (p) => p.lastTripEnd,
  pingPlatform: (p) => p.driverPlatform,
  pingPhoneTier: (p) => p.driverPhoneTier,
};

export const sessionValue = (key: string, s: StudioSession) => SESSION_FIELDS[key]?.(s) ?? null;
export const offerValue = (key: string, o: StudioOffer) => OFFER_FIELDS[key]?.(o) ?? null;
export const pingValue = (key: string, p: StudioPing) => PING_FIELDS[key]?.(p) ?? null;

/** Click a bar: on if off, off if it was this value, replaced if another value of the same key. */
export function togglePick(filters: StudioFilters, pick: Pick): StudioFilters {
  const same = filters.picks.find((p) => p.key === pick.key);
  const rest = filters.picks.filter((p) => p.key !== pick.key);
  return { ...filters, picks: same && same.value === pick.value ? rest : [...rest, pick] };
}

/** The filter bar: a dropdown sets its key (or clears it with ''). */
export function setPick(filters: StudioFilters, key: string, value: string, level: Level = 'session'): StudioFilters {
  const rest = filters.picks.filter((p) => p.key !== key);
  return { ...filters, picks: value ? [...rest, { key, value, level }] : rest };
}

export const pickOf = (filters: StudioFilters, key: string): string => filters.picks.find((p) => p.key === key)?.value ?? '';

export interface Filtered {
  /** Every session the filters keep (all levels of session picks). */
  sessions: StudioSession[];
  /** Offers of those sessions, narrowed by offer picks. */
  offers: StudioOffer[];
  /** Pings of those sessions, narrowed by ping picks. */
  pings: StudioPing[];
  /** Only the date range (charts marked "date filter only"). */
  dateOnly: (date: string) => boolean;
  priceChanges: StudioDataset['priceChanges'];
  payments: StudioDataset['payments'];
  /** The devices of the requests and offers kept. */
  devices: StudioDataset['devices'];
}

/**
 * `except`: leave that pick out, as Power BI does for the chart the pick came from: the chart you clicked keeps all
 * its bars (yours highlighted) while every other chart narrows to it.
 */
export function applyFilters(data: StudioDataset, filters: StudioFilters, except?: string): Filtered {
  const dateOnly = (date: string) => (!filters.from || date >= filters.from) && (!filters.to || date <= filters.to);
  const picks = except ? filters.picks.filter((p) => p.key !== except) : filters.picks;
  const sessionPicks = picks.filter((p) => p.level === 'session');
  const offerPicks = picks.filter((p) => p.level === 'offer');
  const pingPicks = picks.filter((p) => p.level === 'ping');
  const sessions = data.sessions.filter((s) => dateOnly(s.date) && sessionPicks.every((p) => sessionValue(p.key, s) === p.value));
  const kept = new Set(sessions.map((s) => s.id));
  const offers = data.offers.filter((o) => kept.has(o.sessionId) && offerPicks.every((p) => offerValue(p.key, o) === p.value));
  const usedDevices = new Set<string>([...sessions.flatMap((s) => (s.deviceId ? [s.deviceId] : [])), ...offers.flatMap((o) => (o.driverDeviceId ? [o.driverDeviceId] : []))]);
  return {
    sessions,
    offers,
    devices: (data.devices ?? []).filter((d) => usedDevices.has(d.deviceId)),
    pings: data.pings.filter((p) => kept.has(p.sessionId) && pingPicks.every((k) => pingValue(k.key, p) === k.value)),
    dateOnly,
    priceChanges: data.priceChanges.filter((c) => kept.has(c.sessionId)),
    payments: data.payments.filter((p) => kept.has(p.sessionId)),
  };
}

/** A pick's chip text: the bar's own words, or the value alone for a chart click. */
export function pickLabel(p: Pick): string {
  if (p.key === 'date') return p.value.slice(8) + ' ' + new Date(`${p.value}T12:00:00Z`).toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' });
  return p.value;
}
