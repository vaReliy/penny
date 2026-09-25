import { describe, expect, it } from 'vitest';
import { User, UserStatus } from 'identity-core';
import { NotFoundError } from 'shared-errors';
import { createFakeUserRepository } from 'identity-testing';

import { resolveUserByTelegramId } from './resolve-user-by-telegram-id.js';

function makeUser(telegramId: string): User {
  return new User({
    id: 'user-1',
    telegramId,
    status: UserStatus.PENDING,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe('resolveUserByTelegramId', () => {
  it('returns the user found by telegramId', async () => {
    const user = makeUser('123456789');
    const repo = createFakeUserRepository({
      findByTelegramId: async (telegramId) =>
        telegramId === user.telegramId ? user : null,
    });

    const result = await resolveUserByTelegramId(repo, '123456789');

    expect(result).toBe(user);
  });

  it('throws NotFoundError with the exact expected message when no user is found', async () => {
    const repo = createFakeUserRepository({
      findByTelegramId: async () => null,
    });

    await expect(resolveUserByTelegramId(repo, '999999999')).rejects.toThrow(
      new NotFoundError('User with Telegram ID 999999999 not found'),
    );
  });
});
