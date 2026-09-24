import type { WorkspaceMemberRoleType } from './workspace-member-role.js';
import type { Workspace } from './workspace.js';

/** A single membership record returned by {@link IWorkspaceRepository.findMembership}. */
export interface WorkspaceMembershipRecord {
  readonly workspaceId: string;
  readonly role: WorkspaceMemberRoleType;
  readonly grantedAt: Date;
}

/**
 * Data access contract for {@link Workspace} aggregates.
 *
 * `create` persists a not-yet-persisted `Workspace` (`id === ''`) and
 * returns it with its assigned id. `save` persists an already-persisted
 * `Workspace` under optimistic concurrency control on `version` — it must
 * throw a conflict error when the stored `version` no longer matches the
 * entity being saved, rather than silently overwriting a concurrent write.
 * Concrete implementations (`type:infrastructure`) adapt this against a
 * specific ORM.
 */
export interface IWorkspaceRepository {
  /** Persists a not-yet-persisted workspace and returns it with its assigned id. */
  create(workspace: Workspace): Promise<Workspace>;

  /** Finds a workspace by id, or `null` if none exists. */
  findById(id: string): Promise<Workspace | null>;

  /**
   * Persists an already-persisted workspace under optimistic concurrency
   * control. Throws a conflict error when the stored `version` has moved
   * past the version this `workspace` was loaded at.
   */
  save(workspace: Workspace): Promise<Workspace>;

  /** Returns every workspace. */
  findAll(): Promise<Workspace[]>;

  /** Finds every workspace `userId` belongs to. */
  findByMemberUserId(userId: string): Promise<Workspace[]>;

  /** Finds `userId`'s membership in `workspaceId`, or `null` if they are not a member. */
  findMembership(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceMembershipRecord | null>;
}
