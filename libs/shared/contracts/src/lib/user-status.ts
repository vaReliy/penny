/**
 * Authoritative UserStatus definition for the entire monorepo.
 * All consumers (identity/core, identity/infrastructure, identity/application, apps/api)
 * import from this single location. This is the single source of truth — do not duplicate.
 *
 * - `pending`  — registered but not yet approved/rejected by an admin.
 * - `active`   — approved; may authenticate and use the platform.
 * - `rejected` — denied access; terminal state.
 */
export const UserStatus = {
  PENDING: 'pending',
  ACTIVE: 'active',
  REJECTED: 'rejected',
} as const;

export type UserStatusType = (typeof UserStatus)[keyof typeof UserStatus];
export type UserStatus = UserStatusType;
