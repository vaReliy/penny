/** Typed configuration for the CLI — only the env vars the CLI needs. */
export interface CliConfig {
  readonly mongoUri: string;
  readonly mongoDbName: string;
  readonly mode: 'production' | 'development';
}

/**
 * Symbol-keyed DI token for `CliConfig`.
 * Uses the same description as `apps/api`'s `API_CONFIG` so that consumer
 * code shared between the two apps (e.g. `IdentityModule`) reads consistently,
 * but each app maintains its own independent DI container.
 */
export const API_CONFIG = Symbol('ApiConfig');

/**
 * Reads and validates only the environment variables the CLI needs.
 * JWT_SECRET, TELEGRAM_BOT_TOKEN, and PORT are not required by the CLI.
 *
 * @throws {Error} If any required variable is missing.
 */
export function loadCliConfig(): CliConfig {
  const mongoUri = process.env['MONGO_URI'];
  const mongoDbName = process.env['MONGO_DB_NAME'];

  if (!mongoUri) throw new Error('Missing env var: MONGO_URI');
  if (!mongoDbName) throw new Error('Missing env var: MONGO_DB_NAME');

  return {
    mongoUri,
    mongoDbName,
    mode:
      process.env['NODE_ENV'] === 'production' ? 'production' : 'development',
  };
}
