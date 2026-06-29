## Stack

Node.js 22+ · TypeScript 5 (strict) · NestJS (API + CLI) · Angular 17+ (standalone components, signals) · MongoDB + Mongoose/Typegoose · LIVR validation (`js-validator-livr`) · pnpm (exact pins) · Vitest · Playwright · BullMQ · Docker

## Git Safety

- Never auto-commit — only when explicitly requested.
- Never push to remote without explicit request.
- Never force-push or run destructive git commands without explicit approval.
- Never mention AI tools in PR title/body. Show `git diff`/`git status` before committing.

PR description rules: `rules/git-operations.md`.

## Code Style Essentials

- Strict TS, no `any` — use `unknown` + narrow.
- `.js` extensions in relative imports — enforced **backend-only** via ESLint; resolver is `bundler`, not NodeNext. `type` imports for types/interfaces.
- Named exports only; barrel exports via `index.ts`.
- Files kebab-case; classes/types/interfaces PascalCase; `I`-prefix for repo/service abstractions.
- Constants SCREAMING_SNAKE_CASE; enums as `as const` objects.
- No magic numbers — named constants with JSDoc.
- Comments are the exception: write one only when the WHY is non-obvious and cannot be expressed through renaming. Never reference task IDs, decision IDs, or task file paths in comments (`D9`, `task 11`, etc.) — these go stale. Use `// TODO:` / `// FIXME:` for deferred work with a self-contained description; remove them once the work is done.
- **Exact-pin all `package.json` deps** — no `^` or `~` ranges, ever (dependencies, devDependencies, peerDependencies). Audit after every `pnpm add` / generator run. Full procedure: `rules/dependencies.md`.

Details: `rules/code-style.md`.

## Verification Commands

**Before running any build, test, lint, or type-check command, read `rules/workflow.md` § "Command Execution Policy (Nx Targets)".** That section is the single source of truth for the ✅/❌ command table, useful flags, and project names. Never use raw tool invocations (`tsc`, `eslint`, `vitest`, `webpack`, `playwright`) — always use `nx` targets.

## Model Tiers

Generic tiers used across rules and task files; each AI vendor maps them to concrete models.

| Tier     | Use for                                                               | Claude mapping |
| -------- | --------------------------------------------------------------------- | -------------- |
| deep     | Rare cascading decisions (architecture), hardest root-cause debugging | opus           |
| standard | Implementation, review, tests, requirements, security checklists      | sonnet         |
| cheap    | Mechanical/template work: docs, config edits, deletions               | haiku          |

Other vendors (Gemini, Codex, Copilot): mappings added when those tools are actually used.

## On-Demand Rules Index

Read when relevant (never preloaded):

- `rules/workflow.md` — before creating teams / running pipelines
- `rules/architecture.md` — layer placement questions, NX boundaries, platform/scope isolation
- `rules/architecture-angular.md` — Angular injection tokens, lazy-load boundaries, dev-server proxy
- `rules/architecture-backend.md` — NestJS dependency injection, MongoDB patterns, error handling
- `rules/code-style.md` — shared TypeScript conventions (strict mode, naming, imports, comments)
- `rules/code-style-angular.md` — Angular signals, toSignal, templates, SCSS, forms, accessibility
- `rules/code-style-backend.md` — backend config, validation, logging, auth/cookies, error handling
- `rules/testing.md` — writing/structuring tests
- `rules/task-authoring.md` — emitting backlog task files from plan/grill/grooming sessions
- `rules/validation-authorization.md` — input validation, guards
- `rules/migrations-queue.md` — ORM migrations, BullMQ jobs
- `rules/docker-commands.md` — running anything in containers
- `rules/mcp-stack.md` — MCP tool selection
- `rules/git-operations.md` — PR description rules
- `rules/nx-generators.md` — after running ANY `nx g …` generator (apps, libs, configs)
- `rules/dependencies.md` — adding/updating/removing npm deps; auditing generator-injected ranges
- `README.md` — setup, install profile, common commands
- `docs/KNOWLEDGE_INBOX.md` — append-only inbox for durable-but-unplaced learnings; any AI tool working in the repo may append entries in the 3-line format from `rules/workflow.md`'s Knowledge Inbox section, which also defines the distillation policy

## Setup

See `README.md` for system requirements, installation, the install profile (pruning agents/skills you don't need), and common commands.
