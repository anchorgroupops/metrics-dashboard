import { describe, it, expect, vi } from "vitest";
import { postSlack, notifyRefresh, type RefreshSummary } from "@/lib/notify/slack";

const okResponse = () => new Response("ok", { status: 200 });

describe("postSlack", () => {
  it("skips and returns false without a webhook url", async () => {
    const fetchImpl = vi.fn();
    const ok = await postSlack({ text: "hi" }, { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(ok).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("posts JSON to the webhook", async () => {
    const fetchImpl = vi.fn(async () => okResponse());
    const ok = await postSlack(
      { text: "hello" },
      { webhookUrl: "https://hooks.slack.test/abc", fetchImpl: fetchImpl as unknown as typeof fetch },
    );
    expect(ok).toBe(true);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://hooks.slack.test/abc");
    expect(JSON.parse(init.body as string).text).toBe("hello");
  });

  it("returns false on non-2xx", async () => {
    const fetchImpl = vi.fn(async () => new Response("no", { status: 500 }));
    const ok = await postSlack(
      { text: "x" },
      { webhookUrl: "https://hooks.slack.test/abc", fetchImpl: fetchImpl as unknown as typeof fetch },
    );
    expect(ok).toBe(false);
  });
});

describe("notifyRefresh", () => {
  const base: RefreshSummary = {
    period: "2026-06",
    startedAt: "2026-06-23T09:00:00Z",
    durationMs: 4200,
    agentsProcessed: 5,
    fubRecords: 5,
    zillowRecords: 5,
    snapshots: 5,
    errors: [],
    integrityOk: true,
  };

  it("formats a success message", async () => {
    const fetchImpl = vi.fn(async () => okResponse());
    await notifyRefresh(base, { webhookUrl: "https://hooks.slack.test/x", fetchImpl: fetchImpl as unknown as typeof fetch });
    const body = JSON.parse(((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1]).body as string);
    expect(body.text).toContain("succeeded");
    expect(body.text).toContain("2026-06");
  });

  it("formats a failure message with errors", async () => {
    const fetchImpl = vi.fn(async () => okResponse());
    await notifyRefresh(
      { ...base, errors: ["FUB Bob: boom"], integrityOk: false },
      { webhookUrl: "https://hooks.slack.test/x", fetchImpl: fetchImpl as unknown as typeof fetch },
    );
    const body = JSON.parse(((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1]).body as string);
    expect(body.text).toContain("issues");
    expect(body.text).toContain("FUB Bob: boom");
  });
});
