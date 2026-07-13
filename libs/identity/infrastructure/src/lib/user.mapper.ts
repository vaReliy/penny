import type { DocumentType } from '@typegoose/typegoose';

import { User } from 'identity-core';
import type { UserProfileUpdate } from 'identity-core';
import type { RoleType, UserStatus } from 'shared-contracts';

import type { UserModel } from './user.model.js';

/**
 * Plain persistence shape accepted by {@link MongoUserRepository} when
 * creating/updating a document. Mirrors {@link UserModel}'s own fields
 * (minus Mongoose/Typegoose machinery) so callers outside this file never
 * need to reference Mongoose types.
 */
export interface UserPersistence {
  readonly telegramId: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly username?: string;
  readonly photoUrl?: string;
  readonly status: UserStatus;
  readonly roles: readonly RoleType[];
}

/** Optional `UserPersistence` field names that may need an explicit `$unset`. */
const OPTIONAL_PERSISTENCE_FIELDS = [
  'firstName',
  'lastName',
  'username',
  'photoUrl',
] as const;

/** `$set`/`$unset` update document scoped to mutable profile fields only. */
export interface UserProfilePersistenceUpdate {
  readonly $set: Partial<
    Pick<UserPersistence, 'firstName' | 'lastName' | 'username' | 'photoUrl'>
  >;
  readonly $unset: Readonly<Record<string, ''>>;
}

/** `$set`-only update document scoped to the `status` field. */
export interface UserStatusPersistenceUpdate {
  readonly $set: Pick<UserPersistence, 'status'>;
}

/** `$set`-only update document scoped to the `roles` field. */
export interface UserRolesPersistenceUpdate {
  readonly $set: Pick<UserPersistence, 'roles'>;
}

/**
 * Translates between the domain `User` entity and the Typegoose `UserModel`
 * persistence shape. Mongoose/Typegoose/BSON types are confined to this
 * file (and `user.model.ts`) — nothing leaks past `MongoUserRepository`'s
 * public surface, which only returns `User` domain entities.
 */
export const UserMapper = {
  /** Converts a hydrated Mongoose document into a domain `User` entity. */
  toDomain(doc: DocumentType<UserModel>): User {
    return new User({
      id: doc._id.toString(),
      telegramId: doc.telegramId,
      firstName: doc.firstName,
      lastName: doc.lastName,
      username: doc.username,
      photoUrl: doc.photoUrl,
      status: doc.status,
      // Cast at the ORM boundary: `UserModel.roles` is persisted as plain
      // `string[]` (Mongoose/BSON has no enum-constrained array type).
      roles: doc.roles as readonly RoleType[],
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    });
  },

  /** Converts a domain `User` entity into the plain persistence shape. */
  toPersistence(user: User): UserPersistence {
    return {
      telegramId: user.telegramId,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      photoUrl: user.photoUrl,
      status: user.status,
      roles: user.roles,
    };
  },

  /**
   * Converts a partial `UserProfileUpdate` into a `$set`/`$unset` update
   * document scoped exclusively to mutable profile fields. `status` and
   * `telegramId` are structurally absent from the returned document, so a
   * `findByIdAndUpdate` call using this output can never overwrite them.
   */
  toProfilePersistenceUpdate(
    profile: Partial<UserProfileUpdate>,
  ): UserProfilePersistenceUpdate {
    const set: {
      -readonly [K in
        | 'firstName'
        | 'lastName'
        | 'username'
        | 'photoUrl']?: string;
    } = {};
    const unset: Record<string, ''> = {};

    for (const field of OPTIONAL_PERSISTENCE_FIELDS) {
      const value = profile[field];
      if (value === undefined) {
        unset[field] = '';
      } else {
        set[field] = value;
      }
    }

    return { $set: set, $unset: unset };
  },

  /**
   * Converts a `status` value into a `$set` update document scoped
   * exclusively to that field. `roles`, profile fields, and `telegramId` are
   * structurally absent from the returned document, so a `findByIdAndUpdate`
   * call using this output can never overwrite them.
   */
  toStatusPersistenceUpdate(status: UserStatus): UserStatusPersistenceUpdate {
    return { $set: { status } };
  },

  /**
   * Converts a `roles` array into a `$set` update document scoped
   * exclusively to that field. `status`, profile fields, and `telegramId`
   * are structurally absent from the returned document, so a
   * `findByIdAndUpdate` call using this output can never overwrite them.
   */
  toRolesPersistenceUpdate(
    roles: readonly RoleType[],
  ): UserRolesPersistenceUpdate {
    return { $set: { roles } };
  },
};
