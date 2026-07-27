import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Inject,
  UseGuards,
} from '@nestjs/common';

import type {
  CreateCategoryService,
  UpdateCategoryService,
  ArchiveCategoryService,
  ListCategoriesService,
} from 'budget-application';
import type {
  CreateCategoryRequest,
  UpdateCategoryRequest,
  CategoryResponse,
  CategoryListResponse,
} from 'budget-contracts';
import type { Category } from 'budget-core';
import type { SessionUser } from 'shared-contracts';

import { SessionGuard } from '../auth/session.guard.js';
import { ActiveUserGuard } from '../auth/active-user.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { buildBudgetContext } from './build-budget-context.js';
import { TOKENS } from './tokens.js';

/** Maps a `budget-core` `Category` entity to its wire `CategoryResponse` shape. */
function toCategoryResponse(category: Category): CategoryResponse {
  return {
    id: category.id,
    name: category.name,
    ...(category.archivedAt !== undefined
      ? { archivedAt: category.archivedAt.toISOString() }
      : {}),
  };
}

/**
 * Thin HTTP surface for the budget vertical's `Category` operations.
 * Business logic (uniqueness, archive semantics) lives entirely in
 * `budget-application`; LIVR validation happens inside each service's
 * `validate` step (task 06) — this controller performs no validation of
 * its own, only request/response shape translation. Mirrors
 * `UserAdminController`'s guard/DI pattern.
 */
@Controller('budget/categories')
@UseGuards(SessionGuard, ActiveUserGuard)
export class CategoriesController {
  public constructor(
    @Inject(TOKENS.CreateCategory)
    private readonly createCategory: CreateCategoryService,
    @Inject(TOKENS.UpdateCategory)
    private readonly updateCategory: UpdateCategoryService,
    @Inject(TOKENS.ArchiveCategory)
    private readonly archiveCategory: ArchiveCategoryService,
    @Inject(TOKENS.ListCategories)
    private readonly listCategories: ListCategoriesService,
  ) {}

  @Get()
  public async list(
    @CurrentUser() user: SessionUser,
  ): Promise<CategoryListResponse> {
    const { data } = await this.listCategories.run(
      {},
      buildBudgetContext(user),
    );
    return data.map(toCategoryResponse);
  }

  @Post()
  public async create(
    @Body() body: CreateCategoryRequest,
    @CurrentUser() user: SessionUser,
  ): Promise<CategoryResponse> {
    const { data } = await this.createCategory.run(
      body,
      buildBudgetContext(user),
    );
    return toCategoryResponse(data);
  }

  @Patch(':id')
  public async update(
    @Param('id') id: string,
    @Body() body: UpdateCategoryRequest,
    @CurrentUser() user: SessionUser,
  ): Promise<CategoryResponse> {
    const { data } = await this.updateCategory.run(
      { id, name: body.name },
      buildBudgetContext(user),
    );
    return toCategoryResponse(data);
  }

  @Post(':id/archive')
  public async archive(
    @Param('id') id: string,
    @CurrentUser() user: SessionUser,
  ): Promise<CategoryResponse> {
    const { data } = await this.archiveCategory.run(
      { id },
      buildBudgetContext(user),
    );
    return toCategoryResponse(data);
  }
}
