import { BaseService } from 'shared-kernel';
import { NotFoundError } from 'shared-errors';
import { ID_PATTERN } from 'budget-validation';
import type { Category, ICategoryRepository } from 'budget-core';
import type { ServiceContext } from 'shared-kernel';

import { assertActiveCaller } from './assert-active-caller.js';
import type { BudgetServiceConfig } from './budget-service-config.js';

/** Input for {@link ArchiveCategoryService}: the category to archive. */
export interface ArchiveCategoryParams {
  readonly id: string;
}

/** Dependencies {@link ArchiveCategoryService} needs, injected via its constructor. */
export interface ArchiveCategoryDeps {
  readonly categoryRepository: ICategoryRepository;
}

/** LIVR schema for {@link ArchiveCategoryParams}. No task-06 schema exists for this action (`id` is a path parameter, not a `POST`/`PATCH` body) — validated with the same `ID_PATTERN` `budget-validation` uses for id-shaped fields. */
const ARCHIVE_CATEGORY_SCHEMA: Record<string, unknown> = {
  id: ['required', { like: ID_PATTERN }],
};

/** Builds the `NotFoundError` thrown when the category to archive does not exist. */
function buildUnknownCategoryError(id: string): NotFoundError {
  return new NotFoundError(`No category found with id "${id}".`);
}

/**
 * Soft-archives a `Category` in the caller's workspace.
 *
 * Framework-free `application` service — no DI decorators. Per the budget
 * domain model ADR ("Category soft-archive, never hard delete"), archiving
 * is the *only* deletion path this service offers: there is no branch that
 * hard-deletes the category even when no transaction references it, so it
 * has no dependency on `ITransactionRepository` (`existsForCategory` exists
 * purely to inform an *optional* archive-confirmation UX at a later, UI-only
 * layer — never to gate this service's own archive/hard-delete decision).
 * `Category.archive()` itself throws `DomainError` if the category is
 * already archived.
 */
export class ArchiveCategoryService extends BaseService<
  ArchiveCategoryParams,
  Category
> {
  private readonly categoryRepository: ICategoryRepository;

  public constructor(deps: ArchiveCategoryDeps) {
    super();
    this.categoryRepository = deps.categoryRepository;
  }

  protected override getValidationSchema(): Record<string, unknown> {
    return ARCHIVE_CATEGORY_SCHEMA;
  }

  protected override authorize(
    context: ServiceContext<BudgetServiceConfig>,
  ): void {
    assertActiveCaller(context);
  }

  protected override async execute(
    params: ArchiveCategoryParams,
    context: ServiceContext<BudgetServiceConfig>,
  ): Promise<Category> {
    const { workspaceId } = context.config;

    const existing = await this.categoryRepository.findByIdInWorkspace(
      params.id,
      workspaceId,
    );
    if (!existing) {
      throw buildUnknownCategoryError(params.id);
    }

    // Entity validates the transition (throws DomainError if already
    // archived); only the resulting state is then persisted.
    const archived = existing.archive();
    await this.categoryRepository.archive(params.id, workspaceId);

    return archived;
  }
}
