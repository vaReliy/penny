import { Inject } from '@nestjs/common';
import { Command, CommandRunner, Option } from 'nest-commander';
import type pino from 'pino';

import { AddMemberService } from 'workspace-application';
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
import { checkActiveUser } from '../shared/assert-active-user.js';
import { logWorkspaceAudit } from '../shared/log-workspace-audit.js';
import { parseWorkspaceRole } from '../shared/parse-workspace-role.js';
import { printCliError } from '../shared/print-cli-error.js';

interface WorkspaceAddMemberOptions {
  workspace: string;
  telegramId: string;
  role?: WorkspaceMemberRoleType;
}

@Command({
  name: 'workspace:add-member',
  description: 'Add a member to a workspace. Defaults --role to member.',
})
export class WorkspaceAddMemberCommand extends CommandRunner {
  constructor(
    @Inject(WORKSPACE_TOKENS.AddMember)
    private readonly addMember: AddMemberService,
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
    options: WorkspaceAddMemberOptions,
  ): Promise<void> {
    try {
      const member = await resolveUserByTelegramId(
        this.userRepository,
        options.telegramId,
      );
      if (!checkActiveUser(member, this.logger)) {
        return;
      }

      const ctx: ServiceContext<CliConfig> = {
        config: this.config,
        caller: CLI_ADMIN_CALLER,
      };

      const { data: workspace } = await this.addMember.run(
        {
          workspaceId: options.workspace,
          userId: member.id,
          role: options.role,
          grantedBy: 'cli',
        },
        ctx,
      );

      const role = workspace.membershipOf(member.id)?.role;

      logWorkspaceAudit(this.logger, {
        action: 'member.add',
        workspaceId: workspace.id,
        userId: member.id,
        telegramId: options.telegramId,
        role,
      });

      console.log(`Added ${options.telegramId} to ${workspace.id} as ${role}`);
    } catch (error) {
      printCliError(error, this.logger);
    }
  }

  @Option({
    flags: '--workspace <workspaceId>',
    description: 'Id of the workspace to add the member to.',
    required: true,
  })
  parseWorkspace(val: string): string {
    return val;
  }

  @Option({
    flags: '--telegram-id <telegramId>',
    description: 'Telegram ID of the user to add.',
    required: true,
  })
  parseTelegramId(val: string): string {
    return val;
  }

  @Option({
    flags: '--role <role>',
    description: 'Role to grant: admin or member. Defaults to member.',
  })
  parseRole(val: string): WorkspaceMemberRoleType {
    return parseWorkspaceRole(val, this.logger);
  }
}
