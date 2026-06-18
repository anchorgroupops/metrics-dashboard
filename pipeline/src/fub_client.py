"""
Follow Up Boss API client — monthly Zillow Preferred metrics.

Data sources (verified against FUB Open API):

  speed_to_lead    → /people: median seconds from lead.created to earliest outbound
                     contact timestamp (lastOutgoingCall / lastSentText / lastSentEmail /
                     lastSentInboxAppMessage). Computed over contacted leads only.
                     NOTE: firstCall is an INT (call id), never parsed as a date.
  pickup_rate      → /calls: outbound calls with duration >= CONNECT_SECONDS
                     divided by total outbound call attempts.
  appt_rate        → /appointments: appointment count for agent / Zillow leads.
                     invitees[].personId is always null so can only count, not link.
  pcvr             → /deals: unvalidated join — greyed until attribution is confirmed.
  csat             → Not available via FUB API. Stored as None.

FUB API base URL: https://api.followupboss.com
FUB API docs: https://docs.followupboss.com/reference
"""

import base64
import logging
import time
from datetime import date, timedelta
from statistics import median

import requests

from config.settings import (
    AGENTS,
    FUB_API_KEY,
    FUB_BASE_URL,
    FUB_MAX_RETRIES,
    FUB_TIMEOUT_SECONDS,
    FUB_X_SYSTEM,
    FUB_X_SYSTEM_KEY,
    OVERRIDE_REPORT_MONTH,
)

log = logging.getLogger(__name__)

# Minimum call duration (seconds) to count as a connected pickup.
CONNECT_SECONDS = 30

# Rolling window for pCVR estimation (Zillow uses 180 days per documentation).
_PCVR_WINDOW_DAYS = 180

# FUB deal status values that indicate a closed/won deal.
_WON_STATUS = frozenset({"won", "closed won", "closed", "sale"})

# Minimum Zillow lead sample before we trust the pCVR estimate.
_PCVR_MIN_LEADS = 10


# ── Helpers ───────────────────────────────────────────────────────────────────


def _auth_header() -> dict:
    """FUB uses HTTP Basic auth with the API key as the username, plus a
    registered system identity (X-System / X-System-Key) which FUB now requires
    for API access."""
    token = base64.b64encode(f"{FUB_API_KEY}:".encode()).decode()
    headers = {"Authorization": f"Basic {token}"}
    if FUB_X_SYSTEM and FUB_X_SYSTEM_KEY:
        headers["X-System"] = FUB_X_SYSTEM
        headers["X-System-Key"] = FUB_X_SYSTEM_KEY
    return headers


def _report_period() -> tuple[str, str]:
    """
    Returns (start_date, end_date) strings for the prior calendar month,
    or the OVERRIDE_REPORT_MONTH if set (format: 'YYYY-MM').
    """
    if OVERRIDE_REPORT_MONTH:
        year, month = map(int, OVERRIDE_REPORT_MONTH.split("-"))
    else:
        today = date.today()
        first_of_this_month = today.replace(day=1)
        last_month_end = first_of_this_month - timedelta(days=1)
        year, month = last_month_end.year, last_month_end.month

    start = date(year, month, 1)
    # Last day of month: go to first of next month, subtract one day
    if month == 12:
        end = date(year + 1, 1, 1) - timedelta(days=1)
    else:
        end = date(year, month + 1, 1) - timedelta(days=1)

    return start.isoformat(), end.isoformat()


