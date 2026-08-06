## Overrides AGENTS.md § "Stack"

Node.js 22+ · TypeScript 5 (strict) · NestJS (API + CLI) · Angular 17+ (standalone components, signals) · MongoDB + Mongoose/Typegoose · LIVR validation (`js-validator-livr`) · pnpm (exact pins) · Vitest · Playwright · BullMQ · Docker

## Overrides AGENTS.md § "Code Style Essentials"

- `.js` extensions in relative imports — enforced **backend-only** via ESLint; resolver is `bundler`, not NodeNext.

## Extends AGENTS.md § "On-Demand Rules Index"

Project-only rule splits (not CTS payload — never synced, never overwritten):

- `rules/local/task-authoring.md` — atomic/pointable acceptance criteria, parity-task obligations, legacy-source verification
- `rules/local/architecture-backend.md` — NestJS dependency injection, MongoDB patterns, error handling
- `rules/local/architecture-angular.md` — Angular injection tokens, lazy-load boundaries, dev-server proxy
- `rules/local/code-style-backend.md` — backend config, validation, logging, auth/cookies, error handling
- `rules/local/code-style-angular.md` — Angular signals, toSignal, templates, SCSS, forms, accessibility

CTS-managed rules with broadened retrieval triggers (on-demand index descriptions narrower than actual rule scope):

- `rules/cts/task-authoring.md` — **broadens AGENTS.md's index line for this file.** Trigger is not just "emitting backlog task files from plan/grill/grooming sessions" — it also covers any filesystem operation on an already-authored task file: moving (e.g. to `done/`), copying, renaming, or deleting anything under `tasks/`. Always use plain `mv`/`cp`/`rm`, never a `git`-prefixed variant (`tasks/` is gitignored).
- `rules/cts/docs-style.md` — **broadens AGENTS.md's index line for this file.** Trigger is not just "no manual prose wrapping / Prettier" — this file also contains § "Committed files never cite task files or decision IDs," a rule with no mention in the current index line at all. Before writing or editing ANY committed doc (this applies to the orchestrator's own direct writes too, e.g. mid-pipeline transcription entries in `docs/KNOWLEDGE_INBOX.md`, not just dispatched-agent writes), check that draft text doesn't cite a task filename, gitignored `tasks/` path, or a bare decision ID.
