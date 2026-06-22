# CLAUDE.md — Metrics Dashboard

## What this project is

A real estate business intelligence dashboard for **The Anchor Group** brokerage, tracking Zillow Preferred lead metrics and team operational performance. Two frontends (DORI Intelligence + Agent Portal) consume data from a Python pipeline that pulls from the Follow Up Boss (FUB) CRM API.

**Live at:** metrics.joelycannoli.com (GitHub Pages)

## Repository structure

```
index.html                    # DORI Intelligence dashboard (dark theme, password-auth, chat + gauges)
portal.html                   # Agent/crew-lead portal (light theme, Supabase auth, per-agent metrics)
zillow-metrics.json           # Live metrics endpoint, auto-refreshed by GitHub Actions every 4h
anchor-logo.png / favicon.png # Brand assets
CNAME                         # GitHub Pages custom domain
ZILLOW_DATA_WIRING.md         # Status doc for which Zillow gauges are live vs unavailable

pipeline/                     # Python data pipeline (runs in GitHub Actions + optionally on Pi)
  publish_zillow_metrics.py   # Entry point: computes team metrics from FUB, writes zillow-metrics.json
  config/
    settings.py               # All config — env vars, paths, brand colors, agent roster
  src/
    fub_client.py             # FUB API client — monthly Zillow Preferred metrics (/people, /calls, /deals, /appointments)
    fub_daily_metrics.py      # Daily operational pulse — MTD metrics, activity points, leaderboard scoring

.github/workflows/
  refresh-zillow.yml          # Cron (every 4h) + manual trigger: runs pipeline, commits zillow-metrics.json
```

## Tech stack

- **Frontends:** Vanilla HTML/CSS/JS (no build step). Chart.js for gauges. No framework.
- **DORI dashboard (index.html):** Password auth (SHA-256 hash check), n8n webhooks for chat/vision/email, canvas gauge engine
- **Portal (portal.html):** Supabase Auth (email/password), Supabase PostgREST queries for per-agent metrics (tables: `agents`, `agent_metrics`, `team_averages`)
- **Pipeline:** Python 3.11+, single dependency (`requests`). FUB REST API with Basic auth + X-System headers.
- **Data flow:** GitHub Actions runs `pipeline/publish_zillow_metrics.py` → commits `zillow-metrics.json` → GitHub Pages serves it → dashboards fetch on load
- **Optional:** Supabase for per-agent portal data (RLS-protected), Neon Postgres for historical storage

## Key conventions

### Frontend

- **No innerHTML with dynamic content.** All message/label rendering uses `document.createElement` + `textContent`. This is a security invariant.
- **Gauges are canvas-based**, drawn via `drawGauge()` (performance gauges) and `drawZillow()` (Zillow Preferred gauges). Both use the same half-circle arc pattern with needle.
- **Zillow gauge color tiers:** red (`#C0392B` Below Min) → teal (`#046568` Above Min) → green (`#5FB87A` Best of Zillow) → cyan (`#82C8C3` Elite)
- **Performance gauge color tiers:** red (0-70%) → amber (70-100%) → green (100-130%) → blue (130%+)
- The `fetchZillow()` function loads `zillow-metrics.json` and auto-flips the badge from "SAMPLE" to "LIVE" when real data is present. Metrics listed in the `unavailable` array render as "N/A".
- Portal `PERIOD` is dynamically computed (current year-month). Never hardcode it.

### Pipeline (Python)

