# Angular Code Style

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

A page-level `state()` computed that resolves to `'loading' | 'error' | 'ready'` models _initial load_ only. Once the page has reached `'ready'` (e.g. `balance() !== null && rates() !== null`), it can never re-enter `'error'` through that same computed — a failed `refresh()` after first success has nowhere to surface, and the template silently renders stale data with no indication anything failed.

Partial/refresh failure after first success is a per-action concern, not a bypass to reinvent per screen. Decide the convention once: each failable action gets its own per-action error signal, surfaced inline next to that action's own affordance (e.g. a `role="alert"` beside the still-visible stale data), and stale data is never discarded on a failed refresh. Read the per-action error signal directly in the `ready` branch rather than folding it back into the page-level `state()`.

## Routing

### `routerLinkActive` must not coexist with a static class on the same CSS property

Tailwind compiles utilities to same-specificity single-class selectors, so when a static class and a conditionally-applied class both target the same CSS property on the same element, whichever rule appears later in the _compiled stylesheet_ wins — not whichever class is later in the element's `class` list or later to be added by a directive. Passing classes as `routerLinkActive`'s string value alongside static classes on the same element leaves this cascade fight to chance:

```html
<!-- ❌ Wrong — bg-primary vs hover:bg-background, text-primary-contrast vs
     text-text-secondary: whichever wins in the compiled stylesheet is
     accidental, not chosen -->
<a routerLink="/dashboard" routerLinkActive="bg-primary text-primary-contrast" class="text-text-secondary hover:bg-background">Dashboard</a>

<!-- ✓ Correct — bind to isActive via a template ref, exactly one class per
     property is present at any moment -->
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

## Forms

- Use Reactive Forms for forms with validation
- Typed validators: avoid loose `any` types on form state
- Validate at form-level using `FormGroup.setErrors()` after async backend checks

## HTTP Client

- Use typed `HttpClient.get<T>()` responses
- Avoid `any` — define DTOs for every endpoint response
- Error handling: pipe errors through `catchError`, never suppress with `|| null`

## Currency Display

### bigint-exact currency conversion for display: parse the decimal rate as an exact fraction, never through `Number`

Any display-value conversion between currencies must stay entirely in `bigint` — never round-trip the decimal-string rate through `Number`/`parseFloat`. Split the rate string into `{numerator, denominator}` by string manipulation, then compute:

```
foreignMinorUnits = round(baseMinorUnits × 10^k / rateNumerator)
```

entirely in `bigint`, using round-half-away-from-zero. This precondition only holds when both currencies share a minor-unit decimal count (true for UAH/USD/EUR at 2 decimals) — a currency like JPY (0 decimals) or BHD (3 decimals) would need a scale adjustment.

This is the frontend/display-value counterpart of the backend bigint-percent pattern — see `rules/local/code-style-backend.md` § "Bigint-safe percent pattern (no float touch)" for the equivalent backend idiom (`(numerator*100n + denominator/2n) / denominator`).

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

## Accessibility

- Semantic HTML in templates — use `<button>`, `<a>`, `<header>` not divs with role hacks
- ARIA labels via `[attr.aria-label]` binding on custom components
- Keyboard navigation on all interactive elements
- WCAG AA contrast ratios
- Angular CDK `a11y` utilities for focus management

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
