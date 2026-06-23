/**
 * Weekly Zillow Preferred standards research runner.
 *
 * 1. Loads the committed snapshot (config/zillow-standards.json).
 * 2. Researches the current standards via Claude web_search.
 * 3. Diffs the two and writes any changes to the snapshot + a markdown report.
 * 4. Notifies Slack when something changed.
 *
 * Run weekly by .github/workflows/weekly-research.yml; the workflow commits the
 * updated snapshot. No-ops cleanly (exit 0) when ANTHROPIC_API_KEY is absent.
 *
 * Env: ANTHROPIC_API_KEY (required to research), SLACK_WEBHOOK_URL (optional),
 *      NOTEBOOKLM_URL (optional, recorded as the milestone source).
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { diffStandards, formatChange, type StandardsSnapshot } from "../src/lib/research/standards";
import { researchZillowStandards } from "../src/lib/research/client";
import { postSlack } from "../src/lib/notify/slack";

const SNAPSHOT_PATH = resolve(process.cwd(), "config/zillow-standards.json");
const REPORT_PATH = resolve(process.cwd(), "config/zillow-standards.research.md");

async function main(): Promise<number> {
  const committed = JSON.parse(readFileSync(SNAPSHOT_PATH, "utf-8")) as StandardsSnapshot;

  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("[research] ANTHROPIC_API_KEY not set — skipping weekly research.");
    return 0;
  }

  let researched: StandardsSnapshot;
  try {
    researched = await researchZillowStandards({
      notebooklmUrl: process.env.NOTEBOOKLM_URL ?? committed.notebooklm_url,
    });
  } catch (err) {
    console.error(`[research] failed: ${(err as Error).message}`);
    await postSlack({ text: `:warning: Weekly Zillow standards research failed: ${(err as Error).message}` });
    return 1;
  }

  const changes = diffStandards(committed, researched);
  const stamp = researched.researched_at;

  if (changes.length === 0) {
    console.log(`[research] No changes detected (${stamp}).`);
    // Touch the report so it's clear the check ran.
    writeFileSync(
      REPORT_PATH,
      `# Zillow Preferred standards — research log\n\nLast checked: ${stamp}\n\nNo changes detected vs the committed standards.\n`,
    );
    return 0;
  }

  // Merge researched values into the committed snapshot (preserve labels/weights).
  const merged: StandardsSnapshot = {
    ...committed,
    researched_at: stamp,
    source: researched.source,
    metrics: { ...committed.metrics },
  };
  for (const [key, m] of Object.entries(researched.metrics)) {
    merged.metrics[key] = { ...committed.metrics[key], ...m };
  }
  writeFileSync(SNAPSHOT_PATH, JSON.stringify(merged, null, 2) + "\n");

  const lines = changes.map(formatChange);
  writeFileSync(
    REPORT_PATH,
    `# Zillow Preferred standards — research log\n\nLast checked: ${stamp}\n\n## Changes detected (${changes.length})\n\n` +
      lines.map((l) => `- ${l}`).join("\n") +
      "\n\n> Review and update \`src/lib/thresholds.ts\` if these affect the live scorecard.\n",
  );

  console.log(`[research] ${changes.length} change(s) detected:\n` + lines.map((l) => `  • ${l}`).join("\n"));
  await postSlack({
    text:
      `:satellite: *Zillow Preferred standards changed* (${stamp}) — ${changes.length} update(s):\n` +
      lines.map((l) => `• ${l}`).join("\n") +
      `\nCommitted to \`config/zillow-standards.json\`; review \`thresholds.ts\` if the scorecard is affected.`,
  });
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error("[research] fatal:", err);
    process.exit(1);
  });
