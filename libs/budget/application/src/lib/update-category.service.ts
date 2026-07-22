import { BaseService } from 'shared-kernel';
import { DomainError, NotFoundError } from 'shared-errors';
import { ID_PATTERN, UPDATE_CATEGORY_SCHEMA } from 'budget-validation';
import type { Category, ICategoryRepository } from 'budget-core';
import type { ServiceContext } from 'shared-kernel';

import { assertActiveCaller } from './assert-active-caller.js';
import type { BudgetServiceConfig } from './budget-service-config.js';

/**
 * Input for {@link UpdateCategoryService}. `name` matches
 * `UPDATE_CATEGORY_SCHEMA` from `budget-validation` (task 06); `id`
 * identifies the category to rename and is not part of that schema (it is a
 * path parameter at the HTTP boundary, not request-body input) — validated
 * here via the same `ID_PATTERN` `budget-validation` uses for id-shaped
 * fields.
 */
export interface UpdateCategoryParams {
  readonly id: string;
  readonly name: string;
}

/** Dependencies {@link UpdateCategoryService} needs, injected via its constructor. */
export interface UpdateCategoryDeps {
  readonly categoryRepository: ICategoryRepository;
}

/** LIVR schema for {@link UpdateCategoryParams}: `UPDATE_CATEGORY_SCHEMA` plus the path `id`. */
const UPDATE_CATEGORY_PARAMS_SCHEMA: Record<string, unknown> = {
  id: ['required', { like: ID_PATTERN }],
  ...UPDATE_CATEGORY_SCHEMA,
};

/** Builds the `NotFoundError` thrown when the category to rename does not exist. */
function buildUnknownCategoryError(id: string): NotFoundError {
  return new NotFoundError(`No category found with id "${id}".`);
}

/** Builds the `DomainError` thrown when the new name collides with another category. */
function buildDuplicateNameError(name: string): DomainError {
  return DomainError.conflict(
    `A category named "${name}" already exists in this workspace.`,
  );
}

/**
 * Renames an existing `Category` in the caller's workspace.
 *
 * Framework-free `application` service — no DI decorators. Re-checks the
 * ADR's name-uniqueness rule against the *new* name, excluding the category
 * being renamed itself (a no-op rename to the same name must not collide
 * with itself).
 */
export class UpdateCategoryService extends BaseService<
  UpdateCategoryParams,
  Category
> {
  private readonly categoryRepository: ICategoryRepository;

  public constructor(deps: UpdateCategoryDeps) {
    super();
    this.categoryRepository = deps.categoryRepository;
  }

  protected override getValidationSchema(): Record<string, unknown> {
    return UPDATE_CATEGORY_PARAMS_SCHEMA;
  }

  protected override authorize(
    context: ServiceContext<BudgetServiceConfig>,
  ): void {
    assertActiveCaller(context);
  }

  protected override async execute(
    params: UpdateCategoryParams,
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

    const collision = await this.categoryRepository.findByNameInWorkspace(
      params.name,
      workspaceId,
    );
    if (collision && collision.id !== existing.id) {
      throw buildDuplicateNameError(params.name);
    }

    const renamed = existing.rename(params.name);

    return this.categoryRepository.save(renamed);
  }
}
