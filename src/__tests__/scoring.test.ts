import { describe, it, expect } from "vitest";
import {
  scoreMetric,
  overallStatus,
  operationalReadiness,
  calculateLeaderboardPoints,
  checkZilpiEligibility,
  percentileRank,
  scoreAgent,
  scoreAllAgents,
  buildTeamSummary,
  buildLeaderboard,
  formatMetricValue,
  metricKeys,
} from "@/lib/scoring";
import { THRESHOLDS } from "@/lib/thresholds";

describe("metricKeys", () => {
  it("returns hero metrics first", () => {
    const keys = metricKeys();
    expect(keys[0]).toBe("pcvr");
    expect(keys.length).toBeGreaterThan(0);
  });

  it("sorts by gauge size then weight", () => {
    const keys = metricKeys();
    const pcvrIdx = keys.indexOf("pcvr");
    const pickupIdx = keys.indexOf("pickup_rate");
    const callsIdx = keys.indexOf("calls_made");
    expect(pcvrIdx).toBeLessThan(pickupIdx);
    expect(pickupIdx).toBeLessThan(callsIdx);
  });
});

describe("scoreMetric", () => {
  it("returns green for value >= target (higher_is_better)", () => {
    const result = scoreMetric("pcvr", 0.05, THRESHOLDS.pcvr);
    expect(result.status).toBe("green");
    expect(result.pctOfTarget).toBeCloseTo(1.25);
  });

  it("returns yellow for value between yellowFloor and target", () => {
    const result = scoreMetric("pcvr", 0.03, THRESHOLDS.pcvr);
    expect(result.status).toBe("yellow");
    expect(result.pctOfTarget).toBeCloseTo(0.75);
  });

  it("returns red for value below yellowFloor", () => {
    const result = scoreMetric("pcvr", 0.01, THRESHOLDS.pcvr);
    expect(result.status).toBe("red");
  });

  it("returns no_data for null value", () => {
    const result = scoreMetric("pcvr", null, THRESHOLDS.pcvr);
    expect(result.status).toBe("no_data");
    expect(result.pctOfTarget).toBeNull();
  });

  it("handles lower_is_better (speed_to_lead)", () => {
    // 85s is below 120s target = green
    const green = scoreMetric("speed_to_lead", 85, THRESHOLDS.speed_to_lead);
    expect(green.status).toBe("green");

    // 200s is above target but below yellowFloor of 300 = yellow
    const yellow = scoreMetric("speed_to_lead", 200, THRESHOLDS.speed_to_lead);
    expect(yellow.status).toBe("yellow");

    // 400s is above yellowFloor = red
    const red = scoreMetric("speed_to_lead", 400, THRESHOLDS.speed_to_lead);
    expect(red.status).toBe("red");
  });

  it("computes pct_of_target correctly for lower_is_better", () => {
    // 60s speed when target is 120s => pct = 120/60 = 2.0
    const result = scoreMetric("speed_to_lead", 60, THRESHOLDS.speed_to_lead);
    expect(result.pctOfTarget).toBeCloseTo(2.0);
  });
});

describe("overallStatus", () => {
  it("returns Preferred when weighted score >= 1.0", () => {
    const metrics = [
      scoreMetric("pcvr", 0.05, THRESHOLDS.pcvr),
      scoreMetric("pickup_rate", 0.30, THRESHOLDS.pickup_rate),
      scoreMetric("speed_to_lead", 100, THRESHOLDS.speed_to_lead),
      scoreMetric("appt_rate", 0.35, THRESHOLDS.appt_rate),
    ];
    expect(overallStatus(metrics)).toBe("Preferred");
  });

  it("returns At Risk when weighted score between 0.85 and 1.0", () => {
    const metrics = [
      scoreMetric("pcvr", 0.035, THRESHOLDS.pcvr),
      scoreMetric("pickup_rate", 0.22, THRESHOLDS.pickup_rate),
      scoreMetric("speed_to_lead", 135, THRESHOLDS.speed_to_lead),
      scoreMetric("appt_rate", 0.26, THRESHOLDS.appt_rate),
    ];
    expect(overallStatus(metrics)).toBe("At Risk");
  });

  it("returns No Data when all metrics are null", () => {
    const metrics = [
      scoreMetric("pcvr", null, THRESHOLDS.pcvr),
      scoreMetric("pickup_rate", null, THRESHOLDS.pickup_rate),
    ];
    expect(overallStatus(metrics)).toBe("No Data");
  });

  it("ignores zero-weight metrics", () => {
    const metrics = [
      scoreMetric("pcvr", 0.05, THRESHOLDS.pcvr),
      scoreMetric("calls_made", 50, THRESHOLDS.calls_made), // weight 0
    ];
    expect(overallStatus(metrics)).toBe("Preferred");
  });
});

