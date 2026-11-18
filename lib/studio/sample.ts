/**
 * A seeded sample of the Studio dataset (lib/studio/schema.ts): October 2026, 4,453 opened sessions, every chart's
 * relationship built in (fewer free drivers → fewer matches, a higher opening → more bids, later rounds → more
 * give-ups, lateness → lower ratings). Same seed, same numbers, every load. It stands in until the server endpoint
 * exists; nothing here is real traffic.
 */
import {
  dayPartOf, fareSizeOf,
  type CarOwnership, type Channel, type DeclineReason, type LastTripEnd, type Outcome, type PayMethod,
  type PriceTrigger, type Promo, type RideClass, type RiderType, type StudioDataset, type StudioLedgerRow,
  type StudioOffer, type StudioPayment, type StudioPing, type StudioPriceChange, type StudioSession, type StudioShiftDay,
  type Variant, type Weather, type Weekday, type Zone, WEEKDAYS,
} from './schema';

const SESSIONS = 4453;
const FROM = '2026-10-01';
const TO = '2026-10-31';

/** mulberry32: small, fast, good enough for a rehearsal dataset. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function sampleDataset(seed = 20261001): StudioDataset {
  const r = rng(seed);
  const pick = <T,>(items: readonly T[], weights: readonly number[]): T => {
    const total = weights.reduce((a, b) => a + b, 0);
    let x = r() * total;
    for (let i = 0; i < items.length; i++) {
      x -= weights[i];
      if (x <= 0) return items[i];
    }
    return items[items.length - 1];
  };
  const normal = () => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
  const between = (lo: number, hi: number) => lo + r() * (hi - lo);
  const int = (lo: number, hi: number) => Math.floor(between(lo, hi + 1));
  const round50 = (n: number) => Math.max(50, Math.round(n / 50) * 50);
  const chance = (p: number) => r() < p;

  // ── People ──
  const riders = Array.from({ length: 1600 }, (_, i) => ({
    id: `R-${String(i + 1).padStart(4, '0')}`,
    type: pick<RiderType>(['Student', 'Young professional', 'Business', 'Occasional'], [30, 40, 15, 15]),
    joinedVia: pick<Channel>(['App', 'WhatsApp', 'Claude'], [52, 44, 4]),
    onboardedWithPromo: chance(0.39),
    variant: (chance(0.5) ? 'Control (40s)' : 'Treatment (60s)') as Variant,
  }));
  const drivers = Array.from({ length: 350 }, (_, i) => ({
    id: `D-${String(i + 1).padStart(3, '0')}`,
    ownership: pick<CarOwnership>(['Owns car', 'Hire purchase', 'Rented'], [40, 35, 25]),
    rating: Math.min(5, Math.max(3.9, 4.6 + normal() * 0.22)),
  }));

  const sessions: StudioSession[] = [];
  const offers: StudioOffer[] = [];
  const pings: StudioPing[] = [];
  const priceChanges: StudioPriceChange[] = [];
  const payments: StudioPayment[] = [];

  const hourWeights = [2, 2, 1, 1, 1, 2, 8, 14, 16, 10, 6, 6, 7, 8, 7, 9, 13, 14, 12, 9, 6, 4, 3, 2];
  const days = Array.from({ length: 31 }, (_, i) => `2026-10-${String(i + 1).padStart(2, '0')}`);
  const weekdayOf = (date: string): Weekday => WEEKDAYS[(new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7];

  let n = 0;
  let intentNo = 0;
  while (n < SESSIONS) {
    intentNo += 1;
    const rider = riders[int(0, riders.length - 1)];
    const intentId = `I-${String(intentNo).padStart(5, '0')}`;
    const date = days[int(0, days.length - 1)];
    let hour = pick(hourWeights.map((_, h) => h), hourWeights);
    const attempts = pick([1, 2, 3], [85, 13, 2]);
    const rideClass = pick<RideClass>(['Economy', 'Comfort', 'XL'], [80, 15, 5]);
    const zone = pick<Zone>(['Yaba', 'Lagos Island', 'Outside zones'], [35, 30, 35]);
    const destZone = pick<Zone>(['Yaba', 'Lagos Island', 'Outside zones'], [33, 32, 35]);
    const weather = pick<Weather>(['Clear', 'Light rain', 'Heavy rain'], [75, 18, 7]);
    const km = Math.min(45, Math.max(1.2, Math.exp(1.95 + normal() * 0.6)));
    const perKm = { Economy: 375, Comfort: 500, XL: 640 }[rideClass] * (1 + Math.max(0, normal() * 0.05));
    const suggestedNgn = round50(500 + perKm * km * (weather === 'Heavy rain' ? 1.12 : 1));
    let minutesSoFar = 0;
    let gotRide = false;

    for (let attempt = 1; attempt <= attempts && n < SESSIONS && !gotRide; attempt++) {
      n += 1;
      const id = `S${String(n).padStart(5, '0')}`;
      const channel = pick<Channel>(['App', 'WhatsApp', 'Claude'], [52, 44, 4]);
      const promo: Promo = chance(weather !== 'Clear' ? 0.08 : 0.01) ? 'Rain promo' : attempt === 1 && chance(0.035) ? 'First-ride promo' : 'No promo';
      if (attempt > 1) hour = Math.min(23, hour + (chance(0.3) ? 1 : 0));
      const base: Omit<StudioSession, 'openingNgn' | 'finalNgn' | 'agreedNgn' | 'outcome' | 'reason' | 'abandonStage' | 'rounds' | 'pinged' | 'offersReceived' | 'firstOfferSec' | 'matchSec' | 'decisionSec' | 'offersOnScreen' | 'minutesToRide' | 'bookingFeeNgn' | 'commissionNgn' | 'processorFeeNgn' | 'messagingCostNgn' | 'refundNgn' | 'wheelersNetNgn' | 'fuelNgn' | 'trip'> = {
        id, date, hour, weekday: weekdayOf(date), dayPart: dayPartOf(hour), channel, rideClass,
        riderId: rider.id, riderType: rider.type, joinedVia: rider.joinedVia, onboardedWithPromo: rider.onboardedWithPromo,
        weather, zone, destZone, variant: rider.variant, promo, intentId, attempt, km: Math.round(km * 10) / 10,
        suggestedNgn, fareSize: fareSizeOf(suggestedNgn),
        freeDrivers: 0,
      };
      const messagingPerMsg = channel === 'WhatsApp' ? 12 : 0;

      // Left before searching.
      if (chance(0.068)) {
        sessions.push({
          ...base, openingNgn: null, finalNgn: null, agreedNgn: null, outcome: 'Left before search', reason: null,
          abandonStage: pick(['After destination', 'After fare shown', 'After pickup'], [24, 50, 26]),
          rounds: 0, pinged: 0, offersReceived: 0, firstOfferSec: null, matchSec: null, decisionSec: null, offersOnScreen: null,
          minutesToRide: null, bookingFeeNgn: 0, commissionNgn: 0, processorFeeNgn: 0, messagingCostNgn: messagingPerMsg * 2,
          refundNgn: 0, wheelersNetNgn: -messagingPerMsg * 2, fuelNgn: 0, trip: null,
        });
        minutesSoFar += 3;
        break;
      }

      // The opening price.
      const typedExactly = chance(0.036);
      const typeBias = { Student: -0.07, 'Young professional': -0.03, Business: 0.03, Occasional: -0.02 }[rider.type];
      let openingNgn = typedExactly ? suggestedNgn : round50(suggestedNgn * (1 + typeBias + normal() * 0.11));
      openingNgn = Math.max(round50(suggestedNgn * 0.7), openingNgn);
      if (!typedExactly && chance(0.1)) openingNgn = Math.max(500, Math.round(openingNgn / 500) * 500);

      // Supply near the pickup.
      const nightly = hour <= 5 ? 0.15 : hour >= 21 ? 0.55 : 1;
      const zoneSupply = { Yaba: 1.15, 'Lagos Island': 1, 'Outside zones': 0.7 }[zone];
      const freeDrivers = Math.max(0, Math.round(between(1, 12) * nightly * zoneSupply + normal() * 1.5));

      // Rounds of the search: each round pings drivers; the rider may change the price between rounds.
      const variant60 = rider.variant === 'Treatment (60s)';
      const maxRounds = pick([1, 2, 3, 4, 5], [44, 28, 14, 8, 6]);
      let price = openingNgn;
      const sessionOffers: StudioOffer[] = [];
      let pinged = 0;
      let rounds = 0;
      let firstOfferSec: number | null = null;
      for (let round = 1; round <= maxRounds; round++) {
        rounds = round;
        const nPing = Math.max(0, Math.round(freeDrivers * between(0.6, 1.3) + int(0, 3)));
        const riderVs = (price / suggestedNgn - 1) * 100;
        for (let p = 0; p < nPing; p++) {
          pinged += 1;
          const d = drivers[int(0, drivers.length - 1)];
          const pickupKm = Math.round(between(0.3, 6.5) * 10) / 10;
          const delivered = chance(0.97);
          const seen = delivered && chance(0.873);
          const ownershipBid = { 'Owns car': 0.82, 'Hire purchase': 1.05, Rented: 1.12 }[d.ownership];
          const lastTripEnd = pick<LastTripEnd>(['Completed', 'Rider cancelled', 'Driver cancelled', 'Rider no-show'], [80, 9, 6, 5]);
          const lastBump = { Completed: 1, 'Rider cancelled': 1.22, 'Driver cancelled': 0.95, 'Rider no-show': 1.25 }[lastTripEnd];
          const bidP = Math.min(0.7, 0.26 * ownershipBid * lastBump * (1 + riderVs / 40) * (variant60 ? 1.03 : 1) * (pickupKm > 5 ? 0.6 : 1));
          let action: StudioPing['action'] = 'Never opened';
          let declineReason: DeclineReason | null = null;
          if (seen) {
            const x = r();
            if (x < bidP) action = chance(0.55) ? 'Took rider price' : 'Countered';
            else if (x < bidP + 0.26) {
              action = 'Declined';
              declineReason = pick<DeclineReason>(['Too far', 'Price too low', 'Ending shift', 'Heading elsewhere', 'Wants cash', 'Low rider rating'],
                [pickupKm > 4 ? 40 : 22, riderVs < 0 ? 30 : 16, 12, 12, 9, 3]);
            } else action = 'Opened, ignored';
          }
          let bidVs: number | null = null;
          if (action === 'Took rider price' || action === 'Countered') {
            const gap = action === 'Took rider price' ? 0 : pick([100, 200, 300, 400, 500, 700, 1000, 1500, 2000], [8, 18, 16, 10, 12, 12, 12, 7, 5]) / price * 100 + (d.ownership === 'Owns car' ? 3 : 0);
            const priceNgn = action === 'Took rider price' ? price : round50(price * (1 + gap / 100));
            bidVs = (priceNgn / suggestedNgn - 1) * 100;
            const latencySec = Math.max(2, Math.round(between(3, 40) * (variant60 ? 1.1 : 1)));
            if (firstOfferSec === null) firstOfferSec = (round - 1) * (variant60 ? 60 : 40) + latencySec;
            sessionOffers.push({
              id: `${id}-O${sessionOffers.length + 1}`, sessionId: id, driverId: d.id, priceNgn, riderPriceNgn: price,
              gapToRiderPct: Math.round(((priceNgn / price) - 1) * 1000) / 10, gapToSuggestedPct: Math.round(bidVs * 10) / 10,
              round, status: 'Expired', listPos: null, cheapest: null, premiumNgn: null, latencySec,
              profileViewed: chance(0.17), driverRating: Math.round(d.rating * 100) / 100, pickupKm,
            });
          }
          pings.push({
            sessionId: id, driverId: d.id, ownership: d.ownership, driverRating: Math.round(d.rating * 100) / 100, pickupKm,
            delivered, seen, action, declineReason, lastTripEnd, riderVsSuggestedPct: Math.round(riderVs * 10) / 10,
            bidVsSuggestedPct: bidVs === null ? null : Math.round(bidVs * 10) / 10,
          });
        }
        // Accept now? The cheapest offers in this round are on screen.
        const open = sessionOffers.filter((o) => o.round === round);
        const acceptP = open.length === 0 ? 0 : Math.min(0.92, 0.55 + open.length * 0.1 - (open[0].gapToRiderPct > 15 ? 0.2 : 0) + (rider.type === 'Business' ? 0.1 : 0));
        if (open.length > 0 && chance(acceptP)) break;
        if (round === maxRounds) break;
        // Change the price before the next round, by what they had just seen.
        let trigger: PriceTrigger;
        if (open.length === 0) trigger = 'No offers came in';
        else if (open.every((o) => o.gapToRiderPct > 0)) trigger = chance(0.8) ? 'Offers above their price' : 'Matched lowest counter';
        else trigger = 'Got takers, tried lower';
        if (chance(trigger === 'Got takers, tried lower' ? 0.6 : 0.92)) {
          const from = price;
          let to: number;
          if (trigger === 'Got takers, tried lower') to = round50(price * (1 - between(0.06, 0.15)));
          else if (trigger === 'Matched lowest counter') to = Math.min(...open.map((o) => o.priceNgn));
          else to = round50(price * (1 + between(0.04, 0.17)));
          if (chance(0.12)) to = Math.round(to / 500) * 500 || to;
          if (to !== from) {
            priceChanges.push({ sessionId: id, direction: to > from ? 'Raise' : 'Drop', fromNgn: from, toNgn: to, trigger });
            for (const o of sessionOffers) if (o.status === 'Expired' && o.round === round && chance(0.6)) o.status = 'Voided by price change';
            price = to;
          }
        }
      }

      // How it ends.
      const supplyP = freeDrivers <= 2 ? 0.25 : freeDrivers <= 5 ? 0.72 : freeDrivers <= 10 ? 0.8 : 0.86;
      const lastRound = sessionOffers.filter((o) => o.round === rounds && o.status === 'Expired');
      let outcome: Outcome;
      let accepted: StudioOffer | null = null;
      if (lastRound.length > 0 && chance(Math.min(0.97, supplyP + 0.25))) {
        const sorted = [...lastRound].sort((a, b) => a.priceNgn - b.priceNgn);
        accepted = sorted.length > 1 && chance(0.025) ? sorted[1] : sorted[0];
        sorted.forEach((o, i) => { o.listPos = i + 1; o.cheapest = i === 0; o.premiumNgn = o.priceNgn - sorted[0].priceNgn; });
        accepted.status = 'Accepted';
        for (const o of lastRound) if (o !== accepted) o.status = pick<StudioOffer['status']>(['Rejected', 'Lost to other driver', 'Withdrawn'], [45, 40, 15]);
        for (const o of sessionOffers) if (o.status === 'Expired' && o.round < rounds && chance(0.55)) o.status = 'Rejected';
        outcome = chance(0.16) ? 'Cancelled after match' : 'Completed';
      } else {
        const timedOut = chance(rounds >= 4 ? 0.75 : 0.28);
        outcome = timedOut ? 'Search timed out' : 'Rider cancelled';
        for (const o of sessionOffers) if (o.status === 'Expired') o.status = timedOut && chance(0.15) ? 'Search timed out' : chance(0.45) ? 'Rejected' : 'Expired';
      }
      offers.push(...sessionOffers);

      const matchSec = accepted ? (rounds - 1) * (variant60 ? 60 : 40) + accepted.latencySec + int(5, 30) : null;
      const onScreen = accepted ? lastRound.length : null;
      const decisionSec = accepted ? Math.round(between(10, 20) + (onScreen ?? 1) * 1.6) : null;
      const agreedNgn = accepted ? accepted.priceNgn : null;

      // The trip and the money.
      let trip: StudioSession['trip'] = null;
      let bookingFeeNgn = 0;
      const commissionNgn = 0;
      let processorFeeNgn = 0;
      let refundNgn = 0;
      let fuelNgn = 0;
      if (accepted && agreedNgn !== null) {
        const late = Math.round(normal() * 2.4 + 1.2);
        if (outcome === 'Completed') {
          const method = pick<PayMethod>(['Card (Paystack)', 'Bank transfer', 'Wallet', 'Cash'], [38, 27, 14, 21]);
          const failP: number = { 'Card (Paystack)': 0.07, 'Bank transfer': 0.06, Wallet: 0.05, Cash: 0.02, 'Stellar (XLM)': 0.05 }[method];
          let paid = false;
          for (let t = 0; t < 3 && !paid; t++) {
            const ok = !chance(failP);
            payments.push({ sessionId: id, date, method: t > 0 && method !== 'Cash' && chance(0.3) ? 'Wallet' : method, success: ok, amountNgn: agreedNgn });
            paid = ok;
          }
          bookingFeeNgn = 350;
          processorFeeNgn = method === 'Card (Paystack)' ? Math.min(2000, Math.round(agreedNgn * 0.015 + 100)) : method === 'Bank transfer' ? 50 : 0;
          refundNgn = chance(0.01) ? 350 : 0;
          fuelNgn = Math.round(km * { Economy: 120, Comfort: 145, XL: 190 }[rideClass]);
          const rating = Math.max(1, Math.min(5, Math.round(4.45 - Math.max(0, late - 5) * 0.12 + normal() * 0.5)));
          trip = { status: 'Completed', cancelledBy: null, reason: null, pickupDelayMin: late, fareNgn: agreedNgn, paid, method, rating };
        } else {
          const byRider = chance(0.62);
          const reason = byRider
            ? pick(['driver_going_wrong_way', 'took_too_long', 'changed_plans', 'found_other_ride'], [30, 35, 25, 10])
            : pick(['vehicle_issue', 'rider_not_found', 'too_far'], [40, 35, 25]);
          trip = { status: 'Cancelled after match', cancelledBy: byRider ? 'rider' : 'driver', reason, pickupDelayMin: null, fareNgn: agreedNgn, paid: null, method: null, rating: null };
        }
      }
      const messagingCostNgn = messagingPerMsg * (4 + rounds * 2 + (trip ? 4 : 0));
      const wheelersNetNgn = bookingFeeNgn + commissionNgn - processorFeeNgn - messagingCostNgn - refundNgn;
      const reason = outcome === 'Search timed out' ? 'search_timeout'
        : outcome === 'Rider cancelled' ? pick(['no_drivers_responding', 'took_too_long', 'changed_plans', 'price_too_high'], [30, 30, 25, 15])
          : outcome === 'Cancelled after match' && trip ? `${trip.cancelledBy}:${trip.reason}` : null;

      minutesSoFar += (matchSec ?? rounds * (variant60 ? 60 : 40)) / 60 + 1;
      const startsIn = outcome === 'Completed' ? Math.max(3, Math.round(between(5, 12) + (trip?.pickupDelayMin ?? 0))) : 0;
      sessions.push({
        ...base, freeDrivers, openingNgn, finalNgn: price, agreedNgn, outcome, reason, abandonStage: null,
        rounds, pinged, offersReceived: sessionOffers.length, firstOfferSec, matchSec, decisionSec, offersOnScreen: onScreen,
        minutesToRide: outcome === 'Completed' ? Math.round((minutesSoFar + startsIn) * 10) / 10 : null,
        bookingFeeNgn, commissionNgn, processorFeeNgn, messagingCostNgn, refundNgn, wheelersNetNgn, fuelNgn, trip,
      });
      if (outcome === 'Completed') gotRide = true;
      minutesSoFar += int(1, 6);
    }
  }

  // Supply by day, and the drivers' wallets.
  const shifts: StudioShiftDay[] = days.map((date) => {
    const onlineHours = Math.round(between(330, 580));
    const share = between(0.09, 0.15);
    return { date, onlineHours, tripHours: Math.round(onlineHours * share) };
  });
  const ledger: StudioLedgerRow[] = [];
  for (const date of days) {
    const done = sessions.filter((s) => s.date === date && s.outcome === 'Completed' && s.trip);
    const earnings = done.filter((s) => s.trip!.method !== 'Cash').reduce((sum, s) => sum + (s.agreedNgn ?? 0) - s.bookingFeeNgn, 0);
    const cashFees = done.filter((s) => s.trip!.method === 'Cash').reduce((sum, s) => sum + s.bookingFeeNgn, 0);
    const withdrawals = Math.round(earnings * between(0.82, 0.96));
    ledger.push(
      { date, type: 'Trip earnings', amountNgn: earnings },
      { date, type: 'Cash booking fee owed', amountNgn: -cashFees },
      { date, type: 'Withdrawals', amountNgn: -withdrawals },
      { date, type: 'Withdrawal fees', amountNgn: -45 * Math.max(1, Math.round(withdrawals / 7000)) },
      { date, type: 'Failed withdrawals', amountNgn: 0 },
    );
  }

  return { source: 'sample', from: FROM, to: TO, zones: ['Yaba', 'Lagos Island', 'Outside zones'], notRecorded: [], sessions, offers, pings, priceChanges, payments, shifts, ledger };
}
