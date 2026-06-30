import 'reflect-metadata';

import { Test } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import pino from 'pino';

import { User, UserStatus } from 'identity-core';
import type { IUserRepository } from 'identity-core';

// Hoist the issueMock so it is accessible both inside the vi.mock factory
// (which is hoisted to the top of the file by Vitest's transform) and inside
// the test assertions.
const { issueMock } = vi.hoisted(() => ({
  issueMock: vi.fn().mockReturnValue('mocked.jwt.token'),
}));

// JwtTokenIssuer is constructed inline inside DevTokenCommand.run(), so we
// mock the module and make the mock class set this.issue = issueMock.
vi.mock('identity-application', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('identity-application')>();
  return {
    ...original,
    JwtTokenIssuer: vi.fn(function (this: { issue: typeof issueMock }) {
      this.issue = issueMock;
    }),
  };
});

import { JwtTokenIssuer } from 'identity-application';

import { API_CONFIG } from '../config/cli-config.js';
import type { CliConfig } from '../config/cli-config.js';
import { PINO_LOGGER } from '../logger/logger.tokens.js';
import { TOKENS } from '../identity/tokens.js';
import { DevTokenCommand } from './dev-token.command.js';

const silentLogger = pino({ level: 'silent' });

/** A secret long enough to satisfy JwtTokenIssuer's 32-char minimum. */
const TEST_JWT_SECRET = 'a'.repeat(32);

function buildPendingUser(): User {
  return new User({
    id: 'user-abc-123',
    telegramId: '1000000000001',
    firstName: 'Ada',
    username: 'ada_lovelace',
    status: UserStatus.PENDING,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  });
}

function buildFakeRepository(
  overrides: Partial<IUserRepository> = {},
): IUserRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findByTelegramId: vi.fn().mockResolvedValue(null),
    findByUsername: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockImplementation(async (u: User) => u),
    updateProfile: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

const DEV_CONFIG: CliConfig = {
  mongoUri: 'mongodb://localhost:27017',
  mongoDbName: 'test',
  mode: 'development',
};

const PROD_CONFIG: CliConfig = {
  mongoUri: 'mongodb://localhost:27017',
  mongoDbName: 'test',
  mode: 'production',
};

async function buildCommand(
  repository: IUserRepository,
  config: CliConfig,
): Promise<DevTokenCommand> {
  const moduleRef = await Test.createTestingModule({
    providers: [
      DevTokenCommand,
      { provide: TOKENS.UserRepository, useValue: repository },
      { provide: API_CONFIG, useValue: config },
      { provide: PINO_LOGGER, useValue: silentLogger },
    ],
  }).compile();

  return moduleRef.get(DevTokenCommand);
}

