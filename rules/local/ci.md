# CI/CD (local)

This file holds this project's CI/CD and GitHub Actions gotchas. There is no `rules/cts/ci.md` to extend — this is a standalone local file.

## Secrets vs Variables

### An unset `secrets.*` evaluates to empty string with no error — use `vars.*` for non-sensitive config

A `build-images` failure was `${{ secrets.TELEGRAM_BOT_USERNAME }}` resolving to nothing because the secret had not been created yet; the workflow passed an empty `--build-arg` and the Dockerfile's `test -n` guard emitted a generic message pointing at the Dockerfile rather than at the missing secret. GitHub documents both halves of this trap: an unset secret silently becomes an empty string, and secrets cannot be used in `if:` conditionals, so you cannot cheaply assert their presence. Compounding it, secrets are masked as `***` in logs by design — so when the value is merely wrong rather than missing, the logs cannot distinguish the two.

GitHub's own criterion is sensitivity, not repo-hygiene: "if you need greater security for sensitive information such as passwords or API keys, you should use secrets instead of variables" (docs.github.com, Variables › Security Considerations). Configuration variables (`vars.*`, scopable to repository/organization/environment) are the correct vehicle for non-sensitive per-environment values — they render in plain text, so they are debuggable. Rule of thumb: masking is a cost paid for confidentiality; when the value is not confidential you pay the cost and receive nothing.

## `actions/cache`

### A cache key must encode everything that determines the cached CONTENT, not just the lockfile

The Playwright browser cache was keyed `playwright-${{ hashFiles('pnpm-lock.yaml') }}`, but its content is determined by the installed browser SET, which the key did not encode. When the install step changed from chromium-only to all three engines, `pnpm-lock.yaml` was untouched, so the key still hit exactly — and `actions/cache` skips its post-job save on an exact hit. The steady state would have been: restore chromium-only cache → download firefox + webkit → save nothing → repeat forever, with tests passing the whole time and nothing in the logs announcing the waste.

Confirmed empirically in both directions: the pre-fix run's final step read `skipped Post Cache Playwright browsers`, while the post-fix run (key prefix bumped `playwright-` → `playwright-all-`, `restore-keys` bumped to match so a stale entry cannot be partially restored) read `Cache not found for input keys: playwright-all-…` → downloads → `Cache saved with key: playwright-all-…`. Generalises to any cache whose content depends on a step's arguments rather than only on a manifest — the lockfile pins the tool VERSION, not which artefacts you asked it to fetch. Also recorded for calibration: the full three-engine e2e job ran 1m43s cold, so the "installing all browsers is too slow for CI" premise behind the original chromium-only install did not hold.

## Diagnosing CI Failures

### A run marked "failure" can be mostly green — always read job-level conclusions

One run showed as `failure` in the UI and in pasted logs, and was reasoned about (including by a dispatched `devops` agent working only from those logs) as "the pipeline is still failing." `gh run view <id> --json jobs` showed `ci` ✅, `build-images` ✅, `e2e` ❌ — two of three jobs were already green, and the only remaining defect (missing Playwright firefox/webkit binaries) was unrelated to the work everyone was chasing.

Run-level status is the OR of its jobs, so a 2/3-green run and a 0/3-red run are visually identical; pasted log excerpts flatten this further by showing one job at one moment on one branch. Practical consequence: an agent without GitHub API access cannot distinguish these states and will over-report breakage — authenticate `gh` (read scopes suffice: run status, job breakdown, `--log-failed`, and file contents at any ref were all this investigation needed) before diagnosing CI. `gh` read access is worth having configured for exactly this reason.
