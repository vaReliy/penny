import type { User } from 'identity-core';
import { UserStatus } from 'shared-contracts';
import type pino from 'pino';

/**
 * `true` when `user.status === ACTIVE`. Otherwise logs the bare refusal
 * message (no `<CODE>:` prefix — unlike `printCliError`, which is reserved
 * for the aggregate's invariant errors) and calls `process.exit(1)`.
 * Callers must `return` immediately when this returns `false` — under a
 * mocked `process.exit` (tests), execution would otherwise continue past
 * the refusal.
 *
 * Shared by `workspace:create` (admin must be active) and
 * `workspace:add-member` (member must be active) — both use identical
 * refusal wording.
 */
export function checkActiveUser(user: User, logger: pino.Logger): boolean {
  if (user.status === UserStatus.ACTIVE) {
    return true;
  }
  logger.error(
    `Cannot add ${user.telegramId}: user status is ${user.status}, must be active`,
  );
  process.exit(1);
}
