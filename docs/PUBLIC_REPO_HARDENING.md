# Public-Repo Hardening & Migration Checklist

> **Status note:** `anchorgroupops/metrics-dashboard` is **already public**.
> Steps below are ordered so you can (a) contain what's already exposed and
> (b) lock the repo down going forward. If you ever spin up a *new* private
> repo to make public, the same list applies pre-publication.

## Phase 0 — Contain (do first, because the repo is already public)

- [ ] Read `SECURITY.md` → "Secret scan results". Confirm the only exposed
      items are the Supabase **anon** key, n8n webhook URLs, and a client-side
      hash (no high-severity secrets were found in history).
- [ ] **Rotate the exposed items** (external dashboards — only you can):
  - [ ] Supabase: verify RLS on all tables; rotate JWT secret if desired.
  - [ ] n8n: regenerate the 4 webhook URLs or add header auth.
- [ ] Confirm no live `FUB_API_KEY`, Supabase **service** key, DB password, or
      SMTP password is in history (scan says clean — re-verify after any change).

## Phase 1 — Secrets out of source (DONE in code)

- [x] All credentials read from env vars (`os.environ` / `process.env`).
- [x] `.env.example` documents every variable with placeholders.
- [x] `.gitignore` blocks `.env*`, `config/secrets/`, keys, certs, creds.
- [x] CI injects secrets from GitHub Secrets (`refresh-zillow.yml`).

## Phase 2 — Configure GitHub Secrets

Settings → Secrets and variables → Actions → add each:

- [ ] `FUB_API_KEY`, `FUB_X_SYSTEM`, `FUB_X_SYSTEM_KEY`
- [ ] `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`
- [ ] `DATABASE_URL`, `ANTHROPIC_API_KEY`, `SMTP_USER`, `SMTP_PASSWORD`
- [ ] (optional) `GITLEAKS_LICENSE` if you use the org edition

## Phase 3 — Leak monitoring (DONE in code + manual toggles)

- [x] `secret-scan.yml` (gitleaks) on every push/PR over full history.
- [ ] Settings → Code security → enable **Secret scanning**.
- [ ] Settings → Code security → enable **Push protection**.

## Phase 4 — Optional: purge low-severity items from history

History rewriting is **destructive and irreversible**: it changes every commit
SHA, force-pushes over `main`, breaks open PRs, and disrupts the
`refresh-zillow` bot. Because the exposed items are low-severity (anon key is
public-safe), **rotation (Phase 0) is usually sufficient and safer.** Only do
this if you require literal "zero secrets in history."

```bash
# Requires git-filter-repo (https://github.com/newren/git-filter-repo)
# 1. Fresh mirror clone
git clone --mirror https://github.com/anchorgroupops/metrics-dashboard.git
cd metrics-dashboard.git
# 2. Strip the two historical static files entirely
git filter-repo --path index.html --path portal.html --invert-paths
# 3. Force-push the rewritten history (coordinate with all collaborators first!)
git push --force --mirror
```

After a rewrite: every collaborator must re-clone, open PRs must be recreated,
and the bot's local checkout is invalidated.

## Phase 5 — Branch protection & required checks

Settings → Branches → add a rule for `main`:

- [ ] Require a pull request before merging.
- [ ] Require status checks to pass: **`gitleaks`**, plus build/test (`vitest`).
- [ ] Require branches to be up to date before merging.
- [ ] (Recommended) Require at least 1 approval, or use a CODEOWNERS review.
- [ ] Restrict who can push to `main`.

> The `refresh-zillow` bot pushes directly to `main`. If you enable
> "require PR", either (a) exempt the bot/Actions, or (b) change the workflow
> to commit on a branch + auto-merge. See note in Phase 6.

## Phase 6 — Auto-merge (trade-off — decide deliberately)

Auto-merge lets a PR merge automatically once required checks pass. On a public
repo this is convenient but means code can land **without human review** if you
don't also require an approval. Recommended posture:

- [ ] Settings → General → enable **Allow auto-merge**.
- [ ] Keep **require status checks** (gitleaks + tests) ON so auto-merge can
      only complete on a green, secret-free PR.
- [ ] Decide: require human approval too (safer) vs. checks-only (faster).

Enable per-PR with the GitHub UI ("Enable auto-merge") or the API.

## Phase 7 — Verify

- [ ] `npm ci && npm test` passes locally.
- [ ] `secret-scan` check is green on a PR.
- [ ] A test run of `refresh-zillow` (workflow_dispatch) succeeds using Secrets.
- [ ] App boots with only env vars set (no hardcoded fallbacks needed).
