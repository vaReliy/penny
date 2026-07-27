/**
 * Unit tests for MongoAccountRepository: the Mongoose model is mocked so
 * these tests run without a live MongoDB connection. They exercise the
 * `findOrCreateDefault` upsert (including its duplicate-key fallback) and
 * the always-insert `save` path.
 */

import type { ReturnModelType } from '@typegoose/typegoose';
import type { Connection } from 'mongoose';
import pino from 'pino';
import { InfrastructureError } from 'shared-errors';
import { Account } from 'budget-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const silentLogger = pino({ level: 'silent' });

vi.mock('./account.model.js');

import { getAccountModel } from './account.model.js';
import type { AccountModel } from './account.model.js';
import { MongoAccountRepository } from './mongo-account-repository.js';

const FAKE_CONNECTION = {} as Connection;
const VALID_ID = '507f1f77bcf86cd799439011';

const makeE11000 = (): Error & { code: number } =>
  Object.assign(
    new Error(
      'E11000 duplicate key error collection: penny.accounts index: workspaceId_1_name_1 dup key',
    ),
    { code: 11000, name: 'MongoServerError' },
  );

describe('MongoAccountRepository (unit — mocked model)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('findOrCreateDefault', () => {
    it('upserts via findOneAndUpdate with $setOnInsert, scoped to (workspaceId, name)', async () => {
      const upsertedDoc = {
        _id: { toString: () => VALID_ID },
        workspaceId: 'ws-1',
        name: 'Main',
        currency: 'UAH',
        createdAt: new Date('2026-06-15T12:00:00.000Z'),
      };
      const findOneAndUpdateSpy = vi.fn().mockReturnValue({
        exec: vi.fn().mockResolvedValue(upsertedDoc),
      });
      vi.mocked(getAccountModel).mockReturnValue({
        findOneAndUpdate: findOneAndUpdateSpy,
      } as unknown as ReturnModelType<typeof AccountModel>);

      const repository = new MongoAccountRepository(
        FAKE_CONNECTION,
        silentLogger,
      );

      const result = await repository.findOrCreateDefault(
        'ws-1',
        'Main',
        'UAH',
      );

      expect(result).toBeInstanceOf(Account);
      expect(result.id).toBe(VALID_ID);
      const [filter, update, options] = findOneAndUpdateSpy.mock.calls[0] as [
        Record<string, unknown>,
        { $setOnInsert: Record<string, unknown> },
        Record<string, unknown>,
      ];
      expect(filter).toEqual({ workspaceId: 'ws-1', name: 'Main' });
      expect(update.$setOnInsert).toMatchObject({
        workspaceId: 'ws-1',
        name: 'Main',
        currency: 'UAH',
      });
      expect(options).toEqual({ upsert: true, new: true });
    });

    it('falls back to findOne on a duplicate-key race between two first-callers', async () => {
      const winnerDoc = {
        _id: { toString: () => VALID_ID },
        workspaceId: 'ws-1',
        name: 'Main',
        currency: 'UAH',
        createdAt: new Date(),
      };
      const findOneAndUpdateSpy = vi.fn().mockReturnValue({
        exec: vi.fn().mockRejectedValue(makeE11000()),
      });
      const findOneSpy = vi.fn().mockReturnValue({
        exec: vi.fn().mockResolvedValue(winnerDoc),
      });
      vi.mocked(getAccountModel).mockReturnValue({
        findOneAndUpdate: findOneAndUpdateSpy,
        findOne: findOneSpy,
      } as unknown as ReturnModelType<typeof AccountModel>);

      const repository = new MongoAccountRepository(
        FAKE_CONNECTION,
        silentLogger,
      );

      const result = await repository.findOrCreateDefault(
        'ws-1',
        'Main',
        'UAH',
      );

      expect(result.id).toBe(VALID_ID);
      expect(findOneSpy).toHaveBeenCalledWith({
        workspaceId: 'ws-1',
        name: 'Main',
      });
    });

    it('wraps a non-duplicate-key driver error as InfrastructureError', async () => {
      const findOneAndUpdateSpy = vi.fn().mockReturnValue({
        exec: vi.fn().mockRejectedValue(new Error('topology closed')),
      });
      vi.mocked(getAccountModel).mockReturnValue({
        findOneAndUpdate: findOneAndUpdateSpy,
      } as unknown as ReturnModelType<typeof AccountModel>);

      const repository = new MongoAccountRepository(
        FAKE_CONNECTION,
        silentLogger,
      );

      await expect(
        repository.findOrCreateDefault('ws-1', 'Main', 'UAH'),
      ).rejects.toBeInstanceOf(InfrastructureError);
    });
  });

  describe('save', () => {
    it('always inserts via model.create', async () => {
      const createdDoc = {
        _id: { toString: () => VALID_ID },
        workspaceId: 'ws-1',
        name: 'Main',
        currency: 'UAH',
        createdAt: new Date(),
      };
      const createSpy = vi.fn().mockResolvedValue(createdDoc);
      vi.mocked(getAccountModel).mockReturnValue({
        create: createSpy,
      } as unknown as ReturnModelType<typeof AccountModel>);

      const repository = new MongoAccountRepository(
        FAKE_CONNECTION,
        silentLogger,
      );
      const account = Account.create('', 'ws-1', 'Main', 'UAH');

      const result = await repository.save(account);

      expect(result.id).toBe(VALID_ID);
      expect(createSpy).toHaveBeenCalledOnce();
    });
  });
});
