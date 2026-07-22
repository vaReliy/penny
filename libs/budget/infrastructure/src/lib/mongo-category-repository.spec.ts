import { Category } from 'budget-core';
import { DomainError } from 'shared-errors';
import pino from 'pino';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const silentLogger = pino({ level: 'silent' });

import {
  createMongoConnection,
  disconnectMongoConnection,
  type MongoConnectionConfig,
} from './mongo-connection.js';
import { MongoCategoryRepository } from './mongo-category-repository.js';
import { generateTestDbName } from './test-db-name.js';
import type { Connection } from 'mongoose';

/**
 * Integration test: exercises `MongoCategoryRepository` against a real
 * MongoDB instance, proving the onion's persistence boundary holds
 * end-to-end. Mirrors `mongo-user-repository.spec.ts`'s per-worker test DB
 * isolation pattern (`2026-07-15-01`).
 *
 * Runs locally: `docker compose up -d mongo` first, then set MONGO_TEST_URI
 * and run this test. Runs in CI: GitHub Actions job provides mongo:7 service
 * container with MONGO_TEST_URI set.
 */
describe('MongoCategoryRepository (integration)', () => {
  const config: MongoConnectionConfig = {
    uri: process.env['MONGO_TEST_URI'] ?? 'mongodb://localhost:27017',
    dbName: generateTestDbName('penny-test-budget-category'),
  };

  let connection: Connection;
  let repository: MongoCategoryRepository;

  beforeAll(async () => {
    connection = await createMongoConnection(config);
    repository = new MongoCategoryRepository(connection, silentLogger);
  });

  afterAll(async () => {
    await connection.dropDatabase();
    await disconnectMongoConnection(connection);
  });

  it('creates, finds, renames, archives, and deletes a category', async () => {
    const created = await repository.save(
      Category.create('', 'ws-1', 'Groceries'),
    );

    expect(created).toBeInstanceOf(Category);
    expect(created.id).toBeDefined();
    expect(created.workspaceId).toBe('ws-1');
    expect(created.name).toBe('Groceries');
    expect(created.isArchived()).toBe(false);

    const foundById = await repository.findByIdInWorkspace(created.id, 'ws-1');
    expect(foundById).toBeInstanceOf(Category);
    expect(foundById?.name).toBe('Groceries');

    const foundByName = await repository.findByNameInWorkspace(
      'groceries', // case-insensitive
      'ws-1',
    );
    expect(foundByName?.id).toBe(created.id);

    const renamed = await repository.save(created.rename('Food'));
    expect(renamed.name).toBe('Food');
    expect(renamed.id).toBe(created.id);

    const foundAfterRename = await repository.findByIdInWorkspace(
      created.id,
      'ws-1',
    );
    expect(foundAfterRename?.name).toBe('Food');

    await repository.archive(created.id, 'ws-1');
    const foundAfterArchive = await repository.findByIdInWorkspace(
      created.id,
      'ws-1',
    );
    expect(foundAfterArchive?.isArchived()).toBe(true);
    expect(foundAfterArchive?.archivedAt).toBeInstanceOf(Date);

    // Archived categories are excluded from findByWorkspace by default...
    const activeOnly = await repository.findByWorkspace('ws-1');
    expect(activeOnly.find((c) => c.id === created.id)).toBeUndefined();
    // ...but included when includeArchived is true.
    const withArchived = await repository.findByWorkspace('ws-1', true);
    expect(withArchived.find((c) => c.id === created.id)).toBeDefined();

    await repository.delete(created.id);
    expect(await repository.findByIdInWorkspace(created.id, 'ws-1')).toBeNull();
  });

  it('rejects a duplicate {workspaceId, name} with a domain-meaningful error, case-insensitively', async () => {
    await repository.save(Category.create('', 'ws-2', 'Utilities'));

    await expect(
      repository.save(Category.create('', 'ws-2', 'utilities')),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it('allows the same name in a different workspace', async () => {
    const a = await repository.save(Category.create('', 'ws-3', 'Rent'));
    const b = await repository.save(Category.create('', 'ws-4', 'Rent'));

    expect(a.id).not.toBe(b.id);
  });

  it('allows re-creating a name once the prior holder is archived', async () => {
    const original = await repository.save(
      Category.create('', 'ws-5', 'Subscriptions'),
    );
    await repository.archive(original.id, 'ws-5');

    const recreated = await repository.save(
      Category.create('', 'ws-5', 'Subscriptions'),
    );

    expect(recreated.id).not.toBe(original.id);
    expect(recreated.isArchived()).toBe(false);
  });

  it('rejects renaming with a collision-triggering name from a concurrent create (unique index enforced at write time)', async () => {
    await repository.save(Category.create('', 'ws-6', 'Taken'));
    const other = await repository.save(
      Category.create('', 'ws-6', 'Available'),
    );

    // save() for the rename path uses a scoped $set on `name` only — the
    // unique index still applies at write time.
    await expect(repository.save(other.rename('Taken'))).rejects.toBeInstanceOf(
      Error,
    );
  });
});
