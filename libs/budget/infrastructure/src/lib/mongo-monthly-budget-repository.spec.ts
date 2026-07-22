import { MonthlyBudget } from 'budget-core';
import { Money } from 'shared-util';
import pino from 'pino';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const silentLogger = pino({ level: 'silent' });

import {
  createMongoConnection,
  disconnectMongoConnection,
  type MongoConnectionConfig,
} from './mongo-connection.js';
import { MongoMonthlyBudgetRepository } from './mongo-monthly-budget-repository.js';
import { generateTestDbName } from './test-db-name.js';
import type { Connection } from 'mongoose';

/**
 * Integration test: exercises `MongoMonthlyBudgetRepository` against a real
 * MongoDB instance. Mirrors `mongo-user-repository.spec.ts`'s per-worker
 * test DB isolation pattern (`2026-07-15-01`).
 *
 * Runs locally: `docker compose up -d mongo` first, then set MONGO_TEST_URI
 * and run this test. Runs in CI: GitHub Actions job provides mongo:7 service
 * container with MONGO_TEST_URI set.
 */
describe('MongoMonthlyBudgetRepository (integration)', () => {
  const config: MongoConnectionConfig = {
    uri: process.env['MONGO_TEST_URI'] ?? 'mongodb://localhost:27017',
    dbName: generateTestDbName('penny-test-budget-monthly'),
  };

  let connection: Connection;
  let repository: MongoMonthlyBudgetRepository;

  beforeAll(async () => {
    connection = await createMongoConnection(config);
    repository = new MongoMonthlyBudgetRepository(connection, silentLogger);
  });

  afterAll(async () => {
    await connection.dropDatabase();
    await disconnectMongoConnection(connection);
  });

  it('upserts an amount, finds it by workspace/category/month and by workspace/month, mapper preserves minor units exactly', async () => {
    const amount = Money.fromMinorUnits(150000n, 'UAH');

    await repository.upsertAmount('ws-1', 'cat-1', '2026-07', amount);

    const found = await repository.findByWorkspaceCategoryMonth(
      'ws-1',
      'cat-1',
      '2026-07',
    );
    expect(found).not.toBeNull();
    expect(found?.amount.amount).toBe(150000n);
    expect(found?.amount.currency).toBe('UAH');
    expect(found?.workspaceId).toBe('ws-1');
    expect(found?.categoryId).toBe('cat-1');
    expect(found?.month).toBe('2026-07');

    const byMonth = await repository.findByWorkspaceAndMonth('ws-1', '2026-07');
    expect(byMonth).toHaveLength(1);
    expect(byMonth[0]?.categoryId).toBe('cat-1');
  });

  it('upsertAmount replaces the amount for an existing (workspaceId, categoryId, month) rather than creating a second document', async () => {
    await repository.upsertAmount(
      'ws-2',
      'cat-2',
      '2026-08',
      Money.fromMinorUnits(100000n, 'UAH'),
    );
    await repository.upsertAmount(
      'ws-2',
      'cat-2',
      '2026-08',
      Money.fromMinorUnits(200000n, 'UAH'),
    );

    const all = await repository.findByWorkspaceAndMonth('ws-2', '2026-08');
    expect(all).toHaveLength(1);
    expect(all[0]?.amount.amount).toBe(200000n);
  });

  it('upsertAmount is idempotent under concurrent Promise.all calls — exactly one document survives, holding one of the two amounts', async () => {
    const [a, b] = await Promise.all([
      repository.upsertAmount(
        'ws-3',
        'cat-3',
        '2026-09',
        Money.fromMinorUnits(50000n, 'UAH'),
      ),
      repository.upsertAmount(
        'ws-3',
        'cat-3',
        '2026-09',
        Money.fromMinorUnits(75000n, 'UAH'),
      ),
    ]);

    // Neither concurrent call throws — the unique index + upsert:true
    // resolves the race atomically inside MongoDB itself.
    expect(a).toBeUndefined();
    expect(b).toBeUndefined();

    const all = await repository.findByWorkspaceAndMonth('ws-3', '2026-09');
    expect(all).toHaveLength(1);
    expect([50000n, 75000n]).toContain(all[0]?.amount.amount);
  });

  it('findByWorkspaceCategoryMonth returns null when no budget exists', async () => {
    const found = await repository.findByWorkspaceCategoryMonth(
      'ws-does-not-exist',
      'cat-does-not-exist',
      '2026-01',
    );
    expect(found).toBeNull();
  });

  it('save/findById/delete cover the direct-insert path', async () => {
    const created = await repository.save(
      MonthlyBudget.create(
        '',
        'ws-4',
        'cat-4',
        '2026-07',
        Money.fromMinorUnits(300000n, 'UAH'),
      ),
    );

    expect(created.id).toBeDefined();

    const found = await repository.findById(created.id);
    expect(found?.amount.amount).toBe(300000n);

    await repository.delete(created.id);
    expect(await repository.findById(created.id)).toBeNull();
  });
});
