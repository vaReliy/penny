import type pino from 'pino';

import type { ReturnModelType } from '@typegoose/typegoose';
import type { Connection, FilterQuery } from 'mongoose';
import { isValidObjectId } from 'mongoose';

import type {
  CategoryExpenseTotal,
  ITransactionRepository,
  TransactionAggregationFilter,
  TransactionFilter,
  TransactionTypeTotals,
  TransactionUpdateFields,
} from 'budget-core';
import { Transaction } from 'budget-core';
import { TransactionType } from 'budget-contracts';
import { InfrastructureError } from 'shared-errors';

import { TransactionMapper } from './transaction.mapper.js';
import {
  getTransactionModel,
  type TransactionModel,
} from './transaction.model.js';

/**
 * A raw BSON 64-bit `Long` (or any driver representation carrying a
 * `toBigInt`/`toString` conversion) as returned by an aggregation pipeline.
 * Mongoose does **not** cast aggregation results back through its
 * BigInt-SchemaType machinery (aggregation output is a plain POJO, not a
 * hydrated document — see Mongoose's own aggregation docs), so a `$sum` over
 * a BigInt field can surface as a native `bigint`, a driver `Long`-like
 * object, or (rarely) a plain `number` depending on the exact driver/BSON
 * version — this repository must normalize explicitly rather than assume.
 */
type RawAggregateAmount =
  | bigint
  | number
  | { toString(): string }
  | null
  | undefined;

/** Normalizes an aggregation `$sum` result (see {@link RawAggregateAmount}) to a `bigint`, defaulting to `0n`. */
function toBigIntAmount(value: RawAggregateAmount): bigint {
  if (value === null || value === undefined) {
    return 0n;
  }
  if (typeof value === 'bigint') {
    return value;
  }
  if (typeof value === 'number') {
    return BigInt(Math.trunc(value));
  }
  return BigInt(value.toString());
}

/** Builds the Mongo filter shared by `findByWorkspace`, `sumAmountsByType`, and `sumExpenseByCategory`. */
function buildMatch(
  workspaceId: string,
  filter?: {
    readonly type?: string;
    readonly categoryId?: string;
    readonly accountId?: string;
    readonly from?: Date;
    readonly to?: Date;
  },
): FilterQuery<TransactionModel> {
  const match: Record<string, unknown> = { workspaceId };

  if (filter?.type) {
    match['type'] = filter.type;
  }
  if (filter?.categoryId) {
    match['categoryId'] = filter.categoryId;
  }
  if (filter?.accountId) {
    match['accountId'] = filter.accountId;
  }
  // Half-open range `[from, to)`, matching `resolveMonthRange`'s contract —
  // `to` is exclusive.
  if (filter?.from || filter?.to) {
    const dateFilter: Record<string, Date> = {};
    if (filter.from) {
      dateFilter['$gte'] = filter.from;
    }
    if (filter.to) {
      dateFilter['$lt'] = filter.to;
    }
    match['date'] = dateFilter;
  }

  return match as FilterQuery<TransactionModel>;
}

/**
 * `ITransactionRepository` implementation backed by MongoDB via
 * Mongoose/Typegoose. Mirrors `MongoCategoryRepository`/
 * `MongoMonthlyBudgetRepository`'s structure: constructed with an
 * already-connected Mongoose `Connection`; every public method
 * returns/accepts domain `Transaction` entities only (Mongoose/BSON types
 * never escape this class, see `TransactionMapper`).
 *
 * Transactions are immutable/create-only at MVP (ADR-007): `save` always
 * inserts (no unique index to violate, so no domain-conflict translation is
 * needed here, unlike `MongoCategoryRepository`). `updateInWorkspace`/
 * `deleteInWorkspace` are implemented per the `ITransactionRepository`
 * contract but are deferred to a later "Q5" edit phase — no current caller
 * invokes them.
 *
 * Every aggregation method (`sumAmountsByType`, `sumExpenseByCategory`) is a
 * repository-pushed Mongo pipeline (`$match` + `$group`), never a
 * fetch-all-and-reduce over the transaction set — this is Penny's hottest
 * collection.
 */
export class MongoTransactionRepository implements ITransactionRepository {
  private readonly model: ReturnModelType<typeof TransactionModel>;
  private readonly logger: pino.Logger;

  public constructor(connection: Connection, logger: pino.Logger) {
    this.model = getTransactionModel(connection);
    this.logger = logger;
  }

  public async findById(id: string): Promise<Transaction | null> {
    if (!isValidObjectId(id)) {
      return null;
    }
    try {
      const doc = await this.model.findById(id).exec();
      return doc ? TransactionMapper.toDomain(doc) : null;
    } catch (error) {
      throw this.toInfrastructureError(error, 'findById');
    }
  }

  /**
   * Finds transactions in `workspaceId`, optionally narrowed by `filter`,
   * sorted newest-first by economic `date`. Callers (e.g.
   * `ListTransactionsService`) additionally re-sort in-memory by
   * `(date, createdAt)` for a stable tie-break — this method's own sort
   * exists so an unsorted caller still gets a sensible, index-backed order
   * (`{workspaceId, date:-1}` / `{workspaceId, categoryId, date:-1}` /
   * `{workspaceId, accountId, date:-1}`, whichever prefix `filter` narrows
   * to).
   */
  public async findByWorkspace(
    workspaceId: string,
    filter?: TransactionFilter,
  ): Promise<Transaction[]> {
    try {
      const match = buildMatch(workspaceId, filter);
      const docs = await this.model.find(match).sort({ date: -1 }).exec();
      return docs.map((doc) => TransactionMapper.toDomain(doc));
    } catch (error) {
      throw this.toInfrastructureError(error, 'findByWorkspace');
    }
  }

