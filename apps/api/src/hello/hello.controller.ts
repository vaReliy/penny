import { Controller, Get, UseGuards } from '@nestjs/common';
import type { SessionUser } from 'shared-contracts';

import { SessionGuard } from '../auth/session.guard.js';
import { ActiveUserGuard } from '../auth/active-user.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';

interface HelloResponse {
  readonly greeting: string;
  readonly telegramId: string;
}

@Controller('hello')
export class HelloController {
  @Get()
  @UseGuards(SessionGuard, ActiveUserGuard)
  public hello(@CurrentUser() user: SessionUser): HelloResponse {
    return {
      greeting: `Hello, ${user.displayName}!`,
      telegramId: user.telegramId,
    };
  }
}
