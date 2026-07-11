import type { DocumentType } from '@typegoose/typegoose';
import { describe, expect, it } from 'vitest';

import { User, UserStatus } from 'identity-core';
import { Role } from 'shared-contracts';

import { UserMapper } from './user.mapper.js';
import type { UserModel } from './user.model.js';

/** Minimal hydrated-document shape `UserMapper.toDomain` reads from. */
function buildDoc(roles: string[]): DocumentType<UserModel> {
  return {
    _id: { toString: () => '507f1f77bcf86cd799439011' },
    telegramId: '123456789',
    firstName: 'Ada',
    lastName: 'Lovelace',
    username: 'ada',
    photoUrl: 'https://example.com/ada.png',
    status: UserStatus.ACTIVE,
    roles,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  } as unknown as DocumentType<UserModel>;
}

describe('UserMapper — roles round-trip', () => {
  it('toDomain carries a persisted non-empty roles array onto the domain User', () => {
    const doc = buildDoc([Role.SUPERADMIN]);

    const user = UserMapper.toDomain(doc);

    expect(user.roles).toEqual([Role.SUPERADMIN]);
  });

  it('toDomain carries an empty persisted roles array onto the domain User', () => {
    const doc = buildDoc([]);

    const user = UserMapper.toDomain(doc);

    expect(user.roles).toEqual([]);
  });

  it('toPersistence includes the domain User roles unchanged', () => {
    const user = new User({
      id: '507f1f77bcf86cd799439011',
      telegramId: '123456789',
      status: UserStatus.ACTIVE,
      roles: [Role.SUPERADMIN],
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    const persistence = UserMapper.toPersistence(user);

    expect(persistence.roles).toEqual([Role.SUPERADMIN]);
  });

  it('toPersistence defaults roles to [] when the domain User was constructed without roles', () => {
    const user = new User({
      id: '507f1f77bcf86cd799439011',
      telegramId: '123456789',
      status: UserStatus.ACTIVE,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    const persistence = UserMapper.toPersistence(user);

    expect(persistence.roles).toEqual([]);
  });

  it('toPersistenceUpdate carries roles into the $set document', () => {
    const user = new User({
      id: '507f1f77bcf86cd799439011',
      telegramId: '123456789',
      status: UserStatus.ACTIVE,
      roles: [Role.SUPERADMIN],
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    const update = UserMapper.toPersistenceUpdate(user);

    expect(update.$set['roles']).toEqual([Role.SUPERADMIN]);
  });
});
