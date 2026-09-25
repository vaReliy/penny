import { Inject } from '@nestjs/common';
import { Command, CommandRunner, Option } from 'nest-commander';
import type pino from 'pino';

import { CreateWorkspaceService } from 'workspace-application';
import { WorkspaceMemberRole } from 'workspace-core';
import type { IUserRepository } from 'identity-core';
import type { ServiceContext } from 'shared-kernel';

import { API_CONFIG } from '../config/cli-config.js';
import type { CliConfig } from '../config/cli-config.js';
import { PINO_LOGGER } from '../logger/logger.tokens.js';
import { TOKENS } from '../identity/tokens.js';
import { WORKSPACE_TOKENS } from '../workspace/tokens.js';
import { CLI_ADMIN_CALLER } from '../shared/cli-admin-caller.js';
import { resolveUserByTelegramId } from '../shared/resolve-user-by-telegram-id.js';
import { checkActiveUser } from '../shared/assert-active-user.js';
import { logWorkspaceAudit } from '../shared/log-workspace-audit.js';
import { printCliError } from '../shared/print-cli-error.js';

interface WorkspaceCreateOptions {
  name: string;
  adminTelegramId: string;
}

@Command({
  name: 'workspace:create',
  description:
    'Create a workspace, atomically seeded with one ACTIVE admin member.',
})
export class WorkspaceCreateCommand extends CommandRunner {
  constructor(
    @Inject(WORKSPACE_TOKENS.CreateWorkspace)
    private readonly createWorkspace: CreateWorkspaceService,
    @Inject(TOKENS.UserRepository)
    private readonly userRepository: IUserRepository,
    @Inject(API_CONFIG)
    private readonly config: CliConfig,
    @Inject(PINO_LOGGER)
    private readonly logger: pino.Logger,
  ) {
    super();
  }

  async run(_inputs: string[], options: WorkspaceCreateOptions): Promise<void> {
    try {
      const admin = await resolveUserByTelegramId(
        this.userRepository,
        options.adminTelegramId,
      );
      if (!checkActiveUser(admin, this.logger)) {
        return;
      }

      const ctx: ServiceContext<CliConfig> = {
        config: this.config,
        caller: CLI_ADMIN_CALLER,
      };

      const { data: workspace } = await this.createWorkspace.run(
        {
          name: options.name,
          adminUserId: admin.id,
          grantedBy: 'cli',
        },
        ctx,
      );

      logWorkspaceAudit(this.logger, {
        action: 'workspace.create',
        workspaceId: workspace.id,
        userId: admin.id,
        telegramId: options.adminTelegramId,
        role: WorkspaceMemberRole.ADMIN,
      });

      console.log(`Created workspace "${workspace.name}" (${workspace.id})`);
    } catch (error) {
      printCliError(error, this.logger);
    }
  }

  @Option({
    flags: '--name <name>',
    description: 'Name of the workspace to create.',
    required: true,
  })
  parseName(val: string): string {
    return val;
  }

  @Option({
    flags: '--admin-telegram-id <telegramId>',
    description: 'Telegram ID of the workspace’s first admin.',
    required: true,
  })
  parseAdminTelegramId(val: string): string {
    return val;
  }
}
