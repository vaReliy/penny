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

## 2026-07-13 — Enhancement: `rules/task-authoring.md` routing moved from `docs/<phase>/tasks/` to a top-level `./tasks/<phase>/` convention

- **Component**: `rules/task-authoring.md` (Routing section), `.gitignore`
- **Type**: Enhancement
- **What happened**: Task/planning files were previously routed to `docs/<phase>/tasks/todo|parked|done/`, excluded from git via **local-only** `.git/info/exclude` entries (one per phase directory, e.g. `docs/rebuild/`). This meant exclusion didn't travel with a fresh clone — a new checkout would have git-track these private planning docs until someone manually re-added the local exclude line. Consolidated all phase folders (`rebuild`, `workspace`, future ones) under a single top-level `./tasks/` directory, added one `/tasks` line to the **committed** `.gitignore`, and dropped the now-redundant inner `tasks/` nesting each phase folder used to have under `docs/<phase>/tasks/` (now just `tasks/<phase>/todo|parked|done/` directly). Removed the stale `docs/rebuild/` line from `.git/info/exclude` since the directory no longer exists there.
- **Why it matters upstream**: Any claude-ts consumer using the `docs/<phase>/tasks/` local-exclude pattern has the same clone-portability gap — a real committed `.gitignore` entry is strictly better than a local-only exclude for a path whose exclusion is a permanent project decision, not a personal preference. The nested `docs/<phase>/tasks/` structure was also carrying redundant path segments (`tasks/tasks`-shaped once moved) that a fresh project wouldn't need to inherit.
- **Suggested upstream change**: In the template's base `rules/task-authoring.md`, default the Routing section to a top-level `./tasks/<phase>/todo|parked|done/` convention with a committed `.gitignore` entry (`/tasks`), rather than `docs/<phase>/tasks/` + local exclude. Consumers who prefer keeping planning docs nested under `docs/` can still override, but the default should be clone-portable.
- **Status**: pending-port

---

## 2026-07-12 — Enhancement: planning-team reviewer/challenger agents need full prior context pasted in the spawn prompt, not fetched later via SendMessage

