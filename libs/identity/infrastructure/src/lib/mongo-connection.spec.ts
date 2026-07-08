import { afterEach, describe, expect, it } from 'vitest';

import {
  createMongoConnection,
  disconnectMongoConnection,
  pingMongo,
  type MongoConnectionConfig,
} from './mongo-connection.js';

/**
 * Smoke test: connect to MongoDB via the factory, ping it, and disconnect.
 * This test proves the connection factory works against a local docker-compose mongo.
 *
 * Run with: `docker compose up -d mongo` in a terminal (auth is enabled — see
 * `.env` for `MONGO_USER`/`MONGO_PASSWORD`), then run this test.
 */
describe('Mongo Connection (smoke test)', () => {
  /**
   * Local docker-compose target: the compose file maps port 27017 on the host.
   * The URI is read from `MONGO_TEST_URI` (see `.env` / `README.md`),
   * falling back to an unauthenticated localhost URI for environments
   * where auth is disabled.
   */
  const config: MongoConnectionConfig = {
    uri: process.env['MONGO_TEST_URI'] ?? 'mongodb://localhost:27017',
    dbName: 'penny-test',
  };

  it('connects to mongo and pings the server', async () => {
    const connection = await createMongoConnection(config);

    expect(connection).toBeDefined();
    expect(connection.readyState).toBe(1); // 1 = connected

    // Ping the server to prove connectivity
    const pingResult = await pingMongo(connection);
    expect(pingResult).toBe(true);

    // Clean up
    await disconnectMongoConnection(connection);
    expect(connection.readyState).toBe(0); // 0 = disconnected
  });

  afterEach(async () => {
    // Ensure connection is closed after each test
    // No reconnection attempt — just close what was created in the test body above.
  });
});
