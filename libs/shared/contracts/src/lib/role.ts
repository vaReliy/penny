/**
 * Roles registry — single source of truth for JWT roles claim values.
 */
export const Role = {
  SUPERADMIN: 'superadmin',
  USER: 'user',
  // TODO: a scoped/tenant-level "admin" role is planned once a
  // group/tenant entity exists — see backlog task for the
  // scoped-admin layer. Do not add before that entity is designed.
} as const;

export type RoleType = (typeof Role)[keyof typeof Role];
