/**
 * Workspace-local authority axis. Orthogonal to the platform `Role`
 * (`shared-contracts`) — never merged with it and never encoded as a
 * `Role` member.
 */
export const WorkspaceMemberRole = {
  ADMIN: 'admin',
  MEMBER: 'member',
} as const;

export type WorkspaceMemberRoleType =
  (typeof WorkspaceMemberRole)[keyof typeof WorkspaceMemberRole];
