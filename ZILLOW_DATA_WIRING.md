# Zillow Preferred Gauges — Data Wiring Status & Requirements

## Current status (2026-06-22)

Three of six Zillow Preferred gauges are **live** — Pickup Rate, Speed to Lead,
and Appointment Rate — computed from FUB API data by the
`pipeline/publish_zillow_metrics.py` pipeline and published to
`zillow-metrics.json` via the GitHub Actions workflow (every 4 hours). The
dashboard's `fetchZillow()` auto-switches the badge from "· SAMPLE" to "· LIVE"
when it loads real values from that file.

| Gauge | Status | Source |
|---|---|---|
| **Pickup Rate** | **LIVE** | FUB `/v1/calls` outbound connect rate |
| **Speed to Lead** | **LIVE** | FUB `/v1/calls` first outbound call after lead created |
| **Appointment Rate** | **LIVE** | FUB `/v1/appointments` unique Zillow leads with appointment |
| **pCVR** (Predicted Conversion Rate) | Unavailable | Zillow-UI-only; not exposed via FUB API |
| **CSAT** | Unavailable | Not tracked in FUB |
| **ZHL Pre-Approval** | Unavailable | Market-specific, not in FUB |

## What was checked (2026-06-18)

- `anchor-agent-matrix` webhook (FUB `/v1/people`): returned `0% conversion,
  0 closed, 99% contact` — its stage-name heuristics don't match this FUB
  instance. Unusable.
- `anchor-intelligence` webhook (FUB `/v1/deals`, the accurate GCI feed):
  - All 100 deals have lead source **`Unknown`** → cannot isolate Zillow leads.
  - Overall close rate = 53 closed / 100 deals = **53%** → not pCVR (pCVR target
    is 4%; 53% is deal-close-rate, a different metric).
  - Stages present: Buyer Contract, Under Contract, Signed Listing Agreement,
    Active Listing, Fell Through, Closed — **no Appointment stage**.
  - No call data, no lead-response timestamps in the deals feed.

## Remaining metrics — requirements to go live

| Gauge | Needs | Source |
|---|---|---|
| **pCVR** | Zillow-attributed leads + their closes over a 180-day window. FUB API does **not** expose pCVR (Zillow-UI-only). | Monthly-Metrics Playwright scraper (`scripts/fub_zillow_csv_pull.py`) or manual CSV upload. |
| **CSAT** | Not tracked in FUB. | Stays "Not Available". |
| **ZHL Pre-Approval** | Market-specific, not in FUB. | Stays "Not Available". |
