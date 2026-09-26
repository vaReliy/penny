import 'reflect-metadata';

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { registerLivrRules } from 'shared-kernel';
import { UserStatus } from 'shared-contracts';
import type { SessionUser } from 'shared-contracts';
import { FindMembershipService } from 'workspace-application';
import { Workspace, WorkspaceMemberRole } from 'workspace-core';
import { createInMemoryWorkspaceRepository } from 'workspace-testing';
import type { IInMemoryWorkspaceRepository } from 'workspace-testing';

import {
  WORKSPACE_NOT_FOUND_MESSAGE,
  WorkspaceMemberGuard,
} from './workspace-member.guard.js';

const WORKSPACE_ID = 'a'.repeat(24);
const OTHER_WORKSPACE_ID = 'b'.repeat(24);
const GHOST_WORKSPACE_ID = 'c'.repeat(24);
const MEMBER_ID = 'member-1';
const OUTSIDER_ID = 'outsider-1';
const GRANTED_AT = new Date('2026-09-01T00:00:00.000Z');

function sessionUser(
  id: string,
  roles: SessionUser['roles'] = [],
): SessionUser {
  return {
    id,
    telegramId: `tg-${id}`,
    displayName: id,
    status: UserStatus.ACTIVE,
    roles,
  };
}

function seedWorkspace(
  repository: IInMemoryWorkspaceRepository,
  id: string,
  memberId: string,
): void {
  repository.seed(
    new Workspace({
      id,
      name: `ws ${id}`,
      members: [
        {
          userId: memberId,
          role: WorkspaceMemberRole.MEMBER,
          grantedAt: GRANTED_AT,
          grantedBy: memberId,
        },
      ],
      version: 0,
      createdAt: GRANTED_AT,
      updatedAt: GRANTED_AT,
    }),
  );
}

function makeContext(
  workspaceId: string | undefined,
  user?: SessionUser,
): { ctx: ExecutionContext; req: Record<string, unknown> } {
  const req: Record<string, unknown> = {
    params: workspaceId === undefined ? {} : { workspaceId },
  };
  if (user) req['user'] = user;
  const ctx = {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
  return { ctx, req };
}

async function captureError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('expected the guard to reject');
}

describe('WorkspaceMemberGuard', () => {
  let guard: WorkspaceMemberGuard;

  beforeAll(() => {
    registerLivrRules();
  });

  beforeEach(() => {
    const workspaceRepository = createInMemoryWorkspaceRepository();
    seedWorkspace(workspaceRepository, WORKSPACE_ID, MEMBER_ID);
    seedWorkspace(workspaceRepository, OTHER_WORKSPACE_ID, OUTSIDER_ID);
    guard = new WorkspaceMemberGuard(
      new FindMembershipService({ workspaceRepository }),
    );
  });

  it('allows a member and attaches the membership to the request', async () => {
    const { ctx, req } = makeContext(WORKSPACE_ID, sessionUser(MEMBER_ID));

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(req['workspaceMembership']).toEqual({
      workspaceId: WORKSPACE_ID,
      role: WorkspaceMemberRole.MEMBER,
    });
  });

  it.each([
    ['a non-member', OTHER_WORKSPACE_ID, []],
    ['a nonexistent workspace id', GHOST_WORKSPACE_ID, []],
    ['a malformed workspace id', 'not-an-id', []],
    ['a SUPERADMIN non-member', OTHER_WORKSPACE_ID, ['superadmin']],
  ] as const)(
    'rejects %s with the fixed NotFoundException',
    async (_label, workspaceId, roles) => {
      const { ctx, req } = makeContext(
        workspaceId,
        sessionUser(MEMBER_ID, roles),
      );

      const error = await captureError(guard.canActivate(ctx));

      expect(error).toBeInstanceOf(NotFoundException);
      expect((error as NotFoundException).message).toBe(
        WORKSPACE_NOT_FOUND_MESSAGE,
      );
      expect(req['workspaceMembership']).toBeUndefined();
    },
  );

  it('produces byte-identical responses for non-member, nonexistent and malformed ids', async () => {
    const responses = [];
    for (const workspaceId of [
      OTHER_WORKSPACE_ID,
      GHOST_WORKSPACE_ID,
      'not-an-id',
    ]) {
      const { ctx } = makeContext(workspaceId, sessionUser(MEMBER_ID));
      const error = (await captureError(
        guard.canActivate(ctx),
      )) as NotFoundException;
      responses.push({
        status: error.getStatus(),
        body: error.getResponse(),
      });
    }

    expect(responses[1]).toEqual(responses[0]);
    expect(responses[2]).toEqual(responses[0]);
    expect(JSON.stringify(responses[0])).not.toContain(OTHER_WORKSPACE_ID);
  });

  it('rejects a request with no :workspaceId param with the same NotFoundException', async () => {
    const { ctx } = makeContext(undefined, sessionUser(MEMBER_ID));

    const error = await captureError(guard.canActivate(ctx));

    expect(error).toBeInstanceOf(NotFoundException);
    expect((error as NotFoundException).message).toBe(
      WORKSPACE_NOT_FOUND_MESSAGE,
    );
  });

  it('rejects an empty-string :workspaceId param with the same NotFoundException', async () => {
    const { ctx } = makeContext('', sessionUser(MEMBER_ID));

    const error = await captureError(guard.canActivate(ctx));

    expect(error).toBeInstanceOf(NotFoundException);
    expect((error as NotFoundException).message).toBe(
      WORKSPACE_NOT_FOUND_MESSAGE,
    );
  });

  it('attaches an ADMIN membership with its real role, not a hardcoded MEMBER role', async () => {
    const workspaceRepository = createInMemoryWorkspaceRepository();
    const adminWorkspaceId = 'd'.repeat(24);
    workspaceRepository.seed(
      new Workspace({
        id: adminWorkspaceId,
        name: `ws ${adminWorkspaceId}`,
        members: [
          {
            userId: MEMBER_ID,
            role: WorkspaceMemberRole.ADMIN,
            grantedAt: GRANTED_AT,
            grantedBy: MEMBER_ID,
          },
        ],
        version: 0,
        createdAt: GRANTED_AT,
        updatedAt: GRANTED_AT,
      }),
    );
    const adminGuard = new WorkspaceMemberGuard(
      new FindMembershipService({ workspaceRepository }),
    );
    const { ctx, req } = makeContext(adminWorkspaceId, sessionUser(MEMBER_ID));

    await expect(adminGuard.canActivate(ctx)).resolves.toBe(true);
    expect(req['workspaceMembership']).toEqual({
      workspaceId: adminWorkspaceId,
      role: WorkspaceMemberRole.ADMIN,
    });
  });

  it('fails closed with ForbiddenException when SessionGuard has not populated req.user', async () => {
    const { ctx } = makeContext(WORKSPACE_ID);

    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