- **Component**: `rules/workflow.md` (Planning Team section)
- **Type**: Enhancement
- **What happened**: Running the `ba` → `ddd-architect` → `devil` planning chain for a feature, `devil` was spawned with only a summary of `ba`'s and `ddd-architect`'s output in its own prompt (to save orchestrator tokens). `devil` then tried to `SendMessage` `ba`/`ddd-architect` directly asking for their full doc text — but both had already gone idle after their own spawn turn ended, so the direct request produced only idle-notification pings with no content back. The orchestrator had to manually re-paste each agent's full prior output into a message to `devil` before the chain could proceed, costing an extra round-trip. Separately confirmed: the `Agent` tool's `team_name` parameter is now documented as "Deprecated; ignored. The session has a single implicit team" — so `rules/workflow.md`'s `TeamCreate`/`TeamDelete` Tool API examples for the Planning/Implementation Team sections no longer reflect how team coordination actually works (it's name-based `SendMessage` between individually-spawned agents, not an explicit team object).
- **Why it matters upstream**: Any claude-ts consumer running a multi-stage planning chain (reviewer/challenger agent critiquing prior agents' full output) will hit the identical stall — a spawned agent cannot assume a previously-spawned teammate will re-serve its own past output on request once it's gone idle. The `TeamCreate`/`team_name` documentation drift is a separate but related gap: the rule's coordination examples no longer match the tool's actual (deprecated-teams, name-based-SendMessage) behavior.
- **Suggested upstream change**: (1) In the Planning Team / Implementation Team sections, add an explicit instruction: when spawning a reviewer/challenger agent into an ongoing chain, paste every prior agent's **full** output into the new agent's spawn prompt up front — do not summarize and rely on the new agent fetching the rest via `SendMessage` to a teammate that may already be idle/done. (2) Update the `TeamCreate`/`TeamDelete` Tool API Reference section to reflect that team scoping is currently a no-op in the `Agent` tool (`team_name` deprecated/ignored) and that coordination is purely name-based `SendMessage` between agents spawned via plain `Agent` calls — or remove the `TeamCreate`/`TeamDelete` examples entirely if the underlying tool no longer supports them.
- **Status**: pending-port

---

## 2026-07-12 — Fix: distill-inbox's Category B/C rubric can never auto-distill an inbox whose entries habitually hedge with "(guess)"

- **Component**: `.claude/skills/distill-inbox/SKILL.md`
- **Type**: Fix
- **What happened**: Ran `/distill-inbox` against a real `docs/KNOWLEDGE_INBOX.md` with ~50 entries. The skill's bucket table puts any entry with `Belongs in (guess):` into Category C ("uncertain — keep untouched") regardless of how single-target/confident the guess actually is; only entries with `Belongs in: <exact-file>` (no "guess") and one candidate qualify as Category B. Because every entry in this project's inbox uses the hedged `(guess)` convention as a matter of habit (and the inbox's own header prose invites that hedge), a literal application of the rubric found **zero** Category B matches out of 50 — the skill could not drain the inbox at all on its own terms. Had to fall back to the orchestrator manually judging a single confident target per entry (overriding the mechanical rubric with the user's explicit sign-off) before any content moved. Separately, the `docs-writer` agent dispatched to perform the actual inlining reported only 4 entries "failed to delete due to character encoding," but independent verification (grepping each claimed target file for the migrated content) found 9 entries had actually been successfully inlined into their target files yet left undeleted in the inbox — more than double the agent's own reported failure count. A follow-up manual review also caught a structural edit error the agent's own summary didn't surface at all: in `rules/workflow.md`, two new `##` sections were spliced into the middle of an existing bullet list (the "Division of labor" list under the Knowledge Inbox section), orphaning its last three bullets so they rendered under an unrelated heading ("Quality Gate Pre-Flight Scope") — a silent markdown-structure corruption, not just a missed deletion.
- **Why it matters upstream**: Any claude-ts consumer whose inbox-entry convention encourages (or defaults to) hedged "(guess)" wording will hit the identical self-inflicted deadlock — the mechanical bucket rubric can never promote a guessed entry to "clear target" without a human/agent explicitly rewriting the line first, so the skill silently does nothing useful run after run unless someone notices and intervenes. The second finding (a subagent's self-reported completion count understating actual partial-failure by 2x+) is a general reliability gap: any skill or pipeline step that delegates bulk multi-file edits to a subagent and trusts its own summary without independent verification risks silently leaving stale/duplicated content behind.
- **Suggested upstream change**: (1) In the bucket table, redefine Category B as "single confident target, regardless of guess wording" and Category C as strictly "lists multiple candidates or content spans >1 file" — drop `(guess)` wording itself as an automatic C-disqualifier. (2) Add an explicit step instructing the orchestrator/assistant to first pass over all `(guess)`-hedged entries and decide, using its own judgment (with user confirmation), whether each has one clear best-fit target — promoting confident guesses to B before applying the table — rather than leaving every guessed entry untouched by default. (3) Add a mandatory post-dispatch verification step to the skill: after the `docs-writer` agent reports which entries were distilled vs. left untouched, independently grep each claimed-distilled entry's target file before trusting the inbox is safe to leave as-is — don't rely solely on the subagent's own completion count. (4) That same verification pass should include a structural check (e.g. render/lint the diff, or scan for a new `##`/`###` heading inserted directly before an unindented `- ` line that isn't a fresh list) — a subagent doing many sequential edits in one file can splice a new section into the middle of an existing list without any tool erroring, and nothing in the diff stat flags it.
- **Status**: pending-port

---

## 2026-07-08 — Fix: `rules/architecture.md`'s onion-layer bullet list didn't document `type:kernel → type:contracts` as an allowed shared-leaf dependency

- **Component**: `rules/architecture.md` (Onion Rules / Backend section)
- **Type**: Fix
- **What happened**: A task relaxed the project's `eslint.config.mjs` `depConstraints` so `type:kernel` may depend on `type:contracts` (to import a shared `RoleType` union onto `CallerIdentity.roles` instead of duplicating it). This extended an existing-but-undocumented pattern: `type:core`, `type:application`, and `type:infrastructure` were already allowed to depend on `type:contracts` (each is a documented "shared leaf" consumer per the file's own "Type-Contracts Boundary" section), but the plain bullet-list description of `type:kernel` at line 87 still said only "may depend on util and errors," so the doc and the enforced lint rule had drifted apart. Fixed by updating that bullet to mention the `type:contracts` allowance and point at the existing "Type-Contracts Boundary" section, which already generically documents the pattern (allowlisting a leaf lib into `eslint.config.mjs` when it becomes authoritative for a shared primitive) — no new section needed, just a stale line correction. Closed inline (cheap-override, single file, docs-only) rather than as a separate backlog task, per `rules/workflow.md`'s cheap-override clause.
- **Why it matters upstream**: any claude-ts consumer using the kernel/contracts/errors/util "shared leaf" onion pattern will hit the same drift the moment they extend one leaf's allowlist to include another — the template's own bullet-list layer descriptions need to stay in sync with whichever `depConstraints` example ships in the template's `eslint.config.mjs`, or explicitly say "see your own `eslint.config.mjs` for the authoritative allowlist" instead of restating specific tags that can go stale.
- **Suggested upstream change**: in the template's `rules/architecture.md`, either (a) drop the specific "may depend on X and Y" wording from each onion-layer bullet and replace it with a pointer to the authoritative `eslint.config.mjs` `depConstraints` block, or (b) if keeping the inline description, add a one-line reminder next to the "Type-Contracts Boundary" section: "whenever a leaf-to-leaf allowlist changes in `eslint.config.mjs`, update the corresponding bullet above in the same commit."
- **Status**: pending-port

