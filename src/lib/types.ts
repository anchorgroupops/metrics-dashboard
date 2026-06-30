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
  target: number; // Zillow Preferred minimum (the "100% of target" line)
  yellowFloor: number;
  direction: "higher_is_better" | "lower_is_better";
  description: string;
  // Gauge bands in natural units (Best of Zillow / Elite cutoffs + axis ceiling).
  bozThreshold?: number; // Best of Zillow (top 15%)
  eliteThreshold?: number; // Elite (top 1%)
  axisMax?: number; // upper bound of the gauge axis
  // 2026 milestone goal beyond the minimum (Superior / Elite / Optimized / BoZ).
  milestone?: number; // natural-unit target to unlock the advantage
  milestoneLabel?: string; // e.g. "Elite", "Superior"
  advantage?: string; // short "why it matters" (lead benefit)
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
  // Gauge bands (natural units) carried through for rendering.
  bozThreshold?: number;
  eliteThreshold?: number;
  axisMax?: number;
  milestone?: number;
  milestoneLabel?: string;
  advantage?: string;
}

export type OverallStatus = "Preferred" | "At Risk" | "Needs Improvement" | "No Data";

import type { Tier, ZillowFlags } from "./population";
export type { Tier, ZillowFlags } from "./population";

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
  // Multi-tier scoring (Phase 2)
  populationPercentile: number | null; // PERCENT_RANK vs estimated Zillow population
  tier: Tier; // "elite" | "boz" | "standard" | "unranked"
  flags: ZillowFlags; // pCVR / pickup-rate threshold flagging
}

export interface TeamSummary {
  period: string;
  agents: ScoredAgent[];
  topPerformers: ScoredAgent[];
  averageReadiness: number;
  zilpiEligibleCount: number;
  bozCount: number; // BOZ or better (top 15%)
  eliteCount: number; // ELITE (top 1%)
  flaggedCount: number; // below a Zillow Preferred threshold
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

// ── Data-pipeline domain types ────────────────────────────────────────────────

// Activity surface pulled from the Follow Up Boss API for one agent/period.
export interface FubMetricRecord {
  agentId: string; // FUB user id (string)
  period: string; // YYYY-MM
  calls: number;
  texts: number;
  appointments: number;
  deals: number;
  nurtureTasks: number;
  zillowLeads: number;
}

// Metrics scraped from the Zillow Preferred UI for one agent/period. These are
// not exposed by the FUB API. Any field may be null when the report omits it.
export interface ZillowMetricRecord {
  agentId: string; // matched to FUB user id where possible
  agentName: string;
  period: string; // YYYY-MM
  pcvr: number | null; // Predicted Conversion Rate, decimal 0-1
  pickupRate: number | null; // decimal 0-1
  zhlPreapproval: number | null; // decimal 0-1 progress to target
  csat: number | null; // decimal 0-1
  connections: number | null;
  leads: number | null;
}

// One agent's identity across all source systems — the join key surface the
// integrity check validates.
export interface AgentLink {
  id: string; // internal agent id
  fubId: string | null; // FUB user id
  name: string;
  email: string;
  teamId: string | null;
}

export interface IntegrityIssue {
  severity: "error" | "warning";
  code: string;
  agentId?: string;
  message: string;
}

export interface IntegrityReport {
  ok: boolean;
  checked: number;
  errors: IntegrityIssue[];
  warnings: IntegrityIssue[];
}
