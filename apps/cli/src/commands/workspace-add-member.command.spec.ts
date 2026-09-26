import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import pino from 'pino';

import { User, UserStatus } from 'identity-core';
import { createFakeUserRepository } from 'identity-testing';
import type { IUserRepository } from 'identity-core';
import { AddMemberService } from 'workspace-application';
import { Workspace, WorkspaceMemberRole } from 'workspace-core';
import {
  createInMemoryWorkspaceRepository,
  type IInMemoryWorkspaceRepository,
} from 'workspace-testing';

import type { CliConfig } from '../config/cli-config.js';
import { WorkspaceAddMemberCommand } from './workspace-add-member.command.js';

const TELEGRAM_ID = '444555666';
const MEMBER_ID = 'b'.repeat(24);
const ADMIN_ID = 'a'.repeat(24);
const WORKSPACE_ID = 'c'.repeat(24);

function makeUser(status: UserStatus): User {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return new User({
    id: MEMBER_ID,
    telegramId: TELEGRAM_ID,
    username: 'bob',
    status,
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

describe('WorkspaceAddMemberCommand', () => {
  let logger: pino.Logger;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let workspaceRepository: IInMemoryWorkspaceRepository;
  let addMember: AddMemberService;

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
    addMember = new AddMemberService({ workspaceRepository });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function makeCommand(
    userRepository: IUserRepository,
  ): WorkspaceAddMemberCommand {
    return new WorkspaceAddMemberCommand(
      addMember,
      userRepository,
      CLI_CONFIG_STUB,
      logger,
    );
  }

  it('adds as member when --role is omitted', async () => {
    const userRepository = createFakeUserRepository({
      findByTelegramId: vi.fn().mockResolvedValue(makeUser(UserStatus.ACTIVE)),
    });
    const command = makeCommand(userRepository);

    await command.run([], { workspace: WORKSPACE_ID, telegramId: TELEGRAM_ID });

    const workspace = await workspaceRepository.findById(WORKSPACE_ID);
    expect(workspace?.membershipOf(MEMBER_ID)?.role).toBe(
      WorkspaceMemberRole.MEMBER,
    );
    expect(exitSpy).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledOnce();
  });

  it('refuses a REJECTED user with the exact refusal message + exit 1', async () => {
    const userRepository = createFakeUserRepository({
      findByTelegramId: vi
        .fn()
        .mockResolvedValue(makeUser(UserStatus.REJECTED)),
    });
    const command = makeCommand(userRepository);

    await command.run([], { workspace: WORKSPACE_ID, telegramId: TELEGRAM_ID });

    expect(errorSpy).toHaveBeenCalledWith(
      `Cannot add ${TELEGRAM_ID}: user status is rejected, must be active`,
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
    const workspace = await workspaceRepository.findById(WORKSPACE_ID);
    expect(workspace?.isMember(MEMBER_ID)).toBe(false);
  });

  it('emits exactly one audit line with action: member.add on success', async () => {
    const userRepository = createFakeUserRepository({
      findByTelegramId: vi.fn().mockResolvedValue(makeUser(UserStatus.ACTIVE)),
    });
    const command = makeCommand(userRepository);

    await command.run([], {
      workspace: WORKSPACE_ID,
      telegramId: TELEGRAM_ID,
      role: WorkspaceMemberRole.ADMIN,
    });

    expect(infoSpy).toHaveBeenCalledOnce();
    expect(infoSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'member.add',
        workspaceId: WORKSPACE_ID,
        userId: MEMBER_ID,
        telegramId: TELEGRAM_ID,
        role: WorkspaceMemberRole.ADMIN,
        by: 'cli',
      }),
      expect.any(String),
    );
  });

  it('exits 1 with "User with Telegram ID <id> not found" for an unknown --telegram-id', async () => {
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

  describe('parseRole', () => {
    it('rejects "owner" with the exact error + exit 1', () => {
      const userRepository = createFakeUserRepository();
      const command = makeCommand(userRepository);

      command.parseRole('owner');

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Invalid role "owner". Must be one of: admin, member',
        ),
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });
});
