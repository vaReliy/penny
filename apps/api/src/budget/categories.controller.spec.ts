import { beforeEach, describe, expect, it, vi } from 'vitest';

// vi.hoisted runs before imports so the class is available inside vi.mock's factory.
const MockForbiddenException = vi.hoisted(() => {
  class ForbiddenException extends Error {
    public override readonly name = 'ForbiddenException';
    constructor(message?: string) {
      super(message ?? '');
    }
  }
  return ForbiddenException;
});

vi.mock('@nestjs/common', () => ({
  Controller: () => () => undefined,
  Get: () => () => undefined,
  Post: () => () => undefined,
  Patch: () => () => undefined,
  Body: () => () => undefined,
  Param: () => () => undefined,
  Inject: () => () => undefined,
  UseGuards: () => () => undefined,
  Injectable: () => () => undefined,
  ForbiddenException: MockForbiddenException,
  Logger: class {
    error(): void {
      /* noop */
    }
  },
  createParamDecorator: () => () => () => undefined,
}));

import type { ExecutionContext } from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common'; // resolves to MockForbiddenException
import { AuthenticationError } from 'shared-errors';
import { ServiceValidationError } from 'shared-kernel';
import { registerLivrRules } from 'shared-kernel';
import { UserStatus } from 'shared-contracts';
import {
  CreateCategoryService,
  UpdateCategoryService,
  ArchiveCategoryService,
  ListCategoriesService,
} from 'budget-application';
import { Category } from 'budget-core';
import { DEFAULT_WORKSPACE_ID } from 'budget-contracts';
import { createFakeUserRepository } from 'identity-testing';
import type { ICategoryRepository } from 'budget-core';
import type { SessionUser } from 'shared-contracts';

import { SessionGuard } from '../auth/session.guard.js';
import { ActiveUserGuard } from '../auth/active-user.guard.js';
import { AUTH_COOKIE_NAME } from '../auth/cookie.constants.js';
import { CategoriesController } from './categories.controller.js';
import type { ITokenIssuer } from 'identity-application';
import type { IUserRepository } from 'identity-core';

registerLivrRules();

const VALID_ID = 'a'.repeat(24);

function makeContext(cookieHeader?: string): {
  ctx: ExecutionContext;
  getReqUser: () => unknown;
} {
  let reqUser: unknown;
  const req = {
    headers: { cookie: cookieHeader },
    get user() {
      return reqUser;
    },
    set user(v: unknown) {
      reqUser = v;
    },
  };
  const res = { clearCookie: vi.fn() };
  const getRequest = vi.fn().mockReturnValue(req);
  const getResponse = vi.fn().mockReturnValue(res);
  const switchToHttp = vi.fn().mockReturnValue({ getRequest, getResponse });
  const ctx = { switchToHttp } as unknown as ExecutionContext;
  return { ctx, getReqUser: () => reqUser };
}

function makeSessionRepoUser(
  overrides: Partial<{ id: string; status: string }> = {},
) {
  return {
    id: 'user-1',
    telegramId: '123456',
    firstName: 'Alice',
    username: 'alice',
    status: UserStatus.ACTIVE,
    ...overrides,
  };
}

function makeFakeCategoryRepository(
  overrides: Partial<ICategoryRepository> = {},
): ICategoryRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    save: vi.fn(async (c: Category) => c),
    delete: vi.fn(),
    findByWorkspace: vi.fn().mockResolvedValue([]),
    findByIdInWorkspace: vi.fn().mockResolvedValue(null),
    findByNameInWorkspace: vi.fn().mockResolvedValue(null),
    archive: vi.fn(),
    ...overrides,
  };
}

