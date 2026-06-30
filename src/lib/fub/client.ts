/**
 * Follow Up Boss API client (TypeScript).
 *
 * The Next.js data pipeline pulls the activity surface FUB *does* expose:
 * calls, text messages, appointments, deals, and nurture tasks. (pCVR, pickup
 * rate, and ZHL pre-approval are Zillow-UI-only — see `../zillow/scraper.ts`.)
 *
 * Auth: HTTP Basic with the API key as the username and an empty password, plus
 * the registered system identity headers (`X-System` / `X-System-Key`) FUB now
 * requires on every request.
 *
 * The client takes an injectable `fetch` so it can be exercised in unit tests
 * with no network, and applies exponential-backoff retries on 5xx/429/network
 * errors while never retrying 4xx (other than 429).
 */

import { ZILLOW_SOURCE_ID, ZILLOW_SOURCE_NAMES } from "./constants";

export interface FubClientConfig {
  apiKey: string;
  xSystem?: string;
  xSystemKey?: string;
  baseUrl?: string;
  maxRetries?: number;
  timeoutMs?: number;
  // Injectable for tests; defaults to global fetch.
  fetchImpl?: typeof fetch;
  // Injectable sleep so retry backoff doesn't slow tests.
  sleepImpl?: (ms: number) => Promise<void>;
}

const DEFAULT_BASE_URL = "https://api.followupboss.com/v1";

