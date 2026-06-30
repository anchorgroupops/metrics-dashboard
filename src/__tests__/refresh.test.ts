import { describe, it, expect, vi } from "vitest";
import {
  combineMetrics,
  buildSnapshots,
  runNightlyRefresh,
  type DataStore,
} from "@/lib/ingest/refresh";
import type { AgentLink, FubMetricRecord, ZillowMetricRecord } from "@/lib/types";

const agents: AgentLink[] = [
  { id: "a1", fubId: "100", name: "Alex Rivera", email: "alex@x.com", teamId: "t1" },
  { id: "a2", fubId: "200", name: "Jordan Lee", email: "jordan@x.com", teamId: "t1" },
];

const fub: FubMetricRecord[] = [
  { agentId: "100", period: "2026-06", calls: 400, texts: 80, appointments: 6, deals: 2, nurtureTasks: 10, zillowLeads: 20 },
];
const zillow: ZillowMetricRecord[] = [
  { agentId: "Alex Rivera", agentName: "Alex Rivera", period: "2026-06", pcvr: 0.05, pickupRate: 0.3, zhlPreapproval: 0.9, csat: 0.95, connections: 100, leads: 20 },
];

describe("combineMetrics", () => {
  it("maps source records into the scorer keyset", () => {
    const m = combineMetrics(fub[0], zillow[0]);
    expect(m.pcvr).toBe(0.05);
    expect(m.pickup_rate).toBe(0.3);
    expect(m.appt_rate).toBeCloseTo(6 / 20);
    expect(m.calls_made).toBe(400);
    expect(m.appointments_set).toBe(6);
  });

  it("nulls appt_rate when there are no zillow leads", () => {
    const m = combineMetrics({ ...fub[0], zillowLeads: 0 }, zillow[0]);
    expect(m.appt_rate).toBeNull();
  });
});

describe("buildSnapshots", () => {
  it("resolves fub-id and zillow-name keys to the same agent", () => {
    const snaps = buildSnapshots(agents, fub, zillow, "2026-06", "2026-06-23");
    expect(snaps).toHaveLength(1);
    expect(snaps[0].agentId).toBe("a1");
    expect(snaps[0].overallStatus).toBe("Preferred");
    expect(snaps[0].leaderboardPoints).toBeGreaterThan(0);
    expect(snaps[0].zilpiEligible).toBe(true);
  });

  it("skips agents with no data on either side", () => {
    const snaps = buildSnapshots(agents, fub, [], "2026-06", "2026-06-23");
    expect(snaps.map((s) => s.agentId)).toEqual(["a1"]);
  });
});

describe("runNightlyRefresh", () => {
  function fakeStore(overrides: Partial<DataStore> = {}): DataStore {
    return {
      listAgents: async () => agents,
      upsertFubMetrics: async (records) => new Map(records.map((r) => [r.agentId, `fub-${r.agentId}`])),
      upsertZillowMetrics: async () => new Map([["a1", "zil-a1"]]),
      upsertSnapshots: async (snaps) => snaps.length,
      runIntegrityCheck: async () => ({ ok: true, checked: 2, errors: [], warnings: [] }),
      ...overrides,
    };
  }

  it("runs the full pipeline and reports a clean summary", async () => {
    const notify = vi.fn(async () => true);
    const summary = await runNightlyRefresh({
      period: "2026-06",
      store: fakeStore(),
      pullFub: async () => ({ records: fub, errors: [] }),
      scrapeZillow: async () => zillow,
      notify,
      now: () => new Date("2026-06-23T09:00:00Z"),
    });

    expect(summary.fubRecords).toBe(1);
    expect(summary.zillowRecords).toBe(1);
    expect(summary.snapshots).toBe(1);
    expect(summary.integrityOk).toBe(true);
    expect(summary.errors).toHaveLength(0);
    expect(notify).toHaveBeenCalledOnce();
  });

  it("captures source errors and integrity failures without throwing", async () => {
    const summary = await runNightlyRefresh({
      period: "2026-06",
      store: fakeStore({
        runIntegrityCheck: async () => ({
          ok: false,
          checked: 2,
          errors: [{ severity: "error", code: "fub_agent_missing", message: "boom" }],
          warnings: [],
        }),
      }),
      pullFub: async () => {
        throw new Error("FUB down");
      },
      scrapeZillow: async () => zillow,
    });

    expect(summary.errors.some((e) => e.includes("FUB pull failed"))).toBe(true);
    expect(summary.errors.some((e) => e.includes("integrity:fub_agent_missing"))).toBe(true);
    expect(summary.integrityOk).toBe(false);
  });
});
