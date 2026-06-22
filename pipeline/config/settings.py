"""
Central configuration for the Anchor Group Monthly Metrics system.
Credentials and secrets are loaded from environment variables.
Never commit .env or secrets to version control.
"""

import os
from pathlib import Path

# ── Paths ────────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent

# ── Database ──────────────────────────────────────────────────────────────────
# Neon / Postgres connection string. Required in production.
# Example: postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
DATABASE_URL = os.environ.get("DATABASE_URL", "")

# ── Supabase Realtime (optional true-WebSocket push) ──────────────────────────
# When both are set, the portal opens a Supabase Realtime subscription for live
# push (alerts / daily snapshots) instead of relying solely on 60s polling.
# The anon key is public-safe (RLS governs access); never put the service key
# here. Empty → the portal silently falls back to polling.
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")

CONFIG_DIR = BASE_DIR / "config"
TEMPLATES_DIR = BASE_DIR / "templates"
OUTPUT_DIR = BASE_DIR / "output"
REVIEW_DIR = OUTPUT_DIR / "review"
THRESHOLDS_FILE = CONFIG_DIR / "thresholds.json"

# ── Follow Up Boss API ────────────────────────────────────────────────────────
FUB_API_KEY = os.environ.get("FUB_API_KEY", "")
FUB_BASE_URL = "https://api.followupboss.com/v1"
# FUB now requires a registered system identity on every API call. Without these
# headers the API returns 401 even with a valid key. Values come from the env /
# secrets store, never hard-coded.
FUB_X_SYSTEM = os.environ.get("FUB_X_SYSTEM", "")
FUB_X_SYSTEM_KEY = os.environ.get("FUB_X_SYSTEM_KEY", "")
FUB_TIMEOUT_SECONDS = 30
FUB_MAX_RETRIES = 3

# ── Follow Up Boss Web UI (Playwright CSV automation) ─────────────────────────
FUB_WEB_USER = os.environ.get("FUB_WEB_USER", "")
FUB_WEB_PASSWORD = os.environ.get("FUB_WEB_PASSWORD", "")
# Direct URL for the Zillow Performance Report page. Run --discover once to
# find this URL, then store it in .env so future runs skip the guessing logic.
FUB_REPORT_URL = os.environ.get("FUB_REPORT_URL", "")
FUB_WEB_TIMEOUT_MS = int(os.environ.get("FUB_WEB_TIMEOUT", "30000"))

# ── Claude API (used by threshold_researcher.py) ──────────────────────────────
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
RESEARCH_MODEL = "claude-sonnet-4-6"  # Fast, capable for web research
RESEARCH_MAX_TOKENS = 1024

# ── Email / SMTP ──────────────────────────────────────────────────────────────
SMTP_HOST = os.environ.get("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
EMAIL_FROM_NAME = "The Anchor Group"
EMAIL_FROM_ADDRESS = os.environ.get("EMAIL_FROM", SMTP_USER)
EMAIL_SUBJECT_TEMPLATE = "Your {month} Performance Report — The Anchor Group"
# Where failure alerts go. Falls back to the from-address if unset.
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", EMAIL_FROM_ADDRESS)

# Comma-separated list of FUB emails allowed to access the admin dashboard.
# Defaults to FUB_WEB_USER when not set.
_admin_emails_raw = os.environ.get("ADMIN_EMAILS", FUB_WEB_USER)
ADMIN_EMAILS: frozenset[str] = frozenset(
    e.strip().lower() for e in _admin_emails_raw.split(",") if e.strip()
)

# ── Agent Roster ──────────────────────────────────────────────────────────────
# Each entry: fub_agent_id must match the ID in Follow Up Boss.
# Set fub_agent_id to None to skip API fetch and use mock data (for testing).
AGENTS = [
    # {
    #     "name": "Jane Smith",
    #     "email": "jane@anchorgroup.com",
    #     "fub_agent_id": "12345",
    # },
    # Add your agents here. This list is intentionally left empty so you can
    # populate it without risk of committing real agent data.
]

# ── Brand ─────────────────────────────────────────────────────────────────────
BRAND = {
    # ── Brand Colors (The Anchor Team — Color & Typography Deck B) ───────────────
    # Clear Water  = deep teal, primary brand color (30% usage per 60-30-10 rule)
    # Pearl Aqua   = lighter teal, accent color (10% usage)
    # Sandy Shore  = warm cream, dominant background (60% usage)
    #
    # Authoritative hex codes from AgentFire Color & Typography Deck B:
    "color_primary": "#046568",  # Clear Water — deep teal
    "color_secondary": "#82C8C3",  # Pearl Aqua — lighter teal/aqua
    "color_accent": "#F7ECE1",  # Sandy Shore — warm cream (buttons/highlights)
    "color_bg": "#F7ECE1",  # Sandy Shore — page/email background
    "color_text": "#1A1A1A",  # Near-black body text (high contrast on cream)
    # Gauge status colors — functional traffic-light, harmonized with teal palette
    "color_green": "#2ECC71",  # On-track / Preferred
    "color_yellow": "#F0A500",  # At-risk (warm amber, avoids clash with teal)
    "color_red": "#E05C4B",  # Needs improvement (muted red, brand-safe)
    # ── Typography ───────────────────────────────────────────────────────────────
    # Collier     = primary typeface (headers, titles, slide titles)
    # Dax Pro     = secondary typeface (sub-headers Medium, body Light, captions)
    # Both are licensed fonts. Email fallbacks applied for client compatibility.
    "font_heading": "'Collier', Georgia, 'Times New Roman', serif",
    "font_body": "'Dax Pro', 'Helvetica Neue', Arial, sans-serif",
    "font_heading_weight_title": "400",  # Collier Regular for main titles
    "font_body_weight_subhead": "500",  # Dax Pro Medium for sub-headers
    "font_body_weight_body": "300",  # Dax Pro Light for body text
    # Footer sign-off copy (Dolphins, Not Sharks ethos)
    "footer_message": "Keep showing up with integrity — that's what sets great agents apart.",
}

# ── Reporting Period ──────────────────────────────────────────────────────────
# The system auto-detects the prior calendar month at runtime.
# Override here only if you need to rerun a specific period.
OVERRIDE_REPORT_MONTH = None  # e.g. "2026-03" or None for auto
