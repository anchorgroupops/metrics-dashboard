import { describe, it, expect } from "vitest";
import {
  scoreAgent,
  scoreAllAgents,
  buildTeamSummary,
  computeTeamAverages,
  teamPercentRanks,
} from "@/lib/scoring";
import { getSampleAgents } from "@/lib/sample-data";
import type { AgentMetrics } from "@/lib/types";

describe("scoreAgent tiering + flags", () => {
  it("assigns ELITE for top-1% pCVR and not flagged", () => {
    const a = scoreAgent({
      agentId: "x",
      name: "Elite",
      email: "",
      period: "2026-06",
      metrics: { pcvr: 0.1, pickup_rate: 0.6 },
    });
    expect(a.tier).toBe("elite");
    expect(a.populationPercentile).toBeCloseTo(0.99);
    expect(a.flags.flagged).toBe(false);
  });

  it("assigns BOZ at the 4% pCVR cutoff", () => {
    const a = scoreAgent({
      agentId: "x",
      name: "Boz",
      email: "",
      period: "2026-06",
      metrics: { pcvr: 0.04, pickup_rate: 0.25 },
    });
    expect(a.tier).toBe("boz");
  });

  it("flags an agent below the Zillow thresholds", () => {
    const a = scoreAgent({
      agentId: "x",
      name: "Low",
      email: "",
      period: "2026-06",
      metrics: { pcvr: 0.02, pickup_rate: 0.18 },
    });
    expect(a.tier).toBe("standard");
    expect(a.flags.flagged).toBe(true);
    expect(a.flags.reasons.length).toBe(2);
  });

  it("is unranked when pCVR is missing", () => {
    const a = scoreAgent({
      agentId: "x",
      name: "NoData",
      email: "",
      period: "2026-06",
      metrics: { pickup_rate: 0.3 },
    });
    expect(a.tier).toBe("unranked");
    expect(a.populationPercentile).toBeNull();
  });
});

describe("buildTeamSummary counts", () => {
  it("counts BOZ, elite, and flagged across the team", () => {
    const scored = scoreAllAgents(getSampleAgents());
    const summary = buildTeamSummary(scored, "2026-06");
    // Sample set has several agents ≥ 4% pCVR (BOZ) and several below.
    expect(summary.bozCount).toBeGreaterThan(0);
    expect(summary.bozCount).toBe(scored.filter((a) => a.tier === "boz" || a.tier === "elite").length);
    expect(summary.flaggedCount).toBe(scored.filter((a) => a.flags.flagged).length);
    expect(summary.topPerformers.length).toBe(summary.bozCount);
  });
});

describe("computeTeamAverages", () => {
  it("averages each metric only over agents with data", () => {
    const agents: AgentMetrics[] = [
      { agentId: "a", name: "A", email: "", period: "p", metrics: { pcvr: 0.04, zhl_preapproval: 0.8 } },
      { agentId: "b", name: "B", email: "", period: "p", metrics: { pcvr: 0.06, zhl_preapproval: null } },
    ];
    const scored = scoreAllAgents(agents);
    const avg = computeTeamAverages(scored);
    expect(avg.pcvr).toBeCloseTo(0.05);
    expect(avg.zhl_preapproval).toBeCloseTo(0.8); // only one agent had data
  });
});

describe("teamPercentRanks", () => {
  it("ranks agents within the observed team by readiness", () => {
    const scored = scoreAllAgents(getSampleAgents());
    const ranks = teamPercentRanks(scored);
    const values = Object.values(ranks);
    // Every rank is a valid percentile, and the lowest performer ranks 0.
    expect(values.every((v) => v >= 0 && v <= 1)).toBe(true);
    expect(Math.min(...values)).toBeCloseTo(0.0);
    // The highest-readiness agent holds the top rank.
    const top = [...scored].sort(
      (a, b) => (b.operationalReadiness ?? 0) - (a.operationalReadiness ?? 0),
    )[0];
    expect(ranks[top.agentId]).toBe(Math.max(...values));
  });
});
