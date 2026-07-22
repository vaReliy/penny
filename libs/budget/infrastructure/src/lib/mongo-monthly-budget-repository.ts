import type pino from 'pino';

import type { ReturnModelType } from '@typegoose/typegoose';
import type { Connection } from 'mongoose';
import { isValidObjectId } from 'mongoose';

import type { IMonthlyBudgetRepository } from 'budget-core';
import { MonthlyBudget } from 'budget-core';
import type { Money } from 'shared-util';
import { InfrastructureError } from 'shared-errors';

import { MonthlyBudgetMapper } from './monthly-budget.mapper.js';
import {
  getMonthlyBudgetModel,
  type MonthlyBudgetModel,
} from './monthly-budget.model.js';

/** MongoDB driver error code for a unique-index violation. */
const MONGO_DUPLICATE_KEY_CODE = 11000;

/** Narrow shape of a Mongo driver error carrying a numeric `code`. */
interface MongoDriverError {
  readonly code?: number;
  readonly name?: string;
}

/** `Error.name` values used by the MongoDB Node driver/Mongoose for server-side failures. */
const MONGO_DRIVER_ERROR_NAMES = new Set(['MongoServerError', 'MongoError']);

/**
 * True when `error` looks like a Mongo/Mongoose duplicate-key error: it must
 * carry a numeric `code` matching `MONGO_DUPLICATE_KEY_CODE` *and* a
 * recognized driver error name, so an unrelated error that happens to have a
 * numeric `code` property isn't misclassified as a duplicate-key error.
 */
function isDuplicateKeyError(error: unknown): error is MongoDriverError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'name' in error &&
    MONGO_DRIVER_ERROR_NAMES.has((error as MongoDriverError).name ?? '') &&
    (error as MongoDriverError).code === MONGO_DUPLICATE_KEY_CODE
  );
}

/**
 * `IMonthlyBudgetRepository` implementation backed by MongoDB via
 * Mongoose/Typegoose. Mirrors `MongoUserRepository`'s structure: constructed
 * with an already-connected Mongoose `Connection`; every public method
 * returns/accepts domain `MonthlyBudget` entities only (Mongoose/BSON types
 * never escape this class, see `MonthlyBudgetMapper`).
 *
 * `upsertAmount` is the atomic upsert this repository exists to provide: a
 * single `findOneAndUpdate({workspaceId, categoryId, month}, ..., {upsert:
 * true})` call keyed on the unique compound index — never a
 * read-then-write, closing the TOCTOU race fixed in `2026-07-13-02`.
 */
export class MongoMonthlyBudgetRepository implements IMonthlyBudgetRepository {
  private readonly model: ReturnModelType<typeof MonthlyBudgetModel>;
  private readonly logger: pino.Logger;

  public constructor(connection: Connection, logger: pino.Logger) {
    this.model = getMonthlyBudgetModel(connection);
    this.logger = logger;
  }

  public async findById(id: string): Promise<MonthlyBudget | null> {
    if (!isValidObjectId(id)) {
      return null;
    }
    try {
      const doc = await this.model.findById(id).exec();
      return doc ? MonthlyBudgetMapper.toDomain(doc) : null;
    } catch (error) {
      throw this.toInfrastructureError(error, 'findById');
    }
  }

  public async findByWorkspaceAndMonth(
    workspaceId: string,
    month: string,
  ): Promise<MonthlyBudget[]> {
    try {
      const docs = await this.model.find({ workspaceId, month }).exec();
      return docs.map((doc) => MonthlyBudgetMapper.toDomain(doc));
    } catch (error) {
      throw this.toInfrastructureError(error, 'findByWorkspaceAndMonth');
    }
  }

  public async findByWorkspaceCategoryMonth(
    workspaceId: string,
    categoryId: string,
    month: string,
  ): Promise<MonthlyBudget | null> {
    try {
      const doc = await this.model
        .findOne({ workspaceId, categoryId, month })
        .exec();
      return doc ? MonthlyBudgetMapper.toDomain(doc) : null;
    } catch (error) {
      throw this.toInfrastructureError(error, 'findByWorkspaceCategoryMonth');
    }
  }

  /**
   * Creates or replaces the budget amount for `(workspaceId, categoryId,
   * month)` via a single atomic `findOneAndUpdate` keyed on the unique
   * compound index `{workspaceId, categoryId, month}` — `upsert: true`
   * means MongoDB itself resolves the create-vs-replace decision inside one
   * operation; there is no prior read, so no window for a second concurrent
   * caller to interleave (the TOCTOU race fixed in `2026-07-13-02`).
   *
   * `findOneAndUpdate({upsert: true})` is atomic within a single connection
   * but not across concurrent connections both racing an insert on the same
   * key — the loser gets a raw E11000 (see
   * `rules/architecture-backend.md`'s "findOneAndUpdate + upsert race
   * condition"). Unlike that doc's `$setOnInsert`-based `findOrCreate`
   * example, this method writes via `$set`, so the retry re-issues the same
   * `findOneAndUpdate` rather than re-reading the winner's document: by the
   * time the retry runs, the winner's insert has committed, so the retry is
   * a plain scoped update (no longer racing an insert) and this caller's
   * `amount`/`currency` are applied on top of it — consistent with
   * `upsertAmount`'s create-or-*replace* contract.
   */
  public async upsertAmount(
    workspaceId: string,
    categoryId: string,
    month: string,
    amount: Money,
  ): Promise<void> {
    const filter = { workspaceId, categoryId, month };
    const update = {
      $set: {
        amount: amount.amount,
        currency: amount.currency,
      },
    };
    try {
      await this.model
        .findOneAndUpdate(filter, update, { upsert: true })
        .exec();
    } catch (error) {
      if (!isDuplicateKeyError(error)) {
        throw this.toInfrastructureError(error, 'upsertAmount');
      }
      try {
        await this.model
          .findOneAndUpdate(filter, update, { upsert: true })
          .exec();
      } catch (retryError) {
        throw this.toInfrastructureError(retryError, 'upsertAmount');
      }
    }
  }

  /**
   * Persists a not-yet-persisted `MonthlyBudget` (`id === ''`). This
   * repository's application-layer caller uses `upsertAmount` for the
   * create-or-replace path — `save` covers direct-insert callers, e.g.
   * future seed/import scripts, and is not on the current hot path.
   */
  public async save(budget: MonthlyBudget): Promise<MonthlyBudget> {
    try {
      const doc = await this.model.create(
        MonthlyBudgetMapper.toPersistence(budget),
      );
      return MonthlyBudgetMapper.toDomain(doc);
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
      `MongoMonthlyBudgetRepository.${operation} failed`,
    );
    return new InfrastructureError();
  }
}
