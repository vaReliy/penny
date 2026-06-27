import { Module } from '@nestjs/common';
import { CommandRunnerModule } from 'nest-commander';

import { ConfigModule } from '../config/config.module.js';
import { LoggerModule } from '../logger/logger.module.js';
import { CliIdentityModule } from '../identity/cli-identity.module.js';
import { UserApproveCommand } from '../commands/user-approve.command.js';
import { UserRejectCommand } from '../commands/user-reject.command.js';

@Module({
  imports: [
    ConfigModule,
    LoggerModule,
    CliIdentityModule,
    CommandRunnerModule.forModule(),
  ],
  providers: [UserApproveCommand, UserRejectCommand],
})
export class AppModule {}
