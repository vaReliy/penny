import { Inject } from '@nestjs/common';
import { Command, CommandRunner } from 'nest-commander';
import type pino from 'pino';

import { ApproveUserService } from 'identity-application';
import type { IUserRepository } from 'identity-core';
import type { ServiceContext } from 'shared-kernel';

import { API_CONFIG } from '../config/cli-config.js';
import type { CliConfig } from '../config/cli-config.js';
import { PINO_LOGGER } from '../logger/logger.tokens.js';
import { TOKENS } from '../identity/tokens.js';

/** Admin caller identity injected into every CLI service context. */
const CLI_ADMIN_CALLER = {
  userId: 'cli-admin',
  status: 'active',
  roles: ['admin'],
} as const;

@Command({
  name: 'user:approve',
  description: 'Approve a pending user, transitioning them to active.',
  arguments: '<telegramId>',
})
export class UserApproveCommand extends CommandRunner {
  constructor(
    @Inject(TOKENS.ApproveUser)
    private readonly approveUser: ApproveUserService,
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

    await this.approveUser.run({ userId: user.id }, ctx);
    this.logger.info({ telegramId, userId: user.id }, 'User approved');
  }
}
