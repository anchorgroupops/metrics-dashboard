"use client";

/**
 * MetricGauge — renders a single Zillow Preferred metric as a PerfGauge,
 * sized by its importance (weight): hero metrics get the full presentation
 * gauge, secondary/supplementary metrics get progressively smaller compact
 * gauges. Each still shows the minimum, the needle value, the team average,
 * top performers, and the BOZ/Elite zones.
 *
 * `value` is the needle (an agent's value, or the team average for a team-level
 * scorecard); `teamAverage` and `performers` are in natural metric units and
 * normalized to "% of target" by `buildGaugeModel`.
 */

import type { ScoredMetric } from "@/lib/types";
import { buildGaugeModel } from "@/lib/gauge-model";
import { PerfGauge } from "./perf-gauge";

interface MetricGaugeProps {
  metric: ScoredMetric;
  teamAverage?: number | null; // natural units
  performers?: Array<{ name: string; value: number | null }>; // natural units
  // Override the needle source; defaults to the metric's own value.
  valueOverride?: number | null;
  subtitle?: string;
}

const WIDTHS: Record<ScoredMetric["gaugeSize"], number> = {
  hero: 900,
  secondary: 460,
  supplementary: 360,
};

export function MetricGauge({ metric, teamAverage = null, performers = [], valueOverride, subtitle }: MetricGaugeProps) {
  const model = buildGaugeModel({ metric, teamAverage, performers });
  const variant = metric.gaugeSize === "hero" ? "full" : "compact";
  const needle = valueOverride !== undefined ? valueOverride : metric.value;
  const needlePct =
    needle === null
      ? 0
      : buildGaugeModel({ metric: { ...metric, value: needle } }).value;

  return (
    <PerfGauge
      variant={variant}
      title={metric.label}
      subtitle={variant === "full" ? subtitle : undefined}
      axisLabel={variant === "full" ? "Percentage of target" : undefined}
      value={needlePct}
      valueLabel={model.valueLabel}
      min={model.min}
      max={model.max}
      minimumThreshold={100}
      bozThreshold={model.bozThreshold}
      eliteThreshold={model.eliteThreshold}
      teamAverage={model.teamAverage}
      performers={model.performers}
      ticks={model.ticks}
      width={WIDTHS[metric.gaugeSize]}
    />
  );
}
