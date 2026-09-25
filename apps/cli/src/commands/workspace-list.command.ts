import { Inject } from '@nestjs/common';
import { Command, CommandRunner, Option } from 'nest-commander';
import type pino from 'pino';

import { ListWorkspacesService } from 'workspace-application';
import type { Workspace } from 'workspace-core';
import type { IUserRepository } from 'identity-core';
import type { ServiceContext } from 'shared-kernel';

import { API_CONFIG } from '../config/cli-config.js';
import type { CliConfig } from '../config/cli-config.js';
import { PINO_LOGGER } from '../logger/logger.tokens.js';
import { TOKENS } from '../identity/tokens.js';
import { WORKSPACE_TOKENS } from '../workspace/tokens.js';
import { CLI_ADMIN_CALLER } from '../shared/cli-admin-caller.js';
import { resolveUserByTelegramId } from '../shared/resolve-user-by-telegram-id.js';
import { printCliError } from '../shared/print-cli-error.js';

/** Status shown for a member whose `User` document no longer exists. */
const MISSING_USER_STATUS = 'missing';

interface WorkspaceListOptions {
  telegramId?: string;
}

@Command({
  name: 'workspace:list',
  description: 'List every workspace, or only those --telegram-id belongs to.',
})
export class WorkspaceListCommand extends CommandRunner {
  constructor(
    @Inject(WORKSPACE_TOKENS.ListWorkspaces)
    private readonly listWorkspaces: ListWorkspacesService,
    @Inject(TOKENS.UserRepository)
    private readonly userRepository: IUserRepository,
    @Inject(API_CONFIG)
    private readonly config: CliConfig,
    @Inject(PINO_LOGGER)
    private readonly logger: pino.Logger,
  ) {
    super();
  }

  async run(_inputs: string[], options: WorkspaceListOptions): Promise<void> {
    try {
      let memberUserId: string | undefined;
      if (options.telegramId) {
        const user = await resolveUserByTelegramId(
          this.userRepository,
          options.telegramId,
        );
        memberUserId = user.id;
      }

      const ctx: ServiceContext<CliConfig> = {
        config: this.config,
        caller: CLI_ADMIN_CALLER,
      };

      const { data: workspaces } = await this.listWorkspaces.run(
        { memberUserId },
        ctx,
      );

      if (workspaces.length === 0) {
        console.log('No workspaces found.');
        return;
      }

      for (const workspace of workspaces) {
        await this.printWorkspace(workspace);
      }
      console.log(`Total: ${workspaces.length} workspace(s)`);
    } catch (error) {
      printCliError(error, this.logger);
    }
  }

  private async printWorkspace(workspace: Workspace): Promise<void> {
    console.log(
      `${workspace.id} | ${workspace.name} | ${workspace.members.length} member(s)`,
    );

    for (const member of workspace.members) {
      const user = await this.userRepository.findById(member.userId);
      const telegramId = user?.telegramId ?? member.userId;
      const username = user?.username ?? '-';
      const status = user?.status ?? MISSING_USER_STATUS;

      console.log(
        `  - ${telegramId} | ${username} | ${member.role} | ${status}`,
      );
    }
  }

  @Option({
    flags: '--telegram-id <telegramId>',
    description: 'Restrict listing to workspaces this user belongs to.',
  })
  parseTelegramId(val: string): string {
    return val;
  }
}
