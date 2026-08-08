import { BaseService } from 'shared-kernel';
import { DomainError } from 'shared-errors';
import { Category } from 'budget-core';
import type { ICategoryRepository } from 'budget-core';
import type { ServiceContext } from 'shared-kernel';

import { assertActiveCaller } from './assert-active-caller.js';
import { CREATE_CATEGORY_SCHEMA } from './create-category.schema.js';
import type { BudgetServiceConfig } from './budget-service-config.js';

/** Input for {@link CreateCategoryService}, matching `CREATE_CATEGORY_SCHEMA`. */
export interface CreateCategoryParams {
  readonly name: string;
}

/** Dependencies {@link CreateCategoryService} needs, injected via its constructor. */
export interface CreateCategoryDeps {
  readonly categoryRepository: ICategoryRepository;
}

/** Builds the `DomainError` thrown when a category name is already taken in the workspace. */
function buildDuplicateNameError(name: string): DomainError {
  return DomainError.conflict(
    `A category named "${name}" already exists in this workspace.`,
  );
}

/**
 * Creates a new, non-archived `Category` in the caller's workspace.
 *
 * Framework-free `application` service — no DI decorators. Enforces the
 * ADR's per-workspace, case-insensitive, non-archived-only name uniqueness
 * rule by checking `findByNameInWorkspace` before persisting.
 */
export class CreateCategoryService extends BaseService<
  CreateCategoryParams,
  Category
> {
  private readonly categoryRepository: ICategoryRepository;

  public constructor(deps: CreateCategoryDeps) {
    super();
    this.categoryRepository = deps.categoryRepository;
  }

  protected override getValidationSchema(): Record<string, unknown> {
    return CREATE_CATEGORY_SCHEMA;
  }

  protected override authorize(
    context: ServiceContext<BudgetServiceConfig>,
  ): void {
    assertActiveCaller(context);
  }

  protected override async execute(
    params: CreateCategoryParams,
    context: ServiceContext<BudgetServiceConfig>,
  ): Promise<Category> {
    const { workspaceId } = context.config;

    const existing = await this.categoryRepository.findByNameInWorkspace(
      params.name,
      workspaceId,
    );
    if (existing) {
      throw buildDuplicateNameError(params.name);
    }

    // Placeholder id: the repository's `save` assigns the durable persisted
    // id on insert (mirrors `MongoUserRepository.save`'s `isValidObjectId`
    // branch). Never persisted as-is.
    const category = Category.create('', workspaceId, params.name);

    return this.categoryRepository.save(category);
  }
}
