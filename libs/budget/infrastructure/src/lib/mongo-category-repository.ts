import type pino from 'pino';

import type { ReturnModelType } from '@typegoose/typegoose';
import type { Connection } from 'mongoose';
import { isValidObjectId } from 'mongoose';

import type { ICategoryRepository } from 'budget-core';
import { Category } from 'budget-core';
import { DomainError, InfrastructureError } from 'shared-errors';

import { CategoryMapper } from './category.mapper.js';
import { getCategoryModel, type CategoryModel } from './category.model.js';

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
 * `ICategoryRepository` implementation backed by MongoDB via
 * Mongoose/Typegoose. Mirrors `MongoUserRepository`'s structure and
 * lessons: constructed with an already-connected Mongoose `Connection`;
 * every public method returns/accepts domain `Category` entities only
 * (Mongoose/BSON types never escape this class, see `CategoryMapper`);
 * updates are scoped to a single mutable field each — never a
 * full-snapshot `$set` (the lost-update race fixed in `2026-07-13-01`).
 *
 * Driver errors are translated to `shared-errors` types: an unexpected
 * duplicate-key violation on the `{workspaceId, name}` unique index becomes
 * a domain-meaningful `DomainError.conflict` (not a generic
 * `InfrastructureError`), since it reflects a business-rule collision, not
 * an infrastructure failure. All other failures become `InfrastructureError`.
 */
export class MongoCategoryRepository implements ICategoryRepository {
  private readonly model: ReturnModelType<typeof CategoryModel>;
  private readonly logger: pino.Logger;

  public constructor(connection: Connection, logger: pino.Logger) {
    this.model = getCategoryModel(connection);
    this.logger = logger;
  }

  public async findById(id: string): Promise<Category | null> {
    if (!isValidObjectId(id)) {
      return null;
    }
    try {
      const doc = await this.model.findById(id).exec();
      return doc ? CategoryMapper.toDomain(doc) : null;
    } catch (error) {
      throw this.toInfrastructureError(error, 'findById');
    }
  }

  public async findByWorkspace(
    workspaceId: string,
    includeArchived = false,
  ): Promise<Category[]> {
    try {
      const filter = includeArchived
        ? { workspaceId }
        : { workspaceId, archivedAt: { $exists: false } };
      const docs = await this.model.find(filter).exec();
      return docs.map((doc) => CategoryMapper.toDomain(doc));
    } catch (error) {
      throw this.toInfrastructureError(error, 'findByWorkspace');
    }
  }

  public async findByIdInWorkspace(
    id: string,
    workspaceId: string,
  ): Promise<Category | null> {
    if (!isValidObjectId(id)) {
      return null;
    }
    try {
      const doc = await this.model.findOne({ _id: id, workspaceId }).exec();
      return doc ? CategoryMapper.toDomain(doc) : null;
    } catch (error) {
      throw this.toInfrastructureError(error, 'findByIdInWorkspace');
    }
  }

  public async findByNameInWorkspace(
    name: string,
    workspaceId: string,
  ): Promise<Category | null> {
    try {
      const doc = await this.model
        .findOne({ workspaceId, name, archivedAt: { $exists: false } })
        .collation({ locale: 'en', strength: 2 })
        .exec();
      return doc ? CategoryMapper.toDomain(doc) : null;
    } catch (error) {
      throw this.toInfrastructureError(error, 'findByNameInWorkspace');
    }
  }

  /**
   * Persists a `Category`. `id === ''` (see `Category.create('', ...)` at
   * the call site) signals a not-yet-persisted entity — inserted as a new
   * document. Any other `id` is treated as a rename: scoped to the `name`
   * field only via `findOneAndUpdate` (never a full-snapshot `$set`), so a
   * concurrent `archive()` call's `archivedAt` write can never be clobbered.
   *
   * @throws {DomainError} If the `{workspaceId, name}` unique index rejects
   * the write (case-insensitive collision among non-archived categories).
   */
  public async save(category: Category): Promise<Category> {
    return category.id === ''
      ? this.create(category)
      : this.updateName(category);
  }

  private async create(category: Category): Promise<Category> {
    try {
      const doc = await this.model.create(
        CategoryMapper.toPersistence(category),
      );
      return CategoryMapper.toDomain(doc);
    } catch (error) {
      throw this.toDomainOrInfrastructureError(error, 'save');
    }
  }

  private async updateName(category: Category): Promise<Category> {
    if (!isValidObjectId(category.id)) {
      throw new InfrastructureError();
    }
    try {
      const doc = await this.model
        .findOneAndUpdate(
          { _id: category.id, workspaceId: category.workspaceId },
          CategoryMapper.toNamePersistenceUpdate(category.name),
          { new: true },
        )
        .exec();
      if (!doc) {
        throw new InfrastructureError();
      }
      return CategoryMapper.toDomain(doc);
    } catch (error) {
      if (error instanceof InfrastructureError) throw error;
      throw this.toDomainOrInfrastructureError(error, 'save');
    }
  }

  /**
   * Archives the category identified by `(id, workspaceId)`. Scoped to the
   * `archivedAt` field only via `findOneAndUpdate` — never touches `name`.
   * The filter additionally requires `archivedAt: { $exists: false }` — a
   * compare-and-swap that closes the race between two concurrent archive
   * calls validated against the same stale (not-yet-archived) read: the
   * first writer's `findOneAndUpdate` flips `archivedAt` and the second
   * writer's filter then matches no document, so it becomes a no-op instead
   * of overwriting the first writer's timestamp (mirrors
   * `MongoUserRepository.updateStatus`/`updateRoles`'s CAS-via-filter
   * precedent).
   *
   * No-op (silent) if `id` is not a valid ObjectId, no document matches, or
   * the document is already archived, mirroring
   * `MongoUserRepository.delete`'s no-op-on-missing convention; callers
   * (`ArchiveCategoryService`) already confirm existence beforehand.
   */
  public async archive(id: string, workspaceId: string): Promise<void> {
    if (!isValidObjectId(id)) {
      return;
    }
    try {
      await this.model
        .findOneAndUpdate(
          { _id: id, workspaceId, archivedAt: { $exists: false } },
          CategoryMapper.toArchivePersistenceUpdate(new Date()),
        )
        .exec();
    } catch (error) {
      throw this.toInfrastructureError(error, 'archive');
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

  /**
   * Translates a Mongo duplicate-key violation on the `{workspaceId, name}`
   * unique index into a domain-meaningful `DomainError.conflict` (the
   * business rule is "no two non-archived categories in the same workspace
   * share a name"). Every other failure becomes a generic
   * `InfrastructureError`.
   */
  private toDomainOrInfrastructureError(
    error: unknown,
    operation: string,
  ): DomainError | InfrastructureError {
    if (isMongoDriverError(error) && error.code === MONGO_DUPLICATE_KEY_CODE) {
      return DomainError.conflict(
        'A category with this name already exists in this workspace.',
      );
    }
    return this.toInfrastructureError(error, operation);
  }

  /** Logs full error detail internally and returns a generic `InfrastructureError` (no internal detail exposed to callers). */
  private toInfrastructureError(
    error: unknown,
    operation: string,
  ): InfrastructureError {
    this.logger.error(
      { err: error },
      `MongoCategoryRepository.${operation} failed`,
    );
    return new InfrastructureError();
  }
}
