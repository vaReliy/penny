import type { WorkspaceMemberRoleType } from './workspace-member-role.js';

/**
 * A single user's membership in a `Workspace`. `userId` is a by-value
 * reference to a User's id only — this lib never imports the User entity.
 */
export interface Membership {
  readonly userId: string;
  readonly role: WorkspaceMemberRoleType;
  readonly grantedAt: Date;
  readonly grantedBy: string;
}
