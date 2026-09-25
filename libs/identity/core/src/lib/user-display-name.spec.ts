import { describe, expect, it } from 'vitest';

import { User } from './user.js';
import { UserStatus } from './user-status.js';
import { getUserDisplayName } from './user-display-name.js';

const baseProps = {
  id: 'user-1',
  telegramId: '111222333',
  status: UserStatus.ACTIVE,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('getUserDisplayName', () => {
  it('prefers firstName when present, even alongside lastName and username', () => {
    const user = new User({
      ...baseProps,
      firstName: 'Ada',
      lastName: 'Lovelace',
      username: 'ada',
    });
    expect(getUserDisplayName(user)).toBe('Ada');
  });

  it('falls back to username when firstName is absent', () => {
    const user = new User({ ...baseProps, username: 'ada' });
    expect(getUserDisplayName(user)).toBe('ada');
  });

  it('falls back to telegramId when neither firstName nor username is present', () => {
    const user = new User({ ...baseProps });
    expect(getUserDisplayName(user)).toBe('111222333');
  });
});
