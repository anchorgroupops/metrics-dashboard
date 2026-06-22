import {
  ScoredMetric, ScoredAgent, AgentMetrics, OverallStatus,
  MetricStatus, TeamSummary, LeaderboardEntry, ThresholdConfig
} from "./types";
import { THRESHOLDS, ZILPI_ELIGIBILITY, LEADERBOARD_WEIGHTS } from "./thresholds";

export function metricKeys(): string[] {
  return Object.entries(THRESHOLDS)
    .sort((a, b) => {
      // Hero first, then by weight desc
      const sizeOrder = { hero: 0, secondary: 1, supplementary: 2 };
      const sizeA = sizeOrder[a[1].gaugeSize];
      const sizeB = sizeOrder[b[1].gaugeSize];
      if (sizeA !== sizeB) return sizeA - sizeB;
      return b[1].weight - a[1].weight;
    })
    .map(([key]) => key);
}

export function scoreMetric(
  key: string,
  value: number | null,
  threshold: ThresholdConfig
): ScoredMetric {
  if (value === null || value === undefined) {
    return {
      key,
      label: threshold.label,
      value: null,
      target: threshold.target,
      yellowFloor: threshold.yellowFloor,
      weight: threshold.weight,
      status: "no_data",
      pctOfTarget: null,
      unit: threshold.unit,
      direction: threshold.direction,
      gaugeSize: threshold.gaugeSize,
    };
  }

  let status: MetricStatus;
  let pctOfTarget: number;

  if (threshold.direction === "lower_is_better") {
    // For lower-is-better (e.g., speed to lead), lower value = better
    pctOfTarget = value > 0 ? threshold.target / value : 2.0;
    if (value <= threshold.target) {
      status = "green";
    } else if (value <= threshold.yellowFloor) {
      status = "yellow";
    } else {
      status = "red";
    }
  } else {
    // higher_is_better (default)
    pctOfTarget = threshold.target > 0 ? value / threshold.target : 0;
    if (value >= threshold.target) {
      status = "green";
    } else if (value >= threshold.yellowFloor) {
      status = "yellow";
    } else {
      status = "red";
    }
  }

  return {
    key,
    label: threshold.label,
    value,
    target: threshold.target,
    yellowFloor: threshold.yellowFloor,
    weight: threshold.weight,
    status,
    pctOfTarget,
    unit: threshold.unit,
    direction: threshold.direction,
    gaugeSize: threshold.gaugeSize,
  };
}

export function overallStatus(scoredMetrics: ScoredMetric[]): OverallStatus {
  const weighted = scoredMetrics.filter(
    (m) => m.weight > 0 && m.pctOfTarget !== null
  );
  if (weighted.length === 0) return "No Data";

  const totalWeight = weighted.reduce((sum, m) => sum + m.weight, 0);
  const weightedScore = weighted.reduce(
    (sum, m) => sum + (m.pctOfTarget ?? 0) * m.weight,
    0
  ) / totalWeight;

  if (weightedScore >= 1.0) return "Preferred";
  if (weightedScore >= 0.85) return "At Risk";
  return "Needs Improvement";
}

export function overallStatusColor(status: OverallStatus): string {
  switch (status) {
    case "Preferred": return "#2ECC71";
    case "At Risk": return "#F0A500";
    case "Needs Improvement": return "#E05C4B";
    case "No Data": return "#999999";
  }
}

export function operationalReadiness(scoredMetrics: ScoredMetric[]): number | null {
  const weighted = scoredMetrics.filter(
    (m) => m.weight > 0 && m.pctOfTarget !== null
  );
  if (weighted.length === 0) return null;

  const totalWeight = weighted.reduce((sum, m) => sum + m.weight, 0);
  const score = weighted.reduce(
    (sum, m) => sum + (m.pctOfTarget ?? 0) * m.weight,
    0
  ) / totalWeight;

  return Math.min(score * 100, 125);
}

export function calculateLeaderboardPoints(metrics: Record<string, number | null>): number {
  const appts = metrics.appointments_set ?? 0;
  const convos = metrics.conversations_2min ?? 0;
  const calls = metrics.call_attempts ?? metrics.call_volume ?? 0;
  const texts = metrics.texts_sent ?? 0;
  const emails = metrics.emails_sent ?? 0;

  return (
    appts * LEADERBOARD_WEIGHTS.appointments_set +
    convos * LEADERBOARD_WEIGHTS.conversations_2min +
    calls * LEADERBOARD_WEIGHTS.call_attempts +
    texts * LEADERBOARD_WEIGHTS.texts_sent +
    emails * LEADERBOARD_WEIGHTS.emails_sent
  );
}

