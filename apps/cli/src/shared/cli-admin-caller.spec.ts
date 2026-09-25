import { describe, expect, it } from 'vitest';
import { Role, UserStatus } from 'shared-contracts';

import { CLI_ADMIN_CALLER } from './cli-admin-caller.js';

describe('CLI_ADMIN_CALLER', () => {
  it('carries the SUPERADMIN role and an active status', () => {
    expect(CLI_ADMIN_CALLER.status).toBe(UserStatus.ACTIVE);
    expect(CLI_ADMIN_CALLER.roles).toEqual([Role.SUPERADMIN]);
  });
});
