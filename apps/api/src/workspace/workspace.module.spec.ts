import 'reflect-metadata';

import { Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { createConnection } from 'mongoose';
import { afterEach, describe, expect, it } from 'vitest';

import { FindMembershipService } from 'workspace-application';

import { API_CONFIG } from '../config/api-config.js';
import type { ApiConfig } from '../config/api-config.js';
import { TOKENS as IDENTITY_TOKENS } from '../identity/tokens.js';
import { TOKENS } from './tokens.js';
import { WorkspaceMemberGuard } from './workspace-member.guard.js';
import { WorkspaceModule } from './workspace.module.js';

const TEST_CONFIG: ApiConfig = {
  mongoUri: 'mongodb://localhost:27017',
  mongoDbName: 'penny-test',
  jwtSecret: 'test-secret-at-least-32-characters',
  botToken: 'test-bot-token',
  telegramBotUsername: 'test_bot',
  port: 3000,
  mode: 'development',
};

/** Stands in for the app's `@Global()` `ConfigModule` without reading `process.env`. */
@Global()
@Module({
  providers: [{ provide: API_CONFIG, useValue: TEST_CONFIG }],
  exports: [API_CONFIG],
})
class TestConfigModule {}

describe('WorkspaceModule', () => {
  let moduleRef: TestingModule | undefined;

  afterEach(async () => {
    await moduleRef?.close();
    moduleRef = undefined;
  });

  it('compiles and resolves WorkspaceMemberGuard with a FindMembershipService', async () => {
    moduleRef = await Test.createTestingModule({
      imports: [TestConfigModule, WorkspaceModule],
    })
      .overrideProvider(TOKENS.MongoConnection)
      .useValue(createConnection())
      .overrideProvider(IDENTITY_TOKENS.MongoConnection)
      .useValue(createConnection())
      .compile();

    expect(moduleRef.get(WorkspaceMemberGuard)).toBeInstanceOf(
      WorkspaceMemberGuard,
    );
    expect(moduleRef.get(TOKENS.FindMembership)).toBeInstanceOf(
      FindMembershipService,
    );
  });
});
