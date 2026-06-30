/**
 * Weekly Zillow Preferred standards research via the Claude Messages API with
 * the web_search server tool.
 *
 * Asks Claude to look up the *current* Zillow Preferred program minimums,
 * milestone thresholds, and market averages, and return them as strict JSON in
 * our `StandardsSnapshot` shape. The committed snapshot
 * (`config/zillow-standards.json`) is diffed against the result so changes are
 * surfaced (see scripts/research-standards.ts).
 *
 * Raw HTTP with an injectable `fetch` (no SDK dependency, fully unit-testable).
 * Model: claude-opus-4-8; tool: web_search_20260209 (per the claude-api skill).
 */

import type { StandardsSnapshot } from "./standards";

export const RESEARCH_MODEL = "claude-opus-4-8";
const WEB_SEARCH_TOOL = { type: "web_search_20260209", name: "web_search", max_uses: 6 };
const API_URL = "https://api.anthropic.com/v1/messages";

export interface ResearchConfig {
  apiKey?: string;
  model?: string;
  fetchImpl?: typeof fetch;
  notebooklmUrl?: string;
  maxContinuations?: number;
}

const PROMPT = `You are researching the current (2026) Zillow Preferred / Premier Agent program
standards for a real-estate brokerage scorecard. Use web search to verify the
latest published figures.

Return ONLY a JSON object (no prose, no markdown fences) with this exact shape:

{
  "metrics": {
    "pcvr":            { "minimum": <decimal>, "milestone": <decimal>, "milestone_label": "Elite", "elite": <decimal>, "industry_avg": <decimal|null>, "unit": "percent" },
    "pickup_rate":     { "minimum": <decimal>, "milestone": <decimal>, "milestone_label": "Superior", "elite": <decimal>, "industry_avg": <decimal|null>, "unit": "percent" },
    "zhl_preapproval": { "minimum": <decimal>, "milestone": <decimal>, "milestone_label": "Optimized", "elite": <decimal|null>, "industry_avg": <decimal|null>, "unit": "ratio" },
    "csat":            { "minimum": <decimal>, "milestone": <decimal>, "milestone_label": "Best of Zillow", "elite": <decimal>, "industry_avg": <decimal|null>, "unit": "percent" },
    "speed_to_lead":   { "minimum": null, "milestone": <seconds>, "milestone_label": "World-Class", "elite": <seconds>, "industry_avg": <seconds|null>, "unit": "seconds" }
  },
  "notes": "<one sentence on anything that changed vs the well-known 2026 baseline>"
}

Express percentages as decimals (4% -> 0.04), ratios as decimals (100% of target -> 1.0),
and times in seconds. If a figure cannot be verified, use the known 2026 baseline:
pCVR min 0.04 / milestone 0.045 / elite 0.10; pickup min 0.25 / milestone 0.30 / elite 0.60;
ZHL min 1.0 / milestone 1.0; CSAT min 0.85 / milestone 0.90 / elite 0.95; speed milestone 60 / elite 30.`;

interface AnthropicResponse {
  stop_reason?: string;
  content?: Array<{ type: string; text?: string }>;
}

/** Extract the concatenated text blocks from a Messages API response. */
function extractText(resp: AnthropicResponse): string {
  return (resp.content ?? [])
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text as string)
    .join("");
}

/** Strip markdown fences and parse the first JSON object in the text. */
export function parseStandardsJson(text: string): { metrics: StandardsSnapshot["metrics"]; notes?: string } {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object found in research response");
  return JSON.parse(cleaned.slice(start, end + 1));
}

export async function researchZillowStandards(config: ResearchConfig = {}): Promise<StandardsSnapshot> {
  const apiKey = config.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is required for standards research");
  const fetchImpl = config.fetchImpl ?? fetch;
  const model = config.model ?? RESEARCH_MODEL;
  const maxContinuations = config.maxContinuations ?? 5;

  // messages array; grows if the server-tool loop pauses (pause_turn).
  const messages: Array<{ role: string; content: unknown }> = [{ role: "user", content: PROMPT }];

  let resp!: AnthropicResponse;
  for (let i = 0; i <= maxContinuations; i++) {
    const httpResp = await fetchImpl(API_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 2048,
        tools: [WEB_SEARCH_TOOL],
        messages,
      }),
    });
    if (!httpResp.ok) {
      throw new Error(`Claude API ${httpResp.status}: ${await httpResp.text()}`);
    }
    resp = (await httpResp.json()) as AnthropicResponse;
    if (resp.stop_reason !== "pause_turn") break;
    // Server tool paused — append the assistant turn and resume.
    messages.push({ role: "assistant", content: resp.content });
  }

  const parsed = parseStandardsJson(extractText(resp));
  return {
    researched_at: new Date().toISOString().slice(0, 10),
    source: "Claude web_search (weekly) + NotebookLM 2026 guidance",
    notebooklm_url: config.notebooklmUrl,
    metrics: parsed.metrics,
  };
}
