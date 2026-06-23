import { ThresholdConfig } from "./types";

/**
 * The official 2026 Zillow Preferred scorecard — four weighted metrics that sum
 * to 100% (source: "Cracking the Zillow Preferred Code", The Anchor Team):
 *
 *   pCVR            50%  — Predicted Conversion Rate, ≥ 4.0% to qualify
 *   Pickup Rate     25%  — Live-connection pickup, ≥ 25% (goal > 30%)
 *   ZHL Pre-Approval15%  — 100% of assigned ZHL target, 90-day rolling
 *   CSAT            10%  — top-15% satisfaction across 24h/15d/45d surveys
 *
 * `target` is the Zillow Preferred minimum (the gauge's 100%-of-target line);
 * `bozThreshold`/`eliteThreshold` are the Best-of-Zillow (top 15%) and Elite
 * (top 1%) cutoffs, and `axisMax` bounds the gauge. Gauge size follows weight.
 */
export const THRESHOLDS: Record<string, ThresholdConfig> = {
  pcvr: {
    label: "Predicted Conversion Rate",
    weight: 0.5,
    gaugeSize: "hero",
    unit: "percent",
    target: 0.04,
    yellowFloor: 0.02,
    direction: "higher_is_better",
    bozThreshold: 0.06,
    eliteThreshold: 0.1,
    axisMax: 0.12,
    milestone: 0.045,
    milestoneLabel: "Elite",
    advantage: "Elite (≥4.5%): prioritized for the highest-intent leads & live concierge transfers.",
    description: "Probability-weighted close rate over your last 90 days (≥4% to qualify)",
  },
  pickup_rate: {
    label: "Live Connection Pickup Rate",
    weight: 0.25,
    gaugeSize: "secondary",
    unit: "percent",
    target: 0.25,
    yellowFloor: 0.15,
    direction: "higher_is_better",
    bozThreshold: 0.35,
    eliteThreshold: 0.6,
    axisMax: 0.7,
    milestone: 0.3,
    milestoneLabel: "Superior",
    advantage: "Superior (≥30%): unlocks Luxury Lead Priority — high-end concierge transfers.",
    description: "Live-connection calls answered in the moment (≥25% min, >30% goal)",
  },
  zhl_preapproval: {
    label: "ZHL Pre-Approval",
    weight: 0.15,
    gaugeSize: "secondary",
    unit: "percent",
    target: 1.0,
    yellowFloor: 0.75,
    direction: "higher_is_better",
    bozThreshold: 2.0,
    eliteThreshold: 2.8,
    axisMax: 3.0,
    milestone: 1.0,
    milestoneLabel: "Optimized",
    advantage: "Optimized (100%): unlocks Direct ZHL hand-offs — pre-approved buyers 1.9× likelier to close.",
    description: "Percent of your assigned ZHL pre-approval target over a 90-day rolling window",
  },
  csat: {
    label: "Customer Satisfaction (CSAT)",
    weight: 0.1,
    gaugeSize: "supplementary",
    unit: "percent",
    target: 0.85,
    yellowFloor: 0.7,
    direction: "higher_is_better",
    bozThreshold: 0.9,
    eliteThreshold: 0.95,
    axisMax: 1.0,
    milestone: 0.9,
    milestoneLabel: "Best of Zillow",
    advantage: "Best of Zillow (90+): a branding moat — exclusive 'My Agent' visibility on listings.",
    description: "Top-15% satisfaction across the 24-hour, 15-day, and 45-day buyer surveys",
  },
};

/**
 * Operational speed goal — not part of the weighted Zillow Preferred score, but
 * the single biggest conversion lever. Displayed as its own gauge.
 */
export const SPEED_METRIC: ThresholdConfig = {
  label: "Speed to Lead",
  weight: 0,
  gaugeSize: "secondary",
  unit: "seconds",
  target: 60, // World-Class: respond in under 60 seconds
  yellowFloor: 300,
  direction: "lower_is_better",
  bozThreshold: 60,
  eliteThreshold: 30,
  axisMax: 600,
  milestone: 60,
  milestoneLabel: "World-Class",
  advantage: "Under 60s: +391% conversion. 78% of buyers work with whoever responds first.",
  description: "Median seconds from lead assignment to first contact (top 1% respond in <60s)",
};

// Zillow Preferred eligibility thresholds (hard numeric minimums).
export const ZILPI_ELIGIBILITY = {
  pcvr: 0.04, // >= 4% conversion rate
  pickup_rate: 0.25, // >= 25% pickup rate
};

// Elite (Top 1%) benchmarks.
export const ELITE_BENCHMARKS = {
  conversion_rate: 0.1, // >= 10%
  answer_rate: 0.6, // >= 60%
};

// Leaderboard point weights (operational activity gamification).
export const LEADERBOARD_WEIGHTS = {
  appointments_set: 500,
  conversations_2min: 100,
  call_attempts: 10,
  texts_sent: 2,
  emails_sent: 1,
};