export function checkZilpiEligibility(metrics: Record<string, number | null>): boolean {
  const pcvr = metrics.pcvr;
  const pickup = metrics.pickup_rate;
  if (pcvr === null || pcvr === undefined) return false;
  if (pickup === null || pickup === undefined) return false;
  return pcvr >= ZILPI_ELIGIBILITY.pcvr && pickup >= ZILPI_ELIGIBILITY.pickup_rate;
}

export function percentileRank(value: number, allValues: number[]): number {
  if (allValues.length === 0) return 0;
  const sorted = [...allValues].sort((a, b) => a - b);
  const below = sorted.filter((v) => v < value).length;
  const equal = sorted.filter((v) => v === value).length;
  return (below + 0.5 * equal) / sorted.length;
}

export function scoreAgent(agentData: AgentMetrics): ScoredAgent {
  const keys = metricKeys();
  const metricsMap: Record<string, ScoredMetric> = {};
  const metricsList: ScoredMetric[] = [];

  for (const key of keys) {
    const threshold = THRESHOLDS[key];
    if (!threshold) continue;
    const value = agentData.metrics[key] ?? null;
    const scored = scoreMetric(key, value, threshold);
    metricsMap[key] = scored;
    metricsList.push(scored);
  }

  const status = overallStatus(metricsList);
  const readiness = operationalReadiness(metricsList);
  const points = calculateLeaderboardPoints(agentData.metrics);
  const eligible = checkZilpiEligibility(agentData.metrics);

  return {
    agentId: agentData.agentId,
    name: agentData.name,
    email: agentData.email,
    period: agentData.period,
    metrics: metricsMap,
    metricsList,
    overallStatus: status,
    overallColor: overallStatusColor(status),
    operationalReadiness: readiness,
    leaderboardPoints: points,
    zilpiEligible: eligible,
    percentileRank: null, // set in team context
  };
}

export function scoreAllAgents(agents: AgentMetrics[]): ScoredAgent[] {
  const scored = agents.map(scoreAgent);

  // Calculate percentile ranks based on operational readiness
  const readinessValues = scored
    .map((a) => a.operationalReadiness)
    .filter((v): v is number => v !== null);

  for (const agent of scored) {
    if (agent.operationalReadiness !== null) {
      agent.percentileRank = percentileRank(
        agent.operationalReadiness,
        readinessValues
      );
    }
  }

  return scored.sort((a, b) => (b.operationalReadiness ?? 0) - (a.operationalReadiness ?? 0));
}

export function buildTeamSummary(scored: ScoredAgent[], period: string): TeamSummary {
  const readinessValues = scored
    .map((a) => a.operationalReadiness)
    .filter((v): v is number => v !== null);

  const avgReadiness = readinessValues.length > 0
    ? readinessValues.reduce((a, b) => a + b, 0) / readinessValues.length
    : 0;

  // Top 15% = Best of Zillow
  const cutoff = Math.max(1, Math.ceil(scored.length * 0.15));
  const topPerformers = scored.slice(0, cutoff);

  return {
    period,
    agents: scored,
    topPerformers,
    averageReadiness: avgReadiness,
    zilpiEligibleCount: scored.filter((a) => a.zilpiEligible).length,
  };
}

export function buildLeaderboard(agents: AgentMetrics[]): LeaderboardEntry[] {
  const entries: LeaderboardEntry[] = agents.map((a) => ({
    agentId: a.agentId,
    name: a.name,
    points: calculateLeaderboardPoints(a.metrics),
    rank: 0,
    appointments: (a.metrics.appointments_set ?? 0) as number,
    conversations2min: (a.metrics.conversations_2min ?? 0) as number,
    callAttempts: (a.metrics.call_attempts ?? a.metrics.call_volume ?? 0) as number,
    texts: (a.metrics.texts_sent ?? 0) as number,
    emails: (a.metrics.emails_sent ?? 0) as number,
  }));

  entries.sort((a, b) => b.points - a.points);
  entries.forEach((e, i) => { e.rank = i + 1; });

  return entries;
}

export function formatMetricValue(value: number | null, unit: string): string {
  if (value === null || value === undefined) return "N/A";
  switch (unit) {
    case "percent":
      return `${(value * 100).toFixed(1)}%`;
    case "seconds":
      if (value < 60) return `${Math.round(value)}s`;
      if (value < 3600) return `${Math.floor(value / 60)}m ${Math.round(value % 60)}s`;
      return `${Math.floor(value / 3600)}h ${Math.round((value % 3600) / 60)}m`;
    case "count":
      return value.toLocaleString();
    default:
      return String(value);
  }
}
