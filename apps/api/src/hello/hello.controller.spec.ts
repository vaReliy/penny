import { beforeEach, describe, it, expect, vi } from 'vitest';

// Shared mock class for ForbiddenException — available inside vi.mock factory via vi.hoisted.
const MockForbiddenException = vi.hoisted(() => {
  class ForbiddenException extends Error {
    public override readonly name = 'ForbiddenException';
    constructor() {
      super();
    }
  }
  return ForbiddenException;
});

vi.mock('@nestjs/common', () => ({
  Controller: () => () => undefined,
  Get: () => () => undefined,
  UseGuards: () => () => undefined,
  // Injectable and ForbiddenException are needed by the real ActiveUserGuard below.
  Injectable: () => () => undefined,
  ForbiddenException: MockForbiddenException,
}));

vi.mock('../auth/current-user.decorator.js', () => ({
  CurrentUser: () => () => undefined,
}));

vi.mock('../auth/session.guard.js', () => ({
  SessionGuard: class {},
}));

// active-user.guard.js is intentionally NOT mocked so the real guard logic
// can be verified in the guard-chain describe block below.

import { HelloController } from './hello.controller.js';
import { ActiveUserGuard } from '../auth/active-user.guard.js';
import { ForbiddenException } from '@nestjs/common'; // resolves to MockForbiddenException
import type { ExecutionContext } from '@nestjs/common';
import type { SessionUser } from 'shared-contracts';

function makeGuardContext(user?: SessionUser): ExecutionContext {
  const req = { user };
  const getRequest = vi.fn().mockReturnValue(req);
  const switchToHttp = vi.fn().mockReturnValue({ getRequest });
  return { switchToHttp } as unknown as ExecutionContext;
}

describe('HelloController', () => {
  const controller = new HelloController();

  it('returns greeting and telegramId for user Alice', () => {
    const user: SessionUser = {
      id: 'u1',
      telegramId: '123',
      displayName: 'Alice',
      status: 'active',
      roles: [],
    };

    const result = controller.hello(user);

    expect(result).toEqual({ greeting: 'Hello, Alice!', telegramId: '123' });
  });

  it('returns greeting and telegramId for user Bob', () => {
    const user: SessionUser = {
      id: 'u2',
      telegramId: '456',
      displayName: 'Bob',
      status: 'active',
      roles: [],
    };

    const result = controller.hello(user);

    expect(result).toEqual({ greeting: 'Hello, Bob!', telegramId: '456' });
  });
});

describe('GET /hello — ActiveUserGuard enforces ACTIVE status', () => {
  let guard: ActiveUserGuard;

  beforeEach(() => {
    guard = new ActiveUserGuard();
  });

  it('ACTIVE user: guard returns true and handler produces greeting', () => {
    const user: SessionUser = {
      id: 'u3',
      telegramId: '789',
      displayName: 'Carol',
      status: 'active',
      roles: [],
    };
    expect(guard.canActivate(makeGuardContext(user))).toBe(true);

    const controller = new HelloController();
    expect(controller.hello(user)).toEqual({
      greeting: 'Hello, Carol!',
      telegramId: '789',
    });
  });

  it('PENDING user: guard throws ForbiddenException (403), not UnauthorizedException (401)', () => {
    const user: SessionUser = {
      id: 'u4',
      telegramId: '101',
      displayName: 'Dave',
      status: 'pending',
      roles: [],
    };
    expect(() => guard.canActivate(makeGuardContext(user))).toThrow(
      ForbiddenException,
    );
  });
});
