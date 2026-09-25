import { AuthenticationError } from 'shared-errors';
import { BaseService } from 'shared-kernel';
import type {
  IWorkspaceRepository,
  WorkspaceMembershipRecord,
} from 'workspace-core';
import type { ServiceContext } from 'shared-kernel';

/**
 * LIVR schema for {@link FindMembershipService} input. `workspaceId` is
 * intentionally NOT `{ like: ID_PATTERN }`-validated here: the W5 guard that
 * calls this service must turn a malformed id into the same opaque `null`
 * (→ 404) as a non-member, not a distinguishable validation error.
 */
const FIND_MEMBERSHIP_SCHEMA: Record<string, unknown> = {
  workspaceId: ['required', 'string'],
};

/** Input for {@link FindMembershipService}. */
export interface FindMembershipParams {
  readonly workspaceId: string;
}

/** Dependencies {@link FindMembershipService} needs, injected via its constructor. */
export interface FindMembershipDeps {
  readonly workspaceRepository: IWorkspaceRepository;
}

/**
 * Finds the caller's own membership in `workspaceId`, or `null` for a
 * malformed id, a nonexistent workspace, or one where the caller is not a
 * member — all three collapse to the same opaque `null` result. Never
 * checks `SUPERADMIN` — a superadmin caller gets no implicit access to
 * other workspaces' memberships (S6).
 */
export class FindMembershipService extends BaseService<
  FindMembershipParams,
  WorkspaceMembershipRecord | null
> {
  private readonly workspaceRepository: IWorkspaceRepository;

  public constructor(deps: FindMembershipDeps) {
    super();
    this.workspaceRepository = deps.workspaceRepository;
  }

  protected override getValidationSchema(): Record<string, unknown> {
    return FIND_MEMBERSHIP_SCHEMA;
  }

  protected override authorize(context: ServiceContext): void {
    if (!context.caller) {
      throw new AuthenticationError();
    }
  }

  protected override async execute(
    params: FindMembershipParams,
    context: ServiceContext,
  ): Promise<WorkspaceMembershipRecord | null> {
    if (!context.caller) {
      throw new AuthenticationError();
    }

    return this.workspaceRepository.findMembership(
      params.workspaceId,
      context.caller.userId,
    );
  }
}