describe("operationalReadiness", () => {
  it("returns 0-125 range score", () => {
    const metrics = [
      scoreMetric("pcvr", 0.05, THRESHOLDS.pcvr),
      scoreMetric("pickup_rate", 0.30, THRESHOLDS.pickup_rate),
    ];
    const result = operationalReadiness(metrics);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThanOrEqual(125);
  });

  it("returns null when all metrics are no_data", () => {
    const metrics = [scoreMetric("pcvr", null, THRESHOLDS.pcvr)];
    expect(operationalReadiness(metrics)).toBeNull();
  });

  it("caps at 125", () => {
    const metrics = [
      scoreMetric("pcvr", 0.20, THRESHOLDS.pcvr), // 5x target
    ];
    expect(operationalReadiness(metrics)).toBe(125);
  });
});

describe("calculateLeaderboardPoints", () => {
  it("weights correctly: appts=500, 2min=100, calls=10, texts=2, emails=1", () => {
    const points = calculateLeaderboardPoints({
      appointments_set: 1,
      conversations_2min: 1,
      call_attempts: 1,
      texts_sent: 1,
      emails_sent: 1,
    });
    expect(points).toBe(500 + 100 + 10 + 2 + 1);
  });

  it("handles null values as zero", () => {
    const points = calculateLeaderboardPoints({
      appointments_set: 2,
      conversations_2min: null,
      call_attempts: null,
      texts_sent: null,
      emails_sent: null,
    });
    expect(points).toBe(1000);
  });

  it("uses call_volume as fallback for call_attempts", () => {
    const points = calculateLeaderboardPoints({
      appointments_set: 0,
      conversations_2min: 0,
      call_volume: 100,
      texts_sent: 0,
      emails_sent: 0,
    });
    expect(points).toBe(1000);
  });
});

describe("checkZilpiEligibility", () => {
  it("returns true when pCVR >= 4% and pickup >= 25%", () => {
    expect(checkZilpiEligibility({ pcvr: 0.04, pickup_rate: 0.25 })).toBe(true);
    expect(checkZilpiEligibility({ pcvr: 0.06, pickup_rate: 0.40 })).toBe(true);
  });

  it("returns false when either metric is below threshold", () => {
    expect(checkZilpiEligibility({ pcvr: 0.03, pickup_rate: 0.30 })).toBe(false);
    expect(checkZilpiEligibility({ pcvr: 0.05, pickup_rate: 0.20 })).toBe(false);
  });

  it("returns false when metrics are null", () => {
    expect(checkZilpiEligibility({ pcvr: null, pickup_rate: 0.30 })).toBe(false);
    expect(checkZilpiEligibility({ pcvr: 0.05, pickup_rate: null })).toBe(false);
  });
});

describe("percentileRank", () => {
  it("computes PERCENT_RANK style ranking", () => {
    const values = [10, 20, 30, 40, 50];
    expect(percentileRank(50, values)).toBeCloseTo(0.9); // top performer
    expect(percentileRank(10, values)).toBeCloseTo(0.1); // bottom
  });

  it("returns 0 for empty array", () => {
    expect(percentileRank(42, [])).toBe(0);
  });
});

describe("scoreAgent", () => {
  it("produces a complete ScoredAgent", () => {
    const agent = scoreAgent({
      agentId: "test-1",
      name: "Test Agent",
      email: "test@example.com",
      period: "2026-06",
      metrics: {
        pcvr: 0.05,
        pickup_rate: 0.32,
        speed_to_lead: 90,
        appt_rate: 0.30,
      },
    });

    expect(agent.agentId).toBe("test-1");
    expect(agent.overallStatus).toBe("Preferred");
    expect(agent.zilpiEligible).toBe(true);
    expect(agent.operationalReadiness).toBeGreaterThan(0);
    expect(agent.metricsList.length).toBeGreaterThan(0);
  });
});

