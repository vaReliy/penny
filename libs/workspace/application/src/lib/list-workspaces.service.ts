import { BaseService } from 'shared-kernel';
import { ID_PATTERN } from 'shared-util';
import { Workspace } from 'workspace-core';
import type { IWorkspaceRepository } from 'workspace-core';
import type { ServiceContext } from 'shared-kernel';

import { assertSuperadmin } from './workspace-authorization.js';

/** LIVR schema for {@link ListWorkspacesService} input. */
const LIST_WORKSPACES_SCHEMA: Record<string, unknown> = {
  memberUserId: [{ like: ID_PATTERN }],
};

/** Input for {@link ListWorkspacesService}. */
export interface ListWorkspacesParams {
  readonly memberUserId?: string;
}

/** Dependencies {@link ListWorkspacesService} needs, injected via its constructor. */
export interface ListWorkspacesDeps {
  readonly workspaceRepository: IWorkspaceRepository;
}

/**
 * Lists every workspace, or only those `memberUserId` belongs to when
 * provided. Superadmin-only.
 */
export class ListWorkspacesService extends BaseService<
  ListWorkspacesParams,
  Workspace[]
> {
  private readonly workspaceRepository: IWorkspaceRepository;

  public constructor(deps: ListWorkspacesDeps) {
    super();
    this.workspaceRepository = deps.workspaceRepository;
  }

  protected override getValidationSchema(): Record<string, unknown> {
    return LIST_WORKSPACES_SCHEMA;
  }

  protected override authorize(context: ServiceContext): void {
    assertSuperadmin(context);
  }

  protected override async execute(
    params: ListWorkspacesParams,
  ): Promise<Workspace[]> {
    if (params.memberUserId) {
      return this.workspaceRepository.findByMemberUserId(params.memberUserId);
    }

    return this.workspaceRepository.findAll();
  }
}
