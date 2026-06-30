# DORI Metrics — Anchor Group Intelligence Dashboard

Real estate performance intelligence platform for The Anchor Group. Aggregates Zillow pipeline data, FUB agent metrics, and market indicators into a unified dashboard for team-wide visibility.

## Stack

- **Next.js** (App Router) + TypeScript
- **Prisma** — database ORM
- **Vitest** — unit tests
- Deployed on **Vercel**

## Setup

```bash
cp .env.example .env.local    # fill in DB connection, API keys
npm install
npx prisma migrate dev        # apply database migrations
npm run dev                   # http://localhost:3000
```

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm test` | Run Vitest tests |

## Data Sources

See [`ZILLOW_DATA_WIRING.md`](ZILLOW_DATA_WIRING.md) for the Zillow pipeline data flow and field mappings.

## CI / Automation

- **Refresh Zillow** — 4-hour cron job (`ci/refresh-zillow`) creates a bot branch, pushes updated `zillow-metrics.json`, and auto-merges via PR
- **Secret scan** — Gitleaks runs on every push
- **PR review** — automated docs/security/lint check on all PRs

## Environment Variables

See `.env.example` for the full list. Required: database URL, Zillow API credentials.
