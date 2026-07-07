# Claude-TS Upstream Changelog

Tracks divergences, overrides, conflicts, fixes, and enhancements discovered in this project's `.claude/agents/**`, `.claude/skills/**`, and `rules/**` — all inherited from the `claude-ts` template repo. Each entry has enough detail to port directly into a PR against `claude-ts`. Entries are removed only when actually ported upstream (mark `Status: ported` with the PR link first, then delete on the next cleanup pass) or when explicitly decided as not-applicable upstream (`Status: project-local-only`, kept for record).

## Entry format

```
## YYYY-MM-DD — [Type] short title

- **Component**: e.g. `devops` agent / `rules/workflow.md` / `tester` agent
- **Type**: Override | Conflict | Fix | Enhancement
- **What happened**: concrete description of the divergence/bug/gap, from this project's actual usage
- **Why it matters upstream**: why other claude-ts consumers would hit the same issue
- **Suggested upstream change**: concrete patch/diff or instruction, ready to apply to the template repo
- **Status**: pending-port | ported (PR link) | project-local-only
```

---

## 2026-07-07 — Fix: cts-sync.sh self-overwrite produces spurious syntax-error exit code

- **Component**: `.claude/scripts/cts-sync.sh`
- **Type**: Fix
- **What happened**: Running `/cts-update --source ../claude-ts` completed all real work (payload synced, conflicts/merges reported, `.cts-version` bumped, "Done. Review with: git diff" printed) but the process still exited 2 with a trailing `bash: syntax error near unexpected token`. Confirmed real work was intact by checking `.cts-version` against the new upstream SHA and matching `git diff --stat` to the printed report. Root cause: `.claude/scripts/` is deliberately last in `cts-payload.txt` so the running script overwrites itself only after everything else copies (see the comment above `sync_path()`), but bash does not fully buffer script source before executing straight-through code — once `copy_one` overwrites the on-disk script file mid-run, subsequent reads for the remainder of the script land on bytes from the _new_ file at the _old_ file's byte offset, producing garbage that doesn't parse as any coherent statement. Re-verified in an isolated sandbox after this same sync pulled `c512bd8` (which touched only `merge_one`'s cleanup, not the self-copy path): a synthetic mid-file diff to `cts-sync.sh` still reproduces the failure class, this time as `exit 127, line: command not found` — a different error entirely, confirming the symptom is nondeterministic garbage from misaligned byte offsets rather than a stable, greppable signature, and that the bug is still live in the version currently shipped.
- **Why it matters upstream**: Every consumer of `/cts-update` invoking `cts-sync.sh` directly via `bash script.sh` (not `source`d) hits this on any run where the script itself changed upstream — which will keep recurring since nothing in the current self-copy logic addresses it. The non-zero exit currently reads as total failure, which contradicts `.claude/skills/cts-update/SKILL.md` step 2's guidance that non-zero exit means "did not run" — that guidance needs a caveat, or better, the underlying bug should be fixed so the exit code is trustworthy again.
- **Suggested upstream change**: Make the self-copy the last statement in the script with a guaranteed-atomic swap, e.g. `exec bash "$0" "$@"` immediately before copying `.claude/scripts/` so the currently-running process no longer needs to read further from the file; or copy to a temp path and `mv` into place as the literal final line with zero code after it; or restructure so `.claude/scripts/` copy happens via a subshell/background write that the parent process doesn't depend on continuing past.
- **Status**: pending-port

---

## 2026-07-01 — Ported: 25 entries contributed via /cts-contribute

25 `pending-port` entries (spanning `CLAUDE.md`, `rules/workflow.md`, `rules/task-authoring.md`, `rules/code-style.md`, `rules/nx-generators.md`, `rules/testing.md`, `rules/docker-commands.md`, `rules/validation-authorization.md`, `AGENTS.md`, `.mcp.json`, `.claude/settings.json`, and 16 agent files) were exported to the local `claude-ts` checkout in a single `/cts-contribute` session, along with 2 net-new skills (`cts-rule-auditor`, `distill-inbox`). Project-specific content (Mongo/Telegram/Angular-only examples, hardcoded Nx project names) was generalized during export. See `../claude-ts/CHANGELOG.md` `[Unreleased]` sections for the itemized list. Not yet committed in `claude-ts` — pending owner review of `git diff` there.

- **Status**: ported (pending commit in claude-ts, not yet PR'd upstream from there)

---

## 2026-06-28 — Enhancement: split monolithic code-style.md and architecture.md into platform-specific files

- **Component**: `rules/code-style.md`, `rules/code-style-angular.md` (new), `rules/code-style-backend.md` (new), `rules/architecture.md`, `rules/architecture-angular.md` (new), `rules/architecture-backend.md` (new)
- **Type**: Enhancement
- **What happened**: Split two large shared rules files into platform-specific variants to reduce token usage and prevent frontend agents from loading backend-specific patterns and vice versa. See file list in the previous version of this entry for the exact content split.
- **Why it matters upstream**: Any claude-ts consumer with multiple platforms (backend + frontend, or multiple backend frameworks) will benefit from splitting large shared rules files.
- **Suggested upstream change**: Not ported in the 2026-07-01 contribution session — this is a larger structural change requiring genuinely generic (framework-agnostic) content to be authored for CTS, since Penny's own split files are Angular/Mongo-specific and are already protected in `.ctsignore` as project-local overrides. During that session, the agent pre-flight reads that reference `rules/architecture-angular.md` / `rules/code-style-backend.md` etc. were instead made conditional ("if your project splits rules by platform, also read...") so the references don't break in vanilla CTS installs. A future session should author generic multi-framework variants (Vue/React/Angular for frontend; a couple of common backend patterns) and un-gate the agent pre-flight reads once those files exist upstream.
- **Status**: pending-port (structural — needs a dedicated session)

---

## 2026-06-26 — Enhancement: LIVR bootstrap section in validation-authorization.md

- **Component**: `rules/validation-authorization.md`
- **Type**: Enhancement
- **What happened**: Added a "LIVR bootstrap (required once per process)" section documenting that `registerLivrRules()` must be called once at process startup or LIVR validation silently no-ops. Discovered when a generated `main.ts` omitted the bootstrap call.
- **Why it matters upstream**: Any `BaseService`-style pattern requiring a manual one-time bootstrap call has the same silent-failure risk, regardless of which validation library is chosen.
- **Suggested upstream change**: Not ported in the 2026-07-01 contribution session (js-validator-livr is one of three validator options CTS documents, not the default — the manual-bootstrap footgun is specific to that library's registration model). If contributing, generalize to "libraries with a manual bootstrap/registration step must be called once at process startup — document the exact call for whichever validator your project uses" rather than LIVR-specific wording.
- **Status**: pending-port (needs generalization before export)
