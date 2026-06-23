# Data Pipeline — Foundation (Phase 1)

Automated ingestion that reconciles Follow Up Boss activity and Zillow Preferred
metrics into scored, queryable performance snapshots in Postgres.

## Data model (Prisma → Postgres)

`prisma/schema.prisma` defines the foundation models:

| Model | Table | Purpose |
|---|---|---|
| `Agent` | `agents` | Roster; carries `fubId` + `teamId` join keys. |
| `Team` | `teams` | Groups agents under one crew lead. |
| `CrewLead` | `crew_leads` | Team owner (own record; optional link to an `Agent`). |
| `FubMetric` | `fub_metrics` | Per agent/period FUB activity: calls, texts, appointments, deals, nurture tasks, zillow leads. |
| `ZillowMetric` | `zillow_metrics` | Per agent/period scraped Zillow: pCVR, pickup rate, ZHL pre-approval, CSAT. |
| `PerformanceSnapshot` | `performance_snapshots` | Nightly reconciled, scored join of the two surfaces. |

Migration: `prisma/migrations/*_init_foundation/migration.sql`
(`npm run db:migrate` applies it; `npm run db:generate` regenerates the client).

## Ingestion flow

```
            ┌─ FUB API ──────────────┐         ┌─ Zillow UI (Playwright) ─┐
            │ calls, textMessages,   │         │ Performance Report CSV   │
            │ appointments, deals,   │         │ → pCVR, pickup, ZHL,     │
            │ tasks, people          │         │   CSAT                   │
            └───────────┬────────────┘         └────────────┬─────────────┘
   src/lib/fub/ingest.ts │  (aggregate per agent)  src/lib/zillow/scraper.ts │ (parse + resolve)
                         ▼                                   ▼
                   FubMetricRecord[]                  ZillowMetricRecord[]
                         └───────────────┬───────────────────┘
                       src/lib/ingest/refresh.ts (combine → score → snapshot)
                                         ▼
                          PrismaDataStore upserts rows
                                         ▼
                    src/lib/integrity.ts cross-system check
                                         ▼
                     src/lib/notify/slack.ts → Slack summary
```

Entry point: `scripts/nightly-refresh.ts` (`npm run refresh`), scheduled by
`.github/workflows/nightly-refresh.yml` (nightly cron, 07:00 UTC).

## Key modules

- **`src/lib/fub/client.ts`** — typed FUB API client. Basic auth + `X-System`
  identity, offset pagination, exponential-backoff retries (no retry on 4xx),
  soft-fails 404/403 endpoints. Injectable `fetch` for tests.
- **`src/lib/fub/ingest.ts`** — reduces raw FUB resources to `FubMetricRecord`
  per agent; per-agent failures are captured, not thrown.
- **`src/lib/zillow/scraper.ts`** — pure report parser (`parseZillowReport`) +
  orchestration with a mock mode. Browser automation is isolated in
  `src/lib/zillow/playwright.ts` (optional `playwright` dep, dynamically
  imported).
- **`src/lib/ingest/resolve.ts`** — resolves source records to canonical agent
  ids (FUB id → email → unambiguous name).
- **`src/lib/ingest/refresh.ts`** — orchestrator; depends only on injected
  interfaces so it is unit-tested end-to-end.
- **`src/lib/integrity.ts`** — `checkIntegrity()` confirms every record links
  correctly across systems (agents↔teams↔crew_leads, metrics↔agents,
  snapshots↔metrics with matching agent+period; duplicate join keys are errors).
- **`src/lib/notify/slack.ts`** — incoming-webhook notifier; soft-fails when
  unconfigured.
- **`src/lib/notebooklm/client.ts`** — integration adapter; no-op default until a
  NotebookLM API is available.

## Running

```bash
npm install
npm run db:generate
npm run db:migrate            # needs DATABASE_URL
ZILLOW_MOCK=1 npm run refresh # dry-ish run: live FUB if FUB_API_KEY set, mock Zillow
npm test                      # 90 unit tests (no network, no DB)
```

## Notes / limitations

- pCVR, pickup rate, and ZHL pre-approval are **Zillow-UI-only** — there is no
  FUB API for them (see `ZILLOW_DATA_WIRING.md`). Production extraction requires
  the Playwright backend + FUB web creds + `ZILLOW_REPORT_URL`.
- `speed_to_lead` is not derivable from the period-level pull and is left `null`
  in snapshots for now.
- NotebookLM has no stable public API yet; the adapter records intent and is a
  drop-in swap once one exists.
