import type { DocumentType } from '@typegoose/typegoose';
import { describe, expect, it } from 'vitest';

import { Transaction } from 'budget-core';
import { Money } from 'shared-util';
import { TransactionType } from 'budget-contracts';

import { TransactionMapper } from './transaction.mapper.js';
import type { TransactionModel } from './transaction.model.js';

/** Minimal hydrated-document shape `TransactionMapper.toDomain` reads from. */
function buildDoc(
  overrides: Partial<{
    type: string;
    amount: bigint;
    currency: string;
    description?: string;
  }> = {},
): DocumentType<TransactionModel> {
  return {
    _id: { toString: () => '507f1f77bcf86cd799439011' },
    workspaceId: 'ws-1',
    accountId: 'acc-1',
    categoryId: 'cat-1',
    type: overrides.type ?? TransactionType.EXPENSE,
    amount: overrides.amount ?? 15000n,
    currency: overrides.currency ?? 'UAH',
    date: new Date('2026-07-10T00:00:00.000Z'),
    description: overrides.description,
    createdBy: 'user-1',
    createdAt: new Date('2026-07-10T08:30:00.000Z'),
  } as unknown as DocumentType<TransactionModel>;
}

describe('TransactionMapper', () => {
  describe('toDomain', () => {
    it('maps a document to a domain Transaction, preserving amount fidelity and the exact createdAt', () => {
      const transaction = TransactionMapper.toDomain(buildDoc());

      expect(transaction).toBeInstanceOf(Transaction);
      expect(transaction.id).toBe('507f1f77bcf86cd799439011');
      expect(transaction.workspaceId).toBe('ws-1');
      expect(transaction.accountId).toBe('acc-1');
      expect(transaction.categoryId).toBe('cat-1');
      expect(transaction.type).toBe(TransactionType.EXPENSE);
      expect(transaction.amount.amount).toBe(15000n);
      expect(transaction.amount.currency).toBe('UAH');
      expect(transaction.date).toEqual(new Date('2026-07-10T00:00:00.000Z'));
      expect(transaction.createdBy).toBe('user-1');
      expect(transaction.createdAt).toEqual(
        new Date('2026-07-10T08:30:00.000Z'),
      );
    });

    it('maps an income document', () => {
      const transaction = TransactionMapper.toDomain(
        buildDoc({ type: TransactionType.INCOME }),
      );

      expect(transaction.type).toBe(TransactionType.INCOME);
    });

    it('carries an optional description through when present', () => {
      const transaction = TransactionMapper.toDomain(
        buildDoc({ description: 'Weekly groceries' }),
      );

      expect(transaction.description).toBe('Weekly groceries');
    });

    it('preserves a large minor-units amount exactly (no float rounding)', () => {
      const largeAmount = 9_007_199_254_740_993n; // beyond Number.MAX_SAFE_INTEGER
      const transaction = TransactionMapper.toDomain(
        buildDoc({ amount: largeAmount }),
      );

      expect(transaction.amount.amount).toBe(largeAmount);
    });
  });

  describe('toPersistence', () => {
    it('decomposes amount/currency and carries every persisted field', () => {
      const transaction = Transaction.create(
        'tx-1',
        'ws-1',
        'acc-1',
        'cat-1',
        TransactionType.EXPENSE,
        Money.fromMinorUnits(15000n, 'UAH'),
        new Date('2026-07-10T00:00:00.000Z'),
        'user-1',
        'Weekly groceries',
        new Date('2026-07-10T08:30:00.000Z'),
      );

      const persistence = TransactionMapper.toPersistence(transaction);

      expect(persistence).toEqual({
        workspaceId: 'ws-1',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        type: TransactionType.EXPENSE,
        amount: 15000n,
        currency: 'UAH',
        date: new Date('2026-07-10T00:00:00.000Z'),
        description: 'Weekly groceries',
        createdBy: 'user-1',
        createdAt: new Date('2026-07-10T08:30:00.000Z'),
      });
    });
  });
});
