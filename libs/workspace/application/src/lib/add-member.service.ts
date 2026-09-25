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

/** LIVR schema for {@link AddMemberService} input. */
const ADD_MEMBER_SCHEMA: Record<string, unknown> = {
  workspaceId: ['required', { like: ID_PATTERN }],
  userId: ['required', { like: ID_PATTERN }],
  role: [
    { default: WorkspaceMemberRole.MEMBER },
    { one_of: Object.values(WorkspaceMemberRole) },
  ],
  grantedBy: ['required', 'string', 'not_empty'],
};

/** Input for {@link AddMemberService}. */
export interface AddMemberParams {
  readonly workspaceId: string;
  readonly userId: string;
  readonly role?: WorkspaceMemberRoleType;
  readonly grantedBy: string;
}

/** Dependencies {@link AddMemberService} needs, injected via its constructor. */
export interface AddMemberDeps {
  readonly workspaceRepository: IWorkspaceRepository;
}

/** Builds the `NotFoundError` thrown when a mutation targets an unknown workspace. */
function buildUnknownWorkspaceError(workspaceId: string): NotFoundError {
  return new NotFoundError(`No workspace found with id "${workspaceId}".`);
}

/** Adds a new member to a workspace. Superadmin-only. */
export class AddMemberService extends BaseService<AddMemberParams, Workspace> {
  private readonly workspaceRepository: IWorkspaceRepository;

  public constructor(deps: AddMemberDeps) {
    super();
    this.workspaceRepository = deps.workspaceRepository;
  }

  protected override getValidationSchema(): Record<string, unknown> {
    return ADD_MEMBER_SCHEMA;
  }

  protected override authorize(context: ServiceContext): void {
    assertSuperadmin(context);
  }

  protected override async execute(
    params: AddMemberParams,
  ): Promise<Workspace> {
    const workspace = await this.workspaceRepository.findById(
      params.workspaceId,
    );
    if (!workspace) {
      throw buildUnknownWorkspaceError(params.workspaceId);
    }

    // LIVR's `{ default: WorkspaceMemberRole.MEMBER }` rule guarantees `role`
    // is always set by validation time; the `?? MEMBER` fallback exists only
    // to satisfy TS on the optional `AddMemberParams.role`, never to re-decide
    // the default.
    const updated = workspace.addMember(
      params.userId,
      params.role ?? WorkspaceMemberRole.MEMBER,
      params.grantedBy,
    );

    return this.workspaceRepository.save(updated);
  }
}
