import { THRESHOLDS } from "@/lib/thresholds";
import { scoreMetric, computeTeamAverages, metricKeys } from "@/lib/scoring";
import { MetricGauge } from "./metric-gauge";
import type { ScoredAgent } from "@/lib/types";

/** Team-level scorecard: one gauge per metric, needle = team average. */
export function TeamScorecard({ scored }: { scored: ScoredAgent[] }) {
  const teamAverages = computeTeamAverages(scored);
  const cards = metricKeys().map((key) => {
    const th = THRESHOLDS[key];
    const teamAvg = teamAverages[key] ?? null;
    const performers = scored.map((a) => ({ name: a.name, value: a.metrics[key]?.value ?? null }));
    return { key, metric: scoreMetric(key, teamAvg, th), teamAvg, performers };
  });

  return (
    <div className="space-y-6">
      {cards
        .filter((c) => c.metric.gaugeSize === "hero")
        .map((c) => (
          <div key={c.key} className="md:max-w-2xl md:mx-auto w-full">
            <MetricGauge
              metric={c.metric}
              performers={c.performers}
              teamAverage={c.teamAvg}
              centerCaption="team average"
            />
          </div>
        ))}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {cards
          .filter((c) => c.metric.gaugeSize !== "hero")
          .map((c) => (
            <MetricGauge
              key={c.key}
              metric={c.metric}
              performers={c.performers}
              teamAverage={c.teamAvg}
              centerCaption="team average"
            />
          ))}
      </div>
    </div>
  );
}
