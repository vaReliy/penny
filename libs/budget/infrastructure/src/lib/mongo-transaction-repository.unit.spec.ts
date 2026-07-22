/**
 * Unit tests for MongoTransactionRepository: the Mongoose model is mocked so
 * these tests run without a live MongoDB connection. They exercise the
 * aggregation `$match`/`$group` shapes and the raw-aggregate-amount
 * normalization (`bigint`/`Long`-like/`number` → `bigint`) that the
 * integration suite cannot deterministically force (a real driver mostly
 * returns one consistent shape locally).
 */

import type { ReturnModelType } from '@typegoose/typegoose';
import type { Connection } from 'mongoose';
import pino from 'pino';
import { InfrastructureError } from 'shared-errors';
import { Transaction } from 'budget-core';
import { TransactionType } from 'budget-contracts';
import { Money } from 'shared-util';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const silentLogger = pino({ level: 'silent' });

vi.mock('./transaction.model.js');

import { getTransactionModel } from './transaction.model.js';
import type { TransactionModel } from './transaction.model.js';
import { MongoTransactionRepository } from './mongo-transaction-repository.js';

const FAKE_CONNECTION = {} as Connection;

/** BSON `Long`-like stub carrying only `toString`, exercising the non-bigint/non-number aggregation-result branch. */
function longLike(value: bigint): { toString(): string } {
  return { toString: () => value.toString() };
}

