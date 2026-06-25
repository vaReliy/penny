import { User, UserStatus } from 'identity-core';
import { DomainError } from 'shared-errors';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createMongoConnection,
  disconnectMongoConnection,
  type MongoConnectionConfig,
} from './mongo-connection.js';
import { MongoUserRepository } from './mongo-user-repository.js';
import type { Connection } from 'mongoose';

/**
 * Integration test: exercises `MongoUserRepository` against a real MongoDB
 * instance (docker-compose `mongodb` service), proving the onion's
 * persistence boundary holds end-to-end.
 *
 * Run with: `docker compose -f docker-compose.dev.yml up -d mongodb` first,
 * then run this test (see `mongo-connection.spec.ts` for the same pattern).
 */
describe('MongoUserRepository (integration)', () => {
  const config: MongoConnectionConfig = {
    uri: 'mongodb://localhost:27017',
    dbName: 'penny-test',
  };

  let connection: Connection;
  let repository: MongoUserRepository;

  /** Placeholder id for not-yet-persisted entities — never a valid ObjectId. */
  const NEW_USER_ID = 'new';

  const buildUser = (overrides: Partial<{ telegramId: string }> = {}): User =>
    new User({
      id: NEW_USER_ID,
      telegramId: overrides.telegramId ?? '111222333',
      firstName: 'Ada',
      lastName: 'Lovelace',
      username: 'ada',
      photoUrl: 'https://example.com/ada.png',
      status: UserStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

  beforeAll(async () => {
    connection = await createMongoConnection(config);
    repository = new MongoUserRepository(connection);
  });

  afterAll(async () => {
    await connection.dropDatabase();
    await disconnectMongoConnection(connection);
  });

  it('creates, finds, updates via domain transition, and deletes a user', async () => {
    const created = await repository.save(
      buildUser({ telegramId: '111222333' }),
    );

    expect(created.id).toBeDefined();
    expect(created).toBeInstanceOf(User);
    expect(created.telegramId).toBe('111222333');
    expect(created.firstName).toBe('Ada');
    expect(created.lastName).toBe('Lovelace');
    expect(created.username).toBe('ada');
    expect(created.photoUrl).toBe('https://example.com/ada.png');
    expect(created.status).toBe(UserStatus.PENDING);
    expect(created.createdAt).toBeInstanceOf(Date);
    expect(created.updatedAt).toBeInstanceOf(Date);
    expect(
      Object.keys(created as unknown as Record<string, unknown>),
    ).not.toContain('_id');
    expect(
      Object.keys(created as unknown as Record<string, unknown>),
    ).not.toContain('__v');

    const foundByTelegramId = await repository.findByTelegramId('111222333');
    expect(foundByTelegramId).not.toBeNull();
    expect(foundByTelegramId).toBeInstanceOf(User);
    expect(foundByTelegramId?.id).toBe(created.id);

    const approved = (foundByTelegramId as User).approve();
    const updated = await repository.save(approved);
    expect(updated).toBeInstanceOf(User);
    expect(updated.id).toBe(created.id);
    expect(updated.status).toBe(UserStatus.ACTIVE);
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
      created.updatedAt.getTime(),
    );
    // Profile fields and createdAt must be untouched by the status transition.
    expect(updated.firstName).toBe('Ada');
    expect(updated.lastName).toBe('Lovelace');
    expect(updated.username).toBe('ada');
    expect(updated.photoUrl).toBe('https://example.com/ada.png');
    expect(updated.createdAt.getTime()).toBe(created.createdAt.getTime());

    const foundById = await repository.findById(created.id);
    expect(foundById).not.toBeNull();
    expect(foundById?.status).toBe(UserStatus.ACTIVE);

    const profileUpdated = (foundById as User).updateProfile({
      firstName: 'Augusta',
      lastName: 'King',
      username: 'augusta',
      photoUrl: 'https://example.com/augusta.png',
    });
    const savedProfileUpdate = await repository.save(profileUpdated);
    expect(savedProfileUpdate.id).toBe(created.id);
    expect(savedProfileUpdate.firstName).toBe('Augusta');
    expect(savedProfileUpdate.lastName).toBe('King');
    expect(savedProfileUpdate.username).toBe('augusta');
    expect(savedProfileUpdate.photoUrl).toBe('https://example.com/augusta.png');
    // Status and telegramId must be untouched by a profile-only update.
    expect(savedProfileUpdate.status).toBe(UserStatus.ACTIVE);
    expect(savedProfileUpdate.telegramId).toBe('111222333');

    const foundAfterProfileUpdate = await repository.findById(created.id);
    expect(foundAfterProfileUpdate?.firstName).toBe('Augusta');
    expect(foundAfterProfileUpdate?.username).toBe('augusta');

    // Clearing a previously-set optional field must actually unset it in
    // the DB, not just leave it `undefined` in the in-memory return value
    // (regression test: Mongoose silently drops `undefined` keys on a plain
    // `$set`, so the old value would otherwise persist forever).
    const usernameCleared = (foundAfterProfileUpdate as User).updateProfile({
      username: undefined,
    });
    const savedUsernameCleared = await repository.save(usernameCleared);
    expect(savedUsernameCleared.username).toBeUndefined();
    // Other fields must be untouched by the partial clear.
    expect(savedUsernameCleared.firstName).toBe('Augusta');
    expect(savedUsernameCleared.lastName).toBe('King');
    expect(savedUsernameCleared.photoUrl).toBe(
      'https://example.com/augusta.png',
    );

    const foundAfterClear = await repository.findById(created.id);
    expect(foundAfterClear?.username).toBeUndefined();
    expect(foundAfterClear?.firstName).toBe('Augusta');

    await repository.delete(created.id);

    const afterDelete = await repository.findById(created.id);
    expect(afterDelete).toBeNull();
  });

  it('persists a rejection transition (pending -> rejected)', async () => {
    const telegramId = '444555666';
    const created = await repository.save(buildUser({ telegramId }));

    const rejected = created.reject();
    const saved = await repository.save(rejected);

    expect(saved.status).toBe(UserStatus.REJECTED);

    const found = await repository.findById(created.id);
    expect(found?.status).toBe(UserStatus.REJECTED);

    await repository.delete(created.id);
  });

  it('is a no-op when deleting an id that does not exist', async () => {
    await expect(
      repository.delete('000000000000000000000000'),
    ).resolves.toBeUndefined();
    await expect(
      repository.delete('not-a-valid-object-id'),
    ).resolves.toBeUndefined();
  });

  it('maps a unique telegramId violation to a DomainError', async () => {
    const telegramId = '999888777';
    await repository.save(buildUser({ telegramId }));

    await expect(repository.save(buildUser({ telegramId }))).rejects.toThrow(
      DomainError,
    );
  });

  it('returns null for findById/findByTelegramId when no match exists', async () => {
    expect(await repository.findById('000000000000000000000000')).toBeNull();
    expect(await repository.findByTelegramId('does-not-exist')).toBeNull();
  });
});
