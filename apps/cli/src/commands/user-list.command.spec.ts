import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import pino from 'pino';
import { User, UserStatus } from 'identity-core';
import { createFakeUserRepository } from 'identity-testing';
import type { IUserRepository } from 'identity-core';

import { UserListCommand } from './user-list.command.js';

function makeUser(
  overrides: Partial<{
    id: string;
    telegramId: string;
    username?: string;
    firstName?: string;
    status: UserStatus;
  }> = {},
): User {
  return new User({
    id: overrides.id ?? 'user-1',
    telegramId: overrides.telegramId ?? '111222333',
    username: overrides.username,
    firstName: overrides.firstName,
    status: overrides.status ?? UserStatus.PENDING,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe('UserListCommand', () => {
  let logger: pino.Logger;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logger = pino({ level: 'silent' });
    errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function makeCommand(repository: IUserRepository): UserListCommand {
    return new UserListCommand(repository, logger);
  }

  it('prints the header, one row per user, and the total (AC-3)', async () => {
    const alice = makeUser({
      id: 'a',
      telegramId: '1',
      username: 'alice',
      firstName: 'Alice',
      status: UserStatus.ACTIVE,
    });
    const bob = makeUser({
      id: 'b',
      telegramId: '2',
      username: 'bob',
      status: UserStatus.PENDING,
    });
    const repo = createFakeUserRepository({
      findAll: vi.fn().mockResolvedValue([alice, bob]),
    });
    const command = makeCommand(repo);

    await command.run([], {});

    const lines: string[] = consoleSpy.mock.calls.map((call: unknown[]) =>
      String(call[0]),
    );
    expect(lines[0]).toBe(
      'ID | Telegram ID | Username | Display name | Status',
    );
    expect(
      lines.some((line) => line.includes('a | 1 | alice | Alice | active')),
    ).toBe(true);
    expect(
      lines.some((line) => line.includes('b | 2 | bob | bob | pending')),
    ).toBe(true);
    expect(lines).toContain('Total: 2 user(s)');
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('prints "No users found." and does not exit(1) for an empty result (AC-4)', async () => {
    const repo = createFakeUserRepository({
      findAll: vi.fn().mockResolvedValue([]),
    });
    const command = makeCommand(repo);

    await command.run([], {});

    expect(consoleSpy).toHaveBeenCalledWith('No users found.');
    expect(exitSpy).not.toHaveBeenCalledWith(1);
  });

  it('parseStatus rejects an invalid --status, logging the valid values and exiting 1 (AC-5)', () => {
    const repo = createFakeUserRepository();
    const command = makeCommand(repo);

    command.parseStatus('bogus');

    expect(errorSpy).toHaveBeenCalledOnce();
    const [message] = errorSpy.mock.calls[0] as [string];
    expect(message).toContain('bogus');
    expect(message).toContain(UserStatus.PENDING);
    expect(message).toContain(UserStatus.ACTIVE);
    expect(message).toContain(UserStatus.REJECTED);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('parseStatus accepts a valid status and returns it unchanged', () => {
    const repo = createFakeUserRepository();
    const command = makeCommand(repo);

    expect(command.parseStatus(UserStatus.ACTIVE)).toBe(UserStatus.ACTIVE);
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('passes --status and --username through to findAll as filters', async () => {
    const findAll = vi.fn().mockResolvedValue([]);
    const repo = createFakeUserRepository({ findAll });
    const command = makeCommand(repo);

    await command.run([], { status: UserStatus.ACTIVE, username: 'AL' });

    expect(findAll).toHaveBeenCalledWith({
      status: UserStatus.ACTIVE,
      usernameContains: 'AL',
    });
  });
});
