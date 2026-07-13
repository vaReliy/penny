import 'reflect-metadata';

import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import pino from 'pino';

import { User, UserStatus } from 'identity-core';
import type { IUserRepository } from 'identity-core';
import type { RoleType } from 'shared-contracts';
import { RejectUserService, SUPERADMIN_ROLE } from 'identity-application';
import { registerLivrRules } from 'shared-kernel';

import { API_CONFIG } from '../config/cli-config.js';
import type { CliConfig } from '../config/cli-config.js';
import { PINO_LOGGER } from '../logger/logger.tokens.js';
import { TOKENS } from '../identity/tokens.js';
import { UserRejectCommand } from './user-reject.command.js';

registerLivrRules();

const TELEGRAM_ID = '111222333';
const USER_ID = 'user-def-456';

function buildPendingUser(): User {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return new User({
    id: USER_ID,
    telegramId: TELEGRAM_ID,
    firstName: 'Ada',
    status: UserStatus.PENDING,
    createdAt: now,
    updatedAt: now,
  });
}

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

  public async save(entity: User): Promise<User> {
    this.store.set(entity.id, entity);
    return entity;
  }

  public async findByUsername(_username: string): Promise<User | null> {
    return null;
  }

  public async updateProfile(
    _id: string,
    _profile: object,
  ): Promise<User | null> {
    return null;
  }

  public async updateStatus(
    id: string,
    status: UserStatus,
  ): Promise<User | null> {
    const user = this.store.get(id);
    if (!user) return null;
    const updated = new User({
      id: user.id,
      telegramId: user.telegramId,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      photoUrl: user.photoUrl,
      status,
      roles: user.roles,
      createdAt: user.createdAt,
      updatedAt: new Date(),
    });
    this.store.set(id, updated);
    return updated;
  }

  public async updateRoles(
    id: string,
    roles: readonly RoleType[],
  ): Promise<User | null> {
    const user = this.store.get(id);
    if (!user) return null;
    const updated = new User({
      id: user.id,
      telegramId: user.telegramId,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      photoUrl: user.photoUrl,
      status: user.status,
      roles,
      createdAt: user.createdAt,
      updatedAt: new Date(),
    });
    this.store.set(id, updated);
    return updated;
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

describe('UserRejectCommand', () => {
  let command: UserRejectCommand;
  let repository: FakeUserRepository;
  let rejectService: RejectUserService;

  beforeEach(async () => {
    repository = new FakeUserRepository();
    rejectService = new RejectUserService({ userRepository: repository });

    const silentLogger = pino({ level: 'silent' });

    const moduleRef = await Test.createTestingModule({
      providers: [
        UserRejectCommand,
        { provide: TOKENS.UserRepository, useValue: repository },
        { provide: TOKENS.RejectUser, useValue: rejectService },
        { provide: API_CONFIG, useValue: CLI_CONFIG_STUB },
        { provide: PINO_LOGGER, useValue: silentLogger },
      ],
    }).compile();

    command = moduleRef.get(UserRejectCommand);
  });

  it('rejects a pending user by telegramId via RejectUserService', async () => {
    const runSpy = vi.spyOn(rejectService, 'run');
    repository.seed(buildPendingUser());

    await command.run([TELEGRAM_ID]);

    expect(runSpy).toHaveBeenCalledOnce();
    expect(runSpy).toHaveBeenCalledWith(
      { userId: USER_ID },
      expect.objectContaining({
        caller: expect.objectContaining({
          status: UserStatus.ACTIVE,
          roles: expect.arrayContaining([SUPERADMIN_ROLE]),
        }),
      }),
    );

    const updated = await repository.findById(USER_ID);
    expect(updated?.status).toBe(UserStatus.REJECTED);
  });

  it('calls process.exit(1) when the telegramId is not found', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    await expect(command.run(['unknown-id'])).rejects.toThrow(
      'process.exit called',
    );
    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
  });
});
