import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import pino from 'pino';

import { User, UserStatus } from 'identity-core';
import { createFakeUserRepository } from 'identity-testing';
import type { IUserRepository } from 'identity-core';
import { CreateWorkspaceService } from 'workspace-application';
import { createInMemoryWorkspaceRepository } from 'workspace-testing';
import type { IInMemoryWorkspaceRepository } from 'workspace-testing';

import type { CliConfig } from '../config/cli-config.js';
import { WorkspaceCreateCommand } from './workspace-create.command.js';

const TELEGRAM_ID = '111222333';
const ADMIN_ID = 'a'.repeat(24);

function makeUser(status: UserStatus): User {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return new User({
    id: ADMIN_ID,
    telegramId: TELEGRAM_ID,
    username: 'ada',
    status,
    createdAt: now,
    updatedAt: now,
  });
}

const CLI_CONFIG_STUB: CliConfig = {
  mongoUri: 'mongodb://localhost:27017',
  mongoDbName: 'test',
  mode: 'development',
};

describe('WorkspaceCreateCommand', () => {
  let logger: pino.Logger;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let workspaceRepository: IInMemoryWorkspaceRepository;
  let createWorkspace: CreateWorkspaceService;

  beforeEach(() => {
    logger = pino({ level: 'silent' });
    errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => undefined);
    exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    workspaceRepository = createInMemoryWorkspaceRepository();
    createWorkspace = new CreateWorkspaceService({ workspaceRepository });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function makeCommand(
    userRepository: IUserRepository,
    createWorkspaceService: CreateWorkspaceService = createWorkspace,
  ): WorkspaceCreateCommand {
    return new WorkspaceCreateCommand(
      createWorkspaceService,
      userRepository,
      CLI_CONFIG_STUB,
      logger,
    );
  }

  it('calls CreateWorkspaceService with grantedBy: cli and prints the created workspace (AC-1)', async () => {
    const userRepository = createFakeUserRepository({
      findByTelegramId: vi.fn().mockResolvedValue(makeUser(UserStatus.ACTIVE)),
    });
    const runSpy = vi.spyOn(createWorkspace, 'run');
    const command = makeCommand(userRepository);

    await command.run([], { name: 'Household', adminTelegramId: TELEGRAM_ID });

    expect(runSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Household',
        adminUserId: ADMIN_ID,
        grantedBy: 'cli',
      }),
      expect.anything(),
    );
    expect(
      consoleSpy.mock.calls.some((call: unknown[]) =>
        String(call[0]).startsWith('Created workspace "Household" ('),
      ),
    ).toBe(true);
    expect(exitSpy).not.toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalledOnce();
    expect(infoSpy).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'workspace.create', by: 'cli' }),
      expect.any(String),
    );
  });

  it('refuses a PENDING admin and never calls the service (AC-2)', async () => {
    const userRepository = createFakeUserRepository({
      findByTelegramId: vi.fn().mockResolvedValue(makeUser(UserStatus.PENDING)),
    });
    const runSpy = vi.spyOn(createWorkspace, 'run');
    const command = makeCommand(userRepository);

    await command.run([], { name: 'Household', adminTelegramId: TELEGRAM_ID });

    expect(runSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      `Cannot add ${TELEGRAM_ID}: user status is pending, must be active`,
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('calls process.exit(1) when the admin telegram id is unknown', async () => {
    const userRepository = createFakeUserRepository({
      findByTelegramId: vi.fn().mockResolvedValue(null),
    });
    const command = makeCommand(userRepository);

    await command.run([], {
      name: 'Household',
      adminTelegramId: 'unknown-id',
    });

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('User with Telegram ID unknown-id not found'),
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