describe('DevTokenCommand', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    issueMock.mockClear();
    vi.mocked(JwtTokenIssuer).mockClear();
    exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((_code?: number | string | null | undefined) => {
        throw new Error('process.exit called');
      });
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    exitSpy.mockRestore();
    consoleSpy.mockRestore();
    vi.unstubAllEnvs();
  });

  describe('production guard', () => {
    it('calls process.exit(1) in production mode and does not query the repository', async () => {
      // Arrange
      vi.stubEnv('JWT_SECRET', TEST_JWT_SECRET);
      const repository = buildFakeRepository();
      const command = await buildCommand(repository, PROD_CONFIG);

      // Act + Assert
      await expect(
        command.run([], { telegramUsername: 'ada_lovelace' }),
      ).rejects.toThrow('process.exit called');

      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(repository.findByUsername).not.toHaveBeenCalled();
    });
  });

  describe('missing JWT_SECRET', () => {
    it('calls process.exit(1) when JWT_SECRET is not set', async () => {
      // Arrange — empty string simulates absent env var per rules/testing.md
      vi.stubEnv('JWT_SECRET', '');
      const repository = buildFakeRepository();
      const command = await buildCommand(repository, DEV_CONFIG);

      // Act + Assert
      await expect(
        command.run([], { telegramUsername: 'ada_lovelace' }),
      ).rejects.toThrow('process.exit called');

      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(repository.findByUsername).not.toHaveBeenCalled();
    });

    it('calls process.exit(1) when JWT_SECRET is shorter than 32 characters', async () => {
      // Arrange — 'dev' has 3 bytes of entropy; valid structurally but insecure
      vi.stubEnv('JWT_SECRET', 'dev');
      const repository = buildFakeRepository();
      const command = await buildCommand(repository, DEV_CONFIG);

      // Act + Assert
      await expect(
        command.run([], { telegramUsername: 'ada_lovelace' }),
      ).rejects.toThrow('process.exit called');

      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(repository.findByUsername).not.toHaveBeenCalled();
    });
  });

  describe('user not found', () => {
    it('calls process.exit(1) when the username does not match any user', async () => {
      // Arrange
      vi.stubEnv('JWT_SECRET', TEST_JWT_SECRET);
      const repository = buildFakeRepository({
        findByUsername: vi.fn().mockResolvedValue(null),
      });
      const command = await buildCommand(repository, DEV_CONFIG);

      // Act + Assert
      await expect(
        command.run([], { telegramUsername: 'ghost_user' }),
      ).rejects.toThrow('process.exit called');

      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('invalid --status flag', () => {
    it('calls process.exit(1) and does not write to the DB when status is invalid', async () => {
      // Arrange
      vi.stubEnv('JWT_SECRET', TEST_JWT_SECRET);
      const repository = buildFakeRepository();
      const command = await buildCommand(repository, DEV_CONFIG);

      // Act + Assert
      await expect(
        command.run([], {
          telegramUsername: 'ada_lovelace',
          status: 'superadmin',
        }),
      ).rejects.toThrow('process.exit called');

      expect(exitSpy).toHaveBeenCalledWith(1);
      // Status validation runs before the DB lookup
      expect(repository.findByUsername).not.toHaveBeenCalled();
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('happy path — default ACTIVE status', () => {
    it('saves the user as ACTIVE, issues a JWT, and outputs token= and XSRF-TOKEN= lines', async () => {
      // Arrange
      vi.stubEnv('JWT_SECRET', TEST_JWT_SECRET);
      const pendingUser = buildPendingUser();
      const saveSpy = vi.fn().mockImplementation(async (u: User) => u);
      const repository = buildFakeRepository({
        findByUsername: vi.fn().mockResolvedValue(pendingUser),
        save: saveSpy,
      });
      const command = await buildCommand(repository, DEV_CONFIG);

      // Act
      await command.run([], { telegramUsername: 'ada_lovelace' });

      // Assert — user saved with ACTIVE status
      expect(saveSpy).toHaveBeenCalledOnce();
      const savedUser = saveSpy.mock.calls[0][0] as User;
      expect(savedUser.status).toBe(UserStatus.ACTIVE);

      // Assert — JwtTokenIssuer.issue called with correct claims
      expect(issueMock).toHaveBeenCalledWith({
        sub: pendingUser.id,
        status: UserStatus.ACTIVE,
        roles: [],
      });

      // Assert — console output includes token= and a 64-char hex XSRF value
      const logLines = consoleSpy.mock.calls.map((call: string) =>
        String(call[0]),
      );
      expect(logLines.some((line: string) => line.includes('token='))).toBe(
        true,
      );
      const xsrfLine = logLines.find((line: string) =>
        line.startsWith('XSRF-TOKEN='),
      );
      expect(xsrfLine).toBeDefined();
      const xsrfValue = xsrfLine!.replace('XSRF-TOKEN=', '');
      expect(xsrfValue).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe('happy path — explicit --status pending', () => {
    it('saves the user as PENDING and issues JWT with PENDING status', async () => {
      // Arrange
      vi.stubEnv('JWT_SECRET', TEST_JWT_SECRET);
      const pendingUser = buildPendingUser();
      const saveSpy = vi.fn().mockImplementation(async (u: User) => u);
      const repository = buildFakeRepository({
        findByUsername: vi.fn().mockResolvedValue(pendingUser),
        save: saveSpy,
      });
      const command = await buildCommand(repository, DEV_CONFIG);

      // Act
      await command.run([], {
        telegramUsername: 'ada_lovelace',
        status: UserStatus.PENDING,
      });

      // Assert — user saved with PENDING status
      const savedUser = saveSpy.mock.calls[0][0] as User;
      expect(savedUser.status).toBe(UserStatus.PENDING);

      // Assert — JWT claims carry PENDING status
      expect(issueMock).toHaveBeenCalledWith({
        sub: pendingUser.id,
        status: UserStatus.PENDING,
        roles: [],
      });
    });
  });
});
