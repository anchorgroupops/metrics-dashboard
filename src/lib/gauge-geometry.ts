/**
 * Pure geometry + data helpers for the performance gauge.
 *
 * The gauge is a 180° semicircle: the left end (180°/π) is the axis minimum,
 * the right end (360°/2π) is the axis maximum. Kept dependency-free and
 * unit-tested so the React component stays a thin renderer.
 */

export interface Point {
  x: number;
  y: number;
}

/** Clamp a value to [0,1] as a fraction of the [min,max] axis. */
export function valueToFraction(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  return Math.min(Math.max((value - min) / (max - min), 0), 1);
}

/** Fraction [0,1] → angle in radians along the lower semicircle (π → 2π). */
export function fractionToAngle(fraction: number): number {
  return Math.PI + Math.min(Math.max(fraction, 0), 1) * Math.PI;
}

export function valueToAngle(value: number, min: number, max: number): number {
  return fractionToAngle(valueToFraction(value, min, max));
}

export function polar(cx: number, cy: number, angle: number, r: number): Point {
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

/** SVG arc path between two angles at radius r (sweep clockwise). */
export function arcPath(cx: number, cy: number, a0: number, a1: number, r: number): string {
  const s = polar(cx, cy, a0, r);
  const e = polar(cx, cy, a1, r);
  const largeArc = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

export interface Performer {
  name: string;
  value: number;
}

export interface TieGroup {
  names: string[];
  value: number;
}

/**
 * Group performers that share a value (ties), sorted by value descending.
 * Mirrors the "John Collinge, Vanessa Arnold, Angela Cerniglia (Tied at 200%)"
 * treatment in the reference design.
 */
export function groupByValue(performers: Performer[]): TieGroup[] {
  const byValue = new Map<number, string[]>();
  for (const p of performers) {
    const list = byValue.get(p.value) ?? [];
    list.push(p.name);
    byValue.set(p.value, list);
  }
  return [...byValue.entries()]
    .map(([value, names]) => ({ value, names }))
    .sort((a, b) => b.value - a.value);
}

/** Top N tie-groups by value (each group counts as one slot). */
export function topPerformers(performers: Performer[], n = 3): TieGroup[] {
  return groupByValue(performers).slice(0, n);
}

/** Format a percent-of-target axis value: 129 → "129%". */
export function formatPercentOfTarget(value: number): string {
  return `${Math.round(value)}%`;
}
