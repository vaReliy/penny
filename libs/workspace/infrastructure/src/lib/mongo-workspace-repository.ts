import type pino from 'pino';

import type { ReturnModelType } from '@typegoose/typegoose';
import type { Connection } from 'mongoose';
import { isValidObjectId } from 'mongoose';

import { DomainError, InfrastructureError } from 'shared-errors';
import type {
  IWorkspaceRepository,
  Workspace,
  WorkspaceMembershipRecord,
} from 'workspace-core';

import { WorkspaceMapper } from './workspace.mapper.js';
import { getWorkspaceModel, type WorkspaceModel } from './workspace.model.js';

/**
 * `IWorkspaceRepository` implementation backed by MongoDB via
 * Mongoose/Typegoose. Mirrors `MongoAccountRepository`'s structure.
 *
 * Constructed with an already-connected Mongoose `Connection` (see
 * `createMongoConnection`) — this class never manages connection lifecycle
 * itself. Every public method returns/accepts domain `Workspace`
 * entities/`WorkspaceMembershipRecord`s only; Mongoose/BSON types never
 * escape this class (see `WorkspaceMapper`).
 *
 * Driver errors are translated to `shared-errors` types: all failures become
 * `InfrastructureError`, so raw Mongoose/MongoServerError/CastError instances
 * never propagate to callers. `DomainError.conflict()` is the one exception —
 * `save`'s CAS-mismatch case is an intentional business error, not a driver
 * failure, and is thrown as-is (see `save`).
 */
export class MongoWorkspaceRepository implements IWorkspaceRepository {
  private readonly model: ReturnModelType<typeof WorkspaceModel>;
  private readonly logger: pino.Logger;

  public constructor(connection: Connection, logger: pino.Logger) {
    this.model = getWorkspaceModel(connection);
    this.logger = logger;
  }

  /** Inserts a not-yet-persisted `workspace` with `version: 0` and returns it with its assigned id. */
  public async create(workspace: Workspace): Promise<Workspace> {
    try {
      const doc = await this.model.create(
        WorkspaceMapper.toPersistence(workspace),
      );
      return WorkspaceMapper.toDomain(doc);
    } catch (error) {
      throw this.toInfrastructureError(error, 'create');
    }
  }

  public async findById(id: string): Promise<Workspace | null> {
    if (!isValidObjectId(id)) {
      return null;
    }
    try {
      const doc = await this.model.findById(id).exec();
      return doc ? WorkspaceMapper.toDomain(doc) : null;
    } catch (error) {
      throw this.toInfrastructureError(error, 'findById');
    }
  }

  /**
   * Persists an already-persisted `workspace` under optimistic concurrency
   * control: the filter requires the stored `version` to still equal
   * `workspace.version - 1` (domain mutating methods increment `version`
   * locally before `save` is called), and the update `$inc`s it by one. If
   * no document matches (a concurrent writer already advanced the version,
   * or `workspace.id` doesn't exist), throws a `DomainError.conflict()`
   * rather than silently overwriting the concurrent write — a business
   * error, not a driver failure, so it is rethrown as-is rather than
   * translated to `InfrastructureError`.
   */
  public async save(workspace: Workspace): Promise<Workspace> {
    try {
      const persistence = WorkspaceMapper.toPersistence(workspace);
      const expectedStoredVersion = workspace.version - 1;
      const doc = await this.model
        .findOneAndUpdate(
          { _id: workspace.id, version: expectedStoredVersion },
          { $set: persistence, $inc: { version: 1 } },
          { new: true },
        )
        .exec();

      if (!doc) {
        throw DomainError.conflict(
          'Workspace was modified concurrently; reload and retry.',
        );
      }

      return WorkspaceMapper.toDomain(doc);
    } catch (error) {
      if (error instanceof DomainError) {
        throw error;
      }
      throw this.toInfrastructureError(error, 'save');
    }
  }

  public async findAll(): Promise<Workspace[]> {
    try {
      const docs = await this.model.find({}).sort({ createdAt: 1 }).exec();
      return docs.map((doc) => WorkspaceMapper.toDomain(doc));
    } catch (error) {
      throw this.toInfrastructureError(error, 'findAll');
    }
  }

  public async findByMemberUserId(userId: string): Promise<Workspace[]> {
    try {
      const docs = await this.model.find({ 'members.userId': userId }).exec();
      return docs.map((doc) => WorkspaceMapper.toDomain(doc));
    } catch (error) {
      throw this.toInfrastructureError(error, 'findByMemberUserId');
    }
  }

  /**
   * Looks up `userId`'s membership in `workspaceId` via a single projected
   * query (`members.$`). Returns `null` — never throws — for a malformed
   * `workspaceId`, a nonexistent workspace, and a non-member alike, so the
   * W5 HTTP guard can map all three to the same opaque 404.
   */
  public async findMembership(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceMembershipRecord | null> {
    if (!isValidObjectId(workspaceId)) {
      return null;
    }

    try {
      const doc = await this.model
        .findOne(
          { _id: workspaceId, 'members.userId': userId },
          { 'members.$': 1 },
        )
        .exec();

      const member = doc?.members?.[0];
      if (!doc || !member) {
        return null;
      }

      return WorkspaceMapper.toMembershipRecord(doc._id.toString(), member);
    } catch (error) {
      throw this.toInfrastructureError(error, 'findMembership');
    }
  }

  /** Logs full error detail internally and returns a generic `InfrastructureError` (no internal detail exposed to callers). */
  private toInfrastructureError(
    error: unknown,
    operation: string,
  ): InfrastructureError {
    this.logger.error(
      { err: error },
      `MongoWorkspaceRepository.${operation} failed`,
    );
    return new InfrastructureError();
  }
}
