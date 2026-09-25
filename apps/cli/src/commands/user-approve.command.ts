import { Inject } from '@nestjs/common';
import { Command, CommandRunner, Option } from 'nest-commander';
import type pino from 'pino';

import { ApproveUserService } from 'identity-application';
import type { IUserRepository } from 'identity-core';
import type { ServiceContext } from 'shared-kernel';

import { API_CONFIG } from '../config/cli-config.js';
import type { CliConfig } from '../config/cli-config.js';
import { PINO_LOGGER } from '../logger/logger.tokens.js';
import { TOKENS } from '../identity/tokens.js';
import { CLI_ADMIN_CALLER } from '../shared/cli-admin-caller.js';
import { resolveUserByTelegramId } from '../shared/resolve-user-by-telegram-id.js';
import { printCliError } from '../shared/print-cli-error.js';

interface UserApproveOptions {
  telegramId: string;
}

@Command({
  name: 'user:approve',
  description: 'Approve a pending user, transitioning them to active.',
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

  async run(_inputs: string[], options: UserApproveOptions): Promise<void> {
    const { telegramId } = options;

    let user;
    try {
      user = await resolveUserByTelegramId(this.userRepository, telegramId);
    } catch (err) {
      printCliError(err, this.logger);
    }

    try {
      const ctx: ServiceContext<CliConfig> = {
        config: this.config,
        caller: CLI_ADMIN_CALLER,
      };

      await this.approveUser.run({ userId: user.id }, ctx);
      this.logger.info({ telegramId, userId: user.id }, 'User approved');
    } catch (err) {
      this.logger.error({ telegramId, err }, 'user:approve failed');
      process.exit(1);
    }
  }

  @Option({
    flags: '--telegram-id <telegramId>',
    description: 'Telegram ID of the user to approve.',
    required: true,
  })
  parseTelegramId(val: string): string {
    return val;
  }
}