def _get(path: str, params: dict | None = None) -> dict:
    """
    GET from FUB API with retry logic and exponential backoff.
    Raises on non-2xx after exhausting retries.
    """
    url = f"{FUB_BASE_URL}/{path.lstrip('/')}"
    headers = {**_auth_header(), "Content-Type": "application/json"}
    delay = 2

    for attempt in range(1, FUB_MAX_RETRIES + 1):
        try:
            resp = requests.get(url, headers=headers, params=params, timeout=FUB_TIMEOUT_SECONDS)
            if resp.status_code == 429:
                retry_after = int(resp.headers.get("Retry-After", delay))
                log.warning("Rate limited by FUB. Waiting %ds…", retry_after)
                time.sleep(retry_after)
                continue
            resp.raise_for_status()
            return resp.json()
        except requests.HTTPError as exc:
            status = exc.response.status_code if exc.response is not None else None
            # 4xx (except 429, handled above) are permanent — don't retry.
            if status is not None and 400 <= status < 500:
                log.warning("FUB %d for %s — not retrying", status, url)
                raise
            log.warning("FUB request failed (attempt %d/%d): %s", attempt, FUB_MAX_RETRIES, exc)
            if attempt < FUB_MAX_RETRIES:
                time.sleep(delay)
                delay *= 2
            else:
                raise
        except requests.RequestException as exc:
            log.warning("FUB request failed (attempt %d/%d): %s", attempt, FUB_MAX_RETRIES, exc)
            if attempt < FUB_MAX_RETRIES:
                time.sleep(delay)
                delay *= 2
            else:
                raise

    raise RuntimeError(f"FUB API unreachable after {FUB_MAX_RETRIES} attempts: {url}")


# ── Per-lead people fetch ─────────────────────────────────────────────────────


def _fetch_people_raw(agent_id: str, start_date: str, end_date: str) -> list[dict]:
    """
    Page through /v1/people for one agent without any source filtering.

    Returns every person assigned to ``agent_id`` whose ``created`` falls in
    [start_date, end_date]. Used both by the production pull (which then
    applies ``is_zillow_preferred``) and by the diagnostic CLI (which wants
    the unfiltered raw view to surface mis-tagged Zillow leads).
    """
    collected: list[dict] = []
    offset = 0
    limit = 100

    while True:
        params = {
            "assignedUserId": agent_id,
            "createdAfter": start_date,
            "createdBefore": end_date,
            "limit": limit,
            "offset": offset,
            "fields": "allFields",
        }
        data = _get("/people", params=params)
        people = data.get("people") or []
        collected.extend(people)

        meta = data.get("_metadata") or {}
        total = meta.get("total")
        if not people or len(people) < limit:
            break
        offset += limit
        if total is not None and offset >= total:
            break
        if offset >= 5000:
            log.warning("Stopping at offset 5000 for agent %s — check pagination", agent_id)
            break

    return collected


def _fetch_people_for_agent(agent_id: str, start_date: str, end_date: str) -> list[dict]:
    """
    Page through /v1/people for one agent, returning every Zillow Preferred lead
    created within [start_date, end_date] (ISO YYYY-MM-DD).
    """
    from src.fub_daily_metrics import is_zillow_preferred

    return [p for p in _fetch_people_raw(agent_id, start_date, end_date) if is_zillow_preferred(p)]


# ── Appointments fetch ────────────────────────────────────────────────────────

# FUB appointment outcome values that indicate the lead actually showed up.
# The exact strings are tenant/FUB-version specific — add aliases as needed.
_APPT_MET_OUTCOMES = {"completed", "met", "showed", "show", "shown"}


def _fetch_appointments_for_agent(agent_id: str, start_date: str, end_date: str) -> list[dict]:
    """
    Fetch appointments created by/for this agent within [start_date, end_date].

    FUB Appointments fields used:
      userId    — FUB user id of the agent who owns the appointment
      outcome   — appointment result ("Completed", "Met", "No Show", etc.)
      created   — ISO timestamp when the appointment was booked in FUB

    Returns an empty list (soft-fail) if the endpoint returns a non-2xx that
    suggests the resource is unavailable, so missing appointment data doesn't
    abort the rest of the per-agent computation.
    """
    import requests as _req

    collected: list[dict] = []
    offset = 0
    limit = 100

    while True:
        params = {
            "userId": agent_id,
            "createdAfter": start_date,
            "createdBefore": end_date,
            "limit": limit,
            "offset": offset,
        }
        try:
            data = _get("/appointments", params=params)
        except _req.HTTPError as exc:
            status = exc.response.status_code if exc.response is not None else None
            if status in (404, 403):
                log.warning("/appointments returned %s — appt metrics will be None", status)
                return []
            raise
        except Exception as exc:
            log.warning("/appointments fetch failed (%s) — appt metrics will be None", exc)
            return []
        appts = data.get("appointments") or []
        collected.extend(appts)

        meta = data.get("_metadata") or {}
        total = meta.get("total")
        if not appts or len(appts) < limit:
            break
        offset += limit
        if total is not None and offset >= total:
            break
        if offset >= 5000:
            log.warning("Stopping at offset 5000 for agent %s appointments", agent_id)
            break

    return collected


