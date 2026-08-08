# Angular Code Style

See also: `docs/guides/frontend-feature.md` for the complete pattern flow from contract → data layer → UI → feature page → route, with worked examples from the four shipped budget screens.

## Standalone Components

- All new Angular components must be standalone — no NgModules for new code
- Use `<script setup>` in component files (TypeScript strict, no `any`)

## Route Guards

### CanActivateFn with zero parameters avoids lint noise

The `@typescript-eslint/no-unused-vars` rule (configured with `args: "after-used"` — Nx default) warns on unused function parameters. In a `CanActivateFn`, when neither `route` nor `state` is needed, declaring underscore-prefixed params (`_route`, `_state`) still triggers warnings. TypeScript structural typing allows a narrower signature:

```typescript
// ✓ Avoids unused-variable warnings
export const myGuard: CanActivateFn = (): Observable<boolean | UrlTree> => {
  return of(true);
};

// Only add parameters if actually consumed:
export const myGuard: CanActivateFn = (route): Observable<boolean | UrlTree> => {
  const id = route.paramMap.get('id');
  return of(!!id);
};
```

The router call site passes arguments at runtime regardless of the function signature.

## Dependency Injection

Prefer `inject()` function over constructor injection:

```typescript
// Prefer
export class GreetingComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly cdr = inject(ChangeDetectorRef);
}

// Avoid
export class GreetingComponent {
  constructor(
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
  ) {}
}
```

## Signals and Reactive State

### Using `toSignal()` for Observable-based data

Use `toSignal()` at field declaration level for Observable-based data — this is the target pattern in Angular 17+. For cold observables (HTTP requests, NEVER), you **must** add `startWith(initialValue)` **before** `catchError` to guarantee a synchronous first emission (required by `requireSync: true`).

```typescript
readonly greeting = toSignal(
  this.greetingService.greeting$().pipe(
    // Guarantee sync emission for cold observable
    startWith({ kind: 'loading' as const }),
    catchError(err => {
      this.logger.error(err);
      return of({ kind: 'error' as const, message: 'Failed to load' });
    }),
  ),
  { requireSync: true },
);
```

**Order matters**: `map → startWith → catchError`. If `startWith` comes after `catchError`, an error thrown before any emission still violates the sync requirement.

### `ngOnInit` is acceptable (not deprecated)

For simple Observable-based data fetching in `ngOnInit`, assigning to a property is correct and testable:

```typescript
ngOnInit() {
  this.greeting$ = this.greetingService.greeting$();
}
```

This is a valid pattern and is NOT being phased out. Do NOT mix `ngOnInit` and `toSignal()` in the same component — choose one.

### `@let` in templates for signal narrowing

Call signals once at the template top-level using `@let` to enable type narrowing:

```html
@let state = mySignal(); @if (state.kind === 'success') {
<p>{{ state.message }}</p>
} @else if (state.kind === 'error') {
<p class="text-red-500">{{ state.error }}</p>
}
```

Why: Calling `state().kind` twice in a template means TypeScript cannot narrow the union type across separate calls. `@let state = mySignal()` binds once, enabling narrowing.

**Never mix `*ngIf` / `*ngFor` structural directives with `@if` / `@for` block syntax in the same template.** Prefer the block syntax (`@if`, `@for`, `@switch`) in all new code — it is the Angular 17+ standard. Remove `*ngIf`/`*ngFor` when editing existing templates.

## Page-Level State & Error Surfacing

### A binary `loading|error|ready` page `state()` cannot express post-`ready` partial failure

A page-level `state()` computed that resolves to `'loading' | 'error' | 'ready'` models _initial load_ only. Once the page has reached `'ready'`, a failed action (refresh, form submit, etc.) has nowhere to surface, and the template silently renders stale data with no indication anything failed.

Partial/refresh failure after first success is a per-action concern: each store operation (`CategoryStore.create/update/archive`, `TransactionStore.record`) already exposes its own `loading`/`error` signal pair (one `BudgetRequestState` instance per operation). Bind directly to the operation's own error signal at the component that owns that affordance (submit button, form, dialog), surfacing it as a `role="alert"` inline next to that action without blanking any other part of the page. Never fold per-action errors back into a page-level `state()` computed.

