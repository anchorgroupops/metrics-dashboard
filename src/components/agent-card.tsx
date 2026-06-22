"use client";

import { ScoredAgent } from "@/lib/types";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Gauge } from "./gauge";
import { formatMetricValue } from "@/lib/scoring";

interface AgentCardProps {
  agent: ScoredAgent;
  teamAverages?: Record<string, number>;
}

function statusBadgeVariant(
  status: string
): "green" | "yellow" | "red" | "neutral" {
  if (status === "Preferred") return "green";
  if (status === "At Risk") return "yellow";
  if (status === "Needs Improvement") return "red";
  return "neutral";
}

export function AgentCard({ agent, teamAverages }: AgentCardProps) {
  const heroMetrics = agent.metricsList.filter(
    (m) => m.gaugeSize === "hero"
  );
  const secondaryMetrics = agent.metricsList.filter(
    (m) => m.gaugeSize === "secondary"
  );
  const supplementaryMetrics = agent.metricsList.filter(
    (m) => m.gaugeSize === "supplementary"
  );

  return (
    <Card className="hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3
            className="text-lg font-bold text-clear-water"
            style={{ fontFamily: "'Collier', Georgia, serif" }}
          >
            {agent.name}
          </h3>
          <p className="text-sm text-gray-500">{agent.email}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant={statusBadgeVariant(agent.overallStatus)}>
            {agent.overallStatus}
          </Badge>
          {agent.zilpiEligible && (
            <Badge variant="teal">Zillow Preferred</Badge>
          )}
        </div>
      </div>

      {/* Hero gauge(s) */}
      <div className="flex justify-center gap-6 mb-4">
        {heroMetrics.map((m) => (
          <Gauge
            key={m.key}
            metric={m}
            size={200}
            teamAverage={teamAverages?.[m.key]}
          />
        ))}
      </div>

      {/* Secondary gauges */}
      {secondaryMetrics.length > 0 && (
        <div className="flex justify-center gap-4 mb-4 flex-wrap">
          {secondaryMetrics.map((m) => (
            <Gauge
              key={m.key}
              metric={m}
              size={140}
              teamAverage={teamAverages?.[m.key]}
            />
          ))}
        </div>
      )}

      {/* Supplementary metrics as bars */}
      {supplementaryMetrics.length > 0 && (
        <div className="space-y-2 mt-3 pt-3 border-t border-sandy-shore-dark/20">
          {supplementaryMetrics.map((m) => (
            <div
              key={m.key}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-gray-600">{m.label}</span>
              <span className="font-medium">
                {formatMetricValue(m.value, m.unit)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Readiness + Points footer */}
      <div className="flex justify-between items-center mt-4 pt-3 border-t border-sandy-shore-dark/20 text-sm">
        <span className="text-gray-500">
          Readiness:{" "}
          <span className="font-bold text-clear-water">
            {agent.operationalReadiness?.toFixed(0) ?? "N/A"}
          </span>
          /100
        </span>
        <span className="text-gray-500">
          Points:{" "}
          <span className="font-bold text-clear-water">
            {agent.leaderboardPoints.toLocaleString()}
          </span>
        </span>
      </div>
    </Card>
  );
}
