import { describe, it, expect, vi } from "vitest";
import { diffStandards, formatChange, type StandardsSnapshot } from "@/lib/research/standards";
import { parseStandardsJson, researchZillowStandards } from "@/lib/research/client";

function snapshot(): StandardsSnapshot {
  return {
    researched_at: "2026-06-01",
    source: "test",
    metrics: {
      pcvr: { minimum: 0.04, milestone: 0.045, elite: 0.1, industry_avg: 0.025, unit: "percent", milestone_label: "Elite" },
      pickup_rate: { minimum: 0.25, milestone: 0.3, elite: 0.6, industry_avg: 0.18, unit: "percent", milestone_label: "Superior" },
    },
  };
}

describe("diffStandards", () => {
  it("reports no changes for identical snapshots", () => {
    expect(diffStandards(snapshot(), snapshot())).toEqual([]);
  });

  it("detects a changed minimum beyond tolerance", () => {
    const next = snapshot();
    next.metrics.pcvr.minimum = 0.045; // raised from 0.04
    const changes = diffStandards(snapshot(), next);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ metric: "pcvr", field: "minimum", old: 0.04, new: 0.045 });
    expect(formatChange(changes[0])).toBe("pcvr.minimum: 0.04 → 0.045");
  });

  it("detects a milestone label change", () => {
    const next = snapshot();
    next.metrics.pickup_rate.milestone_label = "Premier";
    const changes = diffStandards(snapshot(), next);
    expect(changes.some((c) => c.field === "milestone_label" && c.new === "Premier")).toBe(true);
  });

  it("detects an added metric", () => {
    const next = snapshot();
    next.metrics.csat = { minimum: 0.85, milestone: 0.9, elite: 0.95, unit: "percent" };
    const changes = diffStandards(snapshot(), next);
    expect(changes.some((c) => c.metric === "csat")).toBe(true);
  });

  it("ignores null-to-null fields", () => {
    const a = snapshot();
    const b = snapshot();
    a.metrics.pcvr.industry_avg = null;
    b.metrics.pcvr.industry_avg = null;
    const changes = diffStandards(a, b);
    expect(changes.find((c) => c.metric === "pcvr" && c.field === "industry_avg")).toBeUndefined();
  });
});

describe("parseStandardsJson", () => {
  it("strips markdown fences and parses", () => {
    const text = '```json\n{"metrics": {"pcvr": {"minimum": 0.04}}, "notes": "ok"}\n```';
    const parsed = parseStandardsJson(text);
    expect(parsed.metrics.pcvr.minimum).toBe(0.04);
    expect(parsed.notes).toBe("ok");
  });

  it("extracts the JSON object embedded in prose", () => {
    const text = 'Here are the standards: {"metrics": {"csat": {"minimum": 0.85}}} — verified today.';
    expect(parseStandardsJson(text).metrics.csat.minimum).toBe(0.85);
  });
});

describe("researchZillowStandards", () => {
  it("calls the Messages API with the web_search tool and parses the result", async () => {
    const apiResponse = {
      stop_reason: "end_turn",
      content: [
        { type: "text", text: '{"metrics": {"pcvr": {"minimum": 0.04, "milestone": 0.045, "unit": "percent"}}}' },
      ],
    };
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(apiResponse), { status: 200 }));
    const snap = await researchZillowStandards({
      apiKey: "test-key",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(snap.metrics.pcvr.minimum).toBe(0.04);

    const init = (fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1];
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe("claude-opus-4-8");
    expect(body.tools[0].type).toBe("web_search_20260209");
  });

  it("throws without an API key", async () => {
    await expect(researchZillowStandards({ apiKey: "" })).rejects.toThrow(/ANTHROPIC_API_KEY/);
  });
});
