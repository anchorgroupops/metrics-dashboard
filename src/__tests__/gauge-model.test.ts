import { describe, it, expect } from "vitest";
import { pctOfTarget, buildGaugeModel } from "@/lib/gauge-model";
import { scoreMetric } from "@/lib/scoring";
import { THRESHOLDS } from "@/lib/thresholds";

describe("pctOfTarget", () => {
  it("normalizes higher-is-better to % of target", () => {
    expect(pctOfTarget(0.05, 0.04)).toBeCloseTo(125);
    expect(pctOfTarget(0.04, 0.04)).toBeCloseTo(100);
  });
  it("inverts lower-is-better so faster reads above 100%", () => {
    expect(pctOfTarget(60, 120, "lower_is_better")).toBeCloseTo(200);
    expect(pctOfTarget(240, 120, "lower_is_better")).toBeCloseTo(50);
  });
  it("is null-safe", () => {
    expect(pctOfTarget(null, 0.04)).toBeNull();
  });
});

describe("buildGaugeModel", () => {
  it("maps a pCVR metric onto the % - of - target axis", () => {
    const metric = scoreMetric("pcvr", 0.06, THRESHOLDS.pcvr);
    const m = buildGaugeModel({
      metric,
      teamAverage: 0.045,
      performers: [
        { name: "Top", value: 0.1 },
        { name: "Mid", value: 0.05 },
        { name: "NoData", value: null },
      ],
    });
    expect(m.value).toBe(150); // 0.06 / 0.04
    expect(m.minimumThreshold).toBe(100);
    expect(m.bozThreshold).toBe(150); // 0.06 / 0.04
    expect(m.eliteThreshold).toBe(250); // 0.10 / 0.04
    expect(m.max).toBe(300); // axisMax 0.12 / 0.04
    expect(m.valueLabel).toBe("6.0%");
    expect(m.teamAverage).toBe(113); // 0.045 / 0.04 ≈ 112.5 → 113
    expect(m.performers).toEqual([
      { name: "Top", value: 250 },
      { name: "Mid", value: 125 },
    ]);
  });

  it("keeps the minimum at 100% for CSAT (compressed axis)", () => {
    const metric = scoreMetric("csat", 0.92, THRESHOLDS.csat);
    const m = buildGaugeModel({ metric });
    expect(m.minimumThreshold).toBe(100);
    expect(m.value).toBeGreaterThan(100); // 0.92 / 0.85
    expect(m.max).toBeGreaterThanOrEqual(m.eliteThreshold + 15);
  });
});
