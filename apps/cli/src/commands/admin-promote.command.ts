import { Inject } from '@nestjs/common';
import { Command, CommandRunner, Option } from 'nest-commander';
import type pino from 'pino';

import type { IUserRepository } from 'identity-core';
import { Role } from 'shared-contracts';

import { API_CONFIG } from '../config/cli-config.js';
import type { CliConfig } from '../config/cli-config.js';
import { PINO_LOGGER } from '../logger/logger.tokens.js';
import { TOKENS } from '../identity/tokens.js';
import { resolveUserByTelegramId } from '../shared/resolve-user-by-telegram-id.js';
import { printCliError } from '../shared/print-cli-error.js';

interface AdminPromoteOptions {
  telegramId: string;
}

/**
 * Grants `Role.SUPERADMIN` to an existing user, identified by Telegram id
 * (usernames are mutable, so every CLI user-identifying command resolves by
 * `--telegram-id`, never username). Infra-level trust boundary by design:
 * whoever can run this CLI / reach the Mongo connection is implicitly
 * trusted — there is no in-app authorization check here (see the task's
 * decision record for the CLI privilege model). Never expose an HTTP
 * equivalent of this command.
 *
 * The target user must already have a `User` row — i.e. have logged in via
 * Telegram at least once — before this command can act on them. There is no
 * zero-user bootstrap path.
 */
@Command({
  name: 'admin:promote',
  description: 'Grant Role.SUPERADMIN to an existing user by --telegram-id.',
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
    const { telegramId } = options;

    try {
      const user = await resolveUserByTelegramId(
        this.userRepository,
        telegramId,
      );

      if (user.roles.includes(Role.SUPERADMIN)) {
        this.logger.info(
          { telegramId, userId: user.id },
          'User is already a superadmin; no-op',
        );
        return;
      }

      const currentRoles = user.roles;
      const updated = await this.userRepository.updateRoles(
        user.id,
        [...currentRoles, Role.SUPERADMIN],
        currentRoles,
      );

      if (!updated) {
        this.logger.error(
          { telegramId, userId: user.id },
          'Promotion failed: roles changed concurrently since this command read them (CAS conflict). Re-run the command to retry against the latest roles.',
        );
        process.exit(1);
        return;
      }

      this.logger.info(
        { telegramId, userId: user.id },
        'User promoted to superadmin',
      );
    } catch (error) {
      printCliError(error, this.logger);
    }
  }

  @Option({
    flags: '--telegram-id <telegramId>',
    description: 'Telegram ID of the user to promote to superadmin.',
    required: true,
  })
  parseTelegramId(val: string): string {
    return val;
  }
}
