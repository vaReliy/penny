import type { RoleType } from './role.js';
import type { UserStatus } from './user-status.js';

/**
 * Minimal authenticated-user shape attached to a server session / request
 * context after successful authentication. Types-only — no logic.
 */
export interface SessionUser {
  readonly id: string;
  readonly telegramId: string;
  readonly displayName: string;
  readonly status: UserStatus;
  readonly roles: readonly RoleType[];
}
