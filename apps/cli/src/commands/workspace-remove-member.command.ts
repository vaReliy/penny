import { Inject } from '@nestjs/common';
import { Command, CommandRunner, Option } from 'nest-commander';
import type pino from 'pino';

import { RemoveMemberService } from 'workspace-application';
import type { IUserRepository } from 'identity-core';
import type { ServiceContext } from 'shared-kernel';

import { API_CONFIG } from '../config/cli-config.js';
import type { CliConfig } from '../config/cli-config.js';
import { PINO_LOGGER } from '../logger/logger.tokens.js';
import { TOKENS } from '../identity/tokens.js';
import { WORKSPACE_TOKENS } from '../workspace/tokens.js';
import { CLI_ADMIN_CALLER } from '../shared/cli-admin-caller.js';
import { resolveUserByTelegramId } from '../shared/resolve-user-by-telegram-id.js';
import { logWorkspaceAudit } from '../shared/log-workspace-audit.js';
import { printCliError } from '../shared/print-cli-error.js';

interface WorkspaceRemoveMemberOptions {
  workspace: string;
  telegramId: string;
}

@Command({
  name: 'workspace:remove-member',
  description: 'Remove a member from a workspace.',
})
export class WorkspaceRemoveMemberCommand extends CommandRunner {
  constructor(
    @Inject(WORKSPACE_TOKENS.RemoveMember)
    private readonly removeMember: RemoveMemberService,
    @Inject(TOKENS.UserRepository)
    private readonly userRepository: IUserRepository,
    @Inject(API_CONFIG)
    private readonly config: CliConfig,
    @Inject(PINO_LOGGER)
    private readonly logger: pino.Logger,
  ) {
    super();
  }

  async run(
    _inputs: string[],
    options: WorkspaceRemoveMemberOptions,
  ): Promise<void> {
    try {
      const member = await resolveUserByTelegramId(
        this.userRepository,
        options.telegramId,
      );

      const ctx: ServiceContext<CliConfig> = {
        config: this.config,
        caller: CLI_ADMIN_CALLER,
      };

      const { data: workspace } = await this.removeMember.run(
        {
          workspaceId: options.workspace,
          userId: member.id,
        },
        ctx,
      );

      logWorkspaceAudit(this.logger, {
        action: 'member.remove',
        workspaceId: workspace.id,
        userId: member.id,
        telegramId: options.telegramId,
      });

      console.log(`Removed ${options.telegramId} from ${workspace.id}`);
    } catch (error) {
      printCliError(error, this.logger);
    }
  }

  @Option({
    flags: '--workspace <workspaceId>',
    description: 'Id of the workspace to remove the member from.',
    required: true,
  })
  parseWorkspace(val: string): string {
    return val;
  }

  @Option({
    flags: '--telegram-id <telegramId>',
    description: 'Telegram ID of the member to remove.',
    required: true,
  })
  parseTelegramId(val: string): string {
    return val;
  }
}