def _fetch_deals_for_agent(agent_id: str, start_date: str, end_date: str) -> list[dict]:
    """
    Fetch deals for agent within [start_date, end_date].

    FUB /v1/deals fields used:
      personId — the lead's person ID (used to link back to Zillow leads)
      status   — deal outcome ("Won", "Closed Won", "Lost", etc.)
      userId   — owning agent

    Returns empty list (soft-fail) on 404/403 or any exception so missing
    deal data doesn't abort the rest of the per-agent computation.
    """
    import requests as _req

    collected: list[dict] = []
    offset = 0
    limit = 100

    while True:
        params = {
            "userId": agent_id,
            "createdAfter": start_date,
            "createdBefore": end_date,
            "limit": limit,
            "offset": offset,
        }
        try:
            data = _get("/deals", params=params)
        except _req.HTTPError as exc:
            status = exc.response.status_code if exc.response is not None else None
            if status in (404, 403):
                log.warning(
                    "/deals returned %s — pcvr estimation will be None for agent %s",
                    status,
                    agent_id,
                )
                return []
            raise
        except Exception as exc:
            log.warning(
                "/deals fetch failed (%s) — pcvr estimation will be None for agent %s",
                exc,
                agent_id,
            )
            return []

        deals = data.get("deals") or []
        collected.extend(deals)

        meta = data.get("_metadata") or {}
        total = meta.get("total")
        if not deals or len(deals) < limit:
            break
        offset += limit
        if total is not None and offset >= total:
            break
        if offset >= 5000:
            log.warning("Stopping /deals at offset 5000 for agent %s", agent_id)
            break

    return collected


def _estimate_pcvr(zillow_leads: list[dict], deals: list[dict]) -> float | None:
    """
    Estimate close rate = closed Zillow deals / Zillow leads over a rolling window.

    This is a FUB-derived approximation, NOT Zillow's own pCVR prediction.
    Zillow's pCVR is a probabilistic score; this is a realized close rate.
    Only used when the Zillow Performance Report CSV is unavailable.

    Returns None when sample is too small or the personId join yields nothing.
    """
    if len(zillow_leads) < _PCVR_MIN_LEADS:
        log.debug(
            "pCVR estimate skipped: only %d Zillow leads (need %d)",
            len(zillow_leads),
            _PCVR_MIN_LEADS,
        )
        return None

    lead_ids = {str(p["id"]) for p in zillow_leads if p.get("id")}
    if not lead_ids:
        return None

    won_zillow = [
        d
        for d in deals
        if str(d.get("personId") or "") in lead_ids
        and (d.get("status") or "").lower().strip() in _WON_STATUS
    ]

    estimated = len(won_zillow) / len(zillow_leads)
    log.info(
        "pCVR estimate: %d won / %d Zillow leads = %.3f (unvalidated join)",
        len(won_zillow),
        len(zillow_leads),
        estimated,
    )
    return estimated


