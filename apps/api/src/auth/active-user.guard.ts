import { ForbiddenException, Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import { UserStatus } from 'shared-contracts';
import type { SessionUser } from 'shared-contracts';

/**
 * Enforces that the authenticated user has ACTIVE status.
 * Must be applied after SessionGuard, which populates req.user.
 * PENDING and REJECTED users are rejected with ForbiddenException.
 */
@Injectable()
export class ActiveUserGuard implements CanActivate {
  public canActivate(context: ExecutionContext): boolean {
    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: SessionUser }>();

    if (req.user?.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException();
    }

    return true;
  }
}
