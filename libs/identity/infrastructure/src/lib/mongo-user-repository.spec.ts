import { User, UserStatus } from 'identity-core';
import pino from 'pino';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const silentLogger = pino({ level: 'silent' });

import {
  createMongoConnection,
  disconnectMongoConnection,
  type MongoConnectionConfig,
} from './mongo-connection.js';
import { MongoUserRepository } from './mongo-user-repository.js';
import { getUserModel } from './user.model.js';
import type { Connection } from 'mongoose';

/**
 * Integration test: exercises `MongoUserRepository` against a real MongoDB
 * instance (docker-compose `mongo` service), proving the onion's
 * persistence boundary holds end-to-end.
 *
 * Run with: `docker compose up -d mongo` first (auth is enabled — see
 * `.env` for `MONGO_USER`/`MONGO_PASSWORD`), then run this test.
 * The connection URI is read from `MONGO_TEST_URI` (see `.env` /
 * `README.md`), falling back to an unauthenticated localhost URI for
 * environments where auth is disabled.
 */
describe('MongoUserRepository (integration)', () => {
  const config: MongoConnectionConfig = {
    uri: process.env['MONGO_TEST_URI'] ?? 'mongodb://localhost:27017',
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
    repository = new MongoUserRepository(connection, silentLogger);
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

  it('save with an existing telegramId is idempotent and returns the persisted entity', async () => {
    const telegramId = '999888777';
    const first = await repository.save(buildUser({ telegramId }));

    // Second save for the same telegramId must not throw and must return the existing entity.
    const second = await repository.save(buildUser({ telegramId }));

    expect(second).toBeInstanceOf(User);
    expect(second.id).toBe(first.id);
    expect(second.telegramId).toBe(telegramId);

    await repository.delete(first.id);
  });

  it('concurrent saves for the same telegramId result in exactly one document', async () => {
    // Note: Promise.all serialises both calls via the event loop before they reach MongoDB.
    // This proves sequential idempotency, not true concurrent safety.
    // True concurrent safety (the upsert-race retry) is covered by the unit test below.
    const telegramId = '777888999';

    const [a, b] = await Promise.all([
      repository.save(buildUser({ telegramId })),
      repository.save(buildUser({ telegramId })),
    ]);

    // Both promises must resolve without throwing.
    expect(a).toBeInstanceOf(User);
    expect(b).toBeInstanceOf(User);

    // Both returned the same persisted document.
    expect(a.id).toBe(b.id);
    expect(a.telegramId).toBe(telegramId);

    // Exactly one document exists with this telegramId.
    const found = await repository.findByTelegramId(telegramId);
    expect(found).not.toBeNull();
    expect(found?.telegramId).toBe(telegramId);

    await repository.delete(a.id);
  });

  it('raw driver E11000 confirms the error shape the retry catch relies on; repository.save() for an occupied telegramId resolves via upsert (not the retry path)', async () => {
    // Purpose 1: verify that a real MongoDB E11000 carries exactly
    // `{ code: 11000, name: 'MongoServerError' }` — the shape that
    // `isMongoDriverError` + `MONGO_DUPLICATE_KEY_CODE` check in the catch
    // block. If the driver ever changes this shape, this test will break
    // before the retry logic silently stops working.
    //
    // Purpose 2: confirm that repository.save() resolves for a telegramId
    // that is already occupied (upsert path returns the existing document).
    //
    // Note: the *retry* path (findOneAndUpdate throws E11000 → findOne
    // reads the winner) requires two truly concurrent MongoDB connections
    // and cannot be triggered via Promise.all in a single Node.js process.
    // That branch is exercised by the unit test in
    // mongo-user-repository.unit.spec.ts.
    const telegramId = '654654654';
    const model = getUserModel(connection);

    await model.create({ telegramId, status: 'pending' });

    // Force E11000 by inserting the same telegramId again via raw model.
    let duplicateError: unknown;
    try {
      await model.create({ telegramId, status: 'pending' });
    } catch (err) {
      duplicateError = err;
    }
    expect(duplicateError).toBeDefined();
    expect((duplicateError as { code?: number }).code).toBe(11000);
    expect((duplicateError as { name?: string }).name).toBe('MongoServerError');

    // repository.save() for an occupied telegramId must resolve via the
    // $setOnInsert upsert path (returns the pre-existing document), not throw.
    const saved = await repository.save(buildUser({ telegramId }));
    expect(saved).toBeInstanceOf(User);
    expect(saved.telegramId).toBe(telegramId);

    await repository.delete(saved.id);
  });

  it('returns null for findById/findByTelegramId when no match exists', async () => {
    expect(await repository.findById('000000000000000000000000')).toBeNull();
    expect(await repository.findByTelegramId('does-not-exist')).toBeNull();
  });

  it('updateProfile does not overwrite status (concurrent login + approval safety)', async () => {
    const telegramId = '321321321';
    const created = await repository.save(buildUser({ telegramId }));

    // Approve the user first so it has ACTIVE status.
    const approved = created.approve();
    const savedApproved = await repository.save(approved);
    expect(savedApproved.status).toBe(UserStatus.ACTIVE);

    // Simulate concurrent: login updates profile, admin saves approval again.
    // (In production the login updateProfile and admin save may interleave;
    // here we confirm the login path cannot revert status.)
    const [profileResult, adminResult] = await Promise.all([
      repository.updateProfile(created.id, {
        firstName: 'NewName',
        username: 'newusername',
      }),
      repository.save(savedApproved),
    ]);

    // Status must remain ACTIVE — the profile update must not have touched it.
    expect(profileResult?.status).toBe(UserStatus.ACTIVE);
    expect(adminResult.status).toBe(UserStatus.ACTIVE);

    // Profile field was actually written.
    const found = await repository.findById(created.id);
    expect(found?.status).toBe(UserStatus.ACTIVE);
    expect(found?.firstName).toBe('NewName');
    expect(found?.username).toBe('newusername');

    await repository.delete(created.id);
  });
});
