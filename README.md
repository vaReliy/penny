# Penny

A personal family platform — budget tracking first, more household domains later. The
project is being rebuilt clean-sheet on an Nx monorepo (Angular + NestJS, shared libs).

This branch (`skeleton`) is the empty, domain-free foundation: tooling and a trivial
auth-gated "hello world" slice, nothing product-specific yet.

## Prerequisites

- Node 22 (pinned in `.nvmrc`)
- pnpm (pinned via `packageManager` in `package.json`; run `corepack enable` to pick it up)

## Getting started

```
pnpm install
pnpm nx report
```

No apps exist yet — they're added in subsequent rebuild tasks.

## Rebuild planning

Design decisions and task breakdown live in `docs/rebuild/` (private, git-excluded).
