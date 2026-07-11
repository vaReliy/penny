import { Controller, Post, Param, Inject, UseGuards } from '@nestjs/common';

import type {
  ApproveUserService,
  RejectUserService,
} from 'identity-application';
import type { ServiceContext, CallerIdentity } from 'shared-kernel';
import type { SessionUser } from 'shared-contracts';

import { SessionGuard } from '../auth/session.guard.js';
import { ActiveUserGuard } from '../auth/active-user.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { API_CONFIG } from '../config/api-config.js';
import type { ApiConfig } from '../config/api-config.js';
import { TOKENS } from './tokens.js';

/** Response body for the approve/reject admin actions. */
interface SetUserStatusResponse {
  readonly userId: string;
  readonly status: string;
}

/** Builds the `CallerIdentity` a `ServiceContext` needs from the authenticated session user. */
function toCallerIdentity(user: SessionUser): CallerIdentity {
  return { userId: user.id, status: user.status, roles: user.roles };
}

/**
 * Admin-only HTTP surface for the `pending -> active`/`pending -> rejected`
 * user status transitions. The HTTP twin of the `user:approve`/`user:reject`
 * CLI commands — authorization (the `SUPERADMIN_ROLE` check) is enforced by
 * `SetUserStatusService.authorize`, not here; this controller's only job is
 * to require an authenticated session and translate `req.user` into the
 * `CallerIdentity` the service authorizes against.
 */
@Controller('admin/users')
@UseGuards(SessionGuard, ActiveUserGuard)
export class UserAdminController {
  public constructor(
    @Inject(TOKENS.ApproveUser)
    private readonly approveUser: ApproveUserService,
    @Inject(TOKENS.RejectUser)
    private readonly rejectUser: RejectUserService,
    @Inject(API_CONFIG)
    private readonly config: ApiConfig,
  ) {}

  @Post(':userId/approve')
  public async approve(
    @Param('userId') userId: string,
    @CurrentUser() user: SessionUser,
  ): Promise<SetUserStatusResponse> {
    const context: ServiceContext = {
      config: {},
      caller: toCallerIdentity(user),
    };

    const { data } = await this.approveUser.run({ userId }, context);
    return { userId: data.id, status: data.status };
  }

  @Post(':userId/reject')
  public async reject(
    @Param('userId') userId: string,
    @CurrentUser() user: SessionUser,
  ): Promise<SetUserStatusResponse> {
    const context: ServiceContext = {
      config: {},
      caller: toCallerIdentity(user),
    };

    const { data } = await this.rejectUser.run({ userId }, context);
    return { userId: data.id, status: data.status };
  }
}
