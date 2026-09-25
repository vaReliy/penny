import { AuthenticationError, NotFoundError } from 'shared-errors';
import { Role } from 'shared-contracts';
import { Workspace, WorkspaceMemberRole } from 'workspace-core';
import type { WorkspaceMemberRoleType } from 'workspace-core';
import type { CallerIdentity, ServiceContext } from 'shared-kernel';
import {
  createInMemoryWorkspaceRepository,
  type IInMemoryWorkspaceRepository,
} from 'workspace-testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { AddMemberService } from './add-member.service.js';
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

function seedWorkspace(repository: IInMemoryWorkspaceRepository): Workspace {
  const workspace = Workspace.create('The Garbuzovs', 'a'.repeat(24), 'cli');
  const persisted = new Workspace({
    id: 'c'.repeat(24),
    name: workspace.name,
    members: workspace.members,
    version: 0,
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt,
  });
  repository.seed(persisted);
  return persisted;
}

describe('AddMemberService', () => {
  let repository: IInMemoryWorkspaceRepository;
  let service: AddMemberService;

  beforeEach(() => {
    repository = createInMemoryWorkspaceRepository();
    service = new AddMemberService({ workspaceRepository: repository });
  });

  it('adds the user as member when role is omitted', async () => {
    const workspace = seedWorkspace(repository);

    const outcome = await service.run(
      { workspaceId: workspace.id, userId: 'b'.repeat(24), grantedBy: 'cli' },
      buildContext(SUPERADMIN_CALLER),
    );

    const added = outcome.data.membershipOf('b'.repeat(24));
    expect(added?.role).toBe(WorkspaceMemberRole.MEMBER);
  });

  it('fails validation before authorize for an invalid role', async () => {
    const workspace = seedWorkspace(repository);

    await expect(
      service.run(
        {
          workspaceId: workspace.id,
          userId: 'b'.repeat(24),
          role: 'owner' as unknown as WorkspaceMemberRoleType,
          grantedBy: 'cli',
        },
        buildContext(NON_SUPERADMIN_CALLER),
      ),
    ).rejects.not.toBeInstanceOf(AuthenticationError);
  });

  it('rejects a non-superadmin ACTIVE caller with AuthenticationError', async () => {
    const workspace = seedWorkspace(repository);

    await expect(
      service.run(
        { workspaceId: workspace.id, userId: 'b'.repeat(24), grantedBy: 'cli' },
        buildContext(NON_SUPERADMIN_CALLER),
      ),
    ).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('rejects a non-superadmin caller with the exact message set-user-status.service.ts throws', async () => {
    const workspace = seedWorkspace(repository);

    await expect(
      service.run(
        { workspaceId: workspace.id, userId: 'b'.repeat(24), grantedBy: 'cli' },
        buildContext(NON_SUPERADMIN_CALLER),
      ),
    ).rejects.toThrow('Only an admin may approve or reject a user.');
  });

  it('throws NotFoundError for an unknown workspace', async () => {
    await expect(
      service.run(
        {
          workspaceId: 'd'.repeat(24),
          userId: 'b'.repeat(24),
          grantedBy: 'cli',
        },
        buildContext(SUPERADMIN_CALLER),
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
