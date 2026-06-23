import { describe, it, expect, vi } from "vitest";
import { FubClient, FubApiError, isZillowLead } from "@/lib/fub/client";
import { aggregateAgentMetrics, pullFubMetrics } from "@/lib/fub/ingest";

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

describe("FubClient.get", () => {
  it("sends Basic auth + system headers", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ ok: true }));
    const client = new FubClient({
      apiKey: "key123",
      xSystem: "Anchor",
      xSystemKey: "syskey",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await client.get("/people");
    const [, init] = fetchImpl.mock.calls[0] as unknown as [unknown, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Basic ${Buffer.from("key123:").toString("base64")}`);
    expect(headers["X-System"]).toBe("Anchor");
    expect(headers["X-System-Key"]).toBe("syskey");
  });

  it("does not retry 4xx", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ error: "bad" }, 400));
    const client = new FubClient({
      apiKey: "k",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleepImpl: async () => {},
    });
    await expect(client.get("/x")).rejects.toBeInstanceOf(FubApiError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("retries 5xx then succeeds", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 500))
      .mockResolvedValueOnce(jsonResponse({ ok: true }, 200));
    const client = new FubClient({
      apiKey: "k",
      maxRetries: 3,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleepImpl: async () => {},
    });
    const res = await client.get<{ ok: boolean }>("/x");
    expect(res.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("honors Retry-After on 429", async () => {
    const sleep = vi.fn(async () => {});
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 429, { "Retry-After": "2" }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }, 200));
    const client = new FubClient({
      apiKey: "k",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleepImpl: sleep,
    });
    await client.get("/x");
    expect(sleep).toHaveBeenCalledWith(2000);
  });
});

describe("FubClient.paginate", () => {
  it("walks offset pages until short page", async () => {
    const page1 = { calls: Array.from({ length: 100 }, (_, i) => ({ id: i })), _metadata: { total: 150 } };
    const page2 = { calls: Array.from({ length: 50 }, (_, i) => ({ id: 100 + i })), _metadata: { total: 150 } };
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse(page1)).mockResolvedValueOnce(jsonResponse(page2));
    const client = new FubClient({ apiKey: "k", fetchImpl: fetchImpl as unknown as typeof fetch });
    const all = await client.paginate("/calls", "calls");
    expect(all).toHaveLength(150);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("soft-fails 404 by returning collected items", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ error: "not found" }, 404));
    const client = new FubClient({
      apiKey: "k",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleepImpl: async () => {},
    });
    const all = await client.paginate("/calls", "calls");
    expect(all).toEqual([]);
  });
});

describe("isZillowLead", () => {
  it("matches by sourceId", () => {
    expect(isZillowLead({ sourceId: 15 })).toBe(true);
  });
  it("matches by source name", () => {
    expect(isZillowLead({ source: "Premier Agent" })).toBe(true);
    expect(isZillowLead({ sourceName: "Zillow.com" })).toBe(true);
  });
  it("rejects non-zillow", () => {
    expect(isZillowLead({ source: "Realtor.com" })).toBe(false);
    expect(isZillowLead({})).toBe(false);
  });
});

describe("aggregateAgentMetrics", () => {
  it("counts outbound activity and zillow leads", () => {
    const rec = aggregateAgentMetrics("u1", "2026-06", {
      calls: [{ direction: "outbound" }, { isIncoming: true }, { direction: "outbound" }],
      texts: [{ direction: "outbound" }, { isIncoming: true }],
      appointments: [{ id: 1 }, { id: 2 }],
      deals: [{ id: 1 }],
      tasks: [{ id: 1 }, { id: 2 }, { id: 3 }],
      people: [{ sourceId: 15 }, { source: "realtor" }, { sourceName: "zillow" }],
    });
    expect(rec).toEqual({
      agentId: "u1",
      period: "2026-06",
      calls: 2,
      texts: 1,
      appointments: 2,
      deals: 1,
      nurtureTasks: 3,
      zillowLeads: 2,
    });
  });
});

describe("pullFubMetrics", () => {
  it("aggregates per agent and captures per-agent errors", async () => {
    const fakeClient = {
      fetchCalls: vi.fn(async (id: string) => (id === "bad" ? Promise.reject(new Error("boom")) : [{ direction: "outbound" }])),
      fetchTextMessages: vi.fn(async () => []),
      fetchAppointments: vi.fn(async () => [{ id: 1 }]),
      fetchDeals: vi.fn(async () => []),
      fetchTasks: vi.fn(async () => []),
      fetchPeople: vi.fn(async () => [{ sourceId: 15 }]),
    } as unknown as FubClient;

    const res = await pullFubMetrics(fakeClient, "2026-06", [
      { id: "good", name: "Good", email: "g@x.com" },
      { id: "bad", name: "Bad", email: "b@x.com" },
    ]);
    expect(res.records).toHaveLength(1);
    expect(res.records[0].agentId).toBe("good");
    expect(res.records[0].appointments).toBe(1);
    expect(res.errors).toHaveLength(1);
    expect(res.errors[0].agentId).toBe("bad");
  });
});
