import { Inject } from '@nestjs/common';
import { Command, CommandRunner, Option } from 'nest-commander';
import type pino from 'pino';

import type { IUserRepository } from 'identity-core';
import { getUserDisplayName } from 'identity-core';
import { UserStatus } from 'shared-contracts';
import { ValidationError } from 'shared-errors';

import { PINO_LOGGER } from '../logger/logger.tokens.js';
import { TOKENS } from '../identity/tokens.js';
import { printCliError } from '../shared/print-cli-error.js';

/** Every valid `--status` value, used both for `choices`-style validation and the option description. */
const VALID_STATUSES = Object.values(UserStatus);

interface UserListOptions {
  status?: UserStatus;
  username?: string;
}

@Command({
  name: 'user:list',
  description: 'List users, optionally filtered by --status and/or --username.',
})
export class UserListCommand extends CommandRunner {
  constructor(
    @Inject(TOKENS.UserRepository)
    private readonly userRepository: IUserRepository,
    @Inject(PINO_LOGGER)
    private readonly logger: pino.Logger,
  ) {
    super();
  }

  async run(_inputs: string[], options: UserListOptions): Promise<void> {
    try {
      const users = await this.userRepository.findAll({
        status: options.status,
        usernameContains: options.username,
      });

      if (users.length === 0) {
        console.log('No users found.');
        return;
      }

      console.log('ID | Telegram ID | Username | Display name | Status');
      for (const user of users) {
        console.log(
          `${user.id} | ${user.telegramId} | ${user.username ?? '-'} | ${getUserDisplayName(user)} | ${user.status}`,
        );
      }
      console.log(`Total: ${users.length} user(s)`);
    } catch (error) {
      printCliError(error, this.logger);
    }
  }

  @Option({
    flags: '--status <status>',
    description: `Filter by status: ${VALID_STATUSES.join(', ')}`,
  })
  parseStatus(val: string): UserStatus {
    if (!VALID_STATUSES.includes(val as UserStatus)) {
      printCliError(
        new ValidationError(
          `Invalid --status "${val}". Valid values: ${VALID_STATUSES.join(', ')}`,
        ),
        this.logger,
      );
    }
    return val as UserStatus;
  }

  @Option({
    flags: '--username <substring>',
    description: 'Case-insensitive substring match against username.',
  })
  parseUsername(val: string): string {
    return val;
  }
}