describe('MongoTransactionRepository (unit — mocked model)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('sumAmountsByType', () => {
    it('normalizes bigint, Long-like, and number aggregation results to bigint', async () => {
      const aggregateSpy = vi.fn().mockReturnValue({
        exec: vi.fn().mockResolvedValue([
          { _id: TransactionType.INCOME, total: 500000n },
          { _id: TransactionType.EXPENSE, total: longLike(123456n) },
        ]),
      });
      vi.mocked(getTransactionModel).mockReturnValue({
        aggregate: aggregateSpy,
      } as unknown as ReturnModelType<typeof TransactionModel>);

      const repository = new MongoTransactionRepository(
        FAKE_CONNECTION,
        silentLogger,
      );

      const totals = await repository.sumAmountsByType('ws-1', {
        accountId: 'acc-1',
      });

      expect(totals).toEqual({ income: 500000n, expense: 123456n });
      expect(aggregateSpy).toHaveBeenCalledWith([
        { $match: { workspaceId: 'ws-1', accountId: 'acc-1' } },
        { $group: { _id: '$type', total: { $sum: '$amount' } } },
      ]);
    });

    it('returns well-typed zeros (never NaN/undefined) for an empty result set', async () => {
      vi.mocked(getTransactionModel).mockReturnValue({
        aggregate: vi.fn().mockReturnValue({
          exec: vi.fn().mockResolvedValue([]),
        }),
      } as unknown as ReturnModelType<typeof TransactionModel>);

      const repository = new MongoTransactionRepository(
        FAKE_CONNECTION,
        silentLogger,
      );

      const totals = await repository.sumAmountsByType('empty-ws');

      expect(totals).toEqual({ income: 0n, expense: 0n });
      expect(Number.isNaN(Number(totals.income))).toBe(false);
      expect(Number.isNaN(Number(totals.expense))).toBe(false);
    });

    it('normalizes a plain-number aggregation result to bigint', async () => {
      vi.mocked(getTransactionModel).mockReturnValue({
        aggregate: vi.fn().mockReturnValue({
          exec: vi
            .fn()
            .mockResolvedValue([{ _id: TransactionType.INCOME, total: 42 }]),
        }),
      } as unknown as ReturnModelType<typeof TransactionModel>);

      const repository = new MongoTransactionRepository(
        FAKE_CONNECTION,
        silentLogger,
      );

      const totals = await repository.sumAmountsByType('ws-1');

      expect(totals.income).toBe(42n);
      expect(typeof totals.income).toBe('bigint');
    });

    it('wraps a driver error as InfrastructureError', async () => {
      vi.mocked(getTransactionModel).mockReturnValue({
        aggregate: vi.fn().mockReturnValue({
          exec: vi.fn().mockRejectedValue(new Error('topology closed')),
        }),
      } as unknown as ReturnModelType<typeof TransactionModel>);

      const repository = new MongoTransactionRepository(
        FAKE_CONNECTION,
        silentLogger,
      );

      await expect(repository.sumAmountsByType('ws-1')).rejects.toBeInstanceOf(
        InfrastructureError,
      );
    });
  });

  describe('sumExpenseByCategory', () => {
    it('forces type: expense into the $match stage and groups by categoryId', async () => {
      const aggregateSpy = vi.fn().mockReturnValue({
        exec: vi.fn().mockResolvedValue([{ _id: 'cat-1', total: 25000n }]),
      });
      vi.mocked(getTransactionModel).mockReturnValue({
        aggregate: aggregateSpy,
      } as unknown as ReturnModelType<typeof TransactionModel>);

      const repository = new MongoTransactionRepository(
        FAKE_CONNECTION,
        silentLogger,
      );
      const from = new Date('2026-07-01T00:00:00.000Z');
      const to = new Date('2026-08-01T00:00:00.000Z');

      const result = await repository.sumExpenseByCategory('ws-1', {
        from,
        to,
      });

      expect(result).toEqual([{ categoryId: 'cat-1', total: 25000n }]);
      expect(aggregateSpy).toHaveBeenCalledWith([
        {
          $match: {
            workspaceId: 'ws-1',
            type: TransactionType.EXPENSE,
            date: { $gte: from, $lt: to },
          },
        },
        { $group: { _id: '$categoryId', total: { $sum: '$amount' } } },
      ]);
    });

    it('returns an empty array (never undefined) for a workspace with no expense spend', async () => {
      vi.mocked(getTransactionModel).mockReturnValue({
        aggregate: vi.fn().mockReturnValue({
          exec: vi.fn().mockResolvedValue([]),
        }),
      } as unknown as ReturnModelType<typeof TransactionModel>);

      const repository = new MongoTransactionRepository(
        FAKE_CONNECTION,
        silentLogger,
      );

      const result = await repository.sumExpenseByCategory('empty-ws');

      expect(result).toEqual([]);
    });
  });

  describe('findByWorkspace', () => {
    it('builds a half-open [from, to) date filter and sorts newest-first', async () => {
      const sortSpy = vi.fn().mockReturnValue({
        exec: vi.fn().mockResolvedValue([]),
      });
      const findSpy = vi.fn().mockReturnValue({ sort: sortSpy });
      vi.mocked(getTransactionModel).mockReturnValue({
        find: findSpy,
      } as unknown as ReturnModelType<typeof TransactionModel>);

      const repository = new MongoTransactionRepository(
        FAKE_CONNECTION,
        silentLogger,
      );
      const from = new Date('2026-07-01T00:00:00.000Z');
      const to = new Date('2026-08-01T00:00:00.000Z');

      await repository.findByWorkspace('ws-1', {
        accountId: 'acc-1',
        from,
        to,
      });

      expect(findSpy).toHaveBeenCalledWith({
        workspaceId: 'ws-1',
        accountId: 'acc-1',
        date: { $gte: from, $lt: to },
      });
      expect(sortSpy).toHaveBeenCalledWith({ date: -1 });
    });
  });

  describe('save', () => {
    it('always inserts via model.create, ignoring transactions are immutable/create-only', async () => {
      const createdDoc = {
        _id: { toString: () => '507f1f77bcf86cd799439011' },
        workspaceId: 'ws-1',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        type: TransactionType.EXPENSE,
        amount: 15000n,
        currency: 'UAH',
        date: new Date('2026-07-10T00:00:00.000Z'),
        createdBy: 'user-1',
        createdAt: new Date('2026-07-10T08:30:00.000Z'),
      };
      const createSpy = vi.fn().mockResolvedValue(createdDoc);
      vi.mocked(getTransactionModel).mockReturnValue({
        create: createSpy,
      } as unknown as ReturnModelType<typeof TransactionModel>);

      const repository = new MongoTransactionRepository(
        FAKE_CONNECTION,
        silentLogger,
      );
      const transaction = Transaction.create(
        '',
        'ws-1',
        'acc-1',
        'cat-1',
        TransactionType.EXPENSE,
        Money.fromMinorUnits(15000n, 'UAH'),
        new Date('2026-07-10T00:00:00.000Z'),
        'user-1',
      );

      const result = await repository.save(transaction);

      expect(result).toBeInstanceOf(Transaction);
      expect(result.id).toBe('507f1f77bcf86cd799439011');
      expect(createSpy).toHaveBeenCalledOnce();
    });

    it('wraps a driver error as InfrastructureError', async () => {
      vi.mocked(getTransactionModel).mockReturnValue({
        create: vi.fn().mockRejectedValue(new Error('topology closed')),
      } as unknown as ReturnModelType<typeof TransactionModel>);

      const repository = new MongoTransactionRepository(
        FAKE_CONNECTION,
        silentLogger,
      );
      const transaction = Transaction.create(
        '',
        'ws-1',
        'acc-1',
        'cat-1',
        TransactionType.EXPENSE,
        Money.fromMinorUnits(15000n, 'UAH'),
        new Date('2026-07-10T00:00:00.000Z'),
        'user-1',
      );

      await expect(repository.save(transaction)).rejects.toBeInstanceOf(
        InfrastructureError,
      );
    });
  });

  describe('existsForCategory', () => {
    it('returns true when a matching document exists', async () => {
      vi.mocked(getTransactionModel).mockReturnValue({
        exists: vi.fn().mockReturnValue({
          exec: vi.fn().mockResolvedValue({ _id: 'tx-1' }),
        }),
      } as unknown as ReturnModelType<typeof TransactionModel>);

      const repository = new MongoTransactionRepository(
        FAKE_CONNECTION,
        silentLogger,
      );

      await expect(repository.existsForCategory('cat-1', 'ws-1')).resolves.toBe(
        true,
      );
    });

    it('returns false when no matching document exists', async () => {
      vi.mocked(getTransactionModel).mockReturnValue({
        exists: vi.fn().mockReturnValue({
          exec: vi.fn().mockResolvedValue(null),
        }),
      } as unknown as ReturnModelType<typeof TransactionModel>);

      const repository = new MongoTransactionRepository(
        FAKE_CONNECTION,
        silentLogger,
      );

      await expect(repository.existsForCategory('cat-1', 'ws-1')).resolves.toBe(
        false,
      );
    });
  });
});
