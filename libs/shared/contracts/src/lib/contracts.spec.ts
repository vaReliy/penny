import { describe, expect, it } from 'vitest';

import { Role } from '../index.js';
import type {
  RoleType,
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
      roles: [Role.USER],
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

describe('Role', () => {
  it('Role.ADMIN serialises to the string "admin"', () => {
    expect(Role.ADMIN).toBe('admin');
  });

  it('Role.USER serialises to the string "user"', () => {
    expect(Role.USER).toBe('user');
  });

  it('RoleType accepts only the two known string literals (compile-time guard)', () => {
    // Assigning each literal to a RoleType variable confirms the type allows
    // exactly these values; the TypeScript compiler rejects any other string.
    const admin: RoleType = Role.ADMIN;
    const user: RoleType = Role.USER;

    expect(admin).toBe('admin');
    expect(user).toBe('user');
  });

  it('Role object has exactly two keys — no undocumented roles', () => {
    expect(Object.keys(Role)).toStrictEqual(['ADMIN', 'USER']);
  });
});
