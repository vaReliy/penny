import { NotFoundError } from 'shared-errors';
import { BaseService } from 'shared-kernel';
import { ID_PATTERN } from 'shared-util';
import { Workspace } from 'workspace-core';
import type { IWorkspaceRepository } from 'workspace-core';
import type { ServiceContext } from 'shared-kernel';

import { assertSuperadmin } from './workspace-authorization.js';

/** LIVR schema for {@link RemoveMemberService} input. */
const REMOVE_MEMBER_SCHEMA: Record<string, unknown> = {
  workspaceId: ['required', { like: ID_PATTERN }],
  userId: ['required', { like: ID_PATTERN }],
};

/** Input for {@link RemoveMemberService}. */
export interface RemoveMemberParams {
  readonly workspaceId: string;
  readonly userId: string;
}

/** Dependencies {@link RemoveMemberService} needs, injected via its constructor. */
export interface RemoveMemberDeps {
  readonly workspaceRepository: IWorkspaceRepository;
}

/** Builds the `NotFoundError` thrown when a mutation targets an unknown workspace. */
function buildUnknownWorkspaceError(workspaceId: string): NotFoundError {
  return new NotFoundError(`No workspace found with id "${workspaceId}".`);
}

/** Removes a member from a workspace. Superadmin-only. */
export class RemoveMemberService extends BaseService<
  RemoveMemberParams,
  Workspace
> {
  private readonly workspaceRepository: IWorkspaceRepository;

  public constructor(deps: RemoveMemberDeps) {
    super();
    this.workspaceRepository = deps.workspaceRepository;
  }

  protected override getValidationSchema(): Record<string, unknown> {
    return REMOVE_MEMBER_SCHEMA;
  }

  protected override authorize(context: ServiceContext): void {
    assertSuperadmin(context);
  }

  protected override async execute(
    params: RemoveMemberParams,
  ): Promise<Workspace> {
    const workspace = await this.workspaceRepository.findById(
      params.workspaceId,
    );
    if (!workspace) {
      throw buildUnknownWorkspaceError(params.workspaceId);
    }

    const updated = workspace.removeMember(params.userId);

    return this.workspaceRepository.save(updated);
  }
}