- **Observational only.** The pipeline reads FUB data, computes metrics, and writes JSON/DB. It never sends emails, notifications, or any outbound correspondence.
- **Env vars for secrets:** `FUB_API_KEY`, `FUB_X_SYSTEM`, `FUB_X_SYSTEM_KEY` (required). `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` (optional, for portal sync). Never hardcode credentials.
- **Soft-fail pattern:** When `/calls`, `/appointments`, or `/deals` return 404/403, the code catches the error, logs a warning, and returns `[]` — the rest of the agent computation continues. Individual agent errors don't abort the batch.
- **`_null_record` must stay in sync with `_compute_monthly_metrics`** — both return dicts must have the same keys. If you add a field to one, add it to the other.
- **Zillow lead identification:** `is_zillow_preferred()` in `fub_daily_metrics.py` matches by `sourceId == 15` OR substring match on source name (`"premier agent"`, `"zillow"`). This is tenant-specific.
- **FUB API retry:** Exponential backoff on 5xx/network errors, honors `Retry-After` on 429, no retry on 4xx (except 429). Max retries controlled by `FUB_MAX_RETRIES` (default 3).
- **`_get()` is duplicated** in both `fub_client.py` and `fub_daily_metrics.py` with identical logic. Same for `_auth_header()`. This is intentional — the two modules can run independently.

### Metrics definitions

| Metric | Source | Calculation |
|---|---|---|
| Pickup Rate | `/v1/calls` | Connected outbound calls (duration ≥ 30s or non-negative outcome) / total outbound attempts |
| Speed to Lead | `/v1/calls` + `/v1/people` | First outbound call timestamp − lead created timestamp, median across agents |
| Appointment Rate | `/v1/appointments` | Unique Zillow leads with an appointment / total Zillow leads |
| pCVR | Zillow UI only | Not available via FUB API — stays unavailable |
| CSAT | Not tracked | Stays unavailable |
| ZHL Pre-Approval | Not tracked | Stays unavailable |

### Activity points (leaderboard)

```
Appointments Set     × 500
Conversations 2+ min × 100
Call Attempts         × 10
Texts Sent            × 2
Emails Sent           × 1
```

## Development workflow

### Running the pipeline locally

```bash
cd pipeline
pip install -r requirements.txt
export FUB_API_KEY="..."
export FUB_X_SYSTEM="..."
export FUB_X_SYSTEM_KEY="..."
python publish_zillow_metrics.py              # print JSON to stdout
python publish_zillow_metrics.py out.json     # also write to file
```

### Testing the frontends

No build step — open `index.html` or `portal.html` directly in a browser, or use any static file server. The DORI dashboard password is checked against the SHA-256 hash in `PH` constant.

### Deployment

- Push to `main` → GitHub Pages auto-deploys the static files
- `zillow-metrics.json` is refreshed by the `refresh-zillow.yml` workflow every 4 hours (or manually via workflow_dispatch)
- The workflow runs `publish_zillow_metrics.py`, commits the updated JSON if changed, and pushes

### Commit style

```
chore: refresh zillow-metrics.json (live FUB) [skip ci]
fix: dynamic portal period, null-record field parity, XSS hardening
```

Lowercase prefix (`chore:`, `fix:`, `feat:`), concise description. Automated commits from the refresh workflow include `[skip ci]` to avoid recursive triggers.

## Things to be careful about

- **Do not wire approximate/proxy data into Zillow gauges.** If a metric can't be computed accurately from FUB, mark it unavailable — don't fake it. See `ZILLOW_DATA_WIRING.md`.
- **The `storage` module (`from src import storage`) is referenced but does not exist in this repo.** It's imported lazily in fallback paths in `fub_client.py` and `fub_daily_metrics.py`. Those paths will raise `ImportError` if triggered. This is a known gap — the module lives in a separate deployment.
- **`config/thresholds.json` is referenced in `settings.py` (`THRESHOLDS_FILE`) but does not exist.** Not currently used by any code path in this repo.
- **FUB stage IDs are tenant-specific.** `STAGE_NEW = 26`, `APPT_STAGE_IDS = (29, 30)` in `fub_daily_metrics.py`. If the FUB tenant changes stages, these constants need updating.
- **Supabase anon key in portal.html is public-safe** (RLS governs access). The service key is only in GitHub Actions secrets, never in frontend code.
- **No test suite.** There are no unit or integration tests in this repo. Validate pipeline changes by running `publish_zillow_metrics.py` locally with real or mock FUB credentials.
- **Brand colors** are documented in `config/settings.py` under `BRAND`. Primary: Clear Water teal `#04646B`, accent: Pearl Aqua `#82C7C3`, background: Sandy Shore `#F7EDE2`.
