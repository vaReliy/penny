import { NotFoundError } from 'shared-errors';
import { BaseService } from 'shared-kernel';
import { ID_PATTERN } from 'shared-util';
import { Workspace, WorkspaceMemberRole } from 'workspace-core';
import type {
  IWorkspaceRepository,
  WorkspaceMemberRoleType,
} from 'workspace-core';
import type { ServiceContext } from 'shared-kernel';

import { assertSuperadmin } from './workspace-authorization.js';

/** LIVR schema for {@link SetMemberRoleService} input. */
const SET_MEMBER_ROLE_SCHEMA: Record<string, unknown> = {
  workspaceId: ['required', { like: ID_PATTERN }],
  userId: ['required', { like: ID_PATTERN }],
  role: ['required', { one_of: Object.values(WorkspaceMemberRole) }],
};

/** Input for {@link SetMemberRoleService}. */
export interface SetMemberRoleParams {
  readonly workspaceId: string;
  readonly userId: string;
  readonly role: WorkspaceMemberRoleType;
}

/** Result of {@link SetMemberRoleService}. */
export interface SetMemberRoleResult {
  readonly workspace: Workspace;
  /** `false` when `role` already equaled the member's current role — no `save` call was made. */
  readonly changed: boolean;
}

/** Dependencies {@link SetMemberRoleService} needs, injected via its constructor. */
export interface SetMemberRoleDeps {
  readonly workspaceRepository: IWorkspaceRepository;
}

/** Builds the `NotFoundError` thrown when a mutation targets an unknown workspace. */
function buildUnknownWorkspaceError(workspaceId: string): NotFoundError {
  return new NotFoundError(`No workspace found with id "${workspaceId}".`);
}

/**
 * Changes a member's role. A no-op when `role` already matches the current
 * role — `save` is not called in that case. Superadmin-only.
 */
export class SetMemberRoleService extends BaseService<
  SetMemberRoleParams,
  SetMemberRoleResult
> {
  private readonly workspaceRepository: IWorkspaceRepository;

  public constructor(deps: SetMemberRoleDeps) {
    super();
    this.workspaceRepository = deps.workspaceRepository;
  }

  protected override getValidationSchema(): Record<string, unknown> {
    return SET_MEMBER_ROLE_SCHEMA;
  }

  protected override authorize(context: ServiceContext): void {
    assertSuperadmin(context);
  }

  protected override async execute(
    params: SetMemberRoleParams,
  ): Promise<SetMemberRoleResult> {
    const workspace = await this.workspaceRepository.findById(
      params.workspaceId,
    );
    if (!workspace) {
      throw buildUnknownWorkspaceError(params.workspaceId);
    }

    const updated = workspace.changeRole(params.userId, params.role);
    if (updated === workspace) {
      return { workspace, changed: false };
    }

    return {
      workspace: await this.workspaceRepository.save(updated),
      changed: true,
    };
  }
}
