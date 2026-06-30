import { describe, it, expect } from "vitest";
import {
  normalizeRole,
  buildViewer,
  canViewAgent,
  visibleAgents,
  assertCanView,
  AccessDeniedError,
  type Viewer,
} from "@/lib/rbac";

const roster = [
  { id: "a1", teamId: "t1" }, // crew lead's own team
  { id: "a2", teamId: "t1" }, // trainee
  { id: "a3", teamId: "t2" }, // other team
];

describe("normalizeRole", () => {
  it("canonicalizes role aliases", () => {
    expect(normalizeRole("admin")).toBe("management");
    expect(normalizeRole("Manager")).toBe("management");
    expect(normalizeRole("crewLead")).toBe("crew_lead");
    expect(normalizeRole("trainer")).toBe("crew_lead");
    expect(normalizeRole("agent")).toBe("agent");
    expect(normalizeRole(undefined)).toBe("agent");
  });
});

describe("buildViewer", () => {
  it("derives crew_lead from the crew_leads table even if role lags", () => {
    const v = buildViewer({ id: "a1", role: "agent" }, [{ agentId: "a1", teamId: "t1" }]);
    expect(v.role).toBe("crew_lead");
    expect(v.ledTeamIds).toEqual(["t1"]);
  });
  it("keeps explicit management role", () => {
    const v = buildViewer({ id: "m1", role: "management" }, []);
    expect(v.role).toBe("management");
  });
});

describe("canViewAgent", () => {
  const mgmt: Viewer = { agentId: "m1", role: "management", ledTeamIds: [] };
  const lead: Viewer = { agentId: "a1", role: "crew_lead", ledTeamIds: ["t1"] };
  const agent: Viewer = { agentId: "a2", role: "agent", ledTeamIds: [] };

  it("management sees everyone", () => {
    expect(roster.every((r) => canViewAgent(mgmt, r))).toBe(true);
  });
  it("crew lead sees own-team trainees and self, not other teams", () => {
    expect(canViewAgent(lead, { id: "a2", teamId: "t1" })).toBe(true); // trainee
    expect(canViewAgent(lead, { id: "a1", teamId: "t1" })).toBe(true); // self
    expect(canViewAgent(lead, { id: "a3", teamId: "t2" })).toBe(false); // other team
  });
  it("agent sees only self", () => {
    expect(canViewAgent(agent, { id: "a2", teamId: "t1" })).toBe(true);
    expect(canViewAgent(agent, { id: "a1", teamId: "t1" })).toBe(false);
  });
});

describe("visibleAgents", () => {
  it("filters the roster per role", () => {
    const lead: Viewer = { agentId: "a1", role: "crew_lead", ledTeamIds: ["t1"] };
    expect(visibleAgents(lead, roster).map((a) => a.id).sort()).toEqual(["a1", "a2"]);

    const agent: Viewer = { agentId: "a3", role: "agent", ledTeamIds: [] };
    expect(visibleAgents(agent, roster).map((a) => a.id)).toEqual(["a3"]);

    const mgmt: Viewer = { agentId: null, role: "management", ledTeamIds: [] };
    expect(visibleAgents(mgmt, roster)).toHaveLength(3);
  });
});

describe("assertCanView", () => {
  it("throws AccessDeniedError when not permitted", () => {
    const agent: Viewer = { agentId: "a2", role: "agent", ledTeamIds: [] };
    expect(() => assertCanView(agent, { id: "a1", teamId: "t1" })).toThrow(AccessDeniedError);
    expect(() => assertCanView(agent, { id: "a2", teamId: "t1" })).not.toThrow();
  });
});
