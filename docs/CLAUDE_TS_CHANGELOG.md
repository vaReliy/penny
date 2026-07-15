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

## 2026-07-16 — Ported: 28 entries contributed via /cts-contribute

28 `pending-port` entries (spanning `CLAUDE.md`, `rules/workflow.md`, `rules/testing.md`, `rules/task-authoring.md`, `rules/nx-generators.md`, `rules/docker-commands.md`, `rules/code-style.md`, `rules/dependencies.md`, `rules/git-operations.md`, `rules/validation-authorization.md`, `rules/architecture.md`, `ba.md`, `ddd-architect.md`, `.claude/hooks/knowledge-capture-nudge.sh`, `.claude/settings.json`, `.claude/scripts/cts-sync.sh`, `.claude/skills/{cts-rule-auditor,distill-inbox,github-actions,cts-update}`, plus the new `rules/docs-style.md` + `.prettierrc`) were exported to the local `claude-ts` checkout across several `/cts-contribute` sessions. Project-specific content (Mongo/Angular/pnpm-specific wording, task/DECISIONS examples) was generalized during export; the `cts-sync.sh` self-overwrite/source-mismatch bugs and the `rules/workflow.md` Planning Team spawn-context / stale `TeamCreate`-`TeamDelete`-`team_name` Tool API Reference were all fixed directly at the engine/doc level since neither project had actually implemented those fixes yet — verified end-to-end (the `cts-sync.sh` fixes against a scratch repo; the `TeamCreate` cleanup by grepping for every remaining stray reference in the file). Deliberately excluded: `.claude/agents/{tester,qa,angular-developer,reviewer,security-scanner}.md` (upstream is ahead on the TDD-shift), and several undocumented local simplifications in this project's `rules/workflow.md`/`CLAUDE.md` (dropped Tiered Planning Ladder, `handoff`-skill hard-stop, Generation damping) that were never logged as intentional upstream changes. See `../claude-ts/CHANGELOG.md`'s `[Unreleased] — Contributed from penny` section for the itemized list.

- **Status**: ported (pending commit in claude-ts, not yet PR'd upstream from there)

---

## 2026-07-12 — Fix: distill-inbox's Category B/C rubric can never auto-distill an inbox whose entries habitually hedge with "(guess)"

- **Component**: `.claude/skills/distill-inbox/SKILL.md`
- **Type**: Fix
- **What happened**: Ran `/distill-inbox` against a real `docs/KNOWLEDGE_INBOX.md` with ~50 entries. The skill's bucket table puts any entry with `Belongs in (guess):` into Category C ("uncertain — keep untouched") regardless of how single-target/confident the guess actually is; only entries with `Belongs in: <exact-file>` (no "guess") and one candidate qualify as Category B. Because every entry in this project's inbox uses the hedged `(guess)` convention as a matter of habit (and the inbox's own header prose invites that hedge), a literal application of the rubric found **zero** Category B matches out of 50 — the skill could not drain the inbox at all on its own terms. Had to fall back to the orchestrator manually judging a single confident target per entry (overriding the mechanical rubric with the user's explicit sign-off) before any content moved.
- **Why it matters upstream**: Any claude-ts consumer whose inbox-entry convention encourages (or defaults to) hedged "(guess)" wording will hit the identical self-inflicted deadlock — the mechanical bucket rubric can never promote a guessed entry to "clear target" without a human/agent explicitly rewriting the line first, so the skill silently does nothing useful run after run unless someone notices and intervenes.
- **Suggested upstream change**: (1) In the bucket table, redefine Category B as "single confident target, regardless of guess wording" and Category C as strictly "lists multiple candidates or content spans >1 file" — drop `(guess)` wording itself as an automatic C-disqualifier. (2) Add an explicit step instructing the orchestrator/assistant to first pass over all `(guess)`-hedged entries and decide, using its own judgment (with user confirmation), whether each has one clear best-fit target — promoting confident guesses to B before applying the table — rather than leaving every guessed entry untouched by default.
- **Status**: pending-port — note: the post-write-verification half of this entry's original suggestion (independently grep each claimed-distilled entry's target file rather than trusting a subagent's own completion count, plus a structural-corruption check) was already ported in the 2026-07-16 contribution round as Step 4.5; only the Category B/C rubric redefinition above (items 1–2) remains outstanding, and was never actually applied to this project's own copy either.

---

## 2026-07-08 — Fix: `rules/architecture.md`'s onion-layer bullet list didn't document `type:kernel → type:contracts` as an allowed shared-leaf dependency

- **Component**: `rules/architecture.md` (Onion Rules / Backend section)
- **Type**: Fix
- **What happened**: A task relaxed the project's `eslint.config.mjs` `depConstraints` so `type:kernel` may depend on `type:contracts` (to import a shared `RoleType` union onto `CallerIdentity.roles` instead of duplicating it). This extended an existing-but-undocumented pattern: `type:core`, `type:application`, and `type:infrastructure` were already allowed to depend on `type:contracts` (each is a documented "shared leaf" consumer per the file's own "Type-Contracts Boundary" section), but the plain bullet-list description of `type:kernel` still said only "may depend on util and errors," so the doc and the enforced lint rule had drifted apart.
- **Why it matters upstream**: any claude-ts consumer using the kernel/contracts/errors/util "shared leaf" onion pattern will hit the same drift the moment they extend one leaf's allowlist to include another.
- **Suggested upstream change**: in the template's `rules/architecture.md`, either (a) drop the specific "may depend on X and Y" wording from each onion-layer bullet and replace it with a pointer to the authoritative `eslint.config.mjs` `depConstraints` block, or (b) if keeping the inline description, add a one-line reminder next to the "Type-Contracts Boundary" section: "whenever a leaf-to-leaf allowlist changes in `eslint.config.mjs`, update the corresponding bullet above in the same commit."
- **Status**: pending-port — blocked on the structural platform-split below: CTS's current single-file `rules/architecture.md` has no Nx-tag/`depConstraints` documentation at all to attach this fix to.

