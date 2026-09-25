import { AuthenticationError } from 'shared-errors';
import { Role } from 'shared-contracts';
import { WorkspaceMemberRole } from 'workspace-core';
import type { CallerIdentity, ServiceContext } from 'shared-kernel';
import {
  createInMemoryWorkspaceRepository,
  type IInMemoryWorkspaceRepository,
} from 'workspace-testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { CreateWorkspaceService } from './create-workspace.service.js';
import { SUPERADMIN_ROLE } from './workspace-authorization.js';

const SUPERADMIN_CALLER: CallerIdentity = {
  userId: 'superadmin-1',
  status: 'active',
  roles: [SUPERADMIN_ROLE],
};

const NON_SUPERADMIN_CALLER: CallerIdentity = {
  userId: 'member-1',
  status: 'active',
  roles: [Role.USER],
};

function buildContext(caller: CallerIdentity | null): ServiceContext {
  return { config: {}, caller };
}

describe('CreateWorkspaceService', () => {
  let repository: IInMemoryWorkspaceRepository;
  let service: CreateWorkspaceService;

  beforeEach(() => {
    repository = createInMemoryWorkspaceRepository();
    service = new CreateWorkspaceService({ workspaceRepository: repository });
  });

  it('creates a workspace whose only member is adminUserId with role admin and grantedBy from input', async () => {
    const outcome = await service.run(
      {
        name: 'The Garbuzovs',
        adminUserId: 'a'.repeat(24),
        grantedBy: 'cli',
      },
      buildContext(SUPERADMIN_CALLER),
    );

    expect(outcome.data.id).not.toBe('');
    expect(outcome.data.members).toHaveLength(1);
    expect(outcome.data.members[0]).toMatchObject({
      userId: 'a'.repeat(24),
      role: WorkspaceMemberRole.ADMIN,
      grantedBy: 'cli',
    });
  });

  it('rejects a non-superadmin ACTIVE caller with AuthenticationError', async () => {
    await expect(
      service.run(
        { name: 'X', adminUserId: 'a'.repeat(24), grantedBy: 'cli' },
        buildContext(NON_SUPERADMIN_CALLER),
      ),
    ).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('rejects a non-superadmin caller with the exact message set-user-status.service.ts throws', async () => {
    await expect(
      service.run(
        { name: 'X', adminUserId: 'a'.repeat(24), grantedBy: 'cli' },
        buildContext(NON_SUPERADMIN_CALLER),
      ),
    ).rejects.toThrow('Only an admin may approve or reject a user.');
  });

  it('fails validation for a whitespace-only name', async () => {
    await expect(
      service.run(
        { name: '   ', adminUserId: 'a'.repeat(24), grantedBy: 'cli' },
        buildContext(SUPERADMIN_CALLER),
      ),
    ).rejects.toThrow();
  });
});
