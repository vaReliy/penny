import { Injectable, Inject, Module } from '@nestjs/common';
import type { OnApplicationShutdown } from '@nestjs/common';
import type pino from 'pino';
import type { Connection } from 'mongoose';

import {
  createMongoConnection,
  disconnectMongoConnection,
  MongoWorkspaceRepository,
} from 'workspace-infrastructure';
import {
  FindMembershipService,
  ListMyWorkspacesService,
} from 'workspace-application';
import type { IWorkspaceRepository } from 'workspace-core';

import { AuthModule } from '../auth/auth.module.js';
import { API_CONFIG } from '../config/api-config.js';
import type { ApiConfig } from '../config/api-config.js';
import { LoggerModule } from '../logger/logger.module.js';
import { PINO_LOGGER } from '../logger/logger.tokens.js';
import { TOKENS } from './tokens.js';
import { WorkspaceMemberGuard } from './workspace-member.guard.js';
import { WorkspacesController } from './workspaces.controller.js';

@Injectable()
class WorkspaceMongoShutdownHook implements OnApplicationShutdown {
  constructor(
    @Inject(TOKENS.MongoConnection) private readonly conn: Connection,
  ) {}

  async onApplicationShutdown(): Promise<void> {
    await disconnectMongoConnection(this.conn);
  }
}

/**
 * Wires the workspace vertical's read-side services for the API: the
 * membership lookup behind `WorkspaceMemberGuard` and `GET /api/workspaces`.
 * Owns its own Mongo connection, like `BudgetModule` and `IdentityModule`
 * (cross-scope connection reuse is fenced by the ESLint scope boundary).
 * Any module whose controllers apply `WorkspaceMemberGuard` must import
 * this module so the guard's dependency resolves in its injector.
 */
@Module({
  imports: [LoggerModule, AuthModule],
  controllers: [WorkspacesController],
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
      provide: TOKENS.WorkspaceRepository,
      useFactory: (
        connection: Connection,
        logger: pino.Logger,
      ): IWorkspaceRepository =>
        new MongoWorkspaceRepository(connection, logger),
      inject: [TOKENS.MongoConnection, PINO_LOGGER],
    },
    {
      provide: TOKENS.FindMembership,
      useFactory: (
        workspaceRepository: IWorkspaceRepository,
      ): FindMembershipService =>
        new FindMembershipService({ workspaceRepository }),
      inject: [TOKENS.WorkspaceRepository],
    },
    {
      provide: TOKENS.ListMyWorkspaces,
      useFactory: (
        workspaceRepository: IWorkspaceRepository,
      ): ListMyWorkspacesService =>
        new ListMyWorkspacesService({ workspaceRepository }),
      inject: [TOKENS.WorkspaceRepository],
    },
    WorkspaceMemberGuard,
    WorkspaceMongoShutdownHook,
  ],
  exports: [
    TOKENS.MongoConnection,
    TOKENS.FindMembership,
    WorkspaceMemberGuard,
  ],
})
export class WorkspaceModule {}
