import { describe, it, expect } from "vitest";
import {
  percentRankFromAnchors,
  estimatePopulationPercentRank,
  valueAtPercentile,
  bozThresholdValue,
  eliteThresholdValue,
  classifyTier,
  sqlPercentRank,
  zillowThresholdFlags,
  POPULATION_ANCHORS,
  BOZ_PERCENTILE,
  ELITE_PERCENTILE,
} from "@/lib/population";

describe("percentRankFromAnchors", () => {
  const anchors = POPULATION_ANCHORS.pcvr;
  it("returns anchor percentiles exactly at control points", () => {
    expect(percentRankFromAnchors(anchors, 0.02)).toBeCloseTo(0.5);
    expect(percentRankFromAnchors(anchors, 0.04)).toBeCloseTo(0.85);
    expect(percentRankFromAnchors(anchors, 0.1)).toBeCloseTo(0.99);
  });
  it("interpolates between control points", () => {
    // halfway between 0.02 (0.5) and 0.04 (0.85) → 0.03 ≈ 0.675
    expect(percentRankFromAnchors(anchors, 0.03)).toBeCloseTo(0.675, 3);
  });
  it("clamps below/above range", () => {
    expect(percentRankFromAnchors(anchors, -1)).toBe(0);
    expect(percentRankFromAnchors(anchors, 5)).toBe(1);
  });
});

describe("estimatePopulationPercentRank", () => {
  it("maps Zillow benchmarks to BOZ/ELITE percentiles", () => {
    expect(estimatePopulationPercentRank("pcvr", 0.04)).toBeCloseTo(BOZ_PERCENTILE);
    expect(estimatePopulationPercentRank("pcvr", 0.1)).toBeCloseTo(ELITE_PERCENTILE);
    expect(estimatePopulationPercentRank("pickup_rate", 0.25)).toBeCloseTo(BOZ_PERCENTILE);
    expect(estimatePopulationPercentRank("pickup_rate", 0.6)).toBeCloseTo(ELITE_PERCENTILE);
  });
  it("returns null for unmodeled metrics", () => {
    expect(estimatePopulationPercentRank("speed_to_lead", 100)).toBeNull();
  });
});

describe("threshold values invert the CDF", () => {
  it("BOZ/ELITE cutoffs match the published thresholds", () => {
    expect(bozThresholdValue("pcvr")).toBeCloseTo(0.04);
    expect(eliteThresholdValue("pcvr")).toBeCloseTo(0.1);
    expect(bozThresholdValue("pickup_rate")).toBeCloseTo(0.25);
    expect(eliteThresholdValue("pickup_rate")).toBeCloseTo(0.6);
  });
  it("round-trips value→percentile→value", () => {
    const p = estimatePopulationPercentRank("pcvr", 0.05)!;
    expect(valueAtPercentile("pcvr", p)).toBeCloseTo(0.05, 3);
  });
});

describe("classifyTier", () => {
  it("classifies by percentile cutoffs", () => {
    expect(classifyTier(0.995)).toBe("elite");
    expect(classifyTier(0.99)).toBe("elite");
    expect(classifyTier(0.9)).toBe("boz");
    expect(classifyTier(0.85)).toBe("boz");
    expect(classifyTier(0.84)).toBe("standard");
    expect(classifyTier(null)).toBe("unranked");
  });
});

describe("sqlPercentRank (SQL PERCENT_RANK semantics)", () => {
  it("computes (rank-1)/(n-1)", () => {
    const v = [10, 20, 30, 40, 50];
    expect(sqlPercentRank(v, 10)).toBeCloseTo(0);
    expect(sqlPercentRank(v, 30)).toBeCloseTo(0.5);
    expect(sqlPercentRank(v, 50)).toBeCloseTo(1.0);
  });
  it("ties take the first matching rank", () => {
    const v = [10, 20, 20, 40];
    expect(sqlPercentRank(v, 20)).toBeCloseTo(1 / 3);
  });
  it("single-element sample ranks 0", () => {
    expect(sqlPercentRank([42], 42)).toBe(0);
  });
});

describe("zillowThresholdFlags", () => {
  it("passes when pCVR ≥ 4% and pickup ≥ 25%", () => {
    const f = zillowThresholdFlags({ pcvr: 0.05, pickup_rate: 0.3 });
    expect(f.pcvrPass).toBe(true);
    expect(f.pickupPass).toBe(true);
    expect(f.flagged).toBe(false);
    expect(f.reasons).toHaveLength(0);
  });
  it("flags and explains when below threshold", () => {
    const f = zillowThresholdFlags({ pcvr: 0.03, pickup_rate: 0.2 });
    expect(f.flagged).toBe(true);
    expect(f.reasons).toContain("pCVR below 4.0%");
    expect(f.reasons).toContain("Pickup rate below 25%");
  });
  it("treats missing metrics as failing", () => {
    const f = zillowThresholdFlags({ pcvr: null, pickup_rate: null });
    expect(f.flagged).toBe(true);
    expect(f.pcvrPass).toBe(false);
  });
});
