import { AgentMetrics } from "./types";
import { LEADERBOARD_WEIGHTS } from "./thresholds";

interface RawRow {
  [key: string]: string;
}

function parseCSV(text: string): RawRow[] {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const rows: RawRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Handle quoted CSV fields
    const values: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    const row: RawRow = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? "";
    });
    rows.push(row);
  }

  return rows;
}

function normalizeAgentName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export interface IngestResult {
  agents: AgentMetrics[];
  period: string;
  source: string;
  errors: string[];
}

// Ingest a generic agent metrics CSV (agent_id, name, email, period, metric columns)
export function ingestAgentCSV(text: string): IngestResult {
  const rows = parseCSV(text);
  const errors: string[] = [];
  const agents: AgentMetrics[] = [];
  let period = "";

  for (const row of rows) {
    const agentId = row.agent_id || row.agentId || row.id || "";
    const name = row.name || row.agent_name || row.Name || "";
    const email = row.email || row.Email || "";
    const rowPeriod = row.period || row.Period || "";

    if (!name) {
      errors.push(`Row missing name: ${JSON.stringify(row)}`);
      continue;
    }
    if (!period && rowPeriod) period = normalizePeriod(rowPeriod);

    const metrics: Record<string, number | null> = {};
    const metricColumns = Object.keys(row).filter(
      (k) => !["agent_id", "agentId", "id", "name", "agent_name", "Name", "email", "Email", "period", "Period"].includes(k)
    );

    for (const col of metricColumns) {
      const val = row[col];
      if (val === "" || val === "N/A" || val === "null" || val === undefined) {
        metrics[col] = null;
      } else {
        const parsed = parseFloat(val.replace("%", ""));
        metrics[col] = isNaN(parsed) ? null : (val.includes("%") ? parsed / 100 : parsed);
      }
    }

    agents.push({ agentId: agentId || `auto-${name.toLowerCase().replace(/\s/g, "-")}`, name: normalizeAgentName(name), email, period: period, metrics });
  }

  return { agents, period, source: "csv", errors };
}

// Ingest FUB deals export
export function ingestDealsCSV(text: string, period: string): Map<string, { closedDeals: number; totalLeads: number }> {
  const rows = parseCSV(text);
  const agentDeals = new Map<string, { closedDeals: number; totalLeads: number }>();

  for (const row of rows) {
    const agent = row["Assigned To"] || row["assigned_to"] || row["Agent"] || "";
    if (!agent) continue;

    const existing = agentDeals.get(agent) || { closedDeals: 0, totalLeads: 0 };
    existing.totalLeads++;

    const stage = (row["Stage"] || row["stage"] || "").toLowerCase();
    if (stage.includes("closed") || stage.includes("won") || stage.includes("sold")) {
      existing.closedDeals++;
    }
    agentDeals.set(agent, existing);
  }

  return agentDeals;
}

// Ingest FUB calls export
export function ingestCallsCSV(text: string): Map<string, { totalCalls: number; connectedCalls: number; conversations2min: number }> {
  const rows = parseCSV(text);
  const agentCalls = new Map<string, { totalCalls: number; connectedCalls: number; conversations2min: number }>();

  for (const row of rows) {
    const agent = row["User"] || row["user"] || row["Agent"] || row["assigned_to"] || "";
    if (!agent) continue;

    const existing = agentCalls.get(agent) || { totalCalls: 0, connectedCalls: 0, conversations2min: 0 };
    existing.totalCalls++;

    const duration = parseInt(row["Duration"] || row["duration"] || row["Duration (seconds)"] || "0", 10);
    const outcome = (row["Outcome"] || row["outcome"] || "").toLowerCase();

    if (duration >= 30 || outcome.includes("connected") || outcome.includes("answered")) {
      existing.connectedCalls++;
    }
    if (duration >= 120) {
      existing.conversations2min++;
    }
    agentCalls.set(agent, existing);
  }

  return agentCalls;
}

// Ingest FUB texts export
export function ingestTextsCSV(text: string): Map<string, number> {
  const rows = parseCSV(text);
  const agentTexts = new Map<string, number>();

  for (const row of rows) {
    const agent = row["User"] || row["user"] || row["Agent"] || row["From"] || "";
    if (!agent) continue;
    agentTexts.set(agent, (agentTexts.get(agent) || 0) + 1);
  }

  return agentTexts;
}

