# How to Build a Frontend Feature

This guide documents how Penny's Angular frontend features are built, grounded in the executable-contract practices enforced by Nx module boundaries and ESLint rules. Every pattern here is verified against the four shipped budget screens: account (balance + rates), records (transaction entry + categories), history (list + filter + chart), and planner (monthly budgets + progress). This is proven reality, not aspirational.

## 1. Where a Feature Lives: The Slice Anatomy

Every feature lives in a vertical slice under `libs/<domain>/` with three layers:

- **`feature-<name>`** — page-level components, forms, routing. Brings together UI components and data stores to compose a complete screen.
- **`ui`** — dumb presentational components. Takes inputs, renders output, never speaks to the backend or calls stores.
- **`data-access`** — API clients, signal stores, error handling. Fetches from HTTP endpoints, holds application state, exposes signals to features.

Backend serves the feature via a corresponding **`application`** layer in the same domain (e.g., `libs/budget/application` for `budget` features).

### The Tag Matrix: Executable Contracts

Nx tags make these boundaries mechanical lint rules, not conventions. Every library is tagged with:

- `type:` layer (feature, ui, data, contracts, util, core, application, infrastructure, kernel, errors, validation)
- `scope:` domain (budget, identity, shared, web)
- `platform:` target (web, server, shared)

The ESLint rule `@nx/enforce-module-boundaries` (in `eslint.config.mjs` lines 21–172) encodes two constraints: a frontend **onion** (feature → ui/data, ui → ui, data → contracts) and **scope isolation** (budget→budget, identity→identity, both→shared). For the exact tag dependency arrays, see `eslint.config.mjs` lines 119–139 (frontend onion) and lines 28–55 (scope isolation). ARCHITECTURE.md also documents this pattern.

### Real Lint Error: Boundary Violation

Here is what violates the boundary. If you import a **data store** directly into a **ui component**:

```typescript
// In libs/budget/ui/src/lib/some-component.ts
import { DashboardStore } from 'budget-data-access'; // ❌ Violation

export class SomeComponent {
  // ui layer cannot depend on data layer
}
```

Running `npx eslint` produces:

```
A project tagged with "type:ui" can only depend on libs tagged with "type:ui", "type:util"  @nx/enforce-module-boundaries
```

The lint rule catches this before any code runs. When the feature layer wires data stores into templates, the feature page (which is allowed to depend on both `type:ui` and `type:data`) becomes the seam.

### Tag Matrix for Budget Screens

All four shipped budget features follow the same pattern:

- **`libs/budget/feature-account`** — `type:feature`, `scope:budget`, `platform:web` (file: `libs/budget/feature-account/project.json` line 7)
- **`libs/budget/ui`** — `type:ui`, `scope:budget`, `platform:web` (file: `libs/budget/ui/project.json` line 7)
- **`libs/budget/data-access`** — `type:data`, `scope:budget`, `platform:web` (file: `libs/budget/data-access/project.json` line 7)

The backend's `libs/budget/application`, `libs/budget/core`, etc., use server tags and are never imported from the web.

## 2. The Seam Order: Contract → Data → UI → Feature → Route

Every feature follows the same layered sequence, building outward from a contract DTO.

### 2.1 Contract DTO (Shared Across Frontend & Backend)

Start by defining the data shape both the API and frontend agree on. DTOs live in `libs/<domain>/contracts/` and are tagged `type:contracts`.

Example from the four shipped screens:

- **Balance** — `libs/budget/contracts/src/lib/balance.dto.ts` (lines 1–9): `BalanceResponse` with `{ accountId, balance: SerializedMoney }`
- **Transaction** — `libs/budget/contracts/src/lib/transaction.dto.ts`: `TransactionResponse` with category, type (income/expense), amount, date
- **Exchange rate** — `libs/budget/contracts/src/lib/exchange-rate.dto.ts`: `ExchangeRateEntry` with `{ currency, rateToBase }`
- **Planner summary** — `libs/budget/contracts/src/lib/planner-summary.dto.ts`: per-category spent/budgeted totals

The contract guarantees shape and validation rules. Both frontend and backend import the same contract — if the backend changes the shape, the frontend's TypeScript catches it at build time.

