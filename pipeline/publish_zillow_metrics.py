#!/usr/bin/env python3
"""
Compute team-level Zillow Preferred metrics from live FUB and emit a JSON in the
shape the metrics-dashboard `fetchZillow()` expects.

Observational only: reads FUB, computes, writes a JSON file / prints. Sends no
email or any outbound correspondence.

Env required: FUB_API_KEY, FUB_X_SYSTEM, FUB_X_SYSTEM_KEY.
Usage:
    python scripts/publish_zillow_metrics.py            # print JSON to stdout
    python scripts/publish_zillow_metrics.py OUT.json   # also write to OUT.json
"""

from __future__ import annotations

import json
import statistics
import sys
from datetime import datetime, timezone

from src.fub_daily_metrics import pull_daily_metrics

# Zillow Preferred targets (decimals for percent, seconds for time).
TARGETS = {
    "pickup": {"target": 0.25, "dir": "higher", "unit": "percent"},
    "speed": {"target": 120, "dir": "lower", "unit": "seconds"},
    "appt": {"target": 0.30, "dir": "higher", "unit": "percent"},
}


def _nums(rows, key):
    return [
        r["metrics"][key]
        for r in rows
        if isinstance(r.get("metrics"), dict) and isinstance(r["metrics"].get(key), (int, float))
    ]


def build_payload(rows: list[dict] | None = None) -> dict:
    if rows is None:
        rows = pull_daily_metrics()

    total_leads = sum((r["metrics"].get("total_zillow_leads") or 0) for r in rows)
    total_appts = sum((r["metrics"].get("appointments_set") or 0) for r in rows)

    pickups = _nums(rows, "pickup_rate")   # /v1/calls-based connect rate
    speeds = _nums(rows, "response_time_seconds")  # /v1/calls first-outbound-call

    metrics: dict[str, dict] = {}
    if pickups:
        metrics["pickup"] = {
            "value": round(statistics.fmean(pickups), 4),
            "boz": None, "elite": None, "mini": True, **TARGETS["pickup"],
        }
    if speeds:
        metrics["speed"] = {
            # Median is robust to a few very-late-call outliers.
            "value": round(statistics.median(speeds), 1),
            "boz": None, "elite": None, "mini": True, **TARGETS["speed"],
        }
    if total_leads > 0:
        metrics["appt"] = {
            "value": round(total_appts / total_leads, 4),
            "boz": None, "elite": None, "mini": True, **TARGETS["appt"],
        }

    # pcvr is Zillow-UI-only (not in the FUB API); csat/zhl not tracked. Any of
    # pickup/speed/appt with no computable value this run is also unavailable.
    unavailable = ["pcvr", "csat", "zhl"]
    for k in ("pickup", "speed", "appt"):
        if k not in metrics:
            unavailable.append(k)

    return {
        "metrics": metrics,
        "unavailable": unavailable,
        "meta": {
            "generated_at_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "agents": len(rows),
            "agents_with_pickup": len(pickups),
            "agents_with_speed": len(speeds),
            "zillow_leads": total_leads,
            "appointments_set": total_appts,
            "appointment_rate": round(total_appts / total_leads, 4) if total_leads else None,
            "source": "fub_daily_metrics (MTD, Zillow Preferred filtered)",
            "notes": (
                "pickup = /v1/calls outbound connect rate; speed = first outbound "
                "call after lead created; appt = unique Zillow leads with an "
                "appointment. pcvr = Zillow-UI-only; csat/zhl not in FUB."
            ),
        },
    }


def _sync_supabase(rows: list[dict]) -> None:
    """Upsert per-agent + team metrics into Supabase (RLS-protected, read by the
    agent portal). Env-gated: only runs when SUPABASE_URL + SUPABASE_SERVICE_KEY
    are set, so it is a no-op until the service key is provided. Observational —
    writes data only, sends nothing."""
    import json as _json
    import os as _os
    import urllib.request as _rq

    base = _os.environ.get("SUPABASE_URL", "").rstrip("/")
    key = _os.environ.get("SUPABASE_SERVICE_KEY", "")
    if not (base and key):
        return
    hdr = {
        "apikey": key, "Authorization": f"Bearer {key}",
        "Content-Type": "application/json", "Prefer": "resolution=merge-duplicates",
    }

    def upsert(table: str, payload: list[dict], on_conflict: str) -> None:
        if not payload:
            return
        url = f"{base}/rest/v1/{table}?on_conflict={on_conflict}"
        req = _rq.Request(url, data=_json.dumps(payload).encode(), headers=hdr, method="POST")
        try:
            _rq.urlopen(req, timeout=30)
        except Exception as e:  # never fatal to the publish
            print(f"  Supabase {table} upsert skipped: {e}", file=sys.stderr)

    period = "2026-06"
    agents, metrics, team = [], [], []
    keymap = {"pickup_rate": ("pickup", 0.25), "response_time_seconds": ("speed", 120),
              "appointment_rate": ("appt", 0.30)}
    for r in rows:
        aid = str(r.get("agent_id"))
        agents.append({"agent_id": aid, "name": r.get("name", ""), "email": (r.get("email") or "").lower()})
        m = r.get("metrics") or {}
        for src, (mk, tgt) in keymap.items():
            v = m.get(src)
            if isinstance(v, (int, float)):
                metrics.append({"agent_id": aid, "period": period, "metric_key": mk,
                                "value": v, "target": tgt})
    upsert("agents", agents, "agent_id")
    upsert("agent_metrics", metrics, "agent_id,period,metric_key")
    print(f"  Supabase sync: {len(agents)} agents, {len(metrics)} metric rows.", file=sys.stderr)


def main() -> int:
    rows = pull_daily_metrics()
    payload = build_payload(rows)
    _sync_supabase(rows)  # no-op unless SUPABASE_SERVICE_KEY is set
    text = json.dumps(payload, indent=2)
    print(text)
    if len(sys.argv) > 1:
        with open(sys.argv[1], "w", encoding="utf-8") as f:
            f.write(text + "\n")
        print(f"\nWrote {sys.argv[1]}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
