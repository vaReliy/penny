import type { DocumentType } from '@typegoose/typegoose';

import { Workspace } from 'workspace-core';
import type { Membership, WorkspaceMembershipRecord } from 'workspace-core';

import type {
  WorkspaceMemberModel,
  WorkspaceModel,
} from './workspace.model.js';

/**
 * Plain persistence shape accepted by {@link MongoWorkspaceRepository} when
 * creating/updating a document. Mirrors {@link WorkspaceModel}'s own fields
 * (minus Mongoose/Typegoose machinery) so callers outside this file never
 * need to reference Mongoose types.
 */
export interface WorkspacePersistence {
  readonly name: string;
  readonly members: readonly Membership[];
}

/**
 * Translates between the domain `Workspace` entity and the Typegoose
 * `WorkspaceModel` persistence shape. Mongoose/Typegoose/BSON types are
 * confined to this file (and `workspace.model.ts`) — nothing leaks past
 * `MongoWorkspaceRepository`'s public surface, which only returns `Workspace`
 * domain entities.
 */
export const WorkspaceMapper = {
  /** Converts a hydrated Mongoose document into a domain `Workspace` entity. */
  toDomain(doc: DocumentType<WorkspaceModel>): Workspace {
    return new Workspace({
      id: doc._id.toString(),
      name: doc.name,
      members: doc.members.map((member) =>
        WorkspaceMapper.memberToDomain(member),
      ),
      version: doc.version,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    });
  },

  /** Converts an embedded `WorkspaceMemberModel` subdocument into a domain `Membership`. */
  memberToDomain(member: WorkspaceMemberModel): Membership {
    return {
      userId: member.userId,
      role: member.role,
      grantedAt: member.grantedAt,
      grantedBy: member.grantedBy,
    };
  },

  /**
   * Converts a projected `members.$` single-element array (from
   * `findMembership`'s query) into a `WorkspaceMembershipRecord`.
   */
  toMembershipRecord(
    workspaceId: string,
    member: WorkspaceMemberModel,
  ): WorkspaceMembershipRecord {
    return {
      workspaceId,
      role: member.role,
      grantedAt: member.grantedAt,
    };
  },

  /** Converts a domain `Workspace` entity into the plain persistence shape. */
  toPersistence(workspace: Workspace): WorkspacePersistence {
    return {
      name: workspace.name,
      members: workspace.members,
    };
  },
};