### 2.2 LIVR Validation Schema (Backend Application Layer)

The backend's `libs/<domain>/validation/` applies the contract's validation rules. The frontend mirrors these rules at the component boundary (input parsing, form validators) but does not import the schema directly (it would break the `type:feature` → `type:ui` boundary). Instead, features declare independent validation logic grounded in the same rules.

Example from records screen:

- Backend: `libs/budget/application/src/lib/create-transaction.schema.ts` defines required, max-length, positive-amount rules for LIVR.
- Frontend: `libs/budget/feature-records/src/lib/transaction-form/transaction-form.ts` (lines 49–72) implements the same validators independently using Angular's `Validators` and custom `amountValidator`.

Both arrive at the same validation, but the frontend cannot import from the backend's validation lib (type:validation) — it is cross-platform and may contain backend-specific logic.

### 2.3 Data Layer: API Client + Signal Stores

The `libs/<domain>/data-access` layer holds two things:

**HTTP clients** — one per endpoint family, calling `HttpClient.get/post`:

- `libs/budget/data-access/src/lib/rates.client.ts` — `GET /api/rates`
- `libs/budget/data-access/src/lib/analytics.client.ts` — `GET /api/budget/balance`, `GET /api/budget/summary`, etc.
- `libs/budget/data-access/src/lib/transaction.client.ts` — `POST /api/budget/transactions`

**Signal stores** — one per concern (e.g., `DashboardStore` for read models, `TransactionStore` for mutations):

```typescript
// libs/budget/data-access/src/lib/dashboard.store.ts (lines 22–46)
@Injectable({ providedIn: 'root' })
export class DashboardStore {
  private readonly client = inject(AnalyticsClient);
  private readonly balanceSignal = signal<BalanceView | null>(null);
  public get balance(): Signal<BalanceView | null> {
    return this.balanceSignal;
  }
  public loadBalance(): void {
    /* ... */
  }
}
```

Stores are app-singletons (`providedIn: 'root'`) and expose signals + methods. Methods are called from feature pages during `ngOnInit` or on user action; signals are read in templates via `{{ signal() }}`.

### 2.4 UI Components (Dumb, Input-Driven)

UI components take their inputs as Angular signals (via `input.required<T>()` and `input<T>(defaultValue)`) and never speak to stores or the HTTP layer. They render based on inputs and emit events for actions.

Example from account screen:

```typescript
// libs/budget/ui/src/lib/balance-card/balance-card.ts (lines 33–51)
@Component({
  selector: 'lib-balance-card',
  imports: [TranslocoPipe],
  providers: [provideTranslocoScope('budget')],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './balance-card.html',
  styleUrl: './balance-card.css',
})
export class BalanceCardComponent {
  public readonly balance = input.required<Money>();
  public readonly rates = input<readonly RateEntryDisplay[]>([]);
  protected readonly rows = computed<readonly BalanceRow[]>(() => {
    /* ... */
  });
}
```

The `balance-card.html` template is pure Tailwind and data binding — no logic, no side effects. See `libs/budget/ui/src/lib/balance-card/balance-card.html` (lines 1–25).

### 2.5 Feature Page: Wires UI to Store

The feature page is the only place where UI components and data stores meet. It injects stores, calls their methods, and passes their signals to UI components as inputs.

Example from account screen:

```typescript
// libs/budget/feature-account/src/lib/account-page/account-page.ts (lines 29–61)
@Component({
  selector: 'lib-account-page',
  imports: [TranslocoPipe, BalanceCardComponent, RatesCardComponent],
  providers: [provideTranslocoScope('budget')],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './account-page.html',
  styleUrl: './account-page.css',
})
export class AccountPageComponent implements OnInit {
  protected readonly dashboardStore = inject(DashboardStore);
  protected readonly ratesStore = inject(RatesStore);

  protected readonly state = computed<AccountPageState>(() => {
    if (this.dashboardStore.balance() !== null && this.ratesStore.rates() !== null) {
      return 'ready';
    }
    if (this.dashboardStore.balanceError() !== null || this.ratesStore.error() !== null) {
      return 'error';
    }
    return 'loading';
  });

  public ngOnInit(): void {
    this.dashboardStore.loadBalance();
    this.ratesStore.load();
  }

  protected onRetry(): void {
    this.dashboardStore.loadBalance();
    this.ratesStore.load();
  }

  protected onRatesRefresh(): void {
    this.ratesStore.refresh();
  }
}
```

