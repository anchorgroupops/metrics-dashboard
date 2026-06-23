/**
 * Server-side viewer resolution + route guards. Server-only.
 *
 * Resolves the current viewer from the HTTP-only session cookie (DB-backed in
 * production), with a non-production `DEV_VIEWER_EMAIL` override so the
 * role-based views are demonstrable without email/DB. Returns the rbac `Viewer`
 * plus the resolved roster person.
 */
import { cookies } from "next/headers";
import { prisma } from "../db";
import { getSampleRoster, type Roster, type RosterAgent } from "../roster";
import { buildViewer, type Viewer } from "../rbac";
import { lookupSession } from "./store";

export const SESSION_COOKIE = "anchor_session";

export interface ViewerContext {
  viewer: Viewer;
  self: RosterAgent;
  roster: Roster;
}

/** Resolve the current viewer, or null when not signed in. */
export async function getViewerContext(): Promise<ViewerContext | null> {
  // NOTE: the display roster is the demonstration roster for now; wiring
  // DB-scored agents here is a follow-up. RBAC + auth below are production-ready.
  const roster = getSampleRoster();

  let agentId: string | null = null;
  let devEmail: string | undefined;
  try {
    const jar = await cookies();
    const token = jar.get(SESSION_COOKIE)?.value;
    if (token) agentId = await lookupSession(prisma, token);
    // Non-production: a `dev_as` cookie impersonates a roster email for previewing
    // the role-based views without email/DB.
    if (process.env.NODE_ENV !== "production") {
      devEmail = jar.get("dev_as")?.value ?? process.env.DEV_VIEWER_EMAIL;
    }
  } catch {
    agentId = null; // no DB / not signed in
  }

  let self = agentId ? roster.agents.find((a) => a.id === agentId) : undefined;
  if (!self && devEmail) {
    self = roster.agents.find((a) => a.email.toLowerCase() === devEmail!.toLowerCase());
  }

  if (!self) return null;
  const viewer = buildViewer({ id: self.id, role: self.role }, roster.crewLeads);
  return { viewer, self, roster };
}

/** The home route a viewer should land on, by role. */
export function defaultRouteFor(ctx: ViewerContext): string {
  if (ctx.viewer.role === "agent") return `/agent/${ctx.self.id}`;
  return "/team";
}
