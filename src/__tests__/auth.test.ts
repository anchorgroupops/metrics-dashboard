import { describe, it, expect } from "vitest";
import { hashToken, generateToken, expiryFromNow, isExpired } from "@/lib/auth/tokens";
import { getSampleRoster, findByEmail } from "@/lib/roster";
import { buildViewer, visibleAgents } from "@/lib/rbac";

describe("auth tokens", () => {
  it("hashes deterministically and differs per token", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
    expect(hashToken("abc")).not.toBe(hashToken("abd"));
    expect(hashToken("abc")).toMatch(/^[0-9a-f]{64}$/);
  });
  it("generates unique URL-safe tokens", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });
  it("computes and checks expiry", () => {
    const now = 1_000_000;
    expect(expiryFromNow(15, now).getTime()).toBe(now + 15 * 60_000);
    expect(isExpired(new Date(now - 1), now)).toBe(true);
    expect(isExpired(new Date(now + 1000), now)).toBe(false);
  });
});

describe("roster RBAC", () => {
  const roster = getSampleRoster();
  const producing = roster.agents.filter((a) => a.role !== "management");
  const refs = producing.map((a) => ({ id: a.id, teamId: a.teamId }));
  const visibleIds = (email: string) => {
    const self = findByEmail(roster, email)!;
    const viewer = buildViewer({ id: self.id, role: self.role }, roster.crewLeads);
    return new Set(visibleAgents(viewer, refs).map((r) => r.id));
  };

  it("management sees every producing agent", () => {
    expect(visibleIds("morgan@anchorteam.com").size).toBe(producing.length);
  });

  it("a crew lead sees only their own team (self + trainees)", () => {
    // Sarah Chen leads Coastal Crew (Sarah, Marcus, Emily).
    const ids = visibleIds("sarah@anchorteam.com");
    const coastal = producing.filter((a) => a.teamId === "t-coastal").map((a) => a.id);
    expect([...ids].sort()).toEqual(coastal.sort());
    // No Harbor Crew member is visible.
    const david = findByEmail(roster, "david@anchorteam.com")!;
    expect(ids.has(david.id)).toBe(false);
  });

  it("a plain agent sees only themselves", () => {
    const marcus = findByEmail(roster, "marcus@anchorteam.com")!;
    const ids = visibleIds("marcus@anchorteam.com");
    expect([...ids]).toEqual([marcus.id]);
  });
});