describe('CategoriesController (real SessionGuard/ActiveUserGuard in the chain)', () => {
  let tokenIssuer: ITokenIssuer;
  let sessionUserRepository: IUserRepository;
  let sessionGuard: SessionGuard;
  let activeUserGuard: ActiveUserGuard;

  let categoryRepository: ICategoryRepository;
  let controller: CategoriesController;

  beforeEach(() => {
    tokenIssuer = {
      issue: vi.fn(),
      verify: vi.fn(),
    } as unknown as ITokenIssuer;

    sessionUserRepository = createFakeUserRepository({
      findById: vi.fn().mockResolvedValue(makeSessionRepoUser()),
    });

    sessionGuard = new SessionGuard(tokenIssuer, sessionUserRepository);
    activeUserGuard = new ActiveUserGuard();

    categoryRepository = makeFakeCategoryRepository();

    controller = new CategoriesController(
      new CreateCategoryService({ categoryRepository }),
      new UpdateCategoryService({ categoryRepository }),
      new ArchiveCategoryService({ categoryRepository }),
      new ListCategoriesService({ categoryRepository }),
    );
  });

  async function authenticate(
    status: string = UserStatus.ACTIVE,
  ): Promise<SessionUser> {
    (tokenIssuer.verify as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'user-1',
      status,
      roles: [],
    });
    (
      sessionUserRepository.findById as ReturnType<typeof vi.fn>
    ).mockResolvedValue(makeSessionRepoUser({ status }));
    const { ctx, getReqUser } = makeContext(`${AUTH_COOKIE_NAME}=valid-jwt`);
    await sessionGuard.canActivate(ctx);
    return getReqUser() as SessionUser;
  }

  it('SessionGuard throws the same opaque AuthenticationError with no auth cookie', async () => {
    const { ctx } = makeContext(undefined);
    await expect(sessionGuard.canActivate(ctx)).rejects.toBeInstanceOf(
      AuthenticationError,
    );
  });

  it('SessionGuard throws the same opaque AuthenticationError for an invalid token', async () => {
    (tokenIssuer.verify as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('bad token');
    });
    const { ctx } = makeContext(`${AUTH_COOKIE_NAME}=garbage`);
    await expect(sessionGuard.canActivate(ctx)).rejects.toBeInstanceOf(
      AuthenticationError,
    );
  });

  it.each([UserStatus.PENDING, UserStatus.REJECTED])(
    'ActiveUserGuard denies a caller with status=%s',
    (status) => {
      const user: SessionUser = {
        id: 'user-1',
        telegramId: '999',
        displayName: 'User',
        status,
        roles: [],
      };
      const req = { user };
      const getRequest = vi.fn().mockReturnValue(req);
      const switchToHttp = vi.fn().mockReturnValue({ getRequest });
      const ctx = { switchToHttp } as unknown as ExecutionContext;

      expect(() => activeUserGuard.canActivate(ctx)).toThrow(
        ForbiddenException,
      );
    },
  );

  it('denies (defense in depth) when a non-active caller reaches the controller directly', async () => {
    const user = await authenticate(UserStatus.PENDING);

    await expect(controller.list(user)).rejects.toBeInstanceOf(
      AuthenticationError,
    );
  });

  it('creates a category for an active caller', async () => {
    const user = await authenticate();
    (categoryRepository.save as ReturnType<typeof vi.fn>).mockImplementation(
      async (c: Category) => Category.create(VALID_ID, c.workspaceId, c.name),
    );

    const result = await controller.create({ name: 'Groceries' }, user);

    expect(result).toEqual({ id: VALID_ID, name: 'Groceries' });
    expect(categoryRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Groceries',
        workspaceId: DEFAULT_WORKSPACE_ID,
      }),
    );
  });

  it('rejects category creation with a ServiceValidationError carrying LIVR field errors for a bad payload', async () => {
    const user = await authenticate();

    const error = await controller
      .create({ name: 'a'.repeat(121) }, user)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ServiceValidationError);
    expect((error as ServiceValidationError).fields).toHaveProperty('name');
  });

  it('lists categories for the workspace', async () => {
    const user = await authenticate();
    const existing = Category.create(VALID_ID, DEFAULT_WORKSPACE_ID, 'Rent');
    (
      categoryRepository.findByWorkspace as ReturnType<typeof vi.fn>
    ).mockResolvedValue([existing]);

    const result = await controller.list(user);

    expect(result).toEqual([{ id: VALID_ID, name: 'Rent' }]);
  });

  it('renames a category', async () => {
    const user = await authenticate();
    const existing = Category.create(VALID_ID, DEFAULT_WORKSPACE_ID, 'Rent');
    (
      categoryRepository.findByIdInWorkspace as ReturnType<typeof vi.fn>
    ).mockResolvedValue(existing);
    (categoryRepository.save as ReturnType<typeof vi.fn>).mockImplementation(
      async (c: Category) => c,
    );

    const result = await controller.update(VALID_ID, { name: 'Housing' }, user);

    expect(result).toEqual({ id: VALID_ID, name: 'Housing' });
  });

  it('archives a category and reflects archivedAt in the response', async () => {
    const user = await authenticate();
    const existing = Category.create(VALID_ID, DEFAULT_WORKSPACE_ID, 'Rent');
    (
      categoryRepository.findByIdInWorkspace as ReturnType<typeof vi.fn>
    ).mockResolvedValue(existing);

    const result = await controller.archive(VALID_ID, user);

    expect(result.id).toBe(VALID_ID);
    expect(result.archivedAt).toEqual(expect.any(String));
    expect(categoryRepository.archive).toHaveBeenCalledWith(
      VALID_ID,
      DEFAULT_WORKSPACE_ID,
    );
  });

  it('archiving an already-archived category is rejected (no hard delete, one-way transition)', async () => {
    const user = await authenticate();
    const archived = Category.create(
      VALID_ID,
      DEFAULT_WORKSPACE_ID,
      'Rent',
    ).archive();
    (
      categoryRepository.findByIdInWorkspace as ReturnType<typeof vi.fn>
    ).mockResolvedValue(archived);

    await expect(controller.archive(VALID_ID, user)).rejects.toMatchObject({
      statusCode: 409,
    });
  });
});
