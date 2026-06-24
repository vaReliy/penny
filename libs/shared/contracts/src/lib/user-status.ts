/**
 * Lifecycle status of a platform user account.
 * Types-only contract — kept here so both web and server agree on the
 * union without either depending on the other's domain model.
 */
export type UserStatus = 'active' | 'pending' | 'banned';