## Routing

### `routerLinkActive` must not coexist with a static class on the same CSS property

Tailwind compiles utilities to same-specificity single-class selectors, so when a static class and a conditionally-applied class both target the same CSS property on the same element, whichever rule appears later in the _compiled stylesheet_ wins — not whichever class is later in the element's `class` list. Binding to `isActive` via template ref + `[ngClass]` ensures exactly one class per property is present at any moment, removing cascade-order ambiguity.

```html
<!-- ✓ Correct — bind to isActive via template ref, one class per property present at a time -->
<a routerLink="/dashboard" routerLinkActive #rla="routerLinkActive" [ngClass]="rla.isActive ? 'bg-primary text-primary-contrast' : 'text-text-secondary hover:bg-background'">Dashboard</a>
```

This is the canonical `routerLinkActive` pattern — never pass classes as the directive's string value alongside static classes on the same element.

## Template Type-Checking Workarounds

### Discriminated-union narrowing in templates

Strict template type-checking does not propagate `@if` condition narrowing into interpolations:

```typescript
// ❌ Fails type check even though narrowed at runtime
@if (state().kind === 'success') {
  {{ state().message }}  // Error: 'message' not on error variant
}

// ✅ Correct: expose a typed computed signal
readonly successMessage = computed(() =>
  this.state().kind === 'success' ? this.state().message : null
);
```

Use a computed signal instead of `$any()` casts to preserve strict mode.

## Styling

- All Angular style files use plain CSS (not SCSS) — Tailwind v4 does not work with CSS preprocessors (see ADR-008)
- File extension: `.css` not `.scss`
- When generating components via `nx g @nx/angular:component`, do not pass `--style=scss` (let the generator default to CSS)
- After generation, verify `styleUrl` / `styles` references use `.css`

### Flex `min-w-0` for content-heavy children

A flex item's default `min-width: auto` prevents it from shrinking below its content's intrinsic width. In a `flex-row` layout with content-heavy children (text lists, charts, tables), add an explicit `min-w-0` on the child to permit shrinking within the remaining space — otherwise overflow can occur even when the flex container has space available.

### Breakpoint consistency with web-shell

Any screen that renders separate mobile/desktop branches (bottom-sheet vs. rail, list vs. table) must reuse the exact same Tailwind breakpoint token as `libs/shared/web-shell`'s nav toggle. Mismatched breakpoints create an overlap window where the screen and nav are out of sync, producing real interaction defects (pointer events still intercepted, overflow undetected).

Example:

```typescript
@Component({
  selector: 'app-greeting',
  styleUrl: './greeting.component.css', // ✓ must be .css
  template: `...`,
  standalone: true,
})
export class GreetingComponent {}
```

### Tailwind v4 color token names in this repo

This repo's `@theme` block defines color tokens as `from-primary-from`, `to-primary-to`, and `text-on-primary` — NOT the pattern `bg-primary`/`text-primary-contrast` common in other codebases. Bare intuitive guessing of these names produces unstyled components with no build error (Tailwind simply does not emit a utility class for a non-existent token). Always grep the actual token names in `apps/web/src/styles.css` when styling a new component.

### Tailwind v4 @theme token migration

When renaming or removing `@theme` custom properties (e.g., `--radius-sm` → `--radius-card`, dropping `--shadow-card`), Tailwind v4 does **not** error when a utility class corresponding to the removed property is still present in a template — it silently falls back to Tailwind's built-in default value instead (e.g., `rounded-sm` reverts to Tailwind's stock 0.25rem). Neither `nx build` nor typecheck catches this.

**Mitigation:** when renaming/removing `@theme` tokens, grep the entire workspace not just for the old CSS custom-property names (e.g., `--radius-sm`), but for the **old utility class names** themselves (e.g., `rounded-sm`, `rounded-md`, `rounded-lg`, `shadow-card`, etc.). The utility class names are the only remaining trace once the property is gone. Example grep patterns:

```bash
# After removing --radius-sm/md/lg in favor of --radius-card/btn/tile
grep -r "rounded-sm\|rounded-md\|rounded-lg" apps/web libs/ --include="*.html" --include="*.ts"
grep -r "shadow-card" apps/web libs/ --include="*.html" --include="*.ts"
```

