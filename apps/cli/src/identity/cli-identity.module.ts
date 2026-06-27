import { Injectable, Inject, Module } from '@nestjs/common';
import type { OnApplicationShutdown } from '@nestjs/common';
import type pino from 'pino';
import type { Connection } from 'mongoose';

import {
  createMongoConnection,
  disconnectMongoConnection,
  MongoUserRepository,
} from 'identity-infrastructure';
import { ApproveUserService, RejectUserService } from 'identity-application';
import type { IUserRepository } from 'identity-core';

import { API_CONFIG } from '../config/cli-config.js';
import type { CliConfig } from '../config/cli-config.js';
import { LoggerModule } from '../logger/logger.module.js';
import { PINO_LOGGER } from '../logger/logger.tokens.js';
import { TOKENS } from './tokens.js';

@Injectable()
class MongoShutdownHook implements OnApplicationShutdown {
  constructor(
    @Inject(TOKENS.MongoConnection) private readonly conn: Connection,
  ) {}

  async onApplicationShutdown(): Promise<void> {
    await disconnectMongoConnection(this.conn);
  }
}

@Module({
  imports: [LoggerModule],
  providers: [
    {
      provide: TOKENS.MongoConnection,
      useFactory: async (config: CliConfig): Promise<Connection> =>
        createMongoConnection({
          uri: config.mongoUri,
          dbName: config.mongoDbName,
        }),
      inject: [API_CONFIG],
    },
    {
      provide: TOKENS.UserRepository,
      useFactory: (
        connection: Connection,
        logger: pino.Logger,
      ): IUserRepository => new MongoUserRepository(connection, logger),
      inject: [TOKENS.MongoConnection, PINO_LOGGER],
    },
    {
      provide: TOKENS.ApproveUser,
      useFactory: (userRepository: IUserRepository): ApproveUserService =>
        new ApproveUserService({ userRepository }),
      inject: [TOKENS.UserRepository],
    },
    {
      provide: TOKENS.RejectUser,
      useFactory: (userRepository: IUserRepository): RejectUserService =>
        new RejectUserService({ userRepository }),
      inject: [TOKENS.UserRepository],
    },
    MongoShutdownHook,
  ],
  exports: [
    TOKENS.MongoConnection,
    TOKENS.UserRepository,
    TOKENS.ApproveUser,
    TOKENS.RejectUser,
  ],
})
export class CliIdentityModule {}