The template binds the page's `state` signal and passes UI signals (e.g., `dashboardStore.balance()`) as inputs to UI components.

### 2.6 Routing & Lazy Loading

Routes are defined at the app root in `apps/web/src/app/app.routes.ts` (lines 1–62). Auth and budget feature routes use a two-level structure:

**Top-level auth routes** (public, no guard):

```typescript
{
  path: 'login',
  canActivate: [loginGuard],
  loadComponent: () =>
    import('identity-feature-login').then((m) => m.LoginPageComponent),
},
{
  path: 'access-status',
  canActivate: [statusGuard],
  loadComponent: () =>
    import('identity-feature-access-status').then(
      (m) => m.AccessStatusPageComponent,
    ),
},
```

**Shell route** (protected by `statusGuard`, contains all authenticated features as children):

```typescript
{
  path: '',
  canActivate: [statusGuard],
  loadComponent: () =>
    import('shared-web-shell').then((m) => m.AppShellComponent),
  children: [
    {
      path: 'account',
      loadComponent: () =>
        import('budget-feature-account').then((m) => m.AccountPageComponent),
    },
    {
      path: 'records',
      loadComponent: () =>
        import('budget-feature-records').then((m) => m.RecordsPageComponent),
    },
    {
      path: 'history',
      loadComponent: () =>
        import('budget-feature-history').then((m) => m.HistoryPageComponent),
    },
    {
      path: 'planner',
      loadComponent: () =>
        import('budget-feature-planner').then((m) => m.PlannerPageComponent),
    },
  ],
},
```

Feature pages are `@Component` lazy-loaded at their own path (e.g., `AccountPageComponent` is routed at `/account`). The `AppShellComponent` (shared-web-shell) renders the layout chrome (sidebar, nav, etc.) and outlet for child routes. No NgModule needed — all components are standalone.

### Summary: The Seam Order for the Budget Screens

Sequence showing how the layers were built:

1. Build `data-access`, `contracts`, `validation` layers: DTOs, clients, stores.
2. Build account screen (`feature-account`, `ui`): feature page wires `DashboardStore` + `RatesStore` into dumb UI components.
3. Build records screen with form validation, inline `parseAmountToMinorUnits` (same logic as backend validation, independent copy).
4. Build history screen: add list filtering, chart component, detail route.
5. Build planner screen: add inline budget editing, progress bar rendering, month switching.

Each screen reused the same stores and added only its own feature-specific UI and feature page.

## 3. House Idioms: The Patterns This App Uses

### Standalone Components and Native Control Flow

All new Angular components are standalone — no NgModules for new code. Use native control flow (`@if`, `@for`, `@switch`, `@let`) instead of `*ngIf`, `*ngFor`, `*ngSwitch`.

```html
<!-- ✓ Correct: native block syntax -->
@if (state() === 'ready') {
<lib-balance-card [balance]="dashboardStore.balance()" />
} @else if (state() === 'loading') {
<p>{{ 'common.loading' | transloco }}</p>
} @else {
<button (click)="onRetry()">{{ 'budget.account.page.retry' | transloco }}</button>
}

<!-- ❌ Avoid: structural directives -->
<lib-balance-card *ngIf="state() === 'ready'" [balance]="dashboardStore.balance()" />
```

See the account page template: `libs/budget/feature-account/src/lib/account-page/account-page.html` uses native `@if`/`@else`.

### Signals & Reactive State

Use Angular signals for all reactive state. Never use `BehaviorSubject` in new code.

**Store methods** populate signals and return nothing:

```typescript
public loadBalance(): void {
  this.balanceRequestState.load(() => this.client.getBalance());
}
```

**Computed signals** derive state when dependencies change:

