import { AuthenticationError } from 'shared-errors';
import { Role } from 'shared-contracts';
import { Workspace, WorkspaceMemberRole } from 'workspace-core';
import type { CallerIdentity, ServiceContext } from 'shared-kernel';
import {
  createInMemoryWorkspaceRepository,
  type IInMemoryWorkspaceRepository,
} from 'workspace-testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { ListWorkspacesService } from './list-workspaces.service.js';
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
  id: string,
  members: Workspace['members'],
): void {
  const now = new Date('2026-01-01T00:00:00.000Z');
  repository.seed(
    new Workspace({
      id,
      name: `Workspace ${id}`,
      members,
      version: 0,
      createdAt: now,
      updatedAt: now,
    }),
  );
}

describe('ListWorkspacesService', () => {
  let repository: IInMemoryWorkspaceRepository;
  let service: ListWorkspacesService;

  beforeEach(() => {
    repository = createInMemoryWorkspaceRepository();
    service = new ListWorkspacesService({ workspaceRepository: repository });
  });

  it('returns only workspaces containing memberUserId when provided', async () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    seedWorkspace(repository, 'c'.repeat(24), [
      {
        userId: 'a'.repeat(24),
        role: WorkspaceMemberRole.ADMIN,
        grantedAt: now,
        grantedBy: 'cli',
      },
    ]);
    seedWorkspace(repository, 'd'.repeat(24), [
      {
        userId: 'b'.repeat(24),
        role: WorkspaceMemberRole.ADMIN,
        grantedAt: now,
        grantedBy: 'cli',
      },
    ]);

    const outcome = await service.run(
      { memberUserId: 'a'.repeat(24) },
      buildContext(SUPERADMIN_CALLER),
    );

    expect(outcome.data.map((workspace) => workspace.id)).toStrictEqual([
      'c'.repeat(24),
    ]);
  });

  it('returns every workspace when memberUserId is omitted', async () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    seedWorkspace(repository, 'c'.repeat(24), [
      {
        userId: 'a'.repeat(24),
        role: WorkspaceMemberRole.ADMIN,
        grantedAt: now,
        grantedBy: 'cli',
      },
    ]);
    seedWorkspace(repository, 'd'.repeat(24), [
      {
        userId: 'b'.repeat(24),
        role: WorkspaceMemberRole.ADMIN,
        grantedAt: now,
        grantedBy: 'cli',
      },
    ]);

    const outcome = await service.run({}, buildContext(SUPERADMIN_CALLER));

    expect(outcome.data).toHaveLength(2);
  });

  it('rejects a non-superadmin ACTIVE caller with AuthenticationError', async () => {
    await expect(
      service.run({}, buildContext(NON_SUPERADMIN_CALLER)),
    ).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('rejects a non-superadmin caller with the exact message set-user-status.service.ts throws', async () => {
    await expect(
      service.run({}, buildContext(NON_SUPERADMIN_CALLER)),
    ).rejects.toThrow('Only an admin may approve or reject a user.');
  });
});
