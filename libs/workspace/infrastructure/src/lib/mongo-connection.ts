import type { Connection } from 'mongoose';
import mongoose from 'mongoose';

import { getWorkspaceModel } from './workspace.model.js';

/**
 * Default timeout (ms) for Mongoose server selection.
 * Mongoose's own default is 30000ms, which makes an unreachable server hang
 * for 30s before failing — too slow for fast feedback in tests and health checks.
 */
const DEFAULT_SERVER_SELECTION_TIMEOUT_MS = 5000;

/**
 * Configuration for a Mongoose connection.
 * Explicit parameters to be injected by the interface layer (never `process.env` reads inside libs).
 */
export interface MongoConnectionConfig {
  readonly uri: string;
  readonly dbName: string;
  /** Server selection timeout in ms. Defaults to {@link DEFAULT_SERVER_SELECTION_TIMEOUT_MS}. */
  readonly serverSelectionTimeoutMS?: number;
}

/**
 * Factory function to create an independent MongoDB connection via Mongoose.
 * Each call creates a new connection object — not the global singleton.
 * The caller (API, CLI, queue worker bootstrap) is responsible for reading env vars
 * and passing them in as explicit config — this library never reads `process.env`.
 *
 * Mirrors the sibling-scope connection factories used elsewhere in this repo
 * — duplicated rather than imported cross-scope, since `scope:workspace` may
 * only depend on `scope:workspace`/`scope:shared` (see `eslint.config.mjs`
 * depConstraints).
 *
 * @param config - Connection URI and database name
 * @returns A connected Mongoose connection instance
 * @throws If connection fails
 */
export async function createMongoConnection(
  config: MongoConnectionConfig,
): Promise<Connection> {
  const connection = mongoose.createConnection(config.uri, {
    dbName: config.dbName,
    serverSelectionTimeoutMS:
      config.serverSelectionTimeoutMS ?? DEFAULT_SERVER_SELECTION_TIMEOUT_MS,
  });

  // Wait for the connection to be ready before returning
  await connection.asPromise();

  // Mongoose's `autoIndex: true` (default) builds indexes asynchronously in
  // the background as soon as a model is registered on the connection —
  // `connection.asPromise()` above only proves the socket is ready, not that
  // the `members.userId` multikey index build has completed. Awaiting
  // `Model.init()` here (a no-op if the build already finished) makes every
  // repository constructed afterwards on this connection index-ready before
  // the first write.
  await getWorkspaceModel(connection).init();

  return connection;
}

/**
 * Gracefully close a Mongoose connection.
 * Call this during application shutdown.
 *
 * @param connection - The Mongoose connection to close
 */
export async function disconnectMongoConnection(
  connection: Connection,
): Promise<void> {
  if (connection && connection.readyState !== 0) {
    await connection.close();
  }
}
