import { AuthenticationError } from 'shared-errors';
import { BaseService } from 'shared-kernel';
import { UserStatus } from 'shared-contracts';
import type {
  IWorkspaceRepository,
  WorkspaceMemberRoleType,
} from 'workspace-core';
import type { ServiceContext } from 'shared-kernel';

/** LIVR schema for {@link ListMyWorkspacesService} input — no fields, only the caller identity is used. */
const LIST_MY_WORKSPACES_SCHEMA: Record<string, unknown> = {};

/** Input for {@link ListMyWorkspacesService} — the caller's `userId` alone drives the query. */
export type ListMyWorkspacesParams = Record<string, never>;

/** A single entry in {@link ListMyWorkspacesService}'s result. */
export interface MyWorkspaceSummary {
  readonly id: string;
  readonly name: string;
  readonly role: WorkspaceMemberRoleType;
  readonly grantedAt: Date;
}

/** Dependencies {@link ListMyWorkspacesService} needs, injected via its constructor. */
export interface ListMyWorkspacesDeps {
  readonly workspaceRepository: IWorkspaceRepository;
}

/**
 * Lists the caller's own workspaces, sorted by the caller's `grantedAt`
 * ascending. Never checks `SUPERADMIN` — a superadmin caller gets no
 * implicit access to other workspaces' memberships (S6).
 */
export class ListMyWorkspacesService extends BaseService<
  ListMyWorkspacesParams,
  MyWorkspaceSummary[]
> {
  private readonly workspaceRepository: IWorkspaceRepository;

  public constructor(deps: ListMyWorkspacesDeps) {
    super();
    this.workspaceRepository = deps.workspaceRepository;
  }

  protected override getValidationSchema(): Record<string, unknown> {
    return LIST_MY_WORKSPACES_SCHEMA;
  }

  protected override authorize(context: ServiceContext): void {
    if (!context.caller || context.caller.status !== UserStatus.ACTIVE) {
      throw new AuthenticationError();
    }
  }

  protected override async execute(
    _params: ListMyWorkspacesParams,
    context: ServiceContext,
  ): Promise<MyWorkspaceSummary[]> {
    if (!context.caller) {
      throw new AuthenticationError();
    }
    const { userId } = context.caller;

    const workspaces =
      await this.workspaceRepository.findByMemberUserId(userId);

    const summaries: MyWorkspaceSummary[] = [];
    for (const workspace of workspaces) {
      const membership = workspace.membershipOf(userId);
      // `findByMemberUserId` only returns workspaces `userId` belongs to, so
      // this narrowing guard is provably unreachable — kept explicit rather
      // than a non-null assertion (per code-style-backend.md).
      if (!membership) {
        continue;
      }
      summaries.push({
        id: workspace.id,
        name: workspace.name,
        role: membership.role,
        grantedAt: membership.grantedAt,
      });
    }

    return summaries.sort(
      (a, b) => a.grantedAt.getTime() - b.grantedAt.getTime(),
    );
  }
}
