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

## 2026-07-15 — Enhancement: `rules/workflow.md` documents skill-renaming four-touch-point checklist

- **Component**: `rules/workflow.md` (new "Skill Renaming" section)
- **Type**: Enhancement
- **What happened**: Added a "Skill Renaming" section documenting the four touch-points required to fully rename a Claude Code CLI skill: directory, frontmatter `name:` field, `triggers:` array, and prose self-references. Also includes guidance to update AGENTS.md tables and CLAUDE_TS_CHANGELOG.md.
- **Why it matters upstream**: Any claude-ts consumer working with the skill system needs this checklist to avoid leaving the old skill name active after a directory rename (the dispatch system routes by `name:` frontmatter, not directory).
- **Suggested upstream change**: Port the "Skill Renaming" section verbatim into the template's base `rules/workflow.md` as a new top-level section after "Agent Quick Routing" or in a dedicated "Skill Management" section.
- **Status**: pending-port

---

## 2026-07-15 — Enhancement: `.claude/skills/cts-rule-auditor/SKILL.md` added Check 11 for `.claude/settings.json` hook-path validation

- **Component**: `.claude/skills/cts-rule-auditor/SKILL.md` (Check 11, description header)
- **Type**: Enhancement
- **What happened**: Added a new 11th structural consistency check: every `command` field in `.claude/settings.json` hook definitions must resolve to a path listed in `cts-payload.txt`. This catches a payload-sync gap where a settings file could reference a hook script that doesn't exist in a consumer after a fresh `/cts-setup` or `/cts-update`.
- **Why it matters upstream**: Any claude-ts consumer using Stop hooks in `.claude/settings.json` (e.g., knowledge-capture, notification hooks) has the same risk if a payload file is extended to reference a new script path without adding that path to `cts-payload.txt`.
- **Suggested upstream change**: Port the new Check 11 section (entire check description and finding format) into the template's `cts-rule-auditor/SKILL.md`, update the skill description header to say "11 structural checks" instead of "10", and update the main skill description to mention `.claude/settings.json` validation.
- **Status**: pending-port

---

## 2026-07-15 — Enhancement: `rules/testing.md` documents Playwright E2E production-artifact testing and `.env` secret loading

- **Component**: `rules/testing.md` (E2E static server section + new "Reading .env Secrets" section)
- **Type**: Enhancement
- **What happened**: Enhanced the existing E2E static server section to emphasize that CI e2e tests must serve the **built production bundle** (via `web:serve-static`), not the dev server — dev-server transformations can hide production-only issues like nginx `sub_filter` string-match breakage when esbuild minifies `content=""` to `content`, causing CSP-nonce injection to silently fail. Added clear guidance to set `CI: 'true'` in workflows with explanatory comment. Separately added a new "Reading .env Secrets Without Display" section documenting the `set -a && source .env && set +a` pattern for loading test database credentials into shell sessions without exposing secrets in transcripts.
- **Why it matters upstream**: Any claude-ts consumer running e2e tests has the production-bundle-testing priority; the `.env`-loading pattern is useful for any consumer with authenticated test databases.
- **Suggested upstream change**: Port both additions verbatim into the template's base `rules/testing.md`.
- **Status**: pending-port

---

## 2026-07-15 — Enhancement: `rules/code-style-backend.md` added shell-script conventions for dual-path parsing parity

- **Component**: `rules/code-style-backend.md` (new "Shell Script Conventions" section)
- **Type**: Enhancement
- **What happened**: Added a "Shell Script Conventions" section documenting that jq's `// "default"` alternative operator and shell's `|| echo default` fallback do NOT behave identically on malformed input — jq yields empty string on parse failure, while the shell fallback always produces a value. This leads to silent divergence (e.g., empty marker-path collisions) when both branches are used in sequence. Recommended pattern: normalize empty values once after both branches, independent of which path was taken.
- **Why it matters upstream**: Any claude-ts consumer writing shell scripts with dual-path JSON/grep parsing (common for Stop hooks, CLI utilities) has the same parity gap and can hit silent failures on malformed input.
- **Suggested upstream change**: Port the "Shell Script Conventions" section verbatim into the template's base `rules/code-style-backend.md`.
- **Status**: pending-port

---

## 2026-07-15 — Enhancement: `rules/task-authoring.md` added premise-verification guidance for "fix this" tasks

