/**
 * Roles registry — single source of truth for JWT roles claim values.
 */
export const Role = {
  SUPERADMIN: 'superadmin',
  USER: 'user',
  // Platform-wide roles only. Workspace-local authority is
  // `WorkspaceMemberRole` (`libs/workspace/core`) — never encoded here.
} as const;

export type RoleType = (typeof Role)[keyof typeof Role];
