import { beforeAll, describe, expect, it, vi } from 'vitest';

import type { ExecutionContext } from '@nestjs/common';

import type { RequestWorkspaceMembership } from '../workspace/workspace-membership.js';

type DecoratorFactory = (
  data: unknown,
  ctx: ExecutionContext,
) => RequestWorkspaceMembership;

const MockForbiddenException = vi.hoisted(
  () =>
    class ForbiddenException extends Error {
      public override readonly name = 'ForbiddenException';
    },
);

// var is required here: vi.mock factories are hoisted above let/const declarations
// by Vitest's transform, so a let/const would be in TDZ when the factory runs.
// eslint-disable-next-line no-var
var capturedFactory: DecoratorFactory | undefined;

vi.mock('@nestjs/common', () => ({
  createParamDecorator: (factory: unknown) => {
    capturedFactory = factory as DecoratorFactory;
    return () => undefined;
  },
  ForbiddenException: MockForbiddenException,
  Logger: vi.fn().mockImplementation(function (this: {
    error: ReturnType<typeof vi.fn>;
  }) {
    this.error = vi.fn();
  }),
}));

import './current-membership.decorator.js';

function makeCtx(membership?: RequestWorkspaceMembership): ExecutionContext {
  const req: Record<string, unknown> = {};
  if (membership !== undefined) req['workspaceMembership'] = membership;
  const getRequest = vi.fn().mockReturnValue(req);
  const switchToHttp = vi.fn().mockReturnValue({ getRequest });
  return { switchToHttp } as unknown as ExecutionContext;
}

function factory(): DecoratorFactory {
  if (!capturedFactory) {
    throw new Error('createParamDecorator was never called');
  }
  return capturedFactory;
}

describe('CurrentMembership decorator factory', () => {
  beforeAll(() => {
    expect(capturedFactory).toBeDefined();
  });

  it('returns req.workspaceMembership when WorkspaceMemberGuard has populated it', () => {
    const membership: RequestWorkspaceMembership = {
      workspaceId: 'a'.repeat(24),
      role: 'member',
    };

    expect(factory()(undefined, makeCtx(membership))).toBe(membership);
  });

  it('throws ForbiddenException when req.workspaceMembership is absent (guard not applied)', () => {
    expect(() => factory()(undefined, makeCtx(undefined))).toThrow(
      MockForbiddenException,
    );
  });
});
