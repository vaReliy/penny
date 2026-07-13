import 'reflect-metadata';

import { Test } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import pino from 'pino';

import { User, UserStatus } from 'identity-core';
import type { IUserRepository } from 'identity-core';

import { API_CONFIG } from '../config/cli-config.js';
import type { CliConfig } from '../config/cli-config.js';
import { PINO_LOGGER } from '../logger/logger.tokens.js';
import { TOKENS } from '../identity/tokens.js';
import { DevCreateUserCommand } from './dev-create-user.command.js';

const silentLogger = pino({ level: 'silent' });

function buildFakeRepository(
  overrides: Partial<IUserRepository> = {},
): IUserRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findByTelegramId: vi.fn().mockResolvedValue(null),
    findByUsername: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockImplementation(async (u: User) => u),
    updateProfile: vi.fn().mockResolvedValue(null),
    updateStatus: vi.fn().mockResolvedValue(null),
    updateRoles: vi.fn().mockResolvedValue(null),
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
): Promise<DevCreateUserCommand> {
  const moduleRef = await Test.createTestingModule({
    providers: [
      DevCreateUserCommand,
      { provide: TOKENS.UserRepository, useValue: repository },
      { provide: API_CONFIG, useValue: config },
      { provide: PINO_LOGGER, useValue: silentLogger },
    ],
  }).compile();

  return moduleRef.get(DevCreateUserCommand);
}

describe('DevCreateUserCommand', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((_code?: number | string | null | undefined) => {
        throw new Error('process.exit called');
      });
  });

  afterEach(() => {
    exitSpy.mockRestore();
  });

  describe('production guard', () => {
    it('calls process.exit(1) in production mode and does not query the repository', async () => {
      // Arrange
      const repository = buildFakeRepository();
      const command = await buildCommand(repository, PROD_CONFIG);

      // Act + Assert
      await expect(
        command.run([], { telegramUsername: 'ada' }),
      ).rejects.toThrow('process.exit called');

      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(repository.findByUsername).not.toHaveBeenCalled();
    });
  });

  describe('user already exists', () => {
    it('calls process.exit(1) and does not call save when the username is already registered', async () => {
      // Arrange
      const existingUser = new User({
        id: 'existing-id',
        telegramId: '1000000000001',
        firstName: 'Ada',
        status: UserStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const repository = buildFakeRepository({
        findByUsername: vi.fn().mockResolvedValue(existingUser),
      });

      const command = await buildCommand(repository, DEV_CONFIG);

      // Act + Assert
      await expect(
        command.run([], { telegramUsername: 'ada' }),
      ).rejects.toThrow('process.exit called');

      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('happy path — no --name flag', () => {
    it('saves a PENDING user with username as firstName when --name is omitted', async () => {
      // Arrange
      const repository = buildFakeRepository();
      const command = await buildCommand(repository, DEV_CONFIG);
      const username = 'ada_lovelace';

      // Act
      await command.run([], { telegramUsername: username });

      // Assert
      expect(repository.save).toHaveBeenCalledOnce();

      const savedUser = (repository.save as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as User;
      expect(savedUser).toBeInstanceOf(User);
      expect(savedUser.status).toBe(UserStatus.PENDING);
      expect(savedUser.username).toBe(username);
      expect(savedUser.firstName).toBe(username);

      // Fake telegramId must be a non-empty numeric string
      expect(savedUser.telegramId).toMatch(/^\d+$/);
      expect(savedUser.telegramId.length).toBeGreaterThan(0);
    });
  });

  describe('happy path — with --name flag', () => {
    it('saves a PENDING user with the provided display name as firstName', async () => {
      // Arrange
      const repository = buildFakeRepository();
      const command = await buildCommand(repository, DEV_CONFIG);
      const username = 'ada_lovelace';
      const displayName = 'Ada Lovelace';

      // Act
      await command.run([], { telegramUsername: username, name: displayName });

      // Assert
      expect(repository.save).toHaveBeenCalledOnce();

      const savedUser = (repository.save as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as User;
      expect(savedUser.firstName).toBe(displayName);
      expect(savedUser.username).toBe(username);
    });
  });
});
