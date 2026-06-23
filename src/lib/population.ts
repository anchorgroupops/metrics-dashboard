/**
 * Estimated Zillow Premier Agent population model + PERCENT_RANK tiering.
 *
 * BOZ ("Best of Zillow", top 15%) and ELITE (top 1%) are computed *dynamically*
 * by ranking an agent's metric value against an estimated national population
 * distribution, rather than only against the small local team. The distribution
 * is anchored on published/known Zillow Preferred benchmarks:
 *
 *   pCVR        : median ~2%, BOZ (85th) 4%,  ELITE (99th) 10%
 *   pickup rate : median ~18%, BOZ (85th) 25%, ELITE (99th) 60%
 *   appt rate   : median ~20%, BOZ (85th) 30%, ELITE (99th) 50%
 *   readiness   : median 85,  BOZ (85th) 100, ELITE (99th) 120  (0-125 scale)
 *
 * Anchors are (value → percentile) control points; `percentRankFromAnchors`
 * interpolates a monotonic CDF between them. The 85th/99th anchors are exactly
 * the BOZ/ELITE thresholds, so `bozThresholdValue`/`eliteThresholdValue` read
 * straight off the model and stay in sync with tiering.
 */

export type Tier = "elite" | "boz" | "standard" | "unranked";

export const BOZ_PERCENTILE = 0.85; // top 15%
export const ELITE_PERCENTILE = 0.99; // top 1%

/** (value, percentile) control points, ascending by value. */
export type PopulationAnchors = ReadonlyArray<readonly [number, number]>;

export const POPULATION_ANCHORS: Record<string, PopulationAnchors> = {
  pcvr: [
    [0, 0],
    [0.02, 0.5],
    [0.04, BOZ_PERCENTILE],
    [0.1, ELITE_PERCENTILE],
    [0.2, 1],
  ],
  pickup_rate: [
    [0, 0],
    [0.18, 0.5],
    [0.25, BOZ_PERCENTILE],
    [0.6, ELITE_PERCENTILE],
    [0.85, 1],
  ],
  appt_rate: [
    [0, 0],
    [0.2, 0.5],
    [0.3, BOZ_PERCENTILE],
    [0.5, ELITE_PERCENTILE],
    [0.7, 1],
  ],
  readiness: [
    [0, 0],
    [85, 0.5],
    [100, BOZ_PERCENTILE],
    [120, ELITE_PERCENTILE],
    [125, 1],
  ],
};

/** The metric used to assign an agent's overall BOZ/ELITE tier. */
export const PRIMARY_TIER_METRIC = "pcvr";

/**
 * Interpolate the percentile of `value` against an anchored CDF.
 * Piecewise-linear between control points; clamped to [0, 1].
 */
export function percentRankFromAnchors(anchors: PopulationAnchors, value: number): number {
  if (anchors.length === 0) return 0;
  if (value <= anchors[0][0]) return anchors[0][1];
  const last = anchors[anchors.length - 1];
  if (value >= last[0]) return last[1];
  for (let i = 1; i < anchors.length; i++) {
    const [v0, p0] = anchors[i - 1];
    const [v1, p1] = anchors[i];
    if (value <= v1) {
      const t = v1 === v0 ? 0 : (value - v0) / (v1 - v0);
      return p0 + t * (p1 - p0);
    }
  }
  return last[1];
}

/** PERCENT_RANK of `value` against the estimated population for a metric. */
export function estimatePopulationPercentRank(metricKey: string, value: number): number | null {
  const anchors = POPULATION_ANCHORS[metricKey];
  if (!anchors) return null;
  return percentRankFromAnchors(anchors, value);
}

/** The metric value sitting at a given population percentile (e.g. BOZ cutoff). */
export function valueAtPercentile(metricKey: string, percentile: number): number | null {
  const anchors = POPULATION_ANCHORS[metricKey];
  if (!anchors) return null;
  // Invert the CDF: anchors are also (value, percentile) so interpolate on p.
  if (percentile <= anchors[0][1]) return anchors[0][0];
  const last = anchors[anchors.length - 1];
  if (percentile >= last[1]) return last[0];
  for (let i = 1; i < anchors.length; i++) {
    const [v0, p0] = anchors[i - 1];
    const [v1, p1] = anchors[i];
    if (percentile <= p1) {
      const t = p1 === p0 ? 0 : (percentile - p0) / (p1 - p0);
      return v0 + t * (v1 - v0);
    }
  }
  return last[0];
}

export const bozThresholdValue = (metricKey: string) => valueAtPercentile(metricKey, BOZ_PERCENTILE);
export const eliteThresholdValue = (metricKey: string) =>
  valueAtPercentile(metricKey, ELITE_PERCENTILE);

/** Classify a percentile into a tier. */
export function classifyTier(percentile: number | null): Tier {
  if (percentile === null) return "unranked";
  if (percentile >= ELITE_PERCENTILE) return "elite";
  if (percentile >= BOZ_PERCENTILE) return "boz";
  return "standard";
}

/**
 * SQL PERCENT_RANK() semantics over an observed sample:
 *   (rank - 1) / (n - 1), where rank is the 1-based position of the first row
 *   equal to `value` in ascending order. Single-row samples rank 0.
 * Use this to rank an agent within the *observed* team population (as opposed
 * to the estimated national population above).
 */
export function sqlPercentRank(values: number[], value: number): number {
  const n = values.length;
  if (n <= 1) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = sorted.findIndex((v) => v >= value); // first row >= value (0-based)
  const idx = rank === -1 ? n - 1 : rank;
  return idx / (n - 1);
}

// ── Zillow Preferred threshold flagging ───────────────────────────────────────

export const ZILLOW_THRESHOLDS = {
  pcvr: 0.04, // ≥ 4.0%
  pickup_rate: 0.25, // ≥ 25%
} as const;

export interface ZillowFlags {
  pcvr: number | null;
  pickup: number | null;
  pcvrPass: boolean;
  pickupPass: boolean;
  /** True when the agent falls below either Zillow Preferred threshold. */
  flagged: boolean;
  reasons: string[];
}

/** Evaluate the Zillow Preferred thresholds and produce flag reasons. */
export function zillowThresholdFlags(metrics: Record<string, number | null>): ZillowFlags {
  const pcvr = metrics.pcvr ?? null;
  const pickup = metrics.pickup_rate ?? null;
  const pcvrPass = pcvr !== null && pcvr >= ZILLOW_THRESHOLDS.pcvr;
  const pickupPass = pickup !== null && pickup >= ZILLOW_THRESHOLDS.pickup_rate;
  const reasons: string[] = [];
  if (!pcvrPass) reasons.push(`pCVR below ${(ZILLOW_THRESHOLDS.pcvr * 100).toFixed(1)}%`);
  if (!pickupPass) reasons.push(`Pickup rate below ${(ZILLOW_THRESHOLDS.pickup_rate * 100).toFixed(0)}%`);
  return { pcvr, pickup, pcvrPass, pickupPass, flagged: !(pcvrPass && pickupPass), reasons };
}
