# Security & Secret-Management

This repository follows a **secrets-out-of-source** model: every credential is
read from an environment variable at runtime and injected from a secret store
(GitHub Secrets in CI, your host's secret manager in production). No real
secret should ever be committed.

## ⚠️ Important: this repository is already PUBLIC

As of this writing the repo `anchorgroupops/metrics-dashboard` is **public**
(`visibility: public`, GitHub Pages enabled). Anything in the git history is
already world-readable. The goal of "convert private → public" is therefore
really a **harden + rotate-what-leaked** exercise, not a pre-publication one.

## Secret scan results (full git history)

A full-history scan (`git rev-list --all` + pattern matching) found **no
high-severity secrets** — no live FUB API key, Supabase **service** key,
database password, SMTP password, Anthropic, or Resend key was ever committed.
The working tree is clean and uses environment variables throughout.

The following lower-severity items **are** present in history (in the now-removed
`index.html` / `portal.html` static files) and, because the repo is public,
should be treated as exposed:

| Item | Where | Severity | Action |
| --- | --- | --- | --- |
| Supabase **anon** JWT (`SB_ANON`) + project URL `zedujsbhqjxzjjmyjhok.supabase.co` | `portal.html` | Low — anon keys are RLS-protected and meant for browsers | Verify Row-Level Security is enforced on every table. Optionally rotate the anon key (JWT secret) in Supabase. |
| n8n webhook URLs (`n8n.joelycannoli.com/webhook/dori-chat`, `-email`, `-vision`, `anchor-intelligence`) | `index.html` | Low–Medium — unauthenticated callers can POST to these | Rotate the webhook paths in n8n and/or add an auth header/secret; treat the old URLs as burned. |
| Client-side access-code SHA-256 hash (`PH`) | `index.html` | Negligible — purely a cosmetic client gate, brute-forceable | Don't rely on it for real auth; real auth is Supabase. |
| Custom domains (`metrics.joelycannoli.com`, `n8n.joelycannoli.com`) | `CNAME`, `index.html` | Informational | None required. |

### Recommended rotations (only you can do these — external dashboards)

1. **Supabase** → Project Settings → API: confirm RLS is on for all tables;
   rotate the JWT secret if you want the old anon key invalidated.
2. **n8n** → regenerate the four webhook URLs (or put them behind a header
   credential) and update the consuming clients.

## How secrets are injected

- **Local dev:** copy `.env.example` → `.env` (or `.env.local`) and fill in
  real values. Both are git-ignored.
- **GitHub Actions:** values come from repo **Secrets** via
  `${{ secrets.NAME }}` — see `.github/workflows/refresh-zillow.yml`.
- **Production host:** set the same variables in your platform's env/secret UI.

Required secret names: `DATABASE_URL`, `FUB_API_KEY`, `FUB_X_SYSTEM`,
`FUB_X_SYSTEM_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_KEY`, `ANTHROPIC_API_KEY`, `SMTP_*`. Full list in
`.env.example`.

## Automated leak prevention (defense in depth)

- **`.github/workflows/secret-scan.yml`** — gitleaks runs on every push/PR and
  scans full history; a detected secret fails the check.
- **`.gitignore`** — blocks `.env*` (except the example), `config/secrets/`,
  keys, certs, and cloud-credential files.
- **Recommended (manual, repo Settings → Code security):** enable GitHub
  **Secret scanning** and **Push protection** so GitHub itself rejects pushes
  containing known credential formats.

## Reporting

Found a secret or vulnerability? Email anchorgroupops@gmail.com — do not open a
public issue.
