import { beforeAll, describe, expect, it, vi } from 'vitest';

import type { ExecutionContext } from '@nestjs/common';
import { AuthenticationError } from 'shared-errors';
import type { SessionUser } from 'shared-contracts';

type DecoratorFactory = (data: unknown, ctx: ExecutionContext) => SessionUser;

// var is required here: vi.mock factories are hoisted above let/const declarations
// by Vitest's transform, so a let/const would be in TDZ when the factory runs.
// eslint-disable-next-line no-var
var capturedFactory: DecoratorFactory | undefined;

vi.mock('@nestjs/common', () => ({
  createParamDecorator: (factory: unknown) => {
    capturedFactory = factory as DecoratorFactory;
    return () => undefined;
  },
  Logger: vi.fn().mockImplementation(function (this: {
    error: ReturnType<typeof vi.fn>;
  }) {
    this.error = vi.fn();
  }),
}));

import './current-user.decorator.js';

function makeCtx(user?: SessionUser): ExecutionContext {
  const req: Record<string, unknown> = {};
  if (user !== undefined) req['user'] = user;
  const getRequest = vi.fn().mockReturnValue(req);
  const switchToHttp = vi.fn().mockReturnValue({ getRequest });
  return { switchToHttp } as unknown as ExecutionContext;
}

describe('CurrentUser decorator factory', () => {
  beforeAll(() => {
    expect(capturedFactory).toBeDefined();
  });

  it('returns req.user when SessionGuard has populated it', () => {
    const user = {
      id: 'u1',
      telegramId: '123',
      displayName: 'Alice',
      status: 'active',
      roles: [],
    } as unknown as SessionUser;

    expect(capturedFactory!(undefined, makeCtx(user))).toBe(user);
  });

  it('throws AuthenticationError when req.user is absent (SessionGuard not applied)', () => {
    expect(() => capturedFactory!(undefined, makeCtx(undefined))).toThrow(
      AuthenticationError,
    );
  });
});
