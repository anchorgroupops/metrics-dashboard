/**
 * Resolve a source record (e.g. a Zillow report row keyed only by display name)
 * to a real agent id, so cross-system metrics link to one canonical agent.
 *
 * Strategy, most-reliable first: exact FUB id → exact email → normalized name.
 * Pure and unit-tested.
 */

import type { AgentLink } from "../types";

/** Lowercase, strip punctuation, collapse whitespace. "O'Brien, Sam" → "obrien sam". */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export interface ResolveKey {
  fubId?: string | null;
  email?: string | null;
  name?: string | null;
}

export function buildAgentIndex(agents: AgentLink[]) {
  const byFubId = new Map<string, AgentLink>();
  const byEmail = new Map<string, AgentLink>();
  const byName = new Map<string, AgentLink[]>();
  for (const a of agents) {
    if (a.fubId) byFubId.set(a.fubId, a);
    if (a.email) byEmail.set(a.email.toLowerCase(), a);
    const n = normalizeName(a.name);
    const list = byName.get(n) ?? [];
    list.push(a);
    byName.set(n, list);
  }
  return { byFubId, byEmail, byName };
}

/** Resolve a key to an agent id, or null when no confident match exists. */
export function resolveAgentId(key: ResolveKey, agents: AgentLink[]): string | null {
  const idx = buildAgentIndex(agents);
  if (key.fubId && idx.byFubId.has(key.fubId)) return idx.byFubId.get(key.fubId)!.id;
  if (key.email) {
    const hit = idx.byEmail.get(key.email.toLowerCase());
    if (hit) return hit.id;
  }
  if (key.name) {
    const matches = idx.byName.get(normalizeName(key.name));
    // Only resolve by name when it's unambiguous.
    if (matches && matches.length === 1) return matches[0].id;
  }
  return null;
}
