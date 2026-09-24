import { DomainError } from 'shared-errors';

import type { Membership } from './membership.js';
import { WorkspaceMemberRole } from './workspace-member-role.js';
import type { WorkspaceMemberRoleType } from './workspace-member-role.js';

/** Constructor input for {@link Workspace}. */
export interface WorkspaceProps {
  readonly id: string;
  readonly name: string;
  readonly members: readonly Membership[];
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * A family/household aggregate root isolating its members' data from every
 * other workspace. Pure domain entity: no persistence/framework concerns.
 * Every mutating method returns a new `Workspace` instance (the entity is
 * immutable from the outside).
 */
export class Workspace {
  private readonly props: WorkspaceProps;

  public constructor(props: WorkspaceProps) {
    this.props = props;
  }

  public get id(): string {
    return this.props.id;
  }

  public get name(): string {
    return this.props.name;
  }

  public get members(): readonly Membership[] {
    return this.props.members;
  }

  public get version(): number {
    return this.props.version;
  }

  public get createdAt(): Date {
    return this.props.createdAt;
  }

  public get updatedAt(): Date {
    return this.props.updatedAt;
  }

  /**
   * Creates a new workspace seeded with exactly one `ADMIN` membership — a
   * workspace is never born admin-less.
   */
  public static create(
    name: string,
    initialAdminUserId: string,
    grantedBy: string,
    now: Date = new Date(),
  ): Workspace {
    return new Workspace({
      id: '',
      name,
      members: [
        {
          userId: initialAdminUserId,
          role: WorkspaceMemberRole.ADMIN,
          grantedAt: now,
          grantedBy,
        },
      ],
      version: 0,
      createdAt: now,
      updatedAt: now,
    });
  }

  public isMember(userId: string): boolean {
    return this.membershipOf(userId) !== undefined;
  }

  public isAdmin(userId: string): boolean {
    return this.membershipOf(userId)?.role === WorkspaceMemberRole.ADMIN;
  }

  public membershipOf(userId: string): Membership | undefined {
    return this.props.members.find((member) => member.userId === userId);
  }

  public adminUserIds(): readonly string[] {
    return this.props.members
      .filter((member) => member.role === WorkspaceMemberRole.ADMIN)
      .map((member) => member.userId);
  }

  /** Adds a new member. Throws if `userId` already belongs to this workspace. */
  public addMember(
    userId: string,
    role: WorkspaceMemberRoleType,
    grantedBy: string,
    now: Date = new Date(),
  ): Workspace {
    if (this.isMember(userId)) {
      throw DomainError.conflict(
        `User "${userId}" is already a member of this workspace.`,
      );
    }

    const membership: Membership = { userId, role, grantedAt: now, grantedBy };

    return new Workspace({
      ...this.props,
      members: [...this.props.members, membership],
      version: this.props.version + 1,
      updatedAt: now,
    });
  }

  /**
   * Changes an existing member's role. A no-op (same `version`/`members`)
   * when `role` already equals the member's current role. Throws when
   * `userId` is not a member, or when demoting the last `ADMIN`.
   */
  public changeRole(
    userId: string,
    role: WorkspaceMemberRoleType,
    now: Date = new Date(),
  ): Workspace {
    const current = this.membershipOf(userId);
    if (!current) {
      throw DomainError.conflict(
        `User "${userId}" is not a member of this workspace.`,
      );
    }

    if (current.role === role) {
      return this;
    }

    if (
      current.role === WorkspaceMemberRole.ADMIN &&
      role !== WorkspaceMemberRole.ADMIN &&
      this.adminUserIds().length === 1
    ) {
      throw DomainError.forbidden(
        'Cannot demote the last remaining admin of a workspace.',
      );
    }

    return new Workspace({
      ...this.props,
      members: this.props.members.map((member) =>
        member.userId === userId ? { ...member, role } : member,
      ),
      version: this.props.version + 1,
      updatedAt: now,
    });
  }

  /** Removes a member. Throws when `userId` is not a member, or when removing the last `ADMIN`. */
  public removeMember(userId: string, now: Date = new Date()): Workspace {
    const current = this.membershipOf(userId);
    if (!current) {
      throw DomainError.conflict(
        `User "${userId}" is not a member of this workspace.`,
      );
    }

    if (
      current.role === WorkspaceMemberRole.ADMIN &&
      this.adminUserIds().length === 1
    ) {
      throw DomainError.forbidden(
        'Cannot remove the last remaining admin of a workspace.',
      );
    }

    return new Workspace({
      ...this.props,
      members: this.props.members.filter((member) => member.userId !== userId),
      version: this.props.version + 1,
      updatedAt: now,
    });
  }
}
