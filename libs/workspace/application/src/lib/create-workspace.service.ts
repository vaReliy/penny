import { BaseService } from 'shared-kernel';
import { ID_PATTERN } from 'shared-util';
import { Workspace } from 'workspace-core';
import type { IWorkspaceRepository } from 'workspace-core';
import type { ServiceContext } from 'shared-kernel';

import { assertSuperadmin } from './workspace-authorization.js';

/** LIVR schema for {@link CreateWorkspaceService} input. */
const CREATE_WORKSPACE_SCHEMA: Record<string, unknown> = {
  name: ['required', 'trim', 'not_empty', { max_length: 64 }],
  adminUserId: ['required', { like: ID_PATTERN }],
  grantedBy: ['required', 'string', 'not_empty'],
};

/** Input for {@link CreateWorkspaceService}. */
export interface CreateWorkspaceParams {
  readonly name: string;
  readonly adminUserId: string;
  readonly grantedBy: string;
}

/** Dependencies {@link CreateWorkspaceService} needs, injected via its constructor. */
export interface CreateWorkspaceDeps {
  readonly workspaceRepository: IWorkspaceRepository;
}

/**
 * Creates a new workspace seeded with exactly one `ADMIN` membership
 * (`adminUserId`). Superadmin-only — a workspace is never self-service
 * created.
 */
export class CreateWorkspaceService extends BaseService<
  CreateWorkspaceParams,
  Workspace
> {
  private readonly workspaceRepository: IWorkspaceRepository;

  public constructor(deps: CreateWorkspaceDeps) {
    super();
    this.workspaceRepository = deps.workspaceRepository;
  }

  protected override getValidationSchema(): Record<string, unknown> {
    return CREATE_WORKSPACE_SCHEMA;
  }

  protected override authorize(context: ServiceContext): void {
    assertSuperadmin(context);
  }

  protected override async execute(
    params: CreateWorkspaceParams,
  ): Promise<Workspace> {
    const workspace = Workspace.create(
      params.name,
      params.adminUserId,
      params.grantedBy,
    );

    return this.workspaceRepository.create(workspace);
  }
}
