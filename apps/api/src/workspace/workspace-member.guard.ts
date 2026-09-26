import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import type { FindMembershipService } from 'workspace-application';
import type { SessionUser } from 'shared-contracts';

import { TOKENS } from './tokens.js';
import type { RequestWorkspaceMembership } from './workspace-membership.js';

/**
 * The single message every "no access to this workspace" outcome carries.
 * Deliberately generic and id-free, so a non-member, a nonexistent id and a
 * malformed id produce byte-identical 404 bodies and reveal nothing about
 * which workspaces exist.
 */
export const WORKSPACE_NOT_FOUND_MESSAGE = 'Workspace not found';

type WorkspaceRequest = Request & {
  user?: SessionUser;
  workspaceMembership?: RequestWorkspaceMembership;
};

/**
 * Authorizes access to a `:workspaceId`-scoped route. Must run after
 * `SessionGuard` and `ActiveUserGuard`. Reads the path param only — never
 * the JWT, body or query — and re-checks membership against the DB on every
 * request, so a removed member loses access immediately. No platform role
 * (including SUPERADMIN) grants implicit access.
 */
@Injectable()
export class WorkspaceMemberGuard implements CanActivate {
  public constructor(
    @Inject(TOKENS.FindMembership)
    private readonly findMembership: FindMembershipService,
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<WorkspaceRequest>();

    if (!req.user) {
      throw new ForbiddenException();
    }

    const workspaceId = req.params['workspaceId'];
    if (typeof workspaceId !== 'string' || workspaceId === '') {
      throw new NotFoundException(WORKSPACE_NOT_FOUND_MESSAGE);
    }

    const { data: membership } = await this.findMembership.run(
      { workspaceId },
      {
        config: {},
        caller: {
          userId: req.user.id,
          status: req.user.status,
          roles: req.user.roles,
        },
      },
    );

    if (!membership) {
      throw new NotFoundException(WORKSPACE_NOT_FOUND_MESSAGE);
    }

    req.workspaceMembership = {
      workspaceId: membership.workspaceId,
      role: membership.role,
    };

    return true;
  }
}
