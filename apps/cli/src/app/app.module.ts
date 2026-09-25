import { Module } from '@nestjs/common';
import { CommandRunnerModule } from 'nest-commander';

import { ConfigModule } from '../config/config.module.js';
import { LoggerModule } from '../logger/logger.module.js';
import { CliIdentityModule } from '../identity/cli-identity.module.js';
import { CliWorkspaceModule } from '../workspace/cli-workspace.module.js';
import { UserApproveCommand } from '../commands/user-approve.command.js';
import { UserRejectCommand } from '../commands/user-reject.command.js';
import { UserListCommand } from '../commands/user-list.command.js';
import { DevCreateUserCommand } from '../commands/dev-create-user.command.js';
import { DevTokenCommand } from '../commands/dev-token.command.js';
import { AdminPromoteCommand } from '../commands/admin-promote.command.js';
import { WorkspaceCreateCommand } from '../commands/workspace-create.command.js';
import { WorkspaceListCommand } from '../commands/workspace-list.command.js';
import { WorkspaceAddMemberCommand } from '../commands/workspace-add-member.command.js';
import { WorkspaceSetRoleCommand } from '../commands/workspace-set-role.command.js';
import { WorkspaceRemoveMemberCommand } from '../commands/workspace-remove-member.command.js';

@Module({
  imports: [
    ConfigModule,
    LoggerModule,
    CliIdentityModule,
    CliWorkspaceModule,
    CommandRunnerModule.forModule(),
  ],
  providers: [
    UserApproveCommand,
    UserRejectCommand,
    UserListCommand,
    DevCreateUserCommand,
    DevTokenCommand,
    AdminPromoteCommand,
    WorkspaceCreateCommand,
    WorkspaceListCommand,
    WorkspaceAddMemberCommand,
    WorkspaceSetRoleCommand,
    WorkspaceRemoveMemberCommand,
  ],
})
export class AppModule {}
