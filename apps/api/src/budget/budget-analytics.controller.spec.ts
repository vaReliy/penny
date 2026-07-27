import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@nestjs/common', () => ({
  Controller: () => () => undefined,
  Get: () => () => undefined,
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
import { AuthenticationError } from 'shared-errors';
import { registerLivrRules } from 'shared-kernel';
import { UserStatus } from 'shared-contracts';
import {
  GetBalanceService,
  GetPlannerSummaryService,
  GetHistoryChartService,
} from 'budget-application';
import { Account, Category } from 'budget-core';
import { DEFAULT_WORKSPACE_ID } from 'budget-contracts';
import { Money } from 'shared-util';
import { createFakeUserRepository } from 'identity-testing';
import type { IAccountRepository, ICategoryRepository } from 'budget-core';
import type { ITransactionRepository } from 'budget-core';
import type { IMonthlyBudgetRepository } from 'budget-core';
import type { SessionUser } from 'shared-contracts';
import type { ITokenIssuer } from 'identity-application';
import type { IUserRepository } from 'identity-core';

import { SessionGuard } from '../auth/session.guard.js';
import { AUTH_COOKIE_NAME } from '../auth/cookie.constants.js';
import { BudgetAnalyticsController } from './budget-analytics.controller.js';

registerLivrRules();

const VALID_ACCOUNT_ID = 'a'.repeat(24);
const VALID_CATEGORY_ID = 'b'.repeat(24);

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

function makeFakeAccountRepository(
  overrides: Partial<IAccountRepository> = {},
): IAccountRepository {
  const account = Account.create(
    VALID_ACCOUNT_ID,
    DEFAULT_WORKSPACE_ID,
    'Main',
    'UAH',
  );
  return {
    findById: vi.fn().mockResolvedValue(null),
    save: vi.fn(async (a: Account) => a),
    delete: vi.fn(),
    findByWorkspace: vi.fn().mockResolvedValue([account]),
    findByIdInWorkspace: vi.fn().mockResolvedValue(account),
    findOrCreateDefault: vi.fn().mockResolvedValue(account),
    ...overrides,
  };
}

function makeFakeTransactionRepository(
  overrides: Partial<ITransactionRepository> = {},
): ITransactionRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    save: vi.fn(async (t) => t),
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

function makeFakeMonthlyBudgetRepository(
  overrides: Partial<IMonthlyBudgetRepository> = {},
): IMonthlyBudgetRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    save: vi.fn(async (b) => b),
    delete: vi.fn(),
    findByWorkspaceAndMonth: vi.fn().mockResolvedValue([]),
    findByWorkspaceCategoryMonth: vi.fn().mockResolvedValue(null),
    upsertAmount: vi.fn(),
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

describe('BudgetAnalyticsController (real SessionGuard/ActiveUserGuard in the chain)', () => {
  let tokenIssuer: ITokenIssuer;
  let sessionUserRepository: IUserRepository;
  let sessionGuard: SessionGuard;

  let accountRepository: IAccountRepository;
  let transactionRepository: ITransactionRepository;
  let monthlyBudgetRepository: IMonthlyBudgetRepository;
  let categoryRepository: ICategoryRepository;
  let controller: BudgetAnalyticsController;

  beforeEach(() => {
    tokenIssuer = {
      issue: vi.fn(),
      verify: vi.fn(),
    } as unknown as ITokenIssuer;

    sessionUserRepository = createFakeUserRepository({
      findById: vi.fn().mockResolvedValue(makeSessionRepoUser()),
    });

    sessionGuard = new SessionGuard(tokenIssuer, sessionUserRepository);

    accountRepository = makeFakeAccountRepository();
    transactionRepository = makeFakeTransactionRepository();
    monthlyBudgetRepository = makeFakeMonthlyBudgetRepository();
    categoryRepository = makeFakeCategoryRepository();

    controller = new BudgetAnalyticsController(
      accountRepository,
      new GetBalanceService({ accountRepository, transactionRepository }),
      new GetPlannerSummaryService({
        monthlyBudgetRepository,
        transactionRepository,
      }),
      new GetHistoryChartService({ transactionRepository, categoryRepository }),
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

    await expect(controller.balance(user)).rejects.toBeInstanceOf(
      AuthenticationError,
    );
  });

  it('returns a zero balance for the resolved default account with no transactions', async () => {
    const user = await authenticate();

    const result = await controller.balance(user);

    expect(result).toEqual({
      accountId: VALID_ACCOUNT_ID,
      balance: Money.zero('UAH').toJSON(),
    });
    expect(accountRepository.findOrCreateDefault).toHaveBeenCalledWith(
      DEFAULT_WORKSPACE_ID,
      'Main',
      'UAH',
    );
  });

  it('derives a non-zero balance from income/expense totals', async () => {
    const user = await authenticate();
    (
      transactionRepository.sumAmountsByType as ReturnType<typeof vi.fn>
    ).mockResolvedValue({ income: 10000n, expense: 4000n });

    const result = await controller.balance(user);

    expect(result.balance).toEqual(Money.fromMinorUnits(6000, 'UAH').toJSON());
  });

  it('returns an empty planner summary for a month with no budgets/spend', async () => {
    const user = await authenticate();

    const result = await controller.summary({ month: '2026-07' }, user);

    expect(result).toEqual({ month: '2026-07', categories: [] });
  });

  it('returns a planner summary shape matching the contract on seeded data', async () => {
    const user = await authenticate();
    (
      monthlyBudgetRepository.findByWorkspaceAndMonth as ReturnType<
        typeof vi.fn
      >
    ).mockResolvedValue([
      {
        categoryId: VALID_CATEGORY_ID,
        amount: Money.fromMinorUnits(50000, 'UAH'),
      },
    ]);
    (
      transactionRepository.sumExpenseByCategory as ReturnType<typeof vi.fn>
    ).mockResolvedValue([{ categoryId: VALID_CATEGORY_ID, total: 20000n }]);

    const result = await controller.summary({ month: '2026-07' }, user);

    expect(result.categories).toEqual([
      {
        categoryId: VALID_CATEGORY_ID,
        budgeted: Money.fromMinorUnits(50000, 'UAH').toJSON(),
        spent: Money.fromMinorUnits(20000, 'UAH').toJSON(),
        remaining: Money.fromMinorUnits(30000, 'UAH').toJSON(),
      },
    ]);
    // `percent` is an application-layer-only field, never on the wire response.
    expect(result.categories[0]).not.toHaveProperty('percent');
  });

  it('returns an empty chart for a workspace with no expense transactions', async () => {
    const user = await authenticate();

    const result = await controller.chart({ month: '2026-07' }, user);

    expect(result).toEqual([]);
  });

  it('returns chart entries sorted by value, descending', async () => {
    const user = await authenticate();
    const category = Category.create(
      VALID_CATEGORY_ID,
      DEFAULT_WORKSPACE_ID,
      'Groceries',
    );
    (
      categoryRepository.findByWorkspace as ReturnType<typeof vi.fn>
    ).mockResolvedValue([category]);
    (
      transactionRepository.sumExpenseByCategory as ReturnType<typeof vi.fn>
    ).mockResolvedValue([{ categoryId: VALID_CATEGORY_ID, total: 15000n }]);

    const result = await controller.chart({}, user);

    expect(result).toEqual([
      {
        categoryId: VALID_CATEGORY_ID,
        name: 'Groceries',
        value: Money.fromMinorUnits(15000, 'UAH').toJSON(),
      },
    ]);
  });
});
