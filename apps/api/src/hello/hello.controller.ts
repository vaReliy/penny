import { Controller, Get, UseGuards } from '@nestjs/common';
import type { SessionUser } from 'shared-contracts';

import { SessionGuard } from '../auth/session.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';

interface HelloResponse {
  readonly greeting: string;
  readonly telegramId: string;
}

@Controller('hello')
@UseGuards(SessionGuard)
export class HelloController {
  @Get()
  public hello(@CurrentUser() user: SessionUser): HelloResponse {
    return {
      greeting: `Hello, ${user.displayName}!`,
      telegramId: user.telegramId,
    };
  }
}
