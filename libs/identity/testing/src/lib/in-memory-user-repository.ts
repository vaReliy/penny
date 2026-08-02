import { User, UserStatus } from 'identity-core';
import type { IUserRepository, UserProfileUpdate } from 'identity-core';
import type { RoleType } from 'shared-contracts';

/**
 * A stateful `IUserRepository` fake, keyed by `id`. Adds a `seed()` method
 * (not part of the real interface) so specs can pre-populate the store.
 */
export interface IInMemoryUserRepository extends IUserRepository {
  /** Directly inserts a user into the store, bypassing `save()`'s id-generation. */
  seed(user: User): void;
}

/**
 * Creates a Map-backed, stateful fake `IUserRepository` implementation.
 *
 * Unlike {@link createFakeUserRepository} (static `vi.fn()` stubs), this
 * factory returns real methods backed by an in-memory `Map`, so callers can
 * exercise multi-step scenarios (seed → run a UseCase → read back the
 * mutated state) and mirrors `MongoUserRepository`'s CAS-via-optional-param
 * semantics on `updateStatus`/`updateRoles`. Because each method is a real
 * function (not a stub), individual calls can still be overridden per-test
 * via `vi.spyOn(repository, 'updateStatus').mockImplementationOnce(...)`
 * while the rest of the test continues to rely on the real implementation.
 *
 * @returns A fresh, empty in-memory repository ready for test injection.
 */
export function createInMemoryUserRepository(): IInMemoryUserRepository {
  const usersById = new Map<string, User>();
  let nextId = 1;

  return {
    seed(user: User): void {
      usersById.set(user.id, user);
    },

    async findById(id: string): Promise<User | null> {
      return usersById.get(id) ?? null;
    },

    async findByTelegramId(telegramId: string): Promise<User | null> {
      for (const user of usersById.values()) {
        if (user.telegramId === telegramId) {
          return user;
        }
      }
      return null;
    },

    async findByUsername(username: string): Promise<User | null> {
      for (const user of usersById.values()) {
        if (user.username === username) {
          return user;
        }
      }
      return null;
    },

    async save(entity: User): Promise<User> {
      const id = entity.id === '' ? `generated-${nextId++}` : entity.id;
      const persisted = new User({
        id,
        telegramId: entity.telegramId,
        firstName: entity.firstName,
        lastName: entity.lastName,
        username: entity.username,
        photoUrl: entity.photoUrl,
        status: entity.status,
        roles: entity.roles,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt,
      });
      usersById.set(id, persisted);
      return persisted;
    },

    async updateProfile(
      id: string,
      profile: Partial<UserProfileUpdate>,
    ): Promise<User | null> {
      const existing = usersById.get(id);
      if (!existing) {
        return null;
      }
      const updated = new User({
        id: existing.id,
        telegramId: existing.telegramId,
        firstName: profile.firstName,
        lastName: profile.lastName,
        username: profile.username,
        photoUrl: profile.photoUrl,
        status: existing.status, // NEVER touched
        roles: existing.roles,
        createdAt: existing.createdAt,
        updatedAt: new Date(),
      });
      usersById.set(id, updated);
      return updated;
    },

    async updateStatus(
      id: string,
      status: UserStatus,
      expectedCurrentStatus?: UserStatus,
    ): Promise<User | null> {
      const existing = usersById.get(id);
      if (!existing) {
        return null;
      }
      if (
        expectedCurrentStatus !== undefined &&
        existing.status !== expectedCurrentStatus
      ) {
        // CAS failure: persisted status no longer matches what the caller
        // read, mirroring MongoUserRepository's filter-doesn't-match null.
        return null;
      }
      const updated = new User({
        id: existing.id,
        telegramId: existing.telegramId,
        firstName: existing.firstName,
        lastName: existing.lastName,
        username: existing.username,
        photoUrl: existing.photoUrl,
        status,
        roles: existing.roles,
        createdAt: existing.createdAt,
        updatedAt: new Date(),
      });
      usersById.set(id, updated);
      return updated;
    },

    async updateRoles(
      id: string,
      roles: readonly RoleType[],
      expectedRoles?: readonly RoleType[],
    ): Promise<User | null> {
      const existing = usersById.get(id);
      if (!existing) {
        return null;
      }
      if (
        expectedRoles !== undefined &&
        (existing.roles.length !== expectedRoles.length ||
          !existing.roles.every((role, index) => role === expectedRoles[index]))
      ) {
        // CAS failure, mirroring `updateStatus`'s expectedCurrentStatus check.
        return null;
      }
      const updated = new User({
        id: existing.id,
        telegramId: existing.telegramId,
        firstName: existing.firstName,
        lastName: existing.lastName,
        username: existing.username,
        photoUrl: existing.photoUrl,
        status: existing.status,
        roles,
        createdAt: existing.createdAt,
        updatedAt: new Date(),
      });
      usersById.set(id, updated);
      return updated;
    },

    async delete(id: string): Promise<void> {
      usersById.delete(id);
    },
  };
}
