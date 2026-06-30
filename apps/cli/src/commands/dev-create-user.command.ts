import { Inject } from '@nestjs/common';
import { Command, CommandRunner, Option } from 'nest-commander';
import type pino from 'pino';

import type { IUserRepository } from 'identity-core';
import { User } from 'identity-core';
import { UserStatus } from 'shared-contracts';

import { API_CONFIG } from '../config/cli-config.js';
import type { CliConfig } from '../config/cli-config.js';
import { PINO_LOGGER } from '../logger/logger.tokens.js';
import { TOKENS } from '../identity/tokens.js';

/**
 * djb2 hash — deterministic, non-cryptographic. Same input always yields the
 * same output, so the same username always maps to the same fake telegramId
 * across re-runs.
 */
function djb2(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) + hash + str.charCodeAt(i);
    hash |= 0; // force 32-bit integer
  }
  return hash;
}

/**
 * Lower bound for generated fake Telegram IDs.
 * Real Telegram user IDs are ≤ 10^9; this range (1T–2T) is safely outside real ID space.
 */
const FAKE_TELEGRAM_ID_BASE = 1_000_000_000_000;

interface DevCreateUserOptions {
  telegramUsername: string;
  name?: string;
}

@Command({
  name: 'dev:create-user',
  description:
    '[Dev only] Create a user without Telegram login, for local development.',
})
export class DevCreateUserCommand extends CommandRunner {
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

  async run(_inputs: string[], options: DevCreateUserOptions): Promise<void> {
    if (this.config.mode === 'production') {
      process.stderr.write('dev:create-user is not available in production.\n');
      process.exit(1);
    }

    const { telegramUsername, name } = options;

    const existing = await this.userRepository.findByUsername(telegramUsername);
    if (existing) {
      this.logger.error({ username: telegramUsername }, 'User already exists');
      process.exit(1);
    }

    const telegramId = String(
      FAKE_TELEGRAM_ID_BASE + Math.abs(djb2(telegramUsername)),
    );

    const user = new User({
      id: '',
      telegramId,
      username: telegramUsername,
      firstName: name ?? telegramUsername,
      status: UserStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const saved = await this.userRepository.save(user);
    this.logger.info(
      { userId: saved.id, username: telegramUsername },
      'Dev user created',
    );
  }

  @Option({
    flags: '--telegram-username <username>',
    description: 'Telegram username to register the dev user under.',
    required: true,
  })
  parseTelegramUsername(val: string): string {
    return val;
  }

  @Option({
    flags: '--name <name>',
    description:
      'Display name (firstName). Defaults to --telegram-username if omitted.',
  })
  parseName(val: string): string {
    return val;
  }
}
