import { Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { createConnection } from 'mongoose';
import type { Connection } from 'mongoose';
import { describe, expect, it, afterEach } from 'vitest';

import { API_CONFIG } from '../config/api-config.js';
import type { ApiConfig } from '../config/api-config.js';
import { TOKENS as IDENTITY_TOKENS } from '../identity/tokens.js';
import { BudgetModule } from './budget.module.js';
import { TOKENS } from './tokens.js';

const TEST_CONFIG: ApiConfig = {
  mongoUri: 'mongodb://localhost:27017',
  mongoDbName: 'penny-test',
  jwtSecret: 'test-secret-at-least-32-characters',
  botToken: 'test-bot-token',
  telegramBotUsername: 'test_bot',
  port: 3000,
  mode: 'development',
};

/**
 * Stands in for the app's `@Global()` `ConfigModule` so `API_CONFIG` resolves
 * everywhere in the graph without `loadApiConfig()` reading `process.env`.
 */
@Global()
@Module({
  providers: [{ provide: API_CONFIG, useValue: TEST_CONFIG }],
  exports: [API_CONFIG],
})
class TestConfigModule {}

/**
 * `createConnection()` with no URI returns an unconnected `Connection` that
 * still registers models, so repository constructors calling
 * `getXModel(connection)` work with zero network I/O.
 */
function createUnconnectedConnection(): Connection {
  return createConnection();
}

describe('BudgetModule', () => {
  let moduleRef: TestingModule | undefined;

  afterEach(async () => {
    await moduleRef?.close();
    moduleRef = undefined;
  });

  it('compiles with every controller guard resolvable', async () => {
    moduleRef = await Test.createTestingModule({
      imports: [TestConfigModule, BudgetModule],
    })
      .overrideProvider(TOKENS.MongoConnection)
      .useValue(createUnconnectedConnection())
      .overrideProvider(IDENTITY_TOKENS.MongoConnection)
      .useValue(createUnconnectedConnection())
      .compile();

    expect(moduleRef).toBeDefined();
  });

  it('exposes the identity tokens its controller guards depend on', async () => {
    moduleRef = await Test.createTestingModule({
      imports: [TestConfigModule, BudgetModule],
    })
      .overrideProvider(TOKENS.MongoConnection)
      .useValue(createUnconnectedConnection())
      .overrideProvider(IDENTITY_TOKENS.MongoConnection)
      .useValue(createUnconnectedConnection())
      .compile();

    expect(
      moduleRef.get(IDENTITY_TOKENS.TokenIssuer, { strict: false }),
    ).toBeDefined();
    expect(
      moduleRef.get(IDENTITY_TOKENS.UserRepository, { strict: false }),
    ).toBeDefined();
  });
});
