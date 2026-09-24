import {
  getModelForClass,
  index,
  modelOptions,
  prop,
} from '@typegoose/typegoose';
import type { ReturnModelType } from '@typegoose/typegoose';
import type { Connection } from 'mongoose';

import { WorkspaceMemberRole } from 'workspace-core';
import type { WorkspaceMemberRoleType } from 'workspace-core';

/**
 * Allowed persisted values for {@link WorkspaceMemberModel.role}, mirrored
 * from the domain `WorkspaceMemberRole` const so Mongoose can validate the
 * field as a string enum without importing the domain type into the schema
 * decorator metadata.
 */
const WORKSPACE_MEMBER_ROLE_VALUES = Object.values(WorkspaceMemberRole);

/** Embedded subdocument schema for a single `Workspace` membership. */
export class WorkspaceMemberModel {
  /** User id, stored as a string (never as a related-collection ObjectId reference). */
  @prop({ required: true })
  public userId!: string;

  @prop({
    required: true,
    enum: WORKSPACE_MEMBER_ROLE_VALUES,
    type: () => String,
  })
  public role!: WorkspaceMemberRoleType;

  @prop({ required: true })
  public grantedAt!: Date;

  @prop({ required: true })
  public grantedBy!: string;
}

/**
 * Typegoose schema for the `workspaces` collection. Members are embedded
 * (no separate memberships collection — grill "Storage" decision). Mongoose's
 * own `_id` is used as the document id and mapped to the domain `id`
 * (string) by {@link WorkspaceMapper} — `WorkspaceModel` itself never
 * appears outside `workspace-infrastructure`.
 *
 * Multikey index on `members.userId` backs both `findMembership` and
 * `findByMemberUserId`.
 */
@index({ 'members.userId': 1 })
@modelOptions({
  schemaOptions: {
    collection: 'workspaces',
    timestamps: true,
  },
})
export class WorkspaceModel {
  @prop({ required: true })
  public name!: string;

  @prop({ required: true, type: () => [WorkspaceMemberModel], default: [] })
  public members!: WorkspaceMemberModel[];

  @prop({ required: true, default: 0 })
  public version!: number;

  /** Populated by Mongoose via `schemaOptions.timestamps`. */
  public createdAt!: Date;

  /** Populated by Mongoose via `schemaOptions.timestamps`. */
  public updatedAt!: Date;
}

/**
 * Builds (or returns the cached) Typegoose model for {@link WorkspaceModel}
 * bound to the given Mongoose `connection`. Each distinct connection gets its
 * own model instance — Typegoose caches per-connection internally.
 */
export function getWorkspaceModel(
  connection: Connection,
): ReturnModelType<typeof WorkspaceModel> {
  return getModelForClass(WorkspaceModel, { existingConnection: connection });
}
