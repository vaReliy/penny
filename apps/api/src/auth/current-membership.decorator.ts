import {
  createParamDecorator,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import type { RequestWorkspaceMembership } from '../workspace/workspace-membership.js';

const logger = new Logger('CurrentMembership');

/**
 * Resolves the caller's membership in the `:workspaceId` path workspace, as
 * attached by `WorkspaceMemberGuard`. Fails closed if the guard was not
 * applied to the route.
 */
export const CurrentMembership = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestWorkspaceMembership => {
    const req = ctx
      .switchToHttp()
      .getRequest<
        Request & { workspaceMembership?: RequestWorkspaceMembership }
      >();

    if (!req.workspaceMembership) {
      logger.error(
        'CurrentMembership decorator used without WorkspaceMemberGuard — req.workspaceMembership is absent.',
      );
      throw new ForbiddenException();
    }

    return req.workspaceMembership;
  },
);
