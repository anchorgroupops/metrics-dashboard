import { computeTeamAverages, metricKeys } from "@/lib/scoring";
import { MetricGauge } from "./metric-gauge";
import type { ScoredAgent } from "@/lib/types";

/**
 * Individual agent scorecard: one gauge per metric with the agent's value as
 * the needle, a team-average marker, and team top-performer dots.
 */
export function AgentScorecard({ agent, team }: { agent: ScoredAgent; team: ScoredAgent[] }) {
  const teamAverages = computeTeamAverages(team);
  const cards = metricKeys()
    .map((key) => ({ key, metric: agent.metrics[key] }))
    .filter((c) => c.metric);

  const performersFor = (key: string) => team.map((a) => ({ name: a.name, value: a.metrics[key]?.value ?? null }));

  return (
    <div className="space-y-6">
      {cards
        .filter((c) => c.metric!.gaugeSize === "hero")
        .map((c) => (
          <div key={c.key} className="md:max-w-2xl md:mx-auto w-full">
            <MetricGauge
              metric={c.metric!}
              teamAverage={teamAverages[c.key] ?? null}
              performers={performersFor(c.key)}
              centerCaption="agent value"
            />
          </div>
        ))}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {cards
          .filter((c) => c.metric!.gaugeSize !== "hero")
          .map((c) => (
            <MetricGauge
              key={c.key}
              metric={c.metric!}
              teamAverage={teamAverages[c.key] ?? null}
              performers={performersFor(c.key)}
              centerCaption="agent value"
            />
          ))}
      </div>
    </div>
  );
}
