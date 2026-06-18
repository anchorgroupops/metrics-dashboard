# Zillow Preferred Gauges — Data Wiring Status & Requirements

The Zillow Preferred gauge panel on metrics.joelycannoli.com is **live and
labeled "· SAMPLE"** because, as of 2026-06-18, none of the four metrics can be
computed accurately from the available FUB/n8n data. This documents exactly what
each metric needs so it can be flipped to live (the dashboard's `fetchZillow()`
already auto-switches the badge to "· LIVE" once an endpoint returns
`{metrics:{…}}` with real values).

**Do not wire approximate/proxy data** — it produced visibly wrong values in
testing (see below). Observational integrity first.

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

## Per-metric requirements to go live

| Gauge | Needs | Source |
|---|---|---|
| **pCVR** (Predicted Conversion Rate) | Zillow-attributed leads + their closes over a 180-day window. FUB API does **not** expose pCVR (Zillow-UI-only). | Monthly-Metrics Playwright scraper (`scripts/fub_zillow_csv_pull.py`) or manual CSV upload. |
| **Pickup Rate** | Calls connected / outbound attempts. | FUB `/v1/calls` (call logging must be enabled & populated). |
| **Speed to Lead** | Median seconds from lead-created to first outbound contact. | FUB `/v1/people` `created` + first communication/event timestamp. Derivable; needs verification. |
| **Appointment Rate** | Appointments set / Zillow leads. | Requires an Appointment stage/event in FUB (none today) + Zillow lead attribution. |
| **CSAT** | Not tracked in FUB. | Stays "Not Available". |
| **ZHL Pre-Approval** | Market-specific, not in FUB. | Stays "Not Available". |

## Recommended path (when ready)

The **Monthly-Metrics pipeline** (`H:\AI\Monthly-Metrics`, deployed on the Pi)
already computes these correctly with the proper FUB queries + 180-day windows.
Cleanest wire-up:

1. Have `main.py --mode daily` (Pi, has FUB access) write a `zillow-metrics.json`
   in the `fetchZillow()` shape — only metrics with real values, others omitted.
2. Publish it where the dashboard can fetch it (commit to this repo, or a small
   read-only n8n webhook `anchor-zillow-metrics`).
3. Point `fetchZillow()` at that URL. The badge flips to "· LIVE" automatically.

Until then the gauges show illustrative values behind the **SAMPLE** badge so no
one mistakes them for live performance.
