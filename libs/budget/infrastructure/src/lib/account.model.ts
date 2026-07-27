import {
  getModelForClass,
  index,
  modelOptions,
  prop,
} from '@typegoose/typegoose';
import type { ReturnModelType } from '@typegoose/typegoose';
import type { Connection } from 'mongoose';

/**
 * Typegoose schema for the `accounts` collection. Mirrors the domain
 * `Account` entity's persisted fields (per `DECISIONS.md` ADR-007).
 * Mongoose's own `_id` is used as the document id and mapped to the domain
 * `id` (string) by {@link AccountMapper} — `AccountModel` itself never
 * appears outside `budget-infrastructure`.
 *
 * Unique `{workspaceId:1, name:1}` index: not a business-rule uniqueness
 * constraint (unlike `CategoryModel`'s name uniqueness) but the filter this
 * repository's `findOrCreateDefault` upsert relies on to stay race-free —
 * see `MongoAccountRepository.findOrCreateDefault`.
 */
@index({ workspaceId: 1, name: 1 }, { unique: true })
@modelOptions({
  schemaOptions: {
    collection: 'accounts',
  },
})
export class AccountModel {
  @prop({ required: true })
  public workspaceId!: string;

  @prop({ required: true })
  public name!: string;

  @prop({ required: true })
  public currency!: string;

  @prop({ required: true })
  public createdAt!: Date;
}

/**
 * Builds (or returns the cached) Typegoose model for {@link AccountModel}
 * bound to the given Mongoose `connection`. Each distinct connection gets
 * its own model instance — Typegoose caches per-connection internally.
 */
export function getAccountModel(
  connection: Connection,
): ReturnModelType<typeof AccountModel> {
  return getModelForClass(AccountModel, { existingConnection: connection });
}
