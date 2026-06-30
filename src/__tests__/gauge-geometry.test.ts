import { describe, it, expect } from "vitest";
import {
  valueToFraction,
  fractionToAngle,
  valueToAngle,
  polar,
  groupByValue,
  topPerformers,
  formatPercentOfTarget,
} from "@/lib/gauge-geometry";

describe("valueToFraction", () => {
  it("maps value to a clamped [0,1] fraction", () => {
    expect(valueToFraction(150, 0, 300)).toBeCloseTo(0.5);
    expect(valueToFraction(0, 0, 300)).toBe(0);
    expect(valueToFraction(300, 0, 300)).toBe(1);
    expect(valueToFraction(450, 0, 300)).toBe(1); // clamped
    expect(valueToFraction(-50, 0, 300)).toBe(0); // clamped
  });
});

describe("fractionToAngle / valueToAngle", () => {
  it("spans π (min) to 2π (max)", () => {
    expect(fractionToAngle(0)).toBeCloseTo(Math.PI);
    expect(fractionToAngle(1)).toBeCloseTo(2 * Math.PI);
    expect(valueToAngle(150, 0, 300)).toBeCloseTo(1.5 * Math.PI);
  });
});

describe("polar", () => {
  it("places the min point at the left of the circle", () => {
    const p = polar(500, 470, Math.PI, 320);
    expect(p.x).toBeCloseTo(180);
    expect(p.y).toBeCloseTo(470);
  });
});

describe("groupByValue / topPerformers", () => {
  const perf = [
    { name: "Paige McKinny", value: 250 },
    { name: "John Collinge", value: 200 },
    { name: "Vanessa Arnold", value: 200 },
    { name: "Angela Cerniglia", value: 200 },
    { name: "Sam Lowe", value: 120 },
  ];

  it("merges ties and sorts by value descending", () => {
    const groups = groupByValue(perf);
    expect(groups[0]).toEqual({ value: 250, names: ["Paige McKinny"] });
    expect(groups[1].value).toBe(200);
    expect(groups[1].names).toHaveLength(3);
    expect(groups[1].names).toContain("Angela Cerniglia");
  });

  it("takes the top N tie-groups as single slots", () => {
    const tops = topPerformers(perf, 3);
    expect(tops.map((g) => g.value)).toEqual([250, 200, 120]);
  });
});

describe("formatPercentOfTarget", () => {
  it("rounds to a whole percent", () => {
    expect(formatPercentOfTarget(129.4)).toBe("129%");
    expect(formatPercentOfTarget(200)).toBe("200%");
  });
});