```typescript
protected readonly state = computed<AccountPageState>(() => {
  if (this.dashboardStore.balance() !== null) return 'ready';
  if (this.dashboardStore.balanceError() !== null) return 'error';
  return 'loading';
});
```

**Templates read signals** with function syntax:

```html
{{ balance() }} {{ state() | transloco }}
```

See the budget data-access stores: `libs/budget/data-access/src/lib/dashboard.store.ts` (lines 43–46, 60–80) uses signals throughout.

### Typed Reactive Forms

Forms use Angular's `FormGroup` and `FormControl` with explicit type annotations and custom validators.

Example from records screen (transaction form):

```typescript
// libs/budget/feature-records/src/lib/transaction-form/transaction-form.ts (lines 37–72)
function amountValidator(control: AbstractControl<string>): ValidationErrors | null {
  const value = control.value;
  if (value === null || value.trim().length === 0) {
    return null;
  }
  return parseAmountToMinorUnits(value) === null ? { invalidAmount: true } : null;
}

function buildForm() {
  return new FormGroup({
    type: new FormControl<TransactionType>('expense', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    categoryId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    amount: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, amountValidator],
    }),
    date: new FormControl(todayIsoDate(), {
      nonNullable: true,
      validators: [Validators.required],
    }),
    description: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(MAX_DESCRIPTION_LENGTH)],
    }),
  });
}
```

Validators mirror backend LIVR rules — the frontend mirrors, not imports. Forms are built in factory functions for testability and reusability.

### Money: Integer Minor Units, Never Float

All money values are represented as `bigint` minor units (kopiykas for UAH; cents for USD/EUR) end-to-end, using the `Money` value object from `libs/shared/util/src/lib/money.ts`. This guarantees exactness — no float rounding errors.

**At the component boundary** (forms, user input), always convert to minor units:

```typescript
// libs/budget/feature-records/src/lib/parse-amount.util.ts (lines 20–40)
export function parseAmountToMinorUnits(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const match = AMOUNT_PATTERN.exec(trimmed);
  if (!match) {
    return null;
  }

  const [, wholePart, fractionPart = ''] = match;
  const paddedFraction = fractionPart.padEnd(2, '0');
  const minorUnits = Number(wholePart) * 100 + Number(paddedFraction);

  if (minorUnits <= 0 || minorUnits > MAX_MONEY_MINOR_UNITS) {
    return null;
  }

  return minorUnits;
}
```

User types `"123,45"` or `"123.4"` → parsed to integer `12345` (kopiykas) → sent to backend → backend stores as `bigint` → returned as `SerializedMoney: { amount: "12345", currency: "UAH" }` → frontend formats for display only:

```typescript
// libs/shared/util/src/lib/format-money.util.ts (lines 16–25)
export function formatMoney(money: Money): string {
  const majorUnits = Number(money.amount) / 10 ** MINOR_UNIT_DECIMALS;

  return new Intl.NumberFormat(DISPLAY_LOCALE, {
    style: 'currency',
    currency: money.currency,
    minimumFractionDigits: MINOR_UNIT_DECIMALS,
    maximumFractionDigits: MINOR_UNIT_DECIMALS,
  }).format(majorUnits);
}
```

The float conversion in `formatMoney` is safe because the result is a rendered string, not re-used in calculations.

### Transloco: Scope-Per-Domain i18n

Strings are never hardcoded in templates. Every user-facing string goes through the `transloco` pipe, keyed in the domain's scope.

**Root scope** (common strings, `apps/web/public/i18n/uk.json`):

```json
{ "common": { "loading": "Завантаження...", "retry": "Спробувати ще раз" } }
```

**Domain scope** (budget strings, `apps/web/public/i18n/budget/uk.json`):

```json
{
  "account": {
    "page": { "error": "Не вдалося завантажити...", "retry": "Спробувати ще раз" },
    "balanceCard": { "title": "Рахунок", "zeroHint": "Немає операцій" }
  }
}
```

**In components**, provide the scope at the decorator level:

```typescript
@Component({
  selector: 'lib-account-page',
  imports: [TranslocoPipe],
  providers: [provideTranslocoScope('budget')],
  // ...
})
```

