import { Account } from 'budget-core';
import pino from 'pino';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const silentLogger = pino({ level: 'silent' });

import {
  createMongoConnection,
  disconnectMongoConnection,
  type MongoConnectionConfig,
} from './mongo-connection.js';
import { MongoAccountRepository } from './mongo-account-repository.js';
import { generateTestDbName } from './test-db-name.js';
import type { Connection } from 'mongoose';

/**
 * Integration test: exercises `MongoAccountRepository` against a real
 * MongoDB instance, proving `findOrCreateDefault`'s upsert semantics hold
 * end-to-end (not just against a mocked model, see
 * `mongo-account-repository.unit.spec.ts`). Mirrors
 * `mongo-category-repository.spec.ts`'s per-worker test DB isolation
 * pattern.
 *
 * Runs locally: `docker compose up -d mongo` first, then set MONGO_TEST_URI
 * and run this test. Runs in CI: GitHub Actions job provides mongo:7 service
 * container with MONGO_TEST_URI set.
 */
describe('MongoAccountRepository (integration)', () => {
  const config: MongoConnectionConfig = {
    uri: process.env['MONGO_TEST_URI'] ?? 'mongodb://localhost:27017',
    dbName: generateTestDbName('penny-test-budget-account'),
  };

  let connection: Connection;
  let repository: MongoAccountRepository;

  beforeAll(async () => {
    connection = await createMongoConnection(config);
    repository = new MongoAccountRepository(connection, silentLogger);
  });

  afterAll(async () => {
    await connection.dropDatabase();
    await disconnectMongoConnection(connection);
  });

  it('creates, finds by id/workspace', async () => {
    const created = await repository.save(
      Account.create('', 'ws-1', 'Main', 'UAH'),
    );

    expect(created).toBeInstanceOf(Account);
    expect(created.id).toBeDefined();
    expect(created.workspaceId).toBe('ws-1');
    expect(created.name).toBe('Main');
    expect(created.currency).toBe('UAH');

    const foundById = await repository.findByIdInWorkspace(created.id, 'ws-1');
    expect(foundById?.name).toBe('Main');

    const foundByWorkspace = await repository.findByWorkspace('ws-1');
    expect(foundByWorkspace.map((a) => a.id)).toContain(created.id);
  });

  it('findOrCreateDefault creates once and is idempotent across repeated calls', async () => {
    const first = await repository.findOrCreateDefault('ws-2', 'Main', 'UAH');
    const second = await repository.findOrCreateDefault('ws-2', 'Main', 'UAH');

    expect(second.id).toBe(first.id);

    const accountsInWorkspace = await repository.findByWorkspace('ws-2');
    expect(accountsInWorkspace).toHaveLength(1);
  });

  it('findOrCreateDefault racing concurrent callers yields exactly one account', async () => {
    const [a, b] = await Promise.all([
      repository.findOrCreateDefault('ws-3', 'Main', 'UAH'),
      repository.findOrCreateDefault('ws-3', 'Main', 'UAH'),
    ]);

    expect(a.id).toBe(b.id);
    const accountsInWorkspace = await repository.findByWorkspace('ws-3');
    expect(accountsInWorkspace).toHaveLength(1);
  });

  it('returns null for findByIdInWorkspace when the id belongs to another workspace', async () => {
    const created = await repository.save(
      Account.create('', 'ws-4', 'Main', 'UAH'),
    );

    const found = await repository.findByIdInWorkspace(created.id, 'ws-5');
    expect(found).toBeNull();
  });
});
