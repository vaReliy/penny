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

- All Angular style files must use SCSS (not CSS)
- File extension: `.scss` not `.css`
- When generating components via `nx g @nx/angular:component`, always pass `--style=scss`
- After generation, verify `styleUrl` / `styles` references use `.scss`

Example:

```typescript
@Component({
  selector: 'app-greeting',
  styleUrl: './greeting.component.scss', // ✓ must be .scss
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