  public async findByIdInWorkspace(
    id: string,
    workspaceId: string,
  ): Promise<Transaction | null> {
    if (!isValidObjectId(id)) {
      return null;
    }
    try {
      const doc = await this.model.findOne({ _id: id, workspaceId }).exec();
      return doc ? TransactionMapper.toDomain(doc) : null;
    } catch (error) {
      throw this.toInfrastructureError(error, 'findByIdInWorkspace');
    }
  }

  public async existsForCategory(
    categoryId: string,
    workspaceId: string,
  ): Promise<boolean> {
    try {
      const doc = await this.model.exists({ workspaceId, categoryId }).exec();
      return doc !== null;
    } catch (error) {
      throw this.toInfrastructureError(error, 'existsForCategory');
    }
  }

  /**
   * Scoped `$set` update — deferred to the Q5 edit phase, no current caller
   * invokes this. Only the fields present on `fields` are written; `amount`
   * (a `Money`) is decomposed into its `amount`/`currency` persistence pair.
   */
  public async updateInWorkspace(
    id: string,
    workspaceId: string,
    fields: TransactionUpdateFields,
  ): Promise<void> {
    if (!isValidObjectId(id)) {
      return;
    }
    const { amount, ...rest } = fields;
    const set: Record<string, unknown> = { ...rest };
    if (amount) {
      set['amount'] = amount.amount;
      set['currency'] = amount.currency;
    }
    if (Object.keys(set).length === 0) {
      return;
    }
    try {
      await this.model
        .findOneAndUpdate({ _id: id, workspaceId }, { $set: set })
        .exec();
    } catch (error) {
      throw this.toInfrastructureError(error, 'updateInWorkspace');
    }
  }

  /** Deferred to the Q5 edit phase — no current caller invokes this. */
  public async deleteInWorkspace(
    id: string,
    workspaceId: string,
  ): Promise<void> {
    if (!isValidObjectId(id)) {
      return;
    }
    try {
      await this.model.findOneAndDelete({ _id: id, workspaceId }).exec();
    } catch (error) {
      throw this.toInfrastructureError(error, 'deleteInWorkspace');
    }
  }

  /**
   * Sums transaction amounts by `type`, via a single `$match` + `$group`
   * pipeline — feeds `GetBalanceService`'s derived-balance calculation.
   * Always returns both `income` and `expense`, defaulting an absent type
   * to `0n` — an empty workspace/account never yields `NaN`/`undefined`.
   */
  public async sumAmountsByType(
    workspaceId: string,
    filter?: TransactionAggregationFilter,
  ): Promise<TransactionTypeTotals> {
    try {
      const match = buildMatch(workspaceId, filter);
      const results = await this.model
        .aggregate<{
          _id: string;
          total: RawAggregateAmount;
        }>([{ $match: match }, { $group: { _id: '$type', total: { $sum: '$amount' } } }])
        .exec();

      const totalsByType = new Map(
        results.map((result) => [result._id, toBigIntAmount(result.total)]),
      );

      return {
        income: totalsByType.get(TransactionType.INCOME) ?? 0n,
        expense: totalsByType.get(TransactionType.EXPENSE) ?? 0n,
      };
    } catch (error) {
      throw this.toInfrastructureError(error, 'sumAmountsByType');
    }
  }

  /**
   * Sums **expense** transaction amounts, grouped by `categoryId`, via a
   * single `$match` + `$group` pipeline — feeds `GetPlannerSummaryService`
   * and `GetHistoryChartService`'s chart/planner rollups. Archived
   * categories are included (per ADR-007: archive hides a category from
   * selection UI only, never from historical aggregation).
   */
  public async sumExpenseByCategory(
    workspaceId: string,
    filter?: Pick<TransactionAggregationFilter, 'from' | 'to'>,
  ): Promise<CategoryExpenseTotal[]> {
    try {
      const match = buildMatch(workspaceId, {
        ...filter,
        type: TransactionType.EXPENSE,
      });
      const results = await this.model
        .aggregate<{
          _id: string;
          total: RawAggregateAmount;
        }>([{ $match: match }, { $group: { _id: '$categoryId', total: { $sum: '$amount' } } }])
        .exec();

      return results.map((result) => ({
        categoryId: result._id,
        total: toBigIntAmount(result.total),
      }));
    } catch (error) {
      throw this.toInfrastructureError(error, 'sumExpenseByCategory');
    }
  }

  /**
   * Persists a `Transaction`. Always inserts — transactions are
   * immutable/create-only per ADR-007, so unlike `MongoCategoryRepository`
   * there is no update branch; any `id` on the given entity is ignored
   * (mirrors `RecordTransactionService`'s convention of always constructing
   * with `id: ''`).
   */
  public async save(transaction: Transaction): Promise<Transaction> {
    try {
      const doc = await this.model.create(
        TransactionMapper.toPersistence(transaction),
      );
      return TransactionMapper.toDomain(doc);
    } catch (error) {
      throw this.toInfrastructureError(error, 'save');
    }
  }

  public async delete(id: string): Promise<void> {
    if (!isValidObjectId(id)) {
      return;
    }
    try {
      await this.model.findByIdAndDelete(id).exec();
    } catch (error) {
      throw this.toInfrastructureError(error, 'delete');
    }
  }

  /** Logs full error detail internally and returns a generic `InfrastructureError` (no internal detail exposed to callers). */
  private toInfrastructureError(
    error: unknown,
    operation: string,
  ): InfrastructureError {
    this.logger.error(
      { err: error },
      `MongoTransactionRepository.${operation} failed`,
    );
    return new InfrastructureError();
  }
}