export class FubApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
    this.name = "FubApiError";
  }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class FubClient {
  private readonly apiKey: string;
  private readonly xSystem?: string;
  private readonly xSystemKey?: string;
  private readonly baseUrl: string;
  private readonly maxRetries: number;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly sleepImpl: (ms: number) => Promise<void>;

  constructor(config: FubClientConfig) {
    if (!config.apiKey) throw new Error("FubClient requires an apiKey");
    this.apiKey = config.apiKey;
    this.xSystem = config.xSystem;
    this.xSystemKey = config.xSystemKey;
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.maxRetries = config.maxRetries ?? 3;
    this.timeoutMs = config.timeoutMs ?? 30000;
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.sleepImpl = config.sleepImpl ?? sleep;
  }

  private authHeaders(): Record<string, string> {
    // FUB Basic auth: API key as username, blank password.
    const token = Buffer.from(`${this.apiKey}:`).toString("base64");
    const headers: Record<string, string> = {
      Authorization: `Basic ${token}`,
      "Content-Type": "application/json",
    };
    if (this.xSystem && this.xSystemKey) {
      headers["X-System"] = this.xSystem;
      headers["X-System-Key"] = this.xSystemKey;
    }
    return headers;
  }

  /** GET with retries. Returns parsed JSON. Throws FubApiError on hard failure. */
  async get<T = unknown>(path: string, params: Record<string, string | number> = {}): Promise<T> {
    const qs = new URLSearchParams(
      Object.entries(params).map(([k, v]) => [k, String(v)]),
    ).toString();
    const url = `${this.baseUrl}/${path.replace(/^\//, "")}${qs ? `?${qs}` : ""}`;
    let delay = 1000;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);
        let resp: Response;
        try {
          resp = await this.fetchImpl(url, {
            method: "GET",
            headers: this.authHeaders(),
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timer);
        }

        if (resp.status === 429) {
          const retryAfter = Number(resp.headers.get("Retry-After")) || delay / 1000;
          await this.sleepImpl(retryAfter * 1000);
          continue;
        }
        if (resp.status >= 400 && resp.status < 500) {
          // Client error — do not retry.
          throw new FubApiError(`FUB ${resp.status} for ${path}`, resp.status);
        }
        if (!resp.ok) {
          // 5xx — retry.
          throw new FubApiError(`FUB ${resp.status} for ${path}`, resp.status);
        }
        return (await resp.json()) as T;
      } catch (err) {
        const isClient4xx = err instanceof FubApiError && err.status !== null && err.status < 500;
        if (isClient4xx) throw err;
        if (attempt >= this.maxRetries) {
          if (err instanceof FubApiError) throw err;
          throw new FubApiError(
            `FUB request failed for ${path}: ${(err as Error).message}`,
            null,
          );
        }
        await this.sleepImpl(delay);
        delay *= 2;
      }
    }
    throw new FubApiError(`FUB unreachable after ${this.maxRetries} attempts: ${path}`, null);
  }

  /**
   * Page through a list endpoint via offset pagination, returning every item
   * under `collectionKey`. FUB returns `{ <collectionKey>: [...], _metadata: { total } }`.
   */
  async paginate<T = Record<string, unknown>>(
    path: string,
    collectionKey: string,
    params: Record<string, string | number> = {},
    hardCap = 10000,
  ): Promise<T[]> {
    const limit = Number(params.limit ?? 100);
    let offset = 0;
    const out: T[] = [];

    // Soft-fail endpoints that aren't enabled for this tenant (404/403): return
    // what we have so a missing endpoint never aborts the whole pull.
    for (;;) {
      let data: Record<string, unknown>;
      try {
        data = await this.get<Record<string, unknown>>(path, { ...params, limit, offset });
      } catch (err) {
        if (err instanceof FubApiError && (err.status === 404 || err.status === 403)) {
          return out;
        }
        throw err;
      }
      const items = (data[collectionKey] as T[]) ?? [];
      out.push(...items);
      const meta = (data._metadata as { total?: number }) ?? {};
      if (items.length < limit) break;
      offset += limit;
      if (meta.total != null && offset >= meta.total) break;
      if (offset >= hardCap) break;
    }
    return out;
  }

  // ── Roster ──────────────────────────────────────────────────────────────────

  /** Discover the active agent roster (role Agent/Broker, not deleted). */
  async fetchUsers(): Promise<Array<{ id: string; name: string; email: string; role: string }>> {
    const users = await this.paginate<Record<string, unknown>>("/users", "users", {
      limit: 100,
    });
    return users
      .filter((u) => {
        const role = String(u.role ?? "").toLowerCase();
        const inactive = Boolean(u.isDeleted) || String(u.status ?? "").toLowerCase() === "inactive";
        return !inactive && (role.includes("agent") || role.includes("broker") || role === "");
      })
      .map((u) => ({
        id: String(u.id),
        name: String(u.name ?? `${u.firstName ?? ""} ${u.lastName ?? ""}`).trim(),
        email: String(u.email ?? "").toLowerCase(),
        role: String(u.role ?? "agent"),
      }));
  }

  // ── Per-agent resource fetchers (period-scoped) ───────────────────────────────

  fetchCalls(userId: string, createdAfter: string, createdBefore: string) {
    return this.paginate<Record<string, unknown>>("/calls", "calls", {
      userId,
      createdAfter,
      createdBefore,
    });
  }

  fetchTextMessages(userId: string, createdAfter: string, createdBefore: string) {
    return this.paginate<Record<string, unknown>>("/textMessages", "textmessages", {
      userId,
      createdAfter,
      createdBefore,
    });
  }

  fetchAppointments(userId: string, createdAfter: string, createdBefore: string) {
    return this.paginate<Record<string, unknown>>("/appointments", "appointments", {
      userId,
      createdAfter,
      createdBefore,
    });
  }

  fetchDeals(userId: string, createdAfter: string, createdBefore: string) {
    return this.paginate<Record<string, unknown>>("/deals", "deals", {
      userId,
      createdAfter,
      createdBefore,
    });
  }

  /** Nurture tasks = FUB tasks assigned to the agent in the window. */
  fetchTasks(userId: string, createdAfter: string, createdBefore: string) {
    return this.paginate<Record<string, unknown>>("/tasks", "tasks", {
      assignedUserId: userId,
      createdAfter,
      createdBefore,
    });
  }

  fetchPeople(userId: string, createdAfter: string, createdBefore: string) {
    return this.paginate<Record<string, unknown>>("/people", "people", {
      assignedUserId: userId,
      createdAfter,
      createdBefore,
      fields: "allFields",
    });
  }
}

/** True if a person record looks like a Zillow Preferred lead. */
export function isZillowLead(person: Record<string, unknown>): boolean {
  const rawId = person.sourceId;
  if (rawId != null && Number(rawId) === ZILLOW_SOURCE_ID) return true;
  const source = String(person.sourceName ?? person.source ?? "")
    .trim()
    .toLowerCase();
  if (!source) return false;
  if (source.includes("zillow")) return true;
  return ZILLOW_SOURCE_NAMES.some((n) => source.includes(n));
}
