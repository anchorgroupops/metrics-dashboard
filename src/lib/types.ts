export interface Agent {
  id: string;
  name: string;
  email: string;
  role?: string;
}

export interface AgentMetrics {
  agentId: string;
  name: string;
  email: string;
  period: string; // YYYY-MM
  metrics: Record<string, number | null>;
}

export interface ThresholdConfig {
  label: string;
  weight: number;
  gaugeSize: "hero" | "secondary" | "supplementary";
  unit: "percent" | "seconds" | "count";
  target: number;
  yellowFloor: number;
  direction: "higher_is_better" | "lower_is_better";
  description: string;
}

export type MetricStatus = "green" | "yellow" | "red" | "no_data";

export interface ScoredMetric {
  key: string;
  label: string;
  value: number | null;
  target: number;
  yellowFloor: number;
  weight: number;
  status: MetricStatus;
  pctOfTarget: number | null;
  unit: "percent" | "seconds" | "count";
  direction: "higher_is_better" | "lower_is_better";
  gaugeSize: "hero" | "secondary" | "supplementary";
}

export type OverallStatus = "Preferred" | "At Risk" | "Needs Improvement" | "No Data";

export interface ScoredAgent {
  agentId: string;
  name: string;
  email: string;
  period: string;
  metrics: Record<string, ScoredMetric>;
  metricsList: ScoredMetric[];
  overallStatus: OverallStatus;
  overallColor: string;
  operationalReadiness: number | null;
  leaderboardPoints: number;
  zilpiEligible: boolean;
  percentileRank: number | null;
}

export interface TeamSummary {
  period: string;
  agents: ScoredAgent[];
  topPerformers: ScoredAgent[];
  averageReadiness: number;
  zilpiEligibleCount: number;
}

export interface LeaderboardEntry {
  agentId: string;
  name: string;
  points: number;
  rank: number;
  appointments: number;
  conversations2min: number;
  callAttempts: number;
  texts: number;
  emails: number;
}

export interface DailySnapshot {
  agentId: string;
  name: string;
  snapshotDate: string; // YYYY-MM-DD
  metrics: Record<string, number | null>;
  activityPoints: number;
}
