import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import pino from 'pino';

import { User, UserStatus } from 'identity-core';
import { createFakeUserRepository } from 'identity-testing';
import type { IUserRepository } from 'identity-core';
import { SetMemberRoleService } from 'workspace-application';
import { Workspace, WorkspaceMemberRole } from 'workspace-core';
import {
  createInMemoryWorkspaceRepository,
  type IInMemoryWorkspaceRepository,
} from 'workspace-testing';

import type { CliConfig } from '../config/cli-config.js';
import { WorkspaceSetRoleCommand } from './workspace-set-role.command.js';

const TELEGRAM_ID = '777888999';
const MEMBER_ID = 'b'.repeat(24);
const ADMIN_ID = 'a'.repeat(24);
const WORKSPACE_ID = 'c'.repeat(24);

function makeUser(): User {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return new User({
    id: MEMBER_ID,
    telegramId: TELEGRAM_ID,
    username: 'carol',
    status: UserStatus.ACTIVE,
    createdAt: now,
    updatedAt: now,
  });
}

function seedWorkspace(
  repository: IInMemoryWorkspaceRepository,
  members: { userId: string; role: string }[],
): void {
  const now = new Date('2026-01-01T00:00:00.000Z');
  repository.seed(
    new Workspace({
      id: WORKSPACE_ID,
      name: 'Household',
      members: members.map((member) => ({
        userId: member.userId,
        role: member.role as (typeof WorkspaceMemberRole)[keyof typeof WorkspaceMemberRole],
        grantedAt: now,
        grantedBy: 'cli',
      })),
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

describe('WorkspaceSetRoleCommand', () => {
  let logger: pino.Logger;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let workspaceRepository: IInMemoryWorkspaceRepository;
  let setMemberRole: SetMemberRoleService;

  beforeEach(() => {
    logger = pino({ level: 'silent' });
    errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => undefined);
    exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    workspaceRepository = createInMemoryWorkspaceRepository();
    setMemberRole = new SetMemberRoleService({ workspaceRepository });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function makeCommand(
    userRepository: IUserRepository,
  ): WorkspaceSetRoleCommand {
    return new WorkspaceSetRoleCommand(
      setMemberRole,
      userRepository,
      CLI_CONFIG_STUB,
      logger,
    );
  }

  it('prints "Role unchanged", exits 0, and emits no audit line when changed is false (AC-6)', async () => {
    seedWorkspace(workspaceRepository, [
      { userId: ADMIN_ID, role: WorkspaceMemberRole.ADMIN },
      { userId: MEMBER_ID, role: WorkspaceMemberRole.MEMBER },
    ]);
    const userRepository = createFakeUserRepository({
      findByTelegramId: vi.fn().mockResolvedValue(makeUser()),
    });
    const command = makeCommand(userRepository);

    await command.run([], {
      workspace: WORKSPACE_ID,
      telegramId: TELEGRAM_ID,
      role: WorkspaceMemberRole.MEMBER,
    });

    expect(consoleSpy).toHaveBeenCalledWith('Role unchanged');
    expect(exitSpy).not.toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled();
  });

  it('prints "<CODE>: <message>" and exits 1 when demoting the last admin (AC-7)', async () => {
    seedWorkspace(workspaceRepository, [
      { userId: MEMBER_ID, role: WorkspaceMemberRole.ADMIN },
    ]);
    const userRepository = createFakeUserRepository({
      findByTelegramId: vi.fn().mockResolvedValue(makeUser()),
    });
    const command = makeCommand(userRepository);

    await command.run([], {
      workspace: WORKSPACE_ID,
      telegramId: TELEGRAM_ID,
      role: WorkspaceMemberRole.MEMBER,
    });

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringMatching(/^[A-Z_]+: Cannot demote the last remaining admin/),
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(infoSpy).not.toHaveBeenCalled();
  });

  it('emits exactly one audit line with action: member.set-role on a real change (AC-9)', async () => {
    seedWorkspace(workspaceRepository, [
      { userId: ADMIN_ID, role: WorkspaceMemberRole.ADMIN },
      { userId: MEMBER_ID, role: WorkspaceMemberRole.MEMBER },
    ]);
    const userRepository = createFakeUserRepository({
      findByTelegramId: vi.fn().mockResolvedValue(makeUser()),
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
        action: 'member.set-role',
        workspaceId: WORKSPACE_ID,
        userId: MEMBER_ID,
        telegramId: TELEGRAM_ID,
        role: WorkspaceMemberRole.ADMIN,
        by: 'cli',
      }),
      expect.any(String),
    );
  });

  it('exits 1 with "User with Telegram ID <id> not found" for an unknown --telegram-id (AC-13)', async () => {
    const userRepository = createFakeUserRepository({
      findByTelegramId: vi.fn().mockResolvedValue(null),
    });
    const command = makeCommand(userRepository);

    await command.run([], {
      workspace: WORKSPACE_ID,
      telegramId: 'unknown-id',
      role: WorkspaceMemberRole.MEMBER,
    });

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('User with Telegram ID unknown-id not found'),
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(infoSpy).not.toHaveBeenCalled();
  });
});
