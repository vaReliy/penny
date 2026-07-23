## Overrides AGENTS.md § "Stack"

Node.js 22+ · TypeScript 5 (strict) · NestJS (API + CLI) · Angular 17+ (standalone components, signals) · MongoDB + Mongoose/Typegoose · LIVR validation (`js-validator-livr`) · pnpm (exact pins) · Vitest · Playwright · BullMQ · Docker

## Overrides AGENTS.md § "Code Style Essentials"

- `.js` extensions in relative imports — enforced **backend-only** via ESLint; resolver is `bundler`, not NodeNext.

## Extends AGENTS.md § "On-Demand Rules Index"

Project-only rule splits (not CTS payload — never synced, never overwritten):

- `rules/architecture-backend.md` — NestJS dependency injection, MongoDB patterns, error handling
- `rules/architecture-angular.md` — Angular injection tokens, lazy-load boundaries, dev-server proxy
- `rules/code-style-backend.md` — backend config, validation, logging, auth/cookies, error handling
- `rules/code-style-angular.md` — Angular signals, toSignal, templates, SCSS, forms, accessibility
