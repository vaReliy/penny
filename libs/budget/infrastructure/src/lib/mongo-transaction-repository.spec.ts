import { Transaction } from 'budget-core';
import { TransactionType } from 'budget-contracts';
import { Money } from 'shared-util';
import pino from 'pino';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const silentLogger = pino({ level: 'silent' });

import {
  createMongoConnection,
  disconnectMongoConnection,
  type MongoConnectionConfig,
} from './mongo-connection.js';
import { MongoTransactionRepository } from './mongo-transaction-repository.js';
import { generateTestDbName } from './test-db-name.js';
import type { Connection } from 'mongoose';

/**
 * Integration test: exercises `MongoTransactionRepository` against a real
 * MongoDB instance, proving the onion's persistence boundary — and every
 * aggregation pipeline — hold end-to-end. Mirrors
 * `mongo-category-repository.spec.ts`'s per-worker test DB isolation
 * pattern (`2026-07-15-01`).
 *
 * Runs locally: `docker compose up -d mongo` first, then set MONGO_TEST_URI
 * and run this test. Runs in CI: GitHub Actions job provides mongo:7 service
 * container with MONGO_TEST_URI set.
 */
describe('MongoTransactionRepository (integration)', () => {
  const config: MongoConnectionConfig = {
    uri: process.env['MONGO_TEST_URI'] ?? 'mongodb://localhost:27017',
    dbName: generateTestDbName('penny-test-budget-transaction'),
  };

  let connection: Connection;
  let repository: MongoTransactionRepository;

  // Half-open UTC instant ranges, June/July 2026 — the repository itself is
  // timezone-agnostic (per ADR-007: TZ→instant conversion happens once in
  // the application layer, `resolveMonthRange`), so this suite exercises the
  // pipeline with plain UTC boundaries directly.
  const JUNE_FROM = new Date('2026-06-01T00:00:00.000Z');
  const JUNE_TO = new Date('2026-07-01T00:00:00.000Z');
  const JULY_FROM = new Date('2026-07-01T00:00:00.000Z');
  const JULY_TO = new Date('2026-08-01T00:00:00.000Z');

  const WORKSPACE = 'ws-fixtures';
  const ACCOUNT_1 = 'acc-1';
  const ACCOUNT_2 = 'acc-2';
  const CATEGORY_GROCERIES = 'cat-groceries';
  const CATEGORY_SALARY = 'cat-salary';

  function buildTransaction(
    accountId: string,
    categoryId: string,
    type: (typeof TransactionType)[keyof typeof TransactionType],
    amountMinorUnits: bigint,
    date: string,
  ): Transaction {
    return Transaction.create(
      '',
      WORKSPACE,
      accountId,
      categoryId,
      type,
      Money.fromMinorUnits(amountMinorUnits, 'UAH'),
      new Date(date),
      'user-1',
    );
  }

  beforeAll(async () => {
    connection = await createMongoConnection(config);
    repository = new MongoTransactionRepository(connection, silentLogger);

    // Fixtures spanning the June/July 2026 month boundary and both
    // transaction types. TX3/TX4 straddle the exact boundary instant to
    // prove half-open `[from, to)` attribution.
    await repository.save(
      buildTransaction(
        ACCOUNT_1,
        CATEGORY_SALARY,
        TransactionType.INCOME,
        100000n,
        '2026-06-15T12:00:00.000Z',
      ), // TX1 — June
    );
    await repository.save(
      buildTransaction(
        ACCOUNT_1,
        CATEGORY_GROCERIES,
        TransactionType.EXPENSE,
        30000n,
        '2026-06-20T12:00:00.000Z',
      ), // TX2 — June
    );
    await repository.save(
      buildTransaction(
        ACCOUNT_1,
        CATEGORY_GROCERIES,
        TransactionType.EXPENSE,
        7000n,
        '2026-06-30T23:59:59.000Z',
      ), // TX3 — June (last moment before the boundary)
    );
    await repository.save(
      buildTransaction(
        ACCOUNT_1,
        CATEGORY_GROCERIES,
        TransactionType.EXPENSE,
        20000n,
        '2026-07-01T00:00:00.000Z',
      ), // TX4 — July (exactly at the boundary instant)
    );
    await repository.save(
      buildTransaction(
        ACCOUNT_1,
        CATEGORY_SALARY,
        TransactionType.INCOME,
        50000n,
        '2026-07-15T12:00:00.000Z',
      ), // TX5 — July
    );
    await repository.save(
      buildTransaction(
        ACCOUNT_2,
        CATEGORY_GROCERIES,
        TransactionType.EXPENSE,
        15000n,
        '2026-07-20T12:00:00.000Z',
      ), // TX6 — July, different account
    );
  });

  afterAll(async () => {
    await connection.dropDatabase();
    await disconnectMongoConnection(connection);
  });

  describe('save / findByIdInWorkspace — mapper fidelity', () => {
    it('round-trips a created transaction with exact minor-units amount and optional description', async () => {
      const created = await repository.save(
        Transaction.create(
          '',
          WORKSPACE,
          ACCOUNT_1,
          CATEGORY_GROCERIES,
          TransactionType.EXPENSE,
          Money.fromMinorUnits(9_007_199_254_740_993n, 'UAH'), // beyond Number.MAX_SAFE_INTEGER
          new Date('2026-06-01T00:00:00.000Z'),
          'user-1',
          'Weekly groceries',
        ),
      );

      const found = await repository.findByIdInWorkspace(created.id, WORKSPACE);

      expect(found).toBeInstanceOf(Transaction);
      expect(found?.amount.amount).toBe(9_007_199_254_740_993n);
      expect(found?.amount.currency).toBe('UAH');
      expect(found?.description).toBe('Weekly groceries');
      expect(found?.type).toBe(TransactionType.EXPENSE);

      await repository.deleteInWorkspace(created.id, WORKSPACE);
    });

    it('returns null for an id in the wrong workspace', async () => {
      const created = await repository.save(
        buildTransaction(
          ACCOUNT_1,
          CATEGORY_GROCERIES,
          TransactionType.EXPENSE,
          1000n,
          '2026-06-01T00:00:00.000Z',
        ),
      );

      expect(
        await repository.findByIdInWorkspace(created.id, 'wrong-workspace'),
      ).toBeNull();

      await repository.deleteInWorkspace(created.id, WORKSPACE);
    });
  });

  describe('sumAmountsByType — balance derivation', () => {
    it('sums income/expense across all time for account acc-1', async () => {
      const totals = await repository.sumAmountsByType(WORKSPACE, {
        accountId: ACCOUNT_1,
      });

      // income: TX1(100000) + TX5(50000) = 150000
      // expense: TX2(30000) + TX3(7000) + TX4(20000) = 57000
      expect(totals).toEqual({ income: 150000n, expense: 57000n });
    });

    it('narrows by an explicit date range (June only)', async () => {
      const totals = await repository.sumAmountsByType(WORKSPACE, {
        accountId: ACCOUNT_1,
        from: JUNE_FROM,
        to: JUNE_TO,
      });

      // income: TX1(100000); expense: TX2(30000) + TX3(7000) = 37000.
      // TX4 (exactly at JUNE_TO) is excluded — half-open [from, to).
      expect(totals).toEqual({ income: 100000n, expense: 37000n });
    });

    it('narrows by an explicit date range (July only)', async () => {
      const totals = await repository.sumAmountsByType(WORKSPACE, {
        accountId: ACCOUNT_1,
        from: JULY_FROM,
        to: JULY_TO,
      });

      // income: TX5(50000); expense: TX4(20000).
      expect(totals).toEqual({ income: 50000n, expense: 20000n });
    });

    it('sums across all accounts in the workspace when accountId is omitted', async () => {
      const totals = await repository.sumAmountsByType(WORKSPACE);

      // income: 150000 (acc-1 only); expense: 57000 (acc-1) + 15000 (acc-2, TX6) = 72000.
      expect(totals).toEqual({ income: 150000n, expense: 72000n });
    });

    it('returns well-typed zero totals for an empty workspace (never NaN/undefined)', async () => {
      const totals = await repository.sumAmountsByType('empty-workspace');

      expect(totals).toEqual({ income: 0n, expense: 0n });
      expect(typeof totals.income).toBe('bigint');
      expect(typeof totals.expense).toBe('bigint');
    });

    it('returns well-typed zero totals for an account with no transactions, in a non-empty workspace (distinct empty-state path from an empty workspace)', async () => {
      const totals = await repository.sumAmountsByType(WORKSPACE, {
        accountId: 'acc-nonexistent',
      });

      expect(totals).toEqual({ income: 0n, expense: 0n });
      expect(typeof totals.income).toBe('bigint');
      expect(typeof totals.expense).toBe('bigint');
    });
  });

  describe('sumExpenseByCategory — chart/planner rollups', () => {
    it('sums expense-only amounts, grouped by category, across all time', async () => {
      const totals = await repository.sumExpenseByCategory(WORKSPACE);

      // TX2(30000) + TX3(7000) + TX4(20000) + TX6(15000) = 72000, all groceries.
      expect(totals).toEqual([
        { categoryId: CATEGORY_GROCERIES, total: 72000n },
      ]);
    });

    it('narrows by an explicit date range (June only)', async () => {
      const totals = await repository.sumExpenseByCategory(WORKSPACE, {
        from: JUNE_FROM,
        to: JUNE_TO,
      });

      // TX2(30000) + TX3(7000) = 37000.
      expect(totals).toEqual([
        { categoryId: CATEGORY_GROCERIES, total: 37000n },
      ]);
    });

    it('narrows by an explicit date range (July only)', async () => {
      const totals = await repository.sumExpenseByCategory(WORKSPACE, {
        from: JULY_FROM,
        to: JULY_TO,
      });

      // TX4(20000) + TX6(15000) = 35000.
      expect(totals).toEqual([
        { categoryId: CATEGORY_GROCERIES, total: 35000n },
      ]);
    });

    it('returns an empty array (never undefined) for an empty workspace', async () => {
      const totals = await repository.sumExpenseByCategory('empty-workspace');

      expect(totals).toEqual([]);
    });
  });

  describe('findByWorkspace — filtered listing + ordering', () => {
    it('lists every transaction in the workspace, newest-first', async () => {
      const transactions = await repository.findByWorkspace(WORKSPACE);

      const dates = transactions.map((t) => t.date.toISOString());
      expect(dates).toEqual([...dates].sort().reverse());
      expect(transactions.length).toBeGreaterThanOrEqual(6);
    });

    it('narrows by accountId', async () => {
      const transactions = await repository.findByWorkspace(WORKSPACE, {
        accountId: ACCOUNT_2,
      });

      expect(transactions).toHaveLength(1);
      expect(transactions[0]?.accountId).toBe(ACCOUNT_2);
    });

    it('narrows by categoryId and a July date range, newest-first', async () => {
      const transactions = await repository.findByWorkspace(WORKSPACE, {
        categoryId: CATEGORY_GROCERIES,
        from: JULY_FROM,
        to: JULY_TO,
      });

      expect(transactions.map((t) => t.accountId)).toEqual([
        ACCOUNT_2, // TX6, 07-20
        ACCOUNT_1, // TX4, 07-01
      ]);
    });

    it('narrows by type', async () => {
      const transactions = await repository.findByWorkspace(WORKSPACE, {
        type: TransactionType.INCOME,
      });

      expect(transactions.every((t) => t.type === TransactionType.INCOME)).toBe(
        true,
      );
      expect(transactions.length).toBeGreaterThanOrEqual(2);
    });

    it('returns an empty array for an empty workspace', async () => {
      expect(await repository.findByWorkspace('empty-workspace')).toEqual([]);
    });

    it('returns an empty array when narrowed to a category with no matching transactions, in a non-empty workspace (distinct empty-state path from an empty workspace)', async () => {
      expect(
        await repository.findByWorkspace(WORKSPACE, {
          categoryId: 'cat-unused',
        }),
      ).toEqual([]);
    });
  });

  describe('existsForCategory', () => {
    it('returns true when at least one transaction references the category', async () => {
      expect(
        await repository.existsForCategory(CATEGORY_GROCERIES, WORKSPACE),
      ).toBe(true);
    });

    it('returns false for a category with no referencing transactions', async () => {
      expect(await repository.existsForCategory('cat-unused', WORKSPACE)).toBe(
        false,
      );
    });
  });

  describe('updateInWorkspace / deleteInWorkspace (Q5-deferred, exercised for contract completeness)', () => {
    it('updates only the given fields, scoped to workspaceId', async () => {
      const created = await repository.save(
        buildTransaction(
          ACCOUNT_1,
          CATEGORY_GROCERIES,
          TransactionType.EXPENSE,
          1000n,
          '2026-06-01T00:00:00.000Z',
        ),
      );

      await repository.updateInWorkspace(created.id, WORKSPACE, {
        description: 'Updated note',
      });

      const found = await repository.findByIdInWorkspace(created.id, WORKSPACE);
      expect(found?.description).toBe('Updated note');
      expect(found?.amount.amount).toBe(1000n); // untouched

      await repository.deleteInWorkspace(created.id, WORKSPACE);
      expect(
        await repository.findByIdInWorkspace(created.id, WORKSPACE),
      ).toBeNull();
    });

    it('is a no-op when the id is not a valid ObjectId', async () => {
      await expect(
        repository.updateInWorkspace('not-an-id', WORKSPACE, {
          description: 'x',
        }),
      ).resolves.toBeUndefined();
      await expect(
        repository.deleteInWorkspace('not-an-id', WORKSPACE),
      ).resolves.toBeUndefined();
    });
  });
});
