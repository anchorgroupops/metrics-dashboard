/**
 * Period helpers. A "period" is a canonical calendar month string `YYYY-MM`.
 * The pipeline windows every pull by `[createdAfter, createdBefore)`.
 */

const PERIOD_RE = /^\d{4}-\d{2}$/;

/** Normalize "April 2026" / "2026-04" / "2026-04-15" to canonical "YYYY-MM". */
export function normalizePeriod(input: string): string {
  const s = input.trim();
  if (PERIOD_RE.test(s)) return s;
  // ISO date → take year-month
  const iso = /^(\d{4})-(\d{2})-\d{2}/.exec(s);
  if (iso) return `${iso[1]}-${iso[2]}`;
  // "Month YYYY"
  const parsed = new Date(`${s} 1`);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getUTCFullYear();
    const m = String(parsed.getUTCMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }
  throw new Error(`Unrecognized period: ${input}`);
}

/** The current calendar month as a period, in UTC. */
export function currentPeriod(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export interface PeriodWindow {
  period: string;
  createdAfter: string; // ISO YYYY-MM-DD (inclusive)
  createdBefore: string; // ISO YYYY-MM-DD (exclusive, first day of next month)
}

/** Build the `[start, nextMonthStart)` window for a period. */
export function periodWindow(period: string): PeriodWindow {
  const p = normalizePeriod(period);
  const [y, m] = p.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const next = new Date(Date.UTC(y, m, 1));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { period: p, createdAfter: iso(start), createdBefore: iso(next) };
}
