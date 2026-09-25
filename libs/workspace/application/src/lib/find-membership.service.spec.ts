import { AuthenticationError } from 'shared-errors';
import { UserStatus } from 'shared-contracts';
import { Workspace, WorkspaceMemberRole } from 'workspace-core';
import type { CallerIdentity, ServiceContext } from 'shared-kernel';
import {
  createInMemoryWorkspaceRepository,
  type IInMemoryWorkspaceRepository,
} from 'workspace-testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { FindMembershipService } from './find-membership.service.js';

const CALLER_ID = 'a'.repeat(24);

const CALLER: CallerIdentity = {
  userId: CALLER_ID,
  status: UserStatus.ACTIVE,
  roles: [],
};

function buildContext(caller: CallerIdentity | null): ServiceContext {
  return { config: {}, caller };
}

describe('FindMembershipService', () => {
  let repository: IInMemoryWorkspaceRepository;
  let service: FindMembershipService;

  beforeEach(() => {
    repository = createInMemoryWorkspaceRepository();
    service = new FindMembershipService({ workspaceRepository: repository });
  });

  it('returns null for a malformed workspaceId', async () => {
    const outcome = await service.run(
      { workspaceId: 'not-an-object-id' },
      buildContext(CALLER),
    );

    expect(outcome.data).toBeNull();
  });

  it('returns null for a nonexistent workspaceId', async () => {
    const outcome = await service.run(
      { workspaceId: 'd'.repeat(24) },
      buildContext(CALLER),
    );

    expect(outcome.data).toBeNull();
  });

  it('returns null when the caller is not a member', async () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    repository.seed(
      new Workspace({
        id: 'c'.repeat(24),
        name: 'The Garbuzovs',
        members: [
          {
            userId: 'b'.repeat(24),
            role: WorkspaceMemberRole.ADMIN,
            grantedAt: now,
            grantedBy: 'cli',
          },
        ],
        version: 0,
        createdAt: now,
        updatedAt: now,
      }),
    );

    const outcome = await service.run(
      { workspaceId: 'c'.repeat(24) },
      buildContext(CALLER),
    );

    expect(outcome.data).toBeNull();
  });

  it('returns the membership record when the caller is a member', async () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    repository.seed(
      new Workspace({
        id: 'c'.repeat(24),
        name: 'The Garbuzovs',
        members: [
          {
            userId: CALLER_ID,
            role: WorkspaceMemberRole.ADMIN,
            grantedAt: now,
            grantedBy: 'cli',
          },
        ],
        version: 0,
        createdAt: now,
        updatedAt: now,
      }),
    );

    const outcome = await service.run(
      { workspaceId: 'c'.repeat(24) },
      buildContext(CALLER),
    );

    expect(outcome.data).toStrictEqual({
      workspaceId: 'c'.repeat(24),
      role: WorkspaceMemberRole.ADMIN,
      grantedAt: now,
    });
  });

  it('rejects a null caller with AuthenticationError', async () => {
    await expect(
      service.run({ workspaceId: 'c'.repeat(24) }, buildContext(null)),
    ).rejects.toBeInstanceOf(AuthenticationError);
  });
});