This is especially important if a token-migration task was split across multiple feature/screen tasks — the first task may complete the token replacement in templates it touched, but templates added later (in parallel or subsequent tasks) may still reference the old class names, producing silent visual regressions.

## Forms

- Use Reactive Forms for forms with validation
- Typed validators: avoid loose `any` types on form state
- Validate at form-level using `FormGroup.setErrors()` after async backend checks

## HTTP Client

- Use typed `HttpClient.get<T>()` responses
- Avoid `any` — define DTOs for every endpoint response
- Error handling: pipe errors through `catchError`, never suppress with `|| null`

## Global Interactive Element Styling

Add one rule to `apps/web/src/styles.css`'s `@layer base` covering all interactive elements (never use `--apply` or component-level classes):

```css
button:not(:disabled),
[role='button']:not([aria-disabled='true']),
a[href],
select:not(:disabled),
input[type='checkbox']:not(:disabled),
input[type='radio']:not(:disabled),
label:has(input[type='checkbox']:not(:disabled)),
label:has(input[type='radio']:not(:disabled)) {
  cursor: pointer;
}

button:disabled,
[role='button'][aria-disabled='true'],
select:disabled,
input[type='checkbox']:disabled,
input[type='radio']:disabled {
  cursor: not-allowed;
}
```

This covers all existing screens with a single global rule. Note: native checkboxes and radios have no pointer cursor by default in any browser and require explicit styling. Use `label:has(input)` because this codebase wraps inputs inside labels (implicit association) rather than pairing by id.

## Currency Display

### bigint-exact currency conversion for display: parse the decimal rate as an exact fraction, never through `Number`

Any display-value conversion between currencies must stay entirely in `bigint` — never round-trip the decimal-string rate through `Number`/`parseFloat`. Split the rate string into `{numerator, denominator}` by string manipulation, then compute the foreign value entirely in `bigint`, using round-half-away-from-zero. This pattern only holds when both currencies share a minor-unit decimal count (true for UAH/USD/EUR at 2 decimals).

This is the frontend/display-value counterpart of the backend bigint-percent pattern — see `rules/local/code-style-backend.md` for the backend equivalent.

## Subscription Cleanup

Use `takeUntilDestroyed()` to prevent subscription leaks:

```typescript
private readonly destroy$ = new Subject<void>();

ngOnInit() {
  this.data$
    .pipe(takeUntilDestroyed())
    .subscribe(data => {
      this.data = data;
    });
}
```

Or use Nx's `inject(DestroyRef).onDestroy()` pattern for functional cleanup.

## Content Security Policy

### CSP nonce injection in Angular

The CSP nonce DI token exported by `@angular/core` is `CSP_NONCE` (not `NgCspNonce`, which is an internal directive class). When per-request nonces are delivered (e.g., via nginx `sub_filter` or NestJS middleware), provide the nonce to the Angular bootstrap using `useFactory` (not `useValue`):

```typescript
import { bootstrapApplication, CSP_NONCE } from '@angular/core';

bootstrapApplication(AppComponent, {
  providers: [
    {
      provide: CSP_NONCE,
      useFactory: () => document.querySelector('meta[name="csp-nonce"]')?.getAttribute('content'),
    },
  ],
});
```

Use `useFactory` (lazy-evaluated during DI resolution) rather than `useValue` (eagerly evaluated at config time) to ensure the DOM is ready when the nonce is retrieved.

### A CSP nonce cannot authorize an inline event handler (`onload=`)

Production CSS activation was "fixed" by injecting the per-request nonce into the `onload="this.media='all'"` attribute on Angular's async-CSS `<link>`, alongside the existing `csp-nonce` meta injection. Running the real production image against a real Chromium showed the original violation still firing verbatim, and the stylesheet `<link>` still sitting at `media="print"` — the handler never executed, so a fully-loaded stylesheet applied to nothing on screen.

