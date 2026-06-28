import type pino from 'pino';

import type { ReturnModelType } from '@typegoose/typegoose';
import type { Connection } from 'mongoose';
import { isValidObjectId } from 'mongoose';

import type { IUserRepository, UserProfileUpdate } from 'identity-core';
import { User } from 'identity-core';
import { InfrastructureError } from 'shared-errors';

import { UserMapper } from './user.mapper.js';
import { getUserModel, type UserModel } from './user.model.js';

/** MongoDB driver error code for a unique-index violation. */
const MONGO_DUPLICATE_KEY_CODE = 11000;

/** Narrow shape of a Mongo driver error carrying a numeric `code`. */
interface MongoDriverError {
  readonly code?: number;
  readonly message?: string;
  readonly name?: string;
}

/** `Error.name` values used by the MongoDB Node driver/Mongoose for server-side failures. */
const MONGO_DRIVER_ERROR_NAMES = new Set(['MongoServerError', 'MongoError']);

/**
 * True when `error` looks like a Mongo/Mongoose driver error: it must carry
 * a numeric `code` *and* a recognized driver error name, so an unrelated
 * error that happens to have a numeric `code` property isn't misclassified
 * as a Mongo duplicate-key error.
 */
function isMongoDriverError(error: unknown): error is MongoDriverError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'name' in error &&
    MONGO_DRIVER_ERROR_NAMES.has((error as MongoDriverError).name ?? '')
  );
}

/**
 * `IUserRepository` implementation backed by MongoDB via Mongoose/Typegoose.
 *
 * Constructed with an already-connected Mongoose `Connection` (see
 * `createMongoConnection`) — this class never manages connection lifecycle
 * itself. Every public method returns/accepts domain `User` entities only;
 * Mongoose/BSON types never escape this class (see `UserMapper`).
 *
 * Driver errors are translated to `shared-errors` types: all failures,
 * including unexpected duplicate-key violations on the `telegramId` index,
 * become `InfrastructureError`. Raw Mongoose/MongoServerError instances
 * never propagate to callers.
 */
export class MongoUserRepository implements IUserRepository {
  private readonly model: ReturnModelType<typeof UserModel>;
  private readonly logger: pino.Logger;

  public constructor(connection: Connection, logger: pino.Logger) {
    this.model = getUserModel(connection);
    this.logger = logger;
  }

  public async findById(id: string): Promise<User | null> {
    if (!isValidObjectId(id)) {
      return null;
    }

    try {
      const doc = await this.model.findById(id).exec();
      return doc ? UserMapper.toDomain(doc) : null;
    } catch (error) {
      throw this.toInfrastructureError(error, 'findById');
    }
  }

  public async findByTelegramId(telegramId: string): Promise<User | null> {
    try {
      const doc = await this.model.findOne({ telegramId }).exec();
      return doc ? UserMapper.toDomain(doc) : null;
    } catch (error) {
      throw this.toInfrastructureError(error, 'findByTelegramId');
    }
  }

  /**
   * Updates only mutable profile fields (`firstName`, `lastName`, `username`,
   * `photoUrl`) for the document with the given `id`. `status` and
   * `telegramId` are structurally absent from the update document (see
   * `UserMapper.toProfilePersistenceUpdate`), so a concurrent admin approval
   * cannot be overwritten by a login profile refresh.
   *
   * Returns `null` when `id` is not a valid ObjectId or no document matches.
   */
  public async updateProfile(
    id: string,
    profile: Partial<UserProfileUpdate>,
  ): Promise<User | null> {
    if (!isValidObjectId(id)) {
      return null;
    }
    try {
      const doc = await this.model
        .findByIdAndUpdate(id, UserMapper.toProfilePersistenceUpdate(profile), {
          new: true,
        })
        .exec();
      return doc ? UserMapper.toDomain(doc) : null;
    } catch (error) {
      throw this.toInfrastructureError(error, 'updateProfile');
    }
  }

  /**
   * Persists `entity`: delegates to `updateById` when `entity.id` is a valid
   * ObjectId (already persisted), otherwise delegates to `upsertByTelegramId`
   * for the create path. Returns the persisted domain entity.
   *
   * @throws {InfrastructureError} If the update path's id has no matching
   * document, on any driver/connection failure, or on an unexpected E11000
   * duplicate-key collision after a concurrent-insert retry (DUPLICATE_TELEGRAM_ID).
   */
  public async save(entity: User): Promise<User> {
    return isValidObjectId(entity.id)
      ? this.updateById(entity)
      : this.upsertByTelegramId(entity);
  }

  /**
   * Updates the existing document matching `entity.id`. Uses an explicit
   * `$set`/`$unset` (see `UserMapper.toPersistenceUpdate`) so that clearing
   * an optional profile field actually removes it from the document instead
   * of being silently dropped.
   */
  private async updateById(entity: User): Promise<User> {
    try {
      const doc = await this.model
        .findByIdAndUpdate(entity.id, UserMapper.toPersistenceUpdate(entity), {
          new: true,
        })
        .exec();
      if (!doc) {
        this.logger.error(
          { userId: entity.id },
          'MongoUserRepository.save: document not found for update',
        );
        throw new InfrastructureError();
      }
      return UserMapper.toDomain(doc);
    } catch (error) {
      if (error instanceof InfrastructureError) throw error;
      throw this.toInfrastructureError(error, 'save');
    }
  }

  /**
   * Inserts a new document via an atomic upsert keyed on `telegramId`.
   *
   * If two concurrent callers both evaluate "no document" before either
   * insert commits, MongoDB will raise E11000 on the losing writer. In that
   * case we retry with a plain `findOne` to return the winner's document,
   * making the operation idempotent from the caller's perspective.
   */
  private async upsertByTelegramId(entity: User): Promise<User> {
    try {
      const doc = await this.model
        .findOneAndUpdate(
          { telegramId: entity.telegramId },
          { $setOnInsert: UserMapper.toPersistence(entity) },
          { upsert: true, new: true },
        )
        .exec();
      // doc cannot be null: upsert:true + new:true always returns a document.
      return UserMapper.toDomain(doc!);
    } catch (error) {
      if (
        isMongoDriverError(error) &&
        error.code === MONGO_DUPLICATE_KEY_CODE
      ) {
        try {
          // Concurrent writer won the upsert race. Read the winner's document.
          const existing = await this.model
            .findOne({ telegramId: entity.telegramId })
            .exec();
          if (existing) {
            return UserMapper.toDomain(existing);
          }
          this.logger.error(
            { telegramId: entity.telegramId },
            'MongoUserRepository.save: DUPLICATE_TELEGRAM_ID — concurrent insert collision after upsert retry',
          );
          throw new InfrastructureError();
        } catch (retryError) {
          if (retryError instanceof InfrastructureError) throw retryError;
          throw this.toInfrastructureError(retryError, 'save');
        }
      }
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
      `MongoUserRepository.${operation} failed`,
    );
    return new InfrastructureError();
  }
}
