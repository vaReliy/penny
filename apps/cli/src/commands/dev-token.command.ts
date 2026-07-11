import { randomBytes } from 'node:crypto';

import { Inject } from '@nestjs/common';
import { Command, CommandRunner, Option } from 'nest-commander';
import type pino from 'pino';

import type { IUserRepository } from 'identity-core';
import { User } from 'identity-core';
import { JwtTokenIssuer } from 'identity-application';
import { UserStatus } from 'shared-contracts';
import type { UserStatusType } from 'shared-contracts';

import { API_CONFIG } from '../config/cli-config.js';
import type { CliConfig } from '../config/cli-config.js';
import { PINO_LOGGER } from '../logger/logger.tokens.js';
import { TOKENS } from '../identity/tokens.js';

/** Token lifetime for dev sessions — 7 days. */
const DEV_TOKEN_TTL_SECONDS = 604_800;

/** Runtime allowlist for validating the --status flag value. */
const VALID_STATUSES: ReadonlySet<string> = new Set(Object.values(UserStatus));

interface DevTokenOptions {
  telegramUsername: string;
  status?: string;
}

@Command({
  name: 'dev:token',
  description:
    '[Dev only] Issue a 7-day JWT session token for a local dev user.',
})
export class DevTokenCommand extends CommandRunner {
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

  async run(_inputs: string[], options: DevTokenOptions): Promise<void> {
    if (this.config.mode === 'production') {
      process.stderr.write('dev:token is not available in production.\n');
      process.exit(1);
    }

    // JwtTokenIssuer is constructed inline here — not injected via DI —
    // so JWT_SECRET is only read and validated when this command actually runs.
    // Wiring it into CliIdentityModule would require JWT_SECRET at bootstrap
    // time, breaking all other CLI commands that don't need it.
    const jwtSecret = process.env['JWT_SECRET'];
    if (!jwtSecret) {
      this.logger.error('JWT_SECRET env var is required for dev:token');
      process.exit(1);
    }

    /** Minimum entropy floor — HMAC-SHA256 block size. */
    const MIN_JWT_SECRET_LENGTH = 32;
    if (jwtSecret.length < MIN_JWT_SECRET_LENGTH) {
      this.logger.error(
        { length: jwtSecret.length },
        `JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters`,
      );
      process.exit(1);
    }

    const { telegramUsername, status = UserStatus.ACTIVE } = options;

    if (!VALID_STATUSES.has(status)) {
      this.logger.error(
        { status },
        `Invalid --status value. Must be one of: ${[...VALID_STATUSES].join(', ')}`,
      );
      process.exit(1);
    }

    const targetStatus = status as UserStatusType;

    const user = await this.userRepository.findByUsername(telegramUsername);
    if (!user) {
      this.logger.error({ username: telegramUsername }, 'User not found');
      process.exit(1);
    }

    const updated = new User({
      id: user.id,
      telegramId: user.telegramId,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      photoUrl: user.photoUrl,
      status: targetStatus,
      roles: user.roles,
      createdAt: user.createdAt,
      updatedAt: new Date(),
    });
    await this.userRepository.save(updated);

    const jwtTokenIssuer = new JwtTokenIssuer(jwtSecret, DEV_TOKEN_TTL_SECONDS);
    const token = jwtTokenIssuer.issue({
      sub: updated.id,
      status: targetStatus,
      roles: updated.roles,
    });
    const xsrf = randomBytes(32).toString('hex');

    console.log('Set these cookies in DevTools (Application → Cookies):');
    console.log(`token=${token}`);
    console.log(`XSRF-TOKEN=${xsrf}`);
  }

  @Option({
    flags: '--telegram-username <username>',
    description: 'Username of the dev user to issue a token for.',
    required: true,
  })
  parseTelegramUsername(val: string): string {
    return val;
  }

  @Option({
    flags: '--status <status>',
    description: `Status to force-set before issuing the token. Defaults to "${UserStatus.ACTIVE}".`,
  })
  parseStatus(val: string): string {
    return val;
  }
}
