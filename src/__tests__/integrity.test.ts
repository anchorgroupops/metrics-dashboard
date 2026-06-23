import { describe, it, expect } from "vitest";
import { checkIntegrity, type IntegrityInput } from "@/lib/integrity";
import { normalizeName, resolveAgentId } from "@/lib/ingest/resolve";

function baseInput(): IntegrityInput {
  return {
    agents: [
      { id: "a1", fubId: "100", name: "Alex Rivera", email: "alex@x.com", teamId: "t1" },
      { id: "a2", fubId: "200", name: "Jordan Lee", email: "jordan@x.com", teamId: "t1" },
    ],
    teams: [{ id: "t1", slug: "team-one" }],
    crewLeads: [{ id: "c1", teamId: "t1", agentId: "a1" }],
    fubMetrics: [{ id: "f1", agentId: "a1", period: "2026-06" }],
    zillowMetrics: [{ id: "z1", agentId: "a1", period: "2026-06" }],
    snapshots: [
      { id: "s1", agentId: "a1", period: "2026-06", fubMetricId: "f1", zillowMetricId: "z1" },
    ],
  };
}

describe("checkIntegrity", () => {
  it("passes when all records link correctly", () => {
    const report = checkIntegrity(baseInput());
    expect(report.ok).toBe(true);
    expect(report.errors).toHaveLength(0);
    expect(report.checked).toBe(2);
  });

  it("flags a metric pointing at a missing agent", () => {
    const input = baseInput();
    input.fubMetrics.push({ id: "f2", agentId: "ghost", period: "2026-06" });
    const report = checkIntegrity(input);
    expect(report.ok).toBe(false);
    expect(report.errors.some((e) => e.code === "fub_agent_missing")).toBe(true);
  });

  it("flags an agent on a non-existent team", () => {
    const input = baseInput();
    input.agents[0].teamId = "tX";
    const report = checkIntegrity(input);
    expect(report.errors.some((e) => e.code === "agent_team_missing")).toBe(true);
  });

  it("flags a snapshot linked to a mismatched metric period", () => {
    const input = baseInput();
    input.snapshots[0].period = "2026-05"; // metric is 2026-06
    const report = checkIntegrity(input);
    expect(report.errors.some((e) => e.code === "snapshot_fub_mismatch")).toBe(true);
  });

  it("flags duplicate FUB ids across agents", () => {
    const input = baseInput();
    input.agents[1].fubId = "100"; // collides with a1
    const report = checkIntegrity(input);
    expect(report.errors.some((e) => e.code === "agent_dup_fubid")).toBe(true);
  });

  it("flags a crew lead referencing a missing team", () => {
    const input = baseInput();
    input.crewLeads.push({ id: "c2", teamId: "ghost", agentId: null });
    const report = checkIntegrity(input);
    expect(report.errors.some((e) => e.code === "crewlead_team_missing")).toBe(true);
  });

  it("warns (not errors) on an unassigned agent", () => {
    const input = baseInput();
    input.agents[1].teamId = null;
    const report = checkIntegrity(input);
    expect(report.ok).toBe(true);
    expect(report.warnings.some((w) => w.code === "agent_unassigned")).toBe(true);
  });
});

describe("resolve", () => {
  it("normalizes messy names", () => {
    expect(normalizeName("O'Brien, Sam")).toBe("obrien sam");
    expect(normalizeName("  Alex   Rivera ")).toBe("alex rivera");
  });

  const agents = [
    { id: "a1", fubId: "100", name: "Alex Rivera", email: "alex@x.com", teamId: null },
    { id: "a2", fubId: "200", name: "Alex Rivera", email: "alex2@x.com", teamId: null },
  ];

  it("resolves by fubId first", () => {
    expect(resolveAgentId({ fubId: "200" }, agents)).toBe("a2");
  });
  it("resolves by email", () => {
    expect(resolveAgentId({ email: "ALEX@x.com" }, agents)).toBe("a1");
  });
  it("refuses ambiguous name matches", () => {
    expect(resolveAgentId({ name: "Alex Rivera" }, agents)).toBeNull();
  });
  it("resolves unambiguous name", () => {
    const single = [agents[0]];
    expect(resolveAgentId({ name: "alex rivera" }, single)).toBe("a1");
  });
});
