import {
  getModelForClass,
  index,
  modelOptions,
  prop,
} from '@typegoose/typegoose';
import type { ReturnModelType } from '@typegoose/typegoose';
import type { Connection } from 'mongoose';

import { UserStatus } from 'shared-contracts';

/**
 * Allowed persisted values for {@link UserDocument.status}, mirrored from the
 * domain `UserStatus` const so Mongoose can validate the field as a string enum
 * without importing the domain type into the schema decorator metadata.
 */
const USER_STATUS_VALUES = Object.values(UserStatus);

/**
 * Typegoose schema for the `users` collection. Mirrors the domain `User`
 * entity's persisted fields. Mongoose's own `_id` is used as the document
 * id and mapped to the domain `id` (string) by {@link UserMapper} —
 * `UserModel` itself never appears outside `identity-infrastructure`.
 */
@index({ telegramId: 1 }, { unique: true })
@modelOptions({
  schemaOptions: {
    collection: 'users',
    timestamps: true,
  },
})
export class UserModel {
  @prop({ required: true })
  public telegramId!: string;

  @prop()
  public firstName?: string;

  @prop()
  public lastName?: string;

  @prop()
  public username?: string;

  @prop()
  public photoUrl?: string;

  @prop({ required: true, enum: USER_STATUS_VALUES, type: () => String })
  public status!: UserStatus;

  /** Populated by Mongoose via `schemaOptions.timestamps`. */
  public createdAt!: Date;

  /** Populated by Mongoose via `schemaOptions.timestamps`. */
  public updatedAt!: Date;
}

/**
 * Builds (or returns the cached) Typegoose model for {@link UserModel} bound
 * to the given Mongoose `connection`. Each distinct connection gets its own
 * model instance — Typegoose caches per-connection internally.
 */
export function getUserModel(
  connection: Connection,
): ReturnModelType<typeof UserModel> {
  return getModelForClass(UserModel, { existingConnection: connection });
}
