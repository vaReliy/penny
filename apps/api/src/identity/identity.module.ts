import { Injectable, Inject, Module } from '@nestjs/common';
import type { OnApplicationShutdown } from '@nestjs/common';
import type { Connection } from 'mongoose';

import {
  createMongoConnection,
  disconnectMongoConnection,
  MongoUserRepository,
} from 'identity-infrastructure';
import {
  JwtTokenIssuer,
  LoginWithTelegramService,
  VerifyTelegramLoginService,
  ApproveUserService,
  RejectUserService,
} from 'identity-application';
import type { IUserRepository } from 'identity-core';
import type { ITokenIssuer } from 'identity-application';

import { API_CONFIG } from '../config/api-config.js';
import type { ApiConfig } from '../config/api-config.js';
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
  providers: [
    {
      provide: TOKENS.MongoConnection,
      useFactory: async (config: ApiConfig): Promise<Connection> =>
        createMongoConnection({
          uri: config.mongoUri,
          dbName: config.mongoDbName,
        }),
      inject: [API_CONFIG],
    },
    {
      provide: TOKENS.UserRepository,
      useFactory: (connection: Connection): IUserRepository =>
        new MongoUserRepository(connection),
      inject: [TOKENS.MongoConnection],
    },
    {
      provide: TOKENS.TokenIssuer,
      useFactory: (config: ApiConfig): ITokenIssuer =>
        new JwtTokenIssuer(config.jwtSecret),
      inject: [API_CONFIG],
    },
    {
      provide: TOKENS.VerifyTelegramLogin,
      useFactory: (): VerifyTelegramLoginService =>
        new VerifyTelegramLoginService(),
    },
    {
      provide: TOKENS.LoginWithTelegram,
      useFactory: (userRepository: IUserRepository): LoginWithTelegramService =>
        new LoginWithTelegramService({ userRepository }),
      inject: [TOKENS.UserRepository],
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
    TOKENS.TokenIssuer,
    TOKENS.VerifyTelegramLogin,
    TOKENS.LoginWithTelegram,
    TOKENS.ApproveUser,
    TOKENS.RejectUser,
  ],
})
export class IdentityModule {}
