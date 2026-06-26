import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadApiConfig } from './api-config.js';

/** Fully populated set of required environment variables. */
const VALID_ENV: Record<string, string> = {
  MONGO_URI: 'mongodb://localhost:27017',
  MONGO_DB_NAME: 'penny_test',
  JWT_SECRET: 'super-secret-jwt-key',
  TELEGRAM_BOT_TOKEN: '123456:ABCDEF',
  PORT: '4000',
};

afterEach(() => {
  vi.unstubAllEnvs();
});

function stubValidEnv(overrides: Partial<Record<string, string>> = {}): void {
  const env = { ...VALID_ENV, ...overrides };
  for (const [key, value] of Object.entries(env)) {
    vi.stubEnv(key, value);
  }
}

describe('loadApiConfig()', () => {
  it('returns a fully populated config when all env vars are present', () => {
    stubValidEnv();

    const config = loadApiConfig();

    expect(config).toEqual({
      mongoUri: 'mongodb://localhost:27017',
      mongoDbName: 'penny_test',
      jwtSecret: 'super-secret-jwt-key',
      botToken: '123456:ABCDEF',
      port: 4000,
    });
  });

  it('reads MONGO_URI into config.mongoUri', () => {
    stubValidEnv({ MONGO_URI: 'mongodb://db-host:27017' });
    expect(loadApiConfig().mongoUri).toBe('mongodb://db-host:27017');
  });

  it('reads MONGO_DB_NAME into config.mongoDbName', () => {
    stubValidEnv({ MONGO_DB_NAME: 'my_database' });
    expect(loadApiConfig().mongoDbName).toBe('my_database');
  });

  it('reads JWT_SECRET into config.jwtSecret', () => {
    stubValidEnv({ JWT_SECRET: 'very-secret' });
    expect(loadApiConfig().jwtSecret).toBe('very-secret');
  });

  it('reads TELEGRAM_BOT_TOKEN into config.botToken', () => {
    stubValidEnv({ TELEGRAM_BOT_TOKEN: '999:XYZ' });
    expect(loadApiConfig().botToken).toBe('999:XYZ');
  });

  it('parses PORT as an integer', () => {
    stubValidEnv({ PORT: '8080' });
    expect(loadApiConfig().port).toBe(8080);
    expect(typeof loadApiConfig().port).toBe('number');
  });

  it('defaults port to 3000 when PORT is absent', () => {
    stubValidEnv({ PORT: '' });
    expect(loadApiConfig().port).toBe(3000);
  });

  it('throws when MONGO_URI is missing', () => {
    stubValidEnv({ MONGO_URI: '' });
    expect(() => loadApiConfig()).toThrowError('Missing env var: MONGO_URI');
  });

  it('throws when MONGO_DB_NAME is missing', () => {
    stubValidEnv({ MONGO_DB_NAME: '' });
    expect(() => loadApiConfig()).toThrowError(
      'Missing env var: MONGO_DB_NAME',
    );
  });

  it('throws when JWT_SECRET is missing', () => {
    stubValidEnv({ JWT_SECRET: '' });
    expect(() => loadApiConfig()).toThrowError('Missing env var: JWT_SECRET');
  });

  it('throws when TELEGRAM_BOT_TOKEN is missing', () => {
    stubValidEnv({ TELEGRAM_BOT_TOKEN: '' });
    expect(() => loadApiConfig()).toThrowError(
      'Missing env var: TELEGRAM_BOT_TOKEN',
    );
  });
});