- **Component**: `rules/task-authoring.md` (new "Premise Verification for 'Fix This' Tasks" section)
- **Type**: Enhancement
- **What happened**: Added a new section ("Premise Verification for 'Fix This' Tasks") recommending that before implementing any task whose premise is "X is broken/unfixed," the executor verify the premise against recent git history via `git log -S<marker>`. The fix may already be partially landed, narrowing the actual remaining scope. Includes a concrete example: a test-db-isolation task was stale — one spec already had the fix from a prior commit; only a second spec still needed it.
- **Why it matters upstream**: Any claude-ts consumer relying on task-based workflows has the same risk of stale task premises if a later commit shipped the fix between authoring and execution.
- **Suggested upstream change**: Port the "Premise Verification for 'Fix This' Tasks" section verbatim into the template's base `rules/task-authoring.md` (positioned before "Parked tasks" or after "Splitting Rule").
- **Status**: pending-port

---

## 2026-07-15 — Fix: `rules/workflow.md` carried a doc/config mismatch on the vitest test-target name; resolved by renaming the target itself to Nx-conventional `test`

- **Component**: `rules/workflow.md` (Command Execution Policy table + target-name note), `rules/nx-generators.md`, `rules/testing.md`, plus workspace config (`nx.json`, `.github/workflows/ci.yml`)
- **Type**: Fix
- **What happened**: The Command Execution Policy table said `nx test <project>` while the workspace actually registered the vitest target as `vite:test` (a buried note lower in the same file had the correct name, scoped misleadingly to "the web project"). Investigation showed `vite:test` was never a deliberate choice: it's an `addPlugin` conflict-avoidance fallback frozen at scaffold time — the current `@nx/vitest` plugin default is `test`, its init generator doesn't even offer `vite:test` as a candidate, and the target that originally forced the fallback no longer exists. Rather than rewriting the docs to entrench the nonstandard name, the target was renamed to `test` in `nx.json` (plus every reference: CI's affected list, one explicit `"vite:test"` target-override key in a lib's `project.json`, and three rules/docs files), making the table row correct as originally written. The rules now state the general invariant instead of a name: target names come from `nx.json` plugin registrations, `nx affected -t <name>` silently skips projects lacking the named target, and any rename must update the table and CI list in the same change.
- **Why it matters upstream**: Two lessons. (1) A quick-reference table an agent trusts at a glance outranks a correct-but-buried caveat — keep the table the single source of truth and drop redundant duplicate notes. (2) When a workspace's target name deviates from Nx convention, the right fix may be renaming the target to match convention rather than teaching all docs/agents the deviation — generator-produced names can be conflict-avoidance fossils, so check the plugin's current defaults before documenting a deviation as intentional.
- **Suggested upstream change**: In the template's base `rules/workflow.md`, make the Command Execution Policy table the single source of truth for target names and add the invariant note (plugin registrations define names; `nx affected` silently skips missing targets; renames must move table + CI in lockstep) instead of maintaining the same fact in two places.
- **Status**: pending-port

---

## 2026-07-15 — Enhancement: rules/docs-style.md rewritten to point at Prettier `proseWrap: never` instead of a manual convention

