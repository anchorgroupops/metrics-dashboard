import { ThresholdConfig } from "./types";

export const THRESHOLDS: Record<string, ThresholdConfig> = {
  pcvr: {
    label: "Predicted Conversion Rate",
    weight: 0.5,
    gaugeSize: "hero",
    unit: "percent",
    target: 0.04,
    yellowFloor: 0.02,
    direction: "higher_is_better",
    description: "Zillow leads converted to closed deals over 180-day window",
  },
  pickup_rate: {
    label: "Pickup Rate",
    weight: 0.25,
    gaugeSize: "secondary",
    unit: "percent",
    target: 0.25,
    yellowFloor: 0.15,
    direction: "higher_is_better",
    description: "Outbound calls answered by leads",
  },
  speed_to_lead: {
    label: "Speed to Lead",
    weight: 0.15,
    gaugeSize: "secondary",
    unit: "seconds",
    target: 120,
    yellowFloor: 300,
    direction: "lower_is_better",
    description: "Median seconds from lead assignment to first contact",
  },
  appt_rate: {
    label: "Appointment Rate",
    weight: 0.1,
    gaugeSize: "secondary",
    unit: "percent",
    target: 0.30,
    yellowFloor: 0.15,
    direction: "higher_is_better",
    description: "Appointments set per Zillow lead",
  },
  csat: {
    label: "Client Satisfaction",
    weight: 0,
    gaugeSize: "supplementary",
    unit: "percent",
    target: 0.85,
    yellowFloor: 0.70,
    direction: "higher_is_better",
    description: "Top 15% on Zillow client surveys (Best of Zillow)",
  },
  zhl_preapproval: {
    label: "ZHL Pre-Approval",
    weight: 0,
    gaugeSize: "supplementary",
    unit: "percent",
    target: 1.0,
    yellowFloor: 0.75,
    direction: "higher_is_better",
    description: "ZHL pre-approval achievement against 100% target",
  },
  calls_made: {
    label: "Calls Made",
    weight: 0,
    gaugeSize: "supplementary",
    unit: "count",
    target: 400,
    yellowFloor: 200,
    direction: "higher_is_better",
    description: "Monthly outbound call volume",
  },
};

// Zillow Preferred eligibility thresholds (hard numeric checks)
export const ZILPI_ELIGIBILITY = {
  pcvr: 0.04,      // >= 4% conversion rate
  pickup_rate: 0.25, // >= 25% pickup rate
};

// Elite (Top 1%) benchmarks
export const ELITE_BENCHMARKS = {
  conversion_rate: 0.10, // >= 10%
  answer_rate: 0.60,     // >= 60%
};

// Leaderboard point weights
export const LEADERBOARD_WEIGHTS = {
  appointments_set: 500,
  conversations_2min: 100,
  call_attempts: 10,
  texts_sent: 2,
  emails_sent: 1,
};