def _fetch_calls_batch(start_date: str, end_date: str) -> dict[str, list[dict]]:
    """
    Fetch ALL outbound calls for the period in a single paginated pass, then
    group by userId.

    FUB's /v1/calls endpoint silently ignores the ``userId`` filter — it returns
    all calls regardless. Fetching once and distributing in Python is both correct
    and ~28× faster than the per-agent loop.

    Returns: {str(userId): [call, ...]} — soft-fails to {} on 404/403.
    """
    import requests as _req

    by_user: dict[str, list[dict]] = {}
    offset = 0
    limit = 100

    while True:
        params = {
            "createdAfter": start_date,
            "createdBefore": end_date,
            "limit": limit,
            "offset": offset,
        }
        try:
            data = _get("/calls", params=params)
        except _req.HTTPError as exc:
            status = exc.response.status_code if exc.response is not None else None
            if status in (404, 403):
                log.warning("/calls returned %s — pickup_rate will be None for all agents", status)
                return {}
            raise
        except Exception as exc:
            log.warning("/calls fetch failed (%s) — pickup_rate will be None for all agents", exc)
            return {}

        calls = data.get("calls") or []
        for c in calls:
            uid = str(c.get("userId") or "")
            if uid:
                by_user.setdefault(uid, []).append(c)

        meta = data.get("_metadata") or {}
        total = meta.get("total")
        if not calls or len(calls) < limit:
            break
        offset += limit
        if total is not None and offset >= total:
            break
        if offset >= 10_000:
            log.warning("Stopping calls batch at offset 10000 — tenant has very high call volume")
            break

    total_calls = sum(len(v) for v in by_user.values())
    log.info(
        "calls batch: %d calls for %d agents (%s → %s)",
        total_calls,
        len(by_user),
        start_date,
        end_date,
    )
    return by_user


def fetch_users() -> list[dict]:
    """
    Discover the agent roster from FUB's /v1/users endpoint.

    Used as a fallback when AGENTS in config/settings.py is empty — lets the
    monthly cron run without a hand-maintained roster file. Pulls only users
    with role "Agent" or "Broker"; skips anything marked deleted/inactive.

    Returns a list of agent_cfg dicts shaped like the entries in AGENTS:
      {"name": str, "email": str, "fub_agent_id": str}
    """
    if not FUB_API_KEY:
        raise OSError("FUB_API_KEY is not set; cannot auto-discover users.")

    roster: list[dict] = []
    next_token: str | None = None
    seen = 0

    while True:
        params: dict = {"limit": 100}
        if next_token:
            params["next"] = next_token
        data = _get("/users", params=params)

        for u in data.get("users", []):
            seen += 1
            role = (u.get("role") or "").strip()
            if role not in ("Agent", "Broker"):
                continue
            if u.get("deleted") or u.get("status") in ("inactive", "disabled"):
                continue
            email = (u.get("email") or "").strip()
            name = (u.get("name") or "").strip()
            user_id = u.get("id")
            if not email or not name or user_id is None:
                continue
            roster.append(
                {
                    "name": name,
                    "email": email,
                    "fub_agent_id": str(user_id),
                }
            )

        next_token = data.get("_metadata", {}).get("next")
        if not next_token:
            break

    log.info("FUB user auto-discovery: %d users seen, %d kept as agents", seen, len(roster))
    return roster


