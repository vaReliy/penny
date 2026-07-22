import { AuthenticationError, DomainError } from 'shared-errors';
import { Category } from 'budget-core';
import { UserStatus } from 'shared-contracts';
import type { ICategoryRepository } from 'budget-core';
import type { CallerIdentity, ServiceContext } from 'shared-kernel';
import { ServiceValidationError } from 'shared-kernel';
import { beforeEach, describe, expect, it } from 'vitest';

import { CreateCategoryService } from './create-category.service.js';
import type { BudgetServiceConfig } from './budget-service-config.js';

/** In-memory `ICategoryRepository` fake, keyed by `id`. */
class FakeCategoryRepository implements ICategoryRepository {
  private readonly categoriesById = new Map<string, Category>();
  private nextId = 1;

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
    const id = entity.id || `cat-${this.nextId++}`;
    const persisted =
      id === entity.id
        ? entity
        : Category.create(id, entity.workspaceId, entity.name);
    this.categoriesById.set(id, persisted);
    return persisted;
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

describe('CreateCategoryService', () => {
  let repository: FakeCategoryRepository;
  let service: CreateCategoryService;

  beforeEach(() => {
    repository = new FakeCategoryRepository();
    service = new CreateCategoryService({ categoryRepository: repository });
  });

  it('creates a category in the caller workspace', async () => {
    const outcome = await service.run(
      { name: 'Groceries' },
      buildContext(ACTIVE_CALLER),
    );

    expect(outcome.data.name).toBe('Groceries');
    expect(outcome.data.workspaceId).toBe('ws-1');
    expect(outcome.data.id).not.toBe('');
  });

  it('throws ServiceValidationError when name is missing', async () => {
    await expect(
      service.run({} as { name: string }, buildContext(ACTIVE_CALLER)),
    ).rejects.toBeInstanceOf(ServiceValidationError);
  });

  it('throws AuthenticationError for a non-active caller', async () => {
    await expect(
      service.run({ name: 'Groceries' }, buildContext(PENDING_CALLER)),
    ).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('throws AuthenticationError when there is no caller at all', async () => {
    await expect(
      service.run({ name: 'Groceries' }, buildContext(null)),
    ).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('throws a DomainError conflict on a duplicate (case-insensitive) name', async () => {
    repository.seed(Category.create('cat-1', 'ws-1', 'Groceries'));

    const error = await service
      .run({ name: 'groceries' }, buildContext(ACTIVE_CALLER))
      .catch((err: unknown) => err);

    expect(error).toBeInstanceOf(DomainError);
    expect((error as DomainError).kind).toBe('CONFLICT');
  });

  it('allows the same name in a different workspace', async () => {
    repository.seed(Category.create('cat-1', 'ws-other', 'Groceries'));

    const outcome = await service.run(
      { name: 'Groceries' },
      buildContext(ACTIVE_CALLER),
    );

    expect(outcome.data.name).toBe('Groceries');
  });

  it('allows reusing an archived category name', async () => {
    repository.seed(
      Category.create('archived-cat', 'ws-1', 'Groceries').archive(new Date()),
    );

    const outcome = await service.run(
      { name: 'Groceries' },
      buildContext(ACTIVE_CALLER),
    );

    expect(outcome.data.name).toBe('Groceries');
    expect(outcome.data.id).not.toBe('archived-cat');
  });
});