**In templates**, use the fully qualified key (scope.component.element):

```html
{{ 'budget.account.page.error' | transloco }} {{ 'common.loading' | transloco }}
```

Never drop the scope prefix or invent a key not in the JSON — the pipe will silently echo the raw key. See `rules/local/code-style-angular.md` § "Internationalization (Transloco)" (lines 254–326) for the complete rules.

### Error Surfacing: Per-Action, Not Page-Level

A page-level `state() === 'loading' | 'error' | 'ready'` cannot express partial failure after first success. If the balance loads successfully and then the rates-refresh fails, the page is already `'ready'` — there is nowhere in the state machine to surface the refresh error.

Solution: Each failable action gets its own error signal, surfaced inline next to that action's affordance. Stale data is never discarded on a failed refresh — only the action-specific signal shows the error.

Example from account page (stores export per-concern error signals):

```typescript
// libs/budget/data-access/src/lib/dashboard.store.ts (lines 60–75)
public get balanceError(): Signal<BudgetApiError | null> {
  return this.balanceRequestState.error;
}

public get summaryError(): Signal<BudgetApiError | null> {
  return this.summaryRequestState.error;
}

public get chartError(): Signal<BudgetApiError | null> {
  return this.chartRequestState.error;
}
```

The rates card shows its own refresh error inline — see the rates-card component's template, which renders an error message in a `role="alert"` next to the still-visible stale rates data.

**Error mapping** from HTTP to UI happens in `libs/budget/data-access/src/lib/budget-api-error.ts` (lines 63–85), which classifies backend errors (VALIDATION, AUTHENTICATION, NOT_FOUND, DOMAIN, UNKNOWN) and extracts the human-readable message.

### Design Tokens: Mobile-First Tailwind v4

All styling uses Tailwind v4 with CSS `@theme` custom properties for colors, spacing, and typography. No SCSS — Tailwind v4 does not work with CSS preprocessors.

**Component CSS** is mostly empty (just `styleUrl: './component.css'`) — all styling is Tailwind utility classes in the template:

```html
<!-- libs/budget/ui/src/lib/balance-card/balance-card.html -->
<section class="rounded-card border border-border bg-surface p-4" [attr.aria-label]="'budget.account.balanceCard.title' | transloco">
  <h2 class="mb-3 text-lg font-semibold text-text-primary">{{ 'budget.account.balanceCard.title' | transloco }}</h2>

  <ul class="flex flex-col gap-2">
    @for (row of rows(); track row.currency) {
    <li class="flex items-center justify-between gap-2">
      <span class="text-sm text-text-secondary">{{ row.currency }}</span>
      <span class="text-lg font-medium text-text-primary">{{ row.formatted }}</span>
    </li>
    }
  </ul>
</section>
```

Use semantic token names (e.g., `bg-surface`, `text-primary`, `rounded-card`) defined in the Tailwind config's `@theme` — never hardcode hex values. This makes dark mode, custom theming, and consistency changes painless.

Mobile-first: build the mobile (360 px) layout first, then add `@apply` rules or Tailwind breakpoints (`md:`, `lg:`, etc.) for larger screens.

See `rules/local/code-style-angular.md` § "Styling" (lines 148–179) for the complete token migration guide and naming conventions.

### Accessibility (a11y)

- Use semantic HTML (`<button>`, `<a>`, `<header>`, `<section>` with `role` only when needed).
- ARIA labels on interactive elements: `[attr.aria-label]`, `[attr.aria-describedby]`.
- Error messages in `role="alert"` so screen readers announce them.
- Keyboard navigation: all interactive elements reachable via Tab.
- WCAG AA contrast ratios (verified by Tailwind token design).

Example from account page template:

```html
<section class="rounded-card border border-border bg-surface p-4" [attr.aria-label]="'budget.account.balanceCard.title' | transloco"></section>
```

See `rules/local/code-style-angular.md` § "Accessibility" (lines 246–252) for the full checklist.

## 4. Testing Ladder: What Each Layer Catches

Three layers test the frontend:

### Layer 1: Component Tests (Vitest + Playwright Testing Library)

**What they test**: Individual component logic — signals, computed values, form validation, error states, user interactions.

