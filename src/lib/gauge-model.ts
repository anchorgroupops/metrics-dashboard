/**
 * Normalize any metric onto a common "percentage of target" gauge axis, so
 * every gauge shares the same shape: the Zillow Preferred minimum sits at 100%,
 * Best of Zillow / Elite are higher multiples, and the agent value is plotted
 * relative to their own target. Pure + unit-tested.
 *
 * For higher-is-better metrics, pct = value / target × 100.
 * For lower-is-better metrics (e.g. response time), pct = target / value × 100,
 * so "faster than target" still reads above 100%.
 */

import type { ScoredMetric } from "./types";
import { formatMetricValue } from "./scoring";

export type Direction = "higher_is_better" | "lower_is_better";

/** Value as a percentage of target (100 = exactly at target). null-safe. */
export function pctOfTarget(
  value: number | null,
  target: number,
  direction: Direction = "higher_is_better",
): number | null {
  if (value === null || value === undefined) return null;
  if (direction === "lower_is_better") {
    if (value <= 0) return 300;
    return (target / value) * 100;
  }
  if (target <= 0) return 0;
  return (value / target) * 100;
}

export interface GaugePerformer {
  name: string;
  value: number; // axis units (% of target)
}

export interface GaugeModel {
  value: number; // agent value, % of target
  valueLabel: string; // natural-unit label (e.g. "5.2%")
  min: number;
  max: number;
  minimumThreshold: number; // always 100 (the target line)
  bozThreshold: number;
  eliteThreshold: number;
  teamAverage: number | null;
  performers: GaugePerformer[];
  ticks: number[];
}

export interface BuildGaugeInput {
  metric: ScoredMetric;
  teamAverage?: number | null; // natural units
  performers?: Array<{ name: string; value: number | null }>; // natural units
}

/** Build normalized gauge props from a scored metric + team context. */
export function buildGaugeModel({ metric, teamAverage = null, performers = [] }: BuildGaugeInput): GaugeModel {
  const dir = metric.direction;
  const target = metric.target;
  const boz = metric.bozThreshold ?? target * 1.5;
  const elite = metric.eliteThreshold ?? target * 2;
  const axisMax = metric.axisMax ?? elite * 1.2;

  const bozPct = pctOfTarget(boz, target, dir) ?? 150;
  const elitePct = pctOfTarget(elite, target, dir) ?? 200;
  // Headroom above elite, and never less than 130% so the bands are legible.
  const maxPct = Math.max((pctOfTarget(axisMax, target, dir) ?? elitePct * 1.15), elitePct + 15, 130);

  // Place the 100%-of-target line ~⅓ along the arc so the "below minimum" red
  // band never dominates for bounded metrics (e.g. CSAT, where the achievable
  // range above target is small). axisMin clamps to 0 for wide-range metrics.
  const F = 0.33;
  const rawMin = (100 - F * maxPct) / (1 - F);
  const axisMin = Math.max(0, Math.floor(rawMin / 5) * 5);

  const value = pctOfTarget(metric.value, target, dir) ?? 0;

  const perf: GaugePerformer[] = performers
    .map((p) => ({ name: p.name, pct: pctOfTarget(p.value, target, dir) }))
    .filter((p): p is { name: string; pct: number } => p.pct !== null)
    .map((p) => ({ name: p.name, value: Math.round(p.pct) }));

  // Ticks: minimum, BOZ, Elite, and the ceiling (rounded), de-duplicated.
  const ticks = Array.from(
    new Set([100, Math.round(bozPct), Math.round(elitePct), Math.round(maxPct)].filter((t) => t <= maxPct)),
  ).sort((a, b) => a - b);

  return {
    value: Math.round(value),
    valueLabel: formatMetricValue(metric.value, metric.unit),
    min: axisMin,
    max: Math.round(maxPct),
    minimumThreshold: 100,
    bozThreshold: Math.round(bozPct),
    eliteThreshold: Math.round(elitePct),
    teamAverage: teamAverage === null ? null : Math.round(pctOfTarget(teamAverage, target, dir) ?? 0),
    performers: perf,
    ticks,
  };
}
