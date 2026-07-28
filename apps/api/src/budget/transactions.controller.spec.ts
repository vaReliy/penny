import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@nestjs/common', () => ({
  Controller: () => () => undefined,
  Get: () => () => undefined,
  Post: () => () => undefined,
  Body: () => () => undefined,
  Param: () => () => undefined,
  Query: () => () => undefined,
  Inject: () => () => undefined,
  UseGuards: () => () => undefined,
  Injectable: () => () => undefined,
  Logger: class {
    error(): void {
      /* noop */
    }
  },
  createParamDecorator: () => () => () => undefined,
}));

import type { ExecutionContext } from '@nestjs/common';
import { AuthenticationError, NotFoundError } from 'shared-errors';
import { ServiceValidationError, registerLivrRules } from 'shared-kernel';
import { UserStatus } from 'shared-contracts';
import {
  RecordTransactionService,
  ListTransactionsService,
  GetTransactionService,
} from 'budget-application';
import { Category, Transaction } from 'budget-core';
import { DEFAULT_WORKSPACE_ID, TransactionType } from 'budget-contracts';
import { Money } from 'shared-util';
import { createFakeUserRepository } from 'identity-testing';
import type { ICategoryRepository, ITransactionRepository } from 'budget-core';
import type { SessionUser } from 'shared-contracts';
import type { TransactionFilterQuery } from 'budget-contracts';
import type { ITokenIssuer } from 'identity-application';
import type { IUserRepository } from 'identity-core';

import { SessionGuard } from '../auth/session.guard.js';
import { AUTH_COOKIE_NAME } from '../auth/cookie.constants.js';
import { TransactionsController } from './transactions.controller.js';

registerLivrRules();

const VALID_ACCOUNT_ID = 'a'.repeat(24);
const VALID_CATEGORY_ID = 'b'.repeat(24);
const VALID_TRANSACTION_ID = 'c'.repeat(24);

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
  const category = Category.create(
    VALID_CATEGORY_ID,
    DEFAULT_WORKSPACE_ID,
    'Groceries',
  );
  return {
    findById: vi.fn().mockResolvedValue(null),
    save: vi.fn(async (c: Category) => c),
    delete: vi.fn(),
    findByWorkspace: vi.fn().mockResolvedValue([]),
    findByIdInWorkspace: vi.fn().mockResolvedValue(category),
    findByNameInWorkspace: vi.fn().mockResolvedValue(null),
    archive: vi.fn(),
    ...overrides,
  };
}

