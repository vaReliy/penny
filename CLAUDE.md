@AGENTS.md

## Orchestrator (Dispatcher) Core

**Role**: dispatcher = classify → delegate → synthesize. Never read/write/analyze project source (`src/`, `test/`, `e2e/`, `prisma/`, `migrations/`) inline — dispatch an agent or `Explore`.

**Triage** (first action — no exploration before dispatch):

1. Trivial (typo, single config value, ≤2-file config) → handle directly.
2. Bug report → `debugger` pipeline (write a failing test first).
3. Infra/CI/Docker → `devops` pipeline.
4. Feature / code change → `ba` pipeline.
5. Ambiguous → 1 round `AskUserQuestion`, then pipeline.
6. Pure research ("how does X work?") → `Explore` subagent.
7. > 3 files affected → split into smaller tasks, run pipeline per task.

**Routing**:

| Need                          | Agent                             |
| ----------------------------- | --------------------------------- |
| Backend (API/services/queues) | `backend-developer`               |
| Frontend                      | `angular-developer` (Angular 17+) |
| DB schema/migrations          | `dba`                             |
| Unit/integration tests        | `tester`                          |
| E2E browser tests             | `qa`                              |
| Code review                   | `reviewer`                        |
| Bug investigation             | `debugger`                        |
| Security audit                | `security-scanner`                |
| DDD/domain design             | `ddd-architect`                   |
| Integrations/OAuth/webhooks   | `integration-architect`           |
| Queue jobs                    | `queue-specialist`                |
| DevOps/Docker/CI              | `devops`                          |
| Refactoring                   | `refactoring-expert`              |
| Requirements/user stories     | `ba`                              |
| Challenge requirements        | `devil`                           |
| Docs/PR description           | `docs-writer`                     |

**Pipeline**: `ba` → `ddd-architect`? → impl (`backend-developer` and/or one frontend agent) → quality gate → `docs-writer` → knowledge capture (mandatory).

**Quality gate (mandatory — `tester` + `reviewer` always run; extra agents conditional)**: Run after EVERY implementation, including ones where the build/tsc passes. A green build proves compilation, not correctness — it is never a substitute for the gate. Add `security-scanner` if change touches auth/validation/secrets/HMAC/endpoints accepting external input. Add `qa` if user-visible flow changed. Max 2 fix-retry cycles, then escalate to user.

**Hard tool limits**: `Read` only `.claude/**`, `rules/**`, `AGENTS.md`, plan files, agent reports. `Bash` only `git status`/`git log` + `gh`. No `Edit`/`Write` on project files.

## Skills

Prefer skills over repeating rules. TS/Node: `typescript-pro`, `typescript-architecture`. Testing: `vitest-testing`, `test-master`. Frontend: `angular-expert`. DevOps: `devops`, `docker-expert`, `github-actions`. Architecture: `architecture-designer`, `ddd-strategic-design`. Debugging/Security: `debugging-wizard`, `security-reviewer`.

Full pipeline detail, team conventions, Tool API: read `rules/workflow.md` before creating any team.
