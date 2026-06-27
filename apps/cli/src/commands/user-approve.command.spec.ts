import 'reflect-metadata';

import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import pino from 'pino';

import { User, UserStatus } from 'identity-core';
import type { IUserRepository } from 'identity-core';
import { ApproveUserService, ADMIN_ROLE } from 'identity-application';
import { registerLivrRules } from 'shared-kernel';

import { API_CONFIG } from '../config/cli-config.js';
import type { CliConfig } from '../config/cli-config.js';
import { PINO_LOGGER } from '../logger/logger.tokens.js';
import { TOKENS } from '../identity/tokens.js';
import { UserApproveCommand } from './user-approve.command.js';

registerLivrRules();

const TELEGRAM_ID = '987654321';
const USER_ID = 'user-abc-123';

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

/** Minimal in-memory repository fake — same pattern as set-user-status.service.spec.ts. */
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

  public async delete(id: string): Promise<void> {
    this.store.delete(id);
  }
}

const CLI_CONFIG_STUB: CliConfig = {
  mongoUri: 'mongodb://localhost:27017',
  mongoDbName: 'test',
  mode: 'development',
};

describe('UserApproveCommand', () => {
  let command: UserApproveCommand;
  let repository: FakeUserRepository;
  let approveService: ApproveUserService;

  beforeEach(async () => {
    repository = new FakeUserRepository();
    approveService = new ApproveUserService({ userRepository: repository });

    const silentLogger = pino({ level: 'silent' });

    const moduleRef = await Test.createTestingModule({
      providers: [
        UserApproveCommand,
        { provide: TOKENS.UserRepository, useValue: repository },
        { provide: TOKENS.ApproveUser, useValue: approveService },
        { provide: API_CONFIG, useValue: CLI_CONFIG_STUB },
        { provide: PINO_LOGGER, useValue: silentLogger },
      ],
    }).compile();

    command = moduleRef.get(UserApproveCommand);
  });

  it('approves a pending user by telegramId via ApproveUserService', async () => {
    const runSpy = vi.spyOn(approveService, 'run');
    repository.seed(buildPendingUser());

    await command.run([TELEGRAM_ID]);

    expect(runSpy).toHaveBeenCalledOnce();
    expect(runSpy).toHaveBeenCalledWith(
      { userId: USER_ID },
      expect.objectContaining({
        caller: expect.objectContaining({
          roles: expect.arrayContaining([ADMIN_ROLE]),
        }),
      }),
    );

    const updated = await repository.findById(USER_ID);
    expect(updated?.status).toBe(UserStatus.ACTIVE);
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
