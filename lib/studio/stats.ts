/** Small, pure number helpers the Studio tabs share. Null when there is nothing to work it out from. */
import { matched, searched, type StudioSession } from './schema';

export function median(values: number[]): number | null {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

export const mean = (values: number[]): number | null => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);
export const sum = (values: number[]): number => values.reduce((a, b) => a + b, 0);
/** a / b as a percent. */
export const share = (a: number, b: number): number | null => (b > 0 ? (a / b) * 100 : null);

/** Count rows per band, in the band order given (bands with no rows show as 0). */
export function countBy<T>(rows: T[], keyOf: (row: T) => string | null, order: readonly string[]): Array<{ label: string; value: number }> {
  const counts = new Map<string, number>(order.map((k) => [k, 0]));
  for (const row of rows) {
    const k = keyOf(row);
    if (k !== null && counts.has(k)) counts.set(k, counts.get(k)! + 1);
  }
  return order.map((label) => ({ label, value: counts.get(label) ?? 0 }));
}

/** Group rows per band (band order kept). */
export function groupBy<T>(rows: T[], keyOf: (row: T) => string | null, order: readonly string[]): Array<{ label: string; rows: T[] }> {
  const groups = new Map<string, T[]>(order.map((k) => [k, []]));
  for (const row of rows) {
    const k = keyOf(row);
    if (k !== null) groups.get(k)?.push(row);
  }
  return order.map((label) => ({ label, rows: groups.get(label) ?? [] }));
}

/** Searched sessions and their match rate per band: the shape of most Studio combo charts. */
export function searchedAndMatch(sessions: StudioSession[], keyOf: (s: StudioSession) => string | null, order: readonly string[]) {
  return groupBy(sessions.filter(searched), keyOf, order).map((g) => ({
    label: g.label,
    bar: g.rows.length,
    line: share(g.rows.filter(matched).length, g.rows.length),
  }));
}

// ── Words ──

export const naira = (n: number | null | undefined): string => {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  const v = Math.round(n);
  return `${v < 0 ? '₦−' : '₦'}${Math.abs(v).toLocaleString('en-NG')}`;
};
export const num = (n: number | null | undefined, digits = 0): string =>
  n === null || n === undefined || !Number.isFinite(n) ? '—' : n.toLocaleString('en-NG', { minimumFractionDigits: digits, maximumFractionDigits: digits });
export const pct = (n: number | null | undefined, digits = 1): string => (n === null || n === undefined || !Number.isFinite(n) ? '—' : `${n.toFixed(digits)}%`);
/** +10.5% / −3.7% (a real minus, as on the mock-up). */
export const signedPct = (n: number | null | undefined, digits = 1): string => {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  const v = Number(n.toFixed(digits));
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(digits)}%`;
};
export const secs = (n: number | null | undefined): string => (n === null || n === undefined ? '—' : `${Math.round(n)}s`);
