/**
 * Zillow Preferred scraper.
 *
 * pCVR, pickup rate, and ZHL pre-approval progress are **only** available in the
 * Zillow Premier Agent / FUB web UI — there is no API for them (see
 * ZILLOW_DATA_WIRING.md). Production extraction therefore drives a headless
 * browser (Playwright) to download the Performance Report, then parses its rows
 * here.
 *
 * This module keeps the *parsing* (pure, fully tested) separate from the
 * *fetching* (browser automation, injected). The default fetcher is a
 * dynamically-imported Playwright backend so the rest of the app — and the test
 * suite — never depends on a browser being installed.
 */

import type { ZillowMetricRecord } from "../types";
import { normalizePeriod } from "../period";

/** A raw report row keyed by (possibly messy) column headers. */
export type ReportRow = Record<string, string>;

// Header variants → canonical field. Matching is case-insensitive and ignores
// punctuation/whitespace so "pCVR", "p_cvr", and "Predicted Conversion Rate"
// all land on `pcvr`.
const HEADER_ALIASES: Record<string, keyof ZillowMetricRecord> = {
  agent: "agentName",
  agentname: "agentName",
  name: "agentName",
  pcvr: "pcvr",
  predictedconversionrate: "pcvr",
  conversionrate: "pcvr",
  pickuprate: "pickupRate",
  pickup: "pickupRate",
  answerrate: "pickupRate",
  zhlpreapproval: "zhlPreapproval",
  zhlpreapprovalprogress: "zhlPreapproval",
  zhl: "zhlPreapproval",
  preapproval: "zhlPreapproval",
  csat: "csat",
  clientsatisfaction: "csat",
  connections: "connections",
  connected: "connections",
  leads: "leads",
  totalleads: "leads",
};

const canon = (h: string) => h.toLowerCase().replace(/[^a-z]/g, "");

/** Parse a percentage cell ("4.0%", "0.04", "4") into a decimal 0-1, or null. */
export function parsePercent(raw: string | undefined): number | null {
  if (raw == null) return null;
  const s = raw.trim();
  if (!s || s === "-" || s.toLowerCase() === "n/a") return null;
  const hasPercent = s.includes("%");
  const n = Number(s.replace(/[%,\s]/g, ""));
  if (Number.isNaN(n)) return null;
  // "4%" or "4.0" (whole number ≥ 1) → treat as percent points; "0.04" → already a decimal.
  if (hasPercent) return n / 100;
  return n > 1 ? n / 100 : n;
}

/** Parse an integer count cell, or null. */
export function parseCount(raw: string | undefined): number | null {
  if (raw == null) return null;
  const s = raw.trim().replace(/[,\s]/g, "");
  if (!s || s === "-" || s.toLowerCase() === "n/a") return null;
  const n = Number(s);
  return Number.isNaN(n) ? null : Math.round(n);
}

/**
 * Parse Zillow Performance Report rows into metric records. Pure and tolerant
 * of header naming drift. `agentId` is left equal to the agent name here; the
 * ingestion layer resolves it to a real agent id via name/email matching.
 */
export function parseZillowReport(rows: ReportRow[], period: string): ZillowMetricRecord[] {
  const p = normalizePeriod(period);
  const out: ZillowMetricRecord[] = [];

  for (const row of rows) {
    // Build a canonicalized view of this row.
    const fields: Partial<Record<keyof ZillowMetricRecord, string>> = {};
    for (const [header, value] of Object.entries(row)) {
      const key = HEADER_ALIASES[canon(header)];
      if (key) fields[key] = value;
    }

    const agentName = (fields.agentName ?? "").trim();
    if (!agentName) continue; // skip blank/total rows

    out.push({
      agentId: agentName, // resolved downstream
      agentName,
      period: p,
      pcvr: parsePercent(fields.pcvr),
      pickupRate: parsePercent(fields.pickupRate),
      zhlPreapproval: parsePercent(fields.zhlPreapproval),
      csat: parsePercent(fields.csat),
      connections: parseCount(fields.connections),
      leads: parseCount(fields.leads),
    });
  }

  return out;
}

export interface ScrapeConfig {
  period: string;
  // When true (or when creds are missing), return synthetic rows instead of
  // driving a browser. Lets the pipeline run end-to-end in CI/dev.
  mock?: boolean;
  webUser?: string;
  webPassword?: string;
  reportUrl?: string;
  // Injectable fetcher (defaults to the Playwright backend). Returns raw rows.
  fetchRows?: (cfg: ScrapeConfig) => Promise<ReportRow[]>;
}

/** Synthetic report rows for local/dev runs without Zillow credentials. */
export function mockZillowRows(): ReportRow[] {
  return [
    { Agent: "Alex Rivera", pCVR: "5.2%", "Pickup Rate": "42%", "ZHL Pre-Approval": "88%", CSAT: "96%", Connections: "210", Leads: "21" },
    { Agent: "Jordan Lee", pCVR: "2.1%", "Pickup Rate": "22%", "ZHL Pre-Approval": "60%", CSAT: "82%", Connections: "95", Leads: "14" },
  ];
}

/**
 * Default browser-backed row fetcher. Dynamically imports the Playwright backend
 * so neither the build nor the test suite requires `playwright` to be present.
 */
async function defaultFetchRows(cfg: ScrapeConfig): Promise<ReportRow[]> {
  const mod = (await import("./playwright")) as {
    fetchReportRows: (cfg: ScrapeConfig) => Promise<ReportRow[]>;
  };
  return mod.fetchReportRows(cfg);
}

/** Scrape (or mock) Zillow metrics for a period and return parsed records. */
export async function scrapeZillowMetrics(cfg: ScrapeConfig): Promise<ZillowMetricRecord[]> {
  const useMock = cfg.mock || !cfg.webUser || !cfg.webPassword;
  const fetchRows = cfg.fetchRows ?? (useMock ? async () => mockZillowRows() : defaultFetchRows);
  const rows = await fetchRows(cfg);
  return parseZillowReport(rows, cfg.period);
}
