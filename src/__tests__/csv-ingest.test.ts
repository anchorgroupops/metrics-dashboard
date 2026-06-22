import { describe, it, expect } from "vitest";
import {
  ingestAgentCSV,
  ingestDealsCSV,
  ingestCallsCSV,
  ingestTextsCSV,
  ingestAppointmentsCSV,
  combineFubExports,
  ingestJSON,
} from "@/lib/csv-ingest";

describe("ingestAgentCSV", () => {
  it("parses a basic agent CSV", () => {
    const csv = `agent_id,name,email,period,pcvr,pickup_rate
1,Alice,alice@test.com,2026-06,0.05,0.30
2,Bob,bob@test.com,2026-06,0.03,0.20`;

    const result = ingestAgentCSV(csv);
    expect(result.agents.length).toBe(2);
    expect(result.agents[0].name).toBe("Alice");
    expect(result.agents[0].metrics.pcvr).toBeCloseTo(0.05);
    expect(result.agents[1].metrics.pickup_rate).toBeCloseTo(0.20);
    expect(result.period).toBe("2026-06");
  });

  it("handles percentage values (e.g. 5%)", () => {
    const csv = `agent_id,name,email,period,pcvr
1,Alice,alice@test.com,2026-06,5%`;

    const result = ingestAgentCSV(csv);
    expect(result.agents[0].metrics.pcvr).toBeCloseTo(0.05);
  });

  it("handles missing values", () => {
    const csv = `agent_id,name,email,period,pcvr,csat
1,Alice,alice@test.com,2026-06,0.04,N/A`;

    const result = ingestAgentCSV(csv);
    expect(result.agents[0].metrics.csat).toBeNull();
  });

  it("normalizes period formats", () => {
    const csv = `agent_id,name,email,period,pcvr
1,Alice,alice@test.com,April 2026,0.04`;

    const result = ingestAgentCSV(csv);
    expect(result.period).toBe("2026-04");
  });
});

describe("ingestDealsCSV", () => {
  it("counts closed deals per agent", () => {
    const csv = `Assigned To,Stage
Alice,Closed Won
Alice,Active
Alice,Closed Won
Bob,Active`;

    const result = ingestDealsCSV(csv, "2026-06");
    const alice = result.get("Alice");
    expect(alice).toBeDefined();
    expect(alice!.closedDeals).toBe(2);
    expect(alice!.totalLeads).toBe(3);
  });
});

describe("ingestCallsCSV", () => {
  it("classifies connected calls and 2-min conversations", () => {
    const csv = `User,Duration,Outcome
Alice,150,Connected
Alice,25,No Answer
Alice,130,Connected
Bob,5,Voicemail`;

    const result = ingestCallsCSV(csv);
    const alice = result.get("Alice");
    expect(alice!.totalCalls).toBe(3);
    expect(alice!.connectedCalls).toBe(2); // 150s and 130s >= 30
    expect(alice!.conversations2min).toBe(2); // 150s and 130s >= 120
  });
});

describe("ingestTextsCSV", () => {
  it("counts texts per agent", () => {
    const csv = `User,Message
Alice,Hello
Alice,Follow up
Bob,Hi there`;

    const result = ingestTextsCSV(csv);
    expect(result.get("Alice")).toBe(2);
    expect(result.get("Bob")).toBe(1);
  });
});

describe("ingestAppointmentsCSV", () => {
  it("counts appointments per agent", () => {
    const csv = `Assigned To,Date
Alice,2026-06-01
Alice,2026-06-05
Bob,2026-06-03`;

    const result = ingestAppointmentsCSV(csv);
    expect(result.get("Alice")).toBe(2);
    expect(result.get("Bob")).toBe(1);
  });
});

describe("combineFubExports", () => {
  it("computes derived metrics from four exports", () => {
    const deals = new Map([["Alice", { closedDeals: 2, totalLeads: 50 }]]);
    const calls = new Map([["Alice", { totalCalls: 200, connectedCalls: 60, conversations2min: 15 }]]);
    const texts = new Map([["Alice", 100]]);
    const appointments = new Map([["Alice", 8]]);

    const agents = combineFubExports(deals, calls, texts, appointments, "2026-06");
    expect(agents.length).toBe(1);
    expect(agents[0].name).toBe("Alice");
    expect(agents[0].metrics.pcvr).toBeCloseTo(0.04); // 2/50
    expect(agents[0].metrics.pickup_rate).toBeCloseTo(0.30); // 60/200
    expect(agents[0].metrics.appt_rate).toBeCloseTo(0.16); // 8/50
    expect(agents[0].metrics.conversations_2min).toBe(15);
    expect(agents[0].metrics.texts_sent).toBe(100);
    expect(agents[0].metrics.appointments_set).toBe(8);
  });

  it("merges agents from different exports", () => {
    const deals = new Map([["Alice", { closedDeals: 1, totalLeads: 10 }]]);
    const calls = new Map([["Bob", { totalCalls: 50, connectedCalls: 20, conversations2min: 5 }]]);
    const texts = new Map<string, number>();
    const appointments = new Map<string, number>();

    const agents = combineFubExports(deals, calls, texts, appointments, "2026-06");
    expect(agents.length).toBe(2);
  });
});

describe("ingestJSON", () => {
  it("parses array format", () => {
    const json = JSON.stringify([
      { agent_id: "1", name: "Alice", email: "a@t.com", period: "2026-06", pcvr: 0.05 },
    ]);
    const result = ingestJSON(json);
    expect(result.agents.length).toBe(1);
    expect(result.agents[0].metrics.pcvr).toBe(0.05);
  });

  it("parses envelope format", () => {
    const json = JSON.stringify({
      agents: [
        { agent_id: "1", name: "Alice", email: "a@t.com", period: "2026-06", pcvr: 0.04 },
      ],
    });
    const result = ingestJSON(json);
    expect(result.agents.length).toBe(1);
  });
});
