import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import pino from 'pino';

import { User, UserStatus } from 'identity-core';
import { createFakeUserRepository } from 'identity-testing';
import type { IUserRepository } from 'identity-core';
import { ListWorkspacesService } from 'workspace-application';
import { Workspace, WorkspaceMemberRole } from 'workspace-core';
import {
  createInMemoryWorkspaceRepository,
  type IInMemoryWorkspaceRepository,
} from 'workspace-testing';

import type { CliConfig } from '../config/cli-config.js';
import { WorkspaceListCommand } from './workspace-list.command.js';

const TELEGRAM_ID = '333444555';
const ADMIN_ID = 'a'.repeat(24);
const MISSING_MEMBER_ID = 'b'.repeat(24);
const WORKSPACE_ID = 'c'.repeat(24);

function makeAdmin(): User {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return new User({
    id: ADMIN_ID,
    telegramId: TELEGRAM_ID,
    username: 'erin',
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
          userId: MISSING_MEMBER_ID,
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

describe('WorkspaceListCommand', () => {
  let logger: pino.Logger;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let workspaceRepository: IInMemoryWorkspaceRepository;
  let listWorkspaces: ListWorkspacesService;

  beforeEach(() => {
    logger = pino({ level: 'silent' });
    errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    workspaceRepository = createInMemoryWorkspaceRepository();
    listWorkspaces = new ListWorkspacesService({ workspaceRepository });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function makeCommand(userRepository: IUserRepository): WorkspaceListCommand {
    return new WorkspaceListCommand(
      listWorkspaces,
      userRepository,
      CLI_CONFIG_STUB,
      logger,
    );
  }

  it('resolves --telegram-id to a userId and filters to that user’s workspaces (AC-10)', async () => {
    seedWorkspace(workspaceRepository);
    const userRepository = createFakeUserRepository({
      findByTelegramId: vi.fn().mockResolvedValue(makeAdmin()),
      findById: vi.fn().mockResolvedValue(null),
    });
    const runSpy = vi.spyOn(listWorkspaces, 'run');
    const command = makeCommand(userRepository);

    await command.run([], { telegramId: TELEGRAM_ID });

    expect(runSpy).toHaveBeenCalledWith(
      { memberUserId: ADMIN_ID },
      expect.anything(),
    );
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('prints "No workspaces found." and exits 0 for an empty result (AC-11)', async () => {
    const userRepository = createFakeUserRepository();
    const command = makeCommand(userRepository);

    await command.run([], {});

    expect(consoleSpy).toHaveBeenCalledWith('No workspaces found.');
    expect(exitSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('exits 1 with "User with Telegram ID <id> not found" for an unknown --telegram-id (AC-13)', async () => {
    const userRepository = createFakeUserRepository({
      findByTelegramId: vi.fn().mockResolvedValue(null),
    });
    const command = makeCommand(userRepository);

    await command.run([], { telegramId: 'unknown-id' });

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('User with Telegram ID unknown-id not found'),
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('shows each member’s role/status, and "missing" for an absent user doc (AC-12)', async () => {
    seedWorkspace(workspaceRepository);
    const userRepository = createFakeUserRepository({
      findById: vi.fn().mockImplementation(async (id: string) => {
        if (id === ADMIN_ID) return makeAdmin();
        return null;
      }),
    });
    const command = makeCommand(userRepository);

    await command.run([], {});

    const lines: string[] = consoleSpy.mock.calls.map((call: unknown[]) =>
      String(call[0]),
    );
    expect(
      lines.some((line) =>
        line.includes(`${WORKSPACE_ID} | Household | 2 member(s)`),
      ),
    ).toBe(true);
    expect(
      lines.some((line) =>
        line.includes(`  - ${TELEGRAM_ID} | erin | admin | active`),
      ),
    ).toBe(true);
    expect(
      lines.some((line) =>
        line.includes(`  - ${MISSING_MEMBER_ID} | - | member | missing`),
      ),
    ).toBe(true);
    expect(lines).toContain('Total: 1 workspace(s)');
  });
});
