import { DomainError } from 'shared-errors';
import { Workspace } from 'workspace-core';
import type {
  IWorkspaceRepository,
  WorkspaceMembershipRecord,
} from 'workspace-core';

/** A 24-hex-char ObjectId-shaped id — matches Mongo's own format closely enough to mirror `isValidObjectId` checks. */
const OBJECT_ID_PATTERN = /^[0-9a-f]{24}$/i;

/**
 * A stateful `IWorkspaceRepository` fake, keyed by `id`. Mirrors
 * `MongoWorkspaceRepository`'s semantics exactly: CAS-on-`version` conflicts
 * throw `DomainError.conflict()`, and `findMembership` returns `null` (never
 * throws) for a malformed id, a nonexistent workspace, and a non-member
 * alike.
 */
export interface IInMemoryWorkspaceRepository extends IWorkspaceRepository {
  /** Directly inserts a workspace into the store, bypassing `create()`'s id-generation. */
  seed(workspace: Workspace): void;
}

/**
 * Creates a Map-backed, stateful fake `IWorkspaceRepository` implementation.
 *
 * Unlike a static `vi.fn()` stub, this factory returns real methods backed
 * by an in-memory `Map`, so callers can exercise multi-step scenarios (seed
 * → run a UseCase → read back the mutated state).
 *
 * @returns A fresh, empty in-memory repository ready for test injection.
 */
export function createInMemoryWorkspaceRepository(): IInMemoryWorkspaceRepository {
  const workspacesById = new Map<string, Workspace>();
  let nextId = 1;

  const clone = (workspace: Workspace): Workspace =>
    new Workspace({
      id: workspace.id,
      name: workspace.name,
      members: workspace.members,
      version: workspace.version,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
    });

  return {
    seed(workspace: Workspace): void {
      workspacesById.set(workspace.id, clone(workspace));
    },

    async create(workspace: Workspace): Promise<Workspace> {
      const id =
        workspace.id === ''
          ? `${(nextId++).toString(16).padStart(24, '0')}`
          : workspace.id;
      const persisted = new Workspace({
        id,
        name: workspace.name,
        members: workspace.members,
        version: 0,
        createdAt: workspace.createdAt,
        updatedAt: workspace.updatedAt,
      });
      workspacesById.set(id, persisted);
      return clone(persisted);
    },

    async findById(id: string): Promise<Workspace | null> {
      const found = workspacesById.get(id);
      return found ? clone(found) : null;
    },

    async save(workspace: Workspace): Promise<Workspace> {
      const existing = workspacesById.get(workspace.id);
      // `workspace.version` is already the post-mutation value (domain
      // mutating methods increment it locally) — the stored/expected version
      // is one behind it, mirroring MongoWorkspaceRepository's filter.
      if (!existing || existing.version !== workspace.version - 1) {
        // CAS failure: mirrors MongoWorkspaceRepository's 0-matched throw.
        throw DomainError.conflict(
          'Workspace was modified concurrently; reload and retry.',
        );
      }

      const updated = new Workspace({
        id: existing.id,
        name: workspace.name,
        members: workspace.members,
        version: existing.version + 1,
        createdAt: existing.createdAt,
        updatedAt: new Date(),
      });
      workspacesById.set(existing.id, updated);
      return clone(updated);
    },

    async findAll(): Promise<Workspace[]> {
      return Array.from(workspacesById.values())
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .map((workspace) => clone(workspace));
    },

    async findByMemberUserId(userId: string): Promise<Workspace[]> {
      return Array.from(workspacesById.values())
        .filter((workspace) => workspace.isMember(userId))
        .map((workspace) => clone(workspace));
    },

    async findMembership(
      workspaceId: string,
      userId: string,
    ): Promise<WorkspaceMembershipRecord | null> {
      if (!OBJECT_ID_PATTERN.test(workspaceId)) {
        return null;
      }

      const workspace = workspacesById.get(workspaceId);
      const membership = workspace?.membershipOf(userId);
      if (!workspace || !membership) {
        return null;
      }

      return {
        workspaceId,
        role: membership.role,
        grantedAt: membership.grantedAt,
      };
    },
  };
}
