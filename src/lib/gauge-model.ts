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
  milestone: number | null; // milestone goal, % of target
  milestoneLabel: string | null;
  milestoneValueLabel: string | null; // milestone in natural units (e.g. "4.5%")
  advantage: string | null;
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

  const bozPct = pctOfTarget(boz, target, dir) ?? 150;
  const elitePct = pctOfTarget(elite, target, dir) ?? 200;
  const milestonePct =
    metric.milestone != null ? pctOfTarget(metric.milestone, target, dir) : null;
  const value = pctOfTarget(metric.value, target, dir) ?? 0;

  const perf: GaugePerformer[] = performers
    .map((p) => ({ name: p.name, pct: pctOfTarget(p.value, target, dir) }))
    .filter((p): p is { name: string; pct: number } => p.pct !== null)
    .map((p) => ({ name: p.name, value: Math.round(p.pct) }));

  // Axis ceiling focuses on the *actionable* range — a margin above the
  // milestone goal and the best observed performer — rather than the far top-1%
  // value, so realistic performance spreads across the dial instead of bunching
  // near the minimum. Floor of 130% keeps the bands legible.
  const topPct = perf.length ? Math.max(...perf.map((p) => p.value)) : 0;
  const maxPct = Math.max((milestonePct ?? bozPct) * 1.15, topPct * 1.06, value * 1.06, 130);

  // The "below Zillow Preferred standard" (red) band occupies only the bottom
  // 10% of the arc — the 100%-of-target line sits at the 10% mark.
  const F = 0.1;
  const rawMin = (100 - F * maxPct) / (1 - F);
  const axisMin = Math.max(0, Math.floor(rawMin / 5) * 5);

  const ticks = Array.from(
    new Set([100, milestonePct ? Math.round(milestonePct) : null, Math.round(maxPct)].filter(
      (t): t is number => t !== null && t <= maxPct,
    )),
  ).sort((a, b) => a - b);

  return {
    value: Math.round(value),
    valueLabel: formatMetricValue(metric.value, metric.unit),
    min: axisMin,
    max: Math.round(maxPct),
    minimumThreshold: 100,
    bozThreshold: Math.round(bozPct),
    eliteThreshold: Math.round(elitePct),
    milestone: milestonePct === null ? null : Math.round(milestonePct),
    milestoneLabel: metric.milestoneLabel ?? null,
    milestoneValueLabel: metric.milestone != null ? formatMetricValue(metric.milestone, metric.unit) : null,
    advantage: metric.advantage ?? null,
    teamAverage: teamAverage === null ? null : Math.round(pctOfTarget(teamAverage, target, dir) ?? 0),
    performers: perf,
    ticks,
  };
}