def fetch_all_agents(period: str | None = None) -> list[dict]:
    """
    Compute monthly Zillow Preferred metrics for every agent from /v1/people.

    Returns a list of dicts:
    {
        "agent_id":        str,
        "name":            str,
        "email":           str,
        "period":          str,    # e.g. "April 2026"
        "start_date":      str,
        "end_date":        str,
        "speed_to_action": float | None,  # median seconds to first contact (lower_is_better)
        "work_with_rate":  float | None,  # fraction of leads moved past New stage (0.0–1.0)
        "csat":            float | None,  # always None — not available from FUB people data
        "appt_set_rate":   float | None,  # fraction with appointment set/met (0.0–1.0)
        "appt_met_rate":   float | None,  # fraction of set appts that were met (0.0–1.0)
    }
    """
    if not FUB_API_KEY:
        raise OSError(
            "FUB_API_KEY is not set. Export it before running:\n  export FUB_API_KEY=your_key_here"
        )

    roster = list(AGENTS)
    if not roster:
        log.info("AGENTS is empty in config/settings.py — auto-discovering from FUB /v1/users.")
        try:
            roster = fetch_users()
        except Exception as exc:
            # The API key may lack permission for /v1/users (403). Don't crash the
            # pipeline — fall back to the agent roster already known to the DB.
            log.warning("FUB /v1/users unavailable (%s) — falling back to DB roster.", exc)
            roster = []
        if not roster:
            from src import storage

            roster = storage.get_known_roster()
            log.info("Using DB agent roster fallback: %d agents.", len(roster))
        if not roster:
            log.warning("No roster from FUB /v1/users or DB — returning empty list.")
            return []

    start_date, end_date = _report_period()
    start_dt = date.fromisoformat(start_date)
    period_label = start_dt.strftime("%B %Y")

    # Fetch all calls once (FUB /v1/calls ignores userId filter — batch is correct + fast).
    calls_by_user = _fetch_calls_batch(start_date, end_date)

    results = []
    empty_names: list[str] = []
    error_names: list[str] = []
    for agent_cfg in roster:
        agent_id = agent_cfg["fub_agent_id"]
        name = agent_cfg["name"]
        log.info("Fetching metrics for %s (ID: %s)…", name, agent_id)

        try:
            people = _fetch_people_for_agent(agent_id, start_date, end_date)
            appointments = _fetch_appointments_for_agent(agent_id, start_date, end_date)
            agent_calls = calls_by_user.get(str(agent_id), [])
            status = "ok" if people else "empty"
            log.info(
                "pull: %s id=%s leads=%d appts=%d calls=%d status=%s",
                name,
                agent_id,
                len(people),
                len(appointments),
                len(agent_calls),
                status,
            )
            if not people:
                empty_names.append(name)
            results.append(
                _compute_monthly_metrics(
                    people, appointments, agent_cfg, period_label, calls=agent_calls
                )
            )
        except Exception as exc:
            log.error("pull: %s id=%s status=error error=%s", name, agent_id, exc)
            error_names.append(name)
            results.append(
                _null_record(agent_cfg, period_label, start_date, end_date, api_exception=True)
            )

    with_leads = len(results) - len(empty_names) - len(error_names)
    log.info("pull summary: %d/%d agents with leads", with_leads, len(results))
    if empty_names:
        log.info("pull summary: no-leads agents: %s", ", ".join(empty_names))
    if error_names:
        log.warning("pull summary: errored agents: %s", ", ".join(error_names))

    # ── pCVR estimation via FUB /deals (180-day rolling window) ──────────────
    # Estimates close rate for agents without a Zillow CSV. Labeled as estimated
    # in downstream consumers via the _pcvr_estimated flag. Skipped if pcvr was
    # already set (e.g. from a Zillow Performance Report CSV upload).
    today = date.today()
    pcvr_start = (today - timedelta(days=_PCVR_WINDOW_DAYS)).isoformat()
    pcvr_end = today.isoformat()
    log.info("pCVR estimation pass: %s → %s", pcvr_start, pcvr_end)

    for result in results:
        if result.get("_api_exception") or result.get("pcvr") is not None:
            continue
        agent_id = result["agent_id"]
        try:
            pcvr_leads = _fetch_people_for_agent(agent_id, pcvr_start, pcvr_end)
            pcvr_deals = _fetch_deals_for_agent(agent_id, pcvr_start, pcvr_end)
            est = _estimate_pcvr(pcvr_leads, pcvr_deals)
            if est is not None:
                result["pcvr"] = est
                result["_pcvr_estimated"] = True
        except Exception as exc:
            log.warning("pCVR estimation error for agent %s: %s", agent_id, exc)

    return results


