# E2E Testing & Playwright

This rule covers end-to-end testing patterns and QA-layer browser automation for this project. See `rules/cts/testing.md` for general testing conventions and Vitest unit-test patterns.

## Angular/Playwright Component-to-E2E Interop Gotchas

Four non-obvious compatibility gotchas surfaced while writing tests for the `libs/shared/web-shell` shell component and its e2e coverage:

### 1. `[routerLink]` does not persist as a DOM attribute at runtime

`[routerLink]` does not appear in the runtime DOM as an attribute — `querySelectorAll('a[routerLink]')` always returns 0 matches. In component specs testing router-link elements, use structural/positional selectors instead (`nav > a`, or a container-scoped plain `a`).

### 2. `RouterTestingHarness.navigateByUrl()` returns the component instance, not the harness

`RouterTestingHarness.navigateByUrl(url, ComponentType)` returns the _component instance_, not a `ComponentFixture` or the harness itself. Methods like `whenStable()` and `detectChanges()` live on `harness.fixture`, not on the returned value. Easy typo: `TypeError: fixture.whenStable is not a function` when calling them on the component instance instead.

### 3. Playwright `devices['...']` presets cannot be applied via `test.use()` inside a `describe` block

Playwright's predefined device presets (e.g., `devices['Pixel 5']`) set `defaultBrowserType` as a module-level side effect and cannot be applied via `test.use()` inside a `describe` block (Playwright throws "forces a new worker" error). Only top-level test-file scope or the config's `projects` array accept these presets. For a mobile-viewport-only smoke test layered onto existing chromium/firefox/webkit projects, use `test.use({ viewport: { width, height }, hasTouch: true })` instead to set viewport dimensions and touch support without touching the browser type.

### 4. Mocked auth endpoints must flip to 401 when logout is called

An e2e logout-flow test that mocks `/auth/me` unconditionally will deadlock: the logout endpoint hits the API, but `/login`'s `loginGuard` then re-checks `/auth/me` and bounces an apparently-still-active user straight back. The test hangs waiting for `page.waitForURL('**/login')`. Fix: the mock must flip to 401 once the logout endpoint is actually hit, simulating real session invalidation. The guard will then accept the redirect and the test continues.

## QA Browser-Driving Gotchas

### Role query races Tailwind breakpoint reflow after navigation

During live browser QA, `page.getByRole('navigation', {name: ...})` can intermittently return 0 or 2 matches (instead of the correct 1) when queried immediately after `page.waitForURL()` — the query races Tailwind's `hidden`/`lg:flex` breakpoint-driven reflow before Angular's zone has stabilized. Adding `page.waitForLoadState('networkidle')` (or an equivalent explicit wait) after navigation and before role-querying nav elements fixes the race. This is especially pronounced in Tailwind-breakpoint-driven layouts where the visibility changes along with other layout reflow.

### QA agent Playwright fallback requires file-tree placement

The `qa` agent sessions have no Playwright MCP tools exposed; the confirmed fallback is a scratch `@playwright/test` Node ESM script. This script must be placed **inside the repo tree** (not in a scratchpad dir outside it) because Node's module resolution walks up from the script's own file path, not from `cwd` — without repo access via its own location, imports fail even when the same paths resolve fine from a different working directory. Copy the script into the repo, run it, delete it after use.

## Nx Playwright Target Discovery & Configuration

### Atomized Playwright targets are discoverable, never guessed

Running a single e2e spec through Nx requires discovering the exact atomized target string. Run `nx show project <e2e-app> --json` and look under `metadata.targetGroups` for the entry named like `e2e-ci--src/<file>.spec.ts`. Do not guess the target name — guessing produces a "target not found" error, and worse, `nx affected -t <name>` silently skips projects lacking the named target with no warning. A wrong guess in CI can read as a pass when the test was never run.

### ESLint rules make natural null-check patterns conflict with lint

Both `playwright/no-conditional-in-test` and `no-non-null-assertion` fire on the natural `boundingBox()` null-check idiom (the property can be null if the element is not visible). Once visibility has already been asserted via `isVisible()` or similar, use `evaluate()` with `getBoundingClientRect()` instead of the direct `boundingBox()` call — this sidesteps both rules while still checking the property you need.

### E2E projects lack `typecheck` targets

`web-e2e` (and any Playwright-only Nx project) has no `typecheck` target in its target list — confirmed via `nx show project web-e2e --json`. A TypeScript compile error inside a `.spec.ts` file (e.g., passing an option key to `getByRole` that the installed `playwright-core` version doesn't support) is invisible to `lint`, invisible to the e2e test run itself (Playwright's runtime role engine silently ignores unknown option keys), and stays invisible indefinitely since nothing in the existing verification gate runs `tsc` against this project. This is a standing gap: any Playwright-only Nx project should ideally get a `typecheck` target added so type errors in spec files don't go permanently undetected (see `rules/cts/nx-generators.md` § 6 for the pattern).
