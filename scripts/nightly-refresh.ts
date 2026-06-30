/**
 * Nightly data-refresh entry point.
 *
 * Wires the real Prisma store, FUB client, and Zillow scraper into the
 * orchestrator, then exits non-zero if the run had errors so CI/cron surfaces
 * failures. Run with: `npm run refresh` (or `tsx scripts/nightly-refresh.ts`).
 *
 * Env:
 *   DATABASE_URL                 Postgres connection (required)
 *   FUB_API_KEY                  FUB API key (required for live pull)
 *   FUB_X_SYSTEM, FUB_X_SYSTEM_KEY  FUB system identity
 *   ZILLOW_WEB_USER, ZILLOW_WEB_PASSWORD, ZILLOW_REPORT_URL  Zillow scrape creds
 *   ZILLOW_MOCK=1                use synthetic Zillow rows (no browser)
 *   SLACK_WEBHOOK_URL            Slack incoming webhook for the summary
 *   REFRESH_PERIOD=YYYY-MM       override the period (default: current month)
 */

import { PrismaClient } from "@prisma/client";
import { currentPeriod } from "../src/lib/period";
import { FubClient } from "../src/lib/fub/client";
import { pullFubMetrics } from "../src/lib/fub/ingest";
import { scrapeZillowMetrics } from "../src/lib/zillow/scraper";
import { PrismaDataStore } from "../src/lib/ingest/prisma-store";
import { runNightlyRefresh } from "../src/lib/ingest/refresh";
import { notifyRefresh } from "../src/lib/notify/slack";
import type { AgentLink } from "../src/lib/types";

async function main(): Promise<number> {
  const period = process.env.REFRESH_PERIOD || currentPeriod();
  const prisma = new PrismaClient();
  const store = new PrismaDataStore(prisma);

  const fubKey = process.env.FUB_API_KEY ?? "";
  const fubClient = fubKey
    ? new FubClient({
        apiKey: fubKey,
        xSystem: process.env.FUB_X_SYSTEM,
        xSystemKey: process.env.FUB_X_SYSTEM_KEY,
      })
    : null;

  try {
    const summary = await runNightlyRefresh({
      period,
      store,
      pullFub: async (agents: AgentLink[]) => {
        if (!fubClient) return { records: [], errors: ["FUB_API_KEY not set — skipped FUB pull"] };
        const roster = agents
          .filter((a) => a.fubId)
          .map((a) => ({ id: a.fubId as string, name: a.name, email: a.email }));
        const res = await pullFubMetrics(fubClient, period, roster.length ? roster : undefined);
        return {
          records: res.records,
          errors: res.errors.map((e) => `FUB ${e.name}: ${e.error}`),
        };
      },
      scrapeZillow: () =>
        scrapeZillowMetrics({
          period,
          mock: process.env.ZILLOW_MOCK === "1",
          webUser: process.env.ZILLOW_WEB_USER,
          webPassword: process.env.ZILLOW_WEB_PASSWORD,
          reportUrl: process.env.ZILLOW_REPORT_URL,
        }),
      notify: (s) => notifyRefresh(s),
    });

    console.log(JSON.stringify(summary, null, 2));
    return summary.errors.length === 0 && summary.integrityOk ? 0 : 1;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error("[nightly-refresh] fatal:", err);
    process.exit(1);
  });
