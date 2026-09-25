import { AuthenticationError, DomainError, NotFoundError } from 'shared-errors';
import { Role } from 'shared-contracts';
import { Workspace, WorkspaceMemberRole } from 'workspace-core';
import type { CallerIdentity, ServiceContext } from 'shared-kernel';
import {
  createInMemoryWorkspaceRepository,
  type IInMemoryWorkspaceRepository,
} from 'workspace-testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SetMemberRoleService } from './set-member-role.service.js';
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

function seedWorkspace(
  repository: IInMemoryWorkspaceRepository,
  members: Workspace['members'],
): Workspace {
  const now = new Date('2026-01-01T00:00:00.000Z');
  const persisted = new Workspace({
    id: 'c'.repeat(24),
    name: 'The Garbuzovs',
    members,
    version: 0,
    createdAt: now,
    updatedAt: now,
  });
  repository.seed(persisted);
  return persisted;
}

describe('SetMemberRoleService', () => {
  let repository: IInMemoryWorkspaceRepository;
  let service: SetMemberRoleService;

  beforeEach(() => {
    repository = createInMemoryWorkspaceRepository();
    service = new SetMemberRoleService({ workspaceRepository: repository });
  });

  it('returns changed: false and does not call save when the role is unchanged', async () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    seedWorkspace(repository, [
      {
        userId: 'a'.repeat(24),
        role: WorkspaceMemberRole.ADMIN,
        grantedAt: now,
        grantedBy: 'cli',
      },
      {
        userId: 'b'.repeat(24),
        role: WorkspaceMemberRole.MEMBER,
        grantedAt: now,
        grantedBy: 'cli',
      },
    ]);
    const saveSpy = vi.spyOn(repository, 'save');

    const outcome = await service.run(
      {
        workspaceId: 'c'.repeat(24),
        userId: 'b'.repeat(24),
        role: WorkspaceMemberRole.MEMBER,
      },
      buildContext(SUPERADMIN_CALLER),
    );

    expect(outcome.data.changed).toBe(false);
    expect(saveSpy).not.toHaveBeenCalled();
  });

  it('surfaces the aggregate invariant error when demoting the last admin', async () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    seedWorkspace(repository, [
      {
        userId: 'a'.repeat(24),
        role: WorkspaceMemberRole.ADMIN,
        grantedAt: now,
        grantedBy: 'cli',
      },
    ]);

    await expect(
      service.run(
        {
          workspaceId: 'c'.repeat(24),
          userId: 'a'.repeat(24),
          role: WorkspaceMemberRole.MEMBER,
        },
        buildContext(SUPERADMIN_CALLER),
      ),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it('rejects a non-superadmin ACTIVE caller with AuthenticationError', async () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    seedWorkspace(repository, [
      {
        userId: 'a'.repeat(24),
        role: WorkspaceMemberRole.ADMIN,
        grantedAt: now,
        grantedBy: 'cli',
      },
    ]);

    await expect(
      service.run(
        {
          workspaceId: 'c'.repeat(24),
          userId: 'a'.repeat(24),
          role: WorkspaceMemberRole.MEMBER,
        },
        buildContext(NON_SUPERADMIN_CALLER),
      ),
    ).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('rejects a non-superadmin caller with the exact message set-user-status.service.ts throws', async () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    seedWorkspace(repository, [
      {
        userId: 'a'.repeat(24),
        role: WorkspaceMemberRole.ADMIN,
        grantedAt: now,
        grantedBy: 'cli',
      },
    ]);

    await expect(
      service.run(
        {
          workspaceId: 'c'.repeat(24),
          userId: 'a'.repeat(24),
          role: WorkspaceMemberRole.MEMBER,
        },
        buildContext(NON_SUPERADMIN_CALLER),
      ),
    ).rejects.toThrow('Only an admin may approve or reject a user.');
  });

  it('throws NotFoundError for an unknown workspace', async () => {
    await expect(
      service.run(
        {
          workspaceId: 'd'.repeat(24),
          userId: 'a'.repeat(24),
          role: WorkspaceMemberRole.MEMBER,
        },
        buildContext(SUPERADMIN_CALLER),
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
