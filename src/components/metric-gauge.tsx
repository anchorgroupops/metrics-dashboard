"use client";

/**
 * MetricGauge — a polished metric card: header (name + weight + status), the
 * PerfGauge dial, and the 2026 milestone "advantage" explainer. Normalizes a
 * scored metric to "% of target" via buildGaugeModel. The needle is the agent's
 * value (or a team average for the team scorecard).
 */

import type { ScoredMetric } from "@/lib/types";
import { buildGaugeModel } from "@/lib/gauge-model";
import { PerfGauge } from "./perf-gauge";

interface MetricGaugeProps {
  metric: ScoredMetric;
  teamAverage?: number | null; // natural units
  performers?: Array<{ name: string; value: number | null }>; // natural units
  valueOverride?: number | null;
  centerCaption?: string;
}

const statusColor: Record<string, string> = {
  green: "#30B14A",
  yellow: "#F5A300",
  red: "#E5484D",
  no_data: "#B7BCC2",
};

export function MetricGauge({
  metric,
  teamAverage = null,
  performers = [],
  valueOverride,
  centerCaption,
}: MetricGaugeProps) {
  const model = buildGaugeModel({ metric, teamAverage, performers });
  const needle = valueOverride !== undefined ? valueOverride : metric.value;
  const needlePct = needle === null ? 0 : buildGaugeModel({ metric: { ...metric, value: needle } }).value;
  const needleLabel =
    valueOverride !== undefined
      ? buildGaugeModel({ metric: { ...metric, value: needle } }).valueLabel
      : model.valueLabel;

  return (
    <div className="flex w-full flex-col rounded-3xl border border-black/5 bg-white p-5 shadow-sm">
      {/* Header */}
      <div className="mb-1 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: statusColor[metric.status] }} />
          <h3 className="text-base font-bold tracking-tight text-gray-900">{metric.label}</h3>
        </div>
        {metric.weight > 0 && (
          <span className="shrink-0 rounded-full bg-clear-water/10 px-2.5 py-1 text-xs font-bold text-clear-water">
            {Math.round(metric.weight * 100)}% of score
          </span>
        )}
      </div>

      {/* Dial */}
      <div className="flex justify-center">
        <PerfGauge
          value={needlePct}
          valueLabel={needleLabel}
          unitLabel={centerCaption}
          min={model.min}
          max={model.max}
          minimumThreshold={100}
          milestone={model.milestone}
          milestoneLabel={model.milestoneLabel}
          milestoneValueLabel={model.milestoneValueLabel}
          teamAverage={model.teamAverage}
          performers={model.performers}
        />
      </div>

      {/* Milestone advantage explainer */}
      {model.advantage && (
        <div className="mt-2 flex items-start gap-2 rounded-2xl bg-gradient-to-br from-clear-water/8 to-pearl-aqua/10 p-3">
          <span className="mt-0.5 text-base leading-none">🎯</span>
          <p className="text-[13px] leading-snug text-gray-700">
            <span className="font-semibold text-clear-water">Level up: </span>
            {model.advantage}
          </p>
        </div>
      )}
    </div>
  );
}
