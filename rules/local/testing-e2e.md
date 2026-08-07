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

`page.getByRole('navigation', ...)` can intermittently return 0 or 2 matches when queried immediately after `page.waitForURL()` — the query races Tailwind's `hidden`/`lg:flex` breakpoint-driven reflow before Angular's zone has stabilized.

**Fix:** use retrying assertions (e.g. `expect(desktopLocator.or(mobileLocator)).toBeVisible()`) to wait for the reflow to settle; **do not** use `page.waitForLoadState('networkidle')` or bare `locator.isVisible()` (no-arg, non-retrying snapshot). The `no-networkidle` lint rule exists for a reason — `networkidle` is fragile and expensive. Once the retrying assertion has resolved the race, subsequent `isVisible()` calls are safe, since the reflow is settled.

### Playwright API compatibility gotchas

`getByRole` options type has no `current` filter; use `toHaveAttribute('aria-current', ...)` instead. Playwright's glob route patterns anchor at the end — a bare path never matches a URL with query string (use `'**/api/path*'` to cover `?query` variants).

### Avoid `getByLabel` in favor of `getByRole` for selects

`getByLabel(text, {exact:true})` can hang indefinitely on an implicit-wrap `<label><span>…</span><select>…</select></label>` structure, even with a confirmed-present accessible name. Use `getByRole('combobox', {name, exact:true})` instead — same accessible-name matching, no hang, and a more precise locator for `<select>` anyway.

### Bottom-sheet overlay requires explicit dismiss before list interaction

The history screen's mobile filter bottom-sheet (`div.fixed.inset-0.z-20` overlay) does not auto-close on filter selection. The underlying transaction list stays present but non-interactive (pointer events intercepted by the still-open overlay) until the user dismisses the sheet via backdrop or button. A test selecting a filter then clicking a list row must dismiss the sheet first — since "Готово" appears as both the backdrop's `aria-label` and an in-sheet button, locators must be scoped (e.g. `.last()` or a more specific selector) to avoid strict-mode ambiguity.

### QA agent Playwright fallback requires file-tree placement

The `qa` agent sessions have no Playwright MCP tools exposed; the confirmed fallback is a scratch `@playwright/test` Node ESM script. This script must be placed **inside the repo tree** (not in a scratchpad dir outside it) because Node's module resolution walks up from the script's own file path, not from `cwd` — without repo access via its own location, imports fail even when the same paths resolve fine from a different working directory. Copy the script into the repo, run it, delete it after use.

## Nx Playwright Target Discovery & Configuration

### Atomized Playwright targets are discoverable, never guessed

Running a single e2e spec through Nx requires discovering the exact atomized target string. Run `nx show project <e2e-app> --json` and look under `metadata.targetGroups` for the entry named like `e2e-ci--src/<file>.spec.ts`. Do not guess the target name — guessing produces a "target not found" error, and worse, `nx affected -t <name>` silently skips projects lacking the named target with no warning. A wrong guess in CI can read as a pass when the test was never run.

### CLI dev-auth for real authenticated Playwright sessions

To verify a fix against the real API (not route-mocked), the README's "Local dev auth" section documents `dev:create-user` and `dev:token` CLI commands. These produce a `token` + `XSRF-TOKEN` pair injectable via `context.addCookies([{name:'token',...,httpOnly:true},{name:'XSRF-TOKEN',...}])` before first navigation, giving a fully real, authenticated, non-mocked browser session. This is the correct pattern for any unmocked e2e/QA regression pass in this repo and a good candidate for permanent real-backend regression specs alongside existing mocked specs.

### ESLint rules make natural null-check patterns conflict with lint

Both `playwright/no-conditional-in-test` and `no-non-null-assertion` fire on the natural `boundingBox()` null-check idiom (the property can be null if the element is not visible). Once visibility has already been asserted via `isVisible()` or similar, use `evaluate()` with `getBoundingClientRect()` instead of the direct `boundingBox()` call — this sidesteps both rules while still checking the property you need.

### OnPush component's signal effect()-driven form reset races in fast multi-submit

A component that resets its form via a signal `effect()` after successful submit can have the next submission's field selection clobbered by the reset race window in scripted tests. Fast Playwright specs executing back-to-back submits can cross a window far below human reaction time. Fix: add an explicit wait (retrying `expect`) for the form field to return to its reset state before starting the next submission — never a bare `sleep()`.

### Route mocks must match actual DTO types

E2E route mocks must be checked against the actual DTO/response type consumed by the component, not just visible assertion text. A field-name typo in a mock silently produces a runtime `undefined` with no compile-time signal (Playwright mocks aren't type-checked against the real API response type). Verify mock object shape against source-of-truth interface.

### E2E projects lack `typecheck` targets

`web-e2e` (and any Playwright-only Nx project) has no `typecheck` target in its target list — confirmed via `nx show project web-e2e --json`. A TypeScript compile error inside a `.spec.ts` file (e.g., passing an option key to `getByRole` that the installed `playwright-core` version doesn't support) is invisible to `lint`, invisible to the e2e test run itself (Playwright's runtime role engine silently ignores unknown option keys), and stays invisible indefinitely since nothing in the existing verification gate runs `tsc` against this project. This is a standing gap: any Playwright-only Nx project should ideally get a `typecheck` target added so type errors in spec files don't go permanently undetected (see `rules/cts/nx-generators.md` § 6 for the pattern).
