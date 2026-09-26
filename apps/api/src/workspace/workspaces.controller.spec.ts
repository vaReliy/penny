import 'reflect-metadata';

import { GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { registerLivrRules } from 'shared-kernel';
import { UserStatus } from 'shared-contracts';
import type { SessionUser } from 'shared-contracts';
import { ListMyWorkspacesService } from 'workspace-application';
import { Workspace, WorkspaceMemberRole } from 'workspace-core';
import type { Membership, WorkspaceMemberRoleType } from 'workspace-core';
import { createInMemoryWorkspaceRepository } from 'workspace-testing';

import { SessionGuard } from '../auth/session.guard.js';
import { ActiveUserGuard } from '../auth/active-user.guard.js';
import { WorkspacesController } from './workspaces.controller.js';

const CALLER_ID = 'caller-1';
const OTHER_USER_ID = 'other-1';
const EARLY = new Date('2026-01-10T08:00:00.000Z');
const MIDDLE = new Date('2026-03-15T12:30:00.000Z');
const LATE = new Date('2026-06-20T18:45:00.000Z');

const caller: SessionUser = {
  id: CALLER_ID,
  telegramId: '100',
  displayName: 'Caller',
  status: UserStatus.ACTIVE,
  roles: [],
};

function member(
  userId: string,
  role: WorkspaceMemberRoleType,
  grantedAt: Date,
): Membership {
  return { userId, role, grantedAt, grantedBy: userId };
}

function workspace(id: string, name: string, members: Membership[]): Workspace {
  return new Workspace({
    id,
    name,
    members,
    version: 0,
    createdAt: EARLY,
    updatedAt: EARLY,
  });
}

describe('WorkspacesController', () => {
  let controller: WorkspacesController;

  beforeAll(() => {
    registerLivrRules();
  });

  beforeEach(() => {
    const workspaceRepository = createInMemoryWorkspaceRepository();
    // Seeded out of grantedAt order, so the assertion proves the sort.
    workspaceRepository.seed(
      workspace('c'.repeat(24), 'Late', [
        member(CALLER_ID, WorkspaceMemberRole.MEMBER, LATE),
      ]),
    );
    workspaceRepository.seed(
      workspace('a'.repeat(24), 'Early', [
        member(OTHER_USER_ID, WorkspaceMemberRole.ADMIN, MIDDLE),
        member(CALLER_ID, WorkspaceMemberRole.ADMIN, EARLY),
      ]),
    );
    workspaceRepository.seed(
      workspace('b'.repeat(24), 'Middle', [
        member(CALLER_ID, WorkspaceMemberRole.MEMBER, MIDDLE),
      ]),
    );
    workspaceRepository.seed(
      workspace('d'.repeat(24), 'Foreign', [
        member(OTHER_USER_ID, WorkspaceMemberRole.ADMIN, EARLY),
      ]),
    );
    controller = new WorkspacesController(
      new ListMyWorkspacesService({ workspaceRepository }),
    );
  });

  it("returns the caller's workspaces as WorkspaceSummaryDto, ordered by the caller's grantedAt", async () => {
    await expect(controller.list(caller)).resolves.toEqual([
      {
        id: 'a'.repeat(24),
        name: 'Early',
        role: 'admin',
        grantedAt: '2026-01-10T08:00:00.000Z',
      },
      {
        id: 'b'.repeat(24),
        name: 'Middle',
        role: 'member',
        grantedAt: '2026-03-15T12:30:00.000Z',
      },
      {
        id: 'c'.repeat(24),
        name: 'Late',
        role: 'member',
        grantedAt: '2026-06-20T18:45:00.000Z',
      },
    ]);
  });

  it('returns an empty list to a SUPERADMIN who belongs to no workspace', async () => {
    const superadmin: SessionUser = {
      ...caller,
      id: 'superadmin-1',
      roles: ['superadmin'],
    };

    await expect(controller.list(superadmin)).resolves.toEqual([]);
  });

  it('is mounted at /workspaces behind SessionGuard then ActiveUserGuard', () => {
    expect(Reflect.getMetadata(PATH_METADATA, WorkspacesController)).toBe(
      'workspaces',
    );
    expect(Reflect.getMetadata(GUARDS_METADATA, WorkspacesController)).toEqual([
      SessionGuard,
      ActiveUserGuard,
    ]);
  });
});
