/**
 * Unit tests for MongoCategoryRepository: the Mongoose model is mocked so
 * these tests run without a live MongoDB connection. They exercise the
 * duplicate-key-to-DomainError translation and the scoped-update (never a
 * full-snapshot `$set`) behavior of `save`/`archive`.
 */

import type { ReturnModelType } from '@typegoose/typegoose';
import type { Connection } from 'mongoose';
import pino from 'pino';
import { DomainError, InfrastructureError } from 'shared-errors';
import { Category } from 'budget-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const silentLogger = pino({ level: 'silent' });

vi.mock('./category.model.js');

import { getCategoryModel } from './category.model.js';
import type { CategoryModel } from './category.model.js';
import { MongoCategoryRepository } from './mongo-category-repository.js';

const FAKE_CONNECTION = {} as Connection;

const makeE11000 = (): Error & { code: number } =>
  Object.assign(
    new Error(
      'E11000 duplicate key error collection: penny.categories index: workspaceId_1_name_1 dup key',
    ),
    { code: 11000, name: 'MongoServerError' },
  );

describe('MongoCategoryRepository (unit — mocked model)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('save — create path (id === "")', () => {
    it('translates an E11000 duplicate-key error into DomainError.conflict', async () => {
      const mockModel = {
        create: vi.fn().mockRejectedValue(makeE11000()),
      };
      vi.mocked(getCategoryModel).mockReturnValue(
        mockModel as unknown as ReturnModelType<typeof CategoryModel>,
      );

      const repository = new MongoCategoryRepository(
        FAKE_CONNECTION,
        silentLogger,
      );
      const category = Category.create('', 'ws-1', 'Groceries');

      await expect(repository.save(category)).rejects.toBeInstanceOf(
        DomainError,
      );
    });

    it('wraps a non-duplicate-key driver error as InfrastructureError', async () => {
      const mockModel = {
        create: vi.fn().mockRejectedValue(new Error('topology closed')),
      };
      vi.mocked(getCategoryModel).mockReturnValue(
        mockModel as unknown as ReturnModelType<typeof CategoryModel>,
      );

      const repository = new MongoCategoryRepository(
        FAKE_CONNECTION,
        silentLogger,
      );
      const category = Category.create('', 'ws-1', 'Groceries');

      await expect(repository.save(category)).rejects.toBeInstanceOf(
        InfrastructureError,
      );
    });
  });

  describe('save — update (rename) path', () => {
    it('scopes the update to name only via findOneAndUpdate, never a full-snapshot $set', async () => {
      const validId = '507f1f77bcf86cd799439011';
      const updatedDoc = {
        _id: { toString: () => validId },
        workspaceId: 'ws-1',
        name: 'Utilities',
      };
      const findOneAndUpdateSpy = vi.fn().mockReturnValue({
        exec: vi.fn().mockResolvedValue(updatedDoc),
      });
      const mockModel = { findOneAndUpdate: findOneAndUpdateSpy };
      vi.mocked(getCategoryModel).mockReturnValue(
        mockModel as unknown as ReturnModelType<typeof CategoryModel>,
      );

      const repository = new MongoCategoryRepository(
        FAKE_CONNECTION,
        silentLogger,
      );
      const category = Category.create(validId, 'ws-1', 'Utilities');

      const result = await repository.save(category);

      expect(result.name).toBe('Utilities');
      expect(findOneAndUpdateSpy).toHaveBeenCalledWith(
        { _id: validId, workspaceId: 'ws-1' },
        { $set: { name: 'Utilities' } },
        { new: true },
      );
    });
  });

  describe('archive', () => {
    it('scopes the update to archivedAt only via findOneAndUpdate, never a full-snapshot $set', async () => {
      const validId = '507f1f77bcf86cd799439011';
      const findOneAndUpdateSpy = vi.fn().mockReturnValue({
        exec: vi.fn().mockResolvedValue({}),
      });
      const mockModel = { findOneAndUpdate: findOneAndUpdateSpy };
      vi.mocked(getCategoryModel).mockReturnValue(
        mockModel as unknown as ReturnModelType<typeof CategoryModel>,
      );

      const repository = new MongoCategoryRepository(
        FAKE_CONNECTION,
        silentLogger,
      );

      await repository.archive(validId, 'ws-1');

      expect(findOneAndUpdateSpy).toHaveBeenCalledOnce();
      const [filter, update] = findOneAndUpdateSpy.mock.calls[0] as [
        Record<string, unknown>,
        { $set: Record<string, unknown> },
      ];
      expect(filter).toEqual({
        _id: validId,
        workspaceId: 'ws-1',
        archivedAt: { $exists: false },
      });
      expect(Object.keys(update.$set)).toEqual(['archivedAt']);
    });

    it('does not clobber the first archive when a second concurrent archive call races it', async () => {
      // Simulates two concurrent archive() calls that both read the category
      // as not-yet-archived before either write commits: the first
      // findOneAndUpdate matches and sets archivedAt; the second's filter
      // (archivedAt: { $exists: false }) no longer matches, so it must
      // resolve as a no-op rather than overwriting the first timestamp.
      const validId = '507f1f77bcf86cd799439011';
      const findOneAndUpdateSpy = vi
        .fn()
        .mockReturnValueOnce({
          exec: vi.fn().mockResolvedValue({ archivedAt: new Date() }),
        })
        .mockReturnValueOnce({
          // Second call's filter no longer matches (already archived) —
          // findOneAndUpdate resolves null, exactly as Mongo would.
          exec: vi.fn().mockResolvedValue(null),
        });
      const mockModel = { findOneAndUpdate: findOneAndUpdateSpy };
      vi.mocked(getCategoryModel).mockReturnValue(
        mockModel as unknown as ReturnModelType<typeof CategoryModel>,
      );

      const repository = new MongoCategoryRepository(
        FAKE_CONNECTION,
        silentLogger,
      );

      await repository.archive(validId, 'ws-1');
      await expect(
        repository.archive(validId, 'ws-1'),
      ).resolves.toBeUndefined();

      expect(findOneAndUpdateSpy).toHaveBeenCalledTimes(2);
      for (const [filter] of findOneAndUpdateSpy.mock.calls as [
        Record<string, unknown>,
      ][]) {
        expect(filter).toEqual({
          _id: validId,
          workspaceId: 'ws-1',
          archivedAt: { $exists: false },
        });
      }
    });

    it('is a no-op when the id is not a valid ObjectId', async () => {
      const findOneAndUpdateSpy = vi.fn();
      const mockModel = { findOneAndUpdate: findOneAndUpdateSpy };
      vi.mocked(getCategoryModel).mockReturnValue(
        mockModel as unknown as ReturnModelType<typeof CategoryModel>,
      );

      const repository = new MongoCategoryRepository(
        FAKE_CONNECTION,
        silentLogger,
      );

      await expect(
        repository.archive('not-a-valid-id', 'ws-1'),
      ).resolves.toBeUndefined();
      expect(findOneAndUpdateSpy).not.toHaveBeenCalled();
    });
  });
});
