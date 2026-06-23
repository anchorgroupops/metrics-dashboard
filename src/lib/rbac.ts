/**
 * Role-based access control for performance data.
 *
 * Three roles, each with a different visibility scope:
 *   - management : every agent
 *   - crew_lead  : only agents on the team(s) they lead (their trainees) + self
 *   - agent      : only themselves
 *
 * Pure and unit-tested. The Flask/Next route layer builds a `Viewer` from the
 * authenticated session and uses `visibleAgents` / `assertCanView` to gate data.
 */

export type Role = "management" | "crew_lead" | "agent";

export interface Viewer {
  agentId: string | null; // the viewer's own agent id (null for non-agent admins)
  role: Role;
  ledTeamIds: string[]; // teams this viewer leads (crew_lead only)
}

export interface AgentRef {
  id: string;
  teamId: string | null;
}

/** Normalize a stored role string to a canonical Role. */
export function normalizeRole(raw: string | null | undefined): Role {
  const r = (raw ?? "").toLowerCase();
  if (r === "management" || r === "admin" || r === "manager") return "management";
  if (r === "crew_lead" || r === "crewlead" || r === "lead" || r === "trainer") return "crew_lead";
  return "agent";
}

/**
 * Build a Viewer from the authenticated agent and the crew-lead table.
 * A viewer leads a team if a crew_leads row links their agent id to it.
 */
export function buildViewer(
  self: { id: string | null; role: string | null | undefined },
  crewLeads: Array<{ agentId: string | null; teamId: string }> = [],
): Viewer {
  const role = normalizeRole(self.role);
  const ledTeamIds =
    self.id == null ? [] : crewLeads.filter((c) => c.agentId === self.id).map((c) => c.teamId);
  // A viewer that leads a team is at least a crew_lead even if the stored role
  // is the default "agent" (defensive: data may lag the org chart).
  const effectiveRole: Role = role === "agent" && ledTeamIds.length > 0 ? "crew_lead" : role;
  return { agentId: self.id, role: effectiveRole, ledTeamIds };
}

/** Can `viewer` see the performance data of `target`? */
export function canViewAgent(viewer: Viewer, target: AgentRef): boolean {
  switch (viewer.role) {
    case "management":
      return true;
    case "crew_lead":
      // Trainees: agents on a team the viewer leads. Plus the viewer themselves.
      if (viewer.agentId !== null && viewer.agentId === target.id) return true;
      return target.teamId !== null && viewer.ledTeamIds.includes(target.teamId);
    case "agent":
      return viewer.agentId !== null && viewer.agentId === target.id;
  }
}

/** Filter a roster to the agents this viewer is allowed to see. */
export function visibleAgents<T extends AgentRef>(viewer: Viewer, agents: T[]): T[] {
  if (viewer.role === "management") return agents;
  return agents.filter((a) => canViewAgent(viewer, a));
}

export class AccessDeniedError extends Error {
  constructor(agentId: string) {
    super(`Access denied to agent ${agentId}`);
    this.name = "AccessDeniedError";
  }
}

/** Throw unless the viewer may see the target. */
export function assertCanView(viewer: Viewer, target: AgentRef): void {
  if (!canViewAgent(viewer, target)) throw new AccessDeniedError(target.id);
}
