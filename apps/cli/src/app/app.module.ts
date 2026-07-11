import { Module } from '@nestjs/common';
import { CommandRunnerModule } from 'nest-commander';

import { ConfigModule } from '../config/config.module.js';
import { LoggerModule } from '../logger/logger.module.js';
import { CliIdentityModule } from '../identity/cli-identity.module.js';
import { UserApproveCommand } from '../commands/user-approve.command.js';
import { UserRejectCommand } from '../commands/user-reject.command.js';
import { DevCreateUserCommand } from '../commands/dev-create-user.command.js';
import { DevTokenCommand } from '../commands/dev-token.command.js';
import { AdminPromoteCommand } from '../commands/admin-promote.command.js';

@Module({
  imports: [
    ConfigModule,
    LoggerModule,
    CliIdentityModule,
    CommandRunnerModule.forModule(),
  ],
  providers: [
    UserApproveCommand,
    UserRejectCommand,
    DevCreateUserCommand,
    DevTokenCommand,
    AdminPromoteCommand,
  ],
})
export class AppModule {}
