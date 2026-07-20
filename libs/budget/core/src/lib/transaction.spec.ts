import { describe, expect, it } from 'vitest';
import { Money } from 'shared-util';

import { Transaction } from './transaction.js';
import { TransactionType } from 'budget-contracts';

const NOW = new Date('2026-07-01T00:00:00.000Z');
const DATE = new Date('2026-06-15T00:00:00.000Z');
const AMOUNT = Money.fromMinorUnits(1_00, 'UAH');

const create = (
  overrides: Partial<{
    id: string;
    workspaceId: string;
    accountId: string;
    categoryId: string;
    type: TransactionType;
    amount: Money;
    date: Date;
    createdBy: string;
    description?: string;
    now: Date;
  }> = {},
): Transaction =>
  Transaction.create(
    overrides.id ?? 'txn-1',
    overrides.workspaceId ?? 'ws-1',
    overrides.accountId ?? 'acc-1',
    overrides.categoryId ?? 'cat-1',
    overrides.type ?? TransactionType.EXPENSE,
    overrides.amount ?? AMOUNT,
    overrides.date ?? DATE,
    overrides.createdBy ?? 'user-1',
    overrides.description,
    overrides.now ?? NOW,
  );

describe('Transaction', () => {
  describe('create', () => {
    it('creates a transaction with the given fields', () => {
      const transaction = create({ description: 'Groceries' });

      expect(transaction.id).toBe('txn-1');
      expect(transaction.workspaceId).toBe('ws-1');
      expect(transaction.accountId).toBe('acc-1');
      expect(transaction.categoryId).toBe('cat-1');
      expect(transaction.type).toBe(TransactionType.EXPENSE);
      expect(transaction.amount).toBe(AMOUNT);
      expect(transaction.date).toEqual(DATE);
      expect(transaction.description).toBe('Groceries');
      expect(transaction.createdBy).toBe('user-1');
      expect(transaction.createdAt).toEqual(NOW);
    });

    it('allows an income transaction', () => {
      const transaction = create({ type: TransactionType.INCOME });

      expect(transaction.type).toBe(TransactionType.INCOME);
    });

    it('leaves description undefined when not provided', () => {
      const transaction = create();

      expect(transaction.description).toBeUndefined();
    });

    it('defaults createdAt to the current time when now is not provided', () => {
      const before = Date.now();

      const transaction = Transaction.create(
        'txn-1',
        'ws-1',
        'acc-1',
        'cat-1',
        TransactionType.EXPENSE,
        AMOUNT,
        DATE,
        'user-1',
      );

      const after = Date.now();
      expect(transaction.createdAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(transaction.createdAt.getTime()).toBeLessThanOrEqual(after);
    });

    it('trims whitespace from workspaceId, accountId, categoryId, and createdBy', () => {
      const transaction = create({
        workspaceId: ' ws-1 ',
        accountId: ' acc-1 ',
        categoryId: ' cat-1 ',
        createdBy: ' user-1 ',
      });

      expect(transaction.workspaceId).toBe('ws-1');
      expect(transaction.accountId).toBe('acc-1');
      expect(transaction.categoryId).toBe('cat-1');
      expect(transaction.createdBy).toBe('user-1');
    });

    it('rejects a blank workspaceId', () => {
      expect(() => create({ workspaceId: '  ' })).toThrow(
        /workspaceId must not be blank/i,
      );
    });

    it('rejects a blank accountId', () => {
      expect(() => create({ accountId: '  ' })).toThrow(
        /accountId must not be blank/i,
      );
    });

    it('rejects a blank categoryId', () => {
      expect(() => create({ categoryId: '  ' })).toThrow(
        /categoryId must not be blank/i,
      );
    });

    it('rejects a blank createdBy', () => {
      expect(() => create({ createdBy: '  ' })).toThrow(
        /createdBy must not be blank/i,
      );
    });

    it('rejects a zero amount', () => {
      expect(() => create({ amount: Money.zero('UAH') })).toThrow(
        /amount must be greater than zero/i,
      );
    });

    it('rejects a negative amount', () => {
      expect(() => create({ amount: Money.fromMinorUnits(-1, 'UAH') })).toThrow(
        /amount must be greater than zero/i,
      );
    });
  });
});
