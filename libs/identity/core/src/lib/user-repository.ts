import type { IRepository } from 'shared-kernel';
import type { RoleType, UserStatus } from 'shared-contracts';

import type { User, UserProfileUpdate } from './user.js';

/**
 * Data access contract for {@link User} aggregates.
 *
 * Extends the kernel's generic {@link IRepository} (`findById`/`save`/
 * `delete`) with identity-specific lookups. No `create` method is declared
 * here — the inherited `save` already covers persisting new entities, so a
 * separate `create` would be redundant and ambiguous for implementers.
 * `save` must only ever be called with a not-yet-persisted entity (`id ===
 * ''`); persisted entities are updated exclusively through the scoped
 * `updateProfile`/`updateStatus`/`updateRoles` methods below.
 *
 * Status transitions are not persisted directly on this interface either.
 * Callers must load the entity (`findById`/`findByTelegramId`), invoke the
 * relevant domain method (`User.transitionTo`/`approve`/`reject`, which
 * validates the transition and returns a new instance), and persist just
 * the resulting `status` via `updateStatus`. This keeps transition
 * validation in the domain layer while keeping persistence scoped/narrow,
 * mirroring `updateProfile`'s approach — no single write can clobber a
 * field it didn't intend to change.
 *
 * All methods return `User` domain entities only — no DTOs/persistence
 * models may leak through this interface. Concrete implementations
 * (`type:infrastructure`) adapt this against a specific ORM (e.g. Prisma).
 */
export interface IUserRepository extends IRepository<User, string> {
  /** Finds a user by the durable `telegramId` identity key, or `null` if none exists. */
  findByTelegramId(telegramId: string): Promise<User | null>;

  /** Finds a user by their Telegram username, or `null` if none exists. */
  findByUsername(username: string): Promise<User | null>;

  /**
   * Updates only mutable profile fields (`firstName`, `lastName`, `username`,
   * `photoUrl`) for the user with the given `id`. Never touches `status` or
   * `telegramId`, so concurrent admin approvals cannot be overwritten by a
   * login profile refresh. Returns `null` when no user with that `id` exists.
   */
  updateProfile(
    id: string,
    profile: Partial<UserProfileUpdate>,
  ): Promise<User | null>;

  /**
   * Updates only the `status` field for the user with the given `id`. Never
   * touches profile fields, `roles`, or `telegramId`, so a concurrent
   * profile refresh or role change cannot be overwritten by a status
   * transition. Returns `null` when no user with that `id` exists.
   */
  updateStatus(id: string, status: UserStatus): Promise<User | null>;

  /**
   * Updates only the `roles` field for the user with the given `id`. Never
   * touches profile fields, `status`, or `telegramId`, so a concurrent
   * profile refresh or status transition cannot be overwritten by a role
   * change. Returns `null` when no user with that `id` exists.
   */
  updateRoles(id: string, roles: readonly RoleType[]): Promise<User | null>;
}
