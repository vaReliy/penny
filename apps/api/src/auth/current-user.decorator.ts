import { createParamDecorator, Logger } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import { AuthenticationError } from 'shared-errors';
import type { SessionUser } from 'shared-contracts';

const logger = new Logger('CurrentUser');

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): SessionUser => {
    const req = ctx
      .switchToHttp()
      .getRequest<Request & { user?: SessionUser }>();

    if (!req.user) {
      logger.error(
        'CurrentUser decorator used without SessionGuard — req.user is absent.',
      );
      throw new AuthenticationError();
    }

    return req.user;
  },
);
