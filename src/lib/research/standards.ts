/**
 * Zillow Preferred standards snapshot + diffing.
 *
 * The program's minimums, milestone targets, and market averages drift over
 * time, so they live in `config/zillow-standards.json` and are re-checked at
 * least weekly (see scripts/research-standards.ts). `diffStandards` is the pure,
 * tested core that reports what changed between two snapshots.
 */

export interface MetricStandard {
  label?: string;
  weight?: number;
  minimum: number | null;
  milestone: number | null;
  milestone_label?: string | null;
  elite?: number | null;
  industry_avg?: number | null;
  unit?: string;
}

export interface StandardsSnapshot {
  researched_at: string;
  source: string;
  notebooklm_url?: string;
  metrics: Record<string, MetricStandard>;
}

export interface StandardChange {
  metric: string;
  field: keyof MetricStandard;
  old: number | string | null | undefined;
  new: number | string | null | undefined;
}

const NUMERIC_FIELDS: Array<keyof MetricStandard> = [
  "minimum",
  "milestone",
  "elite",
  "industry_avg",
  "weight",
];

/**
 * Compare a researched snapshot against the committed one. Returns a flat list
 * of material changes (numeric fields beyond a small tolerance, plus milestone
 * label changes, plus newly-added/removed metrics).
 */
export function diffStandards(
  current: StandardsSnapshot,
  researched: StandardsSnapshot,
  tolerance = 1e-9,
): StandardChange[] {
  const changes: StandardChange[] = [];
  const metrics = new Set([...Object.keys(current.metrics), ...Object.keys(researched.metrics)]);

  for (const metric of metrics) {
    const a = current.metrics[metric];
    const b = researched.metrics[metric];
    if (!a) {
      changes.push({ metric, field: "minimum", old: undefined, new: b?.minimum ?? null });
      continue;
    }
    if (!b) {
      changes.push({ metric, field: "minimum", old: a.minimum, new: undefined });
      continue;
    }
    for (const field of NUMERIC_FIELDS) {
      const av = a[field] as number | null | undefined;
      const bv = b[field] as number | null | undefined;
      if (av == null && bv == null) continue;
      if (av == null || bv == null || Math.abs((av as number) - (bv as number)) > tolerance) {
        changes.push({ metric, field, old: av ?? null, new: bv ?? null });
      }
    }
    if ((a.milestone_label ?? null) !== (b.milestone_label ?? null)) {
      changes.push({
        metric,
        field: "milestone_label",
        old: a.milestone_label ?? null,
        new: b.milestone_label ?? null,
      });
    }
  }
  return changes;
}

/** Human-readable one-liner per change, for reports / Slack. */
export function formatChange(c: StandardChange): string {
  const fmt = (v: unknown) => (v == null ? "—" : String(v));
  return `${c.metric}.${String(c.field)}: ${fmt(c.old)} → ${fmt(c.new)}`;
}
