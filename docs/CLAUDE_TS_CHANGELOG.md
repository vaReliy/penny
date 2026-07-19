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

## 2026-07-19 — Override: Angular CSS (Tailwind) replaces SCSS-only mandate

- **Component**: `rules/code-style-angular.md`, `rules/nx-generators.md`
- **Type**: Override
- **What happened**: Adopting Tailwind v4 (ADR-008) required a repo-wide flip from SCSS to plain CSS across all Angular projects (`apps/web` and feature libs `libs/identity/*`, `libs/budget/*`). Tailwind v4 explicitly does not work with CSS preprocessors and follows Angular's own official integration guide. Updated styling section in `code-style-angular.md` to mandate `.css` (not `.scss`), changed `nx-generators.md`'s "SCSS Only" section to "CSS (not SCSS)" with the rationale, and removed `--style=scss` instructions. Also updated `docs/SKELETON.md` (project-specific, non-template-inherited) to remove `--style=scss` from the Angular lib scaffold command and removed the post-gen "rename `.css` → `.scss`" instruction.
- **Why it matters upstream**: Any claude-ts consumer adopting Tailwind v4 (or any CSS-first framework that forbids preprocessors) for Angular will hit the identical need to flip these rules from SCSS-only to CSS-standard. The current template's SCSS-mandate default would conflict with Tailwind adoption.
- **Suggested upstream change**: For projects choosing to adopt Tailwind v4 or other preprocessor-incompatible styling frameworks, conditionally (or selectively in platform-specific `code-style-angular.md` if the template gains multi-platform split) override the styling section to mandate `.css` with a note: "Tailwind v4 does not work with CSS preprocessors — use plain CSS per Angular's official integration guide (see link to Angular docs)." For projects still using SCSS with other frameworks, the current SCSS-mandate continues to apply.
- **Status**: pending-port

---

## 2026-07-17 — Enhancement: `rules/code-style-angular.md` gained an Internationalization (Transloco) section

- **Component**: `rules/code-style-angular.md`
- **Type**: Enhancement
- **What happened**: The i18n-transloco-foundation task (T2, `ba`-planned) wired `@jsverse/transloco` into `apps/web` and needed a durable, discoverable convention doc for future `angular-developer` dispatches: scope-per-domain pattern (`provideTranslocoScope('<scope>')` co-located in `@Component.providers`), the file-placement convention (`apps/web/public/i18n/<scope>/<lang>.json`, reusing the existing static-asset copy path — no new Nx build wiring), full `<scope>.<key>` naming (scope providers do NOT auto-prefix template pipe keys — see the companion `docs/KNOWLEDGE_INBOX.md` entry on `TranslocoPipe.updateValue()`'s behavior), and the `TranslocoTestingModule` testing pattern (`<scope>/<lang>` module keys, double `detectChanges()`/`whenStable()` needed for pipe resolution). Landed as a new section in the file `AGENTS.md`'s on-demand rules index already points future agents to for Angular component-authoring conventions, rather than a new `docs/` file.
- **Why it matters upstream**: any claude-ts consumer adopting Transloco (or a similarly scope-based Angular i18n library) for the first time will hit the identical "which file documents the key convention" placement question and the identical scope-doesn't-auto-prefix-pipe-keys gotcha — worth a generic (non-Penny-specific) version of this section in the template's own Angular code-style rule, gated behind "if the project uses Transloco" framing since the base template shouldn't assume a specific i18n library choice.
- **Suggested upstream change**: add a generalized (library-choice-agnostic framing, or explicitly Transloco-scoped with a note that other i18n libraries would need their own section) "Internationalization" subsection to the template's `rules/code-style-angular.md`, covering: (1) scope-per-domain co-location pattern, (2) static-asset file placement reusing the existing Nx asset-copy convention rather than inventing new build config, (3) the full-scope-qualified-key-in-templates gotcha, (4) the testing-module setup pattern including the double-`detectChanges` requirement.
- **Status**: pending-port

---

## 2026-07-17 — Fix: phantom-baseline sync loss repaired via etalon; root cause and guards landed upstream

- **Component**: whole CTS payload (22 files: `CLAUDE.md`, `rules/workflow.md`, `rules/nx-generators.md`, `.claude/agents/{tester,backend-developer,angular-developer,qa,reviewer}.md`, `.claude/scripts/cts-sync.sh`, `.claude/skills/{cts-update,cts-contribute,distill-inbox,github-actions}`, `.prettierignore`, `rules/shell-scripting.md` (new), hand-merges into `.ctsignore`'d `AGENTS.md`/`rules/architecture.md`/`rules/code-style.md`)
- **Type**: Fix
- **What happened**: this project's `.cts-version` (`6cbf33b`) recorded content that was never actually received — the "undocumented local simplifications (dropped Tiered Planning Ladder, handoff hard-stop, Generation damping)" admitted in the 2026-07-16 entry above were not intentional simplifications but a **phantom baseline** from round-4's mis-resolved sync conflicts. Every later 3-way merge treated the gap as deliberate local deletion; prettier renormalize (`proseWrap: never` reflow on both sides) suppressed the conflicts that would have exposed it. Repaired directly against the etalon classification (`claude-ts/tmp/cts-update-etalon-classification.md`), not via engine re-run (a merge can never restore phantom-deleted content). AC1–AC6 verified: 125 payload files byte-identical to `7385cef`, all local keeps preserved (7 penny-invented `rules/workflow.md` sections incl. `### CI scoping`, Mongo/Angular/LIVR wording, ADR-005 refs).
- **Why it matters upstream**: any consumer whose stamp advances past received content silently loses features forever; two other consumers' worth of guards now exist.
- **Suggested upstream change**: already implemented in the local `claude-ts` working tree this same session — `baseline_audit()` (`BASELINE INTEGRITY:` lines) + raw-merge cross-check (`MERGE CROSS-CHECK:` lines) in `cts-sync.sh`, blocking triage rules in `cts-update/SKILL.md`, regression tests (cases 6/7), validated against this repo's pre-repair HEAD (`df08687`).
- **Status**: ported (in local claude-ts working tree, pending commit there)

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
