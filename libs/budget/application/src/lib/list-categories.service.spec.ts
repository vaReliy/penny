import { AuthenticationError } from 'shared-errors';
import { Category } from 'budget-core';
import { UserStatus } from 'shared-contracts';
import type { ICategoryRepository } from 'budget-core';
import type { CallerIdentity, ServiceContext } from 'shared-kernel';
import { beforeEach, describe, expect, it } from 'vitest';

import { ListCategoriesService } from './list-categories.service.js';
import type { BudgetServiceConfig } from './budget-service-config.js';

/** In-memory `ICategoryRepository` fake, keyed by `id`. */
class FakeCategoryRepository implements ICategoryRepository {
  private readonly categoriesById = new Map<string, Category>();

  public seed(category: Category): void {
    this.categoriesById.set(category.id, category);
  }

  public async findById(id: string): Promise<Category | null> {
    return this.categoriesById.get(id) ?? null;
  }

  public async findByWorkspace(
    workspaceId: string,
    includeArchived = false,
  ): Promise<Category[]> {
    return [...this.categoriesById.values()].filter(
      (category) =>
        category.workspaceId === workspaceId &&
        (includeArchived || !category.isArchived()),
    );
  }

  public async findByIdInWorkspace(
    id: string,
    workspaceId: string,
  ): Promise<Category | null> {
    const category = this.categoriesById.get(id);
    return category && category.workspaceId === workspaceId ? category : null;
  }

  public async findByNameInWorkspace(
    name: string,
    workspaceId: string,
  ): Promise<Category | null> {
    for (const category of this.categoriesById.values()) {
      if (
        category.workspaceId === workspaceId &&
        !category.isArchived() &&
        category.name.toLowerCase() === name.toLowerCase()
      ) {
        return category;
      }
    }
    return null;
  }

  public async archive(id: string, workspaceId: string): Promise<void> {
    const category = this.categoriesById.get(id);
    if (category && category.workspaceId === workspaceId) {
      this.categoriesById.set(id, category.archive());
    }
  }

  public async save(entity: Category): Promise<Category> {
    this.categoriesById.set(entity.id, entity);
    return entity;
  }

  public async delete(id: string): Promise<void> {
    this.categoriesById.delete(id);
  }
}

function buildContext(
  caller: CallerIdentity | null,
): ServiceContext<BudgetServiceConfig> {
  return {
    config: { workspaceId: 'ws-1', defaultCurrency: 'UAH' },
    caller,
  };
}

const ACTIVE_CALLER: CallerIdentity = {
  userId: 'user-1',
  status: UserStatus.ACTIVE,
  roles: [],
};

const PENDING_CALLER: CallerIdentity = {
  userId: 'user-2',
  status: UserStatus.PENDING,
  roles: [],
};

describe('ListCategoriesService', () => {
  let repository: FakeCategoryRepository;
  let service: ListCategoriesService;

  beforeEach(() => {
    repository = new FakeCategoryRepository();
    service = new ListCategoriesService({ categoryRepository: repository });
  });

  it('lists non-archived categories in the caller workspace', async () => {
    repository.seed(Category.create('cat-1', 'ws-1', 'Groceries'));
    repository.seed(Category.create('cat-2', 'ws-1', 'Rent'));
    repository.seed(
      Category.create('cat-3', 'ws-1', 'Old').archive(new Date()),
    );
    repository.seed(Category.create('cat-4', 'ws-other', 'Other'));

    const outcome = await service.run({}, buildContext(ACTIVE_CALLER));

    expect(outcome.data.map((category) => category.name).sort()).toEqual([
      'Groceries',
      'Rent',
    ]);
  });

  it('returns an empty list when the workspace has no categories', async () => {
    const outcome = await service.run({}, buildContext(ACTIVE_CALLER));

    expect(outcome.data).toEqual([]);
  });

  it('throws AuthenticationError for a non-active caller', async () => {
    await expect(
      service.run({}, buildContext(PENDING_CALLER)),
    ).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('throws AuthenticationError when there is no caller at all', async () => {
    await expect(service.run({}, buildContext(null))).rejects.toBeInstanceOf(
      AuthenticationError,
    );
  });
});