Root cause is a CSP-spec property, not a config error: nonces whitelist `<script>`/`<style>` elements; inline handler attributes are governed separately and are enabled only by `'unsafe-inline'` or `'unsafe-hashes'` plus a hash. Chrome's own violation text says so ("hashes do not apply to event handlers … unless the `'unsafe-hashes'` keyword is present"). General principle: when a CSP violation names an inline event handler, adding a nonce anywhere will never fix it; the fix is to remove the handler (for this pattern, Angular's `optimization.styles.inlineCritical`) or to explicitly opt into `'unsafe-hashes'`.

## Accessibility

- Semantic HTML in templates — use `<button>`, `<a>`, `<header>` not divs with role hacks
- ARIA labels via `[attr.aria-label]` binding on custom components
- Keyboard navigation on all interactive elements
- WCAG AA contrast ratios
- Angular CDK `a11y` utilities for focus management

### Form labels and simultaneous component instances

When a component may render more than once in the same DOM tree simultaneously (mobile bottom-sheet + desktop rail, repeated list-item forms), use implicit label wrapping (`<label><span>text</span><select>...</select></label>`) instead of explicit `id`/`for` pairs. Duplicate DOM ids are invalid HTML; browsers silently resolve them, so whichever instance's id resolves second loses its label association.

### ARIA attribute pairing when clamping

When clamping one ARIA progress attribute (e.g., `aria-valuenow` when it could exceed 100), bind the paired attribute (e.g., `aria-valuemax`) to the same constant instead of leaving it as a static literal. This prevents independent drift — both ends of the ARIA min/max pair must be synchronized.

### ngx-charts constraints

**Legend overshoot**: ngx-charts' legend can overshoot its computed container width by a few pixels, triggering page-level horizontal scroll at narrow viewports. Contain it by applying `overflow-hidden` on the chart's outer container.