## 2026-07-08 — Fix: backend-developer.md carried the generic claude-ts default stack instead of this project's actual stack

- **Component**: `.claude/agents/backend-developer.md`
- **Type**: Fix
- **What happened**: The "Project Stack" table (and two prose references in Workflow/Done Criteria) still listed the claude-ts template defaults — `Express / Fastify / NestJS`, `Prisma (primary) / TypeORM / Drizzle`, `Passport.js / JWT / session` — none of which match this repo's actual backend stack (NestJS only, Mongoose + Typegoose confined to the infrastructure layer, JWT delivered via an httpOnly+Secure+SameSite=Lax cookie, MongoDB 7). Fixed by replacing the table with the project's real stack and swapping the two Prisma-specific prose lines for Mongoose/Typegoose equivalents.
- **Why it matters upstream**: Every claude-ts consumer that customizes its actual stack (a different ORM, different auth mechanism) but only edits the table header risks leaving stale Prisma/PostgreSQL references in prose bullets elsewhere in the same file — the generator/template doesn't cross-check table content against prose mentions of the same technology.
- **Suggested upstream change**: When customizing `backend-developer.md` (or any agent template) for a project's real stack, grep the whole file for the default stack's proper nouns (`Prisma`, `PostgreSQL`, `Passport.js`, etc.) — not just the Project Stack table — before considering the customization complete. Consider a `cts-rule-auditor` check that flags stack-default keywords surviving outside a table row.
- **Status**: project-local-only

---

## 2026-06-28 — Enhancement: split monolithic code-style.md and architecture.md into platform-specific files

- **Component**: `rules/code-style.md`, `rules/code-style-angular.md` (new), `rules/code-style-backend.md` (new), `rules/architecture.md`, `rules/architecture-angular.md` (new), `rules/architecture-backend.md` (new)
- **Type**: Enhancement
- **What happened**: Split two large shared rules files into platform-specific variants to reduce token usage and prevent frontend agents from loading backend-specific patterns and vice versa.
- **Why it matters upstream**: Any claude-ts consumer with multiple platforms (backend + frontend, or multiple backend frameworks) will benefit from splitting large shared rules files.
- **Suggested upstream change**: This is a larger structural change requiring genuinely generic (framework-agnostic) content to be authored for CTS, since this project's own split files are Angular/Mongo-specific and are already protected in `.ctsignore` as project-local overrides. A future session should author generic multi-framework variants (Vue/React/Angular for frontend; a couple of common backend patterns) and un-gate the agent pre-flight reads once those files exist upstream. Two generalized fixes that would otherwise target `rules/architecture-backend.md` and the Nx-tag portion of `rules/architecture.md` (the kernel→contracts doc-drift fix above, and the multi-dimension-tag-violation note below) are both blocked on this split — CTS's current single-file `rules/architecture.md` documents no Nx-tag/`depConstraints` system for them to attach to.
- **Status**: pending-port (structural — needs a dedicated session)

---

## 2026-07-15 — Enhancement: `rules/architecture.md` documents that module-boundary violations can span multiple tag dimensions

- **Component**: `rules/architecture.md` (Nx Monorepo Tags & Boundaries section)
- **Type**: Enhancement
- **What happened**: `@nx/enforce-module-boundaries` reports one violation at a time, so fixing the first-reported tag dimension can just surface a violation on a second dimension the pair also differs on. In this repo: a lib flagged for a `scope` violation was also mismatched on `platform` — retagging only `scope` would have re-triggered the same class of error on the next lint run; the fix retagged both dimensions in one pass.
- **Why it matters upstream**: Any claude-ts consumer using a multi-dimension tagging scheme (`scope`/`type`/`platform` or equivalent) with `@nx/enforce-module-boundaries` hits the identical one-violation-at-a-time reporting gap.
- **Suggested upstream change**: Add a note to the template's base `rules/architecture.md` Enforcement section: check `depConstraints` for ALL tag dimensions the flagged pair differs on before choosing a fix, not just the dimension named in the current lint error.
- **Status**: pending-port — blocked on the same structural platform-split as the kernel→contracts entry above (no Nx-tag/`depConstraints` system in CTS's current `rules/architecture.md` to attach this to).

---

## 2026-07-15 — Enhancement: `rules/task-authoring.md` — gitignored-tasks git-op guidance (project-local remainder)

- **Component**: `rules/task-authoring.md`
- **Type**: Enhancement
- **What happened**: Reinforced the existing "`tasks/` is gitignored, use plain `mv`/`rm`" guidance with the originating commit reference (`3476a45`) and the `git check-ignore -v` diagnostic tip. This is specific to this project's own `tasks/` gitignore decision (and its particular commit history), not a generic claude-ts pattern — it duplicates, with project-specific provenance, the general `./tasks/` routing convention already covered by (and ported alongside) the 2026-07-13 entry.
- **Why it matters upstream**: Doesn't — this is project-local by design. The generic "deferred-ADR closing step" half of this entry's original scope was already ported in the 2026-07-16 contribution round.
- **Status**: project-local-only

---