def _first_contact_seconds(person: dict) -> float | None:
    """Seconds from lead created to the agent's earliest outbound contact.

    FUB does not expose a single "first contact" timestamp on the person record:
    ``firstCall`` is an integer (a call id/count, e.g. ``567``), not a date. The
    usable outbound-contact timestamps are the ISO-8601 ``last*`` fields below;
    for a lead contacted once, "last" == "first", and across a month the median
    of these is a sound speed-to-action proxy. ``_parse`` defensively ignores any
    non-string value so an int field can never crash the whole agent's record.
    """
    from datetime import UTC, datetime

    def _parse(val: object) -> datetime | None:
        if not isinstance(val, str) or not val:
            return None
        for fmt in ("%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%dT%H:%M:%S+00:00", "%Y-%m-%dT%H:%M:%S"):
            try:
                dt = datetime.strptime(val, fmt)
                return dt.replace(tzinfo=UTC)
            except (ValueError, TypeError):
                continue
        return None

    created = _parse(person.get("created"))
    if created is None:
        return None

    contact_fields = (
        "firstCall",
        "lastOutgoingCall",
        "lastSentText",
        "lastSentEmail",
        "lastSentInboxAppMessage",
    )
    candidates = [_parse(person.get(k)) for k in contact_fields]
    valid = [c for c in candidates if c is not None and c >= created]
    if not valid:
        return None
    return max(0.0, (min(valid) - created).total_seconds())


def _compute_monthly_metrics(
    people: list[dict],
    appointments: list[dict],
    agent_cfg: dict,
    period: str,
    start_date: str = "",
    end_date: str = "",
    *,
    calls: list[dict] | None = None,
) -> dict:
    """
    Compute monthly ZP metrics.

    people       → /people (Zillow Preferred leads for the period)
    appointments → /appointments (appointments set for the period); may be []
                   if the endpoint was unavailable.
    calls        → /calls (outbound calls for the period); keyword-only.
    """
    total = len(people)

    if total == 0:
        return _null_record(agent_cfg, period, start_date, end_date)

    STAGE_NEW = 26

    # speed_to_action — median seconds to first outbound contact, accepted leads only
    # (stageId > STAGE_NEW excludes leads still in the "New" bucket)
    response_times: list[float] = []
    for p in people:
        if p.get("stageId") and int(p["stageId"]) > STAGE_NEW:
            rt = _first_contact_seconds(p)
            if rt is not None:
                response_times.append(rt)
    speed_to_action = median(response_times) if response_times else None
    contacted_count = len(response_times)

    # pickup_rate — outbound calls with duration >= CONNECT_SECONDS / total outbound attempts
    _calls = calls or []
    outbound = [c for c in _calls if not c.get("isIncoming", True)]
    total_outbound = len(outbound)
    calls_made = total_outbound
    if total_outbound > 0:
        connected = sum(1 for c in outbound if (c.get("duration") or 0) >= CONNECT_SECONDS)
        pickup_rate = connected / total_outbound
    else:
        connected = 0
        pickup_rate = None

    # appt_rate — appointments counted for agent / Zillow leads
    appt_rate = len(appointments) / total if appointments else None

    # work_with_rate — leads where stage > STAGE_NEW / total leads
    worked_with = sum(1 for p in people if p.get("stageId") and int(p["stageId"]) > STAGE_NEW)
    work_with_rate = worked_with / total if total > 0 else None

    # appt_set_rate — appointments set / total leads
    appt_set_rate = len(appointments) / total if total > 0 else None

    # appt_met_rate — completed appointments / appointments set
    completed_appts = sum(1 for appt in appointments if appt.get("outcome") == "Completed")
    appt_met_rate = completed_appts / len(appointments) if appointments else None

    return {
        "agent_id": agent_cfg["fub_agent_id"],
        "name": agent_cfg["name"],
        "email": agent_cfg["email"],
        "period": period,
        "start_date": start_date,
        "end_date": end_date,
        "speed_to_lead": speed_to_action,
        "speed_to_action": speed_to_action,
        "pickup_rate": pickup_rate,
        "appt_rate": appt_rate,
        "pcvr": None,
        "csat": None,
        "zhl_preapproval": None,
        "work_with_rate": work_with_rate,
        "appt_set_rate": appt_set_rate,
        "appt_met_rate": appt_met_rate,
        "_contacted_count": contacted_count,
        "_lead_count": total,
        "calls_made": calls_made,
        "_calls_connected": connected,
    }


