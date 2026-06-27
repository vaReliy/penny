/**
 * Re-exports `UserStatus` from the monorepo's single source of truth.
 * The authoritative definition lives in `shared-contracts`; nothing in
 * `identity/core` or any other library should define its own copy.
 */
export { UserStatus } from 'shared-contracts';
export type { UserStatusType } from 'shared-contracts';
