/**
 * Roster: agents with team + role, scored for the views. Sourced from the DB in
 * production; falls back to a demonstration roster (teams, crew leads, trainees,
 * a manager) so the role-based views render without live data.
 */
import { getSampleAgents } from "./sample-data";
import { scoreAgent } from "./scoring";
import type { ScoredAgent } from "./types";
import type { Role } from "./rbac";

export interface RosterTeam {
  id: string;
  name: string;
  slug: string;
}
export interface RosterCrewLead {
  agentId: string;
  teamId: string;
}
export interface RosterAgent {
  id: string;
  name: string;
  email: string;
  teamId: string | null;
  teamName: string | null;
  role: Role;
  scored: ScoredAgent;
}
export interface Roster {
  agents: RosterAgent[];
  teams: RosterTeam[];
  crewLeads: RosterCrewLead[];
}

const TEAMS: RosterTeam[] = [
  { id: "t-coastal", name: "Coastal Crew", slug: "coastal" },
  { id: "t-harbor", name: "Harbor Crew", slug: "harbor" },
];

// name → { team, role }. Crew leads lead their team; the rest are trainees.
const ASSIGN: Record<string, { team: string | null; role: Role }> = {
  "Sarah Chen": { team: "t-coastal", role: "crew_lead" },
  "Marcus Williams": { team: "t-coastal", role: "agent" },
  "Emily Rodriguez": { team: "t-coastal", role: "agent" },
  "David Kim": { team: "t-harbor", role: "crew_lead" },
  "Jessica Thompson": { team: "t-harbor", role: "agent" },
  "Alex Rivera": { team: "t-harbor", role: "agent" },
  "Jordan Lee": { team: "t-harbor", role: "agent" },
};

export function getSampleRoster(): Roster {
  const agents: RosterAgent[] = getSampleAgents().map((a) => {
    const asg = ASSIGN[a.name] ?? { team: null, role: "agent" as Role };
    const team = TEAMS.find((t) => t.id === asg.team) ?? null;
    return {
      id: a.agentId,
      name: a.name,
      email: a.email,
      teamId: asg.team,
      teamName: team?.name ?? null,
      role: asg.role,
      scored: scoreAgent(a),
    };
  });

  // A management user (views everyone) — not a producing agent.
  agents.push({
    id: "mgr-morgan",
    name: "Morgan Vale",
    email: "morgan@anchorteam.com",
    teamId: null,
    teamName: null,
    role: "management",
    scored: scoreAgent({ agentId: "mgr-morgan", name: "Morgan Vale", email: "morgan@anchorteam.com", period: "2026-06", metrics: {} }),
  });

  const crewLeads: RosterCrewLead[] = agents
    .filter((a) => a.role === "crew_lead" && a.teamId)
    .map((a) => ({ agentId: a.id, teamId: a.teamId as string }));

  return { agents, teams: TEAMS, crewLeads };
}

/** Find a roster person by email (case-insensitive). */
export function findByEmail(roster: Roster, email: string): RosterAgent | undefined {
  return roster.agents.find((a) => a.email.toLowerCase() === email.toLowerCase());
}
