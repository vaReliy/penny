/** Typed configuration read from environment variables at app bootstrap. */
export interface ApiConfig {
  readonly mongoUri: string;
  readonly mongoDbName: string;
  readonly jwtSecret: string;
  readonly botToken: string;
  readonly port: number;
}

/** Symbol-keyed DI token for `ApiConfig`. */
export const API_CONFIG = Symbol('ApiConfig');

/**
 * Reads and validates required environment variables at process startup.
 * All `process.env` reads in the platform are confined to this function;
 * no library or service reads `process.env` directly.
 *
 * @throws {Error} If any required variable is missing.
 */
export function loadApiConfig(): ApiConfig {
  const mongoUri = process.env['MONGO_URI'];
  const mongoDbName = process.env['MONGO_DB_NAME'];
  const jwtSecret = process.env['JWT_SECRET'];
  const botToken = process.env['TELEGRAM_BOT_TOKEN'];
  const portRaw = process.env['PORT'];

  if (!mongoUri) throw new Error('Missing env var: MONGO_URI');
  if (!mongoDbName) throw new Error('Missing env var: MONGO_DB_NAME');
  if (!jwtSecret) throw new Error('Missing env var: JWT_SECRET');
  if (!botToken) throw new Error('Missing env var: TELEGRAM_BOT_TOKEN');

  const port = portRaw ? parseInt(portRaw, 10) : 3000;
  if (!Number.isFinite(port)) {
    throw new Error(`Invalid PORT env var: "${portRaw}"`);
  }

  return {
    mongoUri,
    mongoDbName,
    jwtSecret,
    botToken,
    port,
  };
}
