import { describe, it, expect, vi } from 'vitest';

vi.mock('@nestjs/common', () => ({
  Controller: () => () => undefined,
  Get: () => () => undefined,
  UseGuards: () => () => undefined,
}));

vi.mock('../auth/current-user.decorator.js', () => ({
  CurrentUser: () => () => undefined,
}));

vi.mock('../auth/session.guard.js', () => ({
  SessionGuard: class {},
}));

import { HelloController } from './hello.controller.js';
import type { SessionUser } from 'shared-contracts';

describe('HelloController', () => {
  const controller = new HelloController();

  it('returns greeting and telegramId for user Alice', () => {
    const user: SessionUser = {
      id: 'u1',
      telegramId: '123',
      displayName: 'Alice',
      status: 'active',
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
    };

    const result = controller.hello(user);

    expect(result).toEqual({ greeting: 'Hello, Bob!', telegramId: '456' });
  });
});
