import { Inject } from '@nestjs/common';
import { Command, CommandRunner } from 'nest-commander';
import type pino from 'pino';

import { RejectUserService } from 'identity-application';
import type { IUserRepository } from 'identity-core';
import { Role } from 'shared-contracts';
import type { ServiceContext } from 'shared-kernel';

import { API_CONFIG } from '../config/cli-config.js';
import type { CliConfig } from '../config/cli-config.js';
import { PINO_LOGGER } from '../logger/logger.tokens.js';
import { TOKENS } from '../identity/tokens.js';

/** Admin caller identity injected into every CLI service context. */
const CLI_ADMIN_CALLER = {
  userId: 'cli-admin',
  status: 'active',
  roles: [Role.ADMIN],
} as const;

@Command({
  name: 'user:reject',
  description: 'Reject a pending user, transitioning them to rejected.',
  arguments: '<telegramId>',
})
export class UserRejectCommand extends CommandRunner {
  constructor(
    @Inject(TOKENS.RejectUser)
    private readonly rejectUser: RejectUserService,
    @Inject(TOKENS.UserRepository)
    private readonly userRepository: IUserRepository,
    @Inject(API_CONFIG)
    private readonly config: CliConfig,
    @Inject(PINO_LOGGER)
    private readonly logger: pino.Logger,
  ) {
    super();
  }

  async run([telegramId]: string[]): Promise<void> {
    const user = await this.userRepository.findByTelegramId(telegramId);

    if (!user) {
      this.logger.error({ telegramId }, 'User not found');
      process.exit(1);
    }

    const ctx: ServiceContext<CliConfig> = {
      config: this.config,
      caller: CLI_ADMIN_CALLER,
    };

    await this.rejectUser.run({ userId: user.id }, ctx);
    this.logger.info({ telegramId, userId: user.id }, 'User rejected');
  }
}
