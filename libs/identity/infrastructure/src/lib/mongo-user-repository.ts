import type { ReturnModelType } from '@typegoose/typegoose';
import type { Connection } from 'mongoose';
import { isValidObjectId } from 'mongoose';

import type { IUserRepository } from 'identity-core';
import { User } from 'identity-core';
import { DomainError, InfrastructureError } from 'shared-errors';

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
 * Driver errors are translated to `shared-errors` types: duplicate-key
 * violations (e.g. the unique `telegramId` index) become `DomainError`
 * conflicts, everything else becomes an `InfrastructureError`. Raw
 * Mongoose/MongoServerError instances never propagate to callers.
 */
export class MongoUserRepository implements IUserRepository {
  private readonly model: ReturnModelType<typeof UserModel>;

  public constructor(connection: Connection) {
    this.model = getUserModel(connection);
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
   * Persists `entity`: creates a new document when `entity.id` is not a
   * valid ObjectId (not yet persisted), otherwise updates the existing
   * document matching that id. The update path uses an explicit
   * `$set`/`$unset` (see `UserMapper.toPersistenceUpdate`) so that clearing
   * an optional profile field actually removes it from the document instead
   * of being silently dropped. Returns the persisted domain entity (mapped
   * from the resulting document).
   *
   * @throws {DomainError} If persisting violates the unique `telegramId` index.
   * @throws {InfrastructureError} If the update path's id has no matching
   * document, or on any other driver/connection failure.
   */
  public async save(entity: User): Promise<User> {
    try {
      const doc = isValidObjectId(entity.id)
        ? await this.model
            .findByIdAndUpdate(
              entity.id,
              UserMapper.toPersistenceUpdate(entity),
              {
                new: true,
              },
            )
            .exec()
        : await this.model.create(UserMapper.toPersistence(entity));

      if (!doc) {
        throw new InfrastructureError(
          `Failed to persist user "${entity.id}": document not found for update.`,
        );
      }

      return UserMapper.toDomain(doc);
    } catch (error) {
      if (
        error instanceof InfrastructureError ||
        error instanceof DomainError
      ) {
        throw error;
      }
      throw this.toPersistenceError(error, entity.telegramId);
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

  /** Maps a save/create/update driver error to `DomainError` or `InfrastructureError`. */
  private toPersistenceError(error: unknown, telegramId: string): Error {
    if (isMongoDriverError(error) && error.code === MONGO_DUPLICATE_KEY_CODE) {
      return DomainError.conflict(
        `A user with telegramId "${telegramId}" already exists.`,
      );
    }
    return this.toInfrastructureError(error, 'save');
  }

  /** Wraps any non-domain error from a read/delete operation as `InfrastructureError`. */
  private toInfrastructureError(error: unknown, operation: string): Error {
    const message = isMongoDriverError(error) ? error.message : undefined;
    return new InfrastructureError(
      `MongoUserRepository.${operation} failed${message ? `: ${message}` : '.'}`,
    );
  }
}
