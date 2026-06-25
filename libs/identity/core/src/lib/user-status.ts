/**
 * Lifecycle status of a platform {@link User}.
 *
 * - `pending` — registered but not yet approved/rejected by an admin.
 * - `active` — approved; may authenticate and use the platform.
 * - `rejected` — denied access; terminal state.
 */
export const UserStatus = {
  PENDING: 'pending',
  ACTIVE: 'active',
  REJECTED: 'rejected',
} as const;

export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];
