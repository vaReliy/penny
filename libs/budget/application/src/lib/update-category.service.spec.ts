import { AuthenticationError, DomainError, NotFoundError } from 'shared-errors';
import { Category } from 'budget-core';
import { UserStatus } from 'shared-contracts';
import { ServiceValidationError } from 'shared-kernel';
import type { ICategoryRepository } from 'budget-core';
import type { CallerIdentity, ServiceContext } from 'shared-kernel';
import { beforeEach, describe, expect, it } from 'vitest';

import { UpdateCategoryService } from './update-category.service.js';
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

describe('UpdateCategoryService', () => {
  let repository: FakeCategoryRepository;
  let service: UpdateCategoryService;

  beforeEach(() => {
    repository = new FakeCategoryRepository();
    service = new UpdateCategoryService({ categoryRepository: repository });
  });

  const CATEGORY_ID = '507f1f77bcf86cd799439011';
  const OTHER_CATEGORY_ID = '507f1f77bcf86cd799439012';
  const UNKNOWN_CATEGORY_ID = '507f1f77bcf86cd799439099';

  it('renames an existing category', async () => {
    repository.seed(Category.create(CATEGORY_ID, 'ws-1', 'Groceries'));

    const outcome = await service.run(
      { id: CATEGORY_ID, name: 'Supermarket' },
      buildContext(ACTIVE_CALLER),
    );

    expect(outcome.data.name).toBe('Supermarket');
    const persisted = await repository.findById(CATEGORY_ID);
    expect(persisted?.name).toBe('Supermarket');
  });

  it('throws ServiceValidationError when id does not look like an id', async () => {
    await expect(
      service.run(
        { id: 'not-an-id', name: 'Supermarket' },
        buildContext(ACTIVE_CALLER),
      ),
    ).rejects.toBeInstanceOf(ServiceValidationError);
  });

  it('throws ServiceValidationError when name is missing', async () => {
    await expect(
      service.run(
        { id: '507f1f77bcf86cd799439011' } as {
          id: string;
          name: string;
        },
        buildContext(ACTIVE_CALLER),
      ),
    ).rejects.toBeInstanceOf(ServiceValidationError);
  });

  it('throws AuthenticationError for a non-active caller', async () => {
    repository.seed(Category.create(CATEGORY_ID, 'ws-1', 'Groceries'));

    await expect(
      service.run(
        { id: CATEGORY_ID, name: 'Supermarket' },
        buildContext(PENDING_CALLER),
      ),
    ).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('throws NotFoundError when the category does not exist in the workspace', async () => {
    await expect(
      service.run(
        { id: UNKNOWN_CATEGORY_ID, name: 'Supermarket' },
        buildContext(ACTIVE_CALLER),
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('throws a DomainError conflict when the new name collides with another category', async () => {
    repository.seed(Category.create(CATEGORY_ID, 'ws-1', 'Groceries'));
    repository.seed(Category.create(OTHER_CATEGORY_ID, 'ws-1', 'Supermarket'));

    const error = await service
      .run(
        { id: CATEGORY_ID, name: 'supermarket' },
        buildContext(ACTIVE_CALLER),
      )
      .catch((err: unknown) => err);

    expect(error).toBeInstanceOf(DomainError);
    expect((error as DomainError).kind).toBe('CONFLICT');
  });

  it('throws a DomainError conflict when renaming an already-archived category', async () => {
    repository.seed(
      Category.create(CATEGORY_ID, 'ws-1', 'Groceries').archive(),
    );

    const error = await service
      .run(
        { id: CATEGORY_ID, name: 'Supermarket' },
        buildContext(ACTIVE_CALLER),
      )
      .catch((err: unknown) => err);

    expect(error).toBeInstanceOf(DomainError);
    expect((error as DomainError).kind).toBe('CONFLICT');
  });

  it('allows a no-op rename to the same name', async () => {
    repository.seed(Category.create(CATEGORY_ID, 'ws-1', 'Groceries'));

    const outcome = await service.run(
      { id: CATEGORY_ID, name: 'Groceries' },
      buildContext(ACTIVE_CALLER),
    );

    expect(outcome.data.name).toBe('Groceries');
  });
});
