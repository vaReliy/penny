import type pino from 'pino';

import type { ReturnModelType } from '@typegoose/typegoose';
import type { Connection } from 'mongoose';
import { isValidObjectId } from 'mongoose';

import type { IAccountRepository } from 'budget-core';
import { Account } from 'budget-core';
import { InfrastructureError } from 'shared-errors';
import type { CurrencyCode } from 'shared-util';

import { AccountMapper } from './account.mapper.js';
import { getAccountModel, type AccountModel } from './account.model.js';

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
 * True when `error` looks like a Mongo/Mongoose driver error carrying a
 * duplicate-key violation. Local copy of the same check
 * `MongoCategoryRepository` uses — not exported from that file, and
 * cross-file duplication is preferable to a shared-but-unexported helper.
 */
function isDuplicateKeyError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const candidate = error as MongoDriverError;
  return (
    MONGO_DRIVER_ERROR_NAMES.has(candidate.name ?? '') &&
    candidate.code === MONGO_DUPLICATE_KEY_CODE
  );
}

/**
 * `IAccountRepository` implementation backed by MongoDB via
 * Mongoose/Typegoose. Mirrors `MongoCategoryRepository`'s structure:
 * constructed with an already-connected Mongoose `Connection`; every public
 * method returns/accepts domain `Account` entities only (Mongoose/BSON types
 * never escape this class, see `AccountMapper`).
 *
 * `Account` has no mutators (per `DECISIONS.md` ADR-007) — `save` therefore
 * always inserts, mirroring `MongoTransactionRepository`'s always-insert
 * `save`, never an update branch.
 */
export class MongoAccountRepository implements IAccountRepository {
  private readonly model: ReturnModelType<typeof AccountModel>;
  private readonly logger: pino.Logger;

  public constructor(connection: Connection, logger: pino.Logger) {
    this.model = getAccountModel(connection);
    this.logger = logger;
  }

  public async findById(id: string): Promise<Account | null> {
    if (!isValidObjectId(id)) {
      return null;
    }
    try {
      const doc = await this.model.findById(id).exec();
      return doc ? AccountMapper.toDomain(doc) : null;
    } catch (error) {
      throw this.toInfrastructureError(error, 'findById');
    }
  }

  public async findByWorkspace(workspaceId: string): Promise<Account[]> {
    try {
      const docs = await this.model.find({ workspaceId }).exec();
      return docs.map((doc) => AccountMapper.toDomain(doc));
    } catch (error) {
      throw this.toInfrastructureError(error, 'findByWorkspace');
    }
  }

  public async findByIdInWorkspace(
    id: string,
    workspaceId: string,
  ): Promise<Account | null> {
    if (!isValidObjectId(id)) {
      return null;
    }
    try {
      const doc = await this.model.findOne({ _id: id, workspaceId }).exec();
      return doc ? AccountMapper.toDomain(doc) : null;
    } catch (error) {
      throw this.toInfrastructureError(error, 'findByIdInWorkspace');
    }
  }

  /**
   * Atomically finds-or-creates the `(workspaceId, name)` account via a
   * single `findOneAndUpdate` upsert (`$setOnInsert`, never a plain `$set`,
   * so a losing concurrent caller's write never re-stamps `currency`/
   * `createdAt` on the winner's document) — the documented
   * findOneAndUpdate-upsert pattern for closing the read-then-create race
   * between two simultaneous first callers. On the rare loss-of-race
   * duplicate-key error (a narrow window `findOneAndUpdate`'s own atomicity
   * does not fully close under every driver/topology), falls back to a
   * plain `findOne` for the winner's document, mirroring
   * `rules/local/architecture-backend.md`'s upsert-race recipe.
   */
  public async findOrCreateDefault(
    workspaceId: string,
    name: string,
    currency: CurrencyCode,
  ): Promise<Account> {
    try {
      const doc = await this.model
        .findOneAndUpdate(
          { workspaceId, name },
          {
            $setOnInsert: {
              workspaceId,
              name,
              currency,
              createdAt: new Date(),
            },
          },
          { upsert: true, new: true },
        )
        .exec();
      return AccountMapper.toDomain(doc);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        const existing = await this.model.findOne({ workspaceId, name }).exec();
        if (existing) {
          return AccountMapper.toDomain(existing);
        }
      }
      throw this.toInfrastructureError(error, 'findOrCreateDefault');
    }
  }

  /** Always inserts — `Account` has no mutators to update in place. */
  public async save(account: Account): Promise<Account> {
    try {
      const doc = await this.model.create(AccountMapper.toPersistence(account));
      return AccountMapper.toDomain(doc);
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
      `MongoAccountRepository.${operation} failed`,
    );
    return new InfrastructureError();
  }
}
