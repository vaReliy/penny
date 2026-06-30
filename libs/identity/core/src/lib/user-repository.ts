import type { IRepository } from 'shared-kernel';

import type { User, UserProfileUpdate } from './user.js';

/**
 * Data access contract for {@link User} aggregates.
 *
 * Extends the kernel's generic {@link IRepository} (`findById`/`save`/
 * `delete`) with identity-specific lookups. No `create` method is declared
 * here — the inherited `save` already covers persisting both new and
 * updated entities, so a separate `create` would be redundant and
 * ambiguous for implementers.
 *
 * Status transitions are not exposed on this interface either. Callers
 * must load the entity (`findById`/`findByTelegramId`), invoke the
 * relevant domain method (`User.transitionTo`/`approve`/`reject`, which
 * validates the transition and returns a new instance), and persist the
 * result via `save`. This keeps transition validation in the domain layer
 * and prevents infrastructure implementations from bypassing it with a
 * raw status update.
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
}
