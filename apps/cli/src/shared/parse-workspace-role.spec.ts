import { describe, expect, it, vi, afterEach } from 'vitest';
import pino from 'pino';

import { WorkspaceMemberRole } from 'workspace-core';

import { parseWorkspaceRole } from './parse-workspace-role.js';

describe('parseWorkspaceRole', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a valid role unchanged', () => {
    const logger = pino({ level: 'silent' });
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);

    expect(parseWorkspaceRole(WorkspaceMemberRole.ADMIN, logger)).toBe(
      WorkspaceMemberRole.ADMIN,
    );
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('rejects an invalid role, logging the expected message and exiting 1', () => {
    const logger = pino({ level: 'silent' });
    const errorSpy = vi
      .spyOn(logger, 'error')
      .mockImplementation(() => undefined);
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);

    parseWorkspaceRole('owner', logger);

    expect(errorSpy).toHaveBeenCalledOnce();
    const [message] = errorSpy.mock.calls[0] as [string];
    expect(message).toContain(
      'Invalid role "owner". Must be one of: admin, member',
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
