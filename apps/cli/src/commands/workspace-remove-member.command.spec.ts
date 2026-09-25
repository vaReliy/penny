import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import pino from 'pino';

import { User, UserStatus } from 'identity-core';
import { createFakeUserRepository } from 'identity-testing';
import type { IUserRepository } from 'identity-core';
import { RemoveMemberService } from 'workspace-application';
import { Workspace, WorkspaceMemberRole } from 'workspace-core';
import {
  createInMemoryWorkspaceRepository,
  type IInMemoryWorkspaceRepository,
} from 'workspace-testing';

import type { CliConfig } from '../config/cli-config.js';
import { WorkspaceRemoveMemberCommand } from './workspace-remove-member.command.js';

const TELEGRAM_ID = '222333444';
const MEMBER_ID = 'b'.repeat(24);
const ADMIN_ID = 'a'.repeat(24);
const WORKSPACE_ID = 'c'.repeat(24);

function makeUser(): User {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return new User({
    id: MEMBER_ID,
    telegramId: TELEGRAM_ID,
    username: 'dave',
    status: UserStatus.ACTIVE,
    createdAt: now,
    updatedAt: now,
  });
}

function seedWorkspace(repository: IInMemoryWorkspaceRepository): void {
  const now = new Date('2026-01-01T00:00:00.000Z');
  repository.seed(
    new Workspace({
      id: WORKSPACE_ID,
      name: 'Household',
      members: [
        {
          userId: ADMIN_ID,
          role: WorkspaceMemberRole.ADMIN,
          grantedAt: now,
          grantedBy: 'cli',
        },
        {
          userId: MEMBER_ID,
          role: WorkspaceMemberRole.MEMBER,
          grantedAt: now,
          grantedBy: 'cli',
        },
      ],
      version: 0,
      createdAt: now,
      updatedAt: now,
    }),
  );
}

const CLI_CONFIG_STUB: CliConfig = {
  mongoUri: 'mongodb://localhost:27017',
  mongoDbName: 'test',
  mode: 'development',
};

describe('WorkspaceRemoveMemberCommand', () => {
  let logger: pino.Logger;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let workspaceRepository: IInMemoryWorkspaceRepository;
  let removeMember: RemoveMemberService;

  beforeEach(() => {
    logger = pino({ level: 'silent' });
    errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => undefined);
    exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    workspaceRepository = createInMemoryWorkspaceRepository();
    seedWorkspace(workspaceRepository);
    removeMember = new RemoveMemberService({ workspaceRepository });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function makeCommand(
    userRepository: IUserRepository,
  ): WorkspaceRemoveMemberCommand {
    return new WorkspaceRemoveMemberCommand(
      removeMember,
      userRepository,
      CLI_CONFIG_STUB,
      logger,
    );
  }

  it('emits exactly one audit line with action: member.remove and by: cli on success (AC-8)', async () => {
    const userRepository = createFakeUserRepository({
      findByTelegramId: vi.fn().mockResolvedValue(makeUser()),
    });
    const command = makeCommand(userRepository);

    await command.run([], { workspace: WORKSPACE_ID, telegramId: TELEGRAM_ID });

    expect(infoSpy).toHaveBeenCalledOnce();
    expect(infoSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'member.remove',
        workspaceId: WORKSPACE_ID,
        userId: MEMBER_ID,
        telegramId: TELEGRAM_ID,
        by: 'cli',
      }),
      expect.any(String),
    );
    const workspace = await workspaceRepository.findById(WORKSPACE_ID);
    expect(workspace?.isMember(MEMBER_ID)).toBe(false);
    expect(consoleSpy).toHaveBeenCalledOnce();
  });

  it('exits 1 with "User with Telegram ID <id> not found" for an unknown --telegram-id (AC-13)', async () => {
    const userRepository = createFakeUserRepository({
      findByTelegramId: vi.fn().mockResolvedValue(null),
    });
    const command = makeCommand(userRepository);

    await command.run([], {
      workspace: WORKSPACE_ID,
      telegramId: 'unknown-id',
    });

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('User with Telegram ID unknown-id not found'),
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(infoSpy).not.toHaveBeenCalled();
  });
});
