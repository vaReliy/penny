import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@nestjs/common', () => ({
  Controller: () => () => undefined,
  Get: () => () => undefined,
  Put: () => () => undefined,
  Body: () => () => undefined,
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
import { ServiceValidationError, registerLivrRules } from 'shared-kernel';
import { UserStatus } from 'shared-contracts';
import {
  UpsertMonthlyBudgetService,
  ListMonthlyBudgetsService,
} from 'budget-application';
import { MonthlyBudget } from 'budget-core';
import { DEFAULT_WORKSPACE_ID } from 'budget-contracts';
import { Money } from 'shared-util';
import { createFakeUserRepository } from 'identity-testing';
import type { IMonthlyBudgetRepository } from 'budget-core';
import type { SessionUser } from 'shared-contracts';
import type { ITokenIssuer } from 'identity-application';
import type { IUserRepository } from 'identity-core';

import { SessionGuard } from '../auth/session.guard.js';
import { AUTH_COOKIE_NAME } from '../auth/cookie.constants.js';
import { MonthlyBudgetsController } from './monthly-budgets.controller.js';

registerLivrRules();

const VALID_CATEGORY_ID = 'b'.repeat(24);
const VALID_BUDGET_ID = 'c'.repeat(24);
const MONTH = '2026-07';

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

function makeFakeMonthlyBudgetRepository(
  overrides: Partial<IMonthlyBudgetRepository> = {},
): IMonthlyBudgetRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    save: vi.fn(async (b: MonthlyBudget) => b),
    delete: vi.fn(),
    findByWorkspaceAndMonth: vi.fn().mockResolvedValue([]),
    findByWorkspaceCategoryMonth: vi.fn().mockResolvedValue(null),
    upsertAmount: vi.fn(),
    ...overrides,
  };
}

describe('MonthlyBudgetsController (real SessionGuard in the chain)', () => {
  let tokenIssuer: ITokenIssuer;
  let sessionUserRepository: IUserRepository;
  let sessionGuard: SessionGuard;

  let monthlyBudgetRepository: IMonthlyBudgetRepository;
  let controller: MonthlyBudgetsController;

  beforeEach(() => {
    tokenIssuer = {
      issue: vi.fn(),
      verify: vi.fn(),
    } as unknown as ITokenIssuer;

    sessionUserRepository = createFakeUserRepository({
      findById: vi.fn().mockResolvedValue(makeSessionRepoUser()),
    });

    sessionGuard = new SessionGuard(tokenIssuer, sessionUserRepository);

    monthlyBudgetRepository = makeFakeMonthlyBudgetRepository();

    controller = new MonthlyBudgetsController(
      new UpsertMonthlyBudgetService({ monthlyBudgetRepository }),
      new ListMonthlyBudgetsService({ monthlyBudgetRepository }),
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

  it('denies (defense in depth) when a non-active caller reaches the controller directly', async () => {
    const user = await authenticate(UserStatus.REJECTED);

    await expect(
      controller.list({ month: MONTH }, user),
    ).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('rejects an upsert with a malformed month via ServiceValidationError', async () => {
    const user = await authenticate();

    const error = await controller
      .upsert(
        {
          categoryId: VALID_CATEGORY_ID,
          month: 'not-a-month',
          amountMinorUnits: 10000,
        },
        user,
      )
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ServiceValidationError);
    expect((error as ServiceValidationError).fields).toHaveProperty('month');
  });

  it('lists monthly budgets for a given month', async () => {
    const user = await authenticate();
    const amount = Money.fromMinorUnits(50000, 'UAH');
    const budget = MonthlyBudget.create(
      VALID_BUDGET_ID,
      DEFAULT_WORKSPACE_ID,
      VALID_CATEGORY_ID,
      MONTH,
      amount,
    );
    (
      monthlyBudgetRepository.findByWorkspaceAndMonth as ReturnType<
        typeof vi.fn
      >
    ).mockResolvedValue([budget]);

    const result = await controller.list({ month: MONTH }, user);

    expect(result).toEqual([
      {
        id: VALID_BUDGET_ID,
        categoryId: VALID_CATEGORY_ID,
        month: MONTH,
        amount: amount.toJSON(),
      },
    ]);
  });

  it('upserts a monthly budget (create-or-replace)', async () => {
    const user = await authenticate();
    const amount = Money.fromMinorUnits(75000, 'UAH');
    const persisted = MonthlyBudget.create(
      VALID_BUDGET_ID,
      DEFAULT_WORKSPACE_ID,
      VALID_CATEGORY_ID,
      MONTH,
      amount,
    );
    (
      monthlyBudgetRepository.findByWorkspaceCategoryMonth as ReturnType<
        typeof vi.fn
      >
    ).mockResolvedValue(persisted);

    const result = await controller.upsert(
      { categoryId: VALID_CATEGORY_ID, month: MONTH, amountMinorUnits: 75000 },
      user,
    );

    expect(result).toEqual({
      id: VALID_BUDGET_ID,
      categoryId: VALID_CATEGORY_ID,
      month: MONTH,
      amount: amount.toJSON(),
    });
    expect(monthlyBudgetRepository.upsertAmount).toHaveBeenCalledWith(
      DEFAULT_WORKSPACE_ID,
      VALID_CATEGORY_ID,
      MONTH,
      expect.objectContaining({ currency: 'UAH' }),
    );
  });

  it('upsert is idempotent: repeating the same request twice produces the same response and calls upsertAmount with the same args each time', async () => {
    const user = await authenticate();
    const amount = Money.fromMinorUnits(75000, 'UAH');
    const persisted = MonthlyBudget.create(
      VALID_BUDGET_ID,
      DEFAULT_WORKSPACE_ID,
      VALID_CATEGORY_ID,
      MONTH,
      amount,
    );
    (
      monthlyBudgetRepository.findByWorkspaceCategoryMonth as ReturnType<
        typeof vi.fn
      >
    ).mockResolvedValue(persisted);

    const request = {
      categoryId: VALID_CATEGORY_ID,
      month: MONTH,
      amountMinorUnits: 75000,
    };

    const first = await controller.upsert(request, user);
    const second = await controller.upsert(request, user);

    expect(first).toEqual(second);
    expect(monthlyBudgetRepository.upsertAmount).toHaveBeenCalledTimes(2);
    const [firstCall, secondCall] = (
      monthlyBudgetRepository.upsertAmount as ReturnType<typeof vi.fn>
    ).mock.calls;
    expect(firstCall.slice(0, 3)).toEqual(secondCall.slice(0, 3));
  });
});