**Where they live**: `*.spec.ts` files next to component files.

**Tools**: Vitest, TestBed, `HttpTestingController` for HTTP mocks, `TranslocoTestingModule` for i18n.

Example from account-page component (tests the page's state machine and store interactions):

```typescript
// libs/budget/feature-account/src/lib/account-page/account-page.spec.ts (lines 32–129)
describe('AccountPageComponent', () => {
  let fixture: ComponentFixture<AccountPageComponent>;
  let httpController: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        AccountPageComponent,
        TranslocoTestingModule.forRoot({
          langs: { uk: UK_TRANSLATIONS, 'budget/uk': BUDGET_UK_TRANSLATIONS },
          translocoConfig: { availableLangs: ['uk'], defaultLang: 'uk' },
        }),
      ],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    httpController = TestBed.inject(HttpTestingController);
  });

  it('shows the loading state before balance/rates arrive', async () => {
    fixture = TestBed.createComponent(AccountPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Завантаження...');

    httpController.expectOne('/api/budget/balance').flush({
      accountId: 'a1',
      balance: { amount: '415000', currency: 'UAH' },
    });
    httpController.expectOne('/api/rates').flush({
      base: 'UAH',
      rates: [{ currency: 'USD', rateToBase: '41.5000' }],
      asOf: '2026-07-27T10:00:00.000Z',
    });
  });

  it('a failed refresh surfaces an inline error but keeps the stale rates rendered', async () => {
    // ... test verifies per-action error surfacing, not page-level state reset
  });
});
```

**Coverage targets**: signal values, computed conditions, form validators, error states, user click handlers. Mocked HTTP endpoints entirely.

### Layer 2: Per-Screen e2e (Playwright, apps/web-e2e/)

**What they test**: One screen's happy path and edge cases. User lands on the screen, sees data, interacts, data updates, sees results.

**Where they live**: `apps/web-e2e/src/<screen>.spec.ts`

**Tools**: Playwright, page routing mocks (mocked backend, not real API).

Example: `apps/web-e2e/src/account-page.spec.ts` tests the account screen's balance display and rates refresh in isolation. `apps/web-e2e/src/records-page.spec.ts` tests form submission and category creation independently.

**Coverage targets**: rendering, user navigation, form filling, API calls triggered by the right actions, success and error states visible to the user.

### Layer 3: Cross-Screen Journey e2e (Playwright, apps/web-e2e/)

**What they test**: One coherent end-to-end flow that spans multiple screens, verifying state flows from one screen to the next.

**Where it lives**: `apps/web-e2e/src/full-journey.spec.ts`

**How it works**: One stateful mock backend holds the global state (users, categories, transactions, balance, budgets). As the test navigates screens, state mutations on one screen appear on subsequent screens — a true proof that features are wired together correctly.

Example from `full-journey.spec.ts` (lines 38–275):

1. **Auth flow** — user logs in via Telegram widget (mocked), admin approves (status transitions from pending → active).
2. **Records screen** — user creates a category, then records a transaction.
3. **Account screen** — balance reflects the transaction immediately (balance += transaction amount).
4. **History screen** — new transaction appears in the list.
5. **Planner screen** — summary shows the spent amount under the category.
6. **Back to records** — user records another transaction, balance updates again.

This proves the whole data flow, not just individual screens. It's the only place where you catch a mistake where a feature forgets to refresh a store after a mutation.

**Coverage targets**: Complete user workflows, cross-screen state consistency, backend mutations reflected across screens, mobile viewport variant.

**Running the tests**:

```bash
# Component tests (all at once)
docker compose exec app npm run test

# Per-screen e2e
docker compose exec app npm run e2e -- account-page.spec.ts

# Full journey e2e
docker compose exec app npm run e2e -- full-journey.spec.ts

# All e2e
docker compose exec app npm run e2e
```

## 5. Definition of Done: Checklist for New Screens

Use this as a template for new feature screen tasks.

- [ ] **Contract DTO** — new types in `libs/<domain>/contracts/src/lib/` with all request/response shapes, exported from `index.ts`. Shared by backend and frontend.
- [ ] **Validation schema** (backend only) — LIVR rules in `libs/<domain>/validation/` mirror the contract's constraints.
- [ ] **Data layer** — API clients in `libs/<domain>/data-access/` for each endpoint family (one client per endpoint family: GET /api/.../balance → AnalyticsClient, POST /api/.../transactions → TransactionClient). Store class (app-singleton, `providedIn: 'root'`) exposes signals + methods. Error handling via `toBudgetApiError()` maps backend errors to UI kinds.
- [ ] **UI components** — pure dumb components in `libs/<domain>/ui/` taking signal inputs (via `input.required<T>()` and `input<T>(defaultValue)`), no store/HTTP access, all strings via Transloco scope. Component tests verify rendering, validators, form states.
- [ ] **Feature page** — one component in `libs/<domain>/feature-<name>/` that wires stores + UI together, calls store methods on `ngOnInit`/user action, passes signals to UI. Computed states for loading/error/ready. Feature page gets its own Transloco scope provider.
- [ ] **Routing** — lazy-loaded route in `apps/web/src/app/app.routes.ts`, loadComponent import from the feature lib's `index.ts` barrel. Route guard (if needed) checks auth status.
- [ ] **Mobile-first Tailwind** — Utility classes in templates. Test at 360 px (mobile) and ≥ breakpoint (desktop). No hardcoded colors/spacing — use token names. WCAG AA contrast.
- [ ] **Money handling** (if applicable) — user input parsed to minor units via `parseAmountToMinorUnits()` or equivalent, sent to backend as integer, returned as `SerializedMoney`, formatted for display via `formatMoney()`.
- [ ] **i18n** — all user-facing strings in `apps/web/public/i18n/<scope>/uk.json`, piped through Transloco with fully qualified keys. Root scope for common strings (loading, retry, error).
- [ ] **Component tests** — Vitest specs for page-level components, UI components, forms. Mock HTTP via `HttpTestingController`. Test loading, success, error states. Test form validators. Verify error signals remain while stale data persists.
- [ ] **Per-screen e2e** — Playwright spec in `apps/web-e2e/src/<screen>.spec.ts` with a stateless mock backend. Test happy path, edge cases, error states. Include mobile viewport variant via `.use({ viewport: { width: 360, height: 800 } })`.
- [ ] **Journey e2e** (cross-screen only) — Add cases to `full-journey.spec.ts` if this screen's mutations affect other screens (e.g., recording a transaction affects account balance and history). Verify state flows from one screen to the next.
- [ ] **Lint green** — `nx lint <lib>` passes. No circular dependencies, boundary violations, or unused imports.
- [ ] **TypeScript green** — `nx typecheck` passes. No `any` types. Signals and forms properly typed.
- [ ] **Build green** — `nx build web` succeeds. App minifies, no bundle warnings.
- [ ] **No exact-pins violations** — every `package.json` dep exact-pinned (no `^`, `~`). Audit after any `pnpm add`.
- [ ] **Accessibility** — semantic HTML, ARIA labels on interactive elements, keyboard navigation, 4.5:1 contrast ratio on text.
- [ ] **Error UX** — per-action error signals, never page-level state reset. Stale data visible while error is displayed. User can retry failed action.

---

## Worked Examples: The Four Budget Screens

All four screens are in production in `develop`. Reference them when building new features:

- **Account (bill/balance/rates)**: `libs/budget/feature-account/`, `libs/budget/ui/src/lib/balance-card/`, `libs/budget/ui/src/lib/rates-card/`. Simple two-store load, independent-refresh pattern.
- **Records (transaction entry, category management)**: `libs/budget/feature-records/`. Forms with typed validators, two stores (CategoryStore + TransactionStore), form reset on success.
- **History (list, filter, chart, detail)**: `libs/budget/feature-history/`. Multi-filter state in URL params, ngx-charts integration, side-by-side routes (list + detail).
- **Planner (monthly budgets, progress)**: `libs/budget/feature-planner/`. Month selection, inline edit, threshold-based color rendering, union rendering (budget ∪ spend).

Every pattern documented here is visible in one of these screens. When in doubt, grep them.
