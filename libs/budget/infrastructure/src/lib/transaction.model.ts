import {
  getModelForClass,
  index,
  modelOptions,
  prop,
} from '@typegoose/typegoose';
import type { ReturnModelType } from '@typegoose/typegoose';
import type { Connection } from 'mongoose';

import { TransactionType } from 'budget-contracts';

/**
 * Typegoose schema for the `transactions` collection. Mirrors the domain
 * `Transaction` entity's persisted fields (per `DECISIONS.md` ADR-007).
 * Penny's hottest-read collection — every read screen (balance, history,
 * planner, chart) aggregates over it.
 *
 * Money storage: `amount` is a Mongoose-native `BigInt` SchemaType (BSON
 * 64-bit `long`), same rationale as `MonthlyBudgetModel` — round-trips
 * `bigint` exactly, no float, `$sum`-aggregation compatible. `currency` is
 * stored alongside `amount` since `Money` is a (minorUnits, currency) pair.
 *
 * Transactions are immutable/create-only at MVP (edit/delete deferred to a
 * later "Q5" phase, per ADR-007) — no unique index is needed here, unlike
 * `CategoryModel`/`MonthlyBudgetModel`.
 *
 * Justified index set (see the library README for full rationale):
 * - `{workspaceId:1, date:-1}` — unscoped period/history queries (no
 *   category/account narrowing), newest-first.
 * - `{workspaceId:1, categoryId:1, date:-1}` — category-narrowed listing,
 *   `sumExpenseByCategory` (planner/chart), `existsForCategory`.
 * - `{workspaceId:1, accountId:1, date:-1}` — account-narrowed listing and
 *   `sumAmountsByType` (derived balance), which is always filtered by
 *   `accountId` and optionally bounded by a date range.
 */
@index({ workspaceId: 1, date: -1 })
@index({ workspaceId: 1, categoryId: 1, date: -1 })
@index({ workspaceId: 1, accountId: 1, date: -1 })
@modelOptions({
  schemaOptions: {
    collection: 'transactions',
  },
})
export class TransactionModel {
  @prop({ required: true })
  public workspaceId!: string;

  @prop({ required: true })
  public accountId!: string;

  @prop({ required: true })
  public categoryId!: string;

  @prop({
    required: true,
    enum: Object.values(TransactionType),
    type: () => String,
  })
  public type!: TransactionType;

  /** Always positive, in integer minor units. See class doc for storage rationale. */
  @prop({ type: () => BigInt, required: true })
  public amount!: bigint;

  /** ISO 4217 currency code paired with `amount` to reconstitute `Money`. */
  @prop({ required: true })
  public currency!: string;

  /** Economic date (e.g. purchase date) — drives month attribution. */
  @prop({ required: true })
  public date!: Date;

  @prop()
  public description?: string;

  /** `userId` of the caller who recorded this transaction (audit trail). */
  @prop({ required: true })
  public createdBy!: string;

  @prop({ required: true })
  public createdAt!: Date;
}

/**
 * Builds (or returns the cached) Typegoose model for {@link TransactionModel}
 * bound to the given Mongoose `connection`. Each distinct connection gets
 * its own model instance — Typegoose caches per-connection internally.
 */
export function getTransactionModel(
  connection: Connection,
): ReturnModelType<typeof TransactionModel> {
  return getModelForClass(TransactionModel, { existingConnection: connection });
}
