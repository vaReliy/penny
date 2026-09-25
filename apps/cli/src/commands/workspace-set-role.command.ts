import { Inject } from '@nestjs/common';
import { Command, CommandRunner, Option } from 'nest-commander';
import type pino from 'pino';

import { SetMemberRoleService } from 'workspace-application';
import type { WorkspaceMemberRoleType } from 'workspace-core';
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
import { parseWorkspaceRole } from '../shared/parse-workspace-role.js';
import { printCliError } from '../shared/print-cli-error.js';

interface WorkspaceSetRoleOptions {
  workspace: string;
  telegramId: string;
  role: WorkspaceMemberRoleType;
}

@Command({
  name: 'workspace:set-role',
  description: "Change a workspace member's role.",
})
export class WorkspaceSetRoleCommand extends CommandRunner {
  constructor(
    @Inject(WORKSPACE_TOKENS.SetMemberRole)
    private readonly setMemberRole: SetMemberRoleService,
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
    options: WorkspaceSetRoleOptions,
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

      const { data } = await this.setMemberRole.run(
        {
          workspaceId: options.workspace,
          userId: member.id,
          role: options.role,
        },
        ctx,
      );

      if (!data.changed) {
        console.log('Role unchanged');
        return;
      }

      logWorkspaceAudit(this.logger, {
        action: 'member.set-role',
        workspaceId: data.workspace.id,
        userId: member.id,
        telegramId: options.telegramId,
        role: options.role,
      });

      console.log(
        `Set ${options.telegramId}'s role to ${options.role} in ${data.workspace.id}`,
      );
    } catch (error) {
      printCliError(error, this.logger);
    }
  }

  @Option({
    flags: '--workspace <workspaceId>',
    description: 'Id of the workspace containing the member.',
    required: true,
  })
  parseWorkspace(val: string): string {
    return val;
  }

  @Option({
    flags: '--telegram-id <telegramId>',
    description: 'Telegram ID of the member whose role is changing.',
    required: true,
  })
  parseTelegramId(val: string): string {
    return val;
  }

  @Option({
    flags: '--role <role>',
    description: 'New role: admin or member.',
    required: true,
  })
  parseRole(val: string): WorkspaceMemberRoleType {
    return parseWorkspaceRole(val, this.logger);
  }
}