**PieChart sizing**: Never bind `[view]` for a `PieChartComponent` or leave it unset without explicit CSS sizing on its immediate parent. The chart measures its host parent's `getBoundingClientRect()` when `[view]` is unbound, so wrap it in a sized container (e.g. `h-56 w-full`). Do not use ngx-charts' built-in `legendPosition: 'below'` (it does not reduce the ring's height) — hand-roll a legend as a flex sibling instead. Use explicit `[customColors]` on dark backgrounds; the default color schemes produce near-identical pale shades.

## Budget Contracts Naming Convention

The budget contracts library (`libs/budget/contracts`) exports types as `*Request`/`*Response`/`*Query`/`*Entry`, NOT the pattern `*Dto` despite files being named `*.dto.ts`. When citing or using budget contract types, grep the actual export names from the source file — do not infer from the filename.

## Error Object Translations

Error objects returned from API/service layers must carry a translation key, never a display string. Bare interpolations like `{{ error.message }}` are invisible to i18n audits (no string literal in the template, no audit signal), so untranslated English errors reach users despite a 100%-passing i18n check. Define error objects with a `kind` or `code` enum that maps to Transloco keys rather than storing display text in the object.

This applies across component boundaries too: an error prop passed child→parent (or parent→child) for display must carry the translation key, not a resolved message string. Localizing `BudgetApiError.kind`-driven error text, `PlannerCategoryRowComponent` originally received the error as an already-resolved English `message` string via `@Input`. Resolving the message in the parent and handing a plain string down would have permanently baked in one locale, since the child has no way to re-resolve it on a later language switch. Fix: changed the `@Input` contract to carry the translation key (`errorMessageKey: string | null`) instead, and pipe it through `transloco` in the child's own template — consistent with the rest of this codebase, which has no `TranslocoService` injected anywhere and is pipe-based throughout. Any error/message value crossing a component boundary for eventual display should be a lookup key, never a pre-resolved string, or it silently exits the translation pipeline at that boundary.

## Responsive Breakpoint Functionality

When a component renders separate mobile and desktop markup branches (via `md:hidden` and `hidden md:block` Tailwind classes), diff the set of interactive affordances between branches, not just the styling. A critical interaction wired only to the desktop branch becomes unreachable on mobile, despite existing tests and code review — only a comparison of the actual interactive elements between the two branches catches this.

## Internationalization (Transloco)

`@jsverse/transloco` provides i18n. Only `uk` ships today (see `tasks/migration/parked/2026-07-16-25-en-locale-and-multi-currency.md` for the parked `en`/multi-currency work) — root providers are wired once in `apps/web/src/app/app.config.ts` via `provideTransloco()`, with a hand-written `TranslocoHttpLoader` (`apps/web/src/app/transloco-http-loader.ts`) since the `@jsverse/transloco` package ships no default HTTP loader.

### Scope-per-domain pattern

Each feature domain gets its own lazy-loaded scope, matching the Nx lib grouping (e.g. `identity`, `budget`). Co-locate the scope provider directly on the `@Component` decorator of every component that needs it:

```typescript
@Component({
  selector: 'lib-login-page',
  imports: [TranslocoPipe],
  providers: [provideTranslocoScope('identity')],
  templateUrl: './login-page.component.html',
})
export class LoginPageComponent {}
```

Cross-cutting strings shared by multiple domains (e.g. a generic "Loading..." state) go in the root scope instead — no `provideTranslocoScope()` needed for those.

### Key naming — always write the full scope-qualified key in templates

`provideTranslocoScope('identity')` only makes Transloco fetch and merge `identity/uk.json` into the active language; it does **not** let you drop the scope prefix when calling the `transloco` pipe. Always write the fully qualified `<scope>.<component>.<element>` key:

```html
<!-- ✓ Correct — full scope-qualified key -->
<h1>{{ 'identity.login.heading' | transloco }}</h1>

<!-- ❌ Wrong — pipe does not auto-prefix scoped keys, this looks up the root
     scope and silently falls back to echoing the raw key -->
<h1>{{ 'login.heading' | transloco }}</h1>
```

Root-scope (unscoped) keys use no prefix: `{{ 'common.loading' | transloco }}`.

### Loader contract — `lang` is already scope-qualified, don't re-prefix it

`TranslocoLoader.getTranslation(lang, data?)` is called by Transloco's own service internals, not by application code. When a scope is active, Transloco passes the already-scope-qualified path as `lang` itself (e.g. `'identity/uk'`, not `'uk'`) — `data.scope` is only the parsed-out scope name for convenience, not something the loader should re-prepend. A custom loader must request `` `/i18n/${lang}.json` `` unconditionally:

```typescript
// ✓ Correct — lang already contains the scope prefix when applicable
public getTranslation(lang: string): Observable<Translation> {
  return this.http.get<Translation>(`/i18n/${lang}.json`);
}

// ❌ Wrong — double-prefixes the scope, produces
// GET /i18n/identity/identity/uk.json (404)
public getTranslation(lang: string, data?: TranslocoLoaderData) {
  const path = data?.scope ? `${data.scope}/${lang}` : lang;
  return this.http.get<Translation>(`/i18n/${path}.json`);
}
```

This is a different mechanism from the template-key-prefix rule above (that one is about what you type in `{{ '...' | transloco }}`; this one is about what the loader requests over HTTP) — don't conflate the two when debugging a missing-translation report.

### File placement

Translation JSON lives under `apps/web/public/i18n/`, reusing the existing `apps/web/public` → `dist/apps/web/browser` asset-copy path (no new build target wiring needed):

- `apps/web/public/i18n/uk.json` — root/common scope
- `apps/web/public/i18n/identity/uk.json` — `identity` scope
- `apps/web/public/i18n/budget/uk.json` — `budget` scope (empty placeholder until Result-2 screens land)

When a new domain needs its own scope, add `apps/web/public/i18n/<scope>/uk.json` and call `provideTranslocoScope('<scope>')` on that domain's components — no other wiring required.

### No new key literal in templates

Never invent an ad-hoc string directly in a template — every user-facing literal must resolve through the `transloco` pipe against a key defined in the relevant scope's JSON file. Dynamic, backend-supplied text (e.g. a greeting message returned by an API) is the one exception: interpolate it directly (`{{ state.message }}`), it is not a translatable literal.

### Testing

Use `TranslocoTestingModule.forRoot({ langs, translocoConfig })` in specs. `langs` keys follow the `<scope>/<lang>` convention Transloco uses internally (e.g. `{ uk: {...}, 'identity/uk': {...} }`). After `fixture.detectChanges()`, `await fixture.whenStable()` then `fixture.detectChanges()` again before asserting — scope loading resolves asynchronously even against the in-memory testing loader.
