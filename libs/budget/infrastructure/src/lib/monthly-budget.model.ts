import {
  getModelForClass,
  index,
  modelOptions,
  prop,
} from '@typegoose/typegoose';
import type { ReturnModelType } from '@typegoose/typegoose';
import type { Connection } from 'mongoose';

/**
 * Typegoose schema for the `monthlyBudgets` collection. Mirrors the domain
 * `MonthlyBudget` entity's persisted fields (per `DECISIONS.md` ADR-007).
 *
 * Money storage: `amount` is a Mongoose-native `BigInt` SchemaType, which
 * Mongoose stores as BSON 64-bit `long` — round-trips `bigint` exactly, no
 * float, and is `$sum`-aggregation compatible (verified against the pinned
 * `mongoose@8.24.1` via context7 docs: "Mongoose supports JavaScript BigInts
 * as a SchemaType. BigInts are stored as 64-bit integers in MongoDB (BSON
 * type 'long')."). `currency` is stored alongside `amount` since `Money` is
 * a (minorUnits, currency) pair — `CategoryMapper`/`MonthlyBudgetMapper` are
 * the only place these two fields recombine into a domain `Money` value.
 *
 * Unique compound index `{workspaceId:1, categoryId:1, month:1}` — at most
 * one budget per category per month. `upsertAmount` relies on this index for
 * its atomic `findOneAndUpdate` upsert (no read-modify-write).
 */
@index({ workspaceId: 1, categoryId: 1, month: 1 }, { unique: true })
@index({ workspaceId: 1, month: 1 })
@modelOptions({
  schemaOptions: {
    collection: 'monthlyBudgets',
  },
})
export class MonthlyBudgetModel {
  @prop({ required: true })
  public workspaceId!: string;

  @prop({ required: true })
  public categoryId!: string;

  /** Calendar month this budget targets, `'YYYY-MM'`. */
  @prop({ required: true })
  public month!: string;

  /** Ceiling target for expense spending, in minor units. See class doc. */
  @prop({ type: () => BigInt, required: true })
  public amount!: bigint;

  /** ISO 4217 currency code paired with `amount` to reconstitute `Money`. */
  @prop({ required: true })
  public currency!: string;
}

/**
 * Builds (or returns the cached) Typegoose model for
 * {@link MonthlyBudgetModel} bound to the given Mongoose `connection`. Each
 * distinct connection gets its own model instance — Typegoose caches
 * per-connection internally.
 */
export function getMonthlyBudgetModel(
  connection: Connection,
): ReturnModelType<typeof MonthlyBudgetModel> {
  return getModelForClass(MonthlyBudgetModel, {
    existingConnection: connection,
  });
}