- **Component**: `rules/docs-style.md`, `AGENTS.md` (index entry), `.prettierrc` (not template-inherited itself, but the rule now depends on it)
- **Type**: Enhancement
- **What happened**: An earlier same-day entry added `rules/docs-style.md` as a hand-written convention telling agents not to hard-wrap markdown prose. User feedback ("I thought the md formatting rules more to eslint/prettier rules than a separate rule md file") prompted re-checking: `.md` files already run through `prettier --write` on every commit via `lint-staged`, so the fix was to add `"proseWrap": "never"` to `.prettierrc` and let the existing tool enforce it, rather than relying on agents remembering a rule. `rules/docs-style.md` was rewritten to document the mechanism (Prettier) and one real gotcha it exposed: Prettier's markdown parser merges a block into one paragraph if there's no blank line between two logically-distinct lines — this silently destroys tables and glues together adjacent bold-label lines. Two pre-existing instances of this were found and fixed at the source (missing blank line before a table in `rules/workflow.md`, missing blank line between two label lines in `libs/identity/infrastructure/README.md`).
- **Why it matters upstream**: Any claude-ts consumer already running Prettier on `.md` via lint-staged gets this for free with one config line — a hand-maintained "don't hard-wrap" rule is strictly worse (agents can forget it; Prettier can't). The blank-line-before-structural-element gotcha is a real Prettier/CommonMark interaction any consumer enabling `proseWrap: never` should know about before doing a repo-wide pass.
- **Suggested upstream change**: Add `"proseWrap": "never"` to the template's `.prettierrc` (if it lints `.md` via lint-staged, which the template does), port `rules/docs-style.md` as-is (content is fully generic), and run `prettier --write` over CTS's own `.md` files in the same PR — so the template repo's docs match the convention it prescribes to consumers, keeping CTS and its consumers formatting-aligned rather than only the consumer side adopting it.
- **Status**: pending-port

---

## 2026-07-14 — Enhancement: five generic rules-file additions that bypassed this ledger (written by `/distill-inbox` inlining) + the process fix

- **Component**: `rules/testing.md`, `rules/nx-generators.md`, `rules/dependencies.md`, `rules/docker-commands.md`, `rules/git-operations.md`, `.claude/skills/distill-inbox/SKILL.md` (process fix)
- **Type**: Enhancement (content) + Fix (process)
- **What happened**: A CTS-vs-Penny payload diff found five CTS-managed, non-`.ctsignore`'d rules files carrying generic, valuable additions with no ledger entry — so `/cts-contribute` would never see them. Root cause: `/distill-inbox` inlines inbox learnings into rules files but does not fire the "template-inherited file changed → also update CLAUDE_TS_CHANGELOG.md" obligation that pipeline work does. The unledgered generic content: (1) `testing.md` — NestJS guard-decorator-chain testing convention; pino exception-filter dual-arg assertion (`(obj, msg)` vs winston `(msg, meta)`) with `let`-at-describe-scope mock pattern. (2) `nx-generators.md` — always use the generator, never hand-write `project.json` (hand-scaffolded libs silently drop out of `lint`); `@nx/angular:lib` silently ignores positional args without `--directory`. (3) `dependencies.md` — every lib importing a shared lib needs its own `package.json` dep entry (`@nx/dependency-checks`); pnpm root-only deps need `-w`. (4) `docker-commands.md` — use `curl` not BusyBox `wget` for Alpine healthchecks (no happy-eyeballs → IPv4/IPv6 flakiness); `node:22-alpine` has neither, use inline Node HTTP. (5) `git-operations.md` — never `git stash`/`pop` mid-session (mutates the working tree the user/other agents track via `git diff`); use `git show HEAD:<path>` / `git worktree` instead.
- **Why it matters upstream**: All five additions are framework-generic (NX/pnpm/Docker/git/NestJS-pino) and benefit any consumer. The process gap matters more: every consumer running `/distill-inbox` will silently accumulate the same invisible divergence, making `/cts-contribute` runs incomplete forever.
- **Suggested upstream change**: (1) Port the five rules-file additions (hunk-level cherry-pick from this repo's files; exclude Penny-specific wording like identity-lib paths). (2) In `.claude/skills/distill-inbox/SKILL.md`, add a mandatory step: when the distillation write target is a CTS-managed file (present in `cts-payload.txt` and not matched by `.ctsignore`), also append a `CLAUDE_TS_CHANGELOG.md` entry in the same pass — optionally backed by a `cts-rule-auditor` check that diffs payload files against upstream and flags unledgered divergence.
- **Status**: pending-port

- **Contribute-run warning (recorded for the next `/cts-contribute` session)**: do NOT export `.claude/agents/tester.md`, `qa.md`, `angular-developer.md`, `reviewer.md`, `security-scanner.md` — upstream moved ahead of Penny on these (TDD-shift: test authorship moved to implementation agents; tester is now a verify/coverage-audit stage). Penny's copies are older + project-specialized; exporting them would regress claude-ts. Instead run `/cts-update` (3-way merge) first to absorb the TDD-shift into Penny's customized agents, or `.ctsignore` them as deliberate divergence.
- **Note (2026-07-14, project-local-only)**: `rules/nx-generators.md` additionally received a self-containment fix (private decision-ID reference replaced with a `DECISIONS.md` ADR-005 pointer). Penny-specific hunk — exclude from any upstream port of that file.

---

## 2026-07-14 — Fix: hardened knowledge-capture Stop hook input handling (SESSION_ID sanitization, jq fallback parity, `--agent` assumption documentation)

- **Component**: `.claude/hooks/knowledge-capture-nudge.sh`
- **Type**: Fix
- **What happened**: The Stop hook script parsed `session_id` and other stdin fields without hardening: (1) unsanitized `session_id` values containing `/` or `..` could create marker files at arbitrary writable paths via the `MARKER_BASE` interpolation and `touch` call (path traversal); (2) jq branch on malformed/non-JSON stdin yields empty string (unlike the grep/sed fallback's `|| echo "unknown"` which always produces a value), resulting in colliding/empty marker paths like `/tmp/penny-kc-nudge--inbox`; (3) header comment didn't document that `agent_id`/`agent_type` stdin fields indicate "not a plain top-level session" (they also populate for `claude --agent` invocations, not just subagents), so future reuse could misinterpret the scoping guard. Fixed by: (a) normalizing empty `SESSION_ID` to `"unknown"` after extraction (matching grep/sed fallback semantics); (b) sanitizing `SESSION_ID` to `[A-Za-z0-9_-]` before marker-path interpolation; (c) backstopping sanitization with a second empty-check in case sanitization emptied the value; (d) adding a header-comment line documenting the `--agent` assumption.
- **Why it matters upstream**: Any claude-ts consumer using the Stop hook for file-creation side effects (marker paths, ledger appends) runs the same path-traversal and collision risks if stdin is not hardened. The jq fallback gap is a subtle parity bug — same field parsed two different ways (jq vs. grep) produces semantically-different results on malformed input, leading to nondeterministic behavior depending on which path is taken. Documenting the `--agent` assumption protects against misinterpretation when the hook is reused in a different CI/orchestrator context.
- **Suggested upstream change**: (1) In `.claude/hooks/knowledge-capture-nudge.sh`, add SESSION*ID hardening: normalize empty to `"unknown"` after extraction, then sanitize to `[A-Za-z0-9*-]`via`tr -cd`, then backstop with another empty-check. (2) Update the jq extractions to include an explicit empty-check guard: `jq -r '.field // empty' | grep . || echo "unknown"`or equivalent, ensuring both branches produce the same result on malformed input. (3) Add a one-line header-comment note that`agent_id`/`agent_type`presence indicates "not a plain top-level session" (includes both subagents and`claude --agent` invocations), not just subagents.
- **Status**: pending-port

---

## 2026-07-14 — Fix: knowledge-capture workflow mid-pipeline transcription + subagent-knowledge-reporting requirements

- **Component**: `rules/workflow.md` (Phase 6 section), `CLAUDE.md` (knowledge-capture paragraph), `.claude/agents/ba.md` (report format), `.claude/agents/ddd-architect.md` (report format), `.claude/settings.json` (Stop hooks), `.claude/hooks/knowledge-capture-nudge.sh` (hook script)
- **Type**: Fix + Enhancement
- **What happened**: (See bug report `tasks/rebuild/todo/2026-07-14-bug-report-stop-hook-docker-app-missing-and-blocking-loop.md` for full context and investigation.) Identified two gaps: (1) subagent-reported `## Learnings` sections were placed in Phase 6 (pipeline end) but technical agents pre-flight-read the inbox at dispatch time, so mid-pipeline learnings never reached later agents unless the orchestrator transcribed immediately; (2) two planning agents (`ba`, `ddd-architect`) lacked the `## Learnings` report requirement, so their discoveries went unreported. Fixed by: (a) updating `rules/workflow.md`'s Phase 6 section with a new "Mid-pipeline transcription" subsection explaining that `## Learnings` entries are appended to the inbox immediately upon receipt (before next dispatch), not deferred; (b) updating `CLAUDE.md` knowledge-capture paragraph with one sentence confirming the immediate-transcription pattern; (c) adding the `## Learnings` report-format bullet to both `ba.md` and `ddd-architect.md` (matching devops.md's existing wording, adapted for their domain); (d) `.claude/settings.json` and `.claude/hooks/knowledge-capture-nudge.sh` updated separately by devops agent — removed dead `docker compose exec app` eslint/prettier Stop-hook commands and restricted knowledge-capture nudge to orchestrator session only (early-exit on `agent_id`/`agent_type` stdin fields).
- **Why it matters upstream**: Any claude-ts consumer will hit the same pipeline-timing gap — if technical agents pre-flight-read the inbox but learnings are only recorded after the pipeline ends, mid-pipeline discoveries don't benefit later agents in the chain. The fix makes the flow explicit and front-loads the transcription, decoupling it from Phase 6 (which remains the final sweep/verification). Separately, planning agents (ba, ddd-architect) discovering durable domain/requirements gotchas currently have no explicit reporting channel — adding the `## Learnings` requirement (mirroring technical agents) ensures those discoveries surface upward.
- **Suggested upstream change**: (1) In `rules/workflow.md`, add a "Mid-pipeline transcription" subsection in Phase 6 explaining immediate inbox appending (before next dispatch) and clarifying that Phase 6 is the final sweep, not the first write. (2) In `CLAUDE.md` knowledge-capture paragraph, add one sentence: "Subagent-reported `## Learnings` are transcribed to the inbox immediately upon receipt (before the next dispatch), so later agents' pre-flight inbox reads pick them up." (3) In `ba.md` and `ddd-architect.md` report-format sections, add the `## Learnings` bullet (exactly mirroring devops.md line 116, adapted for domain-level discoveries). (4) In `.claude/settings.json` and `.claude/hooks/knowledge-capture-nudge.sh`, remove docker-compose-exec-app Stop-hook commands and gate the knowledge-capture nudge to orchestrator sessions only (check stdin `agent_id`/`agent_type` fields).
- **Status**: pending-port

---

## 2026-07-14 — Fix: `rules/workflow.md`'s Command Execution Policy documented a permanent "specs are never type-checked" gap instead of the fixable Nx config issue it actually was

- **Component**: `rules/workflow.md` (Command Execution Policy table / spec-file type-checking note)
- **Type**: Fix
- **What happened**: The rule's note near the spec-file type-checking caveat read as an accepted, permanent limitation ("neither `nx build` nor `vite:test` type-checks specs"), when the actual root cause was a fixable Nx config gap: `@nx/vite/plugin`'s `typecheckTargetName` option only auto-generates a `typecheck` target for projects whose test target comes from `@nx/vite:build`, not `@nx/vitest`. This was closed by manually adding an `nx:run-commands`-based `typecheck` target (mirroring Nx's own native pattern exactly, verified via `nx show project <native-typecheck-project> --json`) to every `@nx/vitest`-only project, centralizing cache config via a `targetDefaults.typecheck` block in `nx.json` (using `"default"` inputs, not `"production"`, since `production` excludes spec files/`tsconfig.spec.json`). The rule now documents `nx run <project>:typecheck` / `nx run-many -t typecheck` as a definitive instruction instead of a caveat.
- **Why it matters upstream**: Any claude-ts consumer using `@nx/vitest` for test-target inference (rather than `@nx/vite:build`) has the identical silent gap — no nx target ever type-checks spec files, and the failure mode is invisible (no error, just quietly-never-checked code). Worth checking whether the template's own example `nx.json`/rules content already assumes vite:build-based typecheck generation and would mislead a vitest-only consumer the same way.
- **Suggested upstream change**: In the template's base `rules/workflow.md` (or a dedicated Nx-patterns doc), document the `@nx/vite/plugin` `typecheckTargetName` limitation explicitly (only fires for `@nx/vite:build`, not `@nx/vitest`) and give the manual fix recipe: an `nx:run-commands` target running `tsc --noEmit -p tsconfig.spec.json`, cache config centralized via `targetDefaults.<target-name>` (which matches by target name across manual and plugin-inferred targets alike), with `inputs: ["default", "^production", { "externalDependencies": ["typescript"] }]` — not `"production"`, which excludes spec files by design.
- **Status**: pending-port

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
- **What happened**: `rules/workflow.md` marks `docs/METRICS.md` as "Always" required — one append-only row per completed task — with the same enforcement tier as `docs/KNOWLEDGE_INBOX.md`. But the Stop hook only ever checked `INBOX_UPDATED` and `CHANGELOG_UPDATED`; there was no `METRICS_UPDATED` check. Result: two consecutive completed tasks shipped without a METRICS row, and nothing caught it — the orchestrator had to be told by the user before noticing. Fixed by adding a `METRICS_UPDATED` classification and a matching `SOURCE_CHANGED && !METRICS_UPDATED` reminder block, mirroring the existing inbox pattern exactly (same cadence-guard marker convention, same block-JSON output).
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

---

## 2026-07-15 — Enhancement: Added same-session micro-resolution lane for orchestrator to resolve ≤3 qualifying findings immediately after gate close

- **Component**: `rules/workflow.md` (Quality gate output contract), `CLAUDE.md` (quality-gate paragraph)
- **Type**: Enhancement
- **What happened**: Added a "same-session micro-resolution lane" allowing the orchestrator to resolve up to 3 qualifying `## Emit as Task` findings (≤2 files each, no new deps, no architectural/security relevance, batch-verified once) immediately in the same session instead of always spawning a fresh clean session per finding, based on 2026-07-14 METRICS.md evidence that mechanical T0/T1 follow-ups were costing full-session bootstrap overhead disproportionate to their fix size.
- **Why it matters upstream**: any claude-ts consumer with the same "Emit as Task → fresh session" pattern pays the same bootstrap tax on small mechanical follow-ups; the lane is generic governance logic, not Penny-specific.
- **Suggested upstream change**: port the same rule text into the template's base rules/workflow.md Quality gate output contract section and CLAUDE.md quality-gate paragraph.
- **Status**: pending-port

---

## 2026-07-15 — Enhancement: GitHub Actions workflow `on.branches` filter silently skips the entire job on non-matching branches

- **Component**: `github-actions`/`devops` skill guidance (no local rules file — `rules/git-operations.md` is chartered for PR descriptions only, not a fit for this CI-authoring gotcha)
- **Type**: Enhancement
- **What happened**: CI tests were added targeting the `skeleton` branch, but `.github/workflows/ci.yml` had inherited an earlier `on.branches: [master, develop]` filter. The workflow never ran on `skeleton` — no error, no warning, the job simply didn't appear in the GitHub Actions UI for that branch. Debugging required a full trial-and-error pass (YAML validity → syntax errors → does it run on master → branch filter) before the silent skip was found.
- **Why it matters upstream**: Any claude-ts consumer with multi-branch, environment-specific workflows hits the identical silent-skip trap whenever adding a workflow or modifying branch-specific logic without checking the current branch is in the `on.branches` allow-list.
- **Suggested upstream change**: Add a checklist item to the `github-actions`/`devops` skill guidance: "verify the current branch is in the `on.branches` allow-list when adding or modifying a workflow — a mismatch is fully silent, the job is simply absent from the Actions UI, with no error surfaced anywhere."
- **Status**: pending-port

---

## 2026-07-15 — Enhancement: `rules/testing.md` gained a Mongo-backed parallel-test-isolation pattern and a skip-guard verification rule

- **Component**: `rules/testing.md`
- **Type**: Enhancement
- **What happened**: Two testing-hygiene lessons surfaced while investigating a flaky identity-infrastructure spec: (1) a spec's comment/doc claim of "skips without env X" is not reliable — the actual guard (or absence of one) must be grepped in the spec file itself; two specs here were claimed to skip without `MONGO_TEST_URI` but had no skip guard at all and failed hard instead. (2) Mongo-backed integration specs sharing one database across parallel vitest workers with no per-file isolation fail intermittently (observed as a real once-failed/24-times-passed flake, flagged by Nx as a "flaky task") regardless of correct target wiring.
- **Why it matters upstream**: Any claude-ts consumer running Mongo- (or other shared-DB-) backed integration specs under parallel vitest workers has the identical isolation gap, and any consumer with hedged test-skip-behavior comments has the identical false-trust risk.
- **Suggested upstream change**: Add both lessons to the base `rules/testing.md` Mongo/DB integration-test section: (1) require grepping for an actual `skipIf`/conditional guard before trusting a skip-behavior comment; (2) require unique-DB-per-file or serialized execution for DB-backed integration specs run under parallel test workers.
- **Status**: pending-port

---

## 2026-07-15 — Enhancement: `rules/workflow.md` gained four dispatch/verification hardening rules

- **Component**: `rules/workflow.md` (Command Execution Policy, Quality Gate, Execution Model sections)
- **Type**: Enhancement
- **What happened**: Four independent orchestrator-reliability gaps were closed in one pass: (1) an implementation agent's detailed, confident completion report (specific SHAs, verification output) does not prove file changes — a `devops` agent's background-mode report was entirely fabricated/lost, caught only because the orchestrator independently ran `git diff --stat`/`git status`; the orchestrator must do this after every implementation dispatch, before advancing to `tester`. (2) An agent's plain-English claim that a lint rule "will fire" is not proof — an agent claimed `@nx/dependency-checks` was configured and would fire, but it silently no-oped on file-scoping grounds; only a scratch-violation demonstration (break a dep claim, watch lint fail, restore) exposed it. (3) A dispatched agent going idle without a final report has a second cause beyond hook-chain stalls: agents simply ending their turn without calling `SendMessage` — every dispatch prompt must explicitly instruct "report back via SendMessage to main," and a bare `idle_notification` should get one ping for the report rather than a costly duplicate re-dispatch. (4) Periodically compare `nx show projects` against `nx show projects --with-target lint` to catch hand-scaffolded projects that silently never lint.
- **Why it matters upstream**: All four are generic orchestrator/pipeline reliability patterns independent of this project's stack — any claude-ts consumer running a multi-agent pipeline hits the identical narrative-report-is-not-evidence, plain-claim-is-not-proof, and idle-without-report failure modes.
- **Suggested upstream change**: Port all four rules verbatim (generalizing tool/rule names as needed) into the template's base `rules/workflow.md` in the Quality Gate and Execution Model sections.
- **Status**: pending-port

---

## 2026-07-15 — Enhancement: `rules/nx-generators.md` gained three additional generator-hygiene gotchas

- **Component**: `rules/nx-generators.md`
- **Type**: Enhancement
- **What happened**: Three additional Nx generator/config gotchas were documented: (1) skipping the generator for a new lib doesn't just risk graph-inference gaps — a lib missing `eslint.config.mjs` gets silently dropped from `nx show projects --with-target lint` and `nx affected -t lint` forever, no error. (2) `@nx/vite/plugin`'s `typecheckTargetName` option only auto-generates a `typecheck` target for `@nx/vite:build` projects, not `@nx/vitest` projects — those need a hand-added `nx:run-commands` target mirroring Nx's own inferred pattern, plus two related caveats: `targetDefaults` match by target name (not executor), and the `production` named input excludes spec files so a spec-typechecking target needs `default` inputs. (3) `includedScripts` (hiding npm scripts from Nx/NX Console) must live in `package.json`'s `"nx"` field — it doesn't exist in `project-schema.json` and silently does nothing if placed in `project.json`.
- **Why it matters upstream**: All three are `@nx/*` plugin-mechanics gotchas independent of Penny's domain — any consumer using `@nx/vitest`, hand-scaffolding libs, or trying to hide npm scripts from NX Console hits the same silent-failure shape.
- **Suggested upstream change**: Port all three verbatim into the template's base `rules/nx-generators.md`.
- **Status**: pending-port

---

## 2026-07-15 — Enhancement: `rules/architecture.md` documents that module-boundary violations can span multiple tag dimensions

- **Component**: `rules/architecture.md` (Nx Monorepo Tags & Boundaries section)
- **Type**: Enhancement
- **What happened**: `@nx/enforce-module-boundaries` reports one violation at a time, so fixing the first-reported tag dimension can just surface a violation on a second dimension the pair also differs on. In this repo: a lib flagged for a `scope` violation was also mismatched on `platform` — retagging only `scope` would have re-triggered the same class of error on the next lint run; the fix retagged both dimensions in one pass.
- **Why it matters upstream**: Any claude-ts consumer using a multi-dimension tagging scheme (`scope`/`type`/`platform` or equivalent) with `@nx/enforce-module-boundaries` hits the identical one-violation-at-a-time reporting gap.
- **Suggested upstream change**: Add a note to the template's base `rules/architecture.md` Enforcement section: check `depConstraints` for ALL tag dimensions the flagged pair differs on before choosing a fix, not just the dimension named in the current lint error.
- **Status**: pending-port

---

## 2026-07-15 — Enhancement: `rules/architecture-backend.md` documents the CAS-via-optional-param TOCTOU-race pattern

- **Component**: `rules/architecture-backend.md`
- **Type**: Enhancement
- **What happened**: Codified a repo-recurring fix shape (now 2 instances) for stale-read-modify-write races on Mongo entity fields: the repository method gains an _optional_ `expectedCurrentValue` param that adds an equality filter clause to `findOneAndUpdate`, returning `null` on mismatch; callers surface this as an explicit conflict (409 on HTTP, exit 1 on CLI) rather than a silent retry. The optional param keeps old callers byte-identical, so the pattern rolls out incrementally without a breaking change.
- **Why it matters upstream**: Any claude-ts consumer using MongoDB (or another optimistic-concurrency-capable store) with a repository pattern hits the identical TOCTOU-race shape on scoped field updates; the CAS-via-optional-param design is a reusable, non-breaking fix independent of Mongo specifically (the `findOneAndUpdate`-returns-null mechanism generalizes to any conditional-update primitive).
- **Suggested upstream change**: Add a generalized version (store-agnostic conditional-update wording) to the template's base `rules/architecture-backend.md` repository-pattern section.
- **Status**: pending-port

---

## 2026-07-15 — Enhancement: `rules/dependencies.md` gained CI SHA-pinning and metadata-only-manifest patterns

- **Component**: `rules/dependencies.md`
- **Type**: Enhancement
- **What happened**: Two dependency-management lessons: (1) when pinning a CI Action tag to a commit SHA, always dereference via `refs/tags/<tag>^{}` (or `gh api .../commits/<tag>`) — a bare `git ls-remote refs/tags/<tag>` on an annotated tag returns the tag object's SHA, not the commit's, and both are equally valid-looking 40-hex-char strings. (2) `@nx/dependency-checks` is file-scoped to paths ending `/package.json` and silently no-ops on projects with none — this repo's fix pattern is a metadata-only manifest (a `package.json` present for the Nx graph/lint but deliberately excluded from `pnpm-workspace.yaml` so it's never a pnpm importer), with every workspace-lib import declared as a real dependency (never blanket `ignoredDependencies`), plus a lockfile-reserialization false-alarm note (a huge `pnpm-lock.yaml` diff can be pure format churn from a newer pnpm version — verify via sorted package-key-set diff before suspecting dependency drift).
- **Why it matters upstream**: The SHA-pinning gotcha applies to any consumer pinning third-party GitHub Actions. The metadata-only-manifest pattern applies to any consumer using `@nx/dependency-checks` on apps/libs without a "real" pnpm-importer manifest.
- **Suggested upstream change**: Port both patterns (generalized away from pnpm-specific wording where reasonable) into the template's base `rules/dependencies.md`.
- **Status**: pending-port

---

## 2026-07-15 — Enhancement: `rules/docker-commands.md` gained GH Actions health-cmd quoting and healthcheck-log-cadence diagnostic notes

- **Component**: `rules/docker-commands.md`
- **Type**: Enhancement
- **What happened**: Two Docker/CI diagnostic patterns: (1) GitHub Actions `services.<name>.options` passes straight to `docker create`, which parses `--health-cmd` as exactly one token — a multi-word health command (e.g. `mongosh --eval "..."`) must be wrapped as a single quoted string; the docker-compose array healthcheck form does not translate, and an incorrectly quoted command fails container creation silently (no YAML lint error) before any CI step runs. (2) A container logging continuously with nothing else running is usually its own compose healthcheck pinging itself at its configured `interval` — match the log cadence against the healthcheck interval before treating it as a bug.
- **Why it matters upstream**: Any claude-ts consumer adding a GH Actions service container with a multi-word health-cmd hits the identical single-token-quoting trap; the healthcheck-log-cadence note prevents a common false "something is wrong" investigation for any consumer using compose healthchecks.
- **Suggested upstream change**: Port both notes verbatim into the template's base `rules/docker-commands.md`.
- **Status**: pending-port

---

## 2026-07-15 — Enhancement: `rules/task-authoring.md` — gitignored-tasks git-op guidance folded in; deferred-ADR closing AC added (split status)

- **Component**: `rules/task-authoring.md`
- **Type**: Enhancement
- **What happened**: Two distinct additions folded into the existing Routing section and a new section: (1) project-local-only — reinforced the existing "`tasks/` is gitignored, use plain `mv`/`rm`" guidance with the originating commit reference (`3476a45`) and the `git check-ignore -v` diagnostic tip; this is specific to Penny's own `tasks/` gitignore decision, not a generic claude-ts pattern. (2) pending-port — added a "Deferred ADRs Go Stale Without an Explicit Closing Step" section: any task implementing work an ADR recorded as Deferred/interim must carry an acceptance-criterion line to update that ADR's Status, since docs don't self-maintain as a side effect of code shipping; this generalizes to any claude-ts consumer using an ADR-with-status convention.
- **Why it matters upstream**: The gitignored-tasks git-op reinforcement is project-local (ties to a Penny-specific commit and directory convention already covered by the prior 2026-07-13 entry in this ledger). The deferred-ADR AC requirement is a generic task-authoring discipline applicable to any consumer using ADRs with a Status field.
- **Suggested upstream change**: Port only the deferred-ADR closing-step section (generalized, drop the Penny-specific `DECISIONS.md` ADR-006/CSP-nonce example) into the template's base `rules/task-authoring.md`.
- **Status**: pending-port (deferred-ADR item); project-local-only (gitignored-tasks reinforcement)

---

## 2026-07-15 — Enhancement: Added CTS-managed ledger check to distill-inbox; require CLAUDE_TS_CHANGELOG.md entry when distilling into template-inherited files

- **Component**: `.claude/skills/distill-inbox/SKILL.md`
- **Type**: Enhancement
- **What happened**: `/distill-inbox` was inlining Category B entries into rules files without checking whether the target file is CTS-managed, so distillations into template-inherited files went unledgered and were invisible to `/cts-contribute`. A 2026-07-14 CTS payload diff found five such unledgered files. Added a step that checks whether the target file path is template-inherited (under `rules/**`, `.claude/agents/**`, `.claude/skills/**`, or is `CLAUDE.md`/`AGENTS.md`) and requires a CLAUDE_TS_CHANGELOG.md entry when it is.
- **Why it matters upstream**: the same leak exists in the base template's distill-inbox skill for any consumer with a CTS-managed rules split.
- **Suggested upstream change**: port the same "check CTS-managed ledger obligation" step into the template's distill-inbox skill.
- **Status**: pending-port

---

## 2026-07-15 — Fix: `distill-inbox/SKILL.md` anti-fabrication guardrails added after a distillation pass broke shell examples and embellished causal claims

- **Component**: `.claude/skills/distill-inbox/SKILL.md` (Step 4 dispatch constraints + new Step 4.5 verification)
- **Type**: Fix
- **What happened**: A distillation pass fabricated broken shell script examples (invented multi-pipeline code in "Bad" block; broken stdin redirection in "Good" block) and embellished a causal claim ("breaks nginx sub_filter matching" → "a real CSP violation"). Both defect classes stemmed from missing anti-fabrication constraints on the docs-writer dispatch. Added two explicit guardrails to Step 4 (code examples must be lifted verbatim from real sources; causal claims must preserve the entry's exact wording, not reword/generalize). Added a new Step 4.5 verification step: after docs-writer completes, re-read each distilled section side-by-side with the original inbox entry, checking (1) code blocks cite real code, (2) no semantic drift in mechanisms, (3) surrounding prose coherence and markdown structure integrity.
- **Why it matters upstream**: Any `distill-inbox` consumer runs the same risk — lifting/rewording conventions prevent fabricated examples and silent causal drift, but only a post-write verification step catches structural corruption (e.g., new `##` heading spliced into middle of a bullet list) that a subagent's own summary won't flag.
- **Suggested upstream change**: Port the Step 4 guardrail constraints and the new Step 4.5 verification step verbatim into the template's `distill-inbox/SKILL.md`.
- **Status**: pending-port
