/**
 * Prisma-backed implementation of the refresh `DataStore`.
 *
 * Keeps all database access in one place; the orchestrator (`refresh.ts`) stays
 * persistence-agnostic and unit-testable with fakes.
 */

import type { PrismaClient } from "@prisma/client";
import type { FubMetricRecord, ZillowMetricRecord, AgentLink, IntegrityReport } from "../types";
import { checkIntegrity } from "../integrity";
import { resolveAgentId } from "./resolve";
import type { CombinedSnapshot, DataStore } from "./refresh";

export class PrismaDataStore implements DataStore {
  constructor(private readonly prisma: PrismaClient) {}

  async listAgents(): Promise<AgentLink[]> {
    const agents = await this.prisma.agent.findMany({ where: { active: true } });
    return agents.map((a) => ({
      id: a.id,
      fubId: a.fubId,
      name: a.name,
      email: a.email,
      teamId: a.teamId,
    }));
  }

  async upsertFubMetrics(
    records: FubMetricRecord[],
    resolve: (fubId: string) => string | null,
  ): Promise<Map<string, string>> {
    const ids = new Map<string, string>();
    for (const r of records) {
      const agentId = resolve(r.agentId);
      if (!agentId) continue; // unresolved FUB id — integrity check will surface gaps
      const row = await this.prisma.fubMetric.upsert({
        where: { agentId_period: { agentId, period: r.period } },
        create: {
          agentId,
          period: r.period,
          calls: r.calls,
          texts: r.texts,
          appointments: r.appointments,
          deals: r.deals,
          nurtureTasks: r.nurtureTasks,
          zillowLeads: r.zillowLeads,
        },
        update: {
          calls: r.calls,
          texts: r.texts,
          appointments: r.appointments,
          deals: r.deals,
          nurtureTasks: r.nurtureTasks,
          zillowLeads: r.zillowLeads,
          pulledAt: new Date(),
        },
      });
      ids.set(agentId, row.id);
    }
    return ids;
  }

  async upsertZillowMetrics(
    records: ZillowMetricRecord[],
    agents: AgentLink[],
  ): Promise<Map<string, string>> {
    const ids = new Map<string, string>();
    for (const r of records) {
      const agentId = resolveAgentId({ name: r.agentName }, agents);
      if (!agentId) continue;
      const row = await this.prisma.zillowMetric.upsert({
        where: { agentId_period: { agentId, period: r.period } },
        create: {
          agentId,
          period: r.period,
          pcvr: r.pcvr,
          pickupRate: r.pickupRate,
          zhlPreapproval: r.zhlPreapproval,
          csat: r.csat,
          connections: r.connections,
          leads: r.leads,
          raw: r as unknown as object,
        },
        update: {
          pcvr: r.pcvr,
          pickupRate: r.pickupRate,
          zhlPreapproval: r.zhlPreapproval,
          csat: r.csat,
          connections: r.connections,
          leads: r.leads,
          raw: r as unknown as object,
          scrapedAt: new Date(),
        },
      });
      ids.set(agentId, row.id);
    }
    return ids;
  }

  async upsertSnapshots(
    snapshots: CombinedSnapshot[],
    fubIds: Map<string, string>,
    zillowIds: Map<string, string>,
  ): Promise<number> {
    let count = 0;
    for (const s of snapshots) {
      await this.prisma.performanceSnapshot.upsert({
        where: { agentId_snapshotDate: { agentId: s.agentId, snapshotDate: s.snapshotDate } },
        create: {
          agentId: s.agentId,
          period: s.period,
          snapshotDate: s.snapshotDate,
          operationalReadiness: s.operationalReadiness,
          overallStatus: s.overallStatus,
          leaderboardPoints: s.leaderboardPoints,
          zilpiEligible: s.zilpiEligible,
          fubMetricId: fubIds.get(s.agentId) ?? null,
          zillowMetricId: zillowIds.get(s.agentId) ?? null,
        },
        update: {
          period: s.period,
          operationalReadiness: s.operationalReadiness,
          overallStatus: s.overallStatus,
          leaderboardPoints: s.leaderboardPoints,
          zilpiEligible: s.zilpiEligible,
          fubMetricId: fubIds.get(s.agentId) ?? null,
          zillowMetricId: zillowIds.get(s.agentId) ?? null,
        },
      });
      count++;
    }
    return count;
  }

  async runIntegrityCheck(): Promise<IntegrityReport> {
    const [agents, teams, crewLeads, fubMetrics, zillowMetrics, snapshots] = await Promise.all([
      this.prisma.agent.findMany(),
      this.prisma.team.findMany(),
      this.prisma.crewLead.findMany(),
      this.prisma.fubMetric.findMany(),
      this.prisma.zillowMetric.findMany(),
      this.prisma.performanceSnapshot.findMany(),
    ]);
    return checkIntegrity({
      agents: agents.map((a) => ({
        id: a.id,
        fubId: a.fubId,
        name: a.name,
        email: a.email,
        teamId: a.teamId,
      })),
      teams: teams.map((t) => ({ id: t.id, slug: t.slug })),
      crewLeads: crewLeads.map((c) => ({ id: c.id, teamId: c.teamId, agentId: c.agentId })),
      fubMetrics: fubMetrics.map((m) => ({ id: m.id, agentId: m.agentId, period: m.period })),
      zillowMetrics: zillowMetrics.map((m) => ({ id: m.id, agentId: m.agentId, period: m.period })),
      snapshots: snapshots.map((s) => ({
        id: s.id,
        agentId: s.agentId,
        period: s.period,
        fubMetricId: s.fubMetricId,
        zillowMetricId: s.zillowMetricId,
      })),
    });
  }
}
