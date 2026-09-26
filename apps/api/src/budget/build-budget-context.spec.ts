import { describe, expect, it } from 'vitest';

import { UserStatus } from 'shared-contracts';
import type { SessionUser } from 'shared-contracts';

import { buildBudgetContext } from './build-budget-context.js';
import type { RequestWorkspaceMembership } from '../workspace/workspace-membership.js';

const user: SessionUser = {
  id: 'user-1',
  telegramId: '100',
  displayName: 'Alice',
  status: UserStatus.ACTIVE,
  roles: [],
};

describe('buildBudgetContext', () => {
  it.each(['a'.repeat(24), 'b'.repeat(24)])(
    "scopes config.workspaceId to the membership's workspace (%s)",
    (workspaceId) => {
      const membership: RequestWorkspaceMembership = {
        workspaceId,
        role: 'member',
      };

      expect(buildBudgetContext(user, membership).config.workspaceId).toBe(
        workspaceId,
      );
    },
  );

  it('builds the caller identity from the session user and keeps the MVP currency', () => {
    const context = buildBudgetContext(user, {
      workspaceId: 'a'.repeat(24),
      role: 'admin',
    });

    expect(context).toEqual({
      config: { workspaceId: 'a'.repeat(24), defaultCurrency: 'UAH' },
      caller: { userId: 'user-1', status: UserStatus.ACTIVE, roles: [] },
    });
  });
});
