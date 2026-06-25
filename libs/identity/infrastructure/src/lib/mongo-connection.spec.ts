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
 * Run with: `docker compose -f docker-compose.dev.yml up -d mongodb` in a terminal,
 * then run this test.
 */
describe('Mongo Connection (smoke test)', () => {
  /**
   * Local docker-compose target: the compose file maps port 27017 on the host.
   * This URI is fixed for the smoke test — no environment variable lookup needed.
   */
  const config: MongoConnectionConfig = {
    uri: 'mongodb://localhost:27017',
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
