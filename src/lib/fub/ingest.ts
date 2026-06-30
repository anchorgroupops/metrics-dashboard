/**
 * FUB ingestion: pull the activity surface for every agent in a period and
 * reduce each agent's raw records to a `FubMetricRecord`.
 *
 * Pure aggregation (`aggregateAgentMetrics`) is separated from the network
 * orchestration (`pullFubMetrics`) so the reduction is unit-tested directly
 * against fixture payloads, and the orchestration is tested with a fake client.
 */

import type { FubMetricRecord } from "../types";
import { periodWindow } from "../period";
import { FubClient, isZillowLead } from "./client";

export interface RawAgentResources {
  calls: Array<Record<string, unknown>>;
  texts: Array<Record<string, unknown>>;
  appointments: Array<Record<string, unknown>>;
  deals: Array<Record<string, unknown>>;
  tasks: Array<Record<string, unknown>>;
  people: Array<Record<string, unknown>>;
}

const isOutbound = (c: Record<string, unknown>) =>
  !c.isIncoming && String(c.direction ?? "outbound").toLowerCase() !== "inbound";

const isOutboundText = (t: Record<string, unknown>) =>
  !t.isIncoming && String(t.direction ?? "outbound").toLowerCase() !== "inbound";

/** Reduce one agent's raw FUB resources to a flat metric record. Pure. */
export function aggregateAgentMetrics(
  agentId: string,
  period: string,
  r: RawAgentResources,
): FubMetricRecord {
  const calls = r.calls.filter(isOutbound).length;
  const texts = r.texts.filter(isOutboundText).length;
  const appointments = r.appointments.length;
  const deals = r.deals.length;
  const nurtureTasks = r.tasks.length;
  const zillowLeads = r.people.filter(isZillowLead).length;

  return { agentId, period, calls, texts, appointments, deals, nurtureTasks, zillowLeads };
}

export interface PullResult {
  records: FubMetricRecord[];
  errors: Array<{ agentId: string; name: string; error: string }>;
}

export interface RosterEntry {
  id: string;
  name: string;
  email: string;
}

/**
 * Pull FUB metrics for a period. Discovers the roster from FUB when `roster`
 * is omitted. Per-agent failures are captured (not thrown) so one bad agent
 * never aborts the run.
 */
export async function pullFubMetrics(
  client: FubClient,
  period: string,
  roster?: RosterEntry[],
): Promise<PullResult> {
  const win = periodWindow(period);
  const agents = roster ?? (await client.fetchUsers());
  const records: FubMetricRecord[] = [];
  const errors: PullResult["errors"] = [];

  for (const agent of agents) {
    try {
      const [calls, texts, appointments, deals, tasks, people] = await Promise.all([
        client.fetchCalls(agent.id, win.createdAfter, win.createdBefore),
        client.fetchTextMessages(agent.id, win.createdAfter, win.createdBefore),
        client.fetchAppointments(agent.id, win.createdAfter, win.createdBefore),
        client.fetchDeals(agent.id, win.createdAfter, win.createdBefore),
        client.fetchTasks(agent.id, win.createdAfter, win.createdBefore),
        client.fetchPeople(agent.id, win.createdAfter, win.createdBefore),
      ]);
      records.push(
        aggregateAgentMetrics(agent.id, win.period, {
          calls,
          texts,
          appointments,
          deals,
          tasks,
          people,
        }),
      );
    } catch (err) {
      errors.push({ agentId: agent.id, name: agent.name, error: (err as Error).message });
    }
  }

  return { records, errors };
}
