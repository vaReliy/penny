# budget-application

**Tags:** `scope:budget` · `type:application` · `platform:server`

Category and monthly-budget use-case services: `CreateCategoryService`, `UpdateCategoryService` (rename), `ArchiveCategoryService` (soft-archive, never hard delete), `ListCategoriesService`, `UpsertMonthlyBudgetService` (create-or-replace amount per category/month), `ListMonthlyBudgetsService`. Plain TypeScript — no `@Injectable()`, no framework imports. May import `scope:budget` core/contracts/validation + `scope:shared` kernel/contracts/errors/util.

`BudgetServiceConfig` (`ServiceContext.config`) is the single centralized point through which the MVP's implicit single-workspace/single-currency assumption reaches these services — every service reads `context.config.workspaceId`/`context.config.defaultCurrency` instead of importing `budget-contracts`' `DEFAULT_WORKSPACE_ID` directly (forbidden for `application` code per the budget domain model ADR). The interface layer (a later task) builds this config once per request.
