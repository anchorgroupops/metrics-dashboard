import { describe, it, expect } from "vitest";
import {
  parsePercent,
  parseCount,
  parseZillowReport,
  scrapeZillowMetrics,
  mockZillowRows,
} from "@/lib/zillow/scraper";
import { parseCsv } from "@/lib/zillow/playwright";

describe("parsePercent", () => {
  it("parses percent strings to decimals", () => {
    expect(parsePercent("4.0%")).toBeCloseTo(0.04);
    expect(parsePercent("42%")).toBeCloseTo(0.42);
  });
  it("treats bare decimals as already-decimal", () => {
    expect(parsePercent("0.04")).toBeCloseTo(0.04);
  });
  it("treats bare whole numbers as percent points", () => {
    expect(parsePercent("42")).toBeCloseTo(0.42);
  });
  it("returns null for blanks / n/a", () => {
    expect(parsePercent("")).toBeNull();
    expect(parsePercent("-")).toBeNull();
    expect(parsePercent("N/A")).toBeNull();
    expect(parsePercent(undefined)).toBeNull();
  });
});

describe("parseCount", () => {
  it("parses ints with separators", () => {
    expect(parseCount("1,234")).toBe(1234);
    expect(parseCount("21")).toBe(21);
  });
  it("returns null for blanks", () => {
    expect(parseCount("-")).toBeNull();
    expect(parseCount(undefined)).toBeNull();
  });
});

describe("parseZillowReport", () => {
  it("maps header variants to canonical metrics", () => {
    const rows = parseZillowReport(
      [
        {
          Agent: "Alex Rivera",
          "Predicted Conversion Rate": "5.2%",
          Pickup: "42%",
          "ZHL Pre-Approval": "88%",
          CSAT: "96%",
          Connections: "210",
          "Total Leads": "21",
        },
      ],
      "2026-06",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].agentName).toBe("Alex Rivera");
    expect(rows[0].pcvr).toBeCloseTo(0.052);
    expect(rows[0].pickupRate).toBeCloseTo(0.42);
    expect(rows[0].zhlPreapproval).toBeCloseTo(0.88);
    expect(rows[0].csat).toBeCloseTo(0.96);
    expect(rows[0].connections).toBe(210);
    expect(rows[0].leads).toBe(21);
    expect(rows[0].period).toBe("2026-06");
  });

  it("skips rows without an agent name (e.g. totals)", () => {
    const rows = parseZillowReport([{ pCVR: "4%" }, { Agent: "", pCVR: "5%" }], "2026-06");
    expect(rows).toHaveLength(0);
  });

  it("normalizes period input", () => {
    const rows = parseZillowReport([{ Agent: "X", pCVR: "4%" }], "June 2026");
    expect(rows[0].period).toBe("2026-06");
  });
});

describe("scrapeZillowMetrics", () => {
  it("falls back to mock rows without creds", async () => {
    const recs = await scrapeZillowMetrics({ period: "2026-06" });
    expect(recs.length).toBe(mockZillowRows().length);
    expect(recs[0].pcvr).not.toBeNull();
  });

  it("uses an injected fetcher when provided", async () => {
    const recs = await scrapeZillowMetrics({
      period: "2026-06",
      fetchRows: async () => [{ Agent: "Sam", pCVR: "9%", Pickup: "55%" }],
    });
    expect(recs).toHaveLength(1);
    expect(recs[0].agentName).toBe("Sam");
    expect(recs[0].pcvr).toBeCloseTo(0.09);
  });
});

describe("parseCsv", () => {
  it("parses quoted CSV with embedded commas", () => {
    const rows = parseCsv('Agent,pCVR\n"Rivera, Alex",5.2%\nLee,2.1%');
    expect(rows).toHaveLength(2);
    expect(rows[0].Agent).toBe("Rivera, Alex");
    expect(rows[0].pCVR).toBe("5.2%");
  });
});
