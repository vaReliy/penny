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
  AddMemberService,
  CreateWorkspaceService,
  ListWorkspacesService,
  RemoveMemberService,
  SetMemberRoleService,
} from 'workspace-application';
import type { IWorkspaceRepository } from 'workspace-core';

import { API_CONFIG } from '../config/cli-config.js';
import type { CliConfig } from '../config/cli-config.js';
import { LoggerModule } from '../logger/logger.module.js';
import { PINO_LOGGER } from '../logger/logger.tokens.js';
import { WORKSPACE_TOKENS } from './tokens.js';

/**
 * DI token for the workspace-scoped Mongo connection. Kept separate from
 * `CliIdentityModule`'s `TOKENS.MongoConnection` — `workspace-infrastructure`
 * deliberately duplicates its own connection factory rather than importing
 * cross-scope (see `mongo-connection.ts`), so this module owns an
 * independent connection with its own lifecycle.
 */
const WORKSPACE_MONGO_CONNECTION = Symbol('WorkspaceMongoConnection');

@Injectable()
class WorkspaceShutdownHook implements OnApplicationShutdown {
  constructor(
    @Inject(WORKSPACE_MONGO_CONNECTION)
    private readonly conn: Connection,
  ) {}

  async onApplicationShutdown(): Promise<void> {
    await disconnectMongoConnection(this.conn);
  }
}

@Module({
  imports: [LoggerModule],
  providers: [
    {
      provide: WORKSPACE_MONGO_CONNECTION,
      useFactory: async (config: CliConfig): Promise<Connection> =>
        createMongoConnection({
          uri: config.mongoUri,
          dbName: config.mongoDbName,
        }),
      inject: [API_CONFIG],
    },
    {
      provide: WORKSPACE_TOKENS.WorkspaceRepository,
      useFactory: (
        connection: Connection,
        logger: pino.Logger,
      ): IWorkspaceRepository =>
        new MongoWorkspaceRepository(connection, logger),
      inject: [WORKSPACE_MONGO_CONNECTION, PINO_LOGGER],
    },
    {
      provide: WORKSPACE_TOKENS.CreateWorkspace,
      useFactory: (
        workspaceRepository: IWorkspaceRepository,
      ): CreateWorkspaceService =>
        new CreateWorkspaceService({ workspaceRepository }),
      inject: [WORKSPACE_TOKENS.WorkspaceRepository],
    },
    {
      provide: WORKSPACE_TOKENS.AddMember,
      useFactory: (
        workspaceRepository: IWorkspaceRepository,
      ): AddMemberService => new AddMemberService({ workspaceRepository }),
      inject: [WORKSPACE_TOKENS.WorkspaceRepository],
    },
    {
      provide: WORKSPACE_TOKENS.SetMemberRole,
      useFactory: (
        workspaceRepository: IWorkspaceRepository,
      ): SetMemberRoleService =>
        new SetMemberRoleService({ workspaceRepository }),
      inject: [WORKSPACE_TOKENS.WorkspaceRepository],
    },
    {
      provide: WORKSPACE_TOKENS.RemoveMember,
      useFactory: (
        workspaceRepository: IWorkspaceRepository,
      ): RemoveMemberService =>
        new RemoveMemberService({ workspaceRepository }),
      inject: [WORKSPACE_TOKENS.WorkspaceRepository],
    },
    {
      provide: WORKSPACE_TOKENS.ListWorkspaces,
      useFactory: (
        workspaceRepository: IWorkspaceRepository,
      ): ListWorkspacesService =>
        new ListWorkspacesService({ workspaceRepository }),
      inject: [WORKSPACE_TOKENS.WorkspaceRepository],
    },
    WorkspaceShutdownHook,
  ],
  exports: [
    WORKSPACE_TOKENS.WorkspaceRepository,
    WORKSPACE_TOKENS.CreateWorkspace,
    WORKSPACE_TOKENS.AddMember,
    WORKSPACE_TOKENS.SetMemberRole,
    WORKSPACE_TOKENS.RemoveMember,
    WORKSPACE_TOKENS.ListWorkspaces,
  ],
})
export class CliWorkspaceModule {}
