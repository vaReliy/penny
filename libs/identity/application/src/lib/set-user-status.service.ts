import { AuthenticationError, DomainError, NotFoundError } from 'shared-errors';
import { BaseService } from 'shared-kernel';
import { Role, UserStatus } from 'shared-contracts';
import type { IUserRepository, User } from 'identity-core';
import type { ServiceContext } from 'shared-kernel';

/** Role name a `CallerIdentity` must carry to approve/reject users. */
export const SUPERADMIN_ROLE = Role.SUPERADMIN;

/** Message used when a non-admin caller attempts an approve/reject action. */
const NOT_ADMIN_MESSAGE = 'Only an admin may approve or reject a user.';

/** LIVR schema shared by `ApproveUserService`/`RejectUserService` input. */
const SET_USER_STATUS_SCHEMA: Record<string, unknown> = {
  userId: ['required', 'string'],
};

/** Input for {@link ApproveUserService}/{@link RejectUserService}. */
export interface SetUserStatusParams {
  readonly userId: string;
}

/** Dependencies the status-transition services need, injected via their constructor. */
export interface SetUserStatusDeps {
  readonly userRepository: IUserRepository;
}

/** Builds the `NotFoundError` thrown when an admin action targets an unknown user. */
function buildUnknownUserError(userId: string): NotFoundError {
  return new NotFoundError(`No user found with id "${userId}".`);
}

/**
 * Builds the `DomainError` (HTTP 409) surfaced when the compare-and-swap
 * status update fails because another caller already changed the user's
 * status between this request's read and write. The caller must re-fetch
 * and retry explicitly — this is never retried silently, so the losing
 * admin action is never mistaken for a silent success.
 */
function buildStatusConflictError(userId: string): DomainError {
  return DomainError.conflict(
    `User "${userId}" was concurrently modified; refresh and retry.`,
  );
}

/**
 * Shared base for the admin-only `pending -> active`/`pending -> rejected`
 * transitions. Framework-free `application` service — no DI
 * decorators. Not exported directly; concrete subclasses
 * (`ApproveUserService`/`RejectUserService`) fix the target status, since
 * each maps to its own distinct admin action/audit trail at the interface
 * layer.
 *
 * Authorization and the legality of the transition itself are deliberately
 * layered: `authorize` rejects a non-admin caller with `AuthenticationError`
 * before any data is touched; `execute` then asks the loaded `User` entity
 * whether the transition is legal (`User.transitionTo`, which throws
 * `DomainError` for e.g. an already-`active` or already-`rejected` user)
 * rather than re-implementing that rule here.
 */
abstract class SetUserStatusService extends BaseService<
  SetUserStatusParams,
  User
> {
  private readonly userRepository: IUserRepository;

  protected constructor(deps: SetUserStatusDeps) {
    super();
    this.userRepository = deps.userRepository;
  }

  /** The status this subclass transitions a `pending` user to. */
  protected abstract readonly targetStatus: UserStatus;

  protected override getValidationSchema(): Record<string, unknown> {
    return SET_USER_STATUS_SCHEMA;
  }

  protected override authorize(context: ServiceContext): void {
    if (!context.caller?.roles.includes(SUPERADMIN_ROLE)) {
      throw new AuthenticationError(NOT_ADMIN_MESSAGE);
    }
  }

  protected override async execute(params: SetUserStatusParams): Promise<User> {
    const user = await this.userRepository.findById(params.userId);

    if (!user) {
      // Distinct from the `DomainError` `User.transitionTo` throws below for
      // an illegal status transition: a missing resource is a 404, not a
      // business-rule rejection, so it gets its own error type.
      throw buildUnknownUserError(params.userId);
    }

    // transitionTo validates the transition (throws DomainError if illegal);
    // only the resulting status is then persisted, via a scoped update. The
    // pre-transition status is captured and passed through as the CAS
    // expectation, so a concurrent transition that lands first causes this
    // write to fail loudly instead of silently overwriting it.
    const currentStatus = user.status;
    const transitioned = user.transitionTo(this.targetStatus);
    const persisted = await this.userRepository.updateStatus(
      params.userId,
      transitioned.status,
      currentStatus,
    );

    if (!persisted) {
      // The user existed moments ago (via findById above), so a null result
      // here means the CAS filter didn't match: a concurrent transition
      // changed the status first. Distinct from the true 404 case above.
      throw buildStatusConflictError(params.userId);
    }

    return persisted;
  }
}

/** Approves a `pending` user, transitioning them to `active`. */
export class ApproveUserService extends SetUserStatusService {
  protected override readonly targetStatus = UserStatus.ACTIVE;

  public constructor(deps: SetUserStatusDeps) {
    super(deps);
  }
}

/** Rejects a `pending` user, transitioning them to `rejected`. */
export class RejectUserService extends SetUserStatusService {
  protected override readonly targetStatus = UserStatus.REJECTED;

  public constructor(deps: SetUserStatusDeps) {
    super(deps);
  }
}
