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
  Post: () => () => undefined,
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
import { AuthenticationError, NotFoundError } from 'shared-errors';
import { Role, UserStatus } from 'shared-contracts';
import { ApproveUserService, RejectUserService } from 'identity-application';
import { User } from 'identity-core';
import { createFakeUserRepository } from 'identity-testing';

import { SessionGuard } from '../auth/session.guard.js';
import { ActiveUserGuard } from '../auth/active-user.guard.js';
import { AUTH_COOKIE_NAME } from '../auth/cookie.constants.js';
import { UserAdminController } from './user-admin.controller.js';
import type { ApiConfig } from '../config/api-config.js';
import type { ITokenIssuer } from 'identity-application';
import type { IUserRepository } from 'identity-core';
import type { SessionUser } from 'shared-contracts';

/**
 * Real `SessionGuard` fed a fake `ExecutionContext`, mirroring
 * `session.guard.spec.ts`'s harness. Used to populate `req.user` the same
 * way the real HTTP pipeline does, so tests exercise the actual
 * `SessionUser -> CallerIdentity` mapping rather than a hand-built stub.
 */
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

function makeDomainUser(
  overrides: Partial<{
    id: string;
    status: (typeof UserStatus)[keyof typeof UserStatus];
  }> = {},
): User {
  const now = new Date();
  return new User({
    id: 'user-1',
    telegramId: '123456',
    firstName: 'Alice',
    username: 'alice',
    status: UserStatus.ACTIVE,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
}

describe('UserAdminController (real SessionGuard in the chain)', () => {
  let tokenIssuer: ITokenIssuer;
  let sessionUserRepository: IUserRepository;
  let guard: SessionGuard;

  let userRepository: IUserRepository;
  let approveUser: ApproveUserService;
  let rejectUser: RejectUserService;
  let controller: UserAdminController;
  let config: ApiConfig;

  beforeEach(() => {
    tokenIssuer = {
      issue: vi.fn(),
      verify: vi.fn(),
    } as unknown as ITokenIssuer;

    sessionUserRepository = createFakeUserRepository({
      findById: vi.fn().mockResolvedValue(makeSessionRepoUser()),
    });

    guard = new SessionGuard(tokenIssuer, sessionUserRepository);

    userRepository = createFakeUserRepository({
      findById: vi.fn(),
      updateStatus: vi.fn(),
    });

    approveUser = new ApproveUserService({ userRepository });
    rejectUser = new RejectUserService({ userRepository });

    config = {
      mongoUri: '',
      mongoDbName: '',
      jwtSecret: 'secret',
      botToken: 'token',
      telegramBotUsername: 'test_bot',
      port: 3000,
      mode: 'development',
    };

    controller = new UserAdminController(approveUser, rejectUser, config);
  });

  it('SessionGuard throws AuthenticationError when there is no auth cookie', async () => {
    const { ctx } = makeContext(undefined);
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      AuthenticationError,
    );
  });

  it('denies (does not silently allow) when the authenticated caller has an empty roles array', async () => {
    (tokenIssuer.verify as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'user-1',
      status: UserStatus.ACTIVE,
      roles: [],
    });
    const { ctx, getReqUser } = makeContext(`${AUTH_COOKIE_NAME}=valid-jwt`);
    await guard.canActivate(ctx);
    const sessionUser = getReqUser() as Parameters<
      UserAdminController['approve']
    >[1];

    await expect(
      controller.approve('target-user', sessionUser),
    ).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('denies when the authenticated caller has a non-admin role', async () => {
    (tokenIssuer.verify as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'user-1',
      status: UserStatus.ACTIVE,
      roles: [Role.USER],
    });
    const { ctx, getReqUser } = makeContext(`${AUTH_COOKIE_NAME}=valid-jwt`);
    await guard.canActivate(ctx);
    const sessionUser = getReqUser() as Parameters<
      UserAdminController['approve']
    >[1];

    await expect(
      controller.approve('target-user', sessionUser),
    ).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('denies (does not silently allow) reject when the authenticated caller has an empty roles array', async () => {
    (tokenIssuer.verify as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'user-1',
      status: UserStatus.ACTIVE,
      roles: [],
    });
    const { ctx, getReqUser } = makeContext(`${AUTH_COOKIE_NAME}=valid-jwt`);
    await guard.canActivate(ctx);
    const sessionUser = getReqUser() as Parameters<
      UserAdminController['reject']
    >[1];

    await expect(
      controller.reject('target-user', sessionUser),
    ).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('denies reject when the authenticated caller has a non-admin role', async () => {
    (tokenIssuer.verify as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'user-1',
      status: UserStatus.ACTIVE,
      roles: [Role.USER],
    });
    const { ctx, getReqUser } = makeContext(`${AUTH_COOKIE_NAME}=valid-jwt`);
    await guard.canActivate(ctx);
    const sessionUser = getReqUser() as Parameters<
      UserAdminController['reject']
    >[1];

    await expect(
      controller.reject('target-user', sessionUser),
    ).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('allows and transitions the target user when the authenticated caller has SUPERADMIN_ROLE (approve)', async () => {
    (tokenIssuer.verify as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'admin-1',
      status: UserStatus.ACTIVE,
      roles: [Role.SUPERADMIN],
    });
    const { ctx, getReqUser } = makeContext(`${AUTH_COOKIE_NAME}=valid-jwt`);
    await guard.canActivate(ctx);
    const sessionUser = getReqUser() as Parameters<
      UserAdminController['approve']
    >[1];

    const pendingUser = makeDomainUser({
      id: 'target-user',
      status: UserStatus.PENDING,
    });
    (userRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
      pendingUser,
    );
    (
      userRepository.updateStatus as ReturnType<typeof vi.fn>
    ).mockImplementation(
      (id: string, status: UserStatus) =>
        new User({
          id,
          telegramId: pendingUser.telegramId,
          firstName: pendingUser.firstName,
          status,
          createdAt: pendingUser.createdAt,
          updatedAt: new Date(),
        }),
    );

    const result = await controller.approve('target-user', sessionUser);

    expect(result).toEqual({
      userId: 'target-user',
      status: UserStatus.ACTIVE,
    });
  });

  it('allows and transitions the target user when the authenticated caller has SUPERADMIN_ROLE (reject)', async () => {
    (tokenIssuer.verify as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'admin-1',
      status: UserStatus.ACTIVE,
      roles: [Role.SUPERADMIN],
    });
    const { ctx, getReqUser } = makeContext(`${AUTH_COOKIE_NAME}=valid-jwt`);
    await guard.canActivate(ctx);
    const sessionUser = getReqUser() as Parameters<
      UserAdminController['reject']
    >[1];

    const pendingUser = makeDomainUser({
      id: 'target-user',
      status: UserStatus.PENDING,
    });
    (userRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
      pendingUser,
    );
    (
      userRepository.updateStatus as ReturnType<typeof vi.fn>
    ).mockImplementation(
      (id: string, status: UserStatus) =>
        new User({
          id,
          telegramId: pendingUser.telegramId,
          firstName: pendingUser.firstName,
          status,
          createdAt: pendingUser.createdAt,
          updatedAt: new Date(),
        }),
    );

    const result = await controller.reject('target-user', sessionUser);

    expect(result).toEqual({
      userId: 'target-user',
      status: UserStatus.REJECTED,
    });
  });

  it('propagates NotFoundError for an unknown userId even with an admin caller', async () => {
    (tokenIssuer.verify as ReturnType<typeof vi.fn>).mockReturnValue({
      sub: 'admin-1',
      status: UserStatus.ACTIVE,
      roles: [Role.SUPERADMIN],
    });
    const { ctx, getReqUser } = makeContext(`${AUTH_COOKIE_NAME}=valid-jwt`);
    await guard.canActivate(ctx);
    const sessionUser = getReqUser() as Parameters<
      UserAdminController['approve']
    >[1];

    (userRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
      null,
    );

    await expect(
      controller.approve('unknown-user', sessionUser),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

/**
 * @UseGuards(SessionGuard, ActiveUserGuard) chain on UserAdminController.
 * Mirrors hello.controller.spec.ts's guard-chain pattern: the real
 * ActiveUserGuard is exercised directly against a fake ExecutionContext to
 * prove it denies an authenticated ADMIN caller whose session status is not
 * ACTIVE — a case SessionGuard alone (and the role check inside the
 * services) would never catch, since both only look at roles/JWT validity,
 * not account status.
 */
describe('UserAdminController — ActiveUserGuard denies non-active ADMIN callers', () => {
  let guard: ActiveUserGuard;

  beforeEach(() => {
    guard = new ActiveUserGuard();
  });

  function makeGuardContext(user?: SessionUser): ExecutionContext {
    const req = { user };
    const getRequest = vi.fn().mockReturnValue(req);
    const switchToHttp = vi.fn().mockReturnValue({ getRequest });
    return { switchToHttp } as unknown as ExecutionContext;
  }

  it.each([UserStatus.PENDING, UserStatus.REJECTED])(
    'denies an ADMIN-role caller with status=%s, even though SessionGuard would have passed them',
    (status) => {
      const adminUser: SessionUser = {
        id: 'admin-1',
        telegramId: '999',
        displayName: 'Admin',
        status,
        roles: [Role.SUPERADMIN],
      };

      expect(() => guard.canActivate(makeGuardContext(adminUser))).toThrow(
        ForbiddenException,
      );
    },
  );

  it('allows an ADMIN-role caller with status=ACTIVE', () => {
    const adminUser: SessionUser = {
      id: 'admin-1',
      telegramId: '999',
      displayName: 'Admin',
      status: UserStatus.ACTIVE,
      roles: [Role.SUPERADMIN],
    };

    expect(guard.canActivate(makeGuardContext(adminUser))).toBe(true);
  });
});
