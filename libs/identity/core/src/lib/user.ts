import { DomainError } from 'shared-errors';
import type { RoleType } from 'shared-contracts';

import { UserStatus } from './user-status.js';

/**
 * Allowed `UserStatus` transitions, keyed by the current status. `active`
 * and `rejected` are terminal — no further transitions are permitted.
 */
const ALLOWED_TRANSITIONS: Readonly<Record<UserStatus, readonly UserStatus[]>> =
  {
    [UserStatus.PENDING]: [UserStatus.ACTIVE, UserStatus.REJECTED],
    [UserStatus.ACTIVE]: [],
    [UserStatus.REJECTED]: [],
  };

/** Constructor input for {@link User}. */
export interface UserProps {
  readonly id: string;
  /** Durable identity key. Immutable once the user is created. */
  readonly telegramId: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly username?: string;
  readonly photoUrl?: string;
  readonly status: UserStatus;
  /** Platform roles granted to this user (e.g. `Role.SUPERADMIN`). Defaults to `[]`. */
  readonly roles?: readonly RoleType[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** Mutable profile fields a caller may update via {@link User.updateProfile}. */
export type UserProfileUpdate = Pick<
  UserProps,
  'firstName' | 'lastName' | 'username' | 'photoUrl'
>;

/**
 * Platform user identity, keyed by the durable `telegramId`.
 *
 * Pure domain entity: no persistence/framework concerns. Profile fields
 * (`firstName`, `lastName`, `username`, `photoUrl`) are optional and
 * mutable; `telegramId` is the durable identity key and never changes
 * after creation. All mutating methods return a new `User` instance
 * (the entity is immutable from the outside).
 */
export class User {
  private readonly props: UserProps;

  public constructor(props: UserProps) {
    this.props = { ...props, roles: props.roles ?? [] };
  }

  public get id(): string {
    return this.props.id;
  }

  public get telegramId(): string {
    return this.props.telegramId;
  }

  public get firstName(): string | undefined {
    return this.props.firstName;
  }

  public get lastName(): string | undefined {
    return this.props.lastName;
  }

  public get username(): string | undefined {
    return this.props.username;
  }

  public get photoUrl(): string | undefined {
    return this.props.photoUrl;
  }

  public get status(): UserStatus {
    return this.props.status;
  }

  public get roles(): readonly RoleType[] {
    // Non-null: the constructor always normalises `roles` to `[]` when absent.
    return this.props.roles as readonly RoleType[];
  }

  public get createdAt(): Date {
    return this.props.createdAt;
  }

  public get updatedAt(): Date {
    return this.props.updatedAt;
  }

  /** True when `status` is `active`. */
  public isActive(): boolean {
    return this.props.status === UserStatus.ACTIVE;
  }

  /** True when `status` is `pending`. */
  public isPending(): boolean {
    return this.props.status === UserStatus.PENDING;
  }

  /** True when `status` is `rejected`. */
  public isRejected(): boolean {
    return this.props.status === UserStatus.REJECTED;
  }

  /** True only when the user is permitted to authenticate, i.e. `status === 'active'`. */
  public canLogin(): boolean {
    return this.isActive();
  }

  /** True when transitioning from the current status to `next` is permitted. */
  public canTransitionTo(next: UserStatus): boolean {
    return ALLOWED_TRANSITIONS[this.props.status].includes(next);
  }

  /**
   * Returns a new `User` with `status` transitioned to `next`.
   *
   * @throws {DomainError} If the transition is not permitted from the
   * current status (see `ALLOWED_TRANSITIONS`).
   */
  public transitionTo(next: UserStatus, now: Date = new Date()): User {
    if (!this.canTransitionTo(next)) {
      throw DomainError.forbidden(
        `Cannot transition user from "${this.props.status}" to "${next}".`,
      );
    }

    return new User({ ...this.props, status: next, updatedAt: now });
  }

  /** Returns a new `User` approved (`pending` -> `active`). */
  public approve(now: Date = new Date()): User {
    return this.transitionTo(UserStatus.ACTIVE, now);
  }

  /** Returns a new `User` rejected (`pending` -> `rejected`). */
  public reject(now: Date = new Date()): User {
    return this.transitionTo(UserStatus.REJECTED, now);
  }

  /** Returns a new `User` with the given mutable profile fields merged in. */
  public updateProfile(
    update: Partial<UserProfileUpdate>,
    now: Date = new Date(),
  ): User {
    return new User({ ...this.props, ...update, updatedAt: now });
  }
}