def _null_record(
    agent_cfg: dict,
    period: str,
    start: str,
    end: str,
    *,
    api_exception: bool = False,
) -> dict:
    """Return a placeholder record when the API call fails or yields no leads.

    ``api_exception=True`` marks an actual API error (vs simply no Zillow
    leads found for the period), so callers can count them separately.
    """
    return {
        "agent_id": agent_cfg["fub_agent_id"],
        "name": agent_cfg["name"],
        "email": agent_cfg["email"],
        "period": period,
        "start_date": start,
        "end_date": end,
        "speed_to_lead": None,
        "pickup_rate": None,
        "appt_rate": None,
        "pcvr": None,
        "csat": None,
        "zhl_preapproval": None,
        "work_with_rate": None,
        "appt_set_rate": None,
        "appt_met_rate": None,
        "speed_to_action": None,
        "_error": True,
        "_api_exception": api_exception,
    }


# ── Mock data for local testing ───────────────────────────────────────────────


def mock_agents(period: str | None = None) -> list[dict]:
    """
    Returns synthetic agent data for Review Mode testing without a live API key.
    Run: python main.py --mode review --mock
    """
    period_label = period or "April 2026"
    return [
        {
            "agent_id": "mock-001",
            "name": "Alex Rivera",
            "email": "alex@example.com",
            "period": period_label,
            "start_date": "2026-04-01",
            "end_date": "2026-04-30",
            "speed_to_lead": 210.0,  # 3.5 min — green
            "pickup_rate": 0.55,  # green
            "appt_rate": 0.40,  # green
            "pcvr": None,
            "csat": None,
            "zhl_preapproval": None,
            "work_with_rate": 0.75,  # 3 of 4 leads with stage > 26
            "appt_set_rate": 0.5,  # 2 of 4 appointment set
            "appt_met_rate": 0.5,  # 1 of 2 appointments met
            "speed_to_action": 300.0,  # median 240, 300, 360 seconds
        },
        {
            "agent_id": "mock-002",
            "name": "Jordan Lee",
            "email": "jordan@example.com",
            "period": period_label,
            "start_date": "2026-04-01",
            "end_date": "2026-04-30",
            "speed_to_lead": 480.0,  # 8 min — yellow
            "pickup_rate": 0.28,  # yellow
            "appt_rate": 0.18,  # yellow
            "pcvr": None,
            "csat": None,
            "zhl_preapproval": None,
            "work_with_rate": 0.25,  # 1 of 4 leads with stage > 26
            "appt_set_rate": 0.25,  # 1 of 4 appointment set
            "appt_met_rate": 0.0,  # 0 of 1 appointment met
            "speed_to_action": 600.0,  # median 600 seconds (10 min)
        },
        {
            "agent_id": "mock-003",
            "name": "Morgan Chen",
            "email": "morgan@example.com",
            "period": period_label,
            "start_date": "2026-04-01",
            "end_date": "2026-04-30",
            "speed_to_lead": 750.0,  # 12.5 min — red
            "pickup_rate": 0.18,  # red
            "appt_rate": 0.07,  # red
            "pcvr": None,
            "csat": None,
            "zhl_preapproval": None,
            "work_with_rate": 0.0,  # 0 of 4 leads with stage > 26
            "appt_set_rate": 0.0,  # 0 of 4 appointment set
            "appt_met_rate": None,  # No appointments set
            "speed_to_action": None,  # No response times
        },
    ]
