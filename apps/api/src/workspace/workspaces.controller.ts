import { Controller, Get, Inject, UseGuards } from '@nestjs/common';

import type {
  ListMyWorkspacesService,
  MyWorkspaceSummary,
} from 'workspace-application';
import type { SessionUser, WorkspaceSummaryDto } from 'shared-contracts';

import { SessionGuard } from '../auth/session.guard.js';
import { ActiveUserGuard } from '../auth/active-user.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { TOKENS } from './tokens.js';

/** Maps a `MyWorkspaceSummary` to its wire `WorkspaceSummaryDto` shape. */
function toWorkspaceSummaryDto(
  summary: MyWorkspaceSummary,
): WorkspaceSummaryDto {
  return {
    id: summary.id,
    name: summary.name,
    role: summary.role,
    grantedAt: summary.grantedAt.toISOString(),
  };
}

/** Lists the workspaces the authenticated caller belongs to. */
@Controller('workspaces')
@UseGuards(SessionGuard, ActiveUserGuard)
export class WorkspacesController {
  public constructor(
    @Inject(TOKENS.ListMyWorkspaces)
    private readonly listMyWorkspaces: ListMyWorkspacesService,
  ) {}

  @Get()
  public async list(
    @CurrentUser() user: SessionUser,
  ): Promise<WorkspaceSummaryDto[]> {
    const { data } = await this.listMyWorkspaces.run(
      {},
      {
        config: {},
        caller: { userId: user.id, status: user.status, roles: user.roles },
      },
    );
    return data.map(toWorkspaceSummaryDto);
  }
}
