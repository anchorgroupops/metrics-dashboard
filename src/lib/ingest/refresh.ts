/**
 * Nightly-refresh orchestrator.
 *
 * Ties the pipeline together: pull FUB metrics, scrape Zillow metrics, combine
 * them into scored performance snapshots, persist everything, run the
 * cross-system integrity check, and report to Slack.
 *
 * The orchestrator depends only on injected interfaces (`DataStore`, source
 * functions, notifier) so it is unit-tested end-to-end with fakes. The real
 * Prisma-backed wiring lives in `scripts/nightly-refresh.ts`.
 */

import type { FubMetricRecord, ZillowMetricRecord, AgentLink, IntegrityReport } from "../types";
import { scoreAgent } from "../scoring";
import { resolveAgentId } from "./resolve";
import type { RefreshSummary } from "../notify/slack";

export interface CombinedSnapshot {
  agentId: string;
  name: string;
  email: string;
  period: string;
  snapshotDate: string; // YYYY-MM-DD
  operationalReadiness: number | null;
  overallStatus: string;
  leaderboardPoints: number;
  zilpiEligible: boolean;
}

/** Map FUB + Zillow source records into the metric keyset the scorer expects. */
export function combineMetrics(
  fub: FubMetricRecord | undefined,
  zillow: ZillowMetricRecord | undefined,
): Record<string, number | null> {
  const apptRate =
    fub && fub.zillowLeads > 0 ? fub.appointments / fub.zillowLeads : null;
  return {
    pcvr: zillow?.pcvr ?? null,
    pickup_rate: zillow?.pickupRate ?? null,
    zhl_preapproval: zillow?.zhlPreapproval ?? null,
    csat: zillow?.csat ?? null,
    appt_rate: apptRate,
    speed_to_lead: null, // not derivable from the period-level pull
    calls_made: fub?.calls ?? null,
    // leaderboard inputs
    appointments_set: fub?.appointments ?? 0,
    call_volume: fub?.calls ?? 0,
    texts_sent: fub?.texts ?? 0,
    emails_sent: 0,
    conversations_2min: 0,
  };
}

/**
 * Build scored snapshots for every agent that has FUB and/or Zillow data,
 * resolving Zillow rows (keyed by name) to canonical agent ids.
 */
export function buildSnapshots(
  agents: AgentLink[],
  fubRecords: FubMetricRecord[],
  zillowRecords: ZillowMetricRecord[],
  period: string,
  snapshotDate: string,
): CombinedSnapshot[] {
  // FUB records are keyed by FUB id; resolve to internal agent id.
  const fubByAgent = new Map<string, FubMetricRecord>();
  for (const f of fubRecords) {
    const id = resolveAgentId({ fubId: f.agentId }, agents) ?? f.agentId;
    fubByAgent.set(id, f);
  }
  const zillowByAgent = new Map<string, ZillowMetricRecord>();
  for (const z of zillowRecords) {
    const id = resolveAgentId({ name: z.agentName }, agents);
    if (id) zillowByAgent.set(id, z);
  }

  const snapshots: CombinedSnapshot[] = [];
  for (const agent of agents) {
    const fub = fubByAgent.get(agent.id);
    const zillow = zillowByAgent.get(agent.id);
    if (!fub && !zillow) continue;

    const metrics = combineMetrics(fub, zillow);
    const scored = scoreAgent({
      agentId: agent.id,
      name: agent.name,
      email: agent.email,
      period,
      metrics,
    });
    snapshots.push({
      agentId: agent.id,
      name: agent.name,
      email: agent.email,
      period,
      snapshotDate,
      operationalReadiness: scored.operationalReadiness,
      overallStatus: scored.overallStatus,
      leaderboardPoints: scored.leaderboardPoints,
      zilpiEligible: scored.zilpiEligible,
    });
  }
  return snapshots;
}

// ── Orchestration interfaces ──────────────────────────────────────────────────

export interface PersistResult {
  fubMetricIds: Map<string, string>; // agentId → fub_metric row id
  zillowMetricIds: Map<string, string>; // agentId → zillow_metric row id
}

export interface DataStore {
  listAgents(): Promise<AgentLink[]>;
  upsertFubMetrics(records: FubMetricRecord[], resolve: (fubId: string) => string | null): Promise<Map<string, string>>;
  upsertZillowMetrics(records: ZillowMetricRecord[], agents: AgentLink[]): Promise<Map<string, string>>;
  upsertSnapshots(
    snapshots: CombinedSnapshot[],
    fubIds: Map<string, string>,
    zillowIds: Map<string, string>,
  ): Promise<number>;
  runIntegrityCheck(): Promise<IntegrityReport>;
}

export interface RefreshDeps {
  period: string;
  store: DataStore;
  pullFub: (agents: AgentLink[]) => Promise<{ records: FubMetricRecord[]; errors: string[] }>;
  scrapeZillow: () => Promise<ZillowMetricRecord[]>;
  notify?: (summary: RefreshSummary) => Promise<boolean>;
  now?: () => Date;
}

/** Run the full nightly refresh. Returns the summary that was reported. */
export async function runNightlyRefresh(deps: RefreshDeps): Promise<RefreshSummary> {
  const now = deps.now ?? (() => new Date());
  const startDate = now();
  const startedAt = startDate.toISOString();
  const snapshotDate = startedAt.slice(0, 10);
  const errors: string[] = [];

  const agents = await deps.store.listAgents();

  let fubRecords: FubMetricRecord[] = [];
  try {
    const res = await deps.pullFub(agents);
    fubRecords = res.records;
    errors.push(...res.errors);
  } catch (err) {
    errors.push(`FUB pull failed: ${(err as Error).message}`);
  }

  let zillowRecords: ZillowMetricRecord[] = [];
  try {
    zillowRecords = await deps.scrapeZillow();
  } catch (err) {
    errors.push(`Zillow scrape failed: ${(err as Error).message}`);
  }

  // Persist source metrics.
  let fubIds = new Map<string, string>();
  let zillowIds = new Map<string, string>();
  try {
    fubIds = await deps.store.upsertFubMetrics(fubRecords, (fubId) =>
      resolveAgentId({ fubId }, agents),
    );
    zillowIds = await deps.store.upsertZillowMetrics(zillowRecords, agents);
  } catch (err) {
    errors.push(`Persist metrics failed: ${(err as Error).message}`);
  }

  // Build + persist scored snapshots.
  const snapshots = buildSnapshots(agents, fubRecords, zillowRecords, deps.period, snapshotDate);
  let snapshotCount = 0;
  try {
    snapshotCount = await deps.store.upsertSnapshots(snapshots, fubIds, zillowIds);
  } catch (err) {
    errors.push(`Persist snapshots failed: ${(err as Error).message}`);
  }

  // Cross-system integrity check.
  let integrityOk = false;
  try {
    const report = await deps.store.runIntegrityCheck();
    integrityOk = report.ok;
    for (const e of report.errors) errors.push(`integrity:${e.code} ${e.message}`);
  } catch (err) {
    errors.push(`Integrity check failed: ${(err as Error).message}`);
  }

  const summary: RefreshSummary = {
    period: deps.period,
    startedAt,
    durationMs: now().getTime() - startDate.getTime(),
    agentsProcessed: agents.length,
    fubRecords: fubRecords.length,
    zillowRecords: zillowRecords.length,
    snapshots: snapshotCount,
    errors,
    integrityOk,
  };

  if (deps.notify) {
    try {
      await deps.notify(summary);
    } catch (err) {
      console.error(`[refresh] notify failed: ${(err as Error).message}`);
    }
  }

  return summary;
}
