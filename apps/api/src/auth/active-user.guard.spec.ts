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
  Injectable: () => () => undefined,
  ForbiddenException: MockForbiddenException,
}));

vi.mock('shared-contracts', () => ({
  UserStatus: { PENDING: 'pending', ACTIVE: 'active', REJECTED: 'rejected' },
}));

import { ActiveUserGuard } from './active-user.guard.js';
import { ForbiddenException } from '@nestjs/common';
import { UserStatus } from 'shared-contracts';
import type { ExecutionContext } from '@nestjs/common';
import type { SessionUser } from 'shared-contracts';

function makeContext(user?: SessionUser): ExecutionContext {
  const req = { user };
  const getRequest = vi.fn().mockReturnValue(req);
  const switchToHttp = vi.fn().mockReturnValue({ getRequest });
  return { switchToHttp } as unknown as ExecutionContext;
}

describe('ActiveUserGuard.canActivate', () => {
  let guard: ActiveUserGuard;

  beforeEach(() => {
    guard = new ActiveUserGuard();
  });

  it('returns true for an ACTIVE user', () => {
    const user: SessionUser = {
      id: 'u1',
      telegramId: '1',
      displayName: 'Alice',
      status: UserStatus.ACTIVE,
      roles: [],
    };
    expect(guard.canActivate(makeContext(user))).toBe(true);
  });

  it('throws ForbiddenException for a PENDING user', () => {
    const user: SessionUser = {
      id: 'u2',
      telegramId: '2',
      displayName: 'Bob',
      status: UserStatus.PENDING,
      roles: [],
    };
    expect(() => guard.canActivate(makeContext(user))).toThrow(
      ForbiddenException,
    );
  });

  it('throws ForbiddenException for a REJECTED user', () => {
    const user: SessionUser = {
      id: 'u3',
      telegramId: '3',
      displayName: 'Carol',
      status: UserStatus.REJECTED,
      roles: [],
    };
    expect(() => guard.canActivate(makeContext(user))).toThrow(
      ForbiddenException,
    );
  });

  it('throws ForbiddenException when req.user is undefined (SessionGuard not applied)', () => {
    expect(() => guard.canActivate(makeContext(undefined))).toThrow(
      ForbiddenException,
    );
  });

  it('throws ForbiddenException with no auth-state detail in the message', () => {
    let thrown: unknown;
    try {
      guard.canActivate(makeContext(undefined));
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(ForbiddenException);
    expect((thrown as Error).message).not.toMatch(
      /pending|rejected|active|not active/i,
    );
  });
});
