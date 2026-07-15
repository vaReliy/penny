import { afterEach, describe, expect, it } from 'vitest';

import {
  createMongoConnection,
  disconnectMongoConnection,
  pingMongo,
  type MongoConnectionConfig,
} from './mongo-connection.js';
import { generateTestDbName } from './test-db-name.js';
import type { Connection } from 'mongoose';

/**
 * Smoke test: connect to MongoDB via the factory, ping it, and disconnect.
 * This test proves the connection factory works against a MongoDB instance.
 *
 * Runs locally: `docker compose up -d mongo` (auth per `.env` MONGO_USER/MONGO_PASSWORD),
 * then set MONGO_TEST_URI and run this test.
 * Runs in CI: GitHub Actions job provides mongo:7 service container with MONGO_TEST_URI set.
 */
describe('Mongo Connection (smoke test)', () => {
  /**
   * Local docker-compose target: the compose file maps port 27017 on the host.
   * The URI is read from `MONGO_TEST_URI` (see `.env` / `README.md`),
   * falling back to an unauthenticated localhost URI for environments
   * where auth is disabled.
   *
   * Unique database name per spec-file run — avoids races when Vitest runs
   * spec files in parallel workers against the same Mongo instance.
   */
  const config: MongoConnectionConfig = {
    uri: process.env['MONGO_TEST_URI'] ?? 'mongodb://localhost:27017',
    dbName: generateTestDbName('penny-test'),
  };

  // Tracked at describe scope so `afterEach` can clean up even if an
  // assertion in the test body throws before reaching manual cleanup code —
  // otherwise a failed assertion leaks an open connection and, since the db
  // name is uniquely generated per run, a permanently orphaned database.
  let connection: Connection | undefined;

  it('connects to mongo and pings the server', async () => {
    connection = await createMongoConnection(config);

    expect(connection).toBeDefined();
    expect(connection.readyState).toBe(1); // 1 = connected

    // Ping the server to prove connectivity
    const pingResult = await pingMongo(connection);
    expect(pingResult).toBe(true);
  });

  afterEach(async () => {
    // Guard: if `createMongoConnection` itself threw, `connection` is still
    // undefined — nothing to clean up.
    if (!connection) {
      return;
    }

    // Drop the per-run database (even though this spec writes no documents,
    // `createMongoConnection` still provisions the database) and close the
    // connection — runs even when an assertion above throws.
    await connection.dropDatabase();
    await disconnectMongoConnection(connection);
    connection = undefined;
  });
});
