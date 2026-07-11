import 'reflect-metadata';

import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import pino from 'pino';

import { User, UserStatus } from 'identity-core';
import type { IUserRepository } from 'identity-core';
import { Role } from 'shared-contracts';

import { API_CONFIG } from '../config/cli-config.js';
import type { CliConfig } from '../config/cli-config.js';
import { PINO_LOGGER } from '../logger/logger.tokens.js';
import { TOKENS } from '../identity/tokens.js';
import { AdminPromoteCommand } from './admin-promote.command.js';

const TELEGRAM_USERNAME = 'ada_lovelace';
const USER_ID = 'user-abc-123';

function buildActiveUser(roles: string[] = []): User {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return new User({
    id: USER_ID,
    telegramId: '987654321',
    username: TELEGRAM_USERNAME,
    firstName: 'Ada',
    status: UserStatus.ACTIVE,
    roles,
    createdAt: now,
    updatedAt: now,
  });
}

/** Minimal in-memory repository fake — same pattern as user-approve.command.spec.ts. */
class FakeUserRepository implements IUserRepository {
  private readonly store = new Map<string, User>();

  public seed(user: User): void {
    this.store.set(user.id, user);
  }

  public async findById(id: string): Promise<User | null> {
    return this.store.get(id) ?? null;
  }

  public async findByTelegramId(telegramId: string): Promise<User | null> {
    for (const user of this.store.values()) {
      if (user.telegramId === telegramId) return user;
    }
    return null;
  }

  public async findByUsername(username: string): Promise<User | null> {
    for (const user of this.store.values()) {
      if (user.username === username) return user;
    }
    return null;
  }

  public async save(entity: User): Promise<User> {
    this.store.set(entity.id, entity);
    return entity;
  }

  public async updateProfile(
    _id: string,
    _profile: object,
  ): Promise<User | null> {
    return null;
  }

  public async delete(id: string): Promise<void> {
    this.store.delete(id);
  }
}

const CLI_CONFIG_STUB: CliConfig = {
  mongoUri: 'mongodb://localhost:27017',
  mongoDbName: 'test',
  mode: 'development',
};

describe('AdminPromoteCommand', () => {
  let command: AdminPromoteCommand;
  let repository: FakeUserRepository;

  beforeEach(async () => {
    repository = new FakeUserRepository();

    const silentLogger = pino({ level: 'silent' });

    const moduleRef = await Test.createTestingModule({
      providers: [
        AdminPromoteCommand,
        { provide: TOKENS.UserRepository, useValue: repository },
        { provide: API_CONFIG, useValue: CLI_CONFIG_STUB },
        { provide: PINO_LOGGER, useValue: silentLogger },
      ],
    }).compile();

    command = moduleRef.get(AdminPromoteCommand);
  });

  it('grants Role.SUPERADMIN to a user with no roles', async () => {
    repository.seed(buildActiveUser([]));
    const saveSpy = vi.spyOn(repository, 'save');

    await command.run([], { telegramUsername: TELEGRAM_USERNAME });

    expect(saveSpy).toHaveBeenCalledOnce();
    const updated = await repository.findById(USER_ID);
    expect(updated?.roles).toEqual([Role.SUPERADMIN]);
  });

  it('is idempotent: promoting an already-superadmin user is a safe no-op', async () => {
    repository.seed(buildActiveUser([Role.SUPERADMIN]));
    const saveSpy = vi.spyOn(repository, 'save');

    await command.run([], { telegramUsername: TELEGRAM_USERNAME });

    expect(saveSpy).not.toHaveBeenCalled();
    const updated = await repository.findById(USER_ID);
    expect(updated?.roles).toEqual([Role.SUPERADMIN]);
  });

  it('does not duplicate the role across repeated promotions', async () => {
    repository.seed(buildActiveUser([]));

    await command.run([], { telegramUsername: TELEGRAM_USERNAME });
    await command.run([], { telegramUsername: TELEGRAM_USERNAME });

    const updated = await repository.findById(USER_ID);
    expect(updated?.roles).toEqual([Role.SUPERADMIN]);
  });

  it('calls process.exit(1) when the telegram username is not found', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    await expect(
      command.run([], { telegramUsername: 'unknown-user' }),
    ).rejects.toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
  });
});
