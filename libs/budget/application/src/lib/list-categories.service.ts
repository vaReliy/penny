import { BaseService } from 'shared-kernel';
import type { Category, ICategoryRepository } from 'budget-core';
import type { ServiceContext } from 'shared-kernel';

import { assertActiveCaller } from './assert-active-caller.js';
import type { BudgetServiceConfig } from './budget-service-config.js';

/** Input for {@link ListCategoriesService}. No request fields — the workspace is derived from `context.config`. */
export type ListCategoriesParams = Record<string, never>;

/** Dependencies {@link ListCategoriesService} needs, injected via its constructor. */
export interface ListCategoriesDeps {
  readonly categoryRepository: ICategoryRepository;
}

/** Fully permissive: no request fields to validate — see `ListCategoriesParams`. */
const LIST_CATEGORIES_SCHEMA: Record<string, unknown> = {};

/**
 * Lists a workspace's `Category` entities.
 *
 * Framework-free `application` service — no DI decorators. Excludes
 * archived categories (repository default), matching the ADR: archived
 * categories are hidden from selection UI, never from historical
 * aggregation (which this service is not used for).
 */
export class ListCategoriesService extends BaseService<
  ListCategoriesParams,
  readonly Category[]
> {
  private readonly categoryRepository: ICategoryRepository;

  public constructor(deps: ListCategoriesDeps) {
    super();
    this.categoryRepository = deps.categoryRepository;
  }

  protected override getValidationSchema(): Record<string, unknown> {
    return LIST_CATEGORIES_SCHEMA;
  }

  protected override authorize(
    context: ServiceContext<BudgetServiceConfig>,
  ): void {
    assertActiveCaller(context);
  }

  protected override execute(
    _params: ListCategoriesParams,
    context: ServiceContext<BudgetServiceConfig>,
  ): Promise<readonly Category[]> {
    return this.categoryRepository.findByWorkspace(context.config.workspaceId);
  }
}