function makeFakeTransactionRepository(
  overrides: Partial<ITransactionRepository> = {},
): ITransactionRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    save: vi.fn(async (t: Transaction) => t),
    delete: vi.fn(),
    findByWorkspace: vi.fn().mockResolvedValue([]),
    findByIdInWorkspace: vi.fn().mockResolvedValue(null),
    existsForCategory: vi.fn().mockResolvedValue(false),
    updateInWorkspace: vi.fn(),
    deleteInWorkspace: vi.fn(),
    sumAmountsByType: vi.fn().mockResolvedValue({ income: 0n, expense: 0n }),
    sumExpenseByCategory: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe('TransactionsController (real SessionGuard/ActiveUserGuard in the chain)', () => {
  let tokenIssuer: ITokenIssuer;
  let sessionUserRepository: IUserRepository;
  let sessionGuard: SessionGuard;

  let categoryRepository: ICategoryRepository;
  let transactionRepository: ITransactionRepository;
  let controller: TransactionsController;

  beforeEach(() => {
    tokenIssuer = {
      issue: vi.fn(),
      verify: vi.fn(),
    } as unknown as ITokenIssuer;

    sessionUserRepository = createFakeUserRepository({
      findById: vi.fn().mockResolvedValue(makeSessionRepoUser()),
    });

    sessionGuard = new SessionGuard(tokenIssuer, sessionUserRepository);

    categoryRepository = makeFakeCategoryRepository();
    transactionRepository = makeFakeTransactionRepository();

    controller = new TransactionsController(
      new RecordTransactionService({
        transactionRepository,
        categoryRepository,
      }),
      new ListTransactionsService({ transactionRepository }),
      new GetTransactionService({ transactionRepository }),
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

  it('denies (defense in depth) when a non-active caller reaches the controller directly', async () => {
    const user = await authenticate(UserStatus.PENDING);

    await expect(
      controller.record(
        {
          accountId: VALID_ACCOUNT_ID,
          categoryId: VALID_CATEGORY_ID,
          type: TransactionType.EXPENSE,
          amountMinorUnits: 5000,
          date: '2026-07-15',
        },
        user,
      ),
    ).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('records an expense transaction for an active caller', async () => {
    const user = await authenticate();
    (transactionRepository.save as ReturnType<typeof vi.fn>).mockImplementation(
      async (t: Transaction) =>
        Transaction.create(
          VALID_TRANSACTION_ID,
          t.workspaceId,
          t.accountId,
          t.categoryId,
          t.type,
          t.amount,
          t.date,
          t.createdBy,
          t.description,
          t.createdAt,
        ),
    );

    const result = await controller.record(
      {
        accountId: VALID_ACCOUNT_ID,
        categoryId: VALID_CATEGORY_ID,
        type: TransactionType.EXPENSE,
        amountMinorUnits: 5000,
        date: '2026-07-15',
        description: 'Milk and bread',
      },
      user,
    );

    expect(result.id).toBe(VALID_TRANSACTION_ID);
    expect(result.amount).toEqual(Money.fromMinorUnits(5000, 'UAH').toJSON());
    expect(result.createdBy).toBe('user-1');
    expect(transactionRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: VALID_ACCOUNT_ID,
        categoryId: VALID_CATEGORY_ID,
      }),
    );
  });

  it('never trusts a client-supplied createdBy — the LIVR schema strips it and execute() stamps the caller', async () => {
    const user = await authenticate();
    let savedTransaction: Transaction | undefined;
    (transactionRepository.save as ReturnType<typeof vi.fn>).mockImplementation(
      async (t: Transaction) => {
        savedTransaction = t;
        return t;
      },
    );

    await controller.record(
      {
        accountId: VALID_ACCOUNT_ID,
        categoryId: VALID_CATEGORY_ID,
        type: TransactionType.EXPENSE,
        amountMinorUnits: 5000,
        date: '2026-07-15',
        // Hostile field, absent from CreateTransactionRequest — a client
        // cannot spoof another user's audit trail.
        ...({ createdBy: 'someone-else' } as Record<string, unknown>),
      } as Parameters<TransactionsController['record']>[0],
      user,
    );

    expect(savedTransaction?.createdBy).toBe('user-1');
  });

  it('rejects a hostile operator-object categoryId with a ServiceValidationError (LIVR `like` fuse)', async () => {
    const user = await authenticate();

    const error = await controller
      .record(
        {
          accountId: VALID_ACCOUNT_ID,
          categoryId: { $gt: '' } as unknown as string,
          type: TransactionType.EXPENSE,
          amountMinorUnits: 5000,
          date: '2026-07-15',
        },
        user,
      )
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ServiceValidationError);
    expect((error as ServiceValidationError).fields).toHaveProperty(
      'categoryId',
    );
  });

  it('rejects a float amountMinorUnits with a ServiceValidationError', async () => {
    const user = await authenticate();

    const error = await controller
      .record(
        {
          accountId: VALID_ACCOUNT_ID,
          categoryId: VALID_CATEGORY_ID,
          type: TransactionType.EXPENSE,
          amountMinorUnits: 50.5,
          date: '2026-07-15',
        },
        user,
      )
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ServiceValidationError);
    expect((error as ServiceValidationError).fields).toHaveProperty(
      'amountMinorUnits',
    );
  });

  it('rejects an oversized description with a ServiceValidationError', async () => {
    const user = await authenticate();

    const error = await controller
      .record(
        {
          accountId: VALID_ACCOUNT_ID,
          categoryId: VALID_CATEGORY_ID,
          type: TransactionType.EXPENSE,
          amountMinorUnits: 5000,
          date: '2026-07-15',
          description: 'x'.repeat(501),
        },
        user,
      )
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ServiceValidationError);
    expect((error as ServiceValidationError).fields).toHaveProperty(
      'description',
    );
  });

  it('rejects recording against a foreign/missing category', async () => {
    const user = await authenticate();
    (
      categoryRepository.findByIdInWorkspace as ReturnType<typeof vi.fn>
    ).mockResolvedValue(null);

    await expect(
      controller.record(
        {
          accountId: VALID_ACCOUNT_ID,
          categoryId: VALID_CATEGORY_ID,
          type: TransactionType.EXPENSE,
          amountMinorUnits: 5000,
          date: '2026-07-15',
        },
        user,
      ),
    ).rejects.toThrow();
  });

  it('lists transactions scoped to a month filter', async () => {
    const user = await authenticate();
    const transaction = Transaction.create(
      VALID_TRANSACTION_ID,
      DEFAULT_WORKSPACE_ID,
      VALID_ACCOUNT_ID,
      VALID_CATEGORY_ID,
      TransactionType.EXPENSE,
      Money.fromMinorUnits(2500, 'UAH'),
      new Date('2026-07-10'),
      'user-1',
    );
    (
      transactionRepository.findByWorkspace as ReturnType<typeof vi.fn>
    ).mockResolvedValue([transaction]);

    const result = await controller.list({ month: '2026-07' }, user);

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(VALID_TRANSACTION_ID);
  });

  it('lists transactions when the query arrives as a null-prototype object', async () => {
    const user = await authenticate();
    const transaction = Transaction.create(
      VALID_TRANSACTION_ID,
      DEFAULT_WORKSPACE_ID,
      VALID_ACCOUNT_ID,
      VALID_CATEGORY_ID,
      TransactionType.EXPENSE,
      Money.fromMinorUnits(2500, 'UAH'),
      new Date('2026-07-10'),
      'user-1',
    );
    (
      transactionRepository.findByWorkspace as ReturnType<typeof vi.fn>
    ).mockResolvedValue([transaction]);

    // Express builds `req.query` with `Object.create(null)`; an object
    // literal (as every other spec here uses) is not a faithful stand-in.
    const query = Object.assign(Object.create(null), {
      month: '2026-07',
    }) as TransactionFilterQuery;

    const result = await controller.list(query, user);

    expect(result).toHaveLength(1);
  });

  it('rejects a list call with neither month nor from/to (unbounded scan guard)', async () => {
    const user = await authenticate();

    await expect(controller.list({}, user)).rejects.toBeInstanceOf(
      ServiceValidationError,
    );
  });

  it('fetches a single transaction by id', async () => {
    const user = await authenticate();
    const transaction = Transaction.create(
      VALID_TRANSACTION_ID,
      DEFAULT_WORKSPACE_ID,
      VALID_ACCOUNT_ID,
      VALID_CATEGORY_ID,
      TransactionType.EXPENSE,
      Money.fromMinorUnits(2500, 'UAH'),
      new Date('2026-07-10'),
      'user-1',
    );
    (
      transactionRepository.findByIdInWorkspace as ReturnType<typeof vi.fn>
    ).mockResolvedValue(transaction);

    const result = await controller.get(VALID_TRANSACTION_ID, user);

    expect(result.id).toBe(VALID_TRANSACTION_ID);
  });

  it('returns a generic NotFoundError for a transaction in another workspace (indistinguishable from missing)', async () => {
    const user = await authenticate();
    (
      transactionRepository.findByIdInWorkspace as ReturnType<typeof vi.fn>
    ).mockResolvedValue(null);

    await expect(
      controller.get(VALID_TRANSACTION_ID, user),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