// Ingest FUB appointments export
export function ingestAppointmentsCSV(text: string): Map<string, number> {
  const rows = parseCSV(text);
  const agentAppts = new Map<string, number>();

  for (const row of rows) {
    const agent = row["Assigned To"] || row["assigned_to"] || row["Agent"] || row["User"] || "";
    if (!agent) continue;
    agentAppts.set(agent, (agentAppts.get(agent) || 0) + 1);
  }

  return agentAppts;
}

// Combine all four FUB exports into unified AgentMetrics
export function combineFubExports(
  deals: Map<string, { closedDeals: number; totalLeads: number }>,
  calls: Map<string, { totalCalls: number; connectedCalls: number; conversations2min: number }>,
  texts: Map<string, number>,
  appointments: Map<string, number>,
  period: string
): AgentMetrics[] {
  const allAgents = new Set<string>();
  deals.forEach((_, k) => allAgents.add(k));
  calls.forEach((_, k) => allAgents.add(k));
  texts.forEach((_, k) => allAgents.add(k));
  appointments.forEach((_, k) => allAgents.add(k));

  return Array.from(allAgents).map((name) => {
    const dealData = deals.get(name) || { closedDeals: 0, totalLeads: 0 };
    const callData = calls.get(name) || { totalCalls: 0, connectedCalls: 0, conversations2min: 0 };
    const textCount = texts.get(name) || 0;
    const apptCount = appointments.get(name) || 0;

    const pcvr = dealData.totalLeads > 0 ? dealData.closedDeals / dealData.totalLeads : null;
    const pickupRate = callData.totalCalls > 0 ? callData.connectedCalls / callData.totalCalls : null;
    const apptRate = dealData.totalLeads > 0 ? apptCount / dealData.totalLeads : null;

    const metrics: Record<string, number | null> = {
      pcvr,
      pickup_rate: pickupRate,
      speed_to_lead: null, // Not available from CSV exports alone
      appt_rate: apptRate,
      csat: null,
      zhl_preapproval: null,
      calls_made: callData.totalCalls,
      call_volume: callData.totalCalls,
      call_attempts: callData.totalCalls,
      conversations_2min: callData.conversations2min,
      texts_sent: textCount,
      emails_sent: 0,
      appointments_set: apptCount,
    };

    const points =
      apptCount * LEADERBOARD_WEIGHTS.appointments_set +
      callData.conversations2min * LEADERBOARD_WEIGHTS.conversations_2min +
      callData.totalCalls * LEADERBOARD_WEIGHTS.call_attempts +
      textCount * LEADERBOARD_WEIGHTS.texts_sent;

    metrics.activity_points = points;

    return {
      agentId: `fub-${name.toLowerCase().replace(/\s+/g, "-")}`,
      name: normalizeAgentName(name),
      email: "",
      period,
      metrics,
    };
  });
}

function normalizePeriod(raw: string): string {
  // "April 2026" -> "2026-04", "2026-04" -> "2026-04", "2026-04-15" -> "2026-04"
  const monthNames: Record<string, string> = {
    january: "01", february: "02", march: "03", april: "04",
    may: "05", june: "06", july: "07", august: "08",
    september: "09", october: "10", november: "11", december: "12",
  };

  const isoMatch = raw.match(/^(\d{4})-(\d{2})(?:-\d{2})?$/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}`;

  const nameMatch = raw.match(/^(\w+)\s+(\d{4})$/i);
  if (nameMatch) {
    const month = monthNames[nameMatch[1].toLowerCase()];
    if (month) return `${nameMatch[2]}-${month}`;
  }

  return raw;
}

export function ingestJSON(text: string): IngestResult {
  const data = JSON.parse(text);
  const rows: Record<string, unknown>[] = Array.isArray(data) ? data : (data.agents || data.rows || []);
  const errors: string[] = [];
  const agents: AgentMetrics[] = [];
  let period = "";

  for (const row of rows) {
    const r = row as Record<string, string | number | null>;
    const name = String(r.name || r.agent_name || "");
    if (!name) continue;

    const rowPeriod = String(r.period || "");
    if (!period && rowPeriod) period = normalizePeriod(rowPeriod);

    const metrics: Record<string, number | null> = {};
    for (const [k, v] of Object.entries(r)) {
      if (["agent_id", "name", "agent_name", "email", "period", "id"].includes(k)) continue;
      metrics[k] = typeof v === "number" ? v : v === null ? null : parseFloat(String(v)) || null;
    }

    agents.push({
      agentId: String(r.agent_id || r.id || `auto-${name.toLowerCase().replace(/\s/g, "-")}`),
      name: normalizeAgentName(name),
      email: String(r.email || ""),
      period,
      metrics,
    });
  }

  return { agents, period, source: "json", errors };
}