describe("scoreAllAgents", () => {
  it("sorts by operational readiness descending", () => {
    const scored = scoreAllAgents([
      { agentId: "a", name: "Low", email: "", period: "2026-06", metrics: { pcvr: 0.01 } },
      { agentId: "b", name: "High", email: "", period: "2026-06", metrics: { pcvr: 0.08 } },
    ]);
    expect(scored[0].name).toBe("High");
    expect(scored[1].name).toBe("Low");
  });

  it("assigns percentile ranks", () => {
    const scored = scoreAllAgents([
      { agentId: "a", name: "A", email: "", period: "2026-06", metrics: { pcvr: 0.01 } },
      { agentId: "b", name: "B", email: "", period: "2026-06", metrics: { pcvr: 0.05 } },
      { agentId: "c", name: "C", email: "", period: "2026-06", metrics: { pcvr: 0.08 } },
    ]);
    // C should have highest percentile
    expect(scored[0].percentileRank).toBeGreaterThan(scored[2].percentileRank!);
  });
});

describe("buildTeamSummary", () => {
  it("identifies BOZ+ performers dynamically (population-based)", () => {
    const agents = Array.from({ length: 10 }, (_, i) => ({
      agentId: `a${i}`,
      name: `Agent ${i}`,
      email: "",
      period: "2026-06",
      metrics: { pcvr: 0.01 + i * 0.005 },
    }));
    const scored = scoreAllAgents(agents);
    const summary = buildTeamSummary(scored, "2026-06");
    // pCVR ≥ 4% (BOZ cutoff) → i ≥ 6 → 4 agents.
    expect(summary.bozCount).toBe(4);
    expect(summary.topPerformers.length).toBe(summary.bozCount);
    expect(summary.topPerformers.every((a) => a.tier === "boz" || a.tier === "elite")).toBe(true);
  });

  it("falls back to the local top 15% when no agent reaches BOZ", () => {
    const agents = Array.from({ length: 10 }, (_, i) => ({
      agentId: `a${i}`,
      name: `Agent ${i}`,
      email: "",
      period: "2026-06",
      metrics: { pcvr: 0.005 + i * 0.001 }, // all below 4%
    }));
    const scored = scoreAllAgents(agents);
    const summary = buildTeamSummary(scored, "2026-06");
    expect(summary.bozCount).toBe(0);
    expect(summary.topPerformers.length).toBe(2); // ceil(10 * 0.15)
  });
});

describe("buildLeaderboard", () => {
  it("ranks agents by points descending", () => {
    const lb = buildLeaderboard([
      { agentId: "a", name: "Few", email: "", period: "2026-06", metrics: { appointments_set: 1, conversations_2min: 0, call_attempts: 0, texts_sent: 0, emails_sent: 0 } },
      { agentId: "b", name: "Many", email: "", period: "2026-06", metrics: { appointments_set: 10, conversations_2min: 5, call_attempts: 100, texts_sent: 50, emails_sent: 20 } },
    ]);
    expect(lb[0].name).toBe("Many");
    expect(lb[0].rank).toBe(1);
    expect(lb[1].rank).toBe(2);
  });
});

describe("formatMetricValue", () => {
  it("formats percentages", () => {
    expect(formatMetricValue(0.045, "percent")).toBe("4.5%");
    expect(formatMetricValue(1.0, "percent")).toBe("100.0%");
  });

  it("formats seconds intelligently", () => {
    expect(formatMetricValue(45, "seconds")).toBe("45s");
    expect(formatMetricValue(150, "seconds")).toBe("2m 30s");
    expect(formatMetricValue(7200, "seconds")).toBe("2h 0m");
  });

  it("formats counts with locale separators", () => {
    expect(formatMetricValue(1234, "count")).toBe("1,234");
  });

  it("returns N/A for null", () => {
    expect(formatMetricValue(null, "percent")).toBe("N/A");
  });
});
