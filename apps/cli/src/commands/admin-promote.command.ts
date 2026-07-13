import { Inject } from '@nestjs/common';
import { Command, CommandRunner, Option } from 'nest-commander';
import type pino from 'pino';

import type { IUserRepository } from 'identity-core';
import { Role } from 'shared-contracts';

import { API_CONFIG } from '../config/cli-config.js';
import type { CliConfig } from '../config/cli-config.js';
import { PINO_LOGGER } from '../logger/logger.tokens.js';
import { TOKENS } from '../identity/tokens.js';

interface AdminPromoteOptions {
  telegramUsername: string;
}

/**
 * Grants `Role.SUPERADMIN` to an existing user, identified by Telegram
 * username. Infra-level trust boundary by design: whoever can run this CLI
 * / reach the Mongo connection is implicitly trusted — there is no in-app
 * authorization check here (see the task's decision record for the CLI
 * privilege model). Never expose an HTTP equivalent of this command.
 *
 * The target user must already have a `User` row — i.e. have logged in via
 * Telegram at least once — before this command can act on them. There is no
 * zero-user bootstrap path.
 */
@Command({
  name: 'admin:promote',
  description:
    'Grant Role.SUPERADMIN to an existing user by --telegram-username.',
})
export class AdminPromoteCommand extends CommandRunner {
  constructor(
    @Inject(TOKENS.UserRepository)
    private readonly userRepository: IUserRepository,
    @Inject(API_CONFIG)
    private readonly config: CliConfig,
    @Inject(PINO_LOGGER)
    private readonly logger: pino.Logger,
  ) {
    super();
  }

  async run(_inputs: string[], options: AdminPromoteOptions): Promise<void> {
    const { telegramUsername } = options;

    const user = await this.userRepository.findByUsername(telegramUsername);
    if (!user) {
      this.logger.error({ username: telegramUsername }, 'User not found');
      process.exit(1);
    }

    if (user.roles.includes(Role.SUPERADMIN)) {
      this.logger.info(
        { username: telegramUsername, userId: user.id },
        'User is already a superadmin; no-op',
      );
      return;
    }

    await this.userRepository.updateRoles(user.id, [
      ...user.roles,
      Role.SUPERADMIN,
    ]);

    this.logger.info(
      { username: telegramUsername, userId: user.id },
      'User promoted to superadmin',
    );
  }

  @Option({
    flags: '--telegram-username <username>',
    description: 'Username of the user to promote to superadmin.',
    required: true,
  })
  parseTelegramUsername(val: string): string {
    return val;
  }
}