## 2026-07-08 — Fix: backend-developer.md carried the generic claude-ts default stack instead of this project's actual stack

- **Component**: `.claude/agents/backend-developer.md`
- **Type**: Fix
- **What happened**: The "Project Stack" table (and two prose references in Workflow/Done Criteria) still listed the claude-ts template defaults — `Express / Fastify / NestJS`, `Prisma (primary) / TypeORM / Drizzle`, `Passport.js / JWT / session` — none of which match this repo's actual backend stack (NestJS only, Mongoose + Typegoose confined to the infrastructure layer, JWT delivered via an httpOnly+Secure+SameSite=Lax cookie, MongoDB 7). This misleads the agent about what ORM/auth patterns to reach for. Fixed by replacing the table with the project's real stack and swapping the two Prisma-specific prose lines (`Schema first: Prisma migration → model types`, `No N+1 queries (use include/select in Prisma)`) for Mongoose/Typegoose equivalents.
- **Why it matters upstream**: Every claude-ts consumer that customizes its actual stack (a different ORM, different auth mechanism) but only edits the table header risks leaving stale Prisma/PostgreSQL references in prose bullets elsewhere in the same file — the generator/template doesn't cross-check table content against prose mentions of the same technology.
- **Suggested upstream change**: When customizing `backend-developer.md` (or any agent template) for a project's real stack, grep the whole file for the default stack's proper nouns (`Prisma`, `PostgreSQL`, `Passport.js`, etc.) — not just the Project Stack table — before considering the customization complete. Consider a `cts-rule-auditor` check that flags stack-default keywords surviving outside a table row.
- **Status**: project-local-only

---

## 2026-07-08 — Fix: knowledge-capture Stop hook didn't enforce docs/METRICS.md

- **Component**: `.claude/hooks/knowledge-capture-nudge.sh`
- **Type**: Fix
- **What happened**: `rules/workflow.md` marks `docs/METRICS.md` as "Always" required — one append-only row per completed task — with the same enforcement tier as `docs/KNOWLEDGE_INBOX.md`. But the Stop hook only ever checked `INBOX_UPDATED` and `CHANGELOG_UPDATED`; there was no `METRICS_UPDATED` check. Result: two consecutive completed tasks (`2026-07-07-01-web-container-unhealthy`, `2026-07-07-02-integration-test-mongo-auth`) shipped without a METRICS row, and nothing caught it — the orchestrator had to be told by the user before noticing. Fixed by adding a `METRICS_UPDATED` classification and a matching `SOURCE_CHANGED && !METRICS_UPDATED` reminder block, mirroring the existing inbox pattern exactly (same cadence-guard marker convention, same block-JSON output).
- **Why it matters upstream**: Any claude-ts consumer that adopts a METRICS-style ledger (or any other "Always" per-task ledger declared only in `rules/workflow.md` prose) will hit the same silent-drift failure mode already documented in the 2026-06-26 entry below — spec wording alone doesn't get followed reliably; only a Stop-hook check does. The template's hook should treat every "Always" ledger declared in workflow.md as a first-class check, not just the inbox.
- **Suggested upstream change**: Port the `METRICS_UPDATED` check pattern into the base `knowledge-capture-nudge.sh` template, and add a lint/audit rule (e.g. in `cts-rule-auditor`) that cross-checks every ledger marked "Always" in `rules/workflow.md`'s knowledge-obligations table against the Stop hook's classification list, flagging any that lack a corresponding `*_UPDATED` check.
- **Status**: pending-port

---

## 2026-06-26 — Fix: knowledge-capture obligations need a Stop hook, not just spec wording

- **Component**: `rules/workflow.md` + `.claude/hooks/knowledge-capture-nudge.sh`
- **Type**: Fix
- **What happened**: Agents were consistently writing durable learnings to private auto-memory instead of `docs/KNOWLEDGE_INBOX.md` due to three root causes: (1) `rules/workflow.md` routed "config gotchas" to auto-memory with an escape hatch that rationalized almost any learning as session-specific; (2) the distillation phase was framed as "after every pipeline," so direct/trivial edits never triggered it; (3) none of the agent definitions mentioned the inbox at all. The fix was a Stop hook (`.claude/hooks/knowledge-capture-nudge.sh`) that blocks once per session per unmet obligation, removing the escape hatch from `rules/workflow.md`, adding an explicit litmus test, and adding a "## Learnings" handoff bullet to every implementation agent's report format.
- **Why it matters upstream**: Instructions alone are probabilistic — any claude-ts consumer relying on spec wording alone for a knowledge-capture obligation will see the same drift, since the harness system prompt pulls agents toward private memory by default. A Stop hook is the only deterministic enforcement point.
- **Suggested upstream change**: Port the Stop-hook script pattern, the litmus test wording, and the "## Learnings" report-format bullet convention into the claude-ts template's base `workflow.md` and agent templates.
- **Status**: pending-port

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
