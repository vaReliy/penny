# budget-application

**Tags:** `scope:budget` · `type:application` · `platform:server`

Category and monthly-budget use-case services: `CreateCategoryService`, `UpdateCategoryService` (rename), `ArchiveCategoryService` (soft-archive, never hard delete), `ListCategoriesService`, `UpsertMonthlyBudgetService` (create-or-replace amount per category/month), `ListMonthlyBudgetsService`. Plain TypeScript — no `@Injectable()`, no framework imports. May import `scope:budget` core/contracts + `scope:shared` kernel/contracts/errors/util. LIVR validation schemas are colocated here in `src/lib/`.

`BudgetServiceConfig` (`ServiceContext.config`) is the single point through which the caller's workspace and the MVP's single-currency assumption reach these services — every service reads `context.config.workspaceId`/`context.config.defaultCurrency` and never derives a workspace from its own params. The interface layer builds this config once per request; in `apps/api` the `workspaceId` comes only from the `:workspaceId` route segment after `WorkspaceMemberGuard` has verified the caller's membership.
