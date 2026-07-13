import type pino from 'pino';

import type { ReturnModelType } from '@typegoose/typegoose';
import type { Connection } from 'mongoose';
import { isValidObjectId } from 'mongoose';

import type { IUserRepository, UserProfileUpdate } from 'identity-core';
import { User } from 'identity-core';
import type { RoleType, UserStatus } from 'shared-contracts';
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

  public async findByUsername(username: string): Promise<User | null> {
    try {
      const doc = await this.model.findOne({ username }).exec();
      return doc ? UserMapper.toDomain(doc) : null;
    } catch (error) {
      throw this.toInfrastructureError(error, 'findByUsername');
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
   * Updates only the `status` field for the document with the given `id`.
   * `roles`, profile fields, and `telegramId` are structurally absent from
   * the update document (see `UserMapper.toStatusPersistenceUpdate`), so a
   * concurrent role change or profile refresh cannot be overwritten by a
   * status transition.
   *
   * Returns `null` when `id` is not a valid ObjectId or no document matches.
   */
  public async updateStatus(
    id: string,
    status: UserStatus,
  ): Promise<User | null> {
    if (!isValidObjectId(id)) {
      return null;
    }
    try {
      const doc = await this.model
        .findByIdAndUpdate(id, UserMapper.toStatusPersistenceUpdate(status), {
          new: true,
        })
        .exec();
      return doc ? UserMapper.toDomain(doc) : null;
    } catch (error) {
      throw this.toInfrastructureError(error, 'updateStatus');
    }
  }

  /**
   * Updates only the `roles` field for the document with the given `id`.
   * `status`, profile fields, and `telegramId` are structurally absent from
   * the update document (see `UserMapper.toRolesPersistenceUpdate`), so a
   * concurrent status transition or profile refresh cannot be overwritten by
   * a role change.
   *
   * Returns `null` when `id` is not a valid ObjectId or no document matches.
   */
  public async updateRoles(
    id: string,
    roles: readonly RoleType[],
  ): Promise<User | null> {
    if (!isValidObjectId(id)) {
      return null;
    }
    try {
      const doc = await this.model
        .findByIdAndUpdate(id, UserMapper.toRolesPersistenceUpdate(roles), {
          new: true,
        })
        .exec();
      return doc ? UserMapper.toDomain(doc) : null;
    } catch (error) {
      throw this.toInfrastructureError(error, 'updateRoles');
    }
  }

  /**
   * Persists a not-yet-persisted `entity` via an atomic upsert keyed on
   * `telegramId`. Only the create path — updates to an already-persisted
   * entity must go through `updateProfile`/`updateStatus`/`updateRoles`
   * instead, so a write can never clobber a field it didn't intend to
   * change. Returns the persisted domain entity.
   *
   * @throws {InfrastructureError} On any driver/connection failure, or on an
   * unexpected E11000 duplicate-key collision after a concurrent-insert
   * retry (DUPLICATE_TELEGRAM_ID).
   */
  public async save(entity: User): Promise<User> {
    return this.upsertByTelegramId(entity);
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
