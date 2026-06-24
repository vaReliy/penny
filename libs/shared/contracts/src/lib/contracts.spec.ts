import { describe, expect, it } from 'vitest';

import type {
  SessionUser,
  TelegramLoginPayload,
  UserStatus,
} from '../index.js';

describe('shared contracts (types-only smoke check)', () => {
  it('allows constructing a value that satisfies SessionUser', () => {
    const status: UserStatus = 'active';
    const user: SessionUser = {
      id: 'user-1',
      telegramId: '123456789',
      displayName: 'Jane',
      status,
    };

    expect(user.status).toBe('active');
  });

  it('allows constructing a value that satisfies TelegramLoginPayload', () => {
    const payload: TelegramLoginPayload = {
      id: 123456789,
      firstName: 'Jane',
      authDate: 1_700_000_000,
      hash: 'deadbeef',
    };

    expect(payload.id).toBe(123456789);
  });
});
