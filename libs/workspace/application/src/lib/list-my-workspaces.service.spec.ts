import { AuthenticationError } from 'shared-errors';
import { UserStatus } from 'shared-contracts';
import { Workspace, WorkspaceMemberRole } from 'workspace-core';
import type { CallerIdentity, ServiceContext } from 'shared-kernel';
import {
  createInMemoryWorkspaceRepository,
  type IInMemoryWorkspaceRepository,
} from 'workspace-testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { ListMyWorkspacesService } from './list-my-workspaces.service.js';
import { SUPERADMIN_ROLE } from './workspace-authorization.js';

const CALLER_ID = 'a'.repeat(24);

const ACTIVE_CALLER: CallerIdentity = {
  userId: CALLER_ID,
  status: UserStatus.ACTIVE,
  roles: [],
};

const SUPERADMIN_CALLER: CallerIdentity = {
  userId: CALLER_ID,
  status: UserStatus.ACTIVE,
  roles: [SUPERADMIN_ROLE],
};

function buildContext(caller: CallerIdentity | null): ServiceContext {
  return { config: {}, caller };
}

function seedWorkspace(
  repository: IInMemoryWorkspaceRepository,
  id: string,
  name: string,
  grantedAt: Date,
): void {
  repository.seed(
    new Workspace({
      id,
      name,
      members: [
        {
          userId: CALLER_ID,
          role: WorkspaceMemberRole.MEMBER,
          grantedAt,
          grantedBy: 'cli',
        },
      ],
      version: 0,
      createdAt: grantedAt,
      updatedAt: grantedAt,
    }),
  );
}

describe('ListMyWorkspacesService', () => {
  let repository: IInMemoryWorkspaceRepository;
  let service: ListMyWorkspacesService;

  beforeEach(() => {
    repository = createInMemoryWorkspaceRepository();
    service = new ListMyWorkspacesService({ workspaceRepository: repository });
  });

  it('orders the caller workspaces by the caller grantedAt ascending, independent of creation order', async () => {
    // Creation order: 'second' created first (createdAt earlier) but granted later.
    seedWorkspace(
      repository,
      'c'.repeat(24),
      'second',
      new Date('2026-02-01T00:00:00.000Z'),
    );
    seedWorkspace(
      repository,
      'd'.repeat(24),
      'first',
      new Date('2026-01-01T00:00:00.000Z'),
    );

    const outcome = await service.run({}, buildContext(ACTIVE_CALLER));

    expect(outcome.data.map((entry) => entry.name)).toStrictEqual([
      'first',
      'second',
    ]);
  });

  it('returns [] for a SUPERADMIN caller with no memberships', async () => {
    const outcome = await service.run({}, buildContext(SUPERADMIN_CALLER));

    expect(outcome.data).toStrictEqual([]);
  });

  it('rejects a null caller with AuthenticationError', async () => {
    await expect(service.run({}, buildContext(null))).rejects.toBeInstanceOf(
      AuthenticationError,
    );
  });
});
