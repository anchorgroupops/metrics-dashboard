/**
 * Cross-system data-integrity checks.
 *
 * Confirms that every record links correctly across the source systems:
 * agents ↔ teams ↔ crew_leads, and agents ↔ fub_metrics / zillow_metrics /
 * performance_snapshots. Pure: takes plain record arrays (from Prisma or
 * fixtures) and returns a structured report. The nightly job runs this after
 * ingestion and treats any `error` as a failure.
 */

import type { IntegrityIssue, IntegrityReport } from "./types";

export interface AgentRow {
  id: string;
  fubId: string | null;
  name: string;
  email: string;
  teamId: string | null;
}
export interface TeamRow {
  id: string;
  slug: string;
}
export interface CrewLeadRow {
  id: string;
  teamId: string;
  agentId: string | null;
}
export interface MetricLink {
  id: string;
  agentId: string;
  period: string;
}
export interface SnapshotRow {
  id: string;
  agentId: string;
  period: string;
  fubMetricId: string | null;
  zillowMetricId: string | null;
}

export interface IntegrityInput {
  agents: AgentRow[];
  teams: TeamRow[];
  crewLeads: CrewLeadRow[];
  fubMetrics: MetricLink[];
  zillowMetrics: MetricLink[];
  snapshots: SnapshotRow[];
}

export function checkIntegrity(input: IntegrityInput): IntegrityReport {
  const errors: IntegrityIssue[] = [];
  const warnings: IntegrityIssue[] = [];

  const agentIds = new Set(input.agents.map((a) => a.id));
  const teamIds = new Set(input.teams.map((t) => t.id));
  const fubById = new Map(input.fubMetrics.map((m) => [m.id, m]));
  const zillowById = new Map(input.zillowMetrics.map((m) => [m.id, m]));

  const err = (code: string, message: string, agentId?: string) =>
    errors.push({ severity: "error", code, message, agentId });
  const warn = (code: string, message: string, agentId?: string) =>
    warnings.push({ severity: "warning", code, message, agentId });

  // ── Agents → teams ────────────────────────────────────────────────────────
  for (const a of input.agents) {
    if (a.teamId == null) {
      warn("agent_unassigned", `Agent ${a.name} (${a.id}) is not assigned to a team`, a.id);
    } else if (!teamIds.has(a.teamId)) {
      err("agent_team_missing", `Agent ${a.name} references missing team ${a.teamId}`, a.id);
    }
    if (!a.email) warn("agent_no_email", `Agent ${a.name} (${a.id}) has no email`, a.id);
    if (!a.fubId) warn("agent_no_fubid", `Agent ${a.name} (${a.id}) has no FUB id`, a.id);
  }

  // Duplicate join keys would silently corrupt cross-system matching.
  assertUnique(input.agents, (a) => a.email.toLowerCase(), "agent_dup_email", err, "email");
  assertUnique(
    input.agents.filter((a) => a.fubId),
    (a) => a.fubId as string,
    "agent_dup_fubid",
    err,
    "FUB id",
  );

  // ── Teams → crew leads ────────────────────────────────────────────────────
  const crewByTeam = new Map<string, CrewLeadRow[]>();
  for (const cl of input.crewLeads) {
    if (!teamIds.has(cl.teamId)) {
      err("crewlead_team_missing", `Crew lead ${cl.id} references missing team ${cl.teamId}`);
    }
    if (cl.agentId != null && !agentIds.has(cl.agentId)) {
      err("crewlead_agent_missing", `Crew lead ${cl.id} references missing agent ${cl.agentId}`);
    }
    const list = crewByTeam.get(cl.teamId) ?? [];
    list.push(cl);
    crewByTeam.set(cl.teamId, list);
  }
  for (const [teamId, leads] of crewByTeam) {
    if (leads.length > 1) {
      err("team_multiple_crewleads", `Team ${teamId} has ${leads.length} crew leads (expected ≤1)`);
    }
  }
  for (const t of input.teams) {
    if (!crewByTeam.has(t.id)) {
      warn("team_no_crewlead", `Team ${t.slug} (${t.id}) has no crew lead`);
    }
  }

  // ── Metrics → agents ──────────────────────────────────────────────────────
  for (const m of input.fubMetrics) {
    if (!agentIds.has(m.agentId)) {
      err("fub_agent_missing", `FUB metric ${m.id} references missing agent ${m.agentId}`, m.agentId);
    }
  }
  for (const m of input.zillowMetrics) {
    if (!agentIds.has(m.agentId)) {
      err(
        "zillow_agent_missing",
        `Zillow metric ${m.id} references missing agent ${m.agentId}`,
        m.agentId,
      );
    }
  }

  // ── Snapshots → agents + metric rows (same agent & period) ────────────────
  for (const s of input.snapshots) {
    if (!agentIds.has(s.agentId)) {
      err("snapshot_agent_missing", `Snapshot ${s.id} references missing agent ${s.agentId}`, s.agentId);
      continue;
    }
    if (s.fubMetricId != null) {
      const fm = fubById.get(s.fubMetricId);
      if (!fm) {
        err("snapshot_fub_missing", `Snapshot ${s.id} references missing FUB metric ${s.fubMetricId}`, s.agentId);
      } else if (fm.agentId !== s.agentId || fm.period !== s.period) {
        err(
          "snapshot_fub_mismatch",
          `Snapshot ${s.id} (agent ${s.agentId}, ${s.period}) linked to FUB metric for ${fm.agentId}/${fm.period}`,
          s.agentId,
        );
      }
    }
    if (s.zillowMetricId != null) {
      const zm = zillowById.get(s.zillowMetricId);
      if (!zm) {
        err("snapshot_zillow_missing", `Snapshot ${s.id} references missing Zillow metric ${s.zillowMetricId}`, s.agentId);
      } else if (zm.agentId !== s.agentId || zm.period !== s.period) {
        err(
          "snapshot_zillow_mismatch",
          `Snapshot ${s.id} (agent ${s.agentId}, ${s.period}) linked to Zillow metric for ${zm.agentId}/${zm.period}`,
          s.agentId,
        );
      }
    }
  }

  return {
    ok: errors.length === 0,
    checked: input.agents.length,
    errors,
    warnings,
  };
}

function assertUnique<T>(
  rows: T[],
  keyFn: (row: T) => string,
  code: string,
  err: (code: string, message: string) => void,
  label: string,
): void {
  const seen = new Map<string, number>();
  for (const r of rows) {
    const k = keyFn(r);
    seen.set(k, (seen.get(k) ?? 0) + 1);
  }
  for (const [k, count] of seen) {
    if (count > 1) err(code, `Duplicate ${label} across ${count} agents: ${k}`);
  }
}
